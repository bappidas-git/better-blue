import { useCallback, useMemo } from 'react'

import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'

import PaginationControl from '@/components/data-display/PaginationControl'
import EmptyState from '@/components/feedback/EmptyState'
import ErrorState from '@/components/feedback/ErrorState'
import ListSkeleton from '@/components/feedback/skeletons/ListSkeleton'
import SearchInput from '@/components/inputs/SearchInput'
import SortSelect from '@/components/inputs/SortSelect'
import { useAuth } from '@/context/AuthContext'
import { useDiscoveryParams } from '@/features/discovery/hooks/useDiscoveryParams'
import CreatorOrderCard from '@/features/orders/components/CreatorOrderCard'
import {
  CREATOR_ORDER_PARAMS,
  CREATOR_ORDER_SORT_OPTIONS,
  CREATOR_ORDER_TAB,
  CREATOR_ORDER_TABS,
  creatorCountForTab,
  creatorSortQueryFor,
  creatorStatusFilterForTab,
} from '@/features/orders/utils/creatorOrderFilters'
import useApiQuery from '@/hooks/useApiQuery'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { paths } from '@/routes/paths'
import { orderService } from '@/services/orderService'
import { requestService } from '@/services/requestService'
import { formatNumber } from '@/utils/formatters'

// "My orders" — every engagement a creator has won, grouped by whose move it is.
//
// The standard list pattern (00 §12): header → tabs → toolbar → cards →
// pagination, all of it readable off the URL. Sorted by due date rather than by
// recency out of the box, because the question this page answers is "what do I
// owe somebody next".
//
// The page fetches; `CreatorOrderCard` renders; `orderDisplay` decides what each
// state means for a creator. Nothing here computes anything about the domain.

/** Cards per page. Smaller than a grid's twelve — these are full-width rows. */
const PAGE_SIZE = 10

/** What each tab says when it has nothing in it. */
const EMPTY_STATES = {
  [CREATOR_ORDER_TAB.ACTIVE]: {
    icon: 'solar:box-linear',
    title: 'No orders in flight',
    description:
      'An order opens when a buyer accepts one of your proposals and funds it. Browse the board and put an offer in.',
    primaryAction: {
      label: 'Browse requests',
      to: paths.CREATOR_BROWSE,
      icon: 'solar:magnifer-linear',
    },
  },
  [CREATOR_ORDER_TAB.DELIVERED]: {
    icon: 'solar:inbox-line-linear',
    title: 'Nothing awaiting review',
    description:
      'Work you have handed over sits here while the buyer reviews it. Nothing is with them right now.',
  },
  [CREATOR_ORDER_TAB.COMPLETED]: {
    icon: 'solar:verified-check-linear',
    title: 'Nothing completed yet',
    description:
      'Orders land here once the buyer has accepted your delivery and the escrow has been released to you.',
  },
  [CREATOR_ORDER_TAB.CLOSED]: {
    icon: 'solar:archive-linear',
    title: 'Nothing cancelled',
    description:
      'Engagements that were called off or refunded are kept here, so your records stay complete without cluttering the live list.',
  },
  [CREATOR_ORDER_TAB.DISPUTED]: {
    icon: 'solar:shield-check-linear',
    title: 'No disputes',
    description:
      'If a buyer and a creator cannot agree on a delivery, our team steps in. Nothing is open right now.',
  },
}

/** The empty state a search inside a tab gets — different problem, different way out. */
const noMatchesState = (onClear) => ({
  icon: 'tabler:search-off',
  title: 'No orders match your search',
  description: 'Try a shorter search term, or look in another tab.',
  primaryAction: { label: 'Clear search', onClick: onClear, variant: 'outlined' },
})

