import { useCallback, useEffect, useMemo, useState } from 'react'

import Box from '@mui/material/Box'
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
import { TICKET_STATUS } from '@/constants/statuses'
import { useAuth } from '@/context/AuthContext'
import TicketDetailSheet from '@/features/admin/operations/components/TicketDetailSheet'
import {
  OPERATIONS_PAGE_SIZE,
  SUPPORT_QUEUE_PARAMS,
  TICKET_SLA,
  TICKET_SORT_OPTIONS,
  TICKET_STATUS_OPTIONS,
  dayBoundary,
  ticketSortQuery,
} from '@/features/admin/operations/utils/operationsFilters'
import { AdminPageGuard, AgeBadge, EntityRefChip } from '@/features/admin/shared'
import useApiQuery from '@/hooks/useApiQuery'
import useListParams from '@/hooks/useListParams'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { API_ERROR_CODE } from '@/services'
import { supportService } from '@/services/supportService'
import { EMPTY_PLACEHOLDER, formatDateTime, truncate } from '@/utils/formatters'

// The support queue — Prompt 31 §4.3.
//
// Tickets arrive from Prompt 11's contact form, which anybody can use signed
// out, so a row's requester is `null` as often as not and the address on the
// ticket is the only way to reach them. The queue treats that as normal rather
// than as missing data.
//
// The open ticket is in the URL (`?ticket=tkt_003`), which is what makes a
// ticket linkable between admins — the thing an operations desk asks for about
// twenty minutes into using a queue that does not have it.

