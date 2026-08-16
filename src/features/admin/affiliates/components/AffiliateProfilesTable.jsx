import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

import StatusChip from '@/components/data-display/StatusChip'
import DataTable from '@/components/table/DataTable'
import { AFFILIATE_PROFILE_STATUS } from '@/constants/statuses'
import { EntityRefChip } from '@/features/admin/shared'
import { EMPTY_PLACEHOLDER, formatCurrency, formatDate, formatNumber } from '@/utils/formatters'

// The affiliate roster — Prompt 34 §4.4.
//
// One row per enrolled member, with the funnel and the money side by side,
// because the question this table answers is "is this account worth what it is
// costing us": a hundred clicks and no conversions is a very different account
// from two clicks and two conversions, and neither is legible without the other.
//
// The only action is suspend/reactivate. Suspending stops the code capturing
// immediately (`affiliateService.getCapturableByCode`) and takes nothing away —
// voiding commission is the earnings queue's job, and conflating the two would
// make a suspension impossible to undo.

/** Money is set in tabular numerals so a column of it lines up digit for digit. */
const MONEY_SX = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }

/** The funnel, as one cell: three numbers that only mean anything together. */
function Funnel({ profile }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ ...MONEY_SX }}>
      <Tooltip title="Link visits">
        <Typography variant="body2" color="text.secondary">
          {formatNumber(profile.clicks ?? 0)}
        </Typography>
      </Tooltip>
      <Typography variant="body2" color="text.disabled" aria-hidden="true">
        ·
      </Typography>
      <Tooltip title="Signups">
        <Typography variant="body2" color="text.secondary">
          {formatNumber(profile.signups ?? 0)}
        </Typography>
      </Tooltip>
      <Typography variant="body2" color="text.disabled" aria-hidden="true">
        ·
      </Typography>
      <Tooltip title="Conversions">
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {formatNumber(profile.conversions ?? 0)}
        </Typography>
      </Tooltip>
    </Stack>
  )
}

/** Pending / approved / paid for one affiliate, stacked so the states stay ordered. */
function Money({ profile }) {
  const currency = profile.currency
  return (
    <Stack spacing={0.25} sx={{ ...MONEY_SX, textAlign: 'right' }}>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {formatCurrency(profile.approvedEarnings ?? 0, currency)}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {formatCurrency(profile.pendingEarnings ?? 0, currency)} pending ·{' '}
        {formatCurrency(profile.paidEarnings ?? 0, currency)} paid
      </Typography>
    </Stack>
  )
}

/**
 * @param {object} props
 * @param {object[]} [props.rows] profiles from `affiliateService.adminListProfiles`
 * @param {boolean} [props.loading=false]
 * @param {object} [props.error]
 * @param {() => void} [props.onRetry]
 * @param {object} [props.pagination] forwarded to `PaginationControl`
 * @param {(profile: object) => void} props.onSuspend
 * @param {(profile: object) => void} props.onReactivate
 * @param {boolean} [props.busy=false]
 */
export default function AffiliateProfilesTable({
  rows = [],
  loading = false,
  error,
  onRetry,
  pagination,
  onSuspend,
  onReactivate,
  busy = false,
}) {
  const actionFor = (profile) =>
    profile.status === AFFILIATE_PROFILE_STATUS.SUSPENDED ? (
      <Button
        size="small"
        variant="outlined"
        disabled={busy}
        onClick={() => onReactivate(profile)}
        aria-label={`Reactivate the referral link for ${profile.user?.name ?? profile.code}`}
      >
        Reactivate
      </Button>
    ) : (
      <Button
        size="small"
        variant="outlined"
        color="error"
        disabled={busy}
        onClick={() => onSuspend(profile)}
        aria-label={`Suspend the referral link for ${profile.user?.name ?? profile.code}`}
      >
        Suspend
      </Button>
    )

  const columns = [
    {
      key: 'member',
      label: 'Member',
      render: (row) => (
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          {row.user?.id ? (
            <EntityRefChip type="user" id={row.user.id} label={row.user.name} maxLabelLength={22} />
          ) : (
            <Typography variant="body2" color="text.secondary">
              {EMPTY_PLACEHOLDER}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" noWrap>
            Joined {formatDate(row.enrolledAt)}
          </Typography>
        </Stack>
      ),
    },
    {
      key: 'code',
      label: 'Code',
      width: 150,
      render: (row) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
          {row.code}
        </Typography>
      ),
    },
    {
      key: 'funnel',
      label: 'Visits · signups · conversions',
      width: 200,
      render: (row) => <Funnel profile={row} />,
    },
    {
      key: 'money',
      label: 'Approved',
      align: 'right',
      width: 210,
      render: (row) => <Money profile={row} />,
    },
    {
      key: 'status',
      label: 'Status',
      width: 130,
      render: (row) =>
        row.status === AFFILIATE_PROFILE_STATUS.SUSPENDED && row.suspendedReason ? (
          <Tooltip title={row.suspendedReason}>
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
      width: 140,
      render: (row) => (
        <Stack direction="row" justifyContent="flex-end">
          {actionFor(row)}
        </Stack>
      ),
    },
  ]

  const renderMobileCard = (row) => (
    <Card variant="outlined">
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {row.user?.name ?? EMPTY_PLACEHOLDER}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ fontFamily: 'monospace' }}>
              {row.code}
            </Typography>
          </Box>
          <StatusChip status={row.status} size="sm" />
        </Stack>

        <Box sx={{ mt: 1.5 }}>
          <Funnel profile={row} />
        </Box>

        <Typography variant="body2" sx={{ mt: 1, ...MONEY_SX }}>
          {formatCurrency(row.approvedEarnings ?? 0, row.currency)} approved ·{' '}
          {formatCurrency(row.pendingEarnings ?? 0, row.currency)} pending
        </Typography>

        {row.status === AFFILIATE_PROFILE_STATUS.SUSPENDED && row.suspendedReason ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {row.suspendedReason}
          </Typography>
        ) : null}

        <Box sx={{ mt: 1.5 }}>{actionFor(row)}</Box>
      </CardContent>
    </Card>
  )

  return (
    <DataTable
      ariaLabel="Affiliate accounts"
      columns={columns}
      rows={rows}
      loading={loading}
      error={error}
      onRetry={onRetry}
      pagination={pagination}
      renderMobileCard={renderMobileCard}
      emptyState={{
        icon: 'solar:users-group-rounded-linear',
        title: 'Nobody has joined the referral program yet',
        description:
          'Members enrol from their own dashboard. Affiliate accounts and their referrals appear here as they do.',
      }}
    />
  )
}
