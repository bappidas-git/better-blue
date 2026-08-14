import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Rating from '@mui/material/Rating'
import Typography from '@mui/material/Typography'

import { formatNumber } from '@/utils/formatters'

// Review rating in both of its jobs: read-only display (creator cards,
// profiles, order history) and input (leaving a review). MUI's Rating gives us
// native radio semantics and arrow-key support; this wrapper adds the tone, the
// half-star display default, and the review count.

const SIZES = { sm: 'small', md: 'medium', lg: 'large' }

/**
 * @param {object} props
 * @param {number} props.value current rating, 0–`max`
 * @param {(value: number|null) => void} [props.onChange] provide to switch to input mode
 * @param {number} [props.count] number of reviews, rendered as "(128)"
 * @param {boolean} [props.showValue] print the numeric value beside the stars —
 *   defaults to true in display mode
 * @param {'sm'|'md'|'lg'} [props.size='md'] star size
 * @param {number} [props.precision] rating step — 0.5 for display, 1 for input by default
 * @param {number} [props.max=5] number of stars
 * @param {string} [props.label='Rating'] accessible group label in input mode
 * @param {boolean} [props.disabled=false] disable input mode
 */
export default function RatingStars({
  value = 0,
  onChange,
  count,
  showValue,
  size = 'md',
  precision,
  max = 5,
  label = 'Rating',
  disabled = false,
  sx,
  ...rest
}) {
  const isInput = typeof onChange === 'function'
  const step = precision ?? (isInput ? 1 : 0.5)
  const numericValue = Number(value) || 0
  const withValue = showValue ?? !isInput

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, ...sx }} {...rest}>
      <Rating
        value={numericValue}
        onChange={isInput ? (event, next) => onChange(next) : undefined}
        readOnly={!isInput}
        disabled={disabled}
        precision={step}
        max={max}
        size={SIZES[size] ?? 'medium'}
        icon={<Icon icon="tabler:star-filled" />}
        emptyIcon={<Icon icon="tabler:star" />}
        // MUI marks read-only ratings as role="img"; interactive ones are a set
        // of radios that still need an explicit group name for assistive tech.
        {...(isInput ? { role: 'radiogroup', 'aria-label': label } : null)}
        sx={{
          color: 'warning.main',
          '& .MuiRating-iconEmpty': { color: 'divider' },
          '& .MuiRating-iconHover': { color: 'warning.dark' },
          // Iconify renders an unsized placeholder until icon data arrives.
          // Without an explicit box the stars — and the radio targets behind
          // them — collapse to 0×0 on a slow or blocked icon fetch.
          '& .MuiRating-icon': { width: '1em', height: '1em' },
          '& .MuiRating-icon > *': { display: 'block', width: '1em', height: '1em' },
        }}
      />

      {withValue ? (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {numericValue.toFixed(1)}
        </Typography>
      ) : null}

      {count !== undefined ? (
        <Typography variant="body2" color="text.secondary">
          ({formatNumber(count)})
        </Typography>
      ) : null}
    </Box>
  )
}
