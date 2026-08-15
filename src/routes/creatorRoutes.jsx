import { lazy } from 'react'

import { paths } from './paths'

// Creator dashboard route table — mounted under `ProtectedRoute` + `RoleRoute`
// by ./index.jsx.
//
// Prompt 15 builds the real creator overview; until then the only entry is the
// role home the guards redirect to. Prompts append `{ path, element }` entries
// here using `React.lazy` pages and the absolute constants from ./paths.js —
// for example:
//
//   const CreatorOrdersPage = lazy(() => import('@/features/orders/pages/CreatorOrdersPage'))
//   export const creatorRoutes = [{ path: paths.CREATOR_ORDERS, element: <CreatorOrdersPage /> }]
//
// Paths already reserved in ./paths.js: CREATOR, CREATOR_BROWSE, CREATOR_PROPOSALS,
// CREATOR_ORDERS, CREATOR_ORDER_DETAIL_PATTERN, CREATOR_PORTFOLIO, CREATOR_EARNINGS,
// CREATOR_DISPUTES, CREATOR_DISPUTE_DETAIL_PATTERN, CREATOR_NOTIFICATIONS,
// CREATOR_PROFILE, CREATOR_SETTINGS.

// TEMP: replaced in Prompt 15.
const CreatorHomePlaceholder = lazy(
  () => import('@/features/dashboard/pages/CreatorHomePlaceholder')
)
const NotFoundPage = lazy(() => import('@/features/staticPages/pages/NotFoundPage'))

export const creatorRoutes = [
  { path: paths.CREATOR, element: <CreatorHomePlaceholder /> },
  // Keeps the whole `/creator` subtree guarded — see buyerRoutes.jsx.
  { path: paths.CREATOR_CATCH_ALL, element: <NotFoundPage /> },
]
