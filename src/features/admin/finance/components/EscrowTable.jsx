import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

import StatusChip from '@/components/data-display/StatusChip'
import DataTable from '@/components/table/DataTable'
import { AgeBadge, EntityRefChip } from '@/features/admin/shared'
import { ESCROW_SLA } from '@/features/admin/finance/utils/financeFilters'
import { paths } from '@/routes/paths'
import { EMPTY_PLACEHOLDER, formatCurrency, formatDate } from '@/utils/formatters'

// Every payment BetterBlue is currently holding — Prompt 32 §4.2.
//
// The list is exactly the payments in `held`, read from the *payment* rather
// than from the order: `held` is the one state that means money is sitting with
// the platform (`docs/payments.md` §5), and this screen exists for the cases
// where the order's own status and the money's disagree.
//
// Two actions per row and one of them is guarded. Viewing the order is the
// answer to almost every question this table raises, so it comes first;
// refunding is the exception, and the button carries a note saying so — a
// contested order belongs in dispute resolution, where both sides are heard,
// not in a finance table where one person can return the money on a hunch.

/** Money is set in tabular numerals so a column of it lines up digit for digit. */
const MONEY_SX = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }

/**
 * The dispute chip, when the engagement behind held money is contested.
 *
 * Prompt 33 made it a link: this money is frozen *because* of that case, and
 * the case is where it gets unfrozen — a refund from this table would settle
 * one side of an argument nobody has finished hearing.
 */
function DisputeFlag({ dispute }) {
  if (!dispute) return null

  return (
    <Chip
      size="small"
      color="warning"
      variant="outlined"
      clickable
      component={RouterLink}
      to={paths.adminDisputeDetail(dispute.id)}
      icon={<Icon icon="solar:shield-warning-linear" width={15} aria-hidden="true" />}
      label="Disputed"
      aria-label={`Open dispute ${dispute.id} on this order`}
      sx={{ fontSize: '0.6875rem', fontWeight: 600 }}
    />
  )
}

/**
 * @param {object} props
 * @param {object[]} [props.rows] items from `paymentService.getEscrowOverview`
 * @param {boolean} [props.loading=false]
 * @param {object} [props.error]
 * @param {() => void} [props.onRetry]
 * @param {object} [props.emptyState] forwarded to `EmptyState`
 * @param {(row: object) => void} props.onViewOrder open the order (Prompt 31)
 * @param {(row: object) => void} [props.onRefund] open the refund dialog —
 *   omitted for an admin without `payments.manage`, which hides the action
 * @param {React.ReactNode} [props.footer] totals row, keyed by column
 */
export default function EscrowTable({
  rows = [],
  loading = false,
  error,
  onRetry,
  emptyState,
  onViewOrder,
  onRefund,
  footer,
}) {
  const columns = [
    {
      key: 'order',
      label: 'Order',
      render: (row) => (
        <Stack spacing={0.75} sx={{ minWidth: 0, maxWidth: 280 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
            {row.order?.title ?? 'Order'}
          </Typography>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
            <EntityRefChip type="order" id={row.orderId} label={row.orderId} />
            <DisputeFlag dispute={row.dispute} />
          </Stack>
        </Stack>
      ),
    },
    {
      key: 'parties',
      label: 'Buyer and creator',
      render: (row) => (
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          {row.buyer?.id ? (
            <EntityRefChip type="user" id={row.buyer.id} label={row.buyer.name} maxLabelLength={20} />
          ) : null}
          {row.creator?.id ? (
            <EntityRefChip
              type="user"
              id={row.creator.id}
              label={row.creator.name}
              maxLabelLength={20}
            />
          ) : null}
        </Stack>
      ),
    },
    {
      key: 'amount',
      label: 'Held',
      align: 'right',
      width: 130,
      render: (row) => (
        <Typography variant="body2" sx={{ ...MONEY_SX, fontWeight: 700 }}>
          {formatCurrency(row.amount, row.currency)}
        </Typography>
      ),
    },
    {
      key: 'heldAt',
      label: 'Held since',
      width: 170,
      render: (row) => (
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
            {row.heldAt ? formatDate(row.heldAt) : EMPTY_PLACEHOLDER}
          </Typography>
          <AgeBadge date={row.heldAt} noun="Held since" {...ESCROW_SLA} />
        </Stack>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      width: 210,
      render: (row) => (
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            onClick={() => onViewOrder(row)}
            aria-label={`View the order behind ${formatCurrency(row.amount, row.currency)} held in escrow`}
          >
            View order
          </Button>
          {onRefund ? (
            <Button
              size="small"
              variant="outlined"
              color="error"
              onClick={() => onRefund(row)}
              aria-label={`Refund the ${formatCurrency(row.amount, row.currency)} held on this order`}
            >
              Refund
            </Button>
          ) : null}
        </Stack>
      ),
    },
  ]

  const renderMobileCard = (row) => (
    <Card variant="outlined">
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {/* Money first below md (§11): on a phone the amount held is the fact
            the row exists to carry, and the title is context for it. */}
        <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="flex-start">
          <Typography variant="h6" component="p" sx={{ ...MONEY_SX, fontSize: '1.125rem' }}>
            {formatCurrency(row.amount, row.currency)}
          </Typography>
          <AgeBadge date={row.heldAt} noun="Held since" {...ESCROW_SLA} />
        </Stack>

        <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
          {row.order?.title ?? 'Order'}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="p">
          {row.buyer?.name ?? 'Buyer'} → {row.creator?.name ?? 'Creator'} · held{' '}
          {row.heldAt ? formatDate(row.heldAt) : EMPTY_PLACEHOLDER}
        </Typography>

        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1.25 }} flexWrap="wrap" useFlexGap>
          <StatusChip status={row.status} size="sm" showDot={false} />
          <EntityRefChip type="order" id={row.orderId} label={row.orderId} />
          <DisputeFlag dispute={row.dispute} />
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          <Button size="small" variant="outlined" color="inherit" onClick={() => onViewOrder(row)} fullWidth>
            View order
          </Button>
          {onRefund ? (
            <Button size="small" variant="outlined" color="error" onClick={() => onRefund(row)} fullWidth>
              Refund
            </Button>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  )

  return (
    <Box>
      <DataTable
        ariaLabel="Payments held in escrow"
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        onRetry={onRetry}
        emptyState={emptyState}
        renderMobileCard={renderMobileCard}
        footer={footer}
      />
    </Box>
  )
}
