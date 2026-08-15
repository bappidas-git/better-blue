import { useCallback, useMemo } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import { Link as RouterLink } from 'react-router-dom'

import PaginationControl from '@/components/data-display/PaginationControl'
import EmptyState from '@/components/feedback/EmptyState'
import ErrorState from '@/components/feedback/ErrorState'
import ListSkeleton from '@/components/feedback/skeletons/ListSkeleton'
import SearchInput from '@/components/inputs/SearchInput'
import SortSelect from '@/components/inputs/SortSelect'
import { useAuth } from '@/context/AuthContext'
import { useDiscoveryParams } from '@/features/discovery/hooks/useDiscoveryParams'
import BuyerRequestCard from '@/features/requests/components/BuyerRequestCard'
import useRequestActions from '@/features/requests/hooks/useRequestActions'
import {
  BUYER_REQUEST_PARAMS,
  countForTab,
  REQUEST_TAB,
  REQUEST_TABS,
  REQUEST_SORT_OPTIONS,
  sortQueryFor,
  statusFilterForTab,
} from '@/features/requests/utils/buyerRequestFilters'
import useApiQuery from '@/hooks/useApiQuery'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { paths } from '@/routes/paths'
import { categoryService } from '@/services/categoryService'
import { requestService } from '@/services/requestService'
import { formatNumber } from '@/utils/formatters'

// "My requests" — every brief a buyer has ever written, in the six states one
// can be in, following the standard list pattern (00 §12): header → tabs →
// toolbar → cards → pagination, with the whole of it readable off the URL.
//
// The page fetches; `BuyerRequestCard` renders; `useRequestActions` owns the
// five things a brief can be told to do (00 §16.9). Nothing here computes
// anything about the domain beyond picking which empty state fits.

/** Cards per page. Smaller than the 12 a grid takes — these are full-width rows. */
const PAGE_SIZE = 10

/** What each tab says when it has nothing in it. */
const EMPTY_STATES = {
  [REQUEST_TAB.ALL]: {
    icon: 'solar:clipboard-list-linear',
    title: 'No requests yet',
    description:
      'A content request is a brief: what you need made, your budget, and when you need it. Creators respond with priced proposals.',
    primaryAction: { label: 'Post your first request', to: paths.BUYER_REQUEST_NEW, icon: 'tabler:plus' },
  },
  [REQUEST_TAB.DRAFTS]: {
    icon: 'solar:document-text-linear',
    title: 'No drafts saved',
    description:
      'The wizard saves as you go, so you can start a brief now and finish it whenever the details are settled.',
    primaryAction: { label: 'Start a request', to: paths.BUYER_REQUEST_NEW, icon: 'tabler:plus' },
  },
  [REQUEST_TAB.OPEN]: {
    icon: 'solar:inbox-in-linear',
    title: 'Nothing open right now',
    description:
      'Post a brief and creators can start sending you proposals — usually within 48 hours.',
    primaryAction: { label: 'Post your first request', to: paths.BUYER_REQUEST_NEW, icon: 'tabler:plus' },
  },
  [REQUEST_TAB.AWARDED]: {
    icon: 'solar:medal-ribbon-linear',
    title: 'Nothing awarded yet',
    description:
      'When you accept a proposal, the brief moves here and an order opens for you to fund.',
  },
  [REQUEST_TAB.COMPLETED]: {
    icon: 'solar:verified-check-linear',
    title: 'No completed requests',
    description: 'Briefs land here once the content has been delivered and you have accepted it.',
  },
  [REQUEST_TAB.ARCHIVED]: {
    icon: 'solar:archive-linear',
    title: 'Nothing closed',
    description:
      'Requests you close or cancel are kept here, so your records stay complete without cluttering the live list.',
  },
}

/** The empty state a search inside a tab gets — different problem, different way out. */
const noMatchesState = (onClear) => ({
  icon: 'tabler:search-off',
  title: 'No requests match your search',
  description: 'Try a shorter search term, or look in another tab.',
  primaryAction: { label: 'Clear search', onClick: onClear, variant: 'outlined' },
})

export default function BuyerRequestsPage() {
  const { user } = useAuth()
  const buyerId = user?.id

  const { values, setValue } = useDiscoveryParams(BUYER_REQUEST_PARAMS)
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
      requestService.listForBuyer(buyerId, {
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
  // someone searches or turns a page. Refetched alongside the list after a
  // mutation, since publishing or closing moves a brief between two tabs.
  const { data: counts, refetch: refetchCounts } = useApiQuery(
    () => requestService.countsByStatus(buyerId),
    [buyerId],
    { enabled: Boolean(buyerId) }
  )

  // Cached in the service for the session (Prompt 07), so this is one request
  // for the whole dashboard rather than one per card.
  const { data: categories } = useApiQuery(() => categoryService.listActive(), [])
  const categoryNames = useMemo(
    () => new Map((categories ?? []).map((category) => [category.id, category.name])),
    [categories]
  )

  const refresh = useCallback(() => {
    refetch()
    refetchCounts()
  }, [refetch, refetchCounts])

  const { run, busyRequestId } = useRequestActions({ buyerId, onChanged: refresh })

  const items = list?.items ?? []
  const total = list?.total ?? 0
  const isSearching = Boolean(q)

  const emptyState = isSearching
    ? noMatchesState(() => setValue('q', ''))
    : (EMPTY_STATES[tab] ?? EMPTY_STATES[REQUEST_TAB.ALL])

  return (
    <DashboardPage
      title="Requests"
      subtitle="Every brief you have written, and the proposals waiting on them."
      actions={
        <Button
          component={RouterLink}
          to={paths.BUYER_REQUEST_NEW}
          variant="gradient"
          startIcon={<Icon icon="tabler:plus" width={18} aria-hidden="true" />}
        >
          New request
        </Button>
      }
    >
      <Tabs
        value={tab}
        onChange={(event, next) => setValue('tab', next)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        aria-label="Filter requests by status"
        sx={{ borderBottom: 1, borderColor: 'divider', mb: { xs: 2, md: 2.5 } }}
      >
        {REQUEST_TABS.map((entry) => {
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
            placeholder="Search your requests"
            label="Search your requests"
          />
        </Box>
        <SortSelect
          value={sort}
          onChange={(next) => setValue('sort', next)}
          options={REQUEST_SORT_OPTIONS}
        />
      </Stack>

      {error ? (
        <ErrorState
          title="We could not load your requests"
          message="Nothing has changed about them — this list just needs another go."
          error={error}
          onRetry={refresh}
        />
      ) : isLoading ? (
        <ListSkeleton rows={4} avatar={false} label="Loading your requests" />
      ) : items.length === 0 ? (
        <EmptyState {...emptyState} />
      ) : (
        <>
          <Stack component="ul" spacing={2} sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {items.map((request) => (
              <Box
                key={request.id}
                sx={{
                  // The card being acted on stops responding while its
                  // confirmation is open, rather than the whole page freezing.
                  opacity: busyRequestId === request.id ? 0.6 : 1,
                  pointerEvents: busyRequestId === request.id ? 'none' : undefined,
                  transition: (theme) => theme.transitions.create('opacity'),
                }}
              >
                <BuyerRequestCard
                  request={request}
                  categoryLabel={categoryNames.get(request.categoryId)}
                  onAction={run}
                />
              </Box>
            ))}
          </Stack>

          <PaginationControl
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={(next) => setValue('page', next)}
            itemLabel="requests"
            hideOnSinglePage
          />
        </>
      )}
    </DashboardPage>
  )
}
