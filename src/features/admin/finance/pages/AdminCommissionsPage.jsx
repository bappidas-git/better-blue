import { useCallback, useMemo, useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import { useToast } from '@/components/feedback/ToastProvider'
import FormSelect from '@/components/inputs/FormSelect'
import { PERMISSIONS } from '@/constants/permissions'
import CommissionsTable from '@/features/admin/finance/components/CommissionsTable'
import {
  COMMISSIONS_PARAMS,
  FINANCE_EXPORT_LIMIT,
  FINANCE_PAGE_SIZE,
  monthOptions,
} from '@/features/admin/finance/utils/financeFilters'
import { AdminPageGuard } from '@/features/admin/shared'
import StatCardGrid from '@/features/dashboard/components/StatCardGrid'
import useApiQuery from '@/hooks/useApiQuery'
import useListParams from '@/hooks/useListParams'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { paymentService } from '@/services/paymentService'
import { exportRowsAsCsv } from '@/utils/exportCsv'
import {
  EMPTY_PLACEHOLDER,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from '@/utils/formatters'

// BetterBlue's own revenue, order by order — Prompt 32 §4.4.
//
// Read-only, and deliberately so: a commission record is the *consequence* of a
// release, not a thing anybody edits. What is configurable is the **rate**, and
// that lives in Platform Settings — which is why the card at the bottom points
// there rather than offering an input here. Editing a rate on a page of
// historical fees would suggest the history moves with it, and it does not:
// `orders.commissionRate` is frozen at award time (`docs/payments.md` §6).
//
// The period select drives the table, the three cards, and the export together,
// so a figure and the rows under it can never describe different months.

const EXPORT_COLUMNS = [
  { key: 'id', label: 'Commission ID' },
  { key: 'orderId', label: 'Order ID' },
  { key: 'orderTitle', label: 'Order', format: (row) => row.order?.title ?? '' },
  { key: 'createdAt', label: 'Settled', format: (row) => formatDate(row.createdAt) },
  { key: 'baseAmount', label: 'Settled base' },
  { key: 'rate', label: 'Rate' },
  { key: 'amount', label: 'Commission' },
  { key: 'currency', label: 'Currency' },
]

export default function AdminCommissionsPage() {
  const toast = useToast()

  const { values, setValue, setValues } = useListParams(COMMISSIONS_PARAMS)
  const { month, page } = values

  const [exporting, setExporting] = useState(false)

  const periodOptions = useMemo(() => monthOptions(), [])

  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useApiQuery(() => paymentService.getCommissionSummary({ month: month || undefined }), [month])

  const {
    data: list,
    isLoading,
    error,
    refetch,
  } = useApiQuery(
    () =>
      paymentService.adminListCommissions({
        month: month || undefined,
        page,
        limit: FINANCE_PAGE_SIZE,
      }),
    [month, page]
  )

  const rows = useMemo(() => list?.items ?? [], [list])

  const periodLabel =
    periodOptions.find((option) => option.value === month)?.label ?? 'this period'

  const exportCommissions = useCallback(async () => {
    setExporting(true)
    try {
      const all = await paymentService.adminListCommissions({
        month: month || undefined,
        page: 1,
        limit: FINANCE_EXPORT_LIMIT,
      })

      if (all.items.length === 0) {
        toast.info('There is nothing to export in this period.')
        return
      }
      if (!exportRowsAsCsv(`betterblue-commissions-${month || 'all-time'}`, EXPORT_COLUMNS, all.items)) {
        toast.error('We could not build the file. Try again in a moment.')
        return
      }

      toast.success(`Exported ${formatNumber(all.items.length)} commission records.`, {
        description:
          all.total > all.items.length
            ? `This period has ${formatNumber(all.total)}; the export is capped at ${FINANCE_EXPORT_LIMIT}.`
            : undefined,
      })
    } catch (failure) {
      toast.error(failure?.message ?? 'We could not export the commission records.')
    } finally {
      setExporting(false)
    }
  }, [month, toast])

  const summaryItems = [
    {
      key: 'total',
      label: 'Commission earned',
      value: summary?.total ?? 0,
      format: (amount) => formatCurrency(amount, summary?.currency, { hideDecimals: true }),
      icon: 'solar:hand-money-linear',
      iconTone: 'success',
    },
    {
      key: 'rate',
      label: 'Average rate',
      // Weighted by settled base, not the mean of the rate column — one small
      // order at a high rate must not move the platform's headline take rate.
      value:
        summary?.averageRate === null || summary?.averageRate === undefined ? (
          EMPTY_PLACEHOLDER
        ) : (
          formatPercent(summary.averageRate)
        ),
      icon: 'solar:pie-chart-2-linear',
      iconTone: 'brand',
    },
    {
      key: 'orders',
      label: 'Orders settled',
      value: summary?.orderCount ?? 0,
      format: formatNumber,
      icon: 'solar:box-linear',
      iconTone: 'info',
    },
  ]

  const footer = useMemo(() => {
    if (rows.length === 0) return undefined
    const pageBase = rows.reduce((sum, row) => sum + (Number(row.baseAmount) || 0), 0)
    const pageAmount = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
    return {
      createdAt: `This page (${formatNumber(rows.length)})`,
      baseAmount: formatCurrency(pageBase, summary?.currency),
      amount: formatCurrency(pageAmount, summary?.currency),
    }
  }, [rows, summary])

  const emptyState = {
    icon: 'solar:hand-money-linear',
    title: `No commission in ${periodLabel}`,
    description:
      'A record appears here every time escrow is released — one per settled order, with the rate frozen when it was awarded.',
  }

  return (
    <DashboardPage
      title="Commissions"
      subtitle="BetterBlue's own earnings — one record per settled order."
      maxWidth={false}
      actions={
        <Button
          variant="outlined"
          onClick={exportCommissions}
          disabled={exporting || isLoading}
          aria-label="Export the commission records for this period as a CSV file"
          startIcon={
            <Icon icon="solar:download-minimalistic-linear" width={18} aria-hidden="true" />
          }
        >
          {exporting ? 'Exporting…' : 'Export CSV'}
        </Button>
      }
    >
      <AdminPageGuard permission={PERMISSIONS.PAYMENTS_MANAGE}>
        <Stack spacing={{ xs: 2, md: 2.5 }}>
          <Box sx={{ maxWidth: { sm: 280 } }}>
            <FormSelect
              id="commission-period"
              label="Period"
              value={month}
              onChange={(next) => setValue('month', next)}
              options={periodOptions}
              size="small"
            />
          </Box>

          {summary?.truncated ? (
            <Alert severity="warning" variant="outlined">
              This period has more commission records than one fold could read, so the totals below
              may be short. Narrow the period, or wait for the server-side aggregate.
            </Alert>
          ) : null}

          {summaryError ? (
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={refetchSummary}>
                  Try again
                </Button>
              }
            >
              The period totals did not load. The records below are unaffected.
            </Alert>
          ) : (
            <StatCardGrid
              items={summaryItems}
              loading={summaryLoading}
              skeletonCount={3}
              sx={{
                gridTemplateColumns: {
                  xs: 'repeat(2, minmax(0, 1fr))',
                  md: 'repeat(3, minmax(0, 1fr))',
                },
              }}
            />
          )}

          <CommissionsTable
            rows={rows}
            loading={isLoading}
            error={error}
            onRetry={refetch}
            emptyState={emptyState}
            footer={footer}
            pagination={{
              page,
              pageSize: FINANCE_PAGE_SIZE,
              total: list?.total ?? 0,
              onPageChange: (next) => setValues({ page: next }),
              itemLabel: 'commission records',
            }}
          />

          {/* Where the rate comes from. A pointer rather than a control: the
              screen that changes rates is Prompt 35's, and a link to a route
              nobody has built lands on the dashboard 404 — the rule
              `navConfig` already follows. */}
          <Card variant="outlined">
            <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Box aria-hidden="true" sx={{ display: 'flex', color: 'text.secondary', pt: '2px' }}>
                  <Icon icon="solar:settings-linear" width={20} />
                </Box>
                <Box>
                  <Typography variant="subtitle2" component="h2">
                    Rates are configured in Platform Settings
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    The default rate and any per-category override live there, and a super admin
                    changes them. Changing a rate never reprices work already agreed — every order
                    carries the rate it was awarded at, which is the rate you see in the table
                    above.
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </AdminPageGuard>
    </DashboardPage>
  )
}
