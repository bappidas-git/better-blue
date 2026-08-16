import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import StatusChip from '@/components/data-display/StatusChip'
import DataTable from '@/components/table/DataTable'
import { EntityRefChip } from '@/features/admin/shared'
import { amountColor, signedAmount } from '@/features/payments/ledgerDisplay'
import { EMPTY_PLACEHOLDER, formatDate } from '@/utils/formatters'

// The platform ledger — Prompt 32 §4.3.
//
// The buyer's version of this table (`features/payments`) and the creator's
// (`features/earnings`) each show one member's rows; this one shows every row
// there is, which is why it carries a member column the other two do not need
// and why its type filter offers all seven `TRANSACTION_TYPE` values.
//
// `amount` is signed **from the perspective of `userId`** (`docs/payments.md`
// §7) — which is why the member column is not decoration. A `-$1,150` next to
// a creator and a `-$1,150` next to a buyer are opposite events, and the only
// thing distinguishing them on screen is whose ledger the row belongs to.

/** Money is set in tabular numerals so a column of it lines up digit for digit. */
const MONEY_SX = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }

const COLUMNS = Object.freeze([
  Object.freeze({
    key: 'createdAt',
    label: 'Date',
    width: 130,
    render: (row) => (
      <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
        {formatDate(row.createdAt)}
      </Typography>
    ),
  }),
  Object.freeze({
    key: 'type',
    label: 'Type',
    width: 170,
    render: (row) => <StatusChip status={row.type} size="sm" showDot={false} tooltip />,
  }),
  Object.freeze({
    key: 'description',
    label: 'Description',
    render: (row) => (
      <Typography variant="body2" sx={{ minWidth: 0 }}>
        {row.description}
      </Typography>
    ),
  }),
  Object.freeze({
    key: 'user',
    label: 'Member',
    width: 190,
    render: (row) =>
      row.user?.id ? (
        <EntityRefChip type="user" id={row.user.id} label={row.user.name} maxLabelLength={20} />
      ) : (
        <Typography variant="body2" color="text.secondary">
          {EMPTY_PLACEHOLDER}
        </Typography>
      ),
  }),
  Object.freeze({
    key: 'orderId',
    label: 'Order',
    width: 140,
    render: (row) =>
      row.orderId ? (
        <EntityRefChip type="order" id={row.orderId} label={row.orderId} />
      ) : (
        <Typography variant="body2" color="text.secondary">
          {EMPTY_PLACEHOLDER}
        </Typography>
      ),
  }),
  Object.freeze({
    key: 'amount',
    label: 'Amount',
    align: 'right',
    width: 140,
    render: (row) => (
      <Typography variant="body2" sx={{ ...MONEY_SX, fontWeight: 700, color: amountColor(row) }}>
        {signedAmount(row)}
      </Typography>
    ),
  }),
])

/** The mobile card: the same six facts, in the order they are asked for. */
function LedgerCard({ row }) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {row.description}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDate(row.createdAt)}
              {row.user?.name ? ` · ${row.user.name}` : ''}
            </Typography>
          </Box>
          <Typography
            variant="body2"
            sx={{ ...MONEY_SX, fontWeight: 700, color: amountColor(row) }}
          >
            {signedAmount(row)}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1.25 }} flexWrap="wrap" useFlexGap>
          <StatusChip status={row.type} size="sm" showDot={false} />
          {row.orderId ? <EntityRefChip type="order" id={row.orderId} label={row.orderId} /> : null}
        </Stack>
      </CardContent>
    </Card>
  )
}

/**
 * @param {object} props
 * @param {object[]} [props.rows] items from `paymentService.adminListTransactions`
 * @param {boolean} [props.loading=false]
 * @param {object} [props.error]
 * @param {() => void} [props.onRetry]
 * @param {object} [props.emptyState] forwarded to `EmptyState`
 * @param {object} [props.footer] totals row, keyed by column key
 * @param {object} [props.pagination] forwarded to `PaginationControl`
 */
export default function LedgerTable({
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
      ariaLabel="Platform ledger"
      columns={COLUMNS}
      rows={rows}
      loading={loading}
      error={error}
      onRetry={onRetry}
      emptyState={emptyState}
      renderMobileCard={(row) => <LedgerCard row={row} />}
      footer={footer}
      pagination={pagination}
    />
  )
}
