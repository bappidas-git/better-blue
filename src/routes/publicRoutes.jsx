import { lazy } from 'react'

import { paths } from './paths'

// Route tables for the signed-out surface. Later prompts append entries to
// these arrays — they never restructure the router in ./index.jsx.
//
// Every page is `React.lazy`, so each route ships as its own chunk and the
// shell boots without the rest of the product. Route paths come from ./paths.js
// exclusively (00 §2.6); `*_PATTERN` constants are the parameterised ones.

const HomePage = lazy(() => import('@/features/landing/pages/HomePage'))
// STUB (Prompt 10): registered early because the landing page links to it and a
// marketing page must not hand a visitor a 404. Prompt 12 replaces the page
// component; this entry stays as it is.
const HowItWorksPage = lazy(() => import('@/features/staticPages/pages/HowItWorksPage'))
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'))
const RegisterPage = lazy(() => import('@/features/auth/pages/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('@/features/auth/pages/ForgotPasswordPage'))

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
 * - Prompt 12 — PRICING, FAQ, ABOUT, CONTACT, CONTENT_POLICY, TERMS, PRIVACY
 *   (HOW_IT_WORKS is already mounted below, as a stub)
 * - Prompt 32 — REFERRAL_PATTERN
 */
export const publicRoutes = [
  { index: true, element: <HomePage /> },
  { path: paths.HOW_IT_WORKS, element: <HowItWorksPage /> },
]

/**
 * Rendered inside AuthLayout, behind `GuestRoute` — a signed-in member who
 * lands here is redirected onward rather than shown a form they cannot use
 * (Prompt 09).
 */
export const authRoutes = [
  { path: paths.LOGIN, element: <LoginPage /> },
  { path: paths.REGISTER, element: <RegisterPage /> },
  { path: paths.FORGOT_PASSWORD, element: <ForgotPasswordPage /> },
]

/**
 * Dev-only routes, mounted inside PublicLayout by ./index.jsx — which also
 * checks `env.enableDevPages` so a developer can switch them off locally.
 * Empty in any production build.
 */
export const devRoutes = DevDesignPage
  ? [{ path: paths.DEV_DESIGN, element: <DevDesignPage /> }]
  : []
