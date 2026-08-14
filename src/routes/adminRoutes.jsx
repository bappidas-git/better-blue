// Admin console route table — mounted under `/admin` by ./index.jsx.
//
// Empty until Prompt 24 builds the admin overview on top of DashboardLayout.
// Prompts append `{ path, element }` entries here using `React.lazy` pages and
// the absolute constants from ./paths.js — for example:
//
//   const AdminUsersPage = lazy(() => import('@/features/admin/users/pages/AdminUsersPage'))
//   export const adminRoutes = [{ path: paths.ADMIN_USERS, element: <AdminUsersPage /> }]
//
// Per-screen permission gating (00 §11) is applied inside these elements with
// `PermissionGate` / `RoleRoute`, not by adding branches to the router.
//
// Paths already reserved in ./paths.js: ADMIN, ADMIN_USERS, ADMIN_USER_DETAIL_PATTERN,
// ADMIN_MODERATION, ADMIN_MODERATION_DETAIL_PATTERN, ADMIN_REQUESTS, ADMIN_ORDERS,
// ADMIN_ORDER_DETAIL_PATTERN, ADMIN_PAYMENTS, ADMIN_SETTLEMENTS, ADMIN_COMMISSIONS,
// ADMIN_DISPUTES, ADMIN_DISPUTE_DETAIL_PATTERN, ADMIN_REPORTS, ADMIN_SUPPORT,
// ADMIN_ANNOUNCEMENTS, ADMIN_AFFILIATES, ADMIN_ADMINS, ADMIN_ROLES, ADMIN_SETTINGS,
// ADMIN_CATEGORIES, ADMIN_AUDIT, ADMIN_NOTIFICATIONS.

export const adminRoutes = []
