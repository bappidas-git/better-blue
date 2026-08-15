import Button from '@mui/material/Button'

import SideSheet from '@/components/layout/SideSheet'
import { formatNumber } from '@/utils/formatters'

import FilterRail from './FilterRail'

// The mobile and tablet filter experience: the same form as the desktop rail,
// in a full-screen sheet with an app-native apply flow.
//
// Filters commit as they are touched rather than into a draft the footer
// applies later. That is what lets the footer say "Show 6 creators" *truthfully*
// — the count is the live result count, not a guess — and it means backing out
// of the sheet never silently discards a selection. Escape, the focus trap, and
// focus return come from `SideSheet`.

/**
 * @param {object} props
 * @param {boolean} props.open whether the sheet is shown
 * @param {() => void} props.onClose close the sheet
 * @param {object} props.values parsed discovery values
 * @param {(patch: object) => void} props.onChange reports changed parameters
 * @param {() => void} props.onClear reset every filter
 * @param {boolean} props.isFiltered any filter is active
 * @param {number} props.total current result count
 * @param {boolean} [props.isLoading=false] the result count is being refreshed
 * @param {object[]} [props.categories] active categories from the API
 * @param {boolean} [props.isCategoriesLoading=false] taxonomy request in flight
 */
export default function FilterSheet({
  open,
  onClose,
  values,
  onChange,
  onClear,
  isFiltered,
  total,
  isLoading = false,
  categories,
  isCategoriesLoading = false,
}) {
  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title="Filters"
      description="Narrow the directory to the creators you can brief today."
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
      <FilterRail
        idPrefix="sheet-filters"
        values={values}
        onChange={onChange}
        categories={categories}
        isCategoriesLoading={isCategoriesLoading}
      />
    </SideSheet>
  )
}
