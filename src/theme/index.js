import { createTheme } from '@mui/material/styles'

import { components } from './components'
import { glowPink, glowPurple, palette } from './palette'
import { typography } from './typography'

// Elevation on a near-black page cannot lean on a soft ink shadow the way the
// light theme did — a 5% black blur over #0B0710 is invisible. The dark scale
// keeps the same three steps but drives them with deep, high-alpha black so the
// surface separation is real, and pairs them with the brand glow tokens.
const customShadows = {
  z1: '0 1px 2px rgba(0, 0, 0, 0.5), 0 1px 3px rgba(0, 0, 0, 0.36)',
  z2: '0 8px 24px rgba(0, 0, 0, 0.55)',
  z3: '0 24px 60px rgba(0, 0, 0, 0.66)',

  /** Neon glow tokens — interactive emphasis only (docs/theme-v2.md §Glow). */
  glowPurple,
  glowPink,
  /** Both glows at once: the strongest emphasis, for hovered/focused CTAs. */
  glowBrand: `${glowPurple}, ${glowPink}`,
  /** Ambient lift for a hovered card: depth first, a purple halo second. */
  cardHover: `0 12px 32px rgba(0, 0, 0, 0.55), ${glowPurple}`,
}

const theme = createTheme({
  palette,
  typography,
  components,
  shape: { borderRadius: 12 },
  spacing: 8,
  customShadows,
})

export { customShadows }
export default theme
