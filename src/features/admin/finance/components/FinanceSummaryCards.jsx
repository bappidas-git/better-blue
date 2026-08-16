import StatCardGrid from '@/features/dashboard/components/StatCardGrid'
import { formatCurrency } from '@/utils/formatters'

// The four figures the finance desk opens on — Prompt 32 §4.1.
//
// Every one of them is computed by `paymentService.getFinanceSummary` and
// simply printed here (§7: all aggregation is service-side). The component's
// only judgement is *presentation*: which tile carries which tone, and the fact
// that refunds rise being bad is stated to `StatCard` rather than left to its
// "up is good" default.
//
// Money is shown without decimals: a headline figure is read for its magnitude,
// and `$18,240` scans where `$18,240.00` does not. The exact cent is one tab
// away in the ledger, which is the screen that owes it.

/** Money for a tile: exact to the dollar, compact once it outgrows the card. */
const COMPACT_FROM = 100000

function statMoney(amount, currency) {
  return formatCurrency(amount, currency, {
    compact: Math.abs(Number(amount) || 0) >= COMPACT_FROM,
    hideDecimals: true,
  })
}

/**
 * @param {object} props
 * @param {object} [props.summary] one month bucket from
 *   `paymentService.getFinanceSummary` — `current` for "this month"
 * @param {string} [props.currency]
 * @param {boolean} [props.loading=false]
 */
export default function FinanceSummaryCards({ summary, currency, loading = false }) {
  const money = (amount) => statMoney(amount, currency)

  const items = [
    {
      key: 'chargeVolume',
      label: 'Charge volume',
      value: summary?.chargeVolume ?? 0,
      format: money,
      icon: 'solar:card-transfer-linear',
      iconTone: 'brand',
    },
    {
      key: 'commissionRevenue',
      label: 'Commission revenue',
      value: summary?.commissionRevenue ?? 0,
      format: money,
      icon: 'solar:hand-money-linear',
      iconTone: 'success',
    },
    {
      key: 'refunded',
      label: 'Refunded',
      value: summary?.refunded ?? 0,
      format: money,
      icon: 'solar:undo-left-round-linear',
      // A month with more refunds in it is a worse month, whatever the arrow
      // would otherwise imply. A month with none is simply good news.
      iconTone: summary?.refunded > 0 ? 'warning' : 'success',
    },
    {
      key: 'payoutsPaid',
      label: 'Payouts paid',
      value: summary?.payoutsPaid ?? 0,
      format: money,
      icon: 'solar:wallet-money-linear',
      iconTone: 'info',
    },
  ]

  return <StatCardGrid items={items} loading={loading} skeletonCount={4} />
}
