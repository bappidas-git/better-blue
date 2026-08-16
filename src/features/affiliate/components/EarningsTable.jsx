import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

import StatusChip from '@/components/data-display/StatusChip'
import DataTable from '@/components/table/DataTable'
import { AFFILIATE_EARNING_STATUS } from '@/constants/statuses'
import { shortRef } from '@/services/affiliateService'
import { EMPTY_PLACEHOLDER, formatCurrency, formatDate } from '@/utils/formatters'

// Every commission this affiliate has accrued, and where each one stands —
// Prompt 34 §4.3.
//
// The order is referenced by a short opaque code (`#A1B2C3`) rather than by its
// title or its id. An affiliate has no relationship with the order: naming the
// brief would leak what a referred business is buying, and printing the raw
// `ord_…` would invite somebody to try the URL. The short ref is enough to quote
// in a support message and nothing more.
//
// A11Y: the status is text plus a tooltip carrying its description (`tooltip`
// on `StatusChip`), so "Pending" is never colour alone — and `void` earnings
// carry their reason in the same place, because a commission that disappeared
// needs its explanation attached to it, not in an email nobody kept.

/** Money is set in tabular numerals so a column of it lines up digit for digit. */
const MONEY_SX = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }

/** The date that matters for a row, given where it is in its life. */
function milestone(row) {
  if (row.status === AFFILIATE_EARNING_STATUS.PAID && row.paidAt) {
    return `Paid ${formatDate(row.paidAt)}`
  }
  if (row.status === AFFILIATE_EARNING_STATUS.APPROVED && row.approvedAt) {
    return `Approved ${formatDate(row.approvedAt)}`
  }
  if (row.status === AFFILIATE_EARNING_STATUS.VOID && row.voidedAt) {
    return `Voided ${formatDate(row.voidedAt)}`
  }
  return EMPTY_PLACEHOLDER
}

/** The status chip, with a void earning's reason on it where there is one. */
function EarningStatus({ row }) {
  if (row.status === AFFILIATE_EARNING_STATUS.VOID && row.voidReason) {
    return (
      <Tooltip title={row.voidReason}>
        <Box component="span">
          <StatusChip status={row.status} size="sm" />
        </Box>
      </Tooltip>
    )
  }
  return <StatusChip status={row.status} size="sm" tooltip />
}

/**
 * @param {object} props
 * @param {object[]} [props.rows] earnings from `affiliateService.getDashboard`
 * @param {boolean} [props.loading=false]
 * @param {object} [props.error]
 * @param {() => void} [props.onRetry]
 */
export default function EarningsTable({ rows = [], loading = false, error, onRetry }) {
  const columns = [
    {
      key: 'orderId',
      label: 'Order',
      width: 130,
      render: (row) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
          {shortRef(row.orderId)}
        </Typography>
      ),
    },
    {
      key: 'amount',
      label: 'Commission',
      align: 'right',
      width: 130,
      render: (row) => (
        <Typography variant="body2" sx={{ ...MONEY_SX, fontWeight: 700 }}>
          {formatCurrency(row.amount, row.currency)}
        </Typography>
      ),
    },
    {
      key: 'createdAt',
      label: 'Earned',
      width: 150,
      render: (row) => (
        <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
          {formatDate(row.createdAt)}
        </Typography>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: 130,
      render: (row) => <EarningStatus row={row} />,
    },
    {
      key: 'milestone',
      label: 'Updated',
      width: 160,
      render: (row) => (
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          {milestone(row)}
        </Typography>
      ),
    },
  ]

  const renderMobileCard = (row) => (
    <Card variant="outlined">
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" component="p" sx={{ ...MONEY_SX, fontSize: '1.125rem' }}>
              {formatCurrency(row.amount, row.currency)}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p">
              Order {shortRef(row.orderId)} · earned {formatDate(row.createdAt)}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p">
              {milestone(row)}
            </Typography>
          </Box>
          <Box sx={{ flexShrink: 0 }}>
            <EarningStatus row={row} />
          </Box>
        </Stack>

        {row.status === AFFILIATE_EARNING_STATUS.VOID && row.voidReason ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {row.voidReason}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  )

  return (
    <DataTable
      ariaLabel="Your referral commission"
      columns={columns}
      rows={rows}
      loading={loading}
      error={error}
      onRetry={onRetry}
      renderMobileCard={renderMobileCard}
      emptyState={{
        icon: 'solar:hand-money-linear',
        title: 'No commission yet',
        description:
          'Commission is earned when a business you referred completes their first order. Signups on their way there show in the referrals table above.',
      }}
    />
  )
}
