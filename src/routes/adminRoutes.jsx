import { lazy } from 'react'

import { paths } from './paths'

// Admin console route table — mounted under `ProtectedRoute` + `RoleRoute`
// (admin **and** super_admin) by ./index.jsx.
//
// Prompt 24 builds the real admin overview; until then the only entry is the
// role home the guards redirect to. Prompts append `{ path, element }` entries
// here using `React.lazy` pages and the absolute constants from ./paths.js —
// for example:
//
//   const AdminUsersPage = lazy(() => import('@/features/admin/users/pages/AdminUsersPage'))
//   export const adminRoutes = [{ path: paths.ADMIN_USERS, element: <AdminUsersPage /> }]
//
// Per-screen permission gating (00 §11) is applied inside these elements with
// `PermissionGate` from ./guards.jsx, not by adding branches to the router.
//
// Paths already reserved in ./paths.js: ADMIN, ADMIN_USERS, ADMIN_USER_DETAIL_PATTERN,
// ADMIN_MODERATION, ADMIN_MODERATION_DETAIL_PATTERN, ADMIN_REQUESTS, ADMIN_ORDERS,
// ADMIN_ORDER_DETAIL_PATTERN, ADMIN_PAYMENTS, ADMIN_SETTLEMENTS, ADMIN_COMMISSIONS,
// ADMIN_DISPUTES, ADMIN_DISPUTE_DETAIL_PATTERN, ADMIN_REPORTS, ADMIN_SUPPORT,
// ADMIN_ANNOUNCEMENTS, ADMIN_AFFILIATES, ADMIN_ADMINS, ADMIN_ROLES, ADMIN_SETTINGS,
// ADMIN_CATEGORIES, ADMIN_AUDIT, ADMIN_NOTIFICATIONS.

// TEMP: replaced in Prompt 24.
const AdminHomePlaceholder = lazy(() => import('@/features/dashboard/pages/AdminHomePlaceholder'))
const NotFoundPage = lazy(() => import('@/features/staticPages/pages/NotFoundPage'))

export const adminRoutes = [
  { path: paths.ADMIN, element: <AdminHomePlaceholder /> },
  // Keeps the whole `/admin` subtree guarded — see buyerRoutes.jsx.
  { path: paths.ADMIN_CATCH_ALL, element: <NotFoundPage /> },
]
