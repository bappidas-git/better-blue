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
  // Semantic colours. The `main` values are the locked tokens (00 §6) and are
  // what fills a chip, an icon, or a progress bar. The `dark` values are what
  // *text* uses — `softTone` in ./components.js paints Chip and Alert labels
  // with `dark` on a 12% wash of `main`, and a handful of captions use it
  // directly.
  //
  // Left to MUI, `dark` is `main` darkened by a flat 20%, which is a ratio
  // nobody checked: the Prompt 37 contrast sweep found warning at 3.31:1 and
  // info at 4.18:1 against white — both under AA for body text — and success
  // passing on white (4.91:1) but failing on its own tint (4.30:1). These are
  // the shades derived to clear 4.5:1 on **both** surfaces, so a warning
  // caption and a warning chip are each legible:
  //
  //   token          dark       on paper   on 12% tint
  //   success        #117E39      5.16         4.52
  //   warning        #9A6407      5.00         4.56
  //   error          #B01E1E      6.88         5.72
  //   info           #0A75A5      5.12         4.53
  //
  // `error` already passed on MUI's automatic shade; it is spelled out anyway
  // so all four are pinned and none can drift with a library default.
  success: { main: '#16A34A', dark: '#117E39' },
  warning: { main: '#F59E0B', dark: '#9A6407' },
  error: { main: '#DC2626', dark: '#B01E1E' },
  info: { main: '#0EA5E9', dark: '#0A75A5' },
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
