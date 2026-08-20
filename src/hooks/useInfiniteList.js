import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

// Accumulating list state — Storefront V2 (`prompts-v2/07` §3).
//
// `usePaginatedQuery` **replaces** one page with the next, which is what a
// table with a paginator under it wants. A timeline wants the opposite: every
// page appended to the one before it, and the next page asked for by scrolling
// rather than by clicking. This hook is that half of the family — the same
// `{ page, limit, sort, search, filters }` service contract, the same
// `{ items, total, page, limit }` envelope (00 §10), read a page at a time.
//
// Three rules the call sites depend on:
//
// - **One request at a time.** A sentinel that stays on screen, a retry, and
//   React 18's double-mounted effects in StrictMode all try to start a second
//   fetch; the in-flight guard collapses them into one.
// - **A failed page keeps what already loaded.** The error is reported beside
//   the list, and `retry()` re-asks for exactly the page that failed — nothing
//   already on screen is thrown away or fetched twice.
// - **New parameters are a new list.** Changing a filter or a sort resets
//   items, total, and the page counter in the same render the parameters
//   change, so a stale page can never be appended under a new filter.
//
// ## Scroll restoration (best-effort, §3)
//
// An accumulated list is expensive to rebuild: coming back from a detail page
// would otherwise drop the visitor at page 1, at the top. Two mechanisms cover
// the two kinds of "back", and neither is a guarantee:
//
// 1. **In-app back.** With `cacheKey`, every settled page is written to a
//    module-level cache and the scroll offset is recorded as the page scrolls.
//    Coming back with `restore` true (the page passes
//    `navigationType === 'POP'`) puts both back, provided the parameters are
//    the same list — different filters start fresh. In-memory on purpose: the
//    cache dies with the tab, so it can never serve yesterday's board, and no
//    storage quota is spent on it. Two paths lead here and both are handled:
//    a real remount reads the cache, and a route change that merely *hides*
//    this tree (see the layout effect near the bottom) keeps its own state and
//    only needs the offset re-applied.
// 2. **Browser bfcache.** Nothing here registers an `unload` or `beforeunload`
//    handler, and no interval or open socket is left running, so a page that
//    navigates away cross-document stays eligible for the browser's back/forward
//    cache — which restores the live DOM and the exact scroll position for free.
//
// What is *not* covered: a reload (`items` are gone, and refetching seven pages
// to reach an offset would be worse than starting over), and a restore that
// lands mid-image-decode — the feed column has no remote images, so heights are
// stable, but a list of photos would land approximately rather than exactly.
// The offset is also only held for {@link RESTORE_SETTLE_MS}, which is what
// keeps it from fighting a visitor who starts scrolling immediately.

/** Rows per page when the caller does not say. */
const DEFAULT_LIMIT = 10

/** How far below the fold the sentinel asks for the next page. */
const DEFAULT_ROOT_MARGIN = '600px'

/**
 * How long a restored offset is held against the browser's own attempt at one.
 * Long enough to outlast the frame the column is laid out in, short enough that
 * a visitor who scrolls immediately is not pulled back.
 */
const RESTORE_SETTLE_MS = 200

/** Where a list is in its lifecycle. Internal — call sites read the booleans. */
const STATUS = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  LOADING_MORE: 'loadingMore',
  READY: 'ready',
  ERROR: 'error',
})

/**
 * `cacheKey` → the last settled list under it, plus where the page was
 * scrolled to when it unmounted. One entry per key; a key whose parameters
 * changed is overwritten rather than accumulated.
 */
const restoreCache = new Map()

const emptyState = (key) =>
  Object.freeze({ key, items: [], total: 0, page: 0, status: STATUS.IDLE, error: null })

const restoredState = (key, entry) =>
  Object.freeze({
    key,
    items: entry.items,
    total: entry.total,
    page: entry.page,
    status: STATUS.READY,
    error: null,
    // Carried in state rather than in a ref: React renders a component twice
    // on mount under StrictMode, and only one of those passes' refs is the one
    // the effects end up holding. State is committed, so it is the same object
    // on both sides of that.
    restoredScrollY: entry.scrollY,
  })

/**
 * Appends a page, dropping anything already held.
 *
 * A record that moved between pages while the visitor scrolled (a reply landed,
 * a deal closed) would otherwise arrive twice and hand React two children with
 * the same key. De-duplicating here is cheaper than making every consumer
 * defend itself.
 */
