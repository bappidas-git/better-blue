import Box from '@mui/material/Box'
import { motion } from 'framer-motion'

import { fadeInUp } from '@/components/motion/motionPresets'

// In-view reveal for long marketing/detail pages — 00 §7. Animates once, so
// scrolling back up never re-triggers it, and only ever touches opacity and
// transform. Reduced motion is handled globally by MotionConfig.

/**
 * @param {object} props
 * @param {React.ReactNode} props.children content to reveal
 * @param {object} [props.variants=fadeInUp] Framer variants with `hidden`/`visible` states
 * @param {string} [props.margin='-40px'] viewport root margin — negative delays the reveal
 *   until the element is properly on screen
 * @param {boolean} [props.once=true] animate only the first time it enters the viewport
 * @param {number} [props.delay=0] seconds to wait before animating (stagger by hand)
 * @param {React.ElementType} [props.component='div'] element rendered by the wrapper
 * @param {object} [props.sx] MUI system styles
 */
export default function FadeInView({
  children,
  variants = fadeInUp,
  margin = '-40px',
  once = true,
  delay = 0,
  component = 'div',
  sx,
  ...rest
}) {
  return (
    <Box
      component={motion[component] ?? motion.div}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin }}
      transition={delay ? { delay } : undefined}
      sx={sx}
      {...rest}
    >
      {children}
    </Box>
  )
}
