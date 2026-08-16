import { alpha } from '@mui/material/styles'

import { brandGradient } from './palette'
import { cssEasing, durations } from './motionTokens'

// MUI component overrides — prompts/00-architecture-and-rules.md §6.
// styleOverrides callbacks receive the fully-built theme, so they can read the
// augmented palette (e.g. semantic `dark` shades) and `theme.customShadows`.

const focusRing = (theme) => ({
  outline: `2px solid ${theme.palette.primary.main}`,
  outlineOffset: 2,
})

// Soft tint pairs used by Chip + Alert: brand colors use their locked tints,
// semantic colors use an alpha wash with the augmented dark shade for text.
const softTone = (theme, colorKey) => {
  const color = theme.palette[colorKey]
  if (colorKey === 'primary' || colorKey === 'secondary') {
    return { backgroundColor: color.lighter, color: color.dark }
  }
  return { backgroundColor: alpha(color.main, 0.12), color: color.dark }
}

const liftTransition = `transform ${durations.fast}ms ${cssEasing}, box-shadow ${durations.fast}ms ${cssEasing}, background-color ${durations.fast}ms ${cssEasing}, border-color ${durations.fast}ms ${cssEasing}`

// Hover lift ≤ 2px, disabled for prefers-reduced-motion users.
const hoverLift = (theme) => ({
  transition: liftTransition,
  '&:hover': {
    transform: 'translateY(-1px)',
    boxShadow: theme.customShadows.z2,
  },
  '&:active': { transform: 'translateY(0)' },
  '@media (prefers-reduced-motion: reduce)': {
    '&:hover, &:active': { transform: 'none' },
  },
})

export const components = {
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
        // Custom `variant="gradient"` — the one sanctioned gradient CTA.
        ...(ownerState.variant === 'gradient' && {
          color: theme.palette.primary.contrastText,
          backgroundImage: brandGradient,
          ...hoverLift(theme),
          '&.Mui-disabled': {
            color: theme.palette.primary.contrastText,
            backgroundImage: brandGradient,
            opacity: 0.45,
          },
        }),
      }),
      contained: ({ theme }) => hoverLift(theme),
      outlined: ({ theme }) => ({
        '&:hover': { backgroundColor: theme.palette.primary.surface },
      }),
      text: ({ theme }) => ({
        '&:hover': { backgroundColor: theme.palette.primary.surface },
      }),
      sizeSmall: { minHeight: 38, padding: '6px 14px', fontSize: '0.875rem' },
      sizeMedium: { minHeight: 44, padding: '9px 20px' },
      sizeLarge: { minHeight: 52, padding: '13px 28px', fontSize: '1rem' },
    },
  },

  MuiCard: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: 16,
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: theme.customShadows.z1,
        backgroundImage: 'none',
      }),
    },
  },

  MuiPaper: {
    styleOverrides: {
      // Kill MUI's dark-mode elevation overlay so paper stays a flat surface.
      root: { backgroundImage: 'none' },
    },
  },

  MuiOutlinedInput: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: 10,
        backgroundColor: theme.palette.background.paper,
        transition: liftTransition,
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: theme.palette.divider,
          transition: `border-color ${durations.fast}ms ${cssEasing}`,
        },
        '&:hover:not(.Mui-disabled):not(.Mui-focused) .MuiOutlinedInput-notchedOutline':
          {
            borderColor: theme.palette.primary.light,
          },
        // Comfortable touch height: dense inputs still reach 44px.
        '&.MuiInputBase-sizeSmall': { minHeight: 44 },
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
              opacity: 0.55,
              '&:hover': { color: 'currentColor', opacity: 1 },
            },
          }),
        ...(ownerState.variant === 'filled' &&
          ownerState.color === 'default' && {
            backgroundColor: alpha(theme.palette.text.primary, 0.06),
            color: theme.palette.text.primary,
          }),
      }),
    },
  },

  MuiDialog: {
    styleOverrides: {
      paper: ({ theme }) => ({
        borderRadius: 20,
        boxShadow: theme.customShadows.z3,
        '&.MuiDialog-paperFullScreen': { borderRadius: 0 },
      }),
    },
  },

  MuiTabs: {
    styleOverrides: {
      root: { minHeight: 44 },
      // Pill indicator: a full-height soft tint behind the active tab.
      indicator: ({ theme }) => ({
        height: '100%',
        borderRadius: 999,
        backgroundColor: theme.palette.primary.lighter,
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
        '&.Mui-selected': { color: theme.palette.primary.dark },
      }),
    },
  },

  MuiTooltip: {
    styleOverrides: {
      tooltip: ({ theme }) => ({
        backgroundColor: theme.palette.text.primary,
        color: theme.palette.common.white,
        borderRadius: 8,
        padding: '6px 10px',
        fontSize: '0.75rem',
        fontWeight: 500,
      }),
      arrow: ({ theme }) => ({ color: theme.palette.text.primary }),
    },
  },

  MuiSkeleton: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        '&.MuiSkeleton-circular': { borderRadius: '50%' },
      },
    },
  },

  MuiAppBar: {
    defaultProps: { elevation: 0, color: 'inherit' },
    styleOverrides: {
      // Neutral, blurless app bar on a plain paper surface.
      root: ({ theme }) => ({
        backgroundColor: theme.palette.background.paper,
        color: theme.palette.text.primary,
        borderBottom: `1px solid ${theme.palette.divider}`,
        boxShadow: 'none',
        backdropFilter: 'none',
      }),
    },
  },

  MuiTableCell: {
    styleOverrides: {
      root: ({ theme }) => ({ borderColor: theme.palette.divider }),
      head: ({ theme }) => ({
        fontWeight: 600,
        fontSize: '0.8125rem',
        lineHeight: 1.4,
        color: theme.palette.text.secondary,
        backgroundColor: theme.palette.background.default,
      }),
    },
  },

  MuiAlert: {
    styleOverrides: {
      root: { borderRadius: 12 },
      standardSuccess: ({ theme }) => softTone(theme, 'success'),
      standardWarning: ({ theme }) => softTone(theme, 'warning'),
      standardError: ({ theme }) => softTone(theme, 'error'),
      standardInfo: ({ theme }) => softTone(theme, 'info'),
    },
  },

  MuiSnackbarContent: {
    styleOverrides: {
      // Inverse "ink" surface so toasts read above any page.
      root: ({ theme }) => ({
        backgroundColor: theme.palette.text.primary,
        color: theme.palette.common.white,
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
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: theme.customShadows.z2,
        marginTop: 4,
      }),
      list: { padding: 6 },
    },
  },

  MuiMenuItem: {
    styleOverrides: {
      root: { borderRadius: 8, minHeight: 40, fontSize: '0.875rem' },
    },
  },
}
