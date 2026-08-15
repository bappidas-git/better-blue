import { lazy } from 'react'

import { paths } from './paths'

// Creator dashboard route table — mounted under `ProtectedRoute` + `RoleRoute` +
// `DashboardLayout` by ./index.jsx, so every entry here renders inside the
// dashboard shell and should render a `DashboardPage`.
//
// Prompt 21 replaced the placeholder role home with the real overview and added
// the two account screens; Prompt 22 added the portfolio manager. Prompts append
// `{ path, element }` entries here using `React.lazy` pages and the absolute
// constants from ./paths.js — for example:
//
//   const CreatorOrdersPage = lazy(() => import('@/features/orders/pages/CreatorOrdersPage'))
//   export const creatorRoutes = [{ path: paths.CREATOR_ORDERS, element: <CreatorOrdersPage /> }]
//
// Prompt 23 added the request board and the proposal manager, plus a **stub**
// for the order detail route (see below).
//
// Paths still reserved in ./paths.js: CREATOR_ORDERS, CREATOR_EARNINGS,
// CREATOR_DISPUTES, CREATOR_DISPUTE_DETAIL_PATTERN, CREATOR_NOTIFICATIONS.

const CreatorOverviewPage = lazy(
  () => import('@/features/dashboard/pages/CreatorOverviewPage')
)
const CreatorBrowsePage = lazy(() => import('@/features/requests/pages/CreatorBrowsePage'))
const CreatorProposalsPage = lazy(
  () => import('@/features/proposals/pages/CreatorProposalsPage')
)
// TEMP STUB (Prompt 23 → Prompt 24): an accepted proposal links to the order it
// created, so the route is mounted now with a placeholder rather than sending a
// creator to the dashboard 404. Prompt 24 swaps the page component in; this
// entry stays as it is.
const CreatorOrderDetailPage = lazy(
  () => import('@/features/orders/pages/CreatorOrderDetailPage')
)
const CreatorPortfolioPage = lazy(
  () => import('@/features/portfolio/pages/CreatorPortfolioPage')
)
const CreatorProfilePage = lazy(
  () => import('@/features/creatorAccount/pages/CreatorProfilePage')
)
const CreatorSettingsPage = lazy(
  () => import('@/features/creatorAccount/pages/CreatorSettingsPage')
)
const NotFoundPage = lazy(() => import('@/features/staticPages/pages/NotFoundPage'))

export const creatorRoutes = [
  { path: paths.CREATOR, element: <CreatorOverviewPage /> },
  { path: paths.CREATOR_BROWSE, element: <CreatorBrowsePage /> },
  { path: paths.CREATOR_PROPOSALS, element: <CreatorProposalsPage /> },
  { path: paths.CREATOR_ORDER_DETAIL_PATTERN, element: <CreatorOrderDetailPage /> },
  { path: paths.CREATOR_PORTFOLIO, element: <CreatorPortfolioPage /> },
  { path: paths.CREATOR_PROFILE, element: <CreatorProfilePage /> },
  { path: paths.CREATOR_SETTINGS, element: <CreatorSettingsPage /> },
  // Keeps the whole `/creator` subtree guarded — see buyerRoutes.jsx.
  { path: paths.CREATOR_CATCH_ALL, element: <NotFoundPage /> },
]
