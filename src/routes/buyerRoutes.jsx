import { lazy } from 'react'

import { paths } from './paths'

// Buyer dashboard route table — mounted under `ProtectedRoute` + `RoleRoute`
// by ./index.jsx.
//
// Prompt 14 builds DashboardLayout and the real buyer overview; until then the
// only entry is the role home the guards redirect to. Prompts append
// `{ path, element }` entries here using `React.lazy` pages and the absolute
// constants from ./paths.js — for example:
//
//   const BuyerOrdersPage = lazy(() => import('@/features/orders/pages/BuyerOrdersPage'))
//   export const buyerRoutes = [{ path: paths.BUYER_ORDERS, element: <BuyerOrdersPage /> }]
//
// Paths already reserved in ./paths.js: BUYER, BUYER_REQUESTS, BUYER_REQUEST_NEW,
// BUYER_REQUEST_DETAIL_PATTERN, BUYER_CHECKOUT_PATTERN, BUYER_ORDERS,
// BUYER_ORDER_DETAIL_PATTERN, BUYER_PAYMENTS, BUYER_DISPUTES,
// BUYER_DISPUTE_DETAIL_PATTERN, BUYER_AFFILIATE, BUYER_NOTIFICATIONS,
// BUYER_PROFILE, BUYER_SETTINGS.

// TEMP: replaced in Prompt 14.
const BuyerHomePlaceholder = lazy(() => import('@/features/dashboard/pages/BuyerHomePlaceholder'))
const NotFoundPage = lazy(() => import('@/features/staticPages/pages/NotFoundPage'))

export const buyerRoutes = [
  { path: paths.BUYER, element: <BuyerHomePlaceholder /> },
  // Keeps every `/buyer/...` URL inside the guarded branch, built or not, so a
  // deep link survives the trip through sign-in. Must stay last by convention;
  // React Router ranks it below the real routes regardless of array position.
  { path: paths.BUYER_CATCH_ALL, element: <NotFoundPage /> },
]
