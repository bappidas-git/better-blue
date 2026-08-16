import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

import StatusChip from '@/components/data-display/StatusChip'
import DataTable from '@/components/table/DataTable'
import { PAYOUT_SOURCE, PAYOUT_SOURCE_META, PAYOUT_STATUS, payoutSourceOf } from '@/constants/statuses'
import { AgeBadge, EntityRefChip } from '@/features/admin/shared'
import {
  SETTLEMENT_SLA,
  payoutMethodLabel,
} from '@/features/admin/finance/utils/financeFilters'
import { EMPTY_PLACEHOLDER, formatCurrency, formatDate } from '@/utils/formatters'

// The settlement queue — Prompt 32 §4.3.
//
// A payout is the one record in the product whose subject is a person waiting
// for money that is already theirs, so the queue is ordered oldest-first and
// every row carries an `AgeBadge`: the top of this list is whoever the platform
// has kept waiting longest.
//
// Selection is offered only on the tabs where it means something. A `paid`
// settlement has nothing left to approve, so its rows carry no checkbox at all
// rather than a disabled one — an unusable control is worse than no control.
//
// Each checkbox is labelled with the creator and the amount rather than "select
// row" (§12): somebody approving five payouts by keyboard needs to hear *which*
// five, and a column of identical labels tells them nothing.

/** Money is set in tabular numerals so a column of it lines up digit for digit. */
const MONEY_SX = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }

/**
 * What kind of settlement a row is (Prompt 34). `payouts` carries two now —
 * creator earnings and affiliate commission — and they are approved and paid the
 * same way but come out of different pockets, so the chip is on every row rather
 * than only on the newer kind: a queue where the absence of a label is the label
 * is a queue somebody eventually misreads.
 */
function SourceChip({ payout }) {
  const source = payoutSourceOf(payout)
  const meta = PAYOUT_SOURCE_META[source]

  return (
    <Tooltip title={meta.description}>
      <Chip
        size="small"
        variant="outlined"
        color={source === PAYOUT_SOURCE.AFFILIATE ? 'secondary' : 'default'}
        icon={<Icon icon={meta.icon} width={14} aria-hidden="true" />}
        label={meta.shortLabel}
        sx={{ fontSize: '0.6875rem', '& .MuiChip-icon': { ml: 0.75 } }}
      />
    </Tooltip>
  )
}

/** The action set for a row, decided by where the payout is in its machine. */
function RowActions({ payout, onApprove, onReject, onMarkPaid, busy }) {
  if (payout.status === PAYOUT_STATUS.REQUESTED) {
    return (
      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Button
          size="small"
          variant="contained"
          onClick={() => onApprove(payout)}
          disabled={busy}
          aria-label={`Approve ${formatCurrency(payout.amount, payout.currency)} for ${payout.creator?.name ?? 'this member'}`}
        >
          Approve
        </Button>
        <Button
          size="small"
          variant="outlined"
          color="error"
          onClick={() => onReject(payout)}
          disabled={busy}
          aria-label={`Reject ${formatCurrency(payout.amount, payout.currency)} for ${payout.creator?.name ?? 'this member'}`}
        >
          Reject
        </Button>
      </Stack>
    )
  }

  if (payout.status === PAYOUT_STATUS.PROCESSING) {
    return (
      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Button
          size="small"
          variant="contained"
          onClick={() => onMarkPaid(payout)}
          disabled={busy}
          aria-label={`Mark ${formatCurrency(payout.amount, payout.currency)} for ${payout.creator?.name ?? 'this member'} as paid`}
        >
          Mark paid
        </Button>
      </Stack>
    )
  }

  return (
    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'right' }}>
      {payout.processedAt ? formatDate(payout.processedAt) : EMPTY_PLACEHOLDER}
    </Typography>
  )
}

/**
 * @param {object} props
 * @param {object[]} [props.rows] items from `paymentService.adminListSettlements`
 * @param {boolean} [props.loading=false]
 * @param {object} [props.error]
 * @param {() => void} [props.onRetry]
 * @param {object} [props.emptyState] forwarded to `EmptyState`
 * @param {object} [props.pagination] forwarded to `PaginationControl`
 * @param {boolean} [props.selectable=false] show the batch checkboxes
 * @param {string[]} [props.selected] ids currently selected
 * @param {(id: string) => void} [props.onToggle]
 * @param {(ids: string[]) => void} [props.onToggleAll] select/clear the page
 * @param {(payout: object) => void} props.onApprove
 * @param {(payout: object) => void} props.onReject
 * @param {(payout: object) => void} props.onMarkPaid
 * @param {boolean} [props.busy=false] a batch is running — freeze the row actions
 */
