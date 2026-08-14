import { Link as RouterLink, useInRouterContext } from 'react-router-dom'

// Shared link plumbing for components that take an optional `to` (StatCard,
// EmptyState actions, PageHeader back button, …).
//
// The router only exists from Prompt 08 onward, and the dev gallery renders
// outside it, so `useInRouterContext()` decides between a client-side
// `<Link to>` and a plain `<a href>`. Same prop, no crash either way.
// Route strings must still come from `src/routes/paths.js` (00 §2.6).

/**
 * @param {string} [to] route path (or absolute URL) the element should link to
 * @returns {object} props to spread onto a MUI component (`{}` when `to` is unset)
 */
export function useLinkProps(to) {
  const inRouterContext = useInRouterContext()

  if (!to) return {}
  const isExternal = /^([a-z][a-z\d+\-.]*:|\/\/)/i.test(to)

  if (inRouterContext && !isExternal) {
    return { component: RouterLink, to }
  }

  return {
    component: 'a',
    href: to,
    ...(isExternal ? { rel: 'noopener noreferrer' } : null),
  }
}

export default useLinkProps
