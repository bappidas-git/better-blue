import { useCallback, useMemo, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import StatusChip from '@/components/data-display/StatusChip'
import { useToast } from '@/components/feedback/ToastProvider'
import FilterChipGroup from '@/components/inputs/FilterChipGroup'
import FormDateField from '@/components/inputs/FormDateField'
import SearchInput from '@/components/inputs/SearchInput'
import SortSelect from '@/components/inputs/SortSelect'
import DataTable from '@/components/table/DataTable'
import { PERMISSIONS, hasPermission } from '@/constants/permissions'
import { STATUS_META } from '@/constants/statuses'
import { useAuth } from '@/context/AuthContext'
import RequestDetailSheet from '@/features/admin/operations/components/RequestDetailSheet'
import {
  OPERATIONS_EXPORT_LIMIT,
  OPERATIONS_PAGE_SIZE,
  REQUEST_OVERSIGHT_PARAMS,
  REQUEST_SORT_OPTIONS,
  REQUEST_STATUS_OPTIONS,
  dayBoundary,
  requestSortQuery,
  requestSortToken,
} from '@/features/admin/operations/utils/operationsFilters'
import { AdminPageGuard, AgeBadge, EntityRefChip } from '@/features/admin/shared'
import { formatBudget } from '@/features/requests/utils/requestDisplay'
import useApiQuery from '@/hooks/useApiQuery'
import useFeatureFlag from '@/hooks/useFeatureFlag'
import useListParams from '@/hooks/useListParams'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { PermissionGate } from '@/routes/guards'
import { categoryService } from '@/services/categoryService'
import { requestService } from '@/services/requestService'
import { exportRowsAsCsv } from '@/utils/exportCsv'
import { EMPTY_PLACEHOLDER, formatDate, formatNumber } from '@/utils/formatters'

// Platform-wide request oversight — Prompt 31 §4.1.
//
// The buyer sees their own briefs and creators see the open ones; this is the
// third view and the only one with no floor on status, because the question an
// admin arrives with is usually about a brief that is *not* on the board any
// more.
//
// Reading, mostly. The single intervention — a reasoned administrative closure —
// lives in the row's side sheet rather than on the row, because it is not a
// thing anybody should be able to do while skimming a table. It rides
// `requestService.adminCloseRequest`, which declines the live proposals and
// notifies everybody; nothing on this screen patches a status (§7).
//
// Not `AdminListPage`: this toolbar carries two chip groups and a date range,
// which is the case that component's own header says to copy rather than bend.

/** Columns in the CSV. Flatter than the table — no markup, no chips. */
const EXPORT_COLUMNS = [
  { key: 'id', label: 'Request ID' },
  { key: 'title', label: 'Title' },
  { key: 'buyerId', label: 'Buyer ID' },
  {
    key: 'buyerName',
    label: 'Buyer',
    format: (row) => row.buyer?.companyName ?? row.buyer?.name ?? '',
  },
  { key: 'categoryId', label: 'Category ID' },
  {
    key: 'status',
    label: 'Status',
    format: (row) => STATUS_META[row.status]?.label ?? row.status,
  },
  { key: 'budgetMin', label: 'Budget min' },
  { key: 'budgetMax', label: 'Budget max' },
  { key: 'currency', label: 'Currency' },
  { key: 'proposalsCount', label: 'Proposals' },
  { key: 'createdAt', label: 'Created', format: (row) => formatDate(row.createdAt) },
  { key: 'deadline', label: 'Deadline', format: (row) => formatDate(row.deadline) },
  { key: 'closureReason', label: 'Closure reason' },
]

export default function AdminRequestsPage() {
  const { user: actor } = useAuth()
  const toast = useToast()
  const canManage = hasPermission(actor, PERMISSIONS.REQUESTS_MANAGE)
  const { isEnabled: boardEnabled } = useFeatureFlag('publicRequestBoard')

  const { values, setValue, setValues, clearFilters, isFiltered } =
    useListParams(REQUEST_OVERSIGHT_PARAMS)
  const { q, status, category, from, to, sort, page } = values

  const [openRequest, setOpenRequest] = useState(null)
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

  // One object behind the table *and* the export, so a downloaded file can never
  // hold a different set of briefs than the screen showed.
  const query = useMemo(
    () => ({
      search: q || undefined,
      status: status.length > 0 ? status : undefined,
      categoryId: category.length > 0 ? category : undefined,
      createdFrom: dayBoundary(from, 'start'),
      createdTo: dayBoundary(to, 'end'),
      ...requestSortQuery(sort),
    }),
    [q, status, category, from, to, sort]
  )

  const { data, isLoading, error, refetch } = useApiQuery(
    () => requestService.adminListRequests({ ...query, page, limit: OPERATIONS_PAGE_SIZE }),
    [query, page]
  )

  const rows = useMemo(() => data?.items ?? [], [data])

  const closeRequest = useCallback(
    async (reason) => {
      const { declinedProposals } = await requestService.adminCloseRequest(openRequest.id, {
        reason,
        actor,
      })
      toast.success(`“${openRequest.title}” is closed.`, {
        description:
          declinedProposals > 0
            ? `${formatNumber(declinedProposals)} proposal${declinedProposals === 1 ? ' was' : 's were'} declined and their creators notified. The buyer was told too.`
            : 'The buyer has been notified. No proposals were waiting on it.',
      })
      setOpenRequest(null)
      refetch()
    },
    [actor, openRequest, refetch, toast]
  )

  const exportCsv = useCallback(async () => {
    setExporting(true)
    try {
      const all = await requestService.adminListRequests({
        ...query,
        page: 1,
        limit: OPERATIONS_EXPORT_LIMIT,
      })

      if (all.items.length === 0) {
        toast.info('There is nothing to export in this view.')
        return
      }
      if (!exportRowsAsCsv('betterblue-requests', EXPORT_COLUMNS, all.items)) {
        toast.error('We could not build the file. Try again in a moment.')
        return
      }

      toast.success(`Exported ${formatNumber(all.items.length)} requests.`, {
        description:
          all.total > all.items.length
            ? `Your filters match ${formatNumber(all.total)}; the export is capped at ${OPERATIONS_EXPORT_LIMIT}. Narrow the filters to get the rest.`
            : undefined,
      })
    } catch (failure) {
      toast.error(failure?.message ?? 'We could not export the request board.')
    } finally {
      setExporting(false)
    }
  }, [query, toast])

  const columns = useMemo(
    () => [
      {
        key: 'title',
        label: 'Request',
        render: (row) => (
          <Box sx={{ minWidth: 0, maxWidth: 320 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
              {row.title}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap component="p">
              {row.id}
            </Typography>
          </Box>
        ),
      },
      {
        key: 'buyer',
        label: 'Buyer',
        render: (row) =>
          row.buyer?.userId ? (
            <EntityRefChip
              type="user"
              id={row.buyer.userId}
              label={row.buyer.companyName ?? row.buyer.name}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              {EMPTY_PLACEHOLDER}
            </Typography>
          ),
      },
      {
        key: 'categoryId',
        label: 'Category',
        render: (row) => categoryNameById.get(row.categoryId) ?? EMPTY_PLACEHOLDER,
      },
      { key: 'budget', label: 'Budget', render: (row) => formatBudget(row) },
      {
        key: 'status',
        label: 'Status',
        render: (row) => <StatusChip status={row.status} size="sm" tooltip />,
      },
      {
        key: 'proposalsCount',
        label: 'Proposals',
        align: 'right',
        sortable: true,
        render: (row) => formatNumber(row.proposalsCount ?? 0),
      },
      {
        key: 'createdAt',
        label: 'Created',
        sortable: true,
        render: (row) => (
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2">{formatDate(row.createdAt)}</Typography>
            <AgeBadge date={row.createdAt} noun="Posted" warnAfterDays={14} errorAfterDays={30} />
          </Stack>
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
            {categoryNameById.get(row.categoryId) ?? EMPTY_PLACEHOLDER} · {formatBudget(row)} ·{' '}
            {formatNumber(row.proposalsCount ?? 0)} proposals
          </Typography>

          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
            {row.buyer?.userId ? (
              <EntityRefChip
                type="user"
                id={row.buyer.userId}
                label={row.buyer.companyName ?? row.buyer.name}
              />
            ) : null}
            <AgeBadge date={row.createdAt} noun="Posted" warnAfterDays={14} errorAfterDays={30} />
          </Stack>
        </CardContent>
      </Card>
    ),
    [categoryNameById]
  )

  const emptyState =
    isFiltered || q
      ? {
          icon: 'tabler:search-off',
          title: 'No requests match those filters',
          description: 'Try a shorter search term, a wider date range, or another status.',
          primaryAction: {
            label: 'Clear filters',
            onClick: () => clearFilters(),
            variant: 'outlined',
          },
        }
      : {
          icon: 'solar:clipboard-list-linear',
          title: 'No requests on the platform yet',
          description: 'Briefs appear here the moment a business posts one.',
        }

  const sortState = requestSortQuery(sort)

  return (
    <DashboardPage
      title="Requests"
      subtitle="Every brief posted on BetterBlue, whatever state it is in."
      maxWidth={false}
      actions={
        <PermissionGate permission={PERMISSIONS.REQUESTS_MANAGE}>
          <Button
            variant="outlined"
            onClick={exportCsv}
            disabled={exporting || isLoading}
            aria-label="Export the filtered requests as a CSV file"
            startIcon={
              <Icon icon="solar:download-minimalistic-linear" width={18} aria-hidden="true" />
            }
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        </PermissionGate>
      }
    >
      <AdminPageGuard permission={PERMISSIONS.REQUESTS_MANAGE}>
        <Stack spacing={{ xs: 2, md: 2.5 }}>
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            spacing={1.5}
            alignItems={{ xs: 'stretch', lg: 'center' }}
          >
            <Box sx={{ flexGrow: 1, minWidth: 0, maxWidth: { lg: 300 } }}>
              <SearchInput
                value={q}
                onChange={(next) => setValue('q', next)}
                placeholder="Search briefs"
                label="Search requests by title"
              />
            </Box>

            <FilterChipGroup
              label="Status"
              options={REQUEST_STATUS_OPTIONS}
              multiple
              value={status}
              onChange={(next) => setValue('status', next)}
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
                label="Posted from"
                value={from}
                onChange={(next) => setValue('from', next ?? '')}
                maxDate={to || undefined}
              />
              <FormDateField
                label="Posted to"
                value={to}
                onChange={(next) => setValue('to', next ?? '')}
                minDate={from || undefined}
              />
            </Stack>

            <SortSelect
              value={sort}
              onChange={(next) => setValue('sort', next)}
              options={REQUEST_SORT_OPTIONS}
            />
          </Stack>

          <DataTable
            columns={columns}
            rows={rows}
            loading={isLoading}
            error={error}
            onRetry={refetch}
            emptyState={emptyState}
            onRowClick={setOpenRequest}
            renderMobileCard={renderMobileCard}
            sort={{ key: sortState.sort, direction: sortState.order }}
            onSortChange={(next) => {
              const token = requestSortToken(next.key, next.direction)
              if (token) setValue('sort', token)
            }}
            pagination={{
              page,
              pageSize: OPERATIONS_PAGE_SIZE,
              total: data?.total ?? 0,
              onPageChange: (next) => setValues({ page: next }),
              itemLabel: 'requests',
            }}
            ariaLabel="Content requests"
          />
        </Stack>

        <RequestDetailSheet
          open={Boolean(openRequest)}
          onClose={() => setOpenRequest(null)}
          request={openRequest}
          buyer={openRequest?.buyer}
          categoryLabel={categoryNameById.get(openRequest?.categoryId)}
          canManage={canManage}
          boardEnabled={boardEnabled}
          onCloseRequest={closeRequest}
        />
      </AdminPageGuard>
    </DashboardPage>
  )
}
