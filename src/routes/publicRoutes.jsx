import { lazy } from 'react'

import { paths } from './paths'

// Route tables for the signed-out surface. Later prompts append entries to
// these arrays — they never restructure the router in ./index.jsx.
//
// Every page is `React.lazy`, so each route ships as its own chunk and the
// shell boots without the rest of the product. Route paths come from ./paths.js
// exclusively (00 §2.6); `*_PATTERN` constants are the parameterised ones.

const HomePage = lazy(() => import('@/features/landing/pages/HomePage'))

// Public information pages (Prompt 11).
const HowItWorksPage = lazy(() => import('@/features/staticPages/pages/HowItWorksPage'))
const ContentPolicyPage = lazy(() => import('@/features/staticPages/pages/ContentPolicyPage'))
const PricingPage = lazy(() => import('@/features/staticPages/pages/PricingPage'))
const FaqPage = lazy(() => import('@/features/staticPages/pages/FaqPage'))
const AboutPage = lazy(() => import('@/features/staticPages/pages/AboutPage'))
const ContactPage = lazy(() => import('@/features/staticPages/pages/ContactPage'))
const TermsPage = lazy(() => import('@/features/staticPages/pages/TermsPage'))
const PrivacyPage = lazy(() => import('@/features/staticPages/pages/PrivacyPage'))

// Creator discovery (Prompt 12) — the marketplace's primary buyer entry point.
const CreatorsPage = lazy(() => import('@/features/discovery/pages/CreatorsPage'))

// The public creator storefront (Prompt 13) — where every discovery card, every
// featured shelf tile, and every shared profile link lands.
const CreatorProfilePage = lazy(() => import('@/features/creatorProfile/pages/CreatorProfilePage'))

// STUB (Prompt 11): linked from the public top nav and the footer, and Prompt 11
// requires every nav and footer link to resolve — so it is mounted now with a
// placeholder page rather than left to hit the 404. Prompt 23 replaces the page
// component; this entry stays as it is.
const RequestBoardPage = lazy(() => import('@/features/requests/pages/RequestBoardPage'))

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
 * - Prompt 23 — REQUEST_DETAIL_PATTERN (REQUESTS is mounted below, as a stub)
 * - Prompt 32 — REFERRAL_PATTERN
 */
export const publicRoutes = [
  { index: true, element: <HomePage /> },

  /* Information pages (Prompt 11) — every footer and nav link resolves here. */
  { path: paths.HOW_IT_WORKS, element: <HowItWorksPage /> },
  { path: paths.PRICING, element: <PricingPage /> },
  { path: paths.FAQ, element: <FaqPage /> },
  { path: paths.ABOUT, element: <AboutPage /> },
  { path: paths.CONTACT, element: <ContactPage /> },
  { path: paths.CONTENT_POLICY, element: <ContentPolicyPage /> },
  { path: paths.TERMS, element: <TermsPage /> },
  { path: paths.PRIVACY, element: <PrivacyPage /> },

  /* Marketplace discovery — the request board is a stub until Prompt 23. */
  { path: paths.CREATORS, element: <CreatorsPage /> },
  { path: paths.CREATOR_PROFILE_PATTERN, element: <CreatorProfilePage /> },
  { path: paths.REQUESTS, element: <RequestBoardPage /> },
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
