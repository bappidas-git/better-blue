import { lazy } from 'react'

import { paths } from './paths'

// Buyer dashboard route table — mounted under `ProtectedRoute` + `RoleRoute` +
// `DashboardLayout` by ./index.jsx, so every entry here renders inside the
// dashboard shell and should render a `DashboardPage`.
//
// Prompt 15 built the overview, profile, and settings screens; Prompt 16 added
// the request wizard; Prompt 18 added the request list, the request detail
// screen, and the checkout stub. Prompt 19 replaced that stub with the real
// checkout, added Payments, and put a temporary page behind the order-detail
// pattern that checkout now sends people to. Prompt 20 replaced *that* stub
// with the order workspace and added the orders list beside it. Prompt 26
// mounted the disputes screens — note that they are the **shared** feature
// pages, mounted unchanged at `/creator/disputes` too, and read the signed-in
// role for themselves. Prompts append `{ path, element }` entries here using
// `React.lazy` pages and the absolute constants from ./paths.js — for example:
//
//   const BuyerAffiliatePage = lazy(() => import('@/features/affiliate/pages/BuyerAffiliatePage'))
//   export const buyerRoutes = [{ path: paths.BUYER_AFFILIATE, element: <BuyerAffiliatePage /> }]
//
// Prompt 27 mounted the notification centre — another shared feature page,
// mounted identically on all three dashboards and role-aware inside.
//
// Prompt 34 mounted the last reserved path, BUYER_AFFILIATE. The page gates
// itself on `features.affiliateProgram` with `FeatureGate` rather than being
// conditionally routed: a member who bookmarked it while the program was on
// should read why it is gone, not land on the dashboard 404.

const BuyerOverviewPage = lazy(() => import('@/features/dashboard/pages/BuyerOverviewPage'))
const BuyerProfilePage = lazy(() => import('@/features/buyerAccount/pages/BuyerProfilePage'))
const BuyerSettingsPage = lazy(() => import('@/features/buyerAccount/pages/BuyerSettingsPage'))
const BuyerRequestsPage = lazy(() => import('@/features/requests/pages/BuyerRequestsPage'))
const BuyerRequestDetailPage = lazy(
  () => import('@/features/requests/pages/BuyerRequestDetailPage')
)
const RequestWizardPage = lazy(() => import('@/features/requests/pages/RequestWizardPage'))
const CheckoutPage = lazy(() => import('@/features/checkout/pages/CheckoutPage'))
const BuyerPaymentsPage = lazy(() => import('@/features/payments/pages/BuyerPaymentsPage'))
const BuyerOrdersPage = lazy(() => import('@/features/orders/pages/BuyerOrdersPage'))
const BuyerOrderDetailPage = lazy(() => import('@/features/orders/pages/BuyerOrderDetailPage'))
const DisputesListPage = lazy(() => import('@/features/disputes/pages/DisputesListPage'))
const DisputeDetailPage = lazy(() => import('@/features/disputes/pages/DisputeDetailPage'))
const NotificationsPage = lazy(
  () => import('@/features/notifications/pages/NotificationsPage')
)
// Prompt 34 — the referral program. Feature-flagged inside the page.
const BuyerAffiliatePage = lazy(() => import('@/features/affiliate/pages/BuyerAffiliatePage'))
const NotFoundPage = lazy(() => import('@/features/staticPages/pages/NotFoundPage'))

export const buyerRoutes = [
  { path: paths.BUYER, element: <BuyerOverviewPage /> },
  { path: paths.BUYER_REQUESTS, element: <BuyerRequestsPage /> },
  // Ahead of the `:requestId` pattern for readability only — React Router ranks
  // the static segment above the dynamic one regardless of array order.
  { path: paths.BUYER_REQUEST_NEW, element: <RequestWizardPage /> },
  { path: paths.BUYER_REQUEST_DETAIL_PATTERN, element: <BuyerRequestDetailPage /> },
  { path: paths.BUYER_CHECKOUT_PATTERN, element: <CheckoutPage /> },
  { path: paths.BUYER_ORDERS, element: <BuyerOrdersPage /> },
  { path: paths.BUYER_ORDER_DETAIL_PATTERN, element: <BuyerOrderDetailPage /> },
  { path: paths.BUYER_PAYMENTS, element: <BuyerPaymentsPage /> },
  { path: paths.BUYER_DISPUTES, element: <DisputesListPage /> },
  { path: paths.BUYER_DISPUTE_DETAIL_PATTERN, element: <DisputeDetailPage /> },
  { path: paths.BUYER_AFFILIATE, element: <BuyerAffiliatePage /> },
  { path: paths.BUYER_NOTIFICATIONS, element: <NotificationsPage /> },
  { path: paths.BUYER_PROFILE, element: <BuyerProfilePage /> },
  { path: paths.BUYER_SETTINGS, element: <BuyerSettingsPage /> },
  // Keeps every `/buyer/...` URL inside the guarded branch, built or not, so a
  // deep link survives the trip through sign-in. Must stay last by convention;
  // React Router ranks it below the real routes regardless of array position.
  { path: paths.BUYER_CATCH_ALL, element: <NotFoundPage /> },
]
