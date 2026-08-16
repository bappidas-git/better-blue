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
import { PERMISSIONS } from '@/constants/permissions'
import { PAYOUT_STATUS, STATUS_META } from '@/constants/statuses'
import BatchActionBar from '@/features/admin/finance/components/BatchActionBar'
import SettlementQueue from '@/features/admin/finance/components/SettlementQueue'
import {
  FINANCE_EXPORT_LIMIT,
  FINANCE_PAGE_SIZE,
  SETTLEMENTS_PARAMS,
  SETTLEMENT_TABS,
  payoutMethodLabel,
  settlementTab,
} from '@/features/admin/finance/utils/financeFilters'
import { AdminPageGuard } from '@/features/admin/shared'
import StatCardGrid from '@/features/dashboard/components/StatCardGrid'
import { useAuth } from '@/context/AuthContext'
import useApiQuery from '@/hooks/useApiQuery'
import useListParams from '@/hooks/useListParams'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { API_ERROR_CODE } from '@/services/api/apiError'
import { paymentService } from '@/services/paymentService'
import { exportRowsAsCsv } from '@/utils/exportCsv'
import { formatCurrency, formatDate, formatNumber } from '@/utils/formatters'

// The creator settlement queue — Prompt 32 §4.3.
//
// A payout takes **two** deliberate steps through this screen: approving it
// moves the request to `processing` and moves no money; marking it paid writes
// the `payout` ledger row and is the only moment a creator's balance drops
// (`docs/payments.md` §5). They are separate because they are separate facts,
// and the confirmation on the second one says out loud that BetterBlue is not
// the thing that moved the money — the prototype has no bank, and pretending
// otherwise in a screen about somebody's wages would be the wrong kind of demo.
//
// Batch approval is **sequential**, not `Promise.all` (§7). Every item is
// attempted, one failure does not abort the rest, and the outcome is reported
// per item rather than as "some of these worked" — which is what a batch bar
// that swallows a rejection actually means.

const BATCH_LIMIT = 25

const EXPORT_COLUMNS = [
  { key: 'id', label: 'Payout ID' },
  { key: 'creatorId', label: 'Creator ID' },
  { key: 'creatorName', label: 'Creator', format: (row) => row.creator?.name ?? '' },
  { key: 'amount', label: 'Amount' },
  { key: 'currency', label: 'Currency' },
  { key: 'status', label: 'Status', format: (row) => STATUS_META[row.status]?.label ?? row.status },
  { key: 'method', label: 'Payout method', format: (row) => payoutMethodLabel(row.method) ?? '' },
  { key: 'requestedAt', label: 'Requested', format: (row) => formatDate(row.requestedAt) },
  { key: 'processedAt', label: 'Processed', format: (row) => formatDate(row.processedAt) },
  { key: 'rejectedReason', label: 'Rejection reason' },
]

