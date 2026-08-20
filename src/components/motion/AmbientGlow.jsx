import Box from '@mui/material/Box'
import { alpha } from '@mui/material/styles'

// Ambient brand glow — the soft purple/pink light that sits behind a hero, a
// section header, or an empty state on the dark theme (docs/theme-v2.md §Glow).
//
// Deliberately dumb: two absolutely-positioned radial gradients, no state, no
// JS animation loop, no Framer. The diffusion comes from the gradient's own
// falloff plus one moderate CSS blur — a large `filter: blur()` is the
// expensive part of this effect, so the gradient does most of the work and the
// filter only softens the edge.
//
// It is decoration, so it is `aria-hidden` and `pointer-events: none`, and it
// clips itself to its parent so a blob can never widen the page on a 360px
// screen. The parent must be `position: relative`.

/**
 * Blob positions per placement. Percentages, so a blob keeps its relationship
 * to the box at any width.
 */
const PLACEMENTS = {
  /** Behind a full-bleed hero: one blob high-left, one mid-right. */
  hero: {
    purple: { top: '-22%', left: '-12%' },
    pink: { top: '10%', right: '-16%' },
  },
  /** Behind a section header — both blobs hug the top edge. */
  top: {
    purple: { top: '-40%', left: '4%' },
    pink: { top: '-34%', right: '6%' },
  },
  /** Centred wash, for a panel or an empty state. */
  center: {
    purple: { top: '-10%', left: '-6%' },
    pink: { bottom: '-16%', right: '-8%' },
  },
  /** Lifts the closing band of a page. */
  bottom: {
    purple: { bottom: '-34%', left: '-8%' },
    pink: { bottom: '-28%', right: '-6%' },
  },
}

/** Peak opacity of each blob's core. */
const INTENSITIES = { subtle: 0.22, medium: 0.38, strong: 0.55 }

const DEFAULT_SIZE = 'clamp(240px, 52vw, 640px)'

/**
 * @param {object} props
 * @param {'hero'|'top'|'center'|'bottom'} [props.placement='hero'] where the blobs sit
 * @param {'subtle'|'medium'|'strong'} [props.intensity='medium'] peak opacity
 * @param {string|number} [props.size] blob diameter — any CSS length
 * @param {number} [props.blur=60] edge-softening blur in px
 * @param {object} [props.sx] MUI system styles applied to the clipping layer
 */
export default function AmbientGlow({
  placement = 'hero',
  intensity = 'medium',
  size = DEFAULT_SIZE,
  blur = 60,
  sx,
  ...rest
}) {
  const spots = PLACEMENTS[placement] ?? PLACEMENTS.hero
  const peak = INTENSITIES[intensity] ?? INTENSITIES.medium

  const blob = (position, color) => ({
    content: '""',
    position: 'absolute',
    width: size,
    height: size,
    borderRadius: '50%',
    filter: `blur(${blur}px)`,
    backgroundImage: `radial-gradient(circle at 50% 50%, ${alpha(
      color,
      peak
    )} 0%, ${alpha(color, peak * 0.45)} 38%, ${alpha(color, 0)} 70%)`,
    ...position,
  })

  return (
    <Box
      aria-hidden="true"
      sx={[
        (theme) => ({
          position: 'absolute',
          inset: 0,
          // Clipped so a blob can never push the page wider than the viewport.
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 0,
          '&::before': blob(spots.purple, theme.palette.primary.main),
          '&::after': blob(spots.pink, theme.palette.secondary.main),
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...rest}
    />
  )
}
