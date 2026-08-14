import { alpha, createTheme } from '@mui/material/styles'

import { components } from './components'
import { palette } from './palette'
import { typography } from './typography'

// Three subtle elevation levels only (00 §6) — mirrored in tokens.css.
const shadowInk = palette.text.primary
const customShadows = {
  z1: `0 1px 2px ${alpha(shadowInk, 0.05)}, 0 1px 3px ${alpha(shadowInk, 0.06)}`,
  z2: `0 6px 16px ${alpha(shadowInk, 0.08)}`,
  z3: `0 16px 40px ${alpha(shadowInk, 0.14)}`,
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
