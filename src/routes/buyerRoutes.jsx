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
// pattern that checkout now sends people to. Prompts append `{ path, element }`
// entries here using `React.lazy` pages and the absolute constants from
// ./paths.js — for example:
//
//   const BuyerOrdersPage = lazy(() => import('@/features/orders/pages/BuyerOrdersPage'))
//   export const buyerRoutes = [{ path: paths.BUYER_ORDERS, element: <BuyerOrdersPage /> }]
//
// Paths still reserved in ./paths.js: BUYER_ORDERS, BUYER_DISPUTES,
// BUYER_DISPUTE_DETAIL_PATTERN, BUYER_AFFILIATE, BUYER_NOTIFICATIONS.

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
// TEMP (Prompt 19): paying an order lands on `/buyer/orders/:orderId`, and both
// the receipt and the "already paid" guard link there — so the route has to
// render something honest before Prompt 20 builds the real workspace. Prompt 20
// replaces the page behind this entry; the entry stays.
const OrderDetailStubPage = lazy(() => import('@/features/orders/pages/OrderDetailStubPage'))
const NotFoundPage = lazy(() => import('@/features/staticPages/pages/NotFoundPage'))

export const buyerRoutes = [
  { path: paths.BUYER, element: <BuyerOverviewPage /> },
  { path: paths.BUYER_REQUESTS, element: <BuyerRequestsPage /> },
  // Ahead of the `:requestId` pattern for readability only — React Router ranks
  // the static segment above the dynamic one regardless of array order.
  { path: paths.BUYER_REQUEST_NEW, element: <RequestWizardPage /> },
  { path: paths.BUYER_REQUEST_DETAIL_PATTERN, element: <BuyerRequestDetailPage /> },
  { path: paths.BUYER_CHECKOUT_PATTERN, element: <CheckoutPage /> },
  { path: paths.BUYER_ORDER_DETAIL_PATTERN, element: <OrderDetailStubPage /> },
  { path: paths.BUYER_PAYMENTS, element: <BuyerPaymentsPage /> },
  { path: paths.BUYER_PROFILE, element: <BuyerProfilePage /> },
  { path: paths.BUYER_SETTINGS, element: <BuyerSettingsPage /> },
  // Keeps every `/buyer/...` URL inside the guarded branch, built or not, so a
  // deep link survives the trip through sign-in. Must stay last by convention;
  // React Router ranks it below the real routes regardless of array position.
  { path: paths.BUYER_CATCH_ALL, element: <NotFoundPage /> },
]
