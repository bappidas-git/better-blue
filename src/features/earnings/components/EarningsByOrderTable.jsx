import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

import StatusChip from '@/components/data-display/StatusChip'
import DataTable from '@/components/table/DataTable'
import { paths } from '@/routes/paths'
import { EMPTY_PLACEHOLDER, formatCurrency, formatDate, formatPercent } from '@/utils/formatters'

// What each engagement was worth, and what BetterBlue took for it.
//
// This is the table that has to survive being read next to a bank statement, so
// it prints the whole arithmetic rather than the conclusion: gross, the rate
// that was applied, the fee in money, and the net. Every one of those figures is
// the **order's own snapshot** — frozen when the proposal was accepted
// (`docs/api-contract.md` §6.9) — folded into rows by
// `paymentService.getEarningsBreakdown`. Nothing is computed here (Prompt 25 §7).
//
// `DataTable` supplies the desktop table, the cards below `md`, the skeletons,
// the error state, and the totals footer; this module supplies the six columns
// and how each one reads.

/** Money is set in tabular numerals so a column of it lines up digit for digit. */
const MONEY_SX = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }

/** `20%` — the rate as it was applied to this order, never the current setting. */
function rateLabel(rate) {
  return rate === null || rate === undefined
    ? EMPTY_PLACEHOLDER
    : formatPercent(rate, { maximumFractionDigits: 1 })
}

/** An amount, right-aligned and tabular. `strong` is reserved for the net. */
function Money({ amount, currency, strong = false, negative = false }) {
  return (
    <Typography
      variant="body2"
      component="span"
      sx={{ ...MONEY_SX, fontWeight: strong ? 700 : 400 }}
    >
      {negative ? '− ' : ''}
      {formatCurrency(amount, currency)}
    </Typography>
  )
}

const COLUMNS = Object.freeze([
  Object.freeze({
    key: 'title',
    label: 'Order',
    render: (row) => (
      <Link
        component={RouterLink}
        to={paths.creatorOrderDetail(row.orderId)}
        underline="hover"
        sx={{ fontWeight: 600, color: 'text.primary' }}
      >
        {row.title}
      </Link>
    ),
  }),
  Object.freeze({
    key: 'settledAt',
    label: 'Completed',
    width: 140,
    render: (row) => (
      <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }} color="text.secondary">
        {row.isSettled ? formatDate(row.settledAt) : 'In progress'}
      </Typography>
    ),
  }),
  Object.freeze({
    key: 'gross',
    label: 'Gross',
    align: 'right',
    width: 120,
    render: (row) => <Money amount={row.gross} currency={row.currency} />,
  }),
  Object.freeze({
    key: 'commissionAmount',
    label: 'Commission',
    align: 'right',
    width: 170,
    render: (row) => (
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
        <Chip
          label={rateLabel(row.commissionRate)}
          size="small"
          variant="outlined"
          sx={{ fontVariantNumeric: 'tabular-nums' }}
        />
        <Money amount={row.commissionAmount} currency={row.currency} negative />
      </Stack>
    ),
  }),
  Object.freeze({
    key: 'net',
    label: 'Net to you',
    align: 'right',
    width: 130,
    render: (row) => <Money amount={row.net} currency={row.currency} strong />,
  }),
  Object.freeze({
    key: 'escrowStatus',
    label: 'Escrow',
    width: 150,
    render: (row) =>
      row.escrowStatus ? (
        <StatusChip status={row.escrowStatus} size="sm" tooltip />
      ) : (
        <Typography variant="body2" color="text.secondary">
          Not funded
        </Typography>
      ),
  }),
])

/** The mobile card: the same six facts, in the order a creator asks for them. */
function EarningsRowCard({ row }) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Link
          component={RouterLink}
          to={paths.creatorOrderDetail(row.orderId)}
          underline="hover"
          sx={{ fontWeight: 600, color: 'text.primary', display: 'block' }}
        >
          {row.title}
        </Link>
        <Typography variant="caption" color="text.secondary">
          {row.isSettled ? `Completed ${formatDate(row.settledAt)}` : 'In progress'}
        </Typography>

        <Stack spacing={0.75} sx={{ mt: 1.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Gross
            </Typography>
            <Money amount={row.gross} currency={row.currency} />
          </Stack>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Commission ({rateLabel(row.commissionRate)})
            </Typography>
            <Money amount={row.commissionAmount} currency={row.currency} negative />
          </Stack>
          <Divider />
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Net to you
            </Typography>
            <Money amount={row.net} currency={row.currency} strong />
          </Stack>
        </Stack>

        <Box sx={{ mt: 1.5 }}>
          {row.escrowStatus ? (
            <StatusChip status={row.escrowStatus} size="sm" />
          ) : (
            <Typography variant="caption" color="text.secondary">
              Not funded
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}

/** The mobile equivalent of the desktop footer — a table footer cannot follow cards. */
function TotalsCard({ totals, currency }) {
  return (
    <Card
      variant="outlined"
      sx={{ bgcolor: 'background.default', display: { xs: 'block', md: 'none' } }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Typography variant="overline" color="text.secondary">
          Totals · {totals.count} {totals.count === 1 ? 'order' : 'orders'}
        </Typography>
        <Stack spacing={0.75} sx={{ mt: 0.75 }}>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              Gross
            </Typography>
            <Money amount={totals.gross} currency={currency} />
          </Stack>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              Commission
            </Typography>
            <Money amount={totals.commissionAmount} currency={currency} negative />
          </Stack>
          <Divider />
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Net to you
            </Typography>
            <Money amount={totals.net} currency={currency} strong />
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}

/**
 * @param {object} props
 * @param {object[]} [props.rows] one row per order carrying money
 * @param {object} [props.totals] `{ count, gross, commissionAmount, net }`
 * @param {string} [props.currency] ISO 4217 code for the totals row
 * @param {boolean} [props.loading=false]
 * @param {object} [props.error]
 * @param {() => void} [props.onRetry]
 * @param {object} [props.emptyState] forwarded to `EmptyState`
 */
export default function EarningsByOrderTable({
  rows = [],
  totals,
  currency,
  loading = false,
  error,
  onRetry,
  emptyState,
}) {
  const hasTotals = Boolean(totals) && rows.length > 0

  const footer = hasTotals
    ? {
        title: `Totals · ${totals.count} ${totals.count === 1 ? 'order' : 'orders'}`,
        gross: <Money amount={totals.gross} currency={currency} strong />,
        commissionAmount: <Money amount={totals.commissionAmount} currency={currency} strong negative />,
        net: <Money amount={totals.net} currency={currency} strong />,
      }
    : undefined

  return (
    <>
      <DataTable
        ariaLabel="Earnings by order"
        columns={COLUMNS}
        rows={rows}
        loading={loading}
        error={error}
        onRetry={onRetry}
        emptyState={emptyState}
        footer={footer}
        renderMobileCard={(row) => <EarningsRowCard row={row} />}
      />
      {hasTotals && !loading && !error ? (
        <Box sx={{ mt: 2 }}>
          <TotalsCard totals={totals} currency={currency} />
        </Box>
      ) : null}
    </>
  )
}
