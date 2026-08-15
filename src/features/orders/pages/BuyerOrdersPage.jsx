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
import OrderCard from '@/features/orders/components/OrderCard'
import {
  BUYER_ORDER_PARAMS,
  countForTab,
  ORDER_SORT_OPTIONS,
  ORDER_TAB,
  ORDER_TABS,
  sortQueryFor,
  statusFilterForTab,
} from '@/features/orders/utils/buyerOrderFilters'
import { useDiscoveryParams } from '@/features/discovery/hooks/useDiscoveryParams'
import useApiQuery from '@/hooks/useApiQuery'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { paths } from '@/routes/paths'
import { orderService } from '@/services/orderService'
import { userService } from '@/services/userService'
import { formatNumber } from '@/utils/formatters'

// "My orders" — every engagement a buyer has funded, in the four states one can
// be in from their side, following the standard list pattern (00 §12): header →
// tabs → toolbar → cards → pagination, with the whole of it readable off the
// URL.
//
// The page fetches; `OrderCard` renders; `orderDisplay` decides what each state
// means. Nothing here computes anything about the domain.

/** Cards per page. Smaller than the 12 a grid takes — these are full-width rows. */
const PAGE_SIZE = 10

/** Creators fetched in one batch to name a page of orders. */
const CREATOR_BATCH = 100

/** What each tab says when it has nothing in it. */
const EMPTY_STATES = {
  [ORDER_TAB.ACTIVE]: {
    icon: 'solar:box-linear',
    title: 'No orders in flight',
    description:
      'An order opens when you accept a proposal on one of your briefs. Fund it, and the creator starts.',
    primaryAction: { label: 'View my requests', to: paths.BUYER_REQUESTS, icon: 'solar:clipboard-list-linear' },
  },
  [ORDER_TAB.COMPLETED]: {
    icon: 'solar:verified-check-linear',
    title: 'Nothing completed yet',
    description:
      'Orders land here once you have accepted the delivery and the escrow has been released.',
  },
  [ORDER_TAB.CLOSED]: {
    icon: 'solar:archive-linear',
    title: 'Nothing cancelled',
    description:
      'Orders that were called off or refunded are kept here, so your records stay complete without cluttering the live list.',
  },
  [ORDER_TAB.DISPUTED]: {
    icon: 'solar:shield-check-linear',
    title: 'No disputes',
    description:
      'If a delivery does not match the brief and revisions have not fixed it, our team steps in. Nothing is open right now.',
  },
}

/** The empty state a search inside a tab gets — different problem, different way out. */
const noMatchesState = (onClear) => ({
  icon: 'tabler:search-off',
  title: 'No orders match your search',
  description: 'Try a shorter search term, or look in another tab.',
  primaryAction: { label: 'Clear search', onClick: onClear, variant: 'outlined' },
})

export default function BuyerOrdersPage() {
  const { user } = useAuth()
  const buyerId = user?.id

  const { values, setValue } = useDiscoveryParams(BUYER_ORDER_PARAMS)
  const { tab, q, sort, page } = values

  const { sort: sortField, order } = sortQueryFor(sort)
  const statusFilter = statusFilterForTab(tab)

  const {
    data: list,
    isLoading,
    error,
    refetch,
  } = useApiQuery(
    () =>
      orderService.listByBuyer(buyerId, {
        page,
        limit: PAGE_SIZE,
        sort: sortField,
        order,
        search: q || undefined,
        filters: statusFilter ? { status: statusFilter } : undefined,
      }),
    [buyerId, page, sortField, order, q, statusFilter],
    { enabled: Boolean(buyerId) }
  )

  // Counts drive the tab badges and are deliberately a separate query: they
  // describe the whole account, not the page, so they must not change when
  // someone searches or turns a page.
  const { data: counts, refetch: refetchCounts } = useApiQuery(
    () => orderService.countsByStatus(buyerId),
    [buyerId],
    { enabled: Boolean(buyerId) }
  )

  const items = useMemo(() => list?.items ?? [], [list])

  // MOCK-JOIN: orders carry `creatorId` only (00 §10 bans `_expand`), so the
  // names on a page of cards come from one batched follow-up. A failure leaves
  // the cards intact without a name rather than failing the list.
  const creatorIds = useMemo(
    () => [...new Set(items.map((entry) => entry.creatorId).filter(Boolean))],
    [items]
  )
  const { data: creators } = useApiQuery(
    () => userService.listByIds(creatorIds.slice(0, CREATOR_BATCH)).catch(() => []),
    [creatorIds.join(',')],
    { enabled: creatorIds.length > 0 }
  )
  const creatorsById = useMemo(
    () => new Map((creators ?? []).map((creator) => [creator.id, creator])),
    [creators]
  )

  const refresh = useCallback(() => {
    refetch()
    refetchCounts()
  }, [refetch, refetchCounts])

  const total = list?.total ?? 0
  const isSearching = Boolean(q)

  const emptyState = isSearching
    ? noMatchesState(() => setValue('q', ''))
    : (EMPTY_STATES[tab] ?? EMPTY_STATES[ORDER_TAB.ACTIVE])

  return (
    <DashboardPage
      title="Orders"
      subtitle="Every engagement you have funded, and what each one is waiting on."
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
        {ORDER_TABS.map((entry) => {
          const count = countForTab(entry.key, counts)
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
          options={ORDER_SORT_OPTIONS}
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
              <OrderCard
                key={entry.id}
                order={entry}
                creator={creatorsById.get(entry.creatorId)}
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
