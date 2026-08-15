import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import StatusChip from '@/components/data-display/StatusChip'
import DataTable from '@/components/table/DataTable'
import { amountColor, signedAmount } from '@/features/payments/ledgerDisplay'
import { formatDate } from '@/utils/formatters'

// The buyer's ledger. `DataTable` supplies the table on desktop, the cards
// below `md`, the skeletons, the error state, and the paging (00 §13); this
// component supplies the four columns and how each one reads.
//
// Every row is one movement of money and the ledger is append-only
// (`docs/payments.md` §7) — so there is nothing to click into, nothing to edit,
// and no row action. It is a statement, and it behaves like one.

/**
 * The four columns. Kept module-private: the CSV export declares its own
 * columns because a spreadsheet wants a full timestamp and a plain type name
 * where the screen wants a short date and a chip.
 */
const TRANSACTION_COLUMNS = Object.freeze([
  Object.freeze({
    key: 'createdAt',
    label: 'Date',
    width: 160,
    render: (row) => (
      <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
        {formatDate(row.createdAt)}
      </Typography>
    ),
  }),
  Object.freeze({
    key: 'description',
    label: 'Description',
    render: (row) => <Typography variant="body2">{row.description}</Typography>,
  }),
  Object.freeze({
    key: 'type',
    label: 'Type',
    width: 160,
    render: (row) => <StatusChip status={row.type} size="sm" showDot={false} tooltip />,
  }),
  Object.freeze({
    key: 'amount',
    label: 'Amount',
    align: 'right',
    width: 140,
    render: (row) => (
      <Typography
        variant="body2"
        sx={{
          fontWeight: 700,
          whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums',
          color: amountColor(row),
        }}
      >
        {signedAmount(row)}
      </Typography>
    ),
  }),
])

/** The mobile card: the same four facts, in the order they are asked for. */
function TransactionCard({ row }) {
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
            </Typography>
          </Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 700,
              whiteSpace: 'nowrap',
              fontVariantNumeric: 'tabular-nums',
              color: amountColor(row),
            }}
          >
            {signedAmount(row)}
          </Typography>
        </Stack>
        <Box sx={{ mt: 1.25 }}>
          <StatusChip status={row.type} size="sm" showDot={false} />
        </Box>
      </CardContent>
    </Card>
  )
}

/**
 * @param {object} props
 * @param {object[]} props.rows the current page of ledger rows
 * @param {boolean} [props.loading]
 * @param {object} [props.error]
 * @param {() => void} [props.onRetry]
 * @param {object} [props.emptyState] forwarded to `EmptyState`
 * @param {object} [props.pagination] forwarded to `PaginationControl`
 */
export default function TransactionsTable({
  rows = [],
  loading = false,
  error,
  onRetry,
  emptyState,
  pagination,
}) {
  return (
    <DataTable
      ariaLabel="Your transactions"
      columns={TRANSACTION_COLUMNS}
      rows={rows}
      loading={loading}
      error={error}
      onRetry={onRetry}
      emptyState={emptyState}
      pagination={pagination}
      renderMobileCard={(row) => <TransactionCard row={row} />}
    />
  )
}
