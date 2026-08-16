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
import { useAuth } from '@/context/AuthContext'
import DisputeCard from '@/features/disputes/components/DisputeCard'
import {
  counterpartId,
  DISPUTE_TAB,
  DISPUTE_TABS,
  DISPUTE_LIST_PARAMS,
  disputeRoutesFor,
  statusFilterForTab,
} from '@/features/disputes/utils/disputeDisplay'
import useApiQuery from '@/hooks/useApiQuery'
import useListParams from '@/hooks/useListParams'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { disputeService } from '@/services/disputeService'
import { orderService } from '@/services/orderService'
import { userService } from '@/services/userService'

// "Disputes" — the same screen on both dashboards.
//
// **One component, two mounts** (§7). The buyer's copy and the creator's copy of
// this page differ in exactly two ways — which cases come back, and which URLs
// the cards link to — and both of those are the signed-in role, which the page
// reads for itself. There is no `BuyerDisputesPage`, and there should never be
// one: the day the two diverge, the divergence belongs in `disputeDisplay.js`
// where it can be read side by side.
//
// The standard list pattern (00 §12): header → tabs → search → cards →
// pagination, all readable off the URL. No sort control — a dispute list is
// short and there is only one order anyone wants it in, which is the one it
// comes back in.

/** Cards per page. Full-width rows, and a member with more than ten is unusual. */
const PAGE_SIZE = 10

/** What each tab says when it has nothing in it — calm, and glad to be empty. */
const EMPTY_STATES = {
  [DISPUTE_TAB.OPEN]: {
    icon: 'solar:shield-check-linear',
    title: 'No disputes — hopefully it stays that way',
    description:
      'If an order goes wrong, you can raise a dispute from the order itself and our team will step in. Nothing is open right now.',
  },
  [DISPUTE_TAB.RESOLVED]: {
    icon: 'solar:shield-check-linear',
    title: 'Nothing decided yet',
    description: 'Disputes our team has issued a decision on are kept here, with the reasoning.',
  },
  [DISPUTE_TAB.CLOSED]: {
    icon: 'solar:archive-linear',
    title: 'Nothing closed',
    description: 'Finished cases are filed here so your records stay complete.',
  },
}

/** The empty state a search inside a tab gets — different problem, different way out. */
const noMatchesState = (onClear) => ({
  icon: 'tabler:search-off',
  title: 'No disputes match your search',
  description: 'Try a shorter search term, or look in another tab.',
  primaryAction: { label: 'Clear search', onClick: onClear, variant: 'outlined' },
})

export default function DisputesListPage() {
  const { user } = useAuth()
  const viewerId = user?.id
  const role = user?.role
  const routes = disputeRoutesFor(role)

  const { values, setValue } = useListParams(DISPUTE_LIST_PARAMS)
  const { tab, q, page } = values

  const {
    data: list,
    isLoading,
    error,
    refetch,
  } = useApiQuery(
    () =>
      disputeService.listForUser(viewerId, {
        role,
        page,
        limit: PAGE_SIZE,
        search: q || undefined,
        filters: { status: statusFilterForTab(tab) },
      }),
    [viewerId, role, tab, q, page],
    { enabled: Boolean(viewerId) }
  )

  const items = useMemo(() => list?.items ?? [], [list])

  // MOCK-JOIN: disputes carry ids only (00 §10 bans `_expand`), so the titles,
  // the other party, and the last word on each thread come from three batched
  // follow-ups. Each one fails soft — a card without a title is still a card,
  // and none of them is worth failing the list for.
  const orderIds = useMemo(
    () => [...new Set(items.map((entry) => entry.orderId).filter(Boolean))],
    [items]
  )
  const { data: orders } = useApiQuery(
    () => orderService.listByIds(orderIds).catch(() => new Map()),
    [orderIds.join(',')],
    { enabled: orderIds.length > 0 }
  )

  const counterpartIds = useMemo(
    () => [...new Set(items.map((entry) => counterpartId(entry, viewerId)).filter(Boolean))],
    [items, viewerId]
  )
  const { data: people } = useApiQuery(
    () =>
      userService
        .listByIds(counterpartIds)
        .then((accounts) => new Map(accounts.map((account) => [account.id, account])))
        .catch(() => new Map()),
    [counterpartIds.join(',')],
    { enabled: counterpartIds.length > 0 }
  )

  const disputeIds = useMemo(() => items.map((entry) => entry.id), [items])
  const { data: latest } = useApiQuery(
    () => disputeService.latestMessages(disputeIds, { viewerRole: role }).catch(() => new Map()),
    [disputeIds.join(','), role],
    { enabled: disputeIds.length > 0 }
  )

  const clearSearch = useCallback(() => setValue('q', ''), [setValue])

  const total = list?.total ?? 0
  const emptyState = q
    ? noMatchesState(clearSearch)
    : (EMPTY_STATES[tab] ?? EMPTY_STATES[DISPUTE_TAB.OPEN])

  return (
    <DashboardPage
      title="Disputes"
      subtitle="Orders our team is looking at, and everything that has been said about them."
    >
      <Tabs
        value={tab}
        onChange={(event, next) => setValue('tab', next)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        aria-label="Filter disputes by status"
        sx={{ borderBottom: 1, borderColor: 'divider', mb: { xs: 2, md: 2.5 } }}
      >
        {DISPUTE_TABS.map((entry) => (
          <Tab
            key={entry.key}
            value={entry.key}
            label={entry.label}
            sx={{ minHeight: 48, textTransform: 'none', fontWeight: 600 }}
          />
        ))}
      </Tabs>

      <Box sx={{ mb: { xs: 2, md: 2.5 } }}>
        <SearchInput
          value={q}
          onChange={(next) => setValue('q', next)}
          placeholder="Search your disputes"
          label="Search your disputes"
        />
      </Box>

      {error ? (
        <ErrorState
          title="We could not load your disputes"
          message="Nothing about them has changed — this list just needs another go."
          error={error}
          onRetry={refetch}
        />
      ) : isLoading ? (
        <ListSkeleton rows={3} avatar={false} label="Loading your disputes" />
      ) : items.length === 0 ? (
        <EmptyState
          {...emptyState}
          {...(q
            ? {}
            : {
                secondaryAction: {
                  label: 'Go to your orders',
                  to: routes.orders,
                  variant: 'outlined',
                },
              })}
        />
      ) : (
        <>
          <Stack component="ul" spacing={2} sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {items.map((entry) => (
              <DisputeCard
                key={entry.id}
                dispute={entry}
                order={orders?.get(entry.orderId)}
                counterpart={people?.get(counterpartId(entry, viewerId))}
                lastMessage={latest?.get(entry.id)}
                viewerId={viewerId}
                role={role}
              />
            ))}
          </Stack>

          <PaginationControl
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={(next) => setValue('page', next)}
            itemLabel="disputes"
            hideOnSinglePage
          />
        </>
      )}
    </DashboardPage>
  )
}
