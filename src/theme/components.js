import { alpha } from '@mui/material/styles'

import { brandGradient, glassBorder } from './palette'
import { cssEasing, durations } from './motionTokens'

// MUI component overrides — the Storefront V2 dark sweep (docs/theme-v2.md).
// styleOverrides callbacks receive the fully-built theme, so they can read the
// augmented palette (semantic `light`/`dark` shades, `background.elevated`) and
// `theme.customShadows`, including the glow tokens.
//
// Surface hierarchy, applied consistently below:
//   background.default  #0B0710  the page
//   background.paper    #151020  base panels, app bar, footer, table bodies
//   background.elevated #1D1530  cards, dialogs, drawers, menus, table headers
//
// Edge rule: a *container* edge (card, dialog, menu, outlined paper) is the
// pink-tinted `glassBorder`; a *content* rule (Divider, table cell, section
// separator) stays `palette.divider`.

/** Card/tile hover duration — Prompt V2-01 asks for 200ms on the lift. */
const LIFT_MS = 200

const focusRing = (theme) => ({
  // primary.light rather than primary.main: #C084FC clears 6.6:1 against even
  // the elevated surface, so the ring is unmissable on every dark background.
  outline: `2px solid ${theme.palette.primary.light}`,
  outlineOffset: 2,
})

/**
 * Soft tint pairs used by Chip and Alert. On dark the wash is an alpha tint of
 * the hue at ~14% and the label is the *light* shade — the light theme's
 * "darkened text on a pale tint" inverts to "brightened text on a dark tint".
 * Every pair below clears 5.7:1 (brand) / 8:1 (semantic) on its own wash.
 */
const softTone = (theme, colorKey) => {
  const color = theme.palette[colorKey]
  return {
    backgroundColor: alpha(color.main, 0.14),
    color: color.light,
  }
}

const liftTransition = `transform ${durations.fast}ms ${cssEasing}, box-shadow ${durations.fast}ms ${cssEasing}, background-color ${durations.fast}ms ${cssEasing}, border-color ${durations.fast}ms ${cssEasing}`

const cardTransition = `transform ${LIFT_MS}ms ${cssEasing}, box-shadow ${LIFT_MS}ms ${cssEasing}, border-color ${LIFT_MS}ms ${cssEasing}`

// Hover lift for buttons — 1px, plus a brand glow instead of the light theme's
// ink shadow. Transform/opacity/shadow only, and switched off for anyone who
// asked for reduced motion.
const hoverLift = (theme, glow = theme.customShadows.glowPurple) => ({
  transition: liftTransition,
  '&:hover': {
    transform: 'translateY(-1px)',
    boxShadow: `${theme.customShadows.z2}, ${glow}`,
  },
  '&:active': { transform: 'translateY(0)' },
  '@media (prefers-reduced-motion: reduce)': {
    '&:hover, &:active': { transform: 'none' },
  },
})

