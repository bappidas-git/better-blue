import StatCardGrid from '@/features/dashboard/components/StatCardGrid'
import { formatCurrency, formatNumber } from '@/utils/formatters'

// Six numbers: what the link did, and what it is worth — Prompt 34 §4.3.
//
// One grid, read left to right in the order things actually happen: the funnel
// first (visits → signups → conversions), then the money in the order it moves
// (pending → approved → paid). Three columns from `sm` up puts each triple on
// its own row; two columns at 360px gives the 2×3 block §11 asks for.
//
// **Money does not wrap mid-number.** `StatCard` sets `wordBreak: 'break-word'`
// on its value, which is right for a long label and wrong for `$12.80` — at
// 360px in a two-column grid it breaks after the decimal point and prints
// "$12." above "80". The override below keeps a currency tile on one line and
// steps its size down on the narrowest screens instead.

/** Currency tiles: never break a number, shrink the type rather than wrap it. */
const MONEY_TILE_SX = {
  '& .MuiTypography-h4': {
    whiteSpace: 'nowrap',
    wordBreak: 'normal',
    fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2.125rem' },
  },
}

/**
 * @param {object} props
 * @param {object} props.profile the affiliate account — the three counters
 * @param {object} props.balance from `affiliateService.getPayoutBalance`
 * @param {boolean} [props.loading=false]
 */
export default function AffiliateStats({ profile, balance, loading = false }) {
  const currency = balance?.currency
  const money = (amount) => formatCurrency(amount, currency)

  const items = [
    {
      key: 'clicks',
      label: 'Link visits',
      value: Number(profile?.clicks) || 0,
      format: formatNumber,
      icon: 'solar:cursor-linear',
      iconTone: 'info',
    },
    {
      key: 'signups',
      label: 'Signups',
      value: Number(profile?.signups) || 0,
      format: formatNumber,
      icon: 'solar:user-plus-linear',
      iconTone: 'brand',
    },
    {
      key: 'conversions',
      label: 'Conversions',
      value: Number(profile?.conversions) || 0,
      format: formatNumber,
      icon: 'solar:check-circle-linear',
      iconTone: 'success',
    },
    {
      key: 'pending',
      label: 'Pending review',
      value: balance?.pending ?? 0,
      format: money,
      icon: 'solar:clock-circle-linear',
      iconTone: 'warning',
      sx: MONEY_TILE_SX,
    },
    {
      key: 'approved',
      label: 'Approved',
      value: balance?.approved ?? 0,
      format: money,
      icon: 'solar:verified-check-linear',
      iconTone: 'info',
      sx: MONEY_TILE_SX,
    },
    {
      key: 'paid',
      label: 'Paid out',
      value: balance?.paid ?? 0,
      format: money,
      icon: 'solar:wallet-money-linear',
      iconTone: 'success',
      sx: MONEY_TILE_SX,
    },
  ]

  return (
    <StatCardGrid
      items={items}
      loading={loading}
      skeletonCount={6}
      sx={{
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',
          sm: 'repeat(3, minmax(0, 1fr))',
        },
      }}
    />
  )
}
