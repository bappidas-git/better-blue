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

// The public request board (Prompt 23) — the supply-side twin of creator
// discovery. Mounted as a stub by Prompt 11 so the top nav and the footer had
// somewhere to land; the route entries are unchanged, the pages are now real.
// Both are gated on `features.publicRequestBoard` inside the pages themselves.
const RequestBoardPage = lazy(() => import('@/features/requests/pages/RequestBoardPage'))
const RequestBoardDetailPage = lazy(
  () => import('@/features/requests/pages/RequestBoardDetailPage')
)

// Referral capture (Prompt 34) — `/r/:code` stores the code and redirects. It
// renders nothing a visitor reads, so it is public and lives here rather than
// behind any guard: the whole point is that it works for somebody who has never
// signed in.
const ReferralRedirectPage = lazy(
  () => import('@/features/affiliate/pages/ReferralRedirectPage')
)

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
 * Every reserved path now has a page behind it — Prompt 34 mounted the last one,
 * `REFERRAL_PATTERN`.
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

  /* Marketplace discovery — creators (Prompt 12/13) and briefs (Prompt 23). */
  { path: paths.CREATORS, element: <CreatorsPage /> },
  { path: paths.CREATOR_PROFILE_PATTERN, element: <CreatorProfilePage /> },
  { path: paths.REQUESTS, element: <RequestBoardPage /> },
  { path: paths.REQUEST_DETAIL_PATTERN, element: <RequestBoardDetailPage /> },

  /* Referral capture (Prompt 34) — stores the code, then redirects. */
  { path: paths.REFERRAL_PATTERN, element: <ReferralRedirectPage /> },
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
