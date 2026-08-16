import { useCallback, useMemo, useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import { useNavigate } from 'react-router-dom'

import { useToast } from '@/components/feedback/ToastProvider'
import FilterChipGroup from '@/components/inputs/FilterChipGroup'
import FormDateField from '@/components/inputs/FormDateField'
import SearchInput from '@/components/inputs/SearchInput'
import { PERMISSIONS } from '@/constants/permissions'
import { STATUS_META } from '@/constants/statuses'
import EscrowTable from '@/features/admin/finance/components/EscrowTable'
import FinanceSummaryCards from '@/features/admin/finance/components/FinanceSummaryCards'
import LedgerTable from '@/features/admin/finance/components/LedgerTable'
import RefundDialog from '@/features/admin/finance/components/RefundDialog'
import {
  FINANCE_EXPORT_LIMIT,
  FINANCE_PAGE_SIZE,
  LEDGER_TYPE_OPTIONS,
  PAYMENTS_PARAMS,
  PAYMENTS_TAB,
  PAYMENTS_TABS,
  dayBoundary,
} from '@/features/admin/finance/utils/financeFilters'
import { AdminPageGuard } from '@/features/admin/shared'
import ChartCard from '@/features/dashboard/components/ChartCard'
import ThemedBarChart from '@/features/dashboard/components/ThemedBarChart'
import useApiQuery from '@/hooks/useApiQuery'
import useListParams from '@/hooks/useListParams'
import { useAuth } from '@/context/AuthContext'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { paths } from '@/routes/paths'
import { paymentService } from '@/services/paymentService'
import { exportRowsAsCsv } from '@/utils/exportCsv'
import { formatCurrency, formatDate, formatNumber } from '@/utils/formatters'

// The finance console's home — Prompt 32 §4.2.
//
// Three tabs, in the order a finance question is actually asked: how did the
// month go, what are we holding, and show me the rows. They are one screen
// rather than three routes because they are one job, and because the escrow
// snapshot on the overview is only useful if the escrow list is a click away.
//
// It does **not** use `AdminListPage`: that component owns one table with one
// chip-group filter, and this screen has tabs, two different tables, a chart,
// and a dialog. Its own header says to copy the pattern when that happens.
//
// Every figure on this page is computed by `paymentService` (§7). The page
// decides what to *render* — including which numbers are safe to print, which
// is why a truncated fold gets a warning band rather than a quiet total.

/** Height of the revenue chart, matching the console's other chart bands. */
const CHART_HEIGHT = 280

const LEDGER_EXPORT_COLUMNS = [
  { key: 'id', label: 'Transaction ID' },
  { key: 'createdAt', label: 'Date', format: (row) => formatDate(row.createdAt) },
  { key: 'type', label: 'Type', format: (row) => STATUS_META[row.type]?.label ?? row.type },
  { key: 'description', label: 'Description' },
  { key: 'userId', label: 'Member ID' },
  { key: 'userName', label: 'Member', format: (row) => row.user?.name ?? '' },
  { key: 'orderId', label: 'Order ID' },
  { key: 'amount', label: 'Amount' },
  { key: 'currency', label: 'Currency' },
  { key: 'balanceAfter', label: 'Balance after' },
]

/** One sentence describing the revenue trend, for screen readers (§12). */
function revenueChartLabel(months, currency) {
  if (!months?.length) return 'Commission revenue per month.'

  const money = (amount) => formatCurrency(amount, currency, { hideDecimals: true })
  const peak = months.reduce((best, month) =>
    month.commissionRevenue > best.commissionRevenue ? month : best
  )
  const last = months[months.length - 1]

  return (
    `Commission revenue per month across ${months.length} months. ` +
    `Best month: ${peak.label} at ${money(peak.commissionRevenue)}. ` +
    `This month so far: ${money(last.commissionRevenue)}.`
  )
}

export default function AdminPaymentsPage() {
  const { user: actor } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const { values, setValue, setValues, clearFilters, isFiltered } = useListParams(PAYMENTS_PARAMS)
  const { tab, type, q, from, to, page } = values

  const [refundTarget, setRefundTarget] = useState(null)
  const [exporting, setExporting] = useState(false)

  /* -- the money, six months of it ---------------------------------------- */

  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useApiQuery(() => paymentService.getFinanceSummary(), [])

  /* -- escrow -------------------------------------------------------------- */

  const {
    data: escrow,
    isLoading: escrowLoading,
    error: escrowError,
    refetch: refetchEscrow,
  } = useApiQuery(() => paymentService.getEscrowOverview(), [])

  /* -- the ledger ---------------------------------------------------------- */

  const ledgerQuery = useMemo(
    () => ({
      type: type || undefined,
      search: q || undefined,
      from: dayBoundary(from, 'start'),
      to: dayBoundary(to, 'end'),
    }),
    [q, type, from, to]
  )

  const {
    data: ledger,
    isLoading: ledgerLoading,
    error: ledgerError,
    refetch: refetchLedger,
  } = useApiQuery(
    () =>
      paymentService.adminListTransactions({
        ...ledgerQuery,
        page,
        limit: FINANCE_PAGE_SIZE,
      }),
    [ledgerQuery, page],
    { enabled: tab === PAYMENTS_TAB.LEDGER }
  )

  const ledgerRows = useMemo(() => ledger?.items ?? [], [ledger])

  /* -- actions ------------------------------------------------------------- */

  const issueRefund = useCallback(
    async ({ amount, reason }) => {
      const payment = await paymentService.adminRefundOrder(refundTarget.orderId, {
        amount,
        reason,
        actor,
      })

      toast.success(
        amount === undefined ? 'Escrow refunded in full.' : 'Partial refund issued.',
        {
          description:
            amount === undefined
              ? 'The buyer and the creator have both been told, and the ledger is updated.'
              : 'The remainder was released to the creator in the same step.',
        }
      )
      setRefundTarget(null)
      refetchEscrow()
      refetchSummary()
      if (tab === PAYMENTS_TAB.LEDGER) refetchLedger()
      return payment
    },
    [actor, refetchEscrow, refetchLedger, refetchSummary, refundTarget, tab, toast]
  )

  const exportLedger = useCallback(async () => {
    setExporting(true)
    try {
      const all = await paymentService.adminListTransactions({
        ...ledgerQuery,
        page: 1,
        limit: FINANCE_EXPORT_LIMIT,
      })

      if (all.items.length === 0) {
        toast.info('There is nothing to export in this view.')
        return
      }
      if (!exportRowsAsCsv('betterblue-transactions', LEDGER_EXPORT_COLUMNS, all.items)) {
        toast.error('We could not build the file. Try again in a moment.')
        return
      }

      toast.success(`Exported ${formatNumber(all.items.length)} ledger rows.`, {
        description:
          all.total > all.items.length
            ? `Your filters match ${formatNumber(all.total)}; the export is capped at ${FINANCE_EXPORT_LIMIT}. Narrow the date range to get the rest.`
            : undefined,
      })
    } catch (failure) {
      toast.error(failure?.message ?? 'We could not export the ledger.')
    } finally {
      setExporting(false)
    }
  }, [ledgerQuery, toast])

  /* -- rendering ----------------------------------------------------------- */

  const currency = summary?.currency ?? escrow?.currency

  const ledgerFooter = useMemo(() => {
    if (ledgerRows.length === 0) return undefined
    // The footer totals **this page**, and says so. Totalling the whole filtered
    // set would need a fold the ledger deliberately does not do on a paged view
    // — and a total that silently meant something other than the rows above it
    // is the worst thing a finance table can print.
    const net = ledgerRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
    return {
      createdAt: `This page (${formatNumber(ledgerRows.length)})`,
      amount: formatCurrency(net, currency),
    }
  }, [currency, ledgerRows])

  const escrowFooter = useMemo(() => {
    if (!escrow?.items?.length) return undefined
    return {
      order: `${formatNumber(escrow.heldCount)} payments held`,
      amount: formatCurrency(escrow.heldTotal, escrow.currency),
    }
  }, [escrow])

  const escrowEmpty = {
    icon: 'solar:check-circle-linear',
    title: 'No escrow held right now',
    description:
      'Every funded order has settled. Money appears here the moment a buyer pays for an order.',
  }

  const ledgerEmpty =
    isFiltered || q
      ? {
          icon: 'tabler:search-off',
          title: 'No ledger rows match those filters',
          description:
            'Try a wider date range, another type, or check the order id you searched for.',
          primaryAction: {
            label: 'Clear filters',
            onClick: () => clearFilters(),
            variant: 'outlined',
          },
        }
      : {
          icon: 'solar:bill-list-linear',
          title: 'The ledger is empty',
          description: 'A row appears here every time money moves on the platform.',
        }

  return (
    <DashboardPage
      title="Payments"
      subtitle="What the platform earned, what it is holding, and every movement of money behind both."
      maxWidth={false}
      actions={
        tab === PAYMENTS_TAB.LEDGER ? (
          <Button
            variant="outlined"
            onClick={exportLedger}
            disabled={exporting || ledgerLoading}
            aria-label="Export the filtered ledger as a CSV file"
            startIcon={
              <Icon icon="solar:download-minimalistic-linear" width={18} aria-hidden="true" />
            }
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        ) : null
      }
    >
      <AdminPageGuard permission={PERMISSIONS.PAYMENTS_MANAGE}>
        <Tabs
          value={tab}
          onChange={(event, next) => setValues({ tab: next })}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          aria-label="Finance views"
          sx={{ borderBottom: 1, borderColor: 'divider', mb: { xs: 2, md: 2.5 } }}
        >
          {PAYMENTS_TABS.map((entry) => (
            <Tab
              key={entry.key}
              value={entry.key}
              label={entry.label}
              sx={{ minHeight: 48, textTransform: 'none', fontWeight: 600 }}
            />
          ))}
        </Tabs>

        {/* ---- Overview ---------------------------------------------------- */}
        {tab === PAYMENTS_TAB.OVERVIEW ? (
          <Stack spacing={{ xs: 2, md: 3 }}>
            {summary?.truncated ? (
              <Alert severity="warning" variant="outlined">
                These figures are folded from more rows than one page of the mock API returns, so
                they may be short. The Laravel backend aggregates this server-side.
              </Alert>
            ) : null}

            <Box>
              <Typography variant="overline" component="h2" color="text.secondary">
                This month
              </Typography>
              <Box sx={{ mt: 1 }}>
                <FinanceSummaryCards
                  summary={summary?.current}
                  currency={currency}
                  loading={summaryLoading}
                />
              </Box>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gap: { xs: 2, md: 3 },
                gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(0, 1fr)' },
              }}
            >
              <ChartCard
                title="Commission revenue by month"
                subtitle="Recognised when escrow is released"
                height={CHART_HEIGHT}
              >
                {summaryLoading ? (
                  <Skeleton
                    variant="rounded"
                    role="status"
                    aria-busy="true"
                    aria-label="Loading monthly commission revenue"
                    sx={{ width: '100%', height: CHART_HEIGHT }}
                  />
                ) : (
                  <ThemedBarChart
                    data={summary?.months ?? []}
                    series={[{ key: 'commissionRevenue', label: 'Commission' }]}
                    valueFormat="currency"
                    height={CHART_HEIGHT}
                    ariaLabel={revenueChartLabel(summary?.months, currency)}
                    emptyMessage="No commission revenue in this window"
                  />
                )}
              </ChartCard>

              {/* The escrow snapshot: a total, its shape, and the way in. */}
              <Card>
                <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                  <Typography variant="h6" component="h2" sx={{ fontSize: '1.0625rem' }}>
                    Held in escrow
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Buyer money the platform is holding right now
                  </Typography>

                  {escrowLoading ? (
                    <Skeleton
                      variant="rounded"
                      role="status"
                      aria-busy="true"
                      aria-label="Loading the escrow snapshot"
                      sx={{ width: '100%', height: 140, mt: 2 }}
                    />
                  ) : (
                    <>
                      <Typography
                        variant="h4"
                        component="p"
                        sx={{ mt: 2, fontVariantNumeric: 'tabular-nums' }}
                      >
                        {formatCurrency(escrow?.heldTotal ?? 0, escrow?.currency)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        across {formatNumber(escrow?.heldCount ?? 0)}{' '}
                        {escrow?.heldCount === 1 ? 'payment' : 'payments'}
                      </Typography>

                      <Stack spacing={0.75} sx={{ mt: 2 }}>
                        {(escrow?.agingBuckets ?? [])
                          .filter((bucket) => bucket.count > 0)
                          .map((bucket) => (
                            <Stack
                              key={bucket.key}
                              direction="row"
                              spacing={2}
                              justifyContent="space-between"
                            >
                              <Typography variant="body2" color="text.secondary">
                                {bucket.label} · {formatNumber(bucket.count)}
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}
                              >
                                {formatCurrency(bucket.amount, escrow?.currency)}
                              </Typography>
                            </Stack>
                          ))}
                      </Stack>

                      <Button
                        variant="outlined"
                        color="inherit"
                        onClick={() => setValues({ tab: PAYMENTS_TAB.ESCROW })}
                        sx={{ mt: 2.5 }}
                        endIcon={<Icon icon="tabler:arrow-right" width={16} aria-hidden="true" />}
                      >
                        Open the escrow monitor
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </Box>

            {summaryError ? (
              <Alert
                severity="error"
                action={
                  <Button color="inherit" size="small" onClick={refetchSummary}>
                    Try again
                  </Button>
                }
              >
                The monthly figures did not load. Nothing about the ledger has changed.
              </Alert>
            ) : null}
          </Stack>
        ) : null}

        {/* ---- Escrow ------------------------------------------------------ */}
        {tab === PAYMENTS_TAB.ESCROW ? (
          <Stack spacing={{ xs: 2, md: 2.5 }}>
            {escrow?.truncated ? (
              <Alert severity="warning" variant="outlined">
                More payments are held than this view could read in one pass, so the total below is
                short. Laravel answers this with one query.
              </Alert>
            ) : null}

            {/* The aging legend, so a badge's colour has a stated meaning (§12). */}
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
              <Typography variant="body2" color="text.secondary">
                Aging:
              </Typography>
              {(escrow?.agingBuckets ?? []).map((bucket) => (
                <Chip
                  key={bucket.key}
                  size="small"
                  variant="outlined"
                  label={`${bucket.label} · ${formatNumber(bucket.count)} · ${formatCurrency(bucket.amount, escrow?.currency)}`}
                  sx={{ fontSize: '0.75rem' }}
                />
              ))}
            </Stack>

            <EscrowTable
              rows={escrow?.items ?? []}
              loading={escrowLoading}
              error={escrowError}
              onRetry={refetchEscrow}
              emptyState={escrowEmpty}
              onViewOrder={(row) => navigate(paths.adminOrderDetail(row.orderId))}
              // The whole screen is gated on `payments.manage`, which is the
              // permission that carries "issue refunds where warranted"
              // (`constants/permissions.js`) — so reaching this table is
              // already the check.
              onRefund={setRefundTarget}
              footer={escrowFooter}
            />
          </Stack>
        ) : null}

        {/* ---- Transactions ------------------------------------------------ */}
        {tab === PAYMENTS_TAB.LEDGER ? (
          <Stack spacing={{ xs: 2, md: 2.5 }}>
            <Stack
              direction={{ xs: 'column', lg: 'row' }}
              spacing={1.5}
              alignItems={{ xs: 'stretch', lg: 'center' }}
            >
              <Box sx={{ flexGrow: 1, minWidth: 0, maxWidth: { lg: 260 } }}>
                <SearchInput
                  value={q}
                  onChange={(next) => setValue('q', next)}
                  placeholder="Order id, e.g. ord_012"
                  label="Find every ledger row for one order id"
                />
              </Box>

              <FilterChipGroup
                label="Type"
                options={LEDGER_TYPE_OPTIONS}
                value={type}
                onChange={(next) => setValue('type', next)}
                size="sm"
              />

              <Stack direction="row" spacing={1} sx={{ minWidth: { lg: 300 } }}>
                <FormDateField
                  id="ledger-from"
                  label="From"
                  value={from}
                  onChange={(next) => setValue('from', next ?? '')}
                  maxDate={to || undefined}
                />
                <FormDateField
                  id="ledger-to"
                  label="To"
                  value={to}
                  onChange={(next) => setValue('to', next ?? '')}
                  minDate={from || undefined}
                />
              </Stack>
            </Stack>

            <LedgerTable
              rows={ledgerRows}
              loading={ledgerLoading}
              error={ledgerError}
              onRetry={refetchLedger}
              emptyState={ledgerEmpty}
              footer={ledgerFooter}
              pagination={{
                page,
                pageSize: FINANCE_PAGE_SIZE,
                total: ledger?.total ?? 0,
                onPageChange: (next) => setValues({ page: next }),
                itemLabel: 'transactions',
              }}
            />
          </Stack>
        ) : null}

        <RefundDialog
          open={Boolean(refundTarget)}
          payment={refundTarget}
          onClose={() => setRefundTarget(null)}
          onSubmit={issueRefund}
        />
      </AdminPageGuard>
    </DashboardPage>
  )
}
