import { Icon } from '@iconify/react'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'

import StickyActionBar from '@/components/layout/StickyActionBar'
import { BOTTOM_NAV_HEIGHT } from '@/layouts/dashboard/MobileBottomNav'
import { formatNumber } from '@/utils/formatters'

// The bar that appears once compare mode is on: how many are picked, and the
// way into the side-by-side view (§6 — "StickyActionBar for compare trigger").
//
// It is `fixed` rather than `sticky` because the proposals tab is long and the
// selection has to stay reachable from anywhere in it, and it clears the mobile
// bottom nav rather than sitting over it (§11).

/**
 * @param {object} props
 * @param {number} props.count how many proposals are selected
 * @param {number} props.min the fewest that can be compared
 * @param {number} props.max the most that can be compared
 * @param {() => void} props.onCompare
 * @param {() => void} props.onCancel leave compare mode
 */
export default function CompareBar({ count, min, max, onCompare, onCancel }) {
  const ready = count >= min

  return (
    <StickyActionBar
      position="fixed"
      justify="space-between"
      sx={{
        bottom: { xs: `calc(${BOTTOM_NAV_HEIGHT + 1}px + env(safe-area-inset-bottom))`, md: 0 },
        boxShadow: 3,
      }}
    >
      <Typography variant="body2" color="text.secondary" role="status">
        {ready
          ? `${formatNumber(count)} selected`
          : `Pick ${formatNumber(min - count)} more to compare (up to ${formatNumber(max)})`}
      </Typography>

      <Button color="inherit" onClick={onCancel}>
        Cancel
      </Button>
      <Button
        variant="gradient"
        onClick={onCompare}
        disabled={!ready}
        startIcon={<Icon icon="tabler:columns-3" width={18} aria-hidden="true" />}
      >
        Compare ({formatNumber(count)})
      </Button>
    </StickyActionBar>
  )
}
