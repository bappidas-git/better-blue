import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { MotionConfig } from 'framer-motion'

import ConfirmDialogProvider from '@/components/feedback/ConfirmDialogProvider'
import ToastProvider from '@/components/feedback/ToastProvider'
import AuthProvider from '@/context/AuthContext'
import { router } from '@/routes'
import theme from '@/theme'

// Global provider stack — the single composition point for everything the whole
// app can reach (00 §10).
//
// `AuthProvider` sits here, *above* the `<RouterProvider>` that `App` renders,
// because the guards in `routes/guards.jsx` consume the session while they
// decide what to render. It is below `ToastProvider` because signing in, out,
// and failing to do either all raise toasts.

/**
 * The router's imperative navigate, handed to `AuthProvider` so signing out can
 * leave a protected page before the session clears. Module-level so the prop
 * identity is stable across renders. Every other auth redirect is declarative,
 * inside the guards — see `context/AuthContext.jsx`.
 */
const navigateTo = (to, options) => router.navigate(to, options)

export default function AppProviders({ children }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {/* reducedMotion="user" makes every Framer animation honor the OS
          prefers-reduced-motion setting — mandatory per 00 §7. */}
      <MotionConfig reducedMotion="user">
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          {/* Feedback providers sit above the app so any feature can call
              useToast()/useConfirm() (00 §12). Confirm is nested inside Toast so
              a confirmed action can raise its result toast. */}
          <ToastProvider>
            <ConfirmDialogProvider>
              <AuthProvider navigate={navigateTo}>{children}</AuthProvider>
            </ConfirmDialogProvider>
          </ToastProvider>
        </LocalizationProvider>
      </MotionConfig>
    </ThemeProvider>
  )
}
