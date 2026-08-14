import Box from '@mui/material/Box'
import { visuallyHidden } from '@mui/utils'
import { motion } from 'framer-motion'

import Logo from '@/components/brand/Logo'
import { durations, easing } from '@/theme/motionTokens'

// The Suspense fallback behind every lazily-loaded route. Deliberately quiet:
// the logo mark breathing on the page background, no spinner, no layout shift.
// `<MotionConfig reducedMotion="user">` in AppProviders drops the scale for
// anyone who asked for reduced motion; the opacity fade stays.

const seconds = (ms) => ms / 1000

/**
 * @param {object} props
 * @param {boolean} [props.fullScreen=false] fill the viewport instead of the content area
 * @param {string} [props.label='Loading'] screen-reader announcement
 */
export default function AppLoader({ fullScreen = false, label = 'Loading' }) {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        display: 'grid',
        placeItems: 'center',
        px: 2,
        py: 6,
        minHeight: fullScreen ? '100vh' : '50vh',
      }}
    >
      <Box
        component={motion.div}
        aria-hidden="true"
        animate={{ opacity: [1, 0.45, 1], scale: [1, 0.94, 1] }}
        transition={{
          duration: seconds(durations.hero) * 2,
          ease: easing,
          repeat: Infinity,
        }}
        sx={{ display: 'inline-flex' }}
      >
        <Logo variant="mark" size={44} />
      </Box>
      <Box sx={visuallyHidden}>{label}</Box>
    </Box>
  )
}