function appendUnique(current, incoming, getItemKey) {
  if (incoming.length === 0) return current

  const seen = new Set(current.map(getItemKey))
  const fresh = incoming.filter((item) => {
    const key = getItemKey(item)
    if (key == null) return true
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return fresh.length === 0 ? current : [...current, ...fresh]
}

/**
 * Drives an accumulating list against any `*Service.list`-shaped function.
 *
 * @param {(params: object) => Promise<import('@/services/api/listAdapter').ListResult>} listFn
 *   the service function to call, e.g. `feedService.listFeeds`
 * @param {object} [options]
 * @param {object} [options.params] everything but `page` and `limit` — sort,
 *   search, filters. Compared **by value**, so an object literal is fine.
 * @param {number} [options.limit=10] rows per page
 * @param {boolean} [options.enabled=true] hold every request while `false`
 * @param {(item: object) => string} [options.getItemKey] identity for
 *   de-duplication; defaults to `item.id`
 * @param {string} [options.rootMargin='600px'] how early the sentinel fires
 * @param {string} [options.cacheKey] opt into the restore cache under this key
 * @param {boolean} [options.restore=false] seed from that cache on mount —
 *   pass `useNavigationType() === 'POP'`
 * @returns {{items: object[], total: number, page: number, isLoading: boolean,
 *   isLoadingMore: boolean, isEmpty: boolean, hasMore: boolean,
 *   isComplete: boolean, error: object|null, loadMore: () => void,
 *   retry: () => void, reset: () => void,
 *   sentinelRef: (node: Element|null) => void}}
 *
 * @example
 * const list = useInfiniteList(feedService.listFeeds, { params, limit: 10 })
 * {list.items.map((feed) => <FeedCard key={feed.id} feed={feed} />)}
 * <div ref={list.sentinelRef} />
 */
export function useInfiniteList(
  listFn,
  {
    params,
    limit = DEFAULT_LIMIT,
    enabled = true,
    getItemKey = (item) => item?.id,
    rootMargin = DEFAULT_ROOT_MARGIN,
    cacheKey,
    restore = false,
  } = {}
) {
  // A string, not the object: the page rebuilds `params` on every render, and
  // a new identity is not a new list.
  const paramsKey = useMemo(() => JSON.stringify(params ?? {}), [params])

  const [state, setState] = useState(() => {
    const entry = restore && cacheKey ? restoreCache.get(cacheKey) : null
    if (entry && entry.key === paramsKey && entry.items.length > 0) {
      return restoredState(paramsKey, entry)
    }
    return emptyState(paramsKey)
  })

  // Adjusting state during render rather than in an effect: React re-runs the
  // component with the new state before it commits anything, so the old list is
  // never painted under the new filter (React's own "adjusting state when props
  // change" pattern). It cannot loop — the new state carries the new key.
  if (state.key !== paramsKey) {
    setState(emptyState(paramsKey))
  }

  // Read inside callbacks so every returned function stays referentially
  // stable: they are handed to effects, to an IntersectionObserver, and to
  // buttons that must not re-render the list under them.
  const listFnRef = useRef(listFn)
  listFnRef.current = listFn
  const paramsRef = useRef(params)
  paramsRef.current = params
  const stateRef = useRef(state)
  stateRef.current = state
  const getItemKeyRef = useRef(getItemKey)
  getItemKeyRef.current = getItemKey

  const inFlight = useRef(false)

  const load = useCallback(
    (targetPage) => {
      if (inFlight.current) return
      inFlight.current = true

      // The list this request belongs to. Anything that comes back after the
      // filters moved on is dropped rather than appended to a different list.
      const requestKey = stateRef.current.key

      setState((previous) => ({
        ...previous,
        status: targetPage === 1 ? STATUS.LOADING : STATUS.LOADING_MORE,
        error: null,
      }))

      Promise.resolve()
        .then(() => listFnRef.current({ ...paramsRef.current, page: targetPage, limit }))
        .then((result) => {
          // No "is this still mounted?" guard: React 18 makes a setState on an
          // unmounted component a no-op, and a hidden-then-shown tree (see the
          // scroll section below) is *not* unmounted — dropping its page there
          // would leave the list stuck on a skeleton row that never resolves.
          setState((previous) => {
            if (previous.key !== requestKey) return previous

            const incoming = Array.isArray(result?.items) ? result.items : []
            const items =
              targetPage === 1
                ? incoming
                : appendUnique(previous.items, incoming, getItemKeyRef.current)
            const total = Number(result?.total)

            return {
              ...previous,
              items,
              total: Number.isFinite(total) ? total : items.length,
              page: targetPage,
              status: STATUS.READY,
              error: null,
            }
          })
        })
        .catch((failure) => {
          setState((previous) =>
            previous.key !== requestKey
              ? previous
              : { ...previous, status: STATUS.ERROR, error: failure }
          )
        })
        .finally(() => {
          inFlight.current = false
        })
    },
    [limit]
  )

  // The first page of every list, including the one a reset just created.
  useEffect(() => {
    if (!enabled || state.status !== STATUS.IDLE) return
    load(1)
  }, [enabled, state.status, state.key, load])

  const hasMore = state.items.length < state.total
  const canLoadMore = enabled && state.status === STATUS.READY && hasMore

  const loadMore = useCallback(() => {
    const current = stateRef.current
    if (current.status !== STATUS.READY || current.items.length >= current.total) return
    load(current.page + 1)
  }, [load])

  /** Re-asks for the page that failed — page 1 when the list never started. */
  const retry = useCallback(() => {
    const current = stateRef.current
    if (current.status !== STATUS.ERROR) return
    load(current.page + 1)
  }, [load])

  const reset = useCallback(() => {
    setState((previous) => emptyState(previous.key))
  }, [])

  /* -- the sentinel -------------------------------------------------------- */

  const [sentinelNode, setSentinelNode] = useState(null)
  const [isSentinelVisible, setSentinelVisible] = useState(false)

  const sentinelRef = useCallback((node) => setSentinelNode(node ?? null), [])

  useEffect(() => {
    if (!sentinelNode || typeof IntersectionObserver === 'undefined') {
      setSentinelVisible(false)
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => setSentinelVisible(entries.some((entry) => entry.isIntersecting)),
      { rootMargin }
    )
    observer.observe(sentinelNode)
    return () => observer.disconnect()
  }, [sentinelNode, rootMargin])

  // Not inside the observer callback: a sentinel that is *still* on screen when
  // its page lands does not intersect a second time, so the next page has to be
  // triggered by the list becoming loadable again rather than by an event.
  useEffect(() => {
    if (isSentinelVisible && canLoadMore) loadMore()
  }, [isSentinelVisible, canLoadMore, loadMore])

  /* -- restore cache (see the header) --------------------------------------- */

  useEffect(() => {
    if (!cacheKey || state.status !== STATUS.READY) return
    const previous = restoreCache.get(cacheKey)
    restoreCache.set(cacheKey, {
      key: state.key,
      items: state.items,
      total: state.total,
      page: state.page,
      scrollY: previous?.key === state.key ? (previous.scrollY ?? 0) : 0,
    })
  }, [cacheKey, state])

  // Where the page is, recorded as it scrolls. Reading `window.scrollY` on the
  // way out instead would report zero: by then the browser has laid the next
  // screen out and clamped the offset to a shorter document.
  const scrollY = useRef(0)

  useEffect(() => {
    if (!cacheKey || typeof window === 'undefined') return undefined

    const record = () => {
      scrollY.current = window.scrollY
    }
    record()
    window.addEventListener('scroll', record, { passive: true })
    return () => window.removeEventListener('scroll', record)
  }, [cacheKey])

  // The offset this mount owes the page. Seeded from the restored state, then
  // maintained by the effect below.
  const pendingScrollY = useRef(state.restoredScrollY ?? 0)
  const restoreRef = useRef(restore)
  restoreRef.current = restore

  // Save on the way out, restore on the way (back) in — one pair, because a
  // route change does not always unmount the page behind it. Navigating to a
  // lazily-loaded route suspends, and React answers a suspended boundary by
  // *hiding* the tree it is already showing: layout effects are torn down and
  // re-created while state and refs stay exactly where they were. So the same
  // pair has to cover a real remount (the offset arrives in `state`) and a
  // re-show (it is still in the ref from the last teardown).
  //
  // A layout cleanup, not a passive one: React runs it synchronously as it
  // takes the tree apart, before the browser can lay the next page out, clamp
  // the scroll, and fire the scroll event that would overwrite the number.
  useLayoutEffect(() => {
    if (!cacheKey || typeof window === 'undefined') return undefined

    const y = pendingScrollY.current
    const shouldRestore = y > 0 && restoreRef.current && stateRef.current.items.length > 0

    let frame
    let settle

    if (shouldRestore) {
      // The browser is restoring the same history entry at the same moment,
      // from the offset *it* saved — the one it clamped while the page was
      // coming apart, which it re-applies as the column grows back. Its
      // restoration is stood down for the moment that takes, and the offset is
      // re-asserted across it rather than set once.
      const previousMode = window.history.scrollRestoration
      const setMode = (mode) => {
        try {
          window.history.scrollRestoration = mode
        } catch {
          // Read-only in a few engines; the re-asserts still apply.
        }
      }
      const apply = () => window.scrollTo(0, y)

      setMode('manual')
      apply()
      frame = requestAnimationFrame(apply)
      settle = window.setTimeout(() => {
        apply()
        setMode(previousMode)
      }, RESTORE_SETTLE_MS)
    }

    return () => {
      if (frame) cancelAnimationFrame(frame)
      if (settle) window.clearTimeout(settle)

      pendingScrollY.current = scrollY.current
      const entry = restoreCache.get(cacheKey)
      if (entry) entry.scrollY = scrollY.current
    }
  }, [cacheKey])

  return {
    items: state.items,
    total: state.total,
    page: state.page,
    // An untouched list is already on its way to page 1, so it reports as
    // loading rather than as empty for the frame before the effect runs.
    isLoading: enabled && (state.status === STATUS.IDLE || state.status === STATUS.LOADING),
    isLoadingMore: state.status === STATUS.LOADING_MORE,
    isEmpty: state.status === STATUS.READY && state.items.length === 0,
    hasMore,
    isComplete: state.status === STATUS.READY && !hasMore && state.items.length > 0,
    error: state.status === STATUS.ERROR ? state.error : null,
    loadMore,
    retry,
    reset,
    sentinelRef,
  }
}

export default useInfiniteList
