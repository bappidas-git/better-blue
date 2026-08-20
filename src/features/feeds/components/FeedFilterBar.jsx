import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import FilterChipGroup from '@/components/inputs/FilterChipGroup'
import { appConfig } from '@/config/appConfig'
import { formatNumber } from '@/utils/formatters'

import {
  countSheetFilters,
  describeFeedView,
  FEED_FILTER_OPTIONS,
  FEED_PARAM,
  FEED_PRICE_SORT,
  FEEDS_CONTENT_MAX_WIDTH,
  isOrderingOverridden,
} from '../utils/feedFilters'
import FeedSortControls from './FeedSortControls'

// The feeds timeline's filter bar (V2-07 §2) — sticky under the public top nav,
// translucent over the page it is holding still (docs/theme-v2.md §2, the same
// treatment `AppBar` gets).
//
// Two rows on every width: the chips, then the live result line and whatever
// affordances the width has room for. Below `md` the price sort and the switch
// move into the filter sheet and the chips become a snap-scrolling row, which
// is the one place this bar changes shape rather than just reflowing.

/** Where the bar sits, per breakpoint — shared with the nav so it cannot drift. */
const STICKY_TOP = { xs: appConfig.topNavHeight.xs, md: appConfig.topNavHeight.md }

/**
 * @param {object} props
 * @param {object} props.values parsed feed values
 * @param {(patch: object) => void} props.onChange reports changed parameters
 * @param {() => void} props.onClear reset every filter to its default
 * @param {boolean} props.isFiltered anything is off its default
 * @param {number} props.total live result count
 * @param {boolean} [props.isLoading=false] the count is being refreshed
 * @param {() => void} props.onOpenSheet open the mobile filter sheet
 */
export default function FeedFilterBar({
  values,
  onChange,
  onClear,
  isFiltered,
  total,
  isLoading = false,
  onOpenSheet,
}) {
  const view = describeFeedView(values)
  const overridden = isOrderingOverridden(values)
  const sheetCount = countSheetFilters(values)

  const countLabel = isLoading
    ? 'Loading feeds…'
    : `${formatNumber(total)} ${total === 1 ? 'feed' : 'feeds'}`

  const summary = [countLabel, view.isNarrowed ? view.scope : null, view.ordering]
    .filter(Boolean)
    .join(' · ')

  return (
    <Box
      sx={{
        position: 'sticky',
        top: STICKY_TOP,
        // Under the app bar, over the timeline: cards scroll beneath it, which
        // is why the wash is heavier than the nav's 80% — a card heading
        // passing behind a lighter one still reads through the blur.
        zIndex: (theme) => theme.zIndex.appBar - 1,
        backgroundColor: (theme) => alpha(theme.palette.background.default, 0.92),
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: 1,
        borderColor: 'divider',
        // Bleeds into the container gutters so the timeline scrolls *under* the
        // bar rather than past its edges (the pattern `CreatorsPage` set).
        mx: { xs: -2, md: -4 },
        px: { xs: 2, md: 4 },
        pt: 1,
        pb: 1.25,
        mb: { xs: 2, md: 3 },
      }}
    >
      <Box sx={{ maxWidth: FEEDS_CONTENT_MAX_WIDTH, mx: 'auto' }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <FilterChipGroup
            label="Feed filters"
            options={FEED_FILTER_OPTIONS}
            value={values[FEED_PARAM.FILTER]}
            onChange={(next) => next && onChange({ [FEED_PARAM.FILTER]: next })}
            // A timeline always has a shape: clicking the active chip re-selects
            // it rather than leaving the board with no filter at all.
            allowClear={false}
            sx={{
              flexGrow: 1,
              minWidth: 0,
              scrollSnapType: { xs: 'x proximity', md: 'none' },
              scrollPaddingLeft: 4,
              '& > .MuiChip-root': { scrollSnapAlign: { xs: 'start', md: 'none' } },
            }}
          />

          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            <FeedSortControls values={values} onChange={onChange} layout="row" />
          </Box>
        </Stack>

        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ mt: 0.5 }}
        >
          {/* The one live region on the page. The count also appears in the page
              header, which stays silent so a filter change is announced once. */}
          <Typography
            variant="body2"
            color="text.secondary"
            role="status"
            aria-live="polite"
            sx={{ flexGrow: 1, minWidth: 0 }}
          >
            {summary}
          </Typography>

          {/* The interplay, said out loud (§2): a price sort *replaces* what
              Latest and Most replies contribute, so the chip that looks active is
              no longer deciding anything. Open deals and Closed & delivered still
              filter, so they are never called out here. */}
          {overridden ? (
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
              <Icon
                icon="tabler:arrows-sort"
                width={16}
                aria-hidden="true"
                style={{ flexShrink: 0 }}
              />
              <Typography variant="caption" color="text.secondary">
                Price is setting the order — “{view.chipLabel}” is not.
              </Typography>
              <Button
                size="small"
                variant="text"
                onClick={() => onChange({ [FEED_PARAM.PRICE]: FEED_PRICE_SORT.NONE })}
              >
                Clear price sort
              </Button>
            </Stack>
          ) : null}

          <Button
            onClick={onOpenSheet}
            variant="outlined"
            size="small"
            startIcon={<Icon icon="tabler:adjustments-horizontal" width={18} />}
            aria-haspopup="dialog"
            sx={{ display: { md: 'none' }, flexShrink: 0 }}
          >
            {sheetCount > 0 ? `Filters (${sheetCount})` : 'Filters'}
          </Button>

          <Button
            onClick={onClear}
            variant="text"
            size="small"
            color="inherit"
            disabled={!isFiltered}
            sx={{ flexShrink: 0 }}
          >
            Clear
          </Button>
        </Stack>
      </Box>
    </Box>
  )
}
