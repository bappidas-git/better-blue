import { useId } from 'react'

import Box from '@mui/material/Box'

import { palette } from '@/theme/palette'
import { headingFontFamily } from '@/theme/typography'

// Temporary BetterBlue logo — a gradient monogram tile with an abstract "B"
// (two stacked rounded forms) plus the wordmark. Deliberately self-contained:
// replacing the brand later means swapping this component and the two raw
// assets in src/assets/brand/ (favicon derives from the mark).

const MARK_SIZE = 32
const FULL_WIDTH = 158

// Abstract "B": two stacked rounded lobes on a shared left edge.
const TOP_LOBE =
  'M12.2 8H16.6A3.7 3.7 0 0 1 16.6 15.4H12.2A1.2 1.2 0 0 1 11 14.2V9.2A1.2 1.2 0 0 1 12.2 8Z'
const BOTTOM_LOBE =
  'M12.2 16.6H17.4A3.7 3.7 0 0 1 17.4 24H12.2A1.2 1.2 0 0 1 11 22.8V17.8A1.2 1.2 0 0 1 12.2 16.6Z'

/**
 * @param {object} props
 * @param {'full'|'mark'} [props.variant] full = tile + wordmark, mark = tile only
 * @param {number} [props.size] rendered height in px
 * @param {boolean} [props.asLink] wraps the logo in a home link
 */
export default function Logo({ variant = 'full', size = 32, asLink = false }) {
  const gradientId = useId()
  const tileGradient = `${gradientId}-tile`
  const wordGradient = `${gradientId}-word`
  const isMark = variant === 'mark'
  const width = isMark ? size : Math.round(size * (FULL_WIDTH / MARK_SIZE))

  const svg = (
    <svg
      role={asLink ? undefined : 'img'}
      aria-label={asLink ? undefined : 'BetterBlue'}
      aria-hidden={asLink || undefined}
      width={width}
      height={size}
      viewBox={`0 0 ${isMark ? MARK_SIZE : FULL_WIDTH} 32`}
      overflow="visible"
      xmlns="http://www.w3.org/2000/svg"
    >
      {!asLink && <title>BetterBlue</title>}
      <defs>
        <linearGradient
          id={tileGradient}
          x1="0"
          y1="0"
          x2="32"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor={palette.primary.main} />
          <stop offset="1" stopColor={palette.secondary.main} />
        </linearGradient>
        {!isMark && (
          <linearGradient
            id={wordGradient}
            x1="100"
            y1="6"
            x2="158"
            y2="26"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor={palette.primary.main} />
            <stop offset="1" stopColor={palette.secondary.main} />
          </linearGradient>
        )}
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${tileGradient})`} />
      <path d={TOP_LOBE} fill={palette.primary.contrastText} />
      <path d={BOTTOM_LOBE} fill={palette.primary.contrastText} />
      {!isMark && (
        <text
          x="41"
          y="23"
          fontFamily={headingFontFamily}
          fontSize="21"
          fontWeight="700"
          letterSpacing="-0.3"
        >
          <tspan fill={palette.text.primary}>Better</tspan>
          <tspan fill={`url(#${wordGradient})`}>Blue</tspan>
        </text>
      )}
    </svg>
  )

  if (!asLink) return svg

  // Placeholder home link — Prompt 08 re-points this at the router home path
  // from src/routes/paths.js.
  return (
    <Box
      component="a"
      href="/"
      aria-label="BetterBlue — home"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        textDecoration: 'none',
        borderRadius: 1,
      }}
    >
      {svg}
    </Box>
  )
}