export const components = {
  MuiCssBaseline: {
    styleOverrides: {
      // Tells the browser to render native widgets (scrollbars, date pickers,
      // autofill, form controls) in their dark variants. Without it Chrome
      // paints a white autofill block straight through the theme.
      ':root': { colorScheme: 'dark' },
    },
  },

  // MUI's default `variantMapping` renders `subtitle1` and `subtitle2` as
  // `<h6>` elements. Those two variants are used all over this app for visual
  // subtitles — a card's second line, a field group's caption, a chip's label —
  // and every one of them was landing in the document outline as a heading,
  // producing stray `<h6>`s and heading-level jumps like `h1 → h3 → h6`
  // (00 §13: "heading hierarchy"). Found by the Prompt 37 accessibility sweep:
  // 60 occurrences across 29 files.
  //
  // Fixing it here rather than at 60 call sites keeps the rule in one place and
  // catches every future use. Nothing visual changes — the type scale comes
  // from `variant`, not from the element. Anything that genuinely *is* a
  // heading already says so with an explicit `component="h2"`/`"h3"`, which
  // still wins: `variantMapping` is only the fallback.
  MuiTypography: {
    defaultProps: {
      variantMapping: {
        subtitle1: 'p',
        subtitle2: 'p',
      },
    },
  },

  MuiButtonBase: {
    styleOverrides: {
      // ButtonBase sets `outline: 0`, so the keyboard focus ring must be
      // restored here for every button-derived component.
      root: ({ theme }) => ({
        '&.Mui-focusVisible': focusRing(theme),
      }),
    },
  },

  MuiButton: {
    defaultProps: { disableElevation: true },
    styleOverrides: {
      root: ({ theme, ownerState }) => ({
        borderRadius: 10,
        fontWeight: 600,
        transition: liftTransition,
        // Custom `variant="gradient"` — the one sanctioned gradient CTA. On
        // dark it carries a resting purple halo, and both glows once hovered
        // or focused, which is the whole "neon but restrained" idea.
        ...(ownerState.variant === 'gradient' && {
          color: theme.palette.primary.contrastText,
          backgroundImage: brandGradient,
          boxShadow: theme.customShadows.glowPurple,
          ...hoverLift(theme, theme.customShadows.glowBrand),
          '&.Mui-focusVisible': {
            ...focusRing(theme),
            boxShadow: theme.customShadows.glowBrand,
          },
          '&.Mui-disabled': {
            color: theme.palette.primary.contrastText,
            backgroundImage: brandGradient,
            boxShadow: 'none',
            opacity: 0.4,
          },
        }),
      }),
      contained: ({ theme }) => hoverLift(theme),
      // White on #A855F7 measures 3.96:1 — AA-large only, and a button label at
      // 15px/600 is not large text. The saturated purple stays the brand colour
      // everywhere it is *not* carrying text (gradient CTA, icons, dots, glows);
      // a solid button resting on `dark` reads 5.70:1 and its hover energy comes
      // from the glow rather than from a colour change, so every state passes.
      containedPrimary: ({ theme }) => ({
        backgroundColor: theme.palette.primary.dark,
        '&:hover': { backgroundColor: theme.palette.primary.dark },
      }),
      containedSecondary: ({ theme }) => ({
        backgroundColor: theme.palette.secondary.dark,
        '&:hover': { backgroundColor: theme.palette.secondary.dark },
      }),
      outlined: ({ theme }) => ({
        borderColor: alpha(theme.palette.primary.main, 0.42),
        color: theme.palette.primary.light,
        '&:hover': {
          borderColor: theme.palette.primary.light,
          backgroundColor: theme.palette.primary.surface,
        },
      }),
      outlinedInherit: {
        // `color="inherit"` outlined buttons opt out of the purple treatment.
        borderColor: 'currentColor',
        color: 'inherit',
      },
      text: ({ theme }) => ({
        '&:hover': { backgroundColor: theme.palette.primary.surface },
      }),
      textPrimary: ({ theme }) => ({ color: theme.palette.primary.light }),
      sizeSmall: { minHeight: 38, padding: '6px 14px', fontSize: '0.875rem' },
      sizeMedium: { minHeight: 44, padding: '9px 20px' },
      sizeLarge: { minHeight: 52, padding: '13px 28px', fontSize: '1rem' },
    },
  },

  MuiCard: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: 16,
        backgroundColor: theme.palette.background.elevated,
        border: `1px solid ${glassBorder}`,
        boxShadow: theme.customShadows.z1,
        backgroundImage: 'none',
        transition: cardTransition,
        // Interactive cards only: a card is interactive when it owns a
        // CardActionArea, which is this codebase's convention for "the whole
        // tile is a link". `:has()` keeps the rule declarative — no call site
        // has to opt in, and browsers without it simply get no lift.
        '&:has(.MuiCardActionArea-root):hover': {
          transform: 'translateY(-3px)',
          borderColor: alpha(theme.palette.secondary.main, 0.32),
          boxShadow: theme.customShadows.cardHover,
        },
        '@media (prefers-reduced-motion: reduce)': {
          '&:has(.MuiCardActionArea-root):hover': { transform: 'none' },
        },
      }),
    },
  },

  MuiPaper: {
    styleOverrides: {
      // Kill MUI's dark-mode elevation overlay so paper stays a flat surface —
      // the three background tokens carry the hierarchy instead.
      root: { backgroundImage: 'none' },
      outlined: ({ theme }) => ({
        borderColor: glassBorder,
        backgroundColor: theme.palette.background.paper,
      }),
    },
  },

  MuiOutlinedInput: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: 10,
        // A filled, recessed field rather than paper: on dark, an outline alone
        // is too quiet to find, so the field reads as a well in the surface.
        backgroundColor: theme.palette.background.input,
        transition: liftTransition,
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: theme.palette.divider,
          transition: `border-color ${durations.fast}ms ${cssEasing}`,
        },
        '&:hover:not(.Mui-disabled):not(.Mui-focused) .MuiOutlinedInput-notchedOutline':
          {
            borderColor: alpha(theme.palette.primary.light, 0.55),
          },
        '&.Mui-focused': {
          boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.22)}`,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: theme.palette.primary.main,
          },
        },
        '&.Mui-error.Mui-focused': {
          boxShadow: `0 0 0 3px ${alpha(theme.palette.error.main, 0.22)}`,
        },
        '&.Mui-disabled': {
          backgroundColor: alpha(theme.palette.background.input, 0.6),
        },
        // Comfortable touch height: dense inputs still reach 44px.
        '&.MuiInputBase-sizeSmall': { minHeight: 44 },
      }),
      input: ({ theme }) => ({
        '&::placeholder': { color: theme.palette.text.secondary, opacity: 0.72 },
      }),
    },
  },

  MuiInputLabel: {
    styleOverrides: {
      root: ({ theme }) => ({
        color: theme.palette.text.secondary,
        '&.Mui-focused': { color: theme.palette.primary.light },
      }),
    },
  },

  MuiChip: {
    styleOverrides: {
      root: ({ theme, ownerState }) => ({
        borderRadius: 999,
        fontWeight: 600,
        // Soft tinted fills instead of MUI's saturated solids.
        ...(ownerState.variant === 'filled' &&
          ownerState.color !== 'default' && {
            ...softTone(theme, ownerState.color),
            '& .MuiChip-deleteIcon': {
              color: 'currentColor',
              opacity: 0.6,
              '&:hover': { color: 'currentColor', opacity: 1 },
            },
          }),
        ...(ownerState.variant === 'filled' &&
          ownerState.color === 'default' && {
            backgroundColor: alpha(theme.palette.text.primary, 0.09),
            color: theme.palette.text.primary,
          }),
        ...(ownerState.variant === 'outlined' &&
          ownerState.color === 'default' && {
            borderColor: theme.palette.divider,
            color: theme.palette.text.secondary,
          }),
        // Outlined chips take the same `light` label as the filled ones —
        // `primary.main` reads 4.41:1 on the elevated surface, just under AA,
        // and an outlined chip has no wash of its own to sit on.
        ...(ownerState.variant === 'outlined' &&
          ownerState.color !== 'default' && {
            color: theme.palette[ownerState.color].light,
            borderColor: alpha(theme.palette[ownerState.color].main, 0.5),
          }),
      }),
    },
  },

  MuiLink: {
    styleOverrides: {
      // A link is body text, and body text is where `primary.main` runs out of
      // contrast on the elevated surface (4.41:1). The default `color="primary"`
      // therefore resolves to the light shade; `color="inherit"` and explicit
      // palette paths are left alone.
      root: ({ theme, ownerState }) => ({
        ...(ownerState.color === 'primary' && {
          color: theme.palette.primary.light,
          textDecorationColor: alpha(theme.palette.primary.light, 0.4),
        }),
      }),
    },
  },

  MuiBackdrop: {
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundColor: theme.palette.background.backdrop,
        backdropFilter: 'blur(4px)',
        '&.MuiBackdrop-invisible': {
          backgroundColor: 'transparent',
          backdropFilter: 'none',
        },
      }),
    },
  },

  MuiDialog: {
    styleOverrides: {
      paper: ({ theme }) => ({
        borderRadius: 20,
        backgroundColor: theme.palette.background.elevated,
        border: `1px solid ${glassBorder}`,
        boxShadow: theme.customShadows.z3,
        backgroundImage: 'none',
        '&.MuiDialog-paperFullScreen': { borderRadius: 0, border: 'none' },
      }),
    },
  },

  MuiDrawer: {
    styleOverrides: {
      paper: ({ theme }) => ({
        backgroundColor: theme.palette.background.elevated,
        backgroundImage: 'none',
        borderColor: glassBorder,
      }),
    },
  },

  MuiTabs: {
    styleOverrides: {
      root: { minHeight: 44 },
      // Pill indicator: a full-height gradient wash behind the active tab. The
      // wash is the brand gradient at 28% rather than neat — at full saturation
      // a label sitting on it would only reach ~3.5:1.
      indicator: ({ theme }) => ({
        height: '100%',
        borderRadius: 999,
        backgroundColor: 'transparent',
        backgroundImage: `linear-gradient(135deg, ${alpha(
          theme.palette.primary.main,
          0.28
        )} 0%, ${alpha(theme.palette.secondary.main, 0.28)} 100%)`,
        boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.32)}`,
        zIndex: 0,
      }),
    },
  },

  MuiTab: {
    styleOverrides: {
      root: ({ theme }) => ({
        minHeight: 44,
        borderRadius: 999,
        paddingInline: 20,
        fontWeight: 600,
        zIndex: 1,
        color: theme.palette.text.secondary,
        '&:hover': { color: theme.palette.text.primary },
        '&.Mui-selected': { color: theme.palette.text.primary, fontWeight: 700 },
      }),
    },
  },

  MuiTooltip: {
    styleOverrides: {
      // The light theme's ink tooltip inverts on dark: an ink surface would now
      // be *lighter* than the page. This is an elevated chip of surface with a
      // hairline, which reads at 15.8:1.
      tooltip: ({ theme }) => ({
        backgroundColor: theme.palette.background.elevated,
        color: theme.palette.text.primary,
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: theme.customShadows.z2,
        borderRadius: 8,
        padding: '6px 10px',
        fontSize: '0.75rem',
        fontWeight: 500,
      }),
      arrow: ({ theme }) => ({
        color: theme.palette.background.elevated,
        '&::before': { border: `1px solid ${theme.palette.divider}` },
      }),
    },
  },

  MuiSkeleton: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: 8,
        backgroundColor: alpha(theme.palette.text.primary, 0.07),
        '&.MuiSkeleton-circular': { borderRadius: '50%' },
        // Dark shimmer: a faint light sweep instead of MUI's white-on-white.
        '&::after': {
          background: `linear-gradient(90deg, transparent, ${alpha(
            theme.palette.text.primary,
            0.08
          )}, transparent)`,
        },
      }),
    },
  },

  MuiAppBar: {
    defaultProps: { elevation: 0, color: 'inherit' },
    styleOverrides: {
      // Translucent near-black over a blur, so content scrolling underneath is
      // felt rather than seen.
      root: ({ theme }) => ({
        backgroundColor: alpha(theme.palette.background.default, 0.8),
        backgroundImage: 'none',
        color: theme.palette.text.primary,
        borderBottom: `1px solid ${theme.palette.divider}`,
        boxShadow: 'none',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }),
    },
  },

  MuiTableCell: {
    styleOverrides: {
      root: ({ theme }) => ({ borderColor: theme.palette.divider }),
      // Opaque on purpose: DataTable renders a sticky header, and a translucent
      // wash would let the rows scroll through it.
      head: ({ theme }) => ({
        fontWeight: 600,
        fontSize: '0.8125rem',
        lineHeight: 1.4,
        color: theme.palette.text.secondary,
        backgroundColor: theme.palette.background.elevated,
      }),
    },
  },

  MuiTableRow: {
    styleOverrides: {
      root: ({ theme }) => ({
        '&.MuiTableRow-hover:hover': {
          backgroundColor: alpha(theme.palette.primary.main, 0.07),
        },
      }),
    },
  },

  MuiAlert: {
    styleOverrides: {
      root: { borderRadius: 12 },
      // The icon inherits the label's light shade so an alert is one colour.
      icon: { color: 'inherit' },
      standardSuccess: ({ theme }) => softTone(theme, 'success'),
      standardWarning: ({ theme }) => softTone(theme, 'warning'),
      standardError: ({ theme }) => softTone(theme, 'error'),
      standardInfo: ({ theme }) => softTone(theme, 'info'),
    },
  },

  MuiSnackbarContent: {
    styleOverrides: {
      // Inverse surface so a toast reads above any page — which on a dark
      // theme means a *light* chip with ink text (18:1).
      root: ({ theme }) => ({
        backgroundColor: theme.palette.text.primary,
        color: theme.palette.background.default,
        borderRadius: 12,
        boxShadow: theme.customShadows.z3,
        fontWeight: 500,
      }),
    },
  },

  MuiMenu: {
    styleOverrides: {
      paper: ({ theme }) => ({
        borderRadius: 12,
        backgroundColor: theme.palette.background.elevated,
        backgroundImage: 'none',
        border: `1px solid ${glassBorder}`,
        boxShadow: theme.customShadows.z2,
        marginTop: 4,
      }),
      list: { padding: 6 },
    },
  },

  MuiPopover: {
    styleOverrides: {
      paper: ({ theme }) => ({
        borderRadius: 12,
        backgroundColor: theme.palette.background.elevated,
        backgroundImage: 'none',
        border: `1px solid ${glassBorder}`,
        boxShadow: theme.customShadows.z2,
      }),
    },
  },

  MuiMenuItem: {
    styleOverrides: {
      root: { borderRadius: 8, minHeight: 40, fontSize: '0.875rem' },
    },
  },

  MuiAvatar: {
    styleOverrides: {
      // MUI's dark default is a flat grey disc; the brand tint keeps generated
      // initials on-palette when no image resolves.
      root: ({ theme }) => ({
        backgroundColor: alpha(theme.palette.primary.main, 0.16),
        color: theme.palette.primary.light,
      }),
    },
  },

  MuiLinearProgress: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: 999,
        backgroundColor: alpha(theme.palette.text.primary, 0.1),
      }),
      bar: { borderRadius: 999 },
    },
  },
}
