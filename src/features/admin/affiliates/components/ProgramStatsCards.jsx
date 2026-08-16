import StatCardGrid from '@/features/dashboard/components/StatCardGrid'
import { formatCurrency, formatNumber } from '@/utils/formatters'

// The four numbers that describe the referral program's health — Prompt 34 §4.4.
//
// `liability` is the one that earns its place on a finance screen: commission
// that has been accrued or approved and not yet paid is money BetterBlue owes,
// and reading it off two other columns is exactly how a number like that gets
// mis-stated in a meeting. `affiliateService.getProgramStats` computes it.

/**
 * @param {object} props
 * @param {object} props.stats from `affiliateService.getProgramStats`
 * @param {boolean} [props.loading=false]
 */
export default function ProgramStatsCards({ stats, loading = false }) {
  const money = (amount) => formatCurrency(amount, stats?.currency, { hideDecimals: true })

  const items = [
    {
      key: 'affiliates',
      label: 'Active affiliates',
      value: stats?.activeAffiliates ?? 0,
      format: formatNumber,
      icon: 'solar:users-group-rounded-linear',
      iconTone: 'brand',
      deltaLabel:
        stats && stats.affiliates !== stats.activeAffiliates
          ? `${formatNumber(stats.affiliates - stats.activeAffiliates)} suspended`
          : undefined,
    },
    {
      key: 'conversions',
      label: 'Total conversions',
      value: stats?.conversions ?? 0,
      format: formatNumber,
      icon: 'solar:check-circle-linear',
      iconTone: 'success',
    },
    {
      key: 'liability',
      label: 'Outstanding liability',
      value: stats?.liability ?? 0,
      format: money,
      icon: 'solar:scale-linear',
      iconTone: (stats?.liability ?? 0) > 0 ? 'warning' : 'success',
    },
    {
      key: 'paid',
      label: 'Paid out',
      value: stats?.paidOut ?? 0,
      format: money,
      icon: 'solar:wallet-money-linear',
      iconTone: 'info',
    },
  ]

  return <StatCardGrid items={items} loading={loading} skeletonCount={4} />
}
