import { lazy } from 'react'

import { createBrowserRouter } from 'react-router-dom'

import { RouteErrorElement } from '@/app/ErrorBoundary'
import { env } from '@/config/env'
import { ADMIN_ROLES, ROLES } from '@/constants/roles'
import AuthLayout from '@/layouts/AuthLayout'
import PublicLayout from '@/layouts/PublicLayout'
import DashboardLayout from '@/layouts/dashboard/DashboardLayout'

import { adminRoutes } from './adminRoutes'
import { buyerRoutes } from './buyerRoutes'
import { creatorRoutes } from './creatorRoutes'
import { GuestRoute, ProtectedRoute, RoleRoute } from './guards'
import { paths } from './paths'
import { authRoutes, devRoutes, publicRoutes } from './publicRoutes'

// The router. One branch per shell, each branch fed by a route table that later
// prompts append to — so adding a screen never means editing this file.
//
// Branch layout:
//   /            PublicLayout                            public pages + the 404 catch-all
//   (pathless)   GuestRoute → AuthLayout                 /login, /register, /forgot-password
//   (pathless)   ProtectedRoute → RoleRoute →
//                DashboardLayout                         /buyer, /creator, /admin
//
// The dashboard and auth branches are deliberately *pathless* layout routes
// whose children carry absolute paths. Giving the branch a `path` would make
// `/buyer` match the branch itself and render an empty <Outlet /> — a blank
// page — while it has no children; pathless means unmatched dashboard URLs fall
// through to the 404 under PublicLayout instead. Children still use the
// `/buyer/...` constants from ./paths.js, so nothing about the URLs changed when
// Prompt 14 inserted <DashboardLayout /> between the role guard and its routes.
//
// Every guard here is UX only. The Laravel API must enforce the same rules
// server-side, on every request (00 §11 — see the header of ./guards.jsx).

const NotFoundPage = lazy(() => import('@/features/staticPages/pages/NotFoundPage'))

// `import.meta.env.DEV` is statically replaced at build time, so the dev gallery
// chunk is eliminated from production bundles entirely; `env.enableDevPages`
// lets a developer switch it off locally (00 §4).
const showDevRoutes = import.meta.env.DEV && env.enableDevPages

// Router-level failures (render errors, and loaders/actions when they arrive)
// render the friendly error screen instead of React Router's default stack dump.
const errorElement = <RouteErrorElement />

export const router = createBrowserRouter([
  {
    path: paths.HOME,
    element: <PublicLayout />,
    errorElement,
    children: [
      ...publicRoutes,
      ...(showDevRoutes ? devRoutes : []),
      // Last resort: anything the whole route table missed, anywhere in the app.
      { path: paths.CATCH_ALL, element: <NotFoundPage /> },
    ],
  },
  {
    // GuestRoute sits *outside* AuthLayout so a signed-in member is redirected
    // without the sign-in chrome rendering behind the redirect first.
    element: <GuestRoute />,
    errorElement,
    children: [{ element: <AuthLayout />, children: authRoutes }],
  },
  {
    // Two guards, two questions: ProtectedRoute asks "signed in?" and remembers
    // the deep link; RoleRoute asks "the right role?". <DashboardLayout /> then
    // wraps each area's route table, so every dashboard URL — including the ones
    // no prompt has built yet, which land on the 404 — renders inside the shell
    // with its sidebar, top bar, and mobile bar intact (Prompt 14).
    element: <ProtectedRoute />,
    errorElement,
    children: [
      {
        element: <RoleRoute roles={[ROLES.BUYER]} />,
        children: [{ element: <DashboardLayout />, children: buyerRoutes }],
      },
      {
        element: <RoleRoute roles={[ROLES.CREATOR]} />,
        children: [{ element: <DashboardLayout />, children: creatorRoutes }],
      },
      {
        element: <RoleRoute roles={ADMIN_ROLES} />,
        children: [{ element: <DashboardLayout />, children: adminRoutes }],
      },
    ],
  },
])

export default router
