import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Snackbar from '@mui/material/Snackbar'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { AnimatePresence, motion } from 'framer-motion'

import { durations, easing } from '@/theme/motionTokens'

// App-wide toast feedback — 00 §12: "every mutation → success/error toast via
// useToast()". Toasts stack bottom-center on mobile and bottom-right on
// desktop, auto-dismiss after 4s, and enter/exit with Framer (reduced motion is
// handled by <MotionConfig reducedMotion="user"> in AppProviders).

/** Auto-hide delay in ms. */
const TOAST_DURATION = 4000

/** Most toasts shown at once — older ones drop off the top of the stack. */
const MAX_TOASTS = 4

const SEVERITY_ICONS = {
  success: 'tabler:circle-check',
  error: 'tabler:alert-circle',
  warning: 'tabler:alert-triangle',
  info: 'tabler:info-circle',
}

// Non-urgent updates are announced politely; failures and warnings interrupt
// (Prompt 04 §12).
const SEVERITY_ROLES = {
  success: 'status',
  info: 'status',
  warning: 'alert',
  error: 'alert',
}

const ToastContext = createContext(null)

/**
 * Access the toast API from anywhere under `<ToastProvider>`.
 * @returns {{
 *   success: (message: string, options?: object) => string,
 *   error: (message: string, options?: object) => string,
 *   info: (message: string, options?: object) => string,
 *   warning: (message: string, options?: object) => string,
 *   show: (toast: object) => string,
 *   dismiss: (id: string) => void,
 * }}
 *
 * @example
 * const toast = useToast()
 * toast.success('Proposal sent', { description: 'The buyer has been notified.' })
 */
// The hook and its provider are one unit — splitting them across files to
// satisfy fast refresh would scatter the toast API for no runtime benefit.
// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast() must be used inside <ToastProvider> (mounted in AppProviders).')
  }
  return context
}

/**
 * @param {object} props
 * @param {React.ReactNode} props.children app tree that can raise toasts
 */
export default function ToastProvider({ children }) {
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())
  const counter = useRef(0)

  const clearTimer = useCallback((id) => {
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const dismiss = useCallback(
    (id) => {
      clearTimer(id)
      setToasts((previous) => previous.filter((toast) => toast.id !== id))
    },
    [clearTimer]
  )

  const show = useCallback(
    ({ severity = 'info', message, description, duration = TOAST_DURATION } = {}) => {
      counter.current += 1
      const id = `toast_${counter.current}`

      setToasts((previous) => {
        const next = [...previous, { id, severity, message, description }]
        // Drop the oldest entries (and their timers) once the stack is full.
        const overflow = next.slice(0, Math.max(next.length - MAX_TOASTS, 0))
        overflow.forEach((toast) => clearTimer(toast.id))
        return next.slice(-MAX_TOASTS)
      })

      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration)
        )
      }

      return id
    },
    [clearTimer, dismiss]
  )

  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((timer) => clearTimeout(timer))
      pending.clear()
    }
  }, [])

  const toast = useMemo(
    () => ({
      success: (message, options) => show({ ...options, severity: 'success', message }),
      error: (message, options) => show({ ...options, severity: 'error', message }),
      info: (message, options) => show({ ...options, severity: 'info', message }),
      warning: (message, options) => show({ ...options, severity: 'warning', message }),
      show,
      dismiss,
    }),
    [dismiss, show]
  )

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* The Snackbar stays mounted as a non-interactive positioning shell so
          Framer owns the enter/exit of individual toasts; each toast re-enables
          pointer events for its own close button. */}
      <Snackbar
        open
        anchorOrigin={{ vertical: 'bottom', horizontal: isDesktop ? 'right' : 'center' }}
        sx={{
          pointerEvents: 'none',
          bottom: { xs: 'max(16px, env(safe-area-inset-bottom))', md: 24 },
          left: { xs: 8, md: 'auto' },
          right: { xs: 8, md: 24 },
          width: { xs: 'auto', md: 400 },
          maxWidth: 'calc(100vw - 16px)',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
          <AnimatePresence initial={false}>
            {toasts.map((item) => (
              <Box
                key={item.id}
                component={motion.div}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: durations.base / 1000, ease: easing }}
                sx={{
                  pointerEvents: 'auto',
                  borderRadius: 3,
                  bgcolor: 'background.paper',
                  boxShadow: (muiTheme) => muiTheme.customShadows.z3,
                }}
              >
                <Alert
                  severity={item.severity}
                  role={SEVERITY_ROLES[item.severity] ?? 'status'}
                  onClose={() => dismiss(item.id)}
                  icon={<Icon icon={SEVERITY_ICONS[item.severity]} width={22} />}
                  sx={{ alignItems: 'flex-start' }}
                >
                  {item.description ? (
                    <>
                      <AlertTitle sx={{ mb: 0.25 }}>{item.message}</AlertTitle>
                      {item.description}
                    </>
                  ) : (
                    item.message
                  )}
                </Alert>
              </Box>
            ))}
          </AnimatePresence>
        </Box>
      </Snackbar>
    </ToastContext.Provider>
  )
}
