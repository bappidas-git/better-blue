import { lazy } from 'react'

import { paths } from './paths'

// Admin console route table — mounted under `ProtectedRoute` + `RoleRoute`
// (admin **and** super_admin) + `DashboardLayout` by ./index.jsx, so every entry
// here renders inside the dashboard shell and should render a `DashboardPage`.
//
// Prompt 28 replaced the placeholder role home with the real overview and laid
// out the rest of the console in `navConfig` (commented until each screen
// lands). Prompts append `{ path, element }` entries here using `React.lazy`
// pages and the absolute constants from ./paths.js — for example:
//
//   const AdminUsersPage = lazy(() => import('@/features/admin/users/pages/AdminUsersPage'))
//   export const adminRoutes = [{ path: paths.ADMIN_USERS, element: <AdminUsersPage /> }]
//
// Per-screen permission gating (00 §11) is applied inside these elements with
// `AdminPageGuard` from `@/features/admin/shared` — the console's wrapper around
// `PermissionGate` that renders a "you do not have access" card instead of
// nothing — not by adding branches to the router. Put it *inside* the page's
// `DashboardPage` so a refused screen still has its heading.
//
// Prompt 27 mounted the notification centre here — the **same** shared feature
// page the buyer and creator tables mount, which reads the signed-in role for
// its category chips and its deep links. Prompt 28 added the matching `adminNav`
// entry (key `NAV_KEY.NOTIFICATIONS`); the page itself needs nothing from it.
//
// Paths already reserved in ./paths.js: ADMIN, ADMIN_USERS, ADMIN_USER_DETAIL_PATTERN,
// ADMIN_MODERATION, ADMIN_MODERATION_DETAIL_PATTERN, ADMIN_REQUESTS, ADMIN_ORDERS,
// ADMIN_ORDER_DETAIL_PATTERN, ADMIN_PAYMENTS, ADMIN_SETTLEMENTS, ADMIN_COMMISSIONS,
// ADMIN_DISPUTES, ADMIN_DISPUTE_DETAIL_PATTERN, ADMIN_REPORTS, ADMIN_SUPPORT,
// ADMIN_ANNOUNCEMENTS, ADMIN_AFFILIATES, ADMIN_ADMINS, ADMIN_ROLES, ADMIN_SETTINGS,
// ADMIN_CATEGORIES, ADMIN_AUDIT.

const AdminOverviewPage = lazy(
  () => import('@/features/admin/overview/pages/AdminOverviewPage')
)
const NotificationsPage = lazy(
  () => import('@/features/notifications/pages/NotificationsPage')
)
const NotFoundPage = lazy(() => import('@/features/staticPages/pages/NotFoundPage'))

export const adminRoutes = [
  { path: paths.ADMIN, element: <AdminOverviewPage /> },
  { path: paths.ADMIN_NOTIFICATIONS, element: <NotificationsPage /> },
  // Keeps the whole `/admin` subtree guarded — see buyerRoutes.jsx.
  { path: paths.ADMIN_CATCH_ALL, element: <NotFoundPage /> },
]
