import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import FilterChipGroup from '@/components/inputs/FilterChipGroup'
import SortSelect from '@/components/inputs/SortSelect'
import { appConfig } from '@/config/appConfig'
import { formatNumber } from '@/utils/formatters'

import {
  countSheetFilters,
  CREATOR_FILTER_OPTIONS,
  CREATOR_PARAM,
  CREATOR_SORT_OPTIONS,
  CREATORS_CONTENT_MAX_WIDTH,
  describeCreatorView,
} from '../utils/creatorFilters'

// The creators page's filter bar (V2-09 §2) — sticky under the public top nav,
// translucent over the column it is holding still, and the same shape the feeds
// bar has so the two social surfaces read as one system.
//
// Two rows on every width: the chips, then the live result line and whatever
// affordances the width has room for. Below `md` the sort select moves into the
// filter sheet and the chips become a snap-scrolling row — the one place this
// bar changes shape rather than just reflowing.

/** Where the bar sits, per breakpoint — shared with the nav so it cannot drift. */
const STICKY_TOP = { xs: appConfig.topNavHeight.xs, md: appConfig.topNavHeight.md }

/**
 * @param {object} props
 * @param {object} props.values parsed creator values
 * @param {(patch: object) => void} props.onChange reports changed parameters
 * @param {() => void} props.onClear reset every filter to its default
 * @param {boolean} props.isFiltered anything is off its default
 * @param {number} props.total live result count
 * @param {boolean} [props.isLoading=false] the count is being refreshed
 * @param {() => void} props.onOpenSheet open the mobile filter sheet
 */
export default function CreatorFilterBar({
  values,
  onChange,
  onClear,
  isFiltered,
  total,
  isLoading = false,
  onOpenSheet,
}) {
  const view = describeCreatorView(values)
  const sheetCount = countSheetFilters(values)

  const countLabel = isLoading
    ? 'Loading creators…'
    : `${formatNumber(total)} ${total === 1 ? 'creator' : 'creators'}`

  const summary = [countLabel, view.isNarrowed ? view.scope : null, view.ordering]
    .filter(Boolean)
    .join(' · ')

  return (
    <Box
      sx={{
        position: 'sticky',
        top: STICKY_TOP,
        // Under the app bar, over the column: cards scroll beneath it, which is
        // why the wash is heavier than the nav's 80% — a creator's name passing
        // behind a lighter one still reads through the blur.
        zIndex: (theme) => theme.zIndex.appBar - 1,
        backgroundColor: (theme) => alpha(theme.palette.background.default, 0.92),
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: 1,
        borderColor: 'divider',
        // Bleeds into the container gutters so the column scrolls *under* the
        // bar rather than past its edges.
        mx: { xs: -2, md: -4 },
        px: { xs: 2, md: 4 },
        pt: 1,
        pb: 1.25,
        mb: { xs: 2, md: 3 },
      }}
    >
      <Box sx={{ maxWidth: CREATORS_CONTENT_MAX_WIDTH, mx: 'auto' }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <FilterChipGroup
            multiple
            label="Creator filters"
            options={CREATOR_FILTER_OPTIONS}
            value={values[CREATOR_PARAM.FILTER]}
            onChange={(next) => onChange({ [CREATOR_PARAM.FILTER]: next })}
            sx={{
              flexGrow: 1,
              minWidth: 0,
              scrollSnapType: { xs: 'x proximity', md: 'none' },
              scrollPaddingLeft: 4,
              '& > .MuiChip-root': { scrollSnapAlign: { xs: 'start', md: 'none' } },
            }}
          />

          <Box sx={{ display: { xs: 'none', md: 'block' }, flexShrink: 0 }}>
            <SortSelect
              label="Sort by"
              value={values[CREATOR_PARAM.SORT]}
              onChange={(next) => onChange({ [CREATOR_PARAM.SORT]: next })}
              options={CREATOR_SORT_OPTIONS}
              size="small"
              minWidth={208}
            />
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
