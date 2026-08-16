import { Outlet } from 'react-router-dom'

import { ROLES } from '@/constants/roles'
import { useAuth } from '@/context/AuthContext'
import DashboardPage from '@/layouts/dashboard/DashboardPage'

import { AdminAccessNotice } from './AdminPageGuard'

// Route-level gating for the console's **Platform** section — Prompt 35 §4.8.
//
// The screens under `/admin/settings` and `/admin/categories` are super-admin
// only, and that is stricter than the permission gating every other console
// screen uses: an admin who was granted `settings.manage` by mistake still may
// not reprice the marketplace. So the restriction is on the route, not inside
// the page — one wrapper covering the whole section rather than a check each
// screen has to remember (Prompt 36's screens nest here too).
//
// **Why this refuses rather than redirects.** `RoleRoute` sends the wrong role
// to their own role home — right for a buyer who wandered into `/admin`, wrong
// here, because an admin's role home *is* `/admin`. They would be bounced to the
// console overview with a toast about an area "not part of your account", having
// just come from the console, with no idea which door closed. This renders the
// console's standard refusal card instead: same shell, same nav, and a sentence
// saying what the page needed (00 §13 — never a dead end).
//
// SECURITY: this is UX, not access control (00 §11 / §14). `PATCH
// /platformSettings` is `super_admin`-only in the contract (§6.27) and the
// Laravel API must enforce that independently — a route that declines to render
// is not a protected endpoint.

/** The card a non-super admin sees instead of a Platform screen. */
export function SuperAdminNotice() {
  return (
    <AdminAccessNotice
      title="This area is super admin only"
      description="Platform configuration and the marketplace taxonomy change how BetterBlue works for everybody, so they are kept to super admins rather than granted per permission. Ask one of them if something here needs changing — everything you can work on is already listed in your sidebar."
    />
  )
}

/**
 * Renders the Platform section for super admins, and the refusal card for every
 * other signed-in role. Sign-in itself is already settled upstream by
 * `ProtectedRoute` + `RoleRoute(ADMIN_ROLES)`, so there is no session check here.
 */
export default function SuperAdminRoute() {
  const { user } = useAuth()

  if (user?.role === ROLES.SUPER_ADMIN) return <Outlet />

  return (
    <DashboardPage
      title="Super admin only"
      subtitle="This part of the console is limited to super admins."
    >
      <SuperAdminNotice />
    </DashboardPage>
  )
}
