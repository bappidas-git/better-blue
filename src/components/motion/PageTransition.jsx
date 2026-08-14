import Box from '@mui/material/Box'
import { motion } from 'framer-motion'

import { distances, durations, easing } from '@/theme/motionTokens'

// Route-level enter/exit wrapper — 00 §7. Enter fades in while rising 8px,
// exit is a plain fade so an outgoing page never pushes layout around.
// `<MotionConfig reducedMotion="user">` in AppProviders strips the transform
// for people who ask for reduced motion; the opacity fade is kept.

const seconds = (ms) => ms / 1000

const pageVariants = {
  initial: { opacity: 0, y: distances.sm },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: seconds(durations.base), ease: easing },
  },
  exit: {
    opacity: 0,
    transition: { duration: seconds(durations.fast), ease: easing },
  },
}

/**
 * @param {object} props
 * @param {React.ReactNode} props.children page content
 * @param {React.ElementType} [props.component='div'] element rendered by the wrapper
 * @param {object} [props.sx] MUI system styles
 *
 * @example
 * <AnimatePresence mode="wait">
 *   <PageTransition key={location.pathname}><Outlet /></PageTransition>
 * </AnimatePresence>
 */
export default function PageTransition({ children, component = 'div', sx, ...rest }) {
  return (
    <Box
      component={motion[component] ?? motion.div}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      sx={sx}
      {...rest}
    >
      {children}
    </Box>
  )
}
