import { lazy } from 'react'

import { paths } from './paths'

// Creator dashboard route table — mounted under `ProtectedRoute` + `RoleRoute` +
// `DashboardLayout` by ./index.jsx, so every entry here renders inside the
// dashboard shell and should render a `DashboardPage`.
//
// Prompt 21 replaced the placeholder role home with the real overview and added
// the two account screens. Prompts append `{ path, element }` entries here using
// `React.lazy` pages and the absolute constants from ./paths.js — for example:
//
//   const CreatorOrdersPage = lazy(() => import('@/features/orders/pages/CreatorOrdersPage'))
//   export const creatorRoutes = [{ path: paths.CREATOR_ORDERS, element: <CreatorOrdersPage /> }]
//
// Paths still reserved in ./paths.js: CREATOR_BROWSE, CREATOR_PROPOSALS,
// CREATOR_ORDERS, CREATOR_ORDER_DETAIL_PATTERN, CREATOR_PORTFOLIO,
// CREATOR_EARNINGS, CREATOR_DISPUTES, CREATOR_DISPUTE_DETAIL_PATTERN,
// CREATOR_NOTIFICATIONS.

const CreatorOverviewPage = lazy(
  () => import('@/features/dashboard/pages/CreatorOverviewPage')
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
  { path: paths.CREATOR_PROFILE, element: <CreatorProfilePage /> },
  { path: paths.CREATOR_SETTINGS, element: <CreatorSettingsPage /> },
  // Keeps the whole `/creator` subtree guarded — see buyerRoutes.jsx.
  { path: paths.CREATOR_CATCH_ALL, element: <NotFoundPage /> },
]
