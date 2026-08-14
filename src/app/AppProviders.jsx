import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { MotionConfig } from 'framer-motion'

import ConfirmDialogProvider from '@/components/feedback/ConfirmDialogProvider'
import ToastProvider from '@/components/feedback/ToastProvider'
import theme from '@/theme'

// Global provider stack. Router and auth are layered in by later prompts (08+);
// keep this the single composition point.
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
            <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
          </ToastProvider>
        </LocalizationProvider>
      </MotionConfig>
    </ThemeProvider>
  )
}