export default function AdminSupportPage() {
  const { user: actor } = useAuth()
  const toast = useToast()
  const canManage = hasPermission(actor, PERMISSIONS.SUPPORT_MANAGE)

  const { values, setValue, setValues, clearFilters, isFiltered } =
    useListParams(SUPPORT_QUEUE_PARAMS)
  const { q, status, from, to, sort, ticket: openTicketId, page } = values

  // The sheet's own reload token: replying does not change which tickets are in
  // the queue, so re-reading the whole list on every reply would be a page-wide
  // flash for a one-line change.
  const [threadToken, setThreadToken] = useState(0)

  const query = useMemo(
    () => ({
      search: q || undefined,
      status: status.length > 0 ? status : undefined,
      createdFrom: dayBoundary(from, 'start'),
      createdTo: dayBoundary(to, 'end'),
      ...ticketSortQuery(sort),
    }),
    [q, status, from, to, sort]
  )

  const { data, isLoading, error, refetch } = useApiQuery(
    () => supportService.adminListTickets({ ...query, page, limit: OPERATIONS_PAGE_SIZE }),
    [query, page]
  )

  const { data: context, isLoading: contextLoading, error: contextError } = useApiQuery(
    () => supportService.getTicketContext(openTicketId),
    [openTicketId, threadToken],
    { enabled: Boolean(openTicketId) }
  )

  // A `?ticket=` that no longer resolves would otherwise leave a permanent
  // skeleton on screen. Only `not_found` clears it — a network blip should
  // leave the link intact so a retry still lands on the right ticket.
  useEffect(() => {
    if (contextError?.code === API_ERROR_CODE.NOT_FOUND) {
      setValues({ ticket: '', page })
      toast.error('That ticket no longer exists.')
    }
  }, [contextError, page, setValues, toast])

  const rows = useMemo(() => data?.items ?? [], [data])

  const reply = useCallback(
    async (body) => {
      await supportService.replyToTicket(openTicketId, { body, actor })
      toast.success('Reply saved to the ticket.', {
        description: 'The ticket is now awaiting the member. No email is sent in this version.',
      })
      setThreadToken((token) => token + 1)
      refetch()
    },
    [actor, openTicketId, refetch, toast]
  )

  const setStatus = useCallback(
    async (nextStatus, note) => {
      await supportService.setTicketStatus(openTicketId, { status: nextStatus, note, actor })
      toast.success(
        nextStatus === TICKET_STATUS.OPEN
          ? 'Ticket reopened.'
          : `Ticket marked ${nextStatus}.`,
        { description: 'The change is in the audit trail.' }
      )
      setThreadToken((token) => token + 1)
      refetch()
    },
    [actor, openTicketId, refetch, toast]
  )

  const columns = useMemo(
    () => [
      {
        key: 'subject',
        label: 'Subject',
        render: (row) => (
          <Box sx={{ minWidth: 0, maxWidth: 380 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
              {row.subject}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p" noWrap>
              {truncate(row.body, 90)}
            </Typography>
          </Box>
        ),
      },
      {
        key: 'requester',
        label: 'From',
        render: (row) =>
          row.requester?.id ? (
            <EntityRefChip type="user" id={row.requester.id} label={row.requester.name} />
          ) : (
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap>
                {row.name ?? EMPTY_PLACEHOLDER}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap component="p">
                {row.email} · not registered
              </Typography>
            </Box>
          ),
      },
      {
        key: 'status',
        label: 'Status',
        render: (row) => <StatusChip status={row.status} size="sm" tooltip />,
      },
      {
        key: 'replies',
        label: 'Replies',
        align: 'right',
        render: (row) => (row.replies ?? []).length,
      },
      {
        key: 'createdAt',
        label: 'Received',
        render: (row) => (
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2">{formatDateTime(row.createdAt)}</Typography>
            <AgeBadge date={row.createdAt} noun="Received" {...TICKET_SLA} />
          </Stack>
        ),
      },
    ],
    []
  )

  const renderMobileCard = useCallback(
    (row) => (
      <Card>
        <CardContent sx={{ p: 2 }}>
          <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1 }}>
            <Typography variant="subtitle2" component="h3" sx={{ flexGrow: 1, minWidth: 0 }}>
              {row.subject}
            </Typography>
            <StatusChip status={row.status} size="sm" />
          </Stack>

          <Typography variant="body2" color="text.secondary">
            {truncate(row.body, 120)}
          </Typography>

          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
            {row.requester?.id ? (
              <EntityRefChip type="user" id={row.requester.id} label={row.requester.name} />
            ) : (
              <Typography variant="caption" color="text.secondary">
                {row.name} · not registered
              </Typography>
            )}
            <AgeBadge date={row.createdAt} noun="Received" {...TICKET_SLA} />
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
          title: 'No tickets match those filters',
          description: 'Try a shorter search term, a wider date range, or another status.',
          primaryAction: {
            label: 'Clear filters',
            onClick: () => clearFilters(),
            variant: 'outlined',
          },
        }
      : {
          icon: 'solar:chat-round-line-linear',
          title: 'The inbox is clear',
          description: 'Nothing is waiting on the support team right now.',
        }

  return (
    <DashboardPage
      title="Support"
      subtitle="Questions members have sent through the contact form."
      maxWidth={false}
    >
      <AdminPageGuard permission={PERMISSIONS.SUPPORT_MANAGE}>
        <Stack spacing={{ xs: 2, md: 2.5 }}>
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            spacing={1.5}
            alignItems={{ xs: 'stretch', lg: 'center' }}
          >
            <Box sx={{ flexGrow: 1, minWidth: 0, maxWidth: { lg: 320 } }}>
              <SearchInput
                value={q}
                onChange={(next) => setValue('q', next)}
                placeholder="Search tickets"
                label="Search tickets by subject or message"
              />
            </Box>

            <FilterChipGroup
              label="Status"
              options={TICKET_STATUS_OPTIONS}
              multiple
              value={status}
              onChange={(next) => setValue('status', next)}
              size="sm"
            />

            <Stack direction="row" spacing={1} sx={{ minWidth: { lg: 300 } }}>
              <FormDateField
                label="Received from"
                value={from}
                onChange={(next) => setValue('from', next ?? '')}
                maxDate={to || undefined}
              />
              <FormDateField
                label="Received to"
                value={to}
                onChange={(next) => setValue('to', next ?? '')}
                minDate={from || undefined}
              />
            </Stack>

            <SortSelect
              value={sort}
              onChange={(next) => setValue('sort', next)}
              options={TICKET_SORT_OPTIONS}
            />
          </Stack>

          <DataTable
            columns={columns}
            rows={rows}
            loading={isLoading}
            error={error}
            onRetry={refetch}
            emptyState={emptyState}
            onRowClick={(row) => setValues({ ticket: row.id, page })}
            renderMobileCard={renderMobileCard}
            pagination={{
              page,
              pageSize: OPERATIONS_PAGE_SIZE,
              total: data?.total ?? 0,
              onPageChange: (next) => setValues({ page: next }),
              itemLabel: 'tickets',
            }}
            ariaLabel="Support tickets"
          />
        </Stack>

        <TicketDetailSheet
          open={Boolean(openTicketId)}
          onClose={() => setValues({ ticket: '', page })}
          context={context}
          isLoading={contextLoading}
          canManage={canManage}
          onReply={reply}
          onSetStatus={setStatus}
        />
      </AdminPageGuard>
    </DashboardPage>
  )
}
