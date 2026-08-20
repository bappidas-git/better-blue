import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import FilterChipGroup from '@/components/inputs/FilterChipGroup'
import SortSelect from '@/components/inputs/SortSelect'
import SideSheet from '@/components/layout/SideSheet'
import { formatNumber } from '@/utils/formatters'

import {
  CREATOR_FILTER,
  CREATOR_FILTER_OPTIONS,
  CREATOR_PARAM,
  CREATOR_SORT_OPTIONS,
  FILTER_HINTS,
} from '../utils/creatorFilters'

// The mobile half of the filter bar (V2-09 §2): the whole panel, in a bottom
// sheet, because below `md` the sticky bar has room for a snap-scrolling chip
// row and nothing else.
//
// A **bottom** sheet rather than a side drawer, the pattern V2-07 set: the
// controls belong to the page they are filtering, and a full-screen takeover
// for eight of them reads as a page you have to come back from. `SideSheet`
// supplies the chrome, the focus trap, Escape, and focus return.
//
// The chips are rendered here as well as in the bar — the same
// `FilterChipGroup`, wrapping instead of scrolling, so a phone can see all
// seven at once rather than swiping to find the one it wants. Both copies write
// the same parameter, so they cannot disagree.
//
// Filters commit as they are touched rather than into a draft the footer
// applies later: it is what lets the footer say "Show 6 creators" truthfully,
// and it means dismissing the sheet never silently discards a choice.

/** Rounded top edge, capped height, full width at every breakpoint it opens at. */
const SHEET_PAPER_PROPS = {
  sx: {
    width: '100%',
    maxWidth: '100%',
    maxHeight: '85vh',
    borderRadius: 0,
    borderTopLeftRadius: 'var(--bb-radius-xl)',
    borderTopRightRadius: 'var(--bb-radius-xl)',
    display: 'flex',
    flexDirection: 'column',
  },
}

/** The two chips whose promise is a number worth spelling out. */
const HINTED = [CREATOR_FILTER.TOP_RATED, CREATOR_FILTER.NEW]

/**
 * @param {object} props
 * @param {boolean} props.open whether the sheet is shown
 * @param {() => void} props.onClose close the sheet
 * @param {object} props.values parsed creator values
 * @param {(patch: object) => void} props.onChange reports changed parameters
 * @param {() => void} props.onClear reset every filter to its default
 * @param {boolean} props.isFiltered anything is off its default
 * @param {number} props.total live result count
 * @param {boolean} [props.isLoading=false] the count is being refreshed
 */
export default function CreatorFilterSheet({
  open,
  onClose,
  values,
  onChange,
  onClear,
  isFiltered,
  total,
  isLoading = false,
}) {
  return (
    <SideSheet
      open={open}
      onClose={onClose}
      anchor="bottom"
      title="Filters"
      description="Narrow the marketplace by presence, level, and track record — then choose an order."
      PaperProps={SHEET_PAPER_PROPS}
      actions={
        <>
          <Button
            variant="text"
            color="inherit"
            onClick={onClear}
            disabled={!isFiltered}
            sx={{ flexShrink: 0 }}
          >
            Clear all
          </Button>
          <Button variant="gradient" onClick={onClose} sx={{ flexGrow: 1 }}>
            {isLoading
              ? 'Show results'
              : `Show ${formatNumber(total)} ${total === 1 ? 'creator' : 'creators'}`}
          </Button>
        </>
      }
    >
      <Stack spacing={2.5}>
        <Stack spacing={1}>
          <Typography variant="subtitle2" component="h3">
            Show me
          </Typography>
          <FilterChipGroup
            multiple
            label="Creator filters"
            options={CREATOR_FILTER_OPTIONS}
            value={values[CREATOR_PARAM.FILTER]}
            onChange={(next) => onChange({ [CREATOR_PARAM.FILTER]: next })}
            // Wraps rather than scrolls: this is the copy that exists so every
            // chip is visible at once.
            sx={{ flexWrap: 'wrap', overflowX: 'visible' }}
          />
          <Stack component="ul" spacing={0.25} sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {HINTED.map((token) => (
              <Typography
                key={token}
                component="li"
                variant="caption"
                color="text.secondary"
              >
                {CREATOR_FILTER_OPTIONS.find((option) => option.value === token)?.label} —{' '}
                {FILTER_HINTS[token]}
              </Typography>
            ))}
          </Stack>
        </Stack>

        <SortSelect
          label="Sort by"
          value={values[CREATOR_PARAM.SORT]}
          onChange={(next) => onChange({ [CREATOR_PARAM.SORT]: next })}
          options={CREATOR_SORT_OPTIONS}
          size="medium"
          fullWidth
          minWidth={196}
        />
      </Stack>
    </SideSheet>
  )
}
