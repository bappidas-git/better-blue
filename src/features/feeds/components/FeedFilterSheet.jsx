import Button from '@mui/material/Button'

import SideSheet from '@/components/layout/SideSheet'
import { formatNumber } from '@/utils/formatters'

import FeedSortControls from './FeedSortControls'

// The mobile half of the filter bar (V2-07 §2): the price sort and the "Open
// deals only" switch, in a bottom sheet, because below `md` the sticky bar
// belongs to the chips.
//
// A **bottom** sheet rather than the side drawer `FilterSheet` uses: this is a
// two-control panel on a phone, and a full-screen takeover for two controls
// reads as a page you have to come back from. `SideSheet` still supplies the
// chrome, the focus trap, Escape, and focus return — the anchor and the paper
// are the only things this passes of its own.
//
// Filters commit as they are touched rather than into a draft the footer
// applies later, exactly as `FilterSheet` does: it is what lets the footer say
// "Show 9 feeds" truthfully, and it means dismissing the sheet never silently
// discards a choice.

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

/**
 * @param {object} props
 * @param {boolean} props.open whether the sheet is shown
 * @param {() => void} props.onClose close the sheet
 * @param {object} props.values parsed feed values
 * @param {(patch: object) => void} props.onChange reports changed parameters
 * @param {() => void} props.onClear reset every filter to its default
 * @param {boolean} props.isFiltered anything is off its default
 * @param {number} props.total live result count
 * @param {boolean} [props.isLoading=false] the count is being refreshed
 */
export default function FeedFilterSheet({
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
      description="Order the timeline by price, or keep it to deals still taking replies."
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
              : `Show ${formatNumber(total)} ${total === 1 ? 'feed' : 'feeds'}`}
          </Button>
        </>
      }
    >
      <FeedSortControls values={values} onChange={onChange} layout="stack" />
    </SideSheet>
  )
}
