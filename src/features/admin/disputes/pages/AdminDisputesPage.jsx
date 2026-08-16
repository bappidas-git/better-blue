import { useCallback, useMemo, useState } from 'react'

import Badge from '@mui/material/Badge'
import Box from '@mui/material/Box'
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
import SearchInput from '@/components/inputs/SearchInput'
import SortSelect from '@/components/inputs/SortSelect'
import { PERMISSIONS } from '@/constants/permissions'
import { useAuth } from '@/context/AuthContext'
import DisputeQueueRow from '@/features/admin/disputes/components/DisputeQueueRow'
import {
  DISPUTE_CATEGORY_FILTER_OPTIONS,
  DISPUTE_QUEUE_PAGE_SIZE,
  DISPUTE_QUEUE_PARAMS,
  DISPUTE_QUEUE_TAB,
  DISPUTE_QUEUE_TABS,
  DISPUTE_SORT_OPTIONS,
  disputeQueueTab,
  disputeSortQuery,
  filtersForTab,
} from '@/features/admin/disputes/utils/disputeQueue'
import { dayBoundary } from '@/features/admin/operations/utils/operationsFilters'
import { AdminPageGuard } from '@/features/admin/shared'
import useApiQuery from '@/hooks/useApiQuery'
import useListParams from '@/hooks/useListParams'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { canAssignDispute, disputeService } from '@/services/disputeService'

// The case queue — Prompt 33 §4.2.
//
// Five tabs, and they are five *questions* rather than five status filters:
// what has nobody picked up, what is mine, what is out with a party, what needs
// somebody senior, and what is finished. The counts beside them come from one
// call so a tab never lies about how much is behind it.
//
// Oldest first by default, everywhere. A dispute queue sorted newest-first
// quietly buries the case that has been frozen longest, which is precisely the
// one to open — and two people have been waiting on it while it sank.
//
// It does **not** use `AdminListPage`: that component has one chip filter, no
// tabs, and a `DataTable`, and this screen has tabs with counts, a category
// group, a date range, and cards at every width. Its own header says to copy
// the pattern when the shape differs, so this does.

/** What each tab says when it is empty. A clear queue is good news. */
const EMPTY_STATES = {
  [DISPUTE_QUEUE_TAB.UNASSIGNED]: {
    icon: 'solar:check-circle-linear',
    title: 'Nothing waiting to be picked up',
    description:
      'Every dispute raised has a reviewer on it. New cases arrive here the moment a buyer or a creator opens one.',
  },
  [DISPUTE_QUEUE_TAB.MINE]: {
    icon: 'solar:shield-check-linear',
    title: 'You have no live cases',
    description:
      'Cases you pick up appear here until you decide them. Take one from the Unassigned tab whenever you are ready.',
  },
  [DISPUTE_QUEUE_TAB.AWAITING]: {
    icon: 'solar:chat-round-dots-linear',
    title: 'Nothing is out with a party',
    description:
      'When you ask a buyer or a creator for more information, the case parks here until they answer.',
  },
  [DISPUTE_QUEUE_TAB.ESCALATED]: {
    icon: 'solar:shield-check-linear',
    title: 'Nothing escalated',
    description: 'Cases passed to a senior reviewer for a final decision appear here.',
  },
  [DISPUTE_QUEUE_TAB.SETTLED]: {
    icon: 'solar:archive-linear',
    title: 'No decisions yet',
    description: 'Every case that has been decided is kept here, with its outcome and reasoning.',
  },
}

