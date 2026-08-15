import { useEffect, useRef } from 'react'

import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

// The few seconds while the charge is with the processor.
//
// It covers its container rather than the viewport: the order summary stays
// readable beside it on desktop, and the buyer can see exactly what is being
// paid for while it happens.
//
// It does three jobs at once (§12):
//
// - **Blocks a second submit.** It sits over the form and takes the pointer
//   events; the form's own controls are disabled underneath as well, so neither
//   a click nor a second Enter can start another charge.
// - **Announces itself.** `role="status"` with `aria-busy` and a polite live
//   region, so a screen reader says what is happening rather than going quiet.
// - **Holds focus.** Focus moves onto the overlay when it appears, which stops
//   a tab press from wandering into the frozen fields behind it.

/**
 * @param {object} props
 * @param {boolean} props.open whether a charge is in flight
 * @param {React.ReactNode} [props.message] the reassurance line under the spinner
 */
export default function ProcessingOverlay({ open, message }) {
  const surface = useRef(null)

  useEffect(() => {
    if (open) surface.current?.focus?.({ preventScroll: true })
  }, [open])

  if (!open) return null

  return (
    <Box
      ref={surface}
      tabIndex={-1}
      role="status"
      aria-busy="true"
      aria-live="polite"
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'inherit',
        // Opaque enough to make the form plainly unavailable, sheer enough that
        // it is obviously the same card underneath.
        bgcolor: (theme) => alpha(theme.palette.background.paper, 0.92),
        outline: 'none',
      }}
    >
      <Stack spacing={2} alignItems="center" sx={{ px: 3, textAlign: 'center' }}>
        <CircularProgress size={44} thickness={4} aria-hidden="true" />
        <Box>
          <Typography variant="subtitle1" component="p" sx={{ fontWeight: 700 }}>
            Processing payment…
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {message ?? 'This takes a few seconds. Please do not close this window.'}
          </Typography>
        </Box>
      </Stack>
    </Box>
  )
}