export default function SettlementQueue({
  rows = [],
  loading = false,
  error,
  onRetry,
  emptyState,
  pagination,
  selectable = false,
  selected = [],
  onToggle,
  onToggleAll,
  onApprove,
  onReject,
  onMarkPaid,
  busy = false,
}) {
  const selectedSet = new Set(selected)
  const selectableIds = rows
    .filter((row) => row.status === PAYOUT_STATUS.REQUESTED)
    .map((row) => row.id)
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedSet.has(id))
  const someSelected = selectableIds.some((id) => selectedSet.has(id))

  const columns = [
    ...(selectable
      ? [
          {
            key: 'select',
            width: 56,
            label: (
              <Checkbox
                checked={allSelected}
                indeterminate={!allSelected && someSelected}
                onChange={() => onToggleAll?.(selectableIds)}
                disabled={busy || selectableIds.length === 0}
                inputProps={{ 'aria-label': 'Select every settlement on this page' }}
              />
            ),
            render: (row) =>
              row.status === PAYOUT_STATUS.REQUESTED ? (
                <Checkbox
                  checked={selectedSet.has(row.id)}
                  onChange={() => onToggle?.(row.id)}
                  disabled={busy}
                  inputProps={{
                    'aria-label': `Select ${formatCurrency(row.amount, row.currency)} for ${row.creator?.name ?? 'this member'}`,
                  }}
                />
              ) : null,
          },
        ]
      : []),
    {
      key: 'creator',
      // "Member", not "Creator": since Prompt 34 an affiliate settlement sits
      // in the same queue, and the person waiting is not always a creator.
      label: 'Member',
      render: (row) => (
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          {row.creator?.id ? (
            <EntityRefChip
              type="user"
              id={row.creator.id}
              label={row.creator.name}
              maxLabelLength={22}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              {EMPTY_PLACEHOLDER}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" noWrap>
            {payoutMethodLabel(row.method) ?? 'No payout method on file'}
          </Typography>
        </Stack>
      ),
    },
    {
      key: 'source',
      label: 'Source',
      width: 130,
      render: (row) => <SourceChip payout={row} />,
    },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      width: 130,
      render: (row) => (
        <Typography variant="body2" sx={{ ...MONEY_SX, fontWeight: 700 }}>
          {formatCurrency(row.amount, row.currency)}
        </Typography>
      ),
    },
    {
      key: 'requestedAt',
      label: 'Requested',
      width: 170,
      render: (row) => (
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
            {formatDate(row.requestedAt)}
          </Typography>
          <AgeBadge date={row.requestedAt} noun="Requested" {...SETTLEMENT_SLA} />
        </Stack>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: 130,
      render: (row) =>
        row.status === PAYOUT_STATUS.REJECTED && row.rejectedReason ? (
          <Tooltip title={row.rejectedReason}>
            <Box component="span">
              <StatusChip status={row.status} size="sm" />
            </Box>
          </Tooltip>
        ) : (
          <StatusChip status={row.status} size="sm" tooltip />
        ),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      width: 200,
      render: (row) => (
        <RowActions
          payout={row}
          onApprove={onApprove}
          onReject={onReject}
          onMarkPaid={onMarkPaid}
          busy={busy}
        />
      ),
    },
  ]

  const renderMobileCard = (row) => (
    <Card variant="outlined">
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          {selectable && row.status === PAYOUT_STATUS.REQUESTED ? (
            <Checkbox
              checked={selectedSet.has(row.id)}
              onChange={() => onToggle?.(row.id)}
              disabled={busy}
              sx={{ mt: -1, ml: -1 }}
              inputProps={{
                'aria-label': `Select ${formatCurrency(row.amount, row.currency)} for ${row.creator?.name ?? 'this member'}`,
              }}
            />
          ) : null}

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="flex-start">
              <Typography variant="h6" component="p" sx={{ ...MONEY_SX, fontSize: '1.125rem' }}>
                {formatCurrency(row.amount, row.currency)}
              </Typography>
              <AgeBadge date={row.requestedAt} noun="Requested" {...SETTLEMENT_SLA} />
            </Stack>

            <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>
              {row.creator?.name ?? 'Member'}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p">
              {payoutMethodLabel(row.method) ?? 'No payout method on file'} · requested{' '}
              {formatDate(row.requestedAt)}
            </Typography>

            <Stack direction="row" spacing={1} sx={{ mt: 1 }} useFlexGap flexWrap="wrap">
              <StatusChip status={row.status} size="sm" />
              <SourceChip payout={row} />
            </Stack>

            {row.status === PAYOUT_STATUS.REJECTED && row.rejectedReason ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {row.rejectedReason}
              </Typography>
            ) : null}

            <Box sx={{ mt: 1.5 }}>
              <RowActions
                payout={row}
                onApprove={onApprove}
                onReject={onReject}
                onMarkPaid={onMarkPaid}
                busy={busy}
              />
            </Box>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )

  return (
    <DataTable
      ariaLabel="Settlement queue"
      columns={columns}
      rows={rows}
      loading={loading}
      error={error}
      onRetry={onRetry}
      emptyState={emptyState}
      renderMobileCard={renderMobileCard}
      pagination={pagination}
    />
  )
}
