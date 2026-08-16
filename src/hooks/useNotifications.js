import { useCallback, useEffect, useState } from 'react'

import { useLocation } from 'react-router-dom'

import { useAuth } from '@/context/AuthContext'
import { notificationService } from '@/services/notificationService'

// The unread count, and the two writes that change it — Prompt 27 §7.
//
// **One source, however many mounts.** The bell, the nav badge, and the
// notifications page all need the same number, and three components each
// running their own 60-second poll would be three times the traffic and three
// numbers that disagree for up to a minute. So the count lives in a module-level
// cache with a subscriber list: every `useNotifications()` reads the same value
// and re-renders when it changes, and the interval is started by the first
// mount and cleared by the last.
//
// Deliberately *not* a React context. A context would have to be mounted above
// the dashboard and threaded through `AppProviders`, and this is one number —
// the module scope is the provider. The trade-off is that it is global state
// that outlives the tree, which is why `resetFor` runs on every session change:
// signing out and back in as somebody else must not inherit their badge.
//
// Refreshed on mount, on every navigation, on window focus, and once a minute.
// Failures are swallowed (§13): a stale badge is not worth an error state, and
// the next refresh is never more than a minute away.
//
// FUTURE (Laravel): polling is the mock stack's answer to "something happened
// elsewhere". The real backend broadcasts on a private per-user websocket
// channel and this hook subscribes instead of polling — `refresh` stays as the
// reconnect path. Nothing above this module changes.

/** How often the shared timer re-reads the count while anything is mounted. */
export const UNREAD_POLL_INTERVAL_MS = 60_000

/** Shared across every mount — see the note above. */
const cache = {
  userId: null,
  unreadCount: 0,
  /** Bumped by every write, so list surfaces can refetch off one dependency. */
  version: 0,
  /** The in-flight read, reused so N mounts navigating at once make one call. */
  inFlight: null,
}

const listeners = new Set()
let mountCount = 0
let timer = null

function publish() {
  const snapshot = { unreadCount: cache.unreadCount, version: cache.version }
  listeners.forEach((listener) => listener(snapshot))
}

function setCount(next) {
  const safe = Math.max(0, Math.trunc(Number(next) || 0))
  if (safe === cache.unreadCount) return
  cache.unreadCount = safe
  publish()
}

function bumpVersion() {
  cache.version += 1
  publish()
}

function resetFor(userId) {
  cache.userId = userId
  cache.unreadCount = 0
  cache.version += 1
  cache.inFlight = null
  publish()
}

/**
 * Re-reads the count. Concurrent callers share one request — several mounts all
 * reacting to the same navigation is the normal case, not the exception.
 */
function refresh() {
  const { userId } = cache
  if (!userId) return Promise.resolve(0)
  if (cache.inFlight) return cache.inFlight

  const request = notificationService
    .unreadCount(userId)
    .then((total) => {
      // The session may have changed while this was in flight.
      if (cache.userId === userId) setCount(total)
      return total
    })
    .catch(() => cache.unreadCount)
    .finally(() => {
      cache.inFlight = null
    })

  cache.inFlight = request
  return request
}

function retainTimer() {
  mountCount += 1
  if (timer === null) timer = setInterval(refresh, UNREAD_POLL_INTERVAL_MS)
}

function releaseTimer() {
  mountCount = Math.max(0, mountCount - 1)
  if (mountCount === 0 && timer !== null) {
    clearInterval(timer)
    timer = null
  }
}

/**
 * The notification centre's shared state.
 *
 * @returns {{unreadCount: number, version: number, refresh: () => Promise<number>,
 *   markRead: (id: string, read?: boolean) => Promise<void>,
 *   markAllRead: () => Promise<{updated: number, remaining: number}>}}
 *
 * `version` changes on every successful write; put it in a `useApiQuery`
 * dependency list to keep a list of rows in step with the badge.
 *
 * @example
 * const { unreadCount, markRead } = useNotifications()
 */
export function useNotifications() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const { pathname } = useLocation()

  const [snapshot, setSnapshot] = useState(() => ({
    unreadCount: cache.userId === userId ? cache.unreadCount : 0,
    version: cache.version,
  }))

  useEffect(() => {
    const listener = (next) => setSnapshot(next)
    listeners.add(listener)
    retainTimer()
    return () => {
      listeners.delete(listener)
      releaseTimer()
    }
  }, [])

  // A different member (or a sign-out) invalidates everything cached.
  useEffect(() => {
    if (cache.userId !== userId) resetFor(userId)
  }, [userId])

  // On mount and on every navigation. `refresh` coalesces, so several mounts
  // reacting to one route change still make a single request.
  useEffect(() => {
    if (userId) refresh()
  }, [userId, pathname])

  // Coming back to a tab that has been open all afternoon.
  useEffect(() => {
    if (!userId) return undefined
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [userId])

  /**
   * Optimistic (§13): the badge moves now and is put back if the write fails,
   * because a bell that lags a click by 300ms reads as a broken bell.
   */
  const markRead = useCallback(async (id, read = true) => {
    if (!id) return
    const delta = read ? -1 : 1
    setCount(cache.unreadCount + delta)

    try {
      await (read ? notificationService.markRead(id) : notificationService.markUnread(id))
      bumpVersion()
    } catch (error) {
      setCount(cache.unreadCount - delta)
      throw error
    }
  }, [])

  const markAllRead = useCallback(async () => {
    if (!cache.userId) return { updated: 0, remaining: 0 }
    const previous = cache.unreadCount
    setCount(0)

    try {
      const result = await notificationService.markAllRead(cache.userId)
      bumpVersion()
      // `markAllRead` is capped per call (MOCK-BULK), so the truth may not be
      // zero — take it from the server rather than assuming.
      setCount(result.remaining)
      return result
    } catch (error) {
      setCount(previous)
      throw error
    }
  }, [])

  return {
    unreadCount: snapshot.unreadCount,
    version: snapshot.version,
    refresh,
    markRead,
    markAllRead,
  }
}

export default useNotifications
