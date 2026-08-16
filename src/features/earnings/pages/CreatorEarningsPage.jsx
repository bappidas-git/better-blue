import { useCallback, useMemo, useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

import ErrorState from '@/components/feedback/ErrorState'
import { useToast } from '@/components/feedback/ToastProvider'
import { getStatusMeta } from '@/constants'
import { useAuth } from '@/context/AuthContext'
import ChartCard from '@/features/dashboard/components/ChartCard'
import ThemedLineChart from '@/features/dashboard/components/ThemedLineChart'
import { useDiscoveryParams } from '@/features/discovery/hooks/useDiscoveryParams'
import EarningsByOrderTable from '@/features/earnings/components/EarningsByOrderTable'
import EarningsSummaryCards from '@/features/earnings/components/EarningsSummaryCards'
import PayoutExplainer from '@/features/earnings/components/PayoutExplainer'
import PayoutsTab from '@/features/earnings/components/PayoutsTab'
import TransactionsTab from '@/features/earnings/components/TransactionsTab'
import WithdrawDialog from '@/features/earnings/components/WithdrawDialog'
import {
  CREATOR_EARNINGS_PARAMS,
  dayBoundaryIso,
  EARNINGS_TAB,
  EARNINGS_TABS,
} from '@/features/earnings/earningsFilters'
import { signedAmount } from '@/features/payments/ledgerDisplay'
import useApiMutation from '@/hooks/useApiMutation'
import useApiQuery from '@/hooks/useApiQuery'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { paths } from '@/routes/paths'
import { creatorProfileService } from '@/services/creatorProfileService'
import { paymentService } from '@/services/paymentService'
import { payoutService } from '@/services/payoutService'
import { exportRowsAsCsv } from '@/utils/exportCsv'
import { formatCurrency, formatDateTime } from '@/utils/formatters'

// Earnings — the creator's financial centre, and the answer to the only three
// money questions they have: what have I earned, where did every movement come
// from, and when does it reach my bank.
//
// One tab per question (00 §12: tabs in the URL, so a filtered ledger is a link
// somebody can send to support), and each tab loads independently — a failing
// payout query costs the payout list its contents and nothing else.
//
// **No arithmetic happens on this page.** Every figure — the four tiles, each
// row's net, the totals, the twelve month buckets, the payout minimum — arrives
// from `paymentService.getEarningsBreakdown`, which folds them from the same
// three reads so the tiles, the table, and the chart cannot disagree
// (Prompt 25 §7). The page decides layout, tone, and which state to draw.

/** Rows per page on the ledger and the payout list. */
const PAGE_SIZE = 10

/** Chart height by breakpoint (§11). */
const CHART_HEIGHT = { xs: 240, md: 300 }

/**
 * Rows a CSV export will pull. Deliberately capped rather than paged forever —
 * and reported when it bites, because a silently truncated export reads as a
 * complete one.
 */
const EXPORT_LIMIT = 500

/** Export columns. Separate from the table's: a spreadsheet wants raw facts. */
const EXPORT_COLUMNS = Object.freeze([
  { key: 'createdAt', label: 'Date', format: (row) => formatDateTime(row.createdAt) },
  { key: 'description', label: 'Description' },
  { key: 'type', label: 'Type', format: (row) => getStatusMeta(row.type).label },
  { key: 'amount', label: 'Amount', format: (row) => signedAmount(row) },
  { key: 'currency', label: 'Currency' },
  { key: 'balanceAfter', label: 'Balance after' },
  { key: 'orderId', label: 'Order' },
  { key: 'payoutId', label: 'Payout' },
  { key: 'id', label: 'Transaction' },
])

/** One sentence describing the earnings chart, for screen readers (§12). */
function earningsChartLabel(monthly, peak, currency) {
  if (!monthly?.length) return 'Net earnings by month over the last twelve months.'

  const money = (amount) => formatCurrency(amount, currency, { hideDecimals: true })
  const first = monthly[0]
  const last = monthly[monthly.length - 1]

  const trend =
    `Net earnings by month over the last twelve months, from ${money(first.amount)} in ` +
    `${first.label} to ${money(last.amount)} in ${last.label}.`

  return peak ? `${trend} Peaking at ${money(peak.amount)} in ${peak.label}.` : trend
}

export default function CreatorEarningsPage() {
  const { user } = useAuth()
  const creatorId = user?.id
  const toast = useToast()

  const { values, setValue, setValues, clearFilters, isFiltered } =
    useDiscoveryParams(CREATOR_EARNINGS_PARAMS)
  const { tab, type, from, to, page } = values

  const [isWithdrawOpen, setWithdrawOpen] = useState(false)
  const [isExporting, setExporting] = useState(false)

  /**
   * Switching tabs drops the filters that belong to the other one: a
   * `?type=payout` riding along on the Overview tab is a filter with no control
   * on screen and no effect on anything, which is exactly the state that turns
   * into a link nobody can reproduce.
   */
  const selectTab = useCallback(
    (next) =>
      setValues(
        next === EARNINGS_TAB.TRANSACTIONS
          ? { tab: next }
          : { tab: next, type: null, from: '', to: '' }
      ),
    [setValues]
  )

  /* -- the money, and where it can be sent -------------------------------- */

  const {
    data: breakdown,
    isLoading: breakdownLoading,
    error: breakdownError,
    refetch: refetchBreakdown,
  } = useApiQuery(() => paymentService.getEarningsBreakdown(creatorId), [creatorId], {
    enabled: Boolean(creatorId),
  })

  const { data: profile, isLoading: profileLoading } = useApiQuery(
    () => creatorProfileService.getByUserId(creatorId).catch(() => null),
    [creatorId],
    { enabled: Boolean(creatorId) }
  )

  /* -- the ledger ---------------------------------------------------------- */

  const ledgerFilters = useMemo(
    () => ({
      userId: creatorId,
      ...(type ? { type } : {}),
      ...(from ? { createdAt_gte: dayBoundaryIso(from, 'start') } : {}),
      ...(to ? { createdAt_lte: dayBoundaryIso(to, 'end') } : {}),
    }),
    [creatorId, type, from, to]
  )

  const {
    data: ledger,
    isLoading: ledgerLoading,
    error: ledgerError,
    refetch: refetchLedger,
  } = useApiQuery(
    () => paymentService.listTransactions({ page, limit: PAGE_SIZE, filters: ledgerFilters }),
    [page, ledgerFilters],
    { enabled: Boolean(creatorId) && tab === EARNINGS_TAB.TRANSACTIONS }
  )

  /* -- the settlements ----------------------------------------------------- */

  const {
    data: payouts,
    isLoading: payoutsLoading,
    error: payoutsError,
    refetch: refetchPayouts,
  } = useApiQuery(
    () => payoutService.listByCreator(creatorId, { page, limit: PAGE_SIZE }),
    [creatorId, page],
    { enabled: Boolean(creatorId) && tab === EARNINGS_TAB.PAYOUTS }
  )

  /* -- withdrawing --------------------------------------------------------- */

  const { mutate: requestPayout, isLoading: isRequesting } = useApiMutation((amount) =>
    paymentService.requestPayout(creatorId, { amount })
  )

  const summary = breakdown?.summary
  const currency = breakdown?.currency
  const available = summary?.available ?? 0
  const payoutMinimum = breakdown?.payoutMinimum ?? 0
  const payoutMethod = profile?.payoutMethod ?? null
  const hasMethod = Boolean(payoutMethod?.accountMasked)

  // The two gates, in the order a creator hits them. Below the minimum is
  // deliberately **not** a gate: the dialog explains it against the amount
  // actually typed, which is more useful than a button that will not press.
  const canWithdraw = !breakdownLoading && !profileLoading && hasMethod && available > 0
  const withdrawHint = breakdownLoading || profileLoading
    ? 'Loading your balance…'
    : !hasMethod
      ? 'Add a payout method on your profile before you withdraw.'
      : available <= 0
        ? 'Nothing is available to withdraw yet — earnings appear here once a buyer accepts a delivery.'
        : undefined

  const handleWithdraw = useCallback(
    async (amount) => {
      const payout = await requestPayout(amount)
      // The requested amount is reserved out of `available` the moment the row
      // exists (`docs/payments.md` §8), so both reads are refreshed before the
      // dialog's success card is dismissed — a second withdrawal of the same
      // money is impossible in the UI as well as in the service.
      refetchBreakdown()
      refetchPayouts()
      toast.success('Payout requested', {
        description: `${formatCurrency(payout.amount, payout.currency)} is with our finance team.`,
      })
      return payout
    },
    [refetchBreakdown, refetchPayouts, requestPayout, toast]
  )

  const exportLedger = useCallback(async () => {
    setExporting(true)
    try {
      const all = await paymentService.listTransactions({
        page: 1,
        limit: EXPORT_LIMIT,
        filters: ledgerFilters,
      })

      if (all.items.length === 0) {
        toast.info('There is nothing to export in this view.')
        return
      }

      const written = exportRowsAsCsv('betterblue-earnings', EXPORT_COLUMNS, all.items)
      if (!written) {
        toast.error('We could not build the file. Try again in a moment.')
        return
      }

      toast.success(`Exported ${all.items.length} transactions.`, {
        description:
          all.total > all.items.length
            ? `Your filters match ${all.total} rows; the export is capped at ${EXPORT_LIMIT}. Narrow the date range to get the rest.`
            : undefined,
      })
    } catch (failure) {
      toast.error(failure?.message ?? 'We could not export your transactions.')
    } finally {
      setExporting(false)
    }
  }, [ledgerFilters, toast])

  const clearAction = isFiltered
    ? { label: 'Clear filters', onClick: () => clearFilters(), variant: 'outlined' }
    : undefined

  return (
    <DashboardPage
      title="Earnings"
      subtitle="What you have earned, what is still in escrow, and when it reaches your bank."
    >
      <Tabs
        value={tab}
        onChange={(event, next) => selectTab(next)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        aria-label="Switch between earnings, transactions, and payouts"
        sx={{ borderBottom: 1, borderColor: 'divider', mb: { xs: 2, md: 2.5 } }}
      >
        {EARNINGS_TABS.map((entry) => (
          <Tab
            key={entry.key}
            value={entry.key}
            label={entry.label}
            sx={{ minHeight: 48, textTransform: 'none', fontWeight: 600 }}
          />
        ))}
      </Tabs>

      {breakdownError && tab !== EARNINGS_TAB.TRANSACTIONS ? (
        <ErrorState
          title="We could not load your earnings"
          message="Your balance is safe — this screen just needs another go."
          error={breakdownError}
          onRetry={refetchBreakdown}
        />
      ) : tab === EARNINGS_TAB.OVERVIEW ? (
        <Stack spacing={{ xs: 2, md: 3 }}>
          <EarningsSummaryCards
            summary={summary}
            currency={currency}
            loading={breakdownLoading}
            canWithdraw={canWithdraw}
            withdrawHint={withdrawHint}
            onWithdraw={() => setWithdrawOpen(true)}
          />

          <PayoutExplainer />

          <ChartCard
            title="Net earnings — last 12 months"
            subtitle="Released to you, after the BetterBlue commission"
            height={CHART_HEIGHT}
          >
            {breakdownLoading ? (
              <Skeleton
                variant="rounded"
                role="status"
                aria-busy="true"
                aria-label="Loading monthly earnings"
                sx={{ width: '100%', height: CHART_HEIGHT }}
              />
            ) : (
              <ThemedLineChart
                data={breakdown?.monthly ?? []}
                series={[{ key: 'amount', label: 'Net earnings' }]}
                valueFormat="currency"
                gradient
                height={CHART_HEIGHT}
                ariaLabel={earningsChartLabel(
                  breakdown?.monthly,
                  breakdown?.monthlyPeak,
                  currency
                )}
                emptyMessage="No earnings in the last twelve months"
              />
            )}
          </ChartCard>

          <Box>
            <Typography variant="h6" component="h2" sx={{ fontSize: '1.0625rem', mb: 2 }}>
              Earnings by order
            </Typography>

            <EarningsByOrderTable
              rows={breakdown?.rows}
              totals={breakdown?.totals}
              currency={currency}
              loading={breakdownLoading}
              emptyState={{
                icon: 'solar:bill-list-linear',
                title: 'No orders carrying money yet',
                description:
                  'Once a buyer funds an order, it appears here with its escrow status — and stays once the money is released to you.',
                primaryAction: {
                  label: 'Browse requests',
                  to: paths.CREATOR_BROWSE,
                  icon: 'solar:magnifer-linear',
                },
              }}
            />
          </Box>

          <Alert
            severity="info"
            icon={<Icon icon="solar:info-circle-linear" width={20} />}
            sx={{ alignItems: 'flex-start' }}
          >
            <AlertTitle sx={{ fontWeight: 700 }}>How commission is worked out</AlertTitle>
            <Typography variant="body2">
              BetterBlue takes a percentage of each order, and the rate is <strong>frozen when
              your proposal is accepted</strong> — a later change to platform pricing never
              reprices work already agreed. It is charged only on money you actually keep, so a
              partial refund reduces the fee with it.{' '}
              <Link component={RouterLink} to={paths.PRICING} underline="always">
                See the full pricing breakdown
              </Link>
              .
            </Typography>
          </Alert>
        </Stack>
      ) : tab === EARNINGS_TAB.TRANSACTIONS ? (
        <TransactionsTab
          rows={ledger?.items ?? []}
          total={ledger?.total ?? 0}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={(next) => setValue('page', next)}
          type={type}
          onTypeChange={(next) => setValue('type', next)}
          from={from}
          to={to}
          onDateChange={(key, next) => setValue(key, next)}
          loading={ledgerLoading}
          error={ledgerError}
          onRetry={refetchLedger}
          onExport={exportLedger}
          isExporting={isExporting}
          emptyState={{
            icon: 'solar:bill-list-linear',
            title: isFiltered ? 'No transactions match these filters' : 'No transactions yet',
            description: isFiltered
              ? 'Try a wider date range, or a different type.'
              : 'Every movement of money on your balance is recorded here, starting with your first released order.',
            primaryAction: clearAction,
          }}
        />
      ) : (
        <PayoutsTab
          method={payoutMethod}
          methodLoading={profileLoading}
          payouts={payouts?.items ?? []}
          total={payouts?.total ?? 0}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={(next) => setValue('page', next)}
          loading={payoutsLoading}
          error={payoutsError}
          onRetry={refetchPayouts}
          canWithdraw={canWithdraw}
          withdrawHint={withdrawHint}
          onWithdraw={() => setWithdrawOpen(true)}
        />
      )}

      <WithdrawDialog
        open={isWithdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        available={available}
        minimum={payoutMinimum}
        currency={currency}
        method={payoutMethod}
        onConfirm={handleWithdraw}
        isSubmitting={isRequesting}
      />
    </DashboardPage>
  )
}
