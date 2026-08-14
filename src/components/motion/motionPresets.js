import { distances, durations, easing } from '@/theme/motionTokens'

// Shared Framer Motion variants — prompts/00-architecture-and-rules.md §7.
// All presets animate transform/opacity only and are built from motionTokens.
// Usage: <motion.div variants={fadeInUp} initial="hidden" animate="visible" />

const seconds = (ms) => ms / 1000

export const fadeInUp = {
  hidden: { opacity: 0, y: distances.md },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: seconds(durations.base), ease: easing },
  },
}

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: seconds(durations.base), ease: easing },
  },
}

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: seconds(durations.base), ease: easing },
  },
}

/** Parent wrapper that staggers its children's variants. */
export const staggerContainer = (stagger = 0.06) => ({
  hidden: {},
  visible: { transition: { staggerChildren: stagger } },
})

/** Child variant for staggered lists (pair with staggerContainer). */
export const listItem = {
  hidden: { opacity: 0, y: distances.sm },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: seconds(durations.base), ease: easing },
  },
}
