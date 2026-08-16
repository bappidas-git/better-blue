import { useCallback, useMemo, useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'

import { useConfirm } from '@/components/feedback/ConfirmDialogProvider'
import { useToast } from '@/components/feedback/ToastProvider'
import FeatureGate from '@/components/FeatureGate'
import FilterChipGroup from '@/components/inputs/FilterChipGroup'
import { PERMISSIONS } from '@/constants/permissions'
import {
  AFFILIATE_EARNING_STATUS,
  AFFILIATE_PROFILE_STATUS,
  PAYOUT_SOURCE,
  PAYOUT_STATUS,
  STATUS_META,
} from '@/constants/statuses'
import AffiliateProfilesTable from '@/features/admin/affiliates/components/AffiliateProfilesTable'
import EarningsApprovalQueue from '@/features/admin/affiliates/components/EarningsApprovalQueue'
import ProgramStatsCards from '@/features/admin/affiliates/components/ProgramStatsCards'
import {
  AFFILIATE_BATCH_LIMIT,
  AFFILIATE_EXPORT_LIMIT,
  AFFILIATE_PAGE_SIZE,
  AFFILIATE_PAYOUT_QUEUE,
  AFFILIATE_TAB,
  AFFILIATE_TABS,
  AFFILIATES_PARAMS,
  EARNING_QUEUE,
  affiliatePayoutQueue,
  earningQueue,
} from '@/features/admin/affiliates/utils/affiliateFilters'
import BatchActionBar from '@/features/admin/finance/components/BatchActionBar'
import SettlementQueue from '@/features/admin/finance/components/SettlementQueue'
import { payoutMethodLabel } from '@/features/admin/finance/utils/financeFilters'
import { AdminPageGuard } from '@/features/admin/shared'
import { useAuth } from '@/context/AuthContext'
import useApiQuery from '@/hooks/useApiQuery'
import useListParams from '@/hooks/useListParams'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { affiliateService } from '@/services/affiliateService'
import { API_ERROR_CODE } from '@/services/api/apiError'
import { paymentService } from '@/services/paymentService'
import { exportRowsAsCsv } from '@/utils/exportCsv'
import { formatCurrency, formatDate, formatNumber } from '@/utils/formatters'

// `/admin/affiliates` — the referral program's control room (Prompt 34 §4.4).
//
// Three tabs, one per job: who is in the program, what commission is waiting on
// a decision, and which payouts are waiting on a transfer.
//
// **The payouts tab reuses Prompt 32's queue rather than reimplementing it.**
// An affiliate settlement is a `payouts` row with `source: 'affiliate'`, moved
// by the same `processPayout` / `markPayoutPaid` calls a creator settlement is,
// so this tab passes a source filter to `adminListSettlements` and renders the
// same `SettlementQueue` component with the same three handlers. The alternative
// — a "Process in Settlements" link — would have split one job across two
// screens and left this one unable to answer its own question.
//
// Approving is **batched and sequential**, exactly as Prompt 32's is: every item
// is attempted, one failure does not abort the rest, and the outcome is reported
// per item rather than as "some of these worked" (§7).

/** The roster's only filter. Two states, so chips rather than a select. */
const PROFILE_STATUS_FILTERS = [
  {
    value: AFFILIATE_PROFILE_STATUS.ACTIVE,
    label: STATUS_META[AFFILIATE_PROFILE_STATUS.ACTIVE]?.label ?? 'Active',
  },
  {
    value: AFFILIATE_PROFILE_STATUS.SUSPENDED,
    label: STATUS_META[AFFILIATE_PROFILE_STATUS.SUSPENDED]?.label ?? 'Suspended',
  },
]

const EARNINGS_EXPORT_COLUMNS = [
  { key: 'id', label: 'Earning ID' },
  { key: 'affiliateId', label: 'Affiliate ID' },
  { key: 'code', label: 'Code', format: (row) => row.affiliate?.code ?? '' },
  { key: 'member', label: 'Member', format: (row) => row.user?.name ?? '' },
  { key: 'orderId', label: 'Order ID' },
  { key: 'amount', label: 'Amount' },
  { key: 'currency', label: 'Currency' },
  { key: 'status', label: 'Status', format: (row) => STATUS_META[row.status]?.label ?? row.status },
  { key: 'createdAt', label: 'Earned', format: (row) => formatDate(row.createdAt) },
  { key: 'approvedAt', label: 'Approved', format: (row) => formatDate(row.approvedAt) },
  { key: 'paidAt', label: 'Paid', format: (row) => formatDate(row.paidAt) },
  { key: 'voidReason', label: 'Void reason' },
]

export default function AdminAffiliatesPage() {
  const { user: actor } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()

  const { values, setValues } = useListParams(AFFILIATES_PARAMS)
  const { tab, status, queue, payoutQueue, page } = values
  const currentEarnings = earningQueue(queue)
  const currentPayouts = affiliatePayoutQueue(payoutQueue)

  const [selected, setSelected] = useState([])
  const [progress, setProgress] = useState(null)
  const [batchReport, setBatchReport] = useState(null)
  const [exporting, setExporting] = useState(false)

  /* -- data ---------------------------------------------------------------- */

  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useApiQuery(() => affiliateService.getProgramStats(), [])

  const {
    data: profiles,
    isLoading: profilesLoading,
    error: profilesError,
    refetch: refetchProfiles,
  } = useApiQuery(
    () =>
      affiliateService.adminListProfiles({
        page,
        limit: AFFILIATE_PAGE_SIZE,
        filters: status ? { status } : {},
      }),
    [page, status],
    { enabled: tab === AFFILIATE_TAB.AFFILIATES }
  )

  const {
    data: earnings,
    isLoading: earningsLoading,
    error: earningsError,
    refetch: refetchEarnings,
  } = useApiQuery(
    () =>
      affiliateService.adminListEarnings({
        status: currentEarnings.status,
        page,
        limit: AFFILIATE_PAGE_SIZE,
      }),
    [currentEarnings.status, page],
    { enabled: tab === AFFILIATE_TAB.EARNINGS }
  )

  const {
    data: payouts,
    isLoading: payoutsLoading,
    error: payoutsError,
    refetch: refetchPayouts,
  } = useApiQuery(
    () =>
      paymentService.adminListSettlements({
        status: currentPayouts.status,
        source: PAYOUT_SOURCE.AFFILIATE,
        page,
        limit: AFFILIATE_PAGE_SIZE,
      }),
    [currentPayouts.status, page],
    { enabled: tab === AFFILIATE_TAB.PAYOUTS }
  )

  const earningRows = useMemo(() => earnings?.items ?? [], [earnings])
  const selectedRows = useMemo(
    () => earningRows.filter((row) => selected.includes(row.id)),
    [earningRows, selected]
  )
  const selectedTotal = selectedRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)

  /* -- after any write ----------------------------------------------------- */

  const refreshAll = useCallback(() => {
    refetchStats()
    if (tab === AFFILIATE_TAB.AFFILIATES) refetchProfiles()
    if (tab === AFFILIATE_TAB.EARNINGS) refetchEarnings()
    if (tab === AFFILIATE_TAB.PAYOUTS) refetchPayouts()
  }, [refetchEarnings, refetchPayouts, refetchProfiles, refetchStats, tab])

  /**
   * Turns a failed write into the sentence the screen should show. A `conflict`
   * means somebody else moved this record while the page was open, which is a
   * refetch and not an error the reader caused (§13).
   */
  const reportFailure = useCallback(
    (failure, fallback) => {
      if (failure?.code === API_ERROR_CODE.CONFLICT) {
        toast.warning('That record has already moved on.', {
          description: 'Somebody else has worked it. Reloading now.',
        })
        refreshAll()
        return
      }
      toast.error(failure?.message ?? fallback)
    },
    [refreshAll, toast]
  )

  /* -- affiliate accounts -------------------------------------------------- */

  const suspend = useCallback(
    async (profile) => {
      const result = await confirm({
        title: 'Suspend this affiliate account?',
        message:
          `${profile.user?.name ?? 'This member'}’s code (${profile.code}) stops recording signups ` +
          'immediately, and no further commission accrues. Commission they have already earned is ' +
          'not affected — void it separately if that is what you mean to do. They are told, and ' +
          'your reason is included.',
        confirmLabel: 'Suspend account',
        tone: 'danger',
        requireReason: true,
        reasonLabel: 'Why is this account being suspended?',
        reasonHelperText: 'The member reads this word for word — be specific and be kind.',
      })
      if (!result) return

      try {
        await affiliateService.setProfileStatus(profile.id, {
          status: AFFILIATE_PROFILE_STATUS.SUSPENDED,
          reason: result.reason,
          actor,
        })
        toast.success('Affiliate account suspended.', {
          description: 'The referral code has stopped capturing signups.',
        })
        refreshAll()
      } catch (failure) {
        reportFailure(failure, 'We could not suspend that affiliate account.')
      }
    },
    [actor, confirm, refreshAll, reportFailure, toast]
  )

  const reactivate = useCallback(
    async (profile) => {
      const ok = await confirm({
        title: 'Reactivate this affiliate account?',
        message:
          `${profile.user?.name ?? 'This member'}’s code (${profile.code}) starts recording signups ` +
          'again straight away, and new referrals will accrue commission as normal. They are told.',
        confirmLabel: 'Reactivate account',
      })
      if (!ok) return

      try {
        await affiliateService.setProfileStatus(profile.id, {
          status: AFFILIATE_PROFILE_STATUS.ACTIVE,
          actor,
        })
        toast.success('Affiliate account reactivated.')
        refreshAll()
      } catch (failure) {
        reportFailure(failure, 'We could not reactivate that affiliate account.')
      }
    },
    [actor, confirm, refreshAll, reportFailure, toast]
  )

  /* -- commission ---------------------------------------------------------- */

  const approveEarning = useCallback(
    async (earning) => {
      const ok = await confirm({
        title: 'Approve this commission?',
        message:
          `${formatCurrency(earning.amount, earning.currency)} to ${earning.user?.name ?? 'this affiliate'} ` +
          'becomes payable, and they are told it is ready. It is paid when they request a payout ' +
          'and finance confirms the transfer.',
        confirmLabel: 'Approve commission',
      })
      if (!ok) return

      try {
        await affiliateService.approveEarning(earning.id, { actor })
        toast.success('Commission approved.', {
          description: 'The affiliate can now request it as a payout.',
        })
        setSelected((ids) => ids.filter((id) => id !== earning.id))
        refreshAll()
      } catch (failure) {
        reportFailure(failure, 'We could not approve that commission.')
      }
    },
    [actor, confirm, refreshAll, reportFailure, toast]
  )

  const voidEarning = useCallback(
    async (earning) => {
      const result = await confirm({
        title: 'Void this commission?',
        message:
          `${formatCurrency(earning.amount, earning.currency)} will be removed from ` +
          `${earning.user?.name ?? 'this affiliate'}’s balance and cannot be paid out. Their ` +
          'referral stays converted. Your reason is shown to them in full.',
        confirmLabel: 'Void commission',
        tone: 'danger',
        requireReason: true,
        reasonLabel: 'Why is this commission being voided?',
        reasonHelperText: 'The affiliate reads this word for word — be specific and be kind.',
      })
      if (!result) return

      try {
        await affiliateService.voidEarning(earning.id, { reason: result.reason, actor })
        toast.success('Commission voided.', {
          description: 'The affiliate has been told why, and their balance has been adjusted.',
        })
        setSelected((ids) => ids.filter((id) => id !== earning.id))
        refreshAll()
      } catch (failure) {
        reportFailure(failure, 'We could not void that commission.')
      }
    },
    [actor, confirm, refreshAll, reportFailure, toast]
  )

  const approveSelected = useCallback(async () => {
    const targets = selectedRows.slice(0, AFFILIATE_BATCH_LIMIT)
    if (targets.length === 0) return

    const total = targets.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
    const ok = await confirm({
      title: `Approve ${formatNumber(targets.length)} commissions?`,
      message:
        `${formatCurrency(total, targets[0]?.currency)} across ${formatNumber(targets.length)} ` +
        'records becomes payable, and every affiliate is told. They are processed one at a time, ' +
        'and anything that fails is reported back to you individually.',
      confirmLabel: `Approve ${formatNumber(targets.length)}`,
    })
    if (!ok) return

    setBatchReport(null)
    const succeeded = []
    const failed = []

    // Sequential and exhaustive: `Promise.all` would reject on the first
    // failure and leave the rest in an unknown state — the silent partial
    // failure §7 forbids. JSON Server also loses concurrent writes.
    for (let index = 0; index < targets.length; index += 1) {
      const earning = targets[index]
      setProgress({ done: index, total: targets.length })
      try {
        // eslint-disable-next-line no-await-in-loop
        await affiliateService.approveEarning(earning.id, { actor })
        succeeded.push(earning)
      } catch (failure) {
        failed.push({ earning, message: failure?.message ?? 'It could not be approved.' })
      }
    }

    setProgress(null)
    setSelected([])
    setBatchReport({ succeeded, failed })
    refreshAll()

    if (failed.length === 0) {
      toast.success(`Approved ${formatNumber(succeeded.length)} commissions.`, {
        description: 'Every affiliate has been told their commission is ready.',
      })
    } else {
      toast.warning(
        `${formatNumber(succeeded.length)} approved, ${formatNumber(failed.length)} could not be.`,
        { description: 'The details are listed above the queue.' }
      )
    }
  }, [actor, confirm, refreshAll, selectedRows, toast])

  /* -- payouts (Prompt 32's machinery, filtered to this source) ------------ */

  const approvePayout = useCallback(
    async (payout) => {
      const ok = await confirm({
        title: 'Approve this affiliate payout?',
        message:
          `${formatCurrency(payout.amount, payout.currency)} to ${payout.creator?.name ?? 'this member'} ` +
          `at ${payoutMethodLabel(payout.method) ?? 'the payout details on their account'}. ` +
          'The request moves to Processing and the affiliate is told. No money moves yet — you ' +
          'confirm that separately once the transfer has gone out.',
        confirmLabel: 'Approve payout',
      })
      if (!ok) return

      try {
        await paymentService.processPayout(payout.id, { action: 'approve', actor })
        toast.success('Affiliate payout approved.', {
          description: 'It is now in Processing, waiting for you to confirm the transfer.',
        })
        refreshAll()
      } catch (failure) {
        reportFailure(failure, 'We could not approve that payout.')
      }
    },
    [actor, confirm, refreshAll, reportFailure, toast]
  )

  const rejectPayout = useCallback(
    async (payout) => {
      const result = await confirm({
        title: 'Reject this affiliate payout?',
        message:
          `${formatCurrency(payout.amount, payout.currency)} will not be sent to ` +
          `${payout.creator?.name ?? 'this member'}. Their approved commission is untouched and ` +
          'they can request it again. Your reason is shown to them in full.',
        confirmLabel: 'Reject payout',
        tone: 'danger',
        requireReason: true,
        reasonLabel: 'Why is this being rejected?',
        reasonHelperText: 'The affiliate reads this word for word — be specific and be kind.',
      })
      if (!result) return

      try {
        await paymentService.processPayout(payout.id, {
          action: 'reject',
          reason: result.reason,
          actor,
        })
        toast.success('Affiliate payout rejected.', {
          description: 'They have been told why, and their commission is unchanged.',
        })
        refreshAll()
      } catch (failure) {
        reportFailure(failure, 'We could not reject that payout.')
      }
    },
    [actor, confirm, refreshAll, reportFailure, toast]
  )

  const markPayoutPaid = useCallback(
    async (payout) => {
      const ok = await confirm({
        title: 'Confirm this payout has been sent?',
        message:
          'Funds are transferred outside BetterBlue — this records that ' +
          `${formatCurrency(payout.amount, payout.currency)} has already left for ` +
          `${payoutMethodLabel(payout.method) ?? 'the affiliate’s account'}. It marks the ` +
          'commission behind it as paid and writes the ledger rows. Only confirm it once the ' +
          'transfer is genuinely out.',
        confirmLabel: 'Yes, it has been sent',
      })
      if (!ok) return

      try {
        await paymentService.markPayoutPaid(payout.id, { actor })
        toast.success('Affiliate payout recorded as paid.', {
          description: 'The commission behind it is now marked paid.',
        })
        refreshAll()
      } catch (failure) {
        reportFailure(failure, 'We could not mark that payout paid.')
      }
    },
    [actor, confirm, refreshAll, reportFailure, toast]
  )

  /* -- export -------------------------------------------------------------- */

  const exportEarnings = useCallback(async () => {
    setExporting(true)
    try {
      const all = await affiliateService.adminListEarnings({
        status: currentEarnings.status,
        page: 1,
        limit: AFFILIATE_EXPORT_LIMIT,
      })

      if (all.items.length === 0) {
        toast.info('There is nothing to export in this view.')
        return
      }
      if (
        !exportRowsAsCsv(`betterblue-affiliate-${currentEarnings.key}`, EARNINGS_EXPORT_COLUMNS, all.items)
      ) {
        toast.error('We could not build the file. Try again in a moment.')
        return
      }
      toast.success(`Exported ${formatNumber(all.items.length)} commission records.`)
    } catch (failure) {
      toast.error(failure?.message ?? 'We could not export the commission queue.')
    } finally {
      setExporting(false)
    }
  }, [currentEarnings.key, currentEarnings.status, toast])

  /* -- selection ----------------------------------------------------------- */

  const toggle = useCallback(
    (id) =>
      setSelected((ids) => (ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id])),
    []
  )

  const toggleAll = useCallback(
    (ids) =>
      setSelected((current) =>
        ids.every((id) => current.includes(id))
          ? current.filter((id) => !ids.includes(id))
          : [...new Set([...current, ...ids])]
      ),
    []
  )

  const changeTab = (next) => {
    setSelected([])
    setBatchReport(null)
    setValues({ tab: next, page: 1 })
  }

  /* -- empty states -------------------------------------------------------- */

  const earningsEmptyState = {
    [AFFILIATE_EARNING_STATUS.PENDING]: {
      icon: 'solar:check-circle-linear',
      title: 'No commission waiting',
      description:
        'Nothing needs a decision. Commission arrives here when a referred business completes its first order.',
    },
    [AFFILIATE_EARNING_STATUS.APPROVED]: {
      icon: 'solar:verified-check-linear',
      title: 'Nothing approved and unpaid',
      description: 'Approved commission waits here until the affiliate requests a payout.',
    },
    [AFFILIATE_EARNING_STATUS.PAID]: {
      icon: 'solar:wallet-money-linear',
      title: 'No commission paid yet',
      description: 'A record lands here once its payout has been confirmed as sent.',
    },
    [AFFILIATE_EARNING_STATUS.VOID]: {
      icon: 'solar:check-circle-linear',
      title: 'Nothing has been voided',
      description: 'That is the way it should stay.',
    },
  }[currentEarnings.status]

  const payoutsEmptyState = {
    [PAYOUT_STATUS.REQUESTED]: {
      icon: 'solar:check-circle-linear',
      title: 'No affiliate payouts waiting',
      description:
        'Nobody is waiting on us. A request appears here when an affiliate withdraws their approved commission.',
    },
    [PAYOUT_STATUS.PROCESSING]: {
      icon: 'solar:clock-circle-linear',
      title: 'Nothing in flight',
      description: 'Approved payouts wait here until somebody confirms the transfer has gone out.',
    },
    [PAYOUT_STATUS.PAID]: {
      icon: 'solar:wallet-money-linear',
      title: 'No settled affiliate payouts yet',
      description: 'A settlement lands here once its transfer has been confirmed.',
    },
    [PAYOUT_STATUS.REJECTED]: {
      icon: 'solar:check-circle-linear',
      title: 'No rejected affiliate payouts',
      description: 'Nothing has been turned down. That is the way it should stay.',
    },
  }[currentPayouts.status]

  /* -- rendering ----------------------------------------------------------- */

  const paginationFor = (result, itemLabel) => ({
    page,
    pageSize: AFFILIATE_PAGE_SIZE,
    total: result?.total ?? 0,
    onPageChange: (next) => setValues({ page: next }),
    itemLabel,
  })

  return (
    <DashboardPage
      title="Affiliates"
      subtitle="The referral program: who is in it, what it owes, and what it has paid."
      maxWidth={false}
      actions={
        tab === AFFILIATE_TAB.EARNINGS ? (
          <Button
            variant="outlined"
            onClick={exportEarnings}
            disabled={exporting || earningsLoading}
            aria-label="Export this commission queue as a CSV file"
            startIcon={
              <Icon icon="solar:download-minimalistic-linear" width={18} aria-hidden="true" />
            }
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        ) : null
      }
    >
      <AdminPageGuard permission={PERMISSIONS.AFFILIATES_MANAGE}>
        <FeatureGate
          flag="affiliateProgram"
          icon="solar:users-group-rounded-linear"
          title="The referral program is switched off"
          description="Nothing is accruing while the affiliate feature flag is off. Existing accounts, commission, and payouts are untouched — switch the flag back on in platform settings to work the queues."
        >
          <Stack spacing={{ xs: 2, md: 2.5 }}>
            <ProgramStatsCards stats={stats} loading={statsLoading} />

            <Tabs
              value={tab}
              onChange={(event, next) => changeTab(next)}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              aria-label="Affiliate program"
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              {AFFILIATE_TABS.map((entry) => (
                <Tab
                  key={entry.key}
                  value={entry.key}
                  label={entry.label}
                  sx={{ minHeight: 48, textTransform: 'none', fontWeight: 600 }}
                />
              ))}
            </Tabs>

            {tab === AFFILIATE_TAB.AFFILIATES ? (
              <>
                <FilterChipGroup
                  label="Filter affiliate accounts by status"
                  size="sm"
                  options={PROFILE_STATUS_FILTERS}
                  value={status}
                  onChange={(next) => setValues({ status: next, page: 1 })}
                />
                <AffiliateProfilesTable
                  rows={profiles?.items ?? []}
                  loading={profilesLoading}
                  error={profilesError}
                  onRetry={refetchProfiles}
                  pagination={paginationFor(profiles, 'affiliates')}
                  onSuspend={suspend}
                  onReactivate={reactivate}
                />
              </>
            ) : null}

            {tab === AFFILIATE_TAB.EARNINGS ? (
              <>
                <Tabs
                  value={currentEarnings.key}
                  onChange={(event, next) => {
                    setSelected([])
                    setBatchReport(null)
                    setValues({ queue: next, page: 1 })
                  }}
                  variant="scrollable"
                  scrollButtons="auto"
                  allowScrollButtonsMobile
                  aria-label="Commission queues"
                >
                  {EARNING_QUEUE.map((entry) => (
                    <Tab
                      key={entry.key}
                      value={entry.key}
                      label={entry.label}
                      sx={{ minHeight: 44, textTransform: 'none' }}
                    />
                  ))}
                </Tabs>

                {/* Per-item outcomes from the last batch. It stays until the
                    reader dismisses it or changes queue — a toast is not where
                    you put a list of things that did not happen (§13). */}
                {batchReport?.failed?.length ? (
                  <Alert severity="warning" onClose={() => setBatchReport(null)}>
                    <AlertTitle>
                      {formatNumber(batchReport.succeeded.length)} approved,{' '}
                      {formatNumber(batchReport.failed.length)} could not be
                    </AlertTitle>
                    <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 2.5 }}>
                      {batchReport.failed.map(({ earning, message }) => (
                        <Typography component="li" variant="body2" key={earning.id}>
                          <strong>
                            {earning.user?.name ?? earning.affiliateId} ·{' '}
                            {formatCurrency(earning.amount, earning.currency)}
                          </strong>{' '}
                          — {message}
                        </Typography>
                      ))}
                    </Stack>
                  </Alert>
                ) : null}

                <EarningsApprovalQueue
                  rows={earningRows}
                  loading={earningsLoading}
                  error={earningsError}
                  onRetry={refetchEarnings}
                  emptyState={earningsEmptyState}
                  pagination={paginationFor(earnings, 'commission records')}
                  selectable={currentEarnings.actionable}
                  selected={selected}
                  onToggle={toggle}
                  onToggleAll={toggleAll}
                  onApprove={approveEarning}
                  onVoid={voidEarning}
                  busy={Boolean(progress)}
                />
              </>
            ) : null}

            {tab === AFFILIATE_TAB.PAYOUTS ? (
              <>
                <Tabs
                  value={currentPayouts.key}
                  onChange={(event, next) => setValues({ payoutQueue: next, page: 1 })}
                  variant="scrollable"
                  scrollButtons="auto"
                  allowScrollButtonsMobile
                  aria-label="Affiliate payout queues"
                >
                  {AFFILIATE_PAYOUT_QUEUE.map((entry) => (
                    <Tab
                      key={entry.key}
                      value={entry.key}
                      label={entry.label}
                      sx={{ minHeight: 44, textTransform: 'none' }}
                    />
                  ))}
                </Tabs>

                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Affiliate settlements move through the same queue creator payouts do — they
                    also appear in Settlements, tagged with a source chip.
                  </Typography>
                  <SettlementQueue
                    rows={payouts?.items ?? []}
                    loading={payoutsLoading}
                    error={payoutsError}
                    onRetry={refetchPayouts}
                    emptyState={payoutsEmptyState}
                    pagination={paginationFor(payouts, 'payouts')}
                    onApprove={approvePayout}
                    onReject={rejectPayout}
                    onMarkPaid={markPayoutPaid}
                  />
                </Box>
              </>
            ) : null}
          </Stack>

          {tab === AFFILIATE_TAB.EARNINGS ? (
            <BatchActionBar
              count={selected.length}
              total={selectedTotal}
              currency={earningRows[0]?.currency}
              onApprove={approveSelected}
              onClear={() => setSelected([])}
              progress={progress}
            />
          ) : null}
        </FeatureGate>
      </AdminPageGuard>
    </DashboardPage>
  )
}
