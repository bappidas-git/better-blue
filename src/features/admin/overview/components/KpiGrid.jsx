import { Icon } from '@iconify/react'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'

import StatCardGrid from '@/features/dashboard/components/StatCardGrid'
import { paths } from '@/routes/paths'
import {
  EMPTY_PLACEHOLDER,
  formatCurrency,
  formatNumber,
  formatNumberCompact,
} from '@/utils/formatters'

// The six numbers the platform is judged by, in one band.
//
// Two columns on a phone, three from `md` — 2×3 becomes 3×2, so six tiles never
// degrade into a single scrolling column (§11). `StatCardGrid` owns the grid;
// only the template is overridden, because six is not four.
//
// **Per-tile failure isolation (§13).** `adminService.getOverviewStats` never
// rejects: a metric that could not be read arrives as `null` with its error in
// `errors`, and that tile alone swaps its number for a retry. The other five
// keep their figures — an overview that blanks because one collection was slow
// is worse than an overview with one gap in it.
//
// A `null` metric is never printed as `0`. "No open disputes" and "we could not
// count the disputes" are different sentences and only one of them is good news.

/**
 * Six tiles: 2 columns on a phone, 3 from `md` up.
 *
 * The padding override is the price of two columns at 360px. A `StatCard` is
 * built for a four-across band and spends 48px of a tile on its own gutters; at
 * 156px per tile — which is what 360px minus the page gutters and the grid gap
 * comes to — that leaves under 50px for the label. Tightening the gutters here
 * rather than in `StatCard` keeps every other dashboard exactly as it was.
 */
const KPI_GRID_SX = {
  gap: { xs: 1.5, md: 3 },
  gridTemplateColumns: {
    xs: 'repeat(2, minmax(0, 1fr))',
    sm: 'repeat(2, minmax(0, 1fr))',
    md: 'repeat(3, minmax(0, 1fr))',
  },
  '& .MuiCardContent-root': {
    p: { xs: 2, md: 3 },
    '&:last-child': { pb: { xs: 2, md: 3 } },
  },
}

/** Above this, money is shown compactly — `$16.9K` rather than `$16,980`. */
const COMPACT_CURRENCY_FROM = 10000

/** Above this, counts are shown compactly — `12.4K` rather than `12,430`. */
const COMPACT_COUNT_FROM = 10000

/** Money for a dense tile: exact while it fits, compact once it does not (§6). */
function statCurrency(amount, currency) {
  return formatCurrency(amount, currency, {
    compact: Math.abs(Number(amount) || 0) >= COMPACT_CURRENCY_FROM,
    hideDecimals: true,
  })
}

/** Counts follow the same rule, so a tile never outgrows its card. */
function statCount(value) {
  return Math.abs(Number(value) || 0) >= COMPACT_COUNT_FROM
    ? formatNumberCompact(value)
    : formatNumber(value)
}

/** What a tile shows instead of its number when that metric failed to load. */
function MetricError({ onRetry }) {
  return (
    <Stack spacing={0.5} alignItems="flex-start">
      <Typography variant="body2" color="text.secondary">
        Not available
      </Typography>
      {onRetry ? (
        <Button
          size="small"
          variant="text"
          onClick={onRetry}
          startIcon={<Icon icon="tabler:refresh" width={16} />}
          sx={{ ml: -1 }}
        >
          Try again
        </Button>
      ) : null}
    </Stack>
  )
}

/**
 * Builds one `StatCard` item, resolving the three states a metric can be in:
 * loaded, failed, or absent.
 */
function tile({ key, label, value, error, onRetry, format, icon, iconTone, to }) {
  if (error) {
    return {
      key,
      label,
      value: <MetricError onRetry={onRetry} />,
      icon,
      iconTone: 'error',
      animate: false,
    }
  }

  return {
    key,
    label,
    // `null` means "unknown", which is what the em dash says.
    value: value === null || value === undefined ? EMPTY_PLACEHOLDER : value,
    format,
    icon,
    iconTone,
    to,
  }
}

/**
 * @param {object} props
 * @param {import('@/services/adminService').AdminOverviewStats} [props.stats]
 * @param {boolean} [props.loading=false] render six skeleton tiles
 * @param {() => void} [props.onRetry] refetch the whole overview — the retry
 *   behind every failed tile, because the sections load in one call
 */
export default function KpiGrid({ stats, loading = false, onRetry }) {
  const currency = stats?.currency
  const errors = stats?.errors ?? {}

  // Below `sm` the icon tile costs 60px of a 158px card — more than the metric
  // it decorates can spare. The label and the number are the tile; the icon is
  // the ornament, so the ornament is what goes (§11).
  const compact = useMediaQuery((theme) => theme.breakpoints.down('sm'))
  const withIcon = (icon) => (compact ? undefined : icon)

  const items = [
    tile({
      key: 'gmv',
      label: 'GMV this month',
      value: stats?.gmvThisMonth,
      error: errors.gmv,
      onRetry,
      format: (amount) => statCurrency(amount, currency),
      icon: withIcon('solar:card-transfer-linear'),
      iconTone: 'brand',
    }),
    tile({
      key: 'commission',
      label: 'Commission revenue',
      value: stats?.commissionRevenueThisMonth,
      error: errors.commission,
      onRetry,
      format: (amount) => statCurrency(amount, currency),
      icon: withIcon('solar:hand-money-linear'),
      iconTone: 'success',
    }),
    tile({
      key: 'activeOrders',
      label: 'Active orders',
      value: stats?.activeOrders,
      error: errors.activeOrders,
      onRetry,
      format: statCount,
      icon: withIcon('solar:box-linear'),
      iconTone: 'info',
      // TODO(Prompt 31): `to: paths.ADMIN_ORDERS` once the orders console exists.
      // A tile pointing at an unbuilt route lands on the dashboard 404 — the
      // same rule `navConfig` follows for its entries.
    }),
    tile({
      key: 'newUsers',
      label: 'New members this week',
      value: stats?.newUsersThisWeek,
      error: errors.newUsers,
      onRetry,
      format: statCount,
      icon: withIcon('solar:users-group-rounded-linear'),
      iconTone: 'brand',
      // Prompt 29 built the directory, so the tile is a link. It lands on the
      // unfiltered list rather than on "joined in the last 7 days": the tile is
      // a way in, and an admin who followed it is usually there to look
      // somebody up, not to re-read the number they just clicked.
      to: paths.ADMIN_USERS,
    }),
    tile({
      key: 'disputes',
      label: 'Open disputes',
      value: stats?.openDisputes,
      error: errors.openDisputes,
      onRetry,
      format: statCount,
      icon: withIcon('solar:shield-warning-linear'),
      // A queue with nothing in it is good news, not a warning.
      iconTone: stats?.openDisputes > 0 ? 'warning' : 'success',
      // TODO(Prompt 33): `to: paths.ADMIN_DISPUTES`.
    }),
    tile({
      key: 'moderation',
      label: 'Moderation queue',
      value: stats?.moderationQueueSize,
      error: errors.moderationQueue,
      onRetry,
      format: statCount,
      icon: withIcon('tabler:shield-check'),
      iconTone: stats?.moderationQueueSize > 0 ? 'warning' : 'success',
      // TODO(Prompt 30): `to: paths.ADMIN_MODERATION`.
    }),
  ]

  return <StatCardGrid items={items} loading={loading} skeletonCount={6} sx={KPI_GRID_SX} />
}
