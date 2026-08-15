import { lazy } from 'react'

import { paths } from './paths'

// Buyer dashboard route table — mounted under `ProtectedRoute` + `RoleRoute` +
// `DashboardLayout` by ./index.jsx, so every entry here renders inside the
// dashboard shell and should render a `DashboardPage`.
//
// Prompt 15 built the overview, profile, and settings screens; Prompt 16 added
// the request wizard. Prompts append `{ path, element }` entries here using
// `React.lazy` pages and the absolute constants from ./paths.js — for example:
//
//   const BuyerOrdersPage = lazy(() => import('@/features/orders/pages/BuyerOrdersPage'))
//   export const buyerRoutes = [{ path: paths.BUYER_ORDERS, element: <BuyerOrdersPage /> }]
//
// This table is also **read** by `RequestWizardPage`, which sends a published
// brief to `BUYER_REQUESTS` if that path renders a page and to the overview if
// it does not — so Prompt 18 gets the right destination by registering its
// route, without editing the wizard.
//
// Paths still reserved in ./paths.js: BUYER_REQUESTS,
// BUYER_REQUEST_DETAIL_PATTERN, BUYER_CHECKOUT_PATTERN, BUYER_ORDERS,
// BUYER_ORDER_DETAIL_PATTERN, BUYER_PAYMENTS, BUYER_DISPUTES,
// BUYER_DISPUTE_DETAIL_PATTERN, BUYER_AFFILIATE, BUYER_NOTIFICATIONS.

const BuyerOverviewPage = lazy(() => import('@/features/dashboard/pages/BuyerOverviewPage'))
const BuyerProfilePage = lazy(() => import('@/features/buyerAccount/pages/BuyerProfilePage'))
const BuyerSettingsPage = lazy(() => import('@/features/buyerAccount/pages/BuyerSettingsPage'))
const RequestWizardPage = lazy(() => import('@/features/requests/pages/RequestWizardPage'))
const NotFoundPage = lazy(() => import('@/features/staticPages/pages/NotFoundPage'))

export const buyerRoutes = [
  { path: paths.BUYER, element: <BuyerOverviewPage /> },
  { path: paths.BUYER_REQUEST_NEW, element: <RequestWizardPage /> },
  { path: paths.BUYER_PROFILE, element: <BuyerProfilePage /> },
  { path: paths.BUYER_SETTINGS, element: <BuyerSettingsPage /> },
  // Keeps every `/buyer/...` URL inside the guarded branch, built or not, so a
  // deep link survives the trip through sign-in. Must stay last by convention;
  // React Router ranks it below the real routes regardless of array position.
  { path: paths.BUYER_CATCH_ALL, element: <NotFoundPage /> },
]
