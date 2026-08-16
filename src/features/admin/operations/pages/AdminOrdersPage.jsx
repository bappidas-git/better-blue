import { useCallback, useMemo, useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useNavigate } from 'react-router-dom'

import StatusChip from '@/components/data-display/StatusChip'
import { useToast } from '@/components/feedback/ToastProvider'
import FilterChipGroup from '@/components/inputs/FilterChipGroup'
import FormDateField from '@/components/inputs/FormDateField'
import SearchInput from '@/components/inputs/SearchInput'
import SortSelect from '@/components/inputs/SortSelect'
import DataTable from '@/components/table/DataTable'
import { PERMISSIONS } from '@/constants/permissions'
import { STATUS_META } from '@/constants/statuses'
import {
  ORDER_DUE_SLA,
  ORDER_OVERSIGHT_PARAMS,
  ORDER_SORT_OPTIONS,
  ORDER_STATUS_OPTIONS,
  OPERATIONS_EXPORT_LIMIT,
  OPERATIONS_PAGE_SIZE,
  PAYMENT_STATUS_OPTIONS,
  dayBoundary,
  isOrderOverdue,
  orderSortQuery,
  orderSortToken,
  shortId,
} from '@/features/admin/operations/utils/operationsFilters'
import { AdminPageGuard, AgeBadge, EntityRefChip } from '@/features/admin/shared'
import useApiQuery from '@/hooks/useApiQuery'
import useListParams from '@/hooks/useListParams'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { PermissionGate } from '@/routes/guards'
import { paths } from '@/routes/paths'
import { categoryService } from '@/services/categoryService'
import { orderService } from '@/services/orderService'
import { exportRowsAsCsv } from '@/utils/exportCsv'
import { EMPTY_PLACEHOLDER, formatCurrency, formatDate, formatNumber } from '@/utils/formatters'

// Platform-wide order oversight — Prompt 31 §4.2.
//
// The list is deliberately dense and deliberately read-only: every intervention
// lives on the detail screen, one click away, where the full context of an
// engagement is on screen beside it. Nobody should be able to cancel an order
// from a table row.
//
// Two status columns rather than one, because they answer different questions
// and routinely disagree: the *order* says where the work is, the *payment*
// says where the money is, and "delivered but the escrow was never funded" is
// exactly the row an operations desk is looking for.

const EXPORT_COLUMNS = [
  { key: 'id', label: 'Order ID' },
  { key: 'title', label: 'Title' },
  { key: 'buyerId', label: 'Buyer ID' },
  { key: 'buyerName', label: 'Buyer', format: (row) => row.buyer?.name ?? '' },
  { key: 'creatorId', label: 'Creator ID' },
  { key: 'creatorName', label: 'Creator', format: (row) => row.creator?.name ?? '' },
  { key: 'price', label: 'Price' },
  { key: 'currency', label: 'Currency' },
  { key: 'commissionAmount', label: 'Commission' },
  { key: 'creatorEarnings', label: 'Creator net' },
  {
    key: 'status',
    label: 'Order status',
    format: (row) => STATUS_META[row.status]?.label ?? row.status,
  },
  {
    key: 'paymentStatus',
    label: 'Payment status',
    format: (row) => (row.payment ? (STATUS_META[row.payment.status]?.label ?? row.payment.status) : ''),
  },
  { key: 'createdAt', label: 'Created', format: (row) => formatDate(row.createdAt) },
  { key: 'deliveryDueAt', label: 'Due', format: (row) => formatDate(row.deliveryDueAt) },
]