export default function AdminDisputesPage() {
  const { user: actor } = useAuth()
  const toast = useToast()

  const { values, setValue, setValues, clearFilters, isFiltered } =
    useListParams(DISPUTE_QUEUE_PARAMS)
  const { tab, q, category, from, to, sort, page } = values

  const [assigningId, setAssigningId] = useState(null)

  const current = disputeQueueTab(tab)
  const sortQuery = disputeSortQuery(sort)

  const {
    data: counts,
    isLoading: countsLoading,
    refetch: refetchCounts,
  } = useApiQuery(() => disputeService.getQueueCounts({ adminId: actor?.id }), [actor?.id])

  const {
    data: queue,
    isLoading,
    error,
    refetch,
  } = useApiQuery(
    () =>
      disputeService.adminListQueue({
        page,
        limit: DISPUTE_QUEUE_PAGE_SIZE,
        search: q || undefined,
        sort: sortQuery.sort,
        order: sortQuery.order,
        filters: {
          ...filtersForTab(current.key, actor?.id),
          ...(category.length > 0 ? { category } : {}),
          ...(from ? { createdAt_gte: dayBoundary(from, 'start') } : {}),
          ...(to ? { createdAt_lte: dayBoundary(to, 'end') } : {}),
        },
      }),
    [current.key, actor?.id, q, category.join(','), from, to, sortQuery.sort, sortQuery.order, page]
  )

  const items = useMemo(() => queue?.items ?? [], [queue])

  const assignToMe = useCallback(
    async (dispute) => {
      setAssigningId(dispute.id)
      try {
        await disputeService.assign(dispute.id, { adminId: actor?.id, actor })
        toast.success('Case assigned to you.', {
          description: 'It has moved to Under review and is on your Mine tab.',
        })
        refetch()
        refetchCounts()
      } catch (failure) {
        toast.error(failure?.message ?? 'We could not assign that case.')
        // The case moved underneath the queue — show where it actually is.
        refetch()
        refetchCounts()
      } finally {
        setAssigningId(null)
      }
    },
    [actor, refetch, refetchCounts, toast]
  )

  const emptyState =
    isFiltered || q
      ? {
          icon: 'tabler:search-off',
          title: 'Nothing matches those filters',
          description: 'Try a wider date range, another category, or a shorter search term.',
          primaryAction: {
            label: 'Clear filters',
            onClick: () => clearFilters(),
            variant: 'outlined',
          },
        }
      : (EMPTY_STATES[current.key] ?? EMPTY_STATES[DISPUTE_QUEUE_TAB.UNASSIGNED])

  const toolbar = (
    <Stack spacing={1.5}>
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', lg: 'center' }}
      >
        <Box sx={{ flexGrow: 1, minWidth: 0, maxWidth: { lg: 340 } }}>
          <SearchInput
            value={q}
            onChange={(next) => setValue('q', next)}
            placeholder="Search what was reported"
            label="Search disputes by what was reported"
          />
        </Box>

        <SortSelect
          value={sort}
          onChange={(next) => setValue('sort', next)}
          options={DISPUTE_SORT_OPTIONS}
        />
      </Stack>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', md: 'center' }}
      >
        <FilterChipGroup
          label="Category"
          options={DISPUTE_CATEGORY_FILTER_OPTIONS}
          multiple
          value={category}
          onChange={(next) => setValues({ category: next, page: 1 })}
          size="sm"
        />

        <Stack direction="row" spacing={1} sx={{ minWidth: { md: 320 } }}>
          <FormDateField
            label="Raised from"
            value={from}
            onChange={(next) => setValues({ from: next ?? '', page: 1 })}
            maxDate={to || undefined}
          />
          <FormDateField
            label="Raised to"
            value={to}
            onChange={(next) => setValues({ to: next ?? '', page: 1 })}
            minDate={from || undefined}
          />
        </Stack>
      </Stack>
    </Stack>
  )

  const body = () => {
    if (error) {
      return (
        <ErrorState
          title="We could not load the case queue"
          message="Nothing has been lost — the cases are waiting, this list just failed to fetch."
          error={error}
          onRetry={refetch}
        />
      )
    }

    if (isLoading) return <ListSkeleton rows={4} label="Loading the case queue" />

    if (items.length === 0) return <EmptyState {...emptyState} />

    return (
      <Stack spacing={{ xs: 1.5, md: 2 }}>
        <Stack component="ul" spacing={{ xs: 1.5, md: 2 }} sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {items.map((dispute) => (
            <DisputeQueueRow
              key={dispute.id}
              dispute={dispute}
              assigning={assigningId === dispute.id}
              // Offered only where it means something: a live case that is not
              // already this reviewer's. A button that would reassign a case to
              // the person who already owns it is a button that does nothing.
              onAssignToMe={
                canAssignDispute(dispute) && dispute.assignedAdminId !== actor?.id
                  ? assignToMe
                  : undefined
              }
            />
          ))}
        </Stack>

        <PaginationControl
          page={queue?.page ?? 1}
          pageSize={DISPUTE_QUEUE_PAGE_SIZE}
          total={queue?.total ?? 0}
          onPageChange={(next) => setValues({ page: next })}
          itemLabel="disputes"
          hideOnSinglePage
        />
      </Stack>
    )
  }

  return (
    <DashboardPage
      title="Disputes"
      subtitle="Contested orders, oldest first. Money stays frozen until a case is decided."
      maxWidth={false}
    >
      <AdminPageGuard permission={PERMISSIONS.DISPUTES_RESOLVE}>
        <Tabs
          value={current.key}
          onChange={(event, next) => setValues({ tab: next, page: 1 })}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          aria-label="Dispute queues"
          sx={{ borderBottom: 1, borderColor: 'divider', mb: { xs: 2, md: 2.5 } }}
        >
          {DISPUTE_QUEUE_TABS.map((entry) => {
            const count = counts?.[entry.countKey]
            return (
              <Tab
                key={entry.key}
                value={entry.key}
                sx={{ minHeight: 48, textTransform: 'none', fontWeight: 600 }}
                label={
                  <Badge
                    // A count that could not be read renders no badge at all —
                    // a `0` there would read as "nothing waiting" (§13).
                    badgeContent={countsLoading || count == null ? 0 : count}
                    color="primary"
                    max={99}
                    sx={{ '& .MuiBadge-badge': { right: -14, top: 2 } }}
                  >
                    <Box component="span" sx={{ pr: count ? 2 : 0 }}>
                      {entry.label}
                    </Box>
                  </Badge>
                }
              />
            )
          })}
        </Tabs>

        <Stack spacing={{ xs: 2, md: 2.5 }}>
          {toolbar}
          {body()}
        </Stack>
      </AdminPageGuard>
    </DashboardPage>
  )
}
