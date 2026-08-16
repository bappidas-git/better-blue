import Box from '@mui/material/Box'

import StatCard from '@/components/data-display/StatCard'
import { ROLES } from '@/constants/roles'
import { EMPTY_PLACEHOLDER, formatCurrency, formatNumber, formatRelativeTime } from '@/utils/formatters'

// How much of the marketplace this member has touched — Prompt 29 §4.3.
//
// Five small tiles rather than a table, because these are the numbers an admin
// scans before reading anything else: a suspension decision reads differently
// against forty delivered orders than against none.
//
// **`null` is never drawn as zero.** Each aggregate in the bundle is its own
// failure boundary (`userService.adminGetUserBundle`), so a figure that could
// not be read renders an em dash — "no open disputes" and "we could not count
// the disputes" are different sentences, and only one of them is a reason to
// reinstate somebody.

/** Small-tile grid: four across on desktop, two on a phone. */
const GRID_SX = {
  display: 'grid',
  gap: { xs: 1.5, md: 2 },
  gridTemplateColumns: {
    xs: 'repeat(2, minmax(0, 1fr))',
    md: 'repeat(3, minmax(0, 1fr))',
    lg: 'repeat(5, minmax(0, 1fr))',
  },
}

/** A count, or the placeholder when the read failed. */
const count = (value) => (value === null || value === undefined ? EMPTY_PLACEHOLDER : formatNumber(value))

/**
 * @param {object} props
 * @param {object} props.user the account
 * @param {object} props.aggregates `userService.adminGetUserBundle().aggregates`
 * @param {boolean} [props.loading]
 */
export default function UserAggregates({ user, aggregates, loading = false }) {
  const isCreator = user?.role === ROLES.CREATOR

  const money = isCreator
    ? {
        label: 'Earned to date',
        value:
          aggregates?.totalEarned === null || aggregates?.totalEarned === undefined
            ? EMPTY_PLACEHOLDER
            : formatCurrency(aggregates.totalEarned, aggregates.currency),
        icon: 'solar:wallet-money-linear',
        iconTone: 'success',
      }
    : {
        label: 'Spent to date',
        value:
          aggregates?.totalSpent === null || aggregates?.totalSpent === undefined
            ? EMPTY_PLACEHOLDER
            : formatCurrency(aggregates.totalSpent, aggregates.currency),
        icon: 'solar:card-linear',
        iconTone: 'info',
      }

  const tiles = [
    {
      key: 'orders',
      label: 'Orders',
      value: count(aggregates?.ordersCount),
      icon: 'solar:box-linear',
      iconTone: 'brand',
    },
    { key: 'money', ...money },
    {
      key: 'disputes',
      label: 'Open disputes',
      value: count(aggregates?.openDisputes),
      icon: 'solar:shield-warning-linear',
      // A queue with nothing in it is good news, not a warning — the same rule
      // the overview's tiles follow.
      iconTone: aggregates?.openDisputes > 0 ? 'warning' : 'success',
    },
    {
      key: 'reports',
      label: 'Reports against',
      value: count(aggregates?.reportsAgainst),
      icon: 'solar:flag-linear',
      iconTone: aggregates?.reportsAgainst > 0 ? 'warning' : 'success',
    },
    {
      key: 'lastLogin',
      label: 'Last active',
      value: aggregates?.lastLoginAt ? formatRelativeTime(aggregates.lastLoginAt) : 'Never',
      icon: 'solar:clock-circle-linear',
      iconTone: 'info',
    },
  ]

  return (
    <Box sx={GRID_SX}>
      {tiles.map((tile) => (
        <StatCard
          key={tile.key}
          label={tile.label}
          // Every value here is already a formatted string, so `StatCard` renders
          // it as a node and its count-up animation stays out of the way — an
          // admin reading a suspension does not need numbers ticking at them.
          value={tile.value}
          icon={tile.icon}
          iconTone={tile.iconTone}
          loading={loading}
        />
      ))}
    </Box>
  )
}
