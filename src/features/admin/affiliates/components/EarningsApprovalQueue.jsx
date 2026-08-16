import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Checkbox from '@mui/material/Checkbox'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

import StatusChip from '@/components/data-display/StatusChip'
import DataTable from '@/components/table/DataTable'
import { AFFILIATE_EARNING_STATUS } from '@/constants/statuses'
import { EARNING_SLA } from '@/features/admin/affiliates/utils/affiliateFilters'
import { AgeBadge, EntityRefChip } from '@/features/admin/shared'
import { EMPTY_PLACEHOLDER, formatCurrency, formatDate } from '@/utils/formatters'

// The commission approval queue — Prompt 34 §4.4, following Prompt 32's
// settlement-queue discipline exactly: oldest first, an `AgeBadge` on every row,
// checkboxes only where they can act, and each checkbox labelled with *which*
// commission it selects rather than "select row" (§12).
//
// Unlike a settlement, an admin here is deciding whether money is owed at all,
// so the row carries the evidence: which affiliate, which order, and how long
// the decision has been outstanding. The order links to the admin order detail
// screen — this is the console, not the member's dashboard, so the reference is
// live rather than masked.

/** Money is set in tabular numerals so a column of it lines up digit for digit. */
const MONEY_SX = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }

/** The action set for a row — only a `pending` earning has anything to decide. */
function RowActions({ earning, onApprove, onVoid, busy }) {
  if (earning.status !== AFFILIATE_EARNING_STATUS.PENDING) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'right' }}>
        {earning.paidAt
          ? formatDate(earning.paidAt)
          : earning.approvedAt
            ? formatDate(earning.approvedAt)
            : earning.voidedAt
              ? formatDate(earning.voidedAt)
              : EMPTY_PLACEHOLDER}
      </Typography>
    )
  }

  const who = earning.user?.name ?? 'this affiliate'
  const money = formatCurrency(earning.amount, earning.currency)

  return (
    <Stack direction="row" spacing={1} justifyContent="flex-end">
      <Button
        size="small"
        variant="contained"
        onClick={() => onApprove(earning)}
        disabled={busy}
        aria-label={`Approve ${money} of commission for ${who}`}
      >
        Approve
      </Button>
      <Button
        size="small"
        variant="outlined"
        color="error"
        onClick={() => onVoid(earning)}
        disabled={busy}
        aria-label={`Void ${money} of commission for ${who}`}
      >
        Void
      </Button>
    </Stack>
  )
}

/**
 * @param {object} props
 * @param {object[]} [props.rows] earnings from `affiliateService.adminListEarnings`
 * @param {boolean} [props.loading=false]
 * @param {object} [props.error]
 * @param {() => void} [props.onRetry]
 * @param {object} [props.emptyState] forwarded to `EmptyState`
 * @param {object} [props.pagination] forwarded to `PaginationControl`
 * @param {boolean} [props.selectable=false] show the batch checkboxes
 * @param {string[]} [props.selected] ids currently selected
 * @param {(id: string) => void} [props.onToggle]
 * @param {(ids: string[]) => void} [props.onToggleAll] select/clear the page
 * @param {(earning: object) => void} props.onApprove
 * @param {(earning: object) => void} props.onVoid
 * @param {boolean} [props.busy=false] a batch is running — freeze the row actions
 */
export default function EarningsApprovalQueue({
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
  onVoid,
  busy = false,
}) {
  const selectedSet = new Set(selected)
  const selectableIds = rows
    .filter((row) => row.status === AFFILIATE_EARNING_STATUS.PENDING)
    .map((row) => row.id)
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedSet.has(id))
  const someSelected = selectableIds.some((id) => selectedSet.has(id))

  const selectLabel = (row) =>
    `Select ${formatCurrency(row.amount, row.currency)} of commission for ${row.user?.name ?? 'this affiliate'}`

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
                inputProps={{ 'aria-label': 'Select every commission on this page' }}
              />
            ),
            render: (row) =>
              row.status === AFFILIATE_EARNING_STATUS.PENDING ? (
                <Checkbox
                  checked={selectedSet.has(row.id)}
                  onChange={() => onToggle?.(row.id)}
                  disabled={busy}
                  inputProps={{ 'aria-label': selectLabel(row) }}
                />
              ) : null,
          },
        ]
      : []),
    {
      key: 'affiliate',
      label: 'Affiliate',
      render: (row) => (
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          {row.user?.id ? (
            <EntityRefChip type="user" id={row.user.id} label={row.user.name} maxLabelLength={22} />
          ) : (
            <Typography variant="body2" color="text.secondary">
              {EMPTY_PLACEHOLDER}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" noWrap sx={{ fontFamily: 'monospace' }}>
            {row.affiliate?.code ?? EMPTY_PLACEHOLDER}
          </Typography>
        </Stack>
      ),
    },
    {
      key: 'orderId',
      label: 'Order',
      width: 170,
      render: (row) =>
        row.orderId ? (
          <EntityRefChip type="order" id={row.orderId} maxLabelLength={18} />
        ) : (
          <Typography variant="body2" color="text.secondary">
            {EMPTY_PLACEHOLDER}
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
      width: 180,
      render: (row) => (
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
            {formatDate(row.createdAt)}
          </Typography>
          {row.status === AFFILIATE_EARNING_STATUS.PENDING ? (
            <AgeBadge date={row.createdAt} noun="Waiting since" {...EARNING_SLA} />
          ) : null}
        </Stack>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: 120,
      render: (row) =>
        row.status === AFFILIATE_EARNING_STATUS.VOID && row.voidReason ? (
          <Tooltip title={row.voidReason}>
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
      width: 190,
      render: (row) => (
        <RowActions earning={row} onApprove={onApprove} onVoid={onVoid} busy={busy} />
      ),
    },
  ]

  const renderMobileCard = (row) => (
    <Card variant="outlined">
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          {selectable && row.status === AFFILIATE_EARNING_STATUS.PENDING ? (
            <Checkbox
              checked={selectedSet.has(row.id)}
              onChange={() => onToggle?.(row.id)}
              disabled={busy}
              sx={{ mt: -1, ml: -1 }}
              inputProps={{ 'aria-label': selectLabel(row) }}
            />
          ) : null}

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="flex-start">
              <Typography variant="h6" component="p" sx={{ ...MONEY_SX, fontSize: '1.125rem' }}>
                {formatCurrency(row.amount, row.currency)}
              </Typography>
              {row.status === AFFILIATE_EARNING_STATUS.PENDING ? (
                <AgeBadge date={row.createdAt} noun="Waiting since" {...EARNING_SLA} />
              ) : (
                <StatusChip status={row.status} size="sm" />
              )}
            </Stack>

            <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>
              {row.user?.name ?? 'Affiliate'}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p">
              {row.affiliate?.code ?? EMPTY_PLACEHOLDER} · earned {formatDate(row.createdAt)}
            </Typography>

            {row.voidReason ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {row.voidReason}
              </Typography>
            ) : null}

            <Box sx={{ mt: 1.5 }}>
              <RowActions earning={row} onApprove={onApprove} onVoid={onVoid} busy={busy} />
            </Box>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )

  return (
    <DataTable
      ariaLabel="Affiliate commission"
      columns={columns}
      rows={rows}
      loading={loading}
      error={error}
      onRetry={onRetry}
      emptyState={emptyState}
      pagination={pagination}
      renderMobileCard={renderMobileCard}
    />
  )
}
