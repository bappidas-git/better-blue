import FilterChipGroup from '@/components/inputs/FilterChipGroup'

import { buildFilterOptions, PORTFOLIO_FILTER } from '../utils/statusFilters'

// The status summary and the filter are the same control.
//
// A creator's first question on this screen is "where does everything stand?"
// and their second is "show me the ones that need me". Two rows — a count
// strip and a filter bar — would answer them separately and disagree the
// moment an action moved an item, so the counts *are* the filters.
//
// `FilterChipGroup` already renders counted chips, scrolls horizontally on a
// phone, and grows its chips to a 44px touch target (00 §13), so this is the
// portfolio's vocabulary on top of it rather than a second chip row.

/**
 * @param {object} props
 * @param {object} props.counts from `summarizePortfolioStatuses`
 * @param {string} props.value the active `PORTFOLIO_FILTER` token
 * @param {(value: string) => void} props.onChange receives the next token
 * @param {object} [props.sx] MUI system styles
 */
export default function StatusSummaryChips({ counts, value, onChange, sx }) {
  const options = buildFilterOptions(counts, value)

  return (
    <FilterChipGroup
      label="Filter portfolio by status"
      options={options}
      value={value}
      // Clicking the active chip clears the filter in `FilterChipGroup`, which
      // here means "back to everything" rather than "no filter at all" — the
      // grid always shows something.
      onChange={(next) => onChange?.(next ?? PORTFOLIO_FILTER.ALL)}
      sx={sx}
    />
  )
}
