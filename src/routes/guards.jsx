import { useEffect, useRef } from 'react'

import { Navigate, Outlet, useLocation } from 'react-router-dom'

import AppLoader from '@/app/AppLoader'
import { useToast } from '@/components/feedback/ToastProvider'
import { hasAnyPermission, hasPermission } from '@/constants/permissions'
import { ROLE_META } from '@/constants/roles'
import { useAuth } from '@/context/AuthContext'

import { paths } from './paths'

// Route protection — 00 §11. These three guards are the **only** mechanism that
// decides whether a route renders; no page checks the session for itself, and
// no route is protected by being hard to find.
//
// ┌───────────────┬──────────────────────────┬─────────────────────────────────┐
// │ Guard         │ Lets through             │ Otherwise                       │
// ├───────────────┼──────────────────────────┼─────────────────────────────────┤
// │ GuestRoute    │ signed-out visitors      │ → the deep link they were       │
// │               │                          │   stopped at, or their role home│
// │ ProtectedRoute│ any signed-in member     │ → /login, remembering `from`    │
// │ RoleRoute     │ the listed roles         │ → their own role home + a toast │
// └───────────────┴──────────────────────────┴─────────────────────────────────┘
//
// While `isBooting` — the one round trip that revalidates a restored session —
// every guard renders the branded loader instead of guessing. That is what
// keeps a hard refresh on `/buyer/orders` from flashing the sign-in screen
// before the session comes back (00 §11).
//
// SECURITY: **this is UX, not access control.** Every check here runs in the
// browser and can be bypassed by anyone willing to open devtools. The Laravel
// API must independently enforce authentication on every endpoint and
// authorization on every action — a hidden button is not a permission, and an
// unreachable route is not a protected resource (00 §11/§14, contract §9.1).

/** Full-screen brand loader shown while the stored session is revalidated. */
function BootScreen() {
  return <AppLoader fullScreen label="Checking your session" />
}

/** Where a signed-out visitor is sent, with the page they wanted remembered. */
function toSignIn(location) {
  // `state.from` is read back by `GuestRoute` after a successful sign-in, so a
  // deep link survives the detour through the form.
  return <Navigate to={paths.LOGIN} replace state={{ from: location }} />
}

/**
 * The signed-out surface: `/login`, `/register`, `/forgot-password`.
 *
 * A member who is already signed in has no business on these screens, so they
 * are sent onward — to the page that sent them here if there was one, and to
 * their role home otherwise. This is also the post-sign-in redirect: the form
 * updates the session, this guard re-renders, and the redirect follows from the
 * new state rather than from an imperative call racing it.
 */
export function GuestRoute() {
  const { isAuthenticated, isBooting, user } = useAuth()
  const location = useLocation()

  if (isBooting) return <BootScreen />

  if (isAuthenticated) {
    const from = location.state?.from
    const destination = from?.pathname
      ? `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`
      : paths.roleHome(user.role)
    return <Navigate to={destination} replace />
  }

  return <Outlet />
}

/**
 * Everything behind a sign-in. Unauthenticated visitors go to `/login` with the
 * page they wanted attached, so they land back on it afterwards.
 */
export function ProtectedRoute() {
  const { isAuthenticated, isBooting } = useAuth()
  const location = useLocation()

  if (isBooting) return <BootScreen />
  if (!isAuthenticated) return toSignIn(location)

  return <Outlet />
}

/**
 * Role-scoped areas: the buyer dashboard, the creator dashboard, the admin
 * console. A member who reaches the wrong one is not shown a dead end — they
 * are moved to their own home and told why.
 *
 * @param {object} props
 * @param {string[]} props.roles roles from `ROLES` allowed to render this branch
 */
export function RoleRoute({ roles = [] }) {
  const { isAuthenticated, isBooting, user } = useAuth()
  const location = useLocation()
  const toast = useToast()

  const isWrongRole = isAuthenticated && !roles.includes(user.role)

  // Announced from an effect, not from render: raising a toast while deciding
  // what to render would update another component mid-render. The ref keeps it
  // to one message under StrictMode's double-invoked effects.
  const announcedRef = useRef(false)
  useEffect(() => {
    if (!isWrongRole || announcedRef.current) return
    announcedRef.current = true
    toast.info('That area is not part of your account', {
      description: `You are signed in as a ${ROLE_META[user.role]?.label ?? user.role}, so we brought you back to your dashboard.`,
    })
  }, [isWrongRole, toast, user])

  if (isBooting) return <BootScreen />
  if (!isAuthenticated) return toSignIn(location)
  if (isWrongRole) return <Navigate to={paths.roleHome(user.role)} replace />

  return <Outlet />
}

/**
 * Permission-scoped UI inside the admin console (00 §11) — the component form
 * of `hasPermission`. `super_admin` passes everything; an `admin` passes what
 * their `permissions` array carries.
 *
 * Use it for actions and panels, never as the only thing standing between a
 * member and an operation: the API must reject the call as well.
 *
 * @param {object} props
 * @param {string|string[]} props.permission a key from `PERMISSIONS`, or
 *   several — any one of them is enough
 * @param {React.ReactNode} props.children rendered when the permission is held
 * @param {React.ReactNode} [props.fallback=null] rendered when it is not —
 *   default is to render nothing at all
 *
 * @example
 * <PermissionGate permission={PERMISSIONS.DISPUTES_RESOLVE}>
 *   <Button onClick={resolve}>Resolve dispute</Button>
 * </PermissionGate>
 */
export function PermissionGate({ permission, children, fallback = null }) {
  const { user } = useAuth()

  const allowed = Array.isArray(permission)
    ? hasAnyPermission(user, permission)
    : hasPermission(user, permission)

  return <>{allowed ? children : fallback}</>
}