export default function AdminOrdersPage() {
  const toast = useToast()
  const navigate = useNavigate()

  const { values, setValue, setValues, clearFilters, isFiltered } =
    useListParams(ORDER_OVERSIGHT_PARAMS)
  const { q, status, payment, category, from, to, sort, page } = values

  const [exporting, setExporting] = useState(false)

  const { data: categories } = useApiQuery(() => categoryService.listActive(), [])
  const categoryOptions = useMemo(
    () => (categories ?? []).map((entry) => ({ value: entry.id, label: entry.name })),
    [categories]
  )
  const categoryNameById = useMemo(
    () => new Map((categories ?? []).map((entry) => [entry.id, entry.name])),
    [categories]
  )

  const query = useMemo(
    () => ({
      search: q || undefined,
      status: status.length > 0 ? status : undefined,
      paymentStatus: payment.length > 0 ? payment : undefined,
      categoryId: category.length > 0 ? category : undefined,
      createdFrom: dayBoundary(from, 'start'),
      createdTo: dayBoundary(to, 'end'),
      ...orderSortQuery(sort),
    }),
    [q, status, payment, category, from, to, sort]
  )

  const { data, isLoading, error, refetch } = useApiQuery(
    () => orderService.adminListOrders({ ...query, page, limit: OPERATIONS_PAGE_SIZE }),
    [query, page]
  )

  const rows = useMemo(() => data?.items ?? [], [data])

  const exportCsv = useCallback(async () => {
    setExporting(true)
    try {
      const all = await orderService.adminListOrders({
        ...query,
        page: 1,
        limit: OPERATIONS_EXPORT_LIMIT,
      })

      if (all.items.length === 0) {
        toast.info('There is nothing to export in this view.')
        return
      }
      if (!exportRowsAsCsv('betterblue-orders', EXPORT_COLUMNS, all.items)) {
        toast.error('We could not build the file. Try again in a moment.')
        return
      }

      toast.success(`Exported ${formatNumber(all.items.length)} orders.`, {
        description:
          all.total > all.items.length
            ? `Your filters match ${formatNumber(all.total)}; the export is capped at ${OPERATIONS_EXPORT_LIMIT}. Narrow the filters to get the rest.`
            : undefined,
      })
    } catch (failure) {
      toast.error(failure?.message ?? 'We could not export the order list.')
    } finally {
      setExporting(false)
    }
  }, [query, toast])

  const columns = useMemo(
    () => [
      {
        key: 'title',
        label: 'Order',
        render: (row) => (
          <Box sx={{ minWidth: 0, maxWidth: 300 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
              {row.title}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p">
              {shortId(row.id)} · {categoryNameById.get(row.categoryId) ?? EMPTY_PLACEHOLDER}
            </Typography>
          </Box>
        ),
      },
      {
        key: 'parties',
        label: 'Parties',
        render: (row) => (
          <Stack spacing={0.5} sx={{ minWidth: 0 }}>
            {row.buyer?.id ? (
              <EntityRefChip type="user" id={row.buyer.id} label={row.buyer.name} maxLabelLength={22} />
            ) : null}
            {row.creator?.id ? (
              <EntityRefChip
                type="user"
                id={row.creator.id}
                label={row.creator.name}
                maxLabelLength={22}
              />
            ) : null}
          </Stack>
        ),
      },
      {
        key: 'price',
        label: 'Value',
        align: 'right',
        sortable: true,
        render: (row) => formatCurrency(row.price, row.currency),
      },
      {
        key: 'status',
        label: 'Order',
        render: (row) => <StatusChip status={row.status} size="sm" tooltip />,
      },
      {
        key: 'paymentStatus',
        label: 'Payment',
        render: (row) =>
          row.payment ? (
            <StatusChip status={row.payment.status} size="sm" tooltip />
          ) : (
            <Typography variant="body2" color="text.secondary">
              Unfunded
            </Typography>
          ),
      },
      {
        key: 'createdAt',
        label: 'Created',
        sortable: true,
        render: (row) => formatDate(row.createdAt),
      },
      {
        key: 'deliveryDueAt',
        label: 'Due',
        sortable: true,
        render: (row) =>
          row.deliveryDueAt ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2">{formatDate(row.deliveryDueAt)}</Typography>
              {isOrderOverdue(row) ? (
                <AgeBadge date={row.deliveryDueAt} overdue noun="Delivery" {...ORDER_DUE_SLA} />
              ) : null}
            </Stack>
          ) : (
            EMPTY_PLACEHOLDER
          ),
      },
    ],
    [categoryNameById]
  )

  const renderMobileCard = useCallback(
    (row) => (
      <Card>
        <CardContent sx={{ p: 2 }}>
          <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1 }}>
            <Typography variant="subtitle2" component="h3" sx={{ flexGrow: 1, minWidth: 0 }}>
              {row.title}
            </Typography>
            <StatusChip status={row.status} size="sm" />
          </Stack>

          <Typography variant="caption" color="text.secondary" component="p">
            {shortId(row.id)} · {formatCurrency(row.price, row.currency)} ·{' '}
            {row.payment ? (STATUS_META[row.payment.status]?.label ?? row.payment.status) : 'Unfunded'}
          </Typography>

          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
            {row.buyer?.id ? (
              <EntityRefChip type="user" id={row.buyer.id} label={row.buyer.name} maxLabelLength={18} />
            ) : null}
            {row.creator?.id ? (
              <EntityRefChip
                type="user"
                id={row.creator.id}
                label={row.creator.name}
                maxLabelLength={18}
              />
            ) : null}
            {isOrderOverdue(row) ? (
              <AgeBadge date={row.deliveryDueAt} overdue noun="Delivery" {...ORDER_DUE_SLA} />
            ) : null}
          </Stack>
        </CardContent>
      </Card>
    ),
    []
  )

  const emptyState =
    isFiltered || q
      ? {
          icon: 'tabler:search-off',
          title: 'No orders match those filters',
          description: 'Try a shorter search term, a wider date range, or another status.',
          primaryAction: {
            label: 'Clear filters',
            onClick: () => clearFilters(),
            variant: 'outlined',
          },
        }
      : {
          icon: 'solar:box-linear',
          title: 'No orders on the platform yet',
          description: 'An order appears here the moment a buyer accepts a proposal.',
        }

  const sortState = orderSortQuery(sort)

  return (
    <DashboardPage
      title="Orders"
      subtitle="Every engagement on BetterBlue, with where the work and the money each stand."
      maxWidth={false}
      actions={
        <PermissionGate permission={PERMISSIONS.ORDERS_MANAGE}>
          <Button
            variant="outlined"
            onClick={exportCsv}
            disabled={exporting || isLoading}
            aria-label="Export the filtered orders as a CSV file"
            startIcon={
              <Icon icon="solar:download-minimalistic-linear" width={18} aria-hidden="true" />
            }
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        </PermissionGate>
      }
    >
      <AdminPageGuard permission={PERMISSIONS.ORDERS_MANAGE}>
        <Stack spacing={{ xs: 2, md: 2.5 }}>
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            spacing={1.5}
            alignItems={{ xs: 'stretch', lg: 'center' }}
          >
            <Box sx={{ flexGrow: 1, minWidth: 0, maxWidth: { lg: 280 } }}>
              <SearchInput
                value={q}
                onChange={(next) => setValue('q', next)}
                placeholder="Search orders"
                label="Search orders by title"
              />
            </Box>

            <FilterChipGroup
              label="Order status"
              options={ORDER_STATUS_OPTIONS}
              multiple
              value={status}
              onChange={(next) => setValue('status', next)}
              size="sm"
            />

            <FilterChipGroup
              label="Payment"
              options={PAYMENT_STATUS_OPTIONS}
              multiple
              value={payment}
              onChange={(next) => setValue('payment', next)}
              size="sm"
            />

            <FilterChipGroup
              label="Category"
              options={categoryOptions}
              multiple
              value={category}
              onChange={(next) => setValue('category', next)}
              size="sm"
            />

            <Stack direction="row" spacing={1} sx={{ minWidth: { lg: 300 } }}>
              <FormDateField
                label="Created from"
                value={from}
                onChange={(next) => setValue('from', next ?? '')}
                maxDate={to || undefined}
              />
              <FormDateField
                label="Created to"
                value={to}
                onChange={(next) => setValue('to', next ?? '')}
                minDate={from || undefined}
              />
            </Stack>

            <SortSelect
              value={sort}
              onChange={(next) => setValue('sort', next)}
              options={ORDER_SORT_OPTIONS}
            />
          </Stack>

          {/* MOCK-FILTER, said out loud (§13): the payment status lives on
              another collection, so it is applied to the page that came back
              rather than to the query. The total is therefore the count before
              that filter, and a page can legitimately look short. */}
          {data?.filteredInPage ? (
            <Alert severity="info" variant="outlined">
              The payment filter is applied to each page after it loads, so the result count above
              counts orders before it. Add an order-status filter to narrow the underlying set.
            </Alert>
          ) : null}

          <DataTable
            columns={columns}
            rows={rows}
            loading={isLoading}
            error={error}
            onRetry={refetch}
            emptyState={emptyState}
            onRowClick={(row) => navigate(paths.adminOrderDetail(row.id))}
            renderMobileCard={renderMobileCard}
            sort={{ key: sortState.sort, direction: sortState.order }}
            onSortChange={(next) => {
              const token = orderSortToken(next.key, next.direction)
              if (token) setValue('sort', token)
            }}
            pagination={{
              page,
              pageSize: OPERATIONS_PAGE_SIZE,
              total: data?.total ?? 0,
              onPageChange: (next) => setValues({ page: next }),
              itemLabel: 'orders',
            }}
            ariaLabel="Orders"
          />
        </Stack>
      </AdminPageGuard>
    </DashboardPage>
  )
}
