import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'

import { formatCurrency } from '@/utils/formatters'

import {
  CONTENT_TYPE_OPTIONS,
  CREATOR_PARAM,
  PRICE_RANGE,
  readPriceRange,
} from '../utils/creatorFilters'

// What is currently narrowing the results, and one click to undo any of it.
//
// On mobile this row is the only place the active filters are visible at all —
// the rest of the form lives behind the sheet — so it doubles as the summary
// and the escape hatch, and it scrolls horizontally rather than stacking into a
// wall of chips.

const money = (value) => formatCurrency(value, undefined, { hideDecimals: true })

/** Human phrasing for whichever end(s) of the price slider actually moved. */
function priceChipLabel(low, high) {
  if (low > PRICE_RANGE.min && high < PRICE_RANGE.max) return `${money(low)} – ${money(high)}`
  if (low > PRICE_RANGE.min) return `${money(low)}+`
  return `Up to ${money(high)}`
}

/**
 * Builds the chip list from parsed values. Every entry knows how to remove
 * itself, so the row stays a dumb `map`.
 */
function buildChips(values, { categoryNames, onChange }) {
  const chips = []

  const search = values[CREATOR_PARAM.SEARCH]
  if (search) {
    chips.push({
      key: CREATOR_PARAM.SEARCH,
      label: `“${search}”`,
      onDelete: () => onChange({ [CREATOR_PARAM.SEARCH]: '' }),
    })
  }

  values[CREATOR_PARAM.CATEGORY].forEach((categoryId) => {
    chips.push({
      key: `${CREATOR_PARAM.CATEGORY}-${categoryId}`,
      label: categoryNames[categoryId] ?? categoryId,
      onDelete: () =>
        onChange({
          [CREATOR_PARAM.CATEGORY]: values[CREATOR_PARAM.CATEGORY].filter(
            (id) => id !== categoryId
          ),
        }),
    })
  })

  values[CREATOR_PARAM.CONTENT_TYPE].forEach((type) => {
    const option = CONTENT_TYPE_OPTIONS.find((entry) => entry.value === type)
    chips.push({
      key: `${CREATOR_PARAM.CONTENT_TYPE}-${type}`,
      label: option?.label ?? type,
      onDelete: () =>
        onChange({
          [CREATOR_PARAM.CONTENT_TYPE]: values[CREATOR_PARAM.CONTENT_TYPE].filter(
            (entry) => entry !== type
          ),
        }),
    })
  })

  const [low, high] = readPriceRange(values)
  if (low > PRICE_RANGE.min || high < PRICE_RANGE.max) {
    chips.push({
      key: 'price',
      label: priceChipLabel(low, high),
      onDelete: () =>
        onChange({
          [CREATOR_PARAM.PRICE_MIN]: PRICE_RANGE.min,
          [CREATOR_PARAM.PRICE_MAX]: PRICE_RANGE.max,
        }),
    })
  }

  const rating = values[CREATOR_PARAM.RATING]
  if (rating !== null) {
    chips.push({
      key: CREATOR_PARAM.RATING,
      label: `${rating.toFixed(1)}+ rating`,
      onDelete: () => onChange({ [CREATOR_PARAM.RATING]: null }),
    })
  }

  // Only worth a chip when it is *off*, because on is the default state.
  if (!values[CREATOR_PARAM.AVAILABLE]) {
    chips.push({
      key: CREATOR_PARAM.AVAILABLE,
      label: 'Including unavailable',
      onDelete: () => onChange({ [CREATOR_PARAM.AVAILABLE]: true }),
    })
  }

  return chips
}

/**
 * @param {object} props
 * @param {object} props.values parsed discovery values
 * @param {(patch: object) => void} props.onChange reports changed parameters
 * @param {() => void} props.onClear reset every filter
 * @param {Object<string, string>} [props.categoryNames] category id → display name
 * @param {object} [props.sx] MUI system styles
 */
export default function ActiveFilterChips({
  values,
  onChange,
  onClear,
  categoryNames = {},
  sx,
}) {
  const chips = buildChips(values, { categoryNames, onChange })
  if (chips.length === 0) return null

  return (
    <Box
      role="group"
      aria-label="Active filters"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        flexWrap: { xs: 'nowrap', md: 'wrap' },
        overflowX: { xs: 'auto', md: 'visible' },
        // Room for the focus ring, which would otherwise clip in the scroller.
        px: 0.25,
        mx: -0.25,
        py: 0.5,
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
        ...sx,
      }}
    >
      {chips.map((chip) => (
        <Chip
          key={chip.key}
          label={chip.label}
          // The chip is the remove control (MUI makes it a focusable button
          // that responds to Backspace), so it announces the action, not just
          // the value it carries.
          aria-label={`Remove filter: ${chip.label}`}
          onDelete={chip.onDelete}
          deleteIcon={<Icon icon="tabler:x" width={16} aria-hidden="true" />}
          size="small"
          variant="outlined"
          sx={{ flexShrink: 0, borderRadius: 999 }}
        />
      ))}

      <Button
        variant="text"
        size="small"
        onClick={onClear}
        sx={{ flexShrink: 0, minHeight: 32 }}
      >
        Clear all
      </Button>
    </Box>
  )
}
