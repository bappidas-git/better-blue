import { useId } from 'react'

import Box from '@mui/material/Box'
import FormControlLabel from '@mui/material/FormControlLabel'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { visuallyHidden } from '@mui/utils'

import SortSelect from '@/components/inputs/SortSelect'

import { FEED_PARAM, PRICE_SORT_OPTIONS, isOpenOnlyLocked } from '../utils/feedFilters'

// The two controls that are not chips — the price sort and the "Open deals
// only" switch (V2-07 §2).
//
// One component, two layouts, for the same reason `FilterSheet` re-renders
// `FilterRail` rather than restating it: on desktop these sit in the sticky
// bar, and below `md` they move into the filter sheet. Two copies would drift
// within a prompt, and the switch's locked state is subtle enough that only one
// of them would keep it.

/**
 * @param {object} props
 * @param {object} props.values parsed feed values
 * @param {(patch: object) => void} props.onChange reports changed parameters
 * @param {'row'|'stack'} [props.layout='row'] `row` for the sticky bar,
 *   `stack` for the sheet — where there is room to spell the locked state out
 */
export default function FeedSortControls({ values, onChange, layout = 'row' }) {
  const hintId = useId()
  const isStack = layout === 'stack'

  // "Open deals only" while the Open chip is active is not a *different* view —
  // it is the same one, asked for twice. The switch shows on and disabled
  // rather than disappearing: a control that vanishes once it becomes true is a
  // control people stop trusting (§2, "redundant-safe").
  const locked = isOpenOnlyLocked(values)
  const isOpenOnly = locked || Boolean(values[FEED_PARAM.OPEN_ONLY])
  const hint = locked ? 'The Open deals filter already shows only open feeds.' : null

  const toggle = (
    <FormControlLabel
      label="Open deals only"
      sx={{ mr: 0, ml: isStack ? 0 : -0.5, minHeight: 44 }}
      control={
        <Switch
          checked={isOpenOnly}
          disabled={locked}
          onChange={(event) => onChange({ [FEED_PARAM.OPEN_ONLY]: event.target.checked })}
          inputProps={{ 'aria-describedby': hint ? hintId : undefined }}
        />
      }
    />
  )

  return (
    <Stack
      direction={isStack ? 'column' : 'row'}
      spacing={isStack ? 2.5 : 1.5}
      alignItems={isStack ? 'stretch' : 'center'}
      sx={{ flexShrink: 0 }}
    >
      <SortSelect
        label="Price sort"
        value={values[FEED_PARAM.PRICE]}
        onChange={(next) => onChange({ [FEED_PARAM.PRICE]: next })}
        options={PRICE_SORT_OPTIONS}
        size={isStack ? 'medium' : 'small'}
        fullWidth={isStack}
        minWidth={196}
      />

      <Stack spacing={0.25} sx={{ minWidth: 0 }}>
        {/* The tooltip is for a mouse; the description below carries the same
            sentence to a screen reader in both layouts (00 §13). The span is
            load-bearing: MUI puts the tooltip's text on its child as an
            `aria-label`, and on the `<label>` itself that would *replace*
            "Open deals only" as the switch's accessible name. On a wrapper
            with no role it is inert, which is the same reason `FeedDealChip`
            wraps its chip. */}
        {hint && !isStack ? (
          <Tooltip title={hint}>
            <Box component="span" sx={{ display: 'inline-flex' }}>
              {toggle}
            </Box>
          </Tooltip>
        ) : (
          toggle
        )}
        {hint ? (
          <Typography
            id={hintId}
            variant="caption"
            color="text.secondary"
            sx={isStack ? { display: 'block' } : visuallyHidden}
          >
            {hint}
          </Typography>
        ) : null}
      </Stack>
    </Stack>
  )
}