export default function CreatorOrdersPage() {
  const { user } = useAuth()
  const creatorId = user?.id

  const { values, setValue } = useDiscoveryParams(CREATOR_ORDER_PARAMS)
  const { tab, q, sort, page } = values

  const { sort: sortField, order } = creatorSortQueryFor(sort)
  const statusFilter = creatorStatusFilterForTab(tab)

  const {
    data: list,
    isLoading,
    error,
    refetch,
  } = useApiQuery(
    () =>
      orderService.listByCreator(creatorId, {
        page,
        limit: PAGE_SIZE,
        sort: sortField,
        order,
        search: q || undefined,
        filters: statusFilter ? { status: statusFilter } : undefined,
      }),
    [creatorId, page, sortField, order, q, statusFilter],
    { enabled: Boolean(creatorId) }
  )

  // Counts drive the tab badges and are a separate read on purpose: they
  // describe the whole account, so they must not move when someone searches or
  // turns a page.
  const { data: counts, refetch: refetchCounts } = useApiQuery(
    () => orderService.countsByCreatorStatus(creatorId),
    [creatorId],
    { enabled: Boolean(creatorId) }
  )

  const items = useMemo(() => list?.items ?? [], [list])

  // MOCK-JOIN: orders carry `buyerId` only (00 §10 bans `_expand`), so the
  // businesses on a page of cards come from one batched follow-up. A failure
  // leaves the cards intact without a name rather than failing the list.
  const buyerIds = useMemo(
    () => [...new Set(items.map((entry) => entry.buyerId).filter(Boolean))],
    [items]
  )
  const { data: buyers } = useApiQuery(
    () => requestService.getBuyerSummaries(buyerIds).catch(() => new Map()),
    [buyerIds.join(',')],
    { enabled: buyerIds.length > 0 }
  )

  const refresh = useCallback(() => {
    refetch()
    refetchCounts()
  }, [refetch, refetchCounts])

  const total = list?.total ?? 0
  const isSearching = Boolean(q)

  const emptyState = isSearching
    ? noMatchesState(() => setValue('q', ''))
    : (EMPTY_STATES[tab] ?? EMPTY_STATES[CREATOR_ORDER_TAB.ACTIVE])

  return (
    <DashboardPage
      title="Orders"
      subtitle="Every engagement you have won, and what each one is waiting on."
    >
      <Tabs
        value={tab}
        onChange={(event, next) => setValue('tab', next)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        aria-label="Filter orders by status"
        sx={{ borderBottom: 1, borderColor: 'divider', mb: { xs: 2, md: 2.5 } }}
      >
        {CREATOR_ORDER_TABS.map((entry) => {
          const count = creatorCountForTab(entry.key, counts)
          return (
            <Tab
              key={entry.key}
              value={entry.key}
              label={count === undefined ? entry.label : `${entry.label} (${formatNumber(count)})`}
              sx={{ minHeight: 48, textTransform: 'none', fontWeight: 600 }}
            />
          )
        })}
      </Tabs>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        sx={{ mb: { xs: 2, md: 2.5 } }}
      >
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <SearchInput
            value={q}
            onChange={(next) => setValue('q', next)}
            placeholder="Search your orders"
            label="Search your orders"
          />
        </Box>
        <SortSelect
          value={sort}
          onChange={(next) => setValue('sort', next)}
          options={CREATOR_ORDER_SORT_OPTIONS}
        />
      </Stack>

      {error ? (
        <ErrorState
          title="We could not load your orders"
          message="Nothing has changed about them — this list just needs another go."
          error={error}
          onRetry={refresh}
        />
      ) : isLoading ? (
        <ListSkeleton rows={4} avatar={false} label="Loading your orders" />
      ) : items.length === 0 ? (
        <EmptyState {...emptyState} />
      ) : (
        <>
          <Stack component="ul" spacing={2} sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {items.map((entry) => (
              <CreatorOrderCard
                key={entry.id}
                order={entry}
                buyer={buyers?.get(entry.buyerId)}
              />
            ))}
          </Stack>

          <PaginationControl
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={(next) => setValue('page', next)}
            itemLabel="orders"
            hideOnSinglePage
          />
        </>
      )}
    </DashboardPage>
  )
}
