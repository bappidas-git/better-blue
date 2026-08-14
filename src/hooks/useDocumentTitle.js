import { useEffect } from 'react'

import { env } from '@/config/env'

// Per-page document title — 00 §13 asks for one on every page.
//
// The suffix is the configured app name (VITE_APP_NAME) so a white-labelled
// build renames every tab without touching a page. The separator is a middot
// with hair spacing, which reads better than a hyphen in browser tabs and
// history entries.
//
// Nothing is restored on unmount: routes transition one page out and the next
// one in, and every page sets its own title, so a restore would only add a
// frame of the wrong title.

/**
 * @param {string} [title] page title, without the app name
 *
 * @example
 * useDocumentTitle('Find Creators') // -> "Find Creators · BetterBlue"
 */
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${env.appName}` : env.appName
  }, [title])
}

export default useDocumentTitle
