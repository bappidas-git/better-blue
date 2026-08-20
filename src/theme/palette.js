import { alpha } from '@mui/material/styles'

// Storefront V2 dark palette — docs/theme-v2.md is the token authority.
//
// This supersedes the light palette that prompts/00-architecture-and-rules.md §6
// locked ("light theme only" + the #FAFAFC/#FFFFFF/#7C3AED values). The product
// is dark-only now: there is no light mode and no toggle. Everything else in
// 00 §6 still holds — this module (plus src/styles/tokens.css and the avatar
// tints in src/constants/images.js) is the ONLY place raw hex values may live.
//
// Contrast: every text/background pair below was measured against WCAG 2.1 and
// the full table lives in docs/theme-v2.md §9. The short version: text.primary
// clears 15:1 on every surface, text.secondary 8:1, and every shade this theme
// designates as a *text* shade — primary/secondary `light`, semantic `dark` —
// clears 4.5:1 on all four. `main` is a fill, a dot, or an icon; as text it
// falls to 4.41:1 on the elevated surface, which is why links and outlined
// chips resolve to `light` in ./components.js.

const PURPLE = '#A855F7'
const PINK = '#EC4899'
const MAGENTA = '#D946EF'

/** Near-white brand ink — text, and the base for light-on-dark washes. */
const PAPER_INK = '#F5F2FA'

/**
 * Brand gradient token. Reserved for hero accents, primary CTAs, the logo, and
 * small highlights — never wash whole surfaces in it.
 */
export const brandGradient = `linear-gradient(135deg, ${PURPLE} 0%, ${PINK} 100%)`

/**
 * Same stops as `brandGradient`, named for the animated treatment: pair it with
 * `background-size: 200% 200%` and the `bb-gradient-shift` keyframes from
 * src/styles/global.css (or the `.bb-gradient-text` / `.bb-gradient-border`
 * utilities, which already do). Two stops plus a 0% → 100% → 0% ping-pong give
 * a seamless loop with no visible seam.
 */
export const brandGradientAnimated = `linear-gradient(135deg, ${PURPLE} 0%, ${PINK} 100%)`

/** Neon glow shadows — interactive emphasis only, never behind body text. */
export const glowPurple = '0 0 24px rgba(168, 85, 247, 0.35)'
export const glowPink = '0 0 24px rgba(236, 72, 153, 0.30)'

/** Dark glassmorphism surface pair — mirrors --bb-glass-bg / --bb-glass-border. */
export const glassBg = 'rgba(255, 255, 255, 0.04)'
export const glassBorder = 'rgba(236, 72, 153, 0.14)'

export const palette = {
  mode: 'dark',
  primary: {
    // Purple scale. `lighter` is the chip/selection tint and `surface` the faint
    // wash for tinted panels. Both are alpha washes rather than flat hex so they
    // composite correctly over all three surfaces (a fixed tint that reads right
    // on #0B0710 reads wrong on #1D1530).
    main: PURPLE,
    light: '#C084FC',
    dark: '#7C3AED',
    lighter: alpha(PURPLE, 0.14),
    surface: alpha(PURPLE, 0.07),
    contrastText: '#FFFFFF',
  },
  secondary: {
    // Pink scale, same shape as primary.
    main: PINK,
    light: '#F472B6',
    dark: '#BE185D',
    lighter: alpha(PINK, 0.14),
    surface: alpha(PINK, 0.07),
    contrastText: '#FFFFFF',
  },
  // Magenta — the third brand hue, sitting between purple and pink. Reserved
  // for accents that need to read as brand without repeating either CTA colour
  // (badges, glow blobs, gradient mid-stops). Not a MUI-augmented colour, so it
  // is addressed as `theme.palette.accent.main` rather than `color="accent"`.
  accent: {
    main: MAGENTA,
    light: '#E879F9',
    dark: '#A21CAF',
    lighter: alpha(MAGENTA, 0.14),
    surface: alpha(MAGENTA, 0.07),
    contrastText: '#FFFFFF',
  },
  // Semantic colours, dark-tuned. The `main` values are the locked tokens and
  // are what fills a chip dot, an icon, or a progress bar.
  //
  // `dark` keeps the role it had in the light theme — *the shade text uses* —
  // which on a dark surface means one step **brighter**, not darker. That is
  // deliberate: ~40 call sites already say `color: 'success.dark'` for a money
  // figure or `color: 'warning.dark'` for a caution caption, and the token
  // carries the flip so none of them has to. Measured on the three surfaces:
  //
  //   token     dark       on default   on paper   on elevated
  //   success   #10B981       7.87         7.35        6.89
  //   warning   #F59E0B       9.29         8.68        8.13
  //   error     #EF4444       5.30         4.95        4.64
  //   info      #0EA5E9       7.20         6.72        6.30
  //
  // `light` is the text shade for tinted fills (Chip, Alert) — see `softTone`
  // in ./components.js — and clears 8:1 on its own 14% wash.
  success: { main: '#34D399', light: '#6EE7B7', dark: '#10B981', contrastText: '#0B0710' },
  warning: { main: '#FBBF24', light: '#FCD34D', dark: '#F59E0B', contrastText: '#0B0710' },
  error: { main: '#F87171', light: '#FCA5A5', dark: '#EF4444', contrastText: '#0B0710' },
  info: { main: '#38BDF8', light: '#7DD3FC', dark: '#0EA5E9', contrastText: '#0B0710' },
  background: {
    /** Page — near-black plum. */
    default: '#0B0710',
    /** Base surface: app bar, footer, sticky bars, inputs' parent panels. */
    paper: '#151020',
    /**
     * Raised surface: cards, dialogs, drawers, menus. Not a MUI-standard key,
     * so read it as `theme.palette.background.elevated`.
     */
    elevated: '#1D1530',
    /** Recessed surface: the filled background behind every text field. */
    input: '#171126',
    /** Modal scrim — sits under dialogs, drawers, and the media lightbox. */
    backdrop: 'rgba(6, 3, 10, 0.7)',
  },
  text: {
    primary: PAPER_INK,
    secondary: '#B8AECB',
    disabled: '#6E6486',
  },
  divider: '#2A2140',
  action: {
    // Light-on-dark interaction washes: on a near-black base the ink-based
    // tints of the light theme would be invisible, so hover/selected lift the
    // surface toward the paper ink instead of darkening it.
    active: alpha(PAPER_INK, 0.62),
    hover: alpha(PAPER_INK, 0.06),
    hoverOpacity: 0.06,
    selected: alpha(PAPER_INK, 0.1),
    selectedOpacity: 0.1,
    disabled: alpha(PAPER_INK, 0.32),
    disabledBackground: alpha(PAPER_INK, 0.1),
    focus: alpha(PURPLE, 0.24),
    focusOpacity: 0.24,
  },
}

export default palette
