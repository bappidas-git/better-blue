import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import LinearProgress from '@mui/material/LinearProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import StickyActionBar from '@/components/layout/StickyActionBar'
import { BOTTOM_NAV_HEIGHT } from '@/layouts/dashboard/MobileBottomNav'
import { formatCurrency, formatNumber } from '@/utils/formatters'

// The bar that appears when settlements are selected — Prompt 32 §4.3.
//
// It carries the *money*, not just the count. "5 selected" is a number of
// checkboxes; "5 selected · $4,150" is what is about to be approved, and that
// is the figure somebody should be checking before they press the button.
//
// The progress line during a run is not decoration either: the batch is
// **sequential** (§7 — no `Promise.all`, so one failure cannot be swallowed by
// the ones around it), which means a batch of twenty visibly takes twenty
// steps, and a bar that did not say so would look frozen.

/**
 * @param {object} props
 * @param {number} props.count how many rows are selected
 * @param {number} props.total the money those rows come to
 * @param {string} [props.currency]
 * @param {() => void} props.onApprove
 * @param {() => void} props.onClear
 * @param {{done: number, total: number}|null} [props.progress] set while a batch
 *   is running; `null` when idle
 */
export default function BatchActionBar({
  count,
  total,
  currency,
  onApprove,
  onClear,
  progress = null,
}) {
  if (count === 0 && !progress) return null

  const running = Boolean(progress)
  const pct = running && progress.total > 0 ? (progress.done / progress.total) * 100 : 0

  return (
    <StickyActionBar
      position="fixed"
      justify="space-between"
      // Above the mobile bottom nav, which owns the bottom edge below md (§11)
      // — its own height plus the inset it already reserves.
      sx={{
        bottom: {
          xs: `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
          md: 0,
        },
      }}
    >
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography variant="subtitle2" component="p" aria-live="polite">
          {running
            ? `Approving ${formatNumber(progress.done)} of ${formatNumber(progress.total)}…`
            : `${formatNumber(count)} selected · ${formatCurrency(total, currency)}`}
        </Typography>
        {running ? (
          <LinearProgress
            variant="determinate"
            value={pct}
            aria-label="Batch approval progress"
            sx={{ mt: 0.75, borderRadius: 1 }}
          />
        ) : null}
      </Box>

      <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
        <Button variant="text" color="inherit" onClick={onClear} disabled={running}>
          Clear
        </Button>
        <Button
          variant="contained"
          onClick={onApprove}
          disabled={running || count === 0}
          startIcon={<Icon icon="solar:check-circle-linear" width={18} aria-hidden="true" />}
          sx={{ minHeight: 44 }}
        >
          {running ? 'Approving…' : `Approve ${formatNumber(count)}`}
        </Button>
      </Stack>
    </StickyActionBar>
  )
}