export default function AdminSettlementsPage() {
  const { user: actor } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()

  const { values, setValues } = useListParams(SETTLEMENTS_PARAMS)
  const { tab, page } = values
  const current = settlementTab(tab)

  const [selected, setSelected] = useState([])
  const [progress, setProgress] = useState(null)
  const [batchReport, setBatchReport] = useState(null)
  const [exporting, setExporting] = useState(false)

  const {
    data: summary,
    isLoading: summaryLoading,
    refetch: refetchSummary,
  } = useApiQuery(() => paymentService.getSettlementSummary(), [])

  const {
    data: queue,
    isLoading,
    error,
    refetch,
  } = useApiQuery(
    () =>
      paymentService.adminListSettlements({
        status: current.status,
        page,
        limit: FINANCE_PAGE_SIZE,
      }),
    [current.status, page]
  )

  const rows = useMemo(() => queue?.items ?? [], [queue])

  const selectedRows = useMemo(
    () => rows.filter((row) => selected.includes(row.id)),
    [rows, selected]
  )
  const selectedTotal = selectedRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)

  /* -- after any write ----------------------------------------------------- */

  const refreshAll = useCallback(() => {
    refetch()
    refetchSummary()
  }, [refetch, refetchSummary])

  /**
   * Turns a failed write into the sentence the screen should show. A `conflict`
   * means somebody else moved this payout while the page was open, which is a
   * refetch and not an error the reader caused (§13).
   */
  const reportFailure = useCallback(
    (failure, fallback) => {
      if (failure?.code === API_ERROR_CODE.CONFLICT) {
        toast.warning('That settlement has already moved on.', {
          description: 'Somebody else has worked it. Reloading the queue now.',
        })
        refreshAll()
        return
      }
      toast.error(failure?.message ?? fallback)
    },
    [refreshAll, toast]
  )

  /* -- single-row actions -------------------------------------------------- */

  const approve = useCallback(
    async (payout) => {
      const ok = await confirm({
        title: 'Approve this payout?',
        message:
          `${formatCurrency(payout.amount, payout.currency)} to ${payout.creator?.name ?? 'this creator'} ` +
          `at ${payoutMethodLabel(payout.method) ?? 'their payout method on file'}. ` +
          'The request moves to Processing and the creator is told. No money moves yet — ' +
          'you confirm that separately once the transfer has gone out.',
        confirmLabel: 'Approve payout',
      })
      if (!ok) return

      try {
        await paymentService.processPayout(payout.id, { action: 'approve', actor })
        toast.success('Payout approved.', {
          description: 'It is now in Processing, waiting for you to confirm the transfer.',
        })
        setSelected((current2) => current2.filter((id) => id !== payout.id))
        refreshAll()
      } catch (failure) {
        reportFailure(failure, 'We could not approve that payout.')
      }
    },
    [actor, confirm, refreshAll, reportFailure, toast]
  )

  const reject = useCallback(
    async (payout) => {
      const result = await confirm({
        title: 'Reject this payout?',
        message:
          `${formatCurrency(payout.amount, payout.currency)} will not be sent to ` +
          `${payout.creator?.name ?? 'this creator'}. Their balance is untouched and they can ` +
          'request it again. Your reason is shown to them in full on their earnings screen.',
        confirmLabel: 'Reject payout',
        tone: 'danger',
        requireReason: true,
        reasonLabel: 'Why is this being rejected?',
        reasonHelperText: 'The creator reads this word for word — be specific and be kind.',
      })
      if (!result) return

      try {
        await paymentService.processPayout(payout.id, {
          action: 'reject',
          reason: result.reason,
          actor,
        })
        toast.success('Payout rejected.', {
          description: 'The creator has been told why, and their balance is unchanged.',
        })
        setSelected((current2) => current2.filter((id) => id !== payout.id))
        refreshAll()
      } catch (failure) {
        reportFailure(failure, 'We could not reject that payout.')
      }
    },
    [actor, confirm, refreshAll, reportFailure, toast]
  )

  const markPaid = useCallback(
    async (payout) => {
      const ok = await confirm({
        title: 'Confirm this payout has been sent?',
        message:
          `Funds are transferred outside BetterBlue — this records that ` +
          `${formatCurrency(payout.amount, payout.currency)} has already left for ` +
          `${payoutMethodLabel(payout.method) ?? 'the creator’s account'}. It writes the payout ` +
          'to the ledger and takes the amount off the creator’s balance. Only confirm it once ' +
          'the transfer is genuinely out.',
        confirmLabel: 'Yes, it has been sent',
      })
      if (!ok) return

      try {
        await paymentService.markPayoutPaid(payout.id, { actor })
        toast.success('Settlement recorded as paid.', {
          description: 'The ledger row is written and the creator has been notified.',
        })
        refreshAll()
      } catch (failure) {
        reportFailure(failure, 'We could not mark that payout paid.')
      }
    },
    [actor, confirm, refreshAll, reportFailure, toast]
  )

  /* -- batch approval ------------------------------------------------------ */

  const approveSelected = useCallback(async () => {
    const targets = selectedRows.slice(0, BATCH_LIMIT)
    if (targets.length === 0) return

    const total = targets.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
    const ok = await confirm({
      title: `Approve ${formatNumber(targets.length)} payouts?`,
      message:
        `${formatCurrency(total, targets[0]?.currency)} across ${formatNumber(targets.length)} ` +
        'requests moves to Processing, and every creator is told. No money moves yet — each ' +
        'transfer is confirmed separately once it has gone out. They are processed one at a ' +
        'time, and anything that fails is reported back to you individually.',
      confirmLabel: `Approve ${formatNumber(targets.length)}`,
    })
    if (!ok) return

    setBatchReport(null)
    const succeeded = []
    const failed = []

    // Sequential and exhaustive: `Promise.all` would reject on the first
    // failure and leave the rest in an unknown state, which is exactly the
    // silent partial failure §7 forbids.
    for (let index = 0; index < targets.length; index += 1) {
      const payout = targets[index]
      setProgress({ done: index, total: targets.length })
      try {
        // eslint-disable-next-line no-await-in-loop
        await paymentService.processPayout(payout.id, { action: 'approve', actor })
        succeeded.push(payout)
      } catch (failure) {
        failed.push({ payout, message: failure?.message ?? 'It could not be approved.' })
      }
    }

    setProgress(null)
    setSelected([])
    setBatchReport({ succeeded, failed })
    refreshAll()

    if (failed.length === 0) {
      toast.success(`Approved ${formatNumber(succeeded.length)} payouts.`, {
        description: 'They are all in Processing now.',
      })
    } else {
      toast.warning(
        `${formatNumber(succeeded.length)} approved, ${formatNumber(failed.length)} could not be.`,
        { description: 'The details are listed above the queue.' }
      )
    }
  }, [actor, confirm, refreshAll, selectedRows, toast])

  /* -- export -------------------------------------------------------------- */

  const exportQueue = useCallback(async () => {
    setExporting(true)
    try {
      const all = await paymentService.adminListSettlements({
        status: current.status,
        page: 1,
        limit: FINANCE_EXPORT_LIMIT,
      })

      if (all.items.length === 0) {
        toast.info('There is nothing to export in this view.')
        return
      }
      if (!exportRowsAsCsv(`betterblue-settlements-${current.key}`, EXPORT_COLUMNS, all.items)) {
        toast.error('We could not build the file. Try again in a moment.')
        return
      }
      toast.success(`Exported ${formatNumber(all.items.length)} settlements.`)
    } catch (failure) {
      toast.error(failure?.message ?? 'We could not export the settlement queue.')
    } finally {
      setExporting(false)
    }
  }, [current.key, current.status, toast])

  /* -- rendering ----------------------------------------------------------- */

  const toggle = useCallback(
    (id) =>
      setSelected((currentIds) =>
        currentIds.includes(id) ? currentIds.filter((entry) => entry !== id) : [...currentIds, id]
      ),
    []
  )

  const toggleAll = useCallback(
    (ids) =>
      setSelected((currentIds) =>
        ids.every((id) => currentIds.includes(id))
          ? currentIds.filter((id) => !ids.includes(id))
          : [...new Set([...currentIds, ...ids])]
      ),
    []
  )

  const emptyState = {
    [PAYOUT_STATUS.REQUESTED]: {
      icon: 'solar:check-circle-linear',
      title: 'No payouts waiting',
      description: 'Nobody is waiting on us. A request appears here the moment a creator withdraws.',
    },
    [PAYOUT_STATUS.PROCESSING]: {
      icon: 'solar:clock-circle-linear',
      title: 'Nothing in flight',
      description: 'Approved payouts wait here until somebody confirms the transfer has gone out.',
    },
    [PAYOUT_STATUS.PAID]: {
      icon: 'solar:wallet-money-linear',
      title: 'No settled payouts yet',
      description: 'A settlement lands here once its transfer has been confirmed.',
    },
    [PAYOUT_STATUS.REJECTED]: {
      icon: 'solar:check-circle-linear',
      title: 'No rejected payouts',
      description: 'Nothing has been turned down. That is the way it should stay.',
    },
  }[current.status]

  const summaryItems = [
    {
      key: 'pending',
      label: 'Waiting to be paid',
      value: summary?.pendingTotal ?? 0,
      format: (amount) => formatCurrency(amount, summary?.currency, { hideDecimals: true }),
      icon: 'solar:clock-circle-linear',
      iconTone: summary?.pendingCount > 0 ? 'warning' : 'success',
    },
    {
      key: 'paid',
      label: 'Paid this month',
      value: summary?.paidThisMonth ?? 0,
      format: (amount) => formatCurrency(amount, summary?.currency, { hideDecimals: true }),
      icon: 'solar:wallet-money-linear',
      iconTone: 'success',
    },
  ]

  return (
    <DashboardPage
      title="Settlements"
      subtitle="Creator payout requests, oldest first — approve, reject, and confirm the transfer."
      maxWidth={false}
      actions={
        <Button
          variant="outlined"
          onClick={exportQueue}
          disabled={exporting || isLoading}
          aria-label="Export this settlement queue as a CSV file"
          startIcon={
            <Icon icon="solar:download-minimalistic-linear" width={18} aria-hidden="true" />
          }
        >
          {exporting ? 'Exporting…' : 'Export CSV'}
        </Button>
      }
    >
      <AdminPageGuard permission={PERMISSIONS.SETTLEMENTS_PROCESS}>
        <Stack spacing={{ xs: 2, md: 2.5 }}>
          <Box sx={{ maxWidth: { md: 560 } }}>
            <StatCardGrid
              items={summaryItems}
              loading={summaryLoading}
              skeletonCount={2}
              sx={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
            />
          </Box>

          <Tabs
            value={current.key}
            onChange={(event, next) => {
              setSelected([])
              setBatchReport(null)
              setValues({ tab: next })
            }}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            aria-label="Settlement queues"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            {SETTLEMENT_TABS.map((entry) => (
              <Tab
                key={entry.key}
                value={entry.key}
                label={entry.label}
                sx={{ minHeight: 48, textTransform: 'none', fontWeight: 600 }}
              />
            ))}
          </Tabs>

          {/* Per-item outcomes from the last batch. It stays until the reader
              dismisses it or changes tab — a toast is not where you put a list
              of things that did not happen (§13). */}
          {batchReport?.failed?.length ? (
            <Alert severity="warning" onClose={() => setBatchReport(null)}>
              <AlertTitle>
                {formatNumber(batchReport.succeeded.length)} approved,{' '}
                {formatNumber(batchReport.failed.length)} could not be
              </AlertTitle>
              <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 2.5 }}>
                {batchReport.failed.map(({ payout, message }) => (
                  <Typography component="li" variant="body2" key={payout.id}>
                    <strong>
                      {payout.creator?.name ?? payout.creatorId} ·{' '}
                      {formatCurrency(payout.amount, payout.currency)}
                    </strong>{' '}
                    — {message}
                  </Typography>
                ))}
              </Stack>
            </Alert>
          ) : null}

          <SettlementQueue
            rows={rows}
            loading={isLoading}
            error={error}
            onRetry={refetch}
            emptyState={emptyState}
            selectable={current.status === PAYOUT_STATUS.REQUESTED}
            selected={selected}
            onToggle={toggle}
            onToggleAll={toggleAll}
            onApprove={approve}
            onReject={reject}
            onMarkPaid={markPaid}
            busy={Boolean(progress)}
            pagination={{
              page,
              pageSize: FINANCE_PAGE_SIZE,
              total: queue?.total ?? 0,
              onPageChange: (next) => setValues({ page: next }),
              itemLabel: 'settlements',
            }}
          />
        </Stack>

        <BatchActionBar
          count={selected.length}
          total={selectedTotal}
          currency={queue?.items?.[0]?.currency}
          onApprove={approveSelected}
          onClear={() => setSelected([])}
          progress={progress}
        />
      </AdminPageGuard>
    </DashboardPage>
  )
}
