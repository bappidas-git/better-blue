import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import DataTable from '@/components/table/DataTable'
import { EntityRefChip } from '@/features/admin/shared'
import { EMPTY_PLACEHOLDER, formatCurrency, formatDate, formatPercent } from '@/utils/formatters'

// BetterBlue's own revenue, one row per settled order — Prompt 32 §4.4.
//
// There is **exactly one `commissions` row per released order** (contract
// §6.14), which is what makes this table the revenue record rather than a view
// of it: summing the amount column *is* the platform's earnings for the period.
//
// `baseAmount` is what actually settled, not `orders.price` — a partially
// refunded order earns commission only on the part the creator kept
// (`docs/payments.md` §6). The two columns therefore disagree on exactly those
// orders, which is the disagreement this table exists to make visible.

/** Money is set in tabular numerals so a column of it lines up digit for digit. */
const MONEY_SX = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }

/** The rate the fee was charged at, frozen on the order at award time. */
function RateChip({ rate }) {
  if (!Number.isFinite(Number(rate))) return <Box component="span">{EMPTY_PLACEHOLDER}</Box>

  return (
    <Chip
      size="small"
      variant="outlined"
      label={formatPercent(rate)}
      aria-label={`Commission rate ${formatPercent(rate)}`}
      sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: '0.75rem' }}
    />
  )
}

const COLUMNS = Object.freeze([
  Object.freeze({
    key: 'createdAt',
    label: 'Settled',
    width: 130,
    render: (row) => (
      <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
        {formatDate(row.createdAt)}
      </Typography>
    ),
  }),
  Object.freeze({
    key: 'order',
    label: 'Order',
    render: (row) => (
      <Stack spacing={0.5} sx={{ minWidth: 0, maxWidth: 300 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
          {row.order?.title ?? 'Order'}
        </Typography>
        <Box>
          <EntityRefChip type="order" id={row.orderId} label={row.orderId} />
        </Box>
      </Stack>
    ),
  }),
  Object.freeze({
    key: 'baseAmount',
    label: 'Settled base',
    align: 'right',
    width: 140,
    render: (row) => (
      <Typography variant="body2" sx={MONEY_SX}>
        {formatCurrency(row.baseAmount, row.currency)}
      </Typography>
    ),
  }),
  Object.freeze({
    key: 'rate',
    label: 'Rate',
    align: 'right',
    width: 100,
    render: (row) => <RateChip rate={row.rate} />,
  }),
  Object.freeze({
    key: 'amount',
    label: 'Commission',
    align: 'right',
    width: 140,
    render: (row) => (
      <Typography variant="body2" sx={{ ...MONEY_SX, fontWeight: 700, color: 'success.dark' }}>
        {formatCurrency(row.amount, row.currency)}
      </Typography>
    ),
  }),
])

/** The mobile card: the fee, then what produced it. */
function CommissionCard({ row }) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="flex-start">
          <Typography
            variant="h6"
            component="p"
            sx={{ ...MONEY_SX, fontSize: '1.125rem', color: 'success.dark' }}
          >
            {formatCurrency(row.amount, row.currency)}
          </Typography>
          <RateChip rate={row.rate} />
        </Stack>

        <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
          {row.order?.title ?? 'Order'}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="p">
          {formatCurrency(row.baseAmount, row.currency)} settled · {formatDate(row.createdAt)}
        </Typography>

        <Box sx={{ mt: 1.25 }}>
          <EntityRefChip type="order" id={row.orderId} label={row.orderId} />
        </Box>
      </CardContent>
    </Card>
  )
}

/**
 * @param {object} props
 * @param {object[]} [props.rows] items from `paymentService.adminListCommissions`
 * @param {boolean} [props.loading=false]
 * @param {object} [props.error]
 * @param {() => void} [props.onRetry]
 * @param {object} [props.emptyState] forwarded to `EmptyState`
 * @param {object} [props.footer] totals row, keyed by column key
 * @param {object} [props.pagination] forwarded to `PaginationControl`
 */
export default function CommissionsTable({
  rows = [],
  loading = false,
  error,
  onRetry,
  emptyState,
  footer,
  pagination,
}) {
  return (
    <DataTable
      ariaLabel="Commission records"
      columns={COLUMNS}
      rows={rows}
      loading={loading}
      error={error}
      onRetry={onRetry}
      emptyState={emptyState}
      renderMobileCard={(row) => <CommissionCard row={row} />}
      footer={footer}
      pagination={pagination}
    />
  )
}
