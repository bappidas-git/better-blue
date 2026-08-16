import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

import StatusChip from '@/components/data-display/StatusChip'
import FilterChipGroup from '@/components/inputs/FilterChipGroup'
import FormDateField from '@/components/inputs/FormDateField'
import DataTable from '@/components/table/DataTable'
import { getStatusMeta } from '@/constants'
import { CREATOR_TRANSACTION_TYPES } from '@/features/earnings/earningsFilters'
import { amountColor, signedAmount } from '@/features/payments/ledgerDisplay'
import { paths } from '@/routes/paths'
import { formatDate } from '@/utils/formatters'

// The creator's ledger — one row per movement of money on their BetterBlue
// balance, append-only and never amended (`docs/payments.md` §7).
//
// The buyer's version of this table lives in `features/payments`; this one is
// not a copy of it, because the two ledgers do not carry the same rows. A
// creator's balance is made of releases, the commission debited against them,
// payouts leaving, and affiliate commission arriving — so the filter chips, the
// export, and the order link are all built for those, and each row carries a
// link back to the engagement it came from.

/** Money is set in tabular numerals so a column of it lines up digit for digit. */
const MONEY_SX = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }

const COLUMNS = Object.freeze([
  Object.freeze({
    key: 'createdAt',
    label: 'Date',
    width: 140,
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
    width: 180,
    render: (row) => <StatusChip status={row.type} size="sm" showDot={false} tooltip />,
  }),
  Object.freeze({
    key: 'orderId',
    label: 'Order',
    width: 110,
    render: (row) =>
      row.orderId ? (
        <Link
          component={RouterLink}
          to={paths.creatorOrderDetail(row.orderId)}
          underline="hover"
          variant="body2"
        >
          View order
        </Link>
      ) : (
        <Typography variant="body2" color="text.secondary">
          —
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

/** The mobile card: the same five facts, in the order they are asked for. */
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
            sx={{ ...MONEY_SX, fontWeight: 700, color: amountColor(row) }}
          >
            {signedAmount(row)}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1.25 }}>
          <StatusChip status={row.type} size="sm" showDot={false} />
          {row.orderId ? (
            <Link
              component={RouterLink}
              to={paths.creatorOrderDetail(row.orderId)}
              underline="hover"
              variant="body2"
            >
              View order
            </Link>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  )
}

const chipOptions = (values) =>
  values.map((value) => ({ value, label: getStatusMeta(value).label }))

/**
 * @param {object} props
 * @param {object[]} [props.rows] the current page of ledger rows
 * @param {number} [props.total]
 * @param {number} props.page
 * @param {number} props.pageSize
 * @param {(page: number) => void} props.onPageChange
 * @param {string|null} props.type active type filter
 * @param {(type: string|null) => void} props.onTypeChange
 * @param {string} props.from `YYYY-MM-DD` range start (or `''`)
 * @param {string} props.to `YYYY-MM-DD` range end (or `''`)
 * @param {(key: 'from'|'to', value: string) => void} props.onDateChange
 * @param {boolean} [props.loading=false]
 * @param {object} [props.error]
 * @param {() => void} [props.onRetry]
 * @param {object} [props.emptyState] forwarded to `EmptyState`
 * @param {() => void} props.onExport
 * @param {boolean} [props.isExporting=false]
 */
export default function TransactionsTab({
  rows = [],
  total = 0,
  page,
  pageSize,
  onPageChange,
  type,
  onTypeChange,
  from,
  to,
  onDateChange,
  loading = false,
  error,
  onRetry,
  emptyState,
  onExport,
  isExporting = false,
}) {
  return (
    <>
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', lg: 'flex-end' }}
        sx={{ mb: { xs: 2, md: 2.5 } }}
      >
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <FilterChipGroup
            label="Filter transactions by type"
            options={chipOptions(CREATOR_TRANSACTION_TYPES)}
            value={type}
            onChange={onTypeChange}
          />
        </Box>

        <Stack direction="row" spacing={1.5} sx={{ flexShrink: 0 }}>
          <FormDateField
            id="creator-transactions-from"
            label="From"
            value={from || null}
            onChange={(next) => onDateChange('from', next ?? '')}
            maxDate={to || undefined}
          />
          <FormDateField
            id="creator-transactions-to"
            label="To"
            value={to || null}
            onChange={(next) => onDateChange('to', next ?? '')}
            minDate={from || undefined}
          />
        </Stack>

        <Button
          onClick={onExport}
          disabled={isExporting || loading}
          variant="outlined"
          color="inherit"
          startIcon={
            <Icon icon="solar:download-minimalistic-linear" width={18} aria-hidden="true" />
          }
          sx={{ flexShrink: 0, minHeight: 44 }}
        >
          Export CSV
        </Button>
      </Stack>

      <DataTable
        ariaLabel="Your transactions"
        columns={COLUMNS}
        rows={rows}
        loading={loading}
        error={error}
        onRetry={onRetry}
        emptyState={emptyState}
        renderMobileCard={(row) => <TransactionCard row={row} />}
        pagination={{
          page,
          pageSize,
          total,
          onPageChange,
          itemLabel: 'transactions',
          hideOnSinglePage: true,
        }}
      />
    </>
  )
}
