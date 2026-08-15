import { useCallback, useMemo, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'

import PaginationControl from '@/components/data-display/PaginationControl'
import EmptyState from '@/components/feedback/EmptyState'
import ErrorState from '@/components/feedback/ErrorState'
import ListSkeleton from '@/components/feedback/skeletons/ListSkeleton'
import { useToast } from '@/components/feedback/ToastProvider'
import FilterChipGroup from '@/components/inputs/FilterChipGroup'
import FormDateField from '@/components/inputs/FormDateField'
import { getStatusMeta } from '@/constants'
import { useAuth } from '@/context/AuthContext'
import { useDiscoveryParams } from '@/features/discovery/hooks/useDiscoveryParams'
import PaymentCard from '@/features/payments/components/PaymentCard'
import ReceiptSheet from '@/features/payments/components/ReceiptSheet'
import TransactionsTable from '@/features/payments/components/TransactionsTable'
import { signedAmount } from '@/features/payments/ledgerDisplay'
import {
  BUYER_PAYMENT_PARAMS,
  BUYER_TRANSACTION_TYPES,
  dayBoundaryIso,
  PAYMENT_STATUS_FILTERS,
  PAYMENTS_TAB,
  PAYMENTS_TABS,
} from '@/features/payments/paymentFilters'
import useApiQuery from '@/hooks/useApiQuery'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { paths } from '@/routes/paths'
import { orderService } from '@/services/orderService'
import { paymentService } from '@/services/paymentService'
import { exportRowsAsCsv } from '@/utils/exportCsv'
import { formatDateTime } from '@/utils/formatters'

// Payments & Transactions — the buyer's money, in the two ways it can be read.
//
// **Payments** is the escrow view: one card per charge, showing where that
// money is now (`held`, `released`, `refunded`, …) and opening a receipt.
// **Transactions** is the ledger: one row per movement, signed from the buyer's
// perspective, filterable and exportable.
//
// The distinction matters and is not cosmetic. A payment is a *thing that has a
// state*; a transaction is a *thing that happened* and is never amended
// (`docs/payments.md` §7). A partial refund is one payment and two ledger rows,
// and this screen is where that stops being an abstraction.
//
// Both queries and every filter live in the URL (00 §12), so a filtered view is
// a link someone can send to support.

/** Cards and rows per page. */
const PAGE_SIZE = 10

/**
 * MOCK-JOIN: payments carry `orderId` and no title, and `_embed` is banned
 * (00 §10), so the buyer's orders are fetched once and used as a lookup. The
 * cap is a provider page ceiling (contract §4.1), comfortably above any seeded
 * account; Laravel returns the title with the payment and this goes away.
 */
const ORDER_TITLE_LIMIT = 100

/**
 * Rows a CSV export will pull. Deliberately capped rather than paged forever —
 * and reported when it bites, because a silently truncated export reads as a
 * complete one.
 */
const EXPORT_LIMIT = 500

/** Export columns. Separate from the table's: a spreadsheet wants raw facts. */
const EXPORT_COLUMNS = [
  { key: 'createdAt', label: 'Date', format: (row) => formatDateTime(row.createdAt) },
  { key: 'description', label: 'Description' },
  { key: 'type', label: 'Type', format: (row) => getStatusMeta(row.type).label },
  { key: 'amount', label: 'Amount', format: (row) => signedAmount(row) },
  { key: 'currency', label: 'Currency' },
  { key: 'orderId', label: 'Order' },
  { key: 'id', label: 'Transaction' },
]

const chipOptions = (values) =>
  values.map((value) => ({ value, label: getStatusMeta(value).label }))

export default function BuyerPaymentsPage() {
  const { user } = useAuth()
  const buyerId = user?.id
  const toast = useToast()

  const { values, setValue, setValues, clearFilters, isFiltered } =
    useDiscoveryParams(BUYER_PAYMENT_PARAMS)
  const { tab, status, type, from, to, page } = values

  const isPaymentsTab = tab === PAYMENTS_TAB.PAYMENTS

  /**
   * Switching tabs drops the filters that belong to the other one. The two tabs
   * share a query string but not a vocabulary, and a `?status=released` riding
   * along on the transactions view is a filter the screen shows no control for
   * and applies to nothing — the kind of state that only ever surfaces as a
   * link somebody cannot reproduce.
   */
  const selectTab = useCallback(
    (next) =>
      setValues(
        next === PAYMENTS_TAB.PAYMENTS
          ? { tab: next, type: null, from: '', to: '' }
          : { tab: next, status: null }
      ),
    [setValues]
  )

  const [receipt, setReceipt] = useState(null)
  const [isExporting, setExporting] = useState(false)

  const {
    data: payments,
    isLoading: paymentsLoading,
    error: paymentsError,
    refetch: refetchPayments,
  } = useApiQuery(
    () =>
      paymentService.listByBuyer(buyerId, {
        page,
        limit: PAGE_SIZE,
        filters: status ? { status } : undefined,
      }),
    [buyerId, page, status],
    { enabled: Boolean(buyerId) && isPaymentsTab }
  )

  /** The ledger filters, shared by the table query and the export. */
  const ledgerFilters = useMemo(
    () => ({
      userId: buyerId,
      ...(type ? { type } : {}),
      ...(from ? { createdAt_gte: dayBoundaryIso(from, 'start') } : {}),
      ...(to ? { createdAt_lte: dayBoundaryIso(to, 'end') } : {}),
    }),
    [buyerId, type, from, to]
  )

  const {
    data: ledger,
    isLoading: ledgerLoading,
    error: ledgerError,
    refetch: refetchLedger,
  } = useApiQuery(
    () => paymentService.listTransactions({ page, limit: PAGE_SIZE, filters: ledgerFilters }),
    [page, ledgerFilters],
    { enabled: Boolean(buyerId) && !isPaymentsTab }
  )

  const { data: orders } = useApiQuery(
    () => orderService.listByBuyer(buyerId, { page: 1, limit: ORDER_TITLE_LIMIT }),
    [buyerId],
    { enabled: Boolean(buyerId) }
  )

  const orderTitles = useMemo(
    () => new Map((orders?.items ?? []).map((order) => [order.id, order.title])),
    [orders]
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

      const written = exportRowsAsCsv('betterblue-transactions', EXPORT_COLUMNS, all.items)
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

  const paymentItems = payments?.items ?? []
  const ledgerItems = ledger?.items ?? []

  const clearAction = isFiltered
    ? { label: 'Clear filters', onClick: () => clearFilters(), variant: 'outlined' }
    : undefined

  return (
    <DashboardPage
      title="Payments"
      subtitle="What you have paid, where it is being held, and every movement on your account."
    >
      <Tabs
        value={tab}
        onChange={(event, next) => selectTab(next)}
        aria-label="Switch between payments and transactions"
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

      {isPaymentsTab ? (
        <>
          <Box sx={{ mb: { xs: 2, md: 2.5 } }}>
            <FilterChipGroup
              label="Filter payments by status"
              options={chipOptions(PAYMENT_STATUS_FILTERS)}
              value={status}
              onChange={(next) => setValue('status', next)}
            />
          </Box>

          {paymentsError ? (
            <ErrorState
              title="We could not load your payments"
              message="Nothing about them has changed — this list just needs another go."
              error={paymentsError}
              onRetry={refetchPayments}
            />
          ) : paymentsLoading ? (
            <ListSkeleton rows={4} avatar={false} label="Loading your payments" />
          ) : paymentItems.length === 0 ? (
            <EmptyState
              icon="solar:card-linear"
              title={status ? 'No payments with that status' : 'No payments yet'}
              description={
                status
                  ? 'Try another status, or clear the filter to see everything.'
                  : 'Once you fund an order, the payment and its escrow status appear here.'
              }
              primaryAction={clearAction ?? { label: 'View your requests', to: paths.BUYER_REQUESTS }}
            />
          ) : (
            <>
              <Stack component="ul" spacing={2} sx={{ listStyle: 'none', m: 0, p: 0 }}>
                {paymentItems.map((payment) => (
                  <PaymentCard
                    key={payment.id}
                    payment={payment}
                    orderTitle={orderTitles.get(payment.orderId)}
                    onReceipt={setReceipt}
                  />
                ))}
              </Stack>

              <PaginationControl
                page={page}
                pageSize={PAGE_SIZE}
                total={payments?.total ?? 0}
                onPageChange={(next) => setValue('page', next)}
                itemLabel="payments"
                hideOnSinglePage
              />
            </>
          )}
        </>
      ) : (
        <>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            alignItems={{ xs: 'stretch', md: 'flex-end' }}
            sx={{ mb: { xs: 2, md: 2.5 } }}
          >
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <FilterChipGroup
                label="Filter transactions by type"
                options={chipOptions(BUYER_TRANSACTION_TYPES)}
                value={type}
                onChange={(next) => setValue('type', next)}
              />
            </Box>

            <Stack direction="row" spacing={1.5} sx={{ flexShrink: 0 }}>
              <FormDateField
                id="transactions-from"
                label="From"
                value={from || null}
                onChange={(next) => setValue('from', next ?? '')}
                maxDate={to || undefined}
              />
              <FormDateField
                id="transactions-to"
                label="To"
                value={to || null}
                onChange={(next) => setValue('to', next ?? '')}
                minDate={from || undefined}
              />
            </Stack>

            <Button
              onClick={exportLedger}
              disabled={isExporting || ledgerLoading}
              variant="outlined"
              color="inherit"
              startIcon={<Icon icon="solar:download-minimalistic-linear" width={18} aria-hidden="true" />}
              sx={{ flexShrink: 0, minHeight: 44 }}
            >
              Export CSV
            </Button>
          </Stack>

          <TransactionsTable
            rows={ledgerItems}
            loading={ledgerLoading}
            error={ledgerError}
            onRetry={refetchLedger}
            emptyState={{
              icon: 'solar:bill-list-linear',
              title: isFiltered ? 'No transactions match these filters' : 'No transactions yet',
              description: isFiltered
                ? 'Try a wider date range, or a different type.'
                : 'Every movement of money on your account is recorded here, starting with your first payment.',
              primaryAction: clearAction,
            }}
            pagination={{
              page,
              pageSize: PAGE_SIZE,
              total: ledger?.total ?? 0,
              onPageChange: (next) => setValue('page', next),
              itemLabel: 'transactions',
              hideOnSinglePage: true,
            }}
          />
        </>
      )}

      <ReceiptSheet
        open={Boolean(receipt)}
        onClose={() => setReceipt(null)}
        payment={receipt}
        orderTitle={receipt ? orderTitles.get(receipt.orderId) : undefined}
      />
    </DashboardPage>
  )
}
