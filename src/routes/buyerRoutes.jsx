// Buyer dashboard route table — mounted under `/buyer` by ./index.jsx.
//
// Empty until Prompt 14 builds DashboardLayout and the buyer overview. Prompts
// append `{ path, element }` entries here using `React.lazy` pages and the
// absolute constants from ./paths.js — for example:
//
//   const BuyerOrdersPage = lazy(() => import('@/features/orders/pages/BuyerOrdersPage'))
//   export const buyerRoutes = [{ path: paths.BUYER_ORDERS, element: <BuyerOrdersPage /> }]
//
// Paths already reserved in ./paths.js: BUYER, BUYER_REQUESTS, BUYER_REQUEST_NEW,
// BUYER_REQUEST_DETAIL_PATTERN, BUYER_CHECKOUT_PATTERN, BUYER_ORDERS,
// BUYER_ORDER_DETAIL_PATTERN, BUYER_PAYMENTS, BUYER_DISPUTES,
// BUYER_DISPUTE_DETAIL_PATTERN, BUYER_AFFILIATE, BUYER_NOTIFICATIONS,
// BUYER_PROFILE, BUYER_SETTINGS.

export const buyerRoutes = []
