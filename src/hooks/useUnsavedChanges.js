import { useEffect } from 'react'

import { useBlocker } from 'react-router-dom'

import { useConfirm } from '@/components/feedback/ConfirmDialogProvider'

// Guards a form with unsaved edits against both ways of walking away from it:
// an in-app navigation (the router's blocker) and leaving the page entirely
// (the browser's own `beforeunload` prompt).
//
// It deliberately does *not* try to save anything or to remember a draft — the
// only promise is that nobody loses work to a mistaken click. Keep it that way
// (Prompt 15 §6: "keep simple").
//
// `useBlocker` needs a data router; the app is mounted on `createBrowserRouter`
// (`routes/index.jsx`), so every screen that can render a form has one.

const DEFAULT_OPTIONS = {
  title: 'Leave without saving?',
  message: 'Your changes have not been saved yet. Leaving now discards them.',
  confirmLabel: 'Discard changes',
  cancelLabel: 'Keep editing',
}

/**
 * @param {boolean} isDirty `true` while the form holds unsaved changes
 * @param {object} [options] dialog copy overrides — `title`, `message`,
 *   `confirmLabel`, `cancelLabel`
 * @returns {{state: 'unblocked'|'blocked'|'proceeding'}} the router blocker, for
 *   callers that want to reflect the pending navigation in their own UI
 *
 * @example
 * const form = useForm({ initialValues })
 * const isDirty = !isEqual(form.values, initialValues)
 * useUnsavedChanges(isDirty)
 */
export function useUnsavedChanges(isDirty, options = {}) {
  const confirm = useConfirm()

  // Same-path navigations (a query-string change, a re-render of the current
  // route) are not "leaving" and must never raise the dialog.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  )

  const { title, message, confirmLabel, cancelLabel } = { ...DEFAULT_OPTIONS, ...options }

  useEffect(() => {
    if (blocker.state !== 'blocked') return undefined

    let cancelled = false
    confirm({ title, message, confirmLabel, cancelLabel, tone: 'danger' }).then((result) => {
      // The component unmounted (or a second navigation superseded this one)
      // while the dialog was open — resolving a stale blocker would navigate
      // somewhere nobody asked for.
      if (cancelled) return
      if (result) blocker.proceed()
      else blocker.reset()
    })

    return () => {
      cancelled = true
    }
  }, [blocker, cancelLabel, confirm, confirmLabel, message, title])

  useEffect(() => {
    if (!isDirty) return undefined

    // The browser shows its own wording here — `preventDefault` plus a legacy
    // `returnValue` is all any of them still honour.
    const handleBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  return blocker
}

export default useUnsavedChanges
