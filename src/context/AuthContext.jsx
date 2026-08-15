import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { useToast } from '@/components/feedback/ToastProvider'
import { paths } from '@/routes/paths'
import { API_ERROR_CODE } from '@/services/api/apiError'
import { authService, readStoredSession } from '@/services/authService'

// The one piece of global auth state — 00 §10: "Global client state only:
// AuthContext, ToastProvider, ConfirmDialogProvider, notifications hook."
//
// This provider owns the session and *only* the session: it holds
// `{ token, user }`, mirrors it into `bb.auth` through `authService`, and
// revalidates it against the server on boot. It contains no HTTP and no mock
// behaviour — swap `authService`'s four bodies for real endpoints and this file
// does not change (contract §2.4).
//
// **Where the redirects live.** Landing on the right screen after signing in is
// the guards' job, not this file's: `GuestRoute` sends an authenticated visitor
// to `location.state.from` (the deep link they were stopped at) or to
// `paths.roleHome(user.role)`, so the redirect is a render of the current auth
// state rather than a race between a state update and a navigation. Sign-*out*
// is the one imperative move — leaving a protected page must go HOME, not
// bounce through `ProtectedRoute` to the sign-in screen — so `AppProviders`
// hands the provider the router's `navigate`.
//
// SECURITY: none of this is access control (00 §11). The Laravel API must
// enforce authentication and authorization on every request independently.

const AuthContext = createContext(null)

/** First name only — a welcome toast reads better without the surname. */
const firstName = (name) => String(name ?? '').trim().split(/\s+/)[0] || 'there'

/**
 * A `forbidden` rejection carrying `details.accountStatus` (contract §2.3) —
 * a suspended, blacklisted, or deactivated account, which gets a status screen
 * rather than a form error.
 */
function toAccountStatusIssue(error) {
  if (error?.code !== API_ERROR_CODE.FORBIDDEN) return null
  const accountStatus = error.details?.accountStatus
  return accountStatus ? { accountStatus, message: error.message } : null
}

/**
 * A boot revalidation that failed because the *server* said so, rather than
 * because it could not be reached. Only these clear the session: being offline
 * (or hitting a 5xx) is not proof that a token was revoked, and signing someone
 * out over a dropped connection loses their session for no reason.
 */
const REVOKING_CODES = [
  API_ERROR_CODE.UNAUTHORIZED,
  API_ERROR_CODE.FORBIDDEN,
  API_ERROR_CODE.NOT_FOUND,
]

/**
 * The session, and the four operations that change it.
 *
 * @returns {{
 *   user: object|null,
 *   isAuthenticated: boolean,
 *   isBooting: boolean,
 *   accountStatusIssue: {accountStatus: string, message: string}|null,
 *   login: (credentials: {email: string, password: string}) => Promise<object>,
 *   register: (payload: object) => Promise<object>,
 *   logout: () => Promise<void>,
 *   refreshUser: () => Promise<object>,
 *   dismissAccountStatusIssue: () => void,
 * }}
 *
 * @example
 * const { user, isAuthenticated, logout } = useAuth()
 */
// The hook and its provider are one unit — splitting them across files to
// satisfy fast refresh would scatter the auth API for no runtime benefit.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth() must be used inside <AuthProvider> (mounted in AppProviders).')
  }
  return context
}

/**
 * @param {object} props
 * @param {React.ReactNode} props.children the app tree, router included
 * @param {(to: string, options?: object) => unknown} [props.navigate] the
 *   router's imperative navigate, used only to leave a protected page on
 *   sign-out. Omitting it degrades to "the session clears where you stand".
 */
export default function AuthProvider({ children, navigate }) {
  const toast = useToast()

  // Read storage once, synchronously: the first render already knows whether
  // anyone is signed in, so a signed-out visitor never sees the boot loader and
  // a signed-in one never flashes the signed-out shell (00 §11).
  const [session, setSession] = useState(readStoredSession)
  const [isBooting, setBooting] = useState(() => Boolean(readStoredSession()))
  const [accountStatusIssue, setAccountStatusIssue] = useState(null)

  // Latest `navigate` without making the callbacks below depend on it.
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  // StrictMode mounts every effect twice in development; boot revalidation must
  // happen once either way.
  const bootedRef = useRef(false)

  useEffect(() => {
    if (bootedRef.current) return
    bootedRef.current = true

    if (!readStoredSession()) {
      setBooting(false)
      return
    }

    // Revalidate against the server: a suspension applied since the last visit
    // takes effect here rather than at the next sign-in (contract §2.1).
    authService
      .me()
      .then(({ user }) => {
        setSession((previous) => (previous ? { ...previous, user } : previous))
      })
      .catch((error) => {
        const issue = toAccountStatusIssue(error)
        if (issue) {
          // The one failure worth interrupting for: the person can still sign
          // in as far as they know, so say why they cannot.
          setAccountStatusIssue(issue)
          toast.warning('Your account needs attention', { description: issue.message })
        }

        if (issue || REVOKING_CODES.includes(error?.code)) {
          authService.logout()
          setSession(null)
        }
        // Anything else (offline, 5xx) keeps the stored session — see
        // REVOKING_CODES.
      })
      .finally(() => setBooting(false))
  }, [toast])

  const login = useCallback(
    async (credentials) => {
      setAccountStatusIssue(null)
      try {
        const { token, user } = await authService.login(credentials)
        setSession({ token, user })
        toast.success(`Welcome back, ${firstName(user.name)}`)
        return user
      } catch (error) {
        setAccountStatusIssue(toAccountStatusIssue(error))
        throw error
      }
    },
    [toast]
  )

  const register = useCallback(
    async (payload) => {
      setAccountStatusIssue(null)
      const { token, user } = await authService.register(payload)
      setSession({ token, user })
      toast.success(`Welcome to BetterBlue, ${firstName(user.name)}`, {
        description: 'Your account is ready — finish your profile whenever you like.',
      })
      return user
    },
    [toast]
  )

  const logout = useCallback(async () => {
    await authService.logout()
    // Leave the protected area *before* the session clears, so `ProtectedRoute`
    // never gets a frame in which to redirect to the sign-in screen instead.
    await navigateRef.current?.(paths.HOME, { replace: true })
    setSession(null)
    setAccountStatusIssue(null)
    toast.success('You are signed out')
  }, [toast])

  /** Re-reads the account — call after a self-update so the UI reflects it. */
  const refreshUser = useCallback(async () => {
    const { user } = await authService.me()
    setSession((previous) => (previous ? { ...previous, user } : previous))
    return user
  }, [])

  const dismissAccountStatusIssue = useCallback(() => setAccountStatusIssue(null), [])

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      isAuthenticated: Boolean(session?.user),
      isBooting,
      accountStatusIssue,
      login,
      register,
      logout,
      refreshUser,
      dismissAccountStatusIssue,
    }),
    [
      accountStatusIssue,
      dismissAccountStatusIssue,
      isBooting,
      login,
      logout,
      refreshUser,
      register,
      session,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
