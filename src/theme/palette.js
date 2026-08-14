import { alpha } from '@mui/material/styles'

// Locked design tokens — prompts/00-architecture-and-rules.md §6.
// This module (plus src/styles/tokens.css) is the ONLY place raw hex values
// may live. Everything else consumes the theme or CSS custom properties.

const INK = '#171223' // text.primary — also the base for shadows/action tints

/**
 * Brand gradient token. Reserved for hero accents, primary CTAs, the logo,
 * and small highlights — never wash whole surfaces in it.
 */
export const brandGradient = 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)'

export const palette = {
  mode: 'light',
  primary: {
    // Purple scale. `lighter` is the chip/selection tint, `surface` the
    // faint wash for tinted panels (spec tints #EDE9FE / #F5F3FF).
    main: '#7C3AED',
    light: '#A78BFA',
    dark: '#5B21B6',
    lighter: '#EDE9FE',
    surface: '#F5F3FF',
    contrastText: '#FFFFFF',
  },
  secondary: {
    // Pink scale. Single spec tint #FDF2F8 doubles as `lighter` + `surface`
    // so consumers can address both palettes uniformly.
    main: '#EC4899',
    light: '#F9A8D4',
    dark: '#BE185D',
    lighter: '#FDF2F8',
    surface: '#FDF2F8',
    contrastText: '#FFFFFF',
  },
  success: { main: '#16A34A' },
  warning: { main: '#F59E0B' },
  error: { main: '#DC2626' },
  info: { main: '#0EA5E9' },
  background: {
    default: '#FAFAFC',
    paper: '#FFFFFF',
  },
  text: {
    primary: INK,
    secondary: '#6E6880',
    disabled: alpha(INK, 0.4),
  },
  divider: '#E5E2EC',
  action: {
    // Ink-based interaction tints so hover/selected states stay on-brand
    // instead of MUI's pure-black defaults.
    active: alpha(INK, 0.56),
    hover: alpha(INK, 0.045),
    selected: alpha(INK, 0.08),
    disabled: alpha(INK, 0.3),
    disabledBackground: alpha(INK, 0.1),
    focus: alpha(INK, 0.12),
  },
}
