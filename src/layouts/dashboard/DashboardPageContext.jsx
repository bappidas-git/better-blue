import { createContext, useContext, useEffect, useMemo, useState } from 'react'

// The one channel between a dashboard page and the chrome around it.
//
// `DashboardPage` publishes its title here; `TopBar` reads it. That keeps the
// layout free of route→title tables (a `pathname` switch in the top bar would
// have to be edited by every prompt that adds a screen) and keeps pages free of
// any knowledge of the chrome.
//
// Only the *title* travels. Page actions render inside the page, next to its
// heading, because a React node published into context would change identity on
// every render and drive the publishing effect in a loop.

const DashboardPageContext = createContext(null)

/**
 * @param {object} props
 * @param {React.ReactNode} props.children the dashboard shell and its outlet
 */
export function DashboardPageProvider({ children }) {
  const [title, setTitle] = useState('')

  const value = useMemo(() => ({ title, setTitle }), [title])

  return <DashboardPageContext.Provider value={value}>{children}</DashboardPageContext.Provider>
}

// The provider and its two hooks are one unit; splitting them across files to
// satisfy fast refresh would scatter a six-line API for no runtime benefit.
/* eslint-disable react-refresh/only-export-components */

/** The current page title, for the top bar. `''` before a page publishes one. */
export function useDashboardPageTitle() {
  return useContext(DashboardPageContext)?.title ?? ''
}

/**
 * Publishes `title` into the top bar for as long as the page is mounted.
 *
 * Safe outside the dashboard shell (the dev gallery renders `DashboardPage`
 * fixtures with no provider above them): with no context, it does nothing.
 *
 * @param {string} [title]
 */
export function usePublishDashboardPageTitle(title) {
  const setTitle = useContext(DashboardPageContext)?.setTitle

  useEffect(() => {
    if (!setTitle) return undefined
    setTitle(title ?? '')
    // Clears on the way out so the next page never inherits this one's title
    // during its first frame.
    return () => setTitle('')
  }, [setTitle, title])
}

/* eslint-enable react-refresh/only-export-components */

export default DashboardPageContext
