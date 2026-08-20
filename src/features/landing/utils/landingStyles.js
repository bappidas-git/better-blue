import { cssEasing, durations } from '@/theme/motionTokens'

// Shared `sx` fragments for the landing page's cards. Kept out of the component
// files so the hover treatment is defined once and every tile behaves the same.

/**
 * Hover lift for marketing cards: 4px and one shadow step (00 §6 — the app's
 * own cards lift 3px; a landing tile is allowed a little more presence), on
 * transform and box-shadow only, and switched off for people who asked for
 * reduced motion.
 *
 * On the dark theme the shadow alone would be invisible, so the lift carries a
 * purple halo as well — the same `glowPurple` token the theme's interactive
 * cards use (docs/theme-v2.md §Glow).
 *
 * @param {object} theme the MUI theme
 * @returns {object} sx object — pass as `sx={cardLiftSx}` or `sx={[cardLiftSx, …]}`
 */
export const cardLiftSx = (theme) => ({
  transition: `transform ${durations.fast}ms ${cssEasing}, box-shadow ${durations.fast}ms ${cssEasing}`,
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.customShadows.cardHover,
  },
  '@media (prefers-reduced-motion: reduce)': {
    '&:hover': { transform: 'none' },
  },
})

export default cardLiftSx
