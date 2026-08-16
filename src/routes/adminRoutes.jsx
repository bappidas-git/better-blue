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
// Prompt 29 — both gated on `users.manage` inside their `DashboardPage`.
const AdminUsersPage = lazy(() => import('@/features/admin/users/pages/AdminUsersPage'))
const AdminUserDetailPage = lazy(
  () => import('@/features/admin/users/pages/AdminUserDetailPage')
)
// Prompt 30 — the Trust & Safety workspace. One page serves both entries: the
// queue screen carries the reports tab, and `/admin/reports` is the same screen
// opened on it (see `REPORTS_PARAMS`). Gated inside on `moderation.review`,
// with the reports tab gated separately on `reports.manage`.
const AdminModerationPage = lazy(
  () => import('@/features/admin/moderation/pages/AdminModerationPage')
)
const AdminModerationDetailPage = lazy(
  () => import('@/features/admin/moderation/pages/AdminModerationDetailPage')
)
// Prompt 31 — marketplace operations. Each page gates itself inside its
// `DashboardPage`: requests on `requests.manage`, orders on `orders.manage`,
// support on `support.manage`, announcements on `announcements.send`.
const AdminRequestsPage = lazy(
  () => import('@/features/admin/operations/pages/AdminRequestsPage')
)
const AdminOrdersPage = lazy(() => import('@/features/admin/operations/pages/AdminOrdersPage'))
const AdminOrderDetailPage = lazy(
  () => import('@/features/admin/operations/pages/AdminOrderDetailPage')
)
const AdminSupportPage = lazy(() => import('@/features/admin/operations/pages/AdminSupportPage'))
const AdminAnnouncementsPage = lazy(
  () => import('@/features/admin/operations/pages/AdminAnnouncementsPage')
)
// Prompt 32 — the finance suite. Payments and commissions gate themselves on
// `payments.manage`, settlements on `settlements.process`: reading the money and
// moving somebody's wages are different jobs, and an admin can hold either
// without the other.
const AdminPaymentsPage = lazy(() => import('@/features/admin/finance/pages/AdminPaymentsPage'))
const AdminSettlementsPage = lazy(
  () => import('@/features/admin/finance/pages/AdminSettlementsPage')
)
const AdminCommissionsPage = lazy(
  () => import('@/features/admin/finance/pages/AdminCommissionsPage')
)
// Prompt 33 — the dispute console. Both gate themselves on `disputes.resolve`
// inside their `DashboardPage`: resolving a case moves held money, and it is
// the one admin permission an operations or finance admin can be without.
const AdminDisputesPage = lazy(() => import('@/features/admin/disputes/pages/AdminDisputesPage'))
const AdminDisputeDetailPage = lazy(
  () => import('@/features/admin/disputes/pages/AdminDisputeDetailPage')
)
// Prompt 34 — the referral program console. Gated on `affiliates.manage`, and
// wrapped in `FeatureGate` inside: with the program switched off there is
// nothing to work, and the screen says so rather than showing empty queues.
const AdminAffiliatesPage = lazy(
  () => import('@/features/admin/affiliates/pages/AdminAffiliatesPage')
)
const NotificationsPage = lazy(
  () => import('@/features/notifications/pages/NotificationsPage')
)
const NotFoundPage = lazy(() => import('@/features/staticPages/pages/NotFoundPage'))

export const adminRoutes = [
  { path: paths.ADMIN, element: <AdminOverviewPage /> },
  { path: paths.ADMIN_USERS, element: <AdminUsersPage /> },
  { path: paths.ADMIN_USER_DETAIL_PATTERN, element: <AdminUserDetailPage /> },
  { path: paths.ADMIN_MODERATION, element: <AdminModerationPage /> },
  { path: paths.ADMIN_MODERATION_DETAIL_PATTERN, element: <AdminModerationDetailPage /> },
  { path: paths.ADMIN_REPORTS, element: <AdminModerationPage reportsFirst /> },
  { path: paths.ADMIN_REQUESTS, element: <AdminRequestsPage /> },
  { path: paths.ADMIN_ORDERS, element: <AdminOrdersPage /> },
  { path: paths.ADMIN_ORDER_DETAIL_PATTERN, element: <AdminOrderDetailPage /> },
  { path: paths.ADMIN_DISPUTES, element: <AdminDisputesPage /> },
  { path: paths.ADMIN_DISPUTE_DETAIL_PATTERN, element: <AdminDisputeDetailPage /> },
  { path: paths.ADMIN_SUPPORT, element: <AdminSupportPage /> },
  { path: paths.ADMIN_ANNOUNCEMENTS, element: <AdminAnnouncementsPage /> },
  { path: paths.ADMIN_PAYMENTS, element: <AdminPaymentsPage /> },
  { path: paths.ADMIN_SETTLEMENTS, element: <AdminSettlementsPage /> },
  { path: paths.ADMIN_COMMISSIONS, element: <AdminCommissionsPage /> },
  { path: paths.ADMIN_AFFILIATES, element: <AdminAffiliatesPage /> },
  { path: paths.ADMIN_NOTIFICATIONS, element: <NotificationsPage /> },
  // Keeps the whole `/admin` subtree guarded — see buyerRoutes.jsx.
  { path: paths.ADMIN_CATCH_ALL, element: <NotFoundPage /> },
]
