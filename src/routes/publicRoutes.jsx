import { lazy } from 'react'

import { paths } from './paths'

// Route tables for the signed-out surface. Later prompts append entries to
// these arrays — they never restructure the router in ./index.jsx.
//
// Every page is `React.lazy`, so each route ships as its own chunk and the
// shell boots without the rest of the product. Route paths come from ./paths.js
// exclusively (00 §2.6); `*_PATTERN` constants are the parameterised ones.

const HomePage = lazy(() => import('@/features/landing/pages/HomePage'))
const AuthPlaceholderPage = lazy(() => import('@/features/auth/pages/AuthPlaceholderPage'))

// `import.meta.env.DEV` is statically replaced at build time, so this whole
// branch — the dynamic import included — is eliminated from production bundles
// and the gallery chunk is never emitted at all (00 §4). The guard has to wrap
// the `import()`; gating only where the route is *used* still ships the chunk.
const DevDesignPage = import.meta.env.DEV
  ? lazy(() => import('@/features/dashboard/pages/DevDesignPage'))
  : null

/**
 * Rendered inside PublicLayout (top nav + footer). The home route is the index
 * route of `paths.HOME`; everything else registers an absolute path.
 *
 * Waiting to be appended here:
 * - Prompt 11 — CREATORS, CREATOR_PROFILE_PATTERN, REQUESTS, REQUEST_DETAIL_PATTERN
 * - Prompt 12 — HOW_IT_WORKS, PRICING, FAQ, ABOUT, CONTACT, CONTENT_POLICY,
 *   TERMS, PRIVACY
 * - Prompt 32 — REFERRAL_PATTERN
 */
export const publicRoutes = [{ index: true, element: <HomePage /> }]

/**
 * Rendered inside AuthLayout. Prompt 09 replaces both placeholders with the
 * real LoginPage / RegisterPage and wraps this branch in `GuestRoute`.
 */
export const authRoutes = [
  { path: paths.LOGIN, element: <AuthPlaceholderPage mode="login" /> },
  { path: paths.REGISTER, element: <AuthPlaceholderPage mode="register" /> },
]

/**
 * Dev-only routes, mounted inside PublicLayout by ./index.jsx — which also
 * checks `env.enableDevPages` so a developer can switch them off locally.
 * Empty in any production build.
 */
export const devRoutes = DevDesignPage
  ? [{ path: paths.DEV_DESIGN, element: <DevDesignPage /> }]
  : []
