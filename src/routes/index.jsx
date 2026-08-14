import { lazy } from 'react'

import { Outlet, createBrowserRouter } from 'react-router-dom'

import { RouteErrorElement } from '@/app/ErrorBoundary'
import { env } from '@/config/env'
import AuthLayout from '@/layouts/AuthLayout'
import PublicLayout from '@/layouts/PublicLayout'

import { adminRoutes } from './adminRoutes'
import { buyerRoutes } from './buyerRoutes'
import { creatorRoutes } from './creatorRoutes'
import { paths } from './paths'
import { authRoutes, devRoutes, publicRoutes } from './publicRoutes'

// The router. One branch per shell, each branch fed by a route table that later
// prompts append to — so adding a screen never means editing this file.
//
// Branch layout:
//   /            PublicLayout   public pages + the 404 catch-all
//   (pathless)   AuthLayout     /login, /register (Prompt 09)
//   (pathless)   dashboards     /buyer, /creator, /admin (Prompts 09/14)
//
// The dashboard and auth branches are deliberately *pathless* layout routes
// whose children carry absolute paths. Giving the branch a `path` would make
// `/buyer` match the branch itself and render an empty <Outlet /> — a blank
// page — while it has no children; pathless means unmatched dashboard URLs fall
// through to the 404 under PublicLayout instead. Children still use the
// `/buyer/...` constants from ./paths.js, so nothing about the URLs changes when
// Prompt 14 swaps <Outlet /> for <DashboardLayout />.

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
    element: <AuthLayout />,
    errorElement,
    children: authRoutes,
  },
  {
    // Prompt 09 wraps this in <RoleRoute roles={[ROLES.BUYER]}>, Prompt 14
    // replaces <Outlet /> with <DashboardLayout />.
    element: <Outlet />,
    errorElement,
    children: buyerRoutes,
  },
  {
    element: <Outlet />,
    errorElement,
    children: creatorRoutes,
  },
  {
    element: <Outlet />,
    errorElement,
    children: adminRoutes,
  },
])

export default router
