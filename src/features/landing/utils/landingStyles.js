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
 * `border-color` is in the transition list without being set here, so a caller
 * that brightens its own edge on hover gets it eased rather than snapped.
 *
 * @param {object} theme the MUI theme
 * @returns {object} sx object — pass as `sx={cardLiftSx}` or `sx={[cardLiftSx, …]}`
 */
export const cardLiftSx = (theme) => ({
  transition: `transform ${durations.fast}ms ${cssEasing}, box-shadow ${durations.fast}ms ${cssEasing}, border-color ${durations.fast}ms ${cssEasing}`,
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.customShadows.cardHover,
  },
  '@media (prefers-reduced-motion: reduce)': {
    '&:hover': { transform: 'none' },
  },
})

/**
 * Confines an `AmbientGlow` to a band across the top of its section, so the
 * blobs sit behind the header and nothing else.
 *
 * `AmbientGlow` fills its parent (`inset: 0`) and places its blobs as
 * *percentages of that box*. Over a band as tall as a landing section that
 * puts both blobs hundreds of pixels off-screen, and a glow that did reach the
 * middle would be sitting behind body copy — which theme-v2 §5 rules out. This
 * overrides the inset with a fixed-height strip; pair it with
 * `placement="center"` so the two blobs land inside the strip.
 *
 * @example
 * <Box sx={{ position: 'relative', overflow: 'hidden' }}>
 *   <AmbientGlow placement="center" intensity="subtle" sx={glowBandSx} />
 *   <LandingSection sx={{ position: 'relative' }} …>…</LandingSection>
 * </Box>
 */
export const glowBandSx = {
  inset: 'auto',
  top: 0,
  left: 0,
  right: 0,
  height: { xs: 320, md: 460 },
}

export default cardLiftSx
