import { useCallback, useMemo, useState } from 'react'

import Badge from '@mui/material/Badge'
import Box from '@mui/material/Box'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'

import PaginationControl from '@/components/data-display/PaginationControl'
import { useConfirm } from '@/components/feedback/ConfirmDialogProvider'
import EmptyState from '@/components/feedback/EmptyState'
import ErrorState from '@/components/feedback/ErrorState'
import { useToast } from '@/components/feedback/ToastProvider'
import StaggerList from '@/components/motion/StaggerList'
import { PROPOSAL_STATUS } from '@/constants/statuses'
import { useAuth } from '@/context/AuthContext'
import useApiQuery from '@/hooks/useApiQuery'
import useListParams, { listParam } from '@/hooks/useListParams'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { paths } from '@/routes/paths'
import { creatorProfileService } from '@/services/creatorProfileService'
import { orderService } from '@/services/orderService'
import { proposalService } from '@/services/proposalService'
import { formatNumber } from '@/utils/formatters'

import ProposalDialog from '../components/ProposalDialog'
import ProposalListCard, { ProposalListCardSkeleton } from '../components/ProposalListCard'

// "My proposals" — every offer this creator has sent, grouped by what is
// happening to it.
//
// Four tabs rather than one long list, because the four groups need completely
// different things from the reader: Active is a to-do list they can still
// change, Accepted is where the money is, Declined is history worth learning
// from, and Archived is closed business. Statuses map to tabs in `TABS` and
// nowhere else.

/** Offers per page — a creator's list is short, and cards are tall. */
const PAGE_SIZE = 10

const TAB = Object.freeze({
  ACTIVE: 'active',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  ARCHIVED: 'archived',
})

/**
 * The tabs, and the statuses behind each. `PROPOSAL_STATUS` values only —
 * nothing in this file spells a status as a literal (00 §2.5).
 */
const TABS = Object.freeze([
  Object.freeze({
    value: TAB.ACTIVE,
    label: 'Active',
    statuses: [PROPOSAL_STATUS.SUBMITTED, PROPOSAL_STATUS.SHORTLISTED],
    emptyTitle: 'No proposals in flight',
    emptyDescription:
      'When you answer a brief it lands here, and stays until the buyer shortlists, accepts, or declines it.',
  }),
  Object.freeze({
    value: TAB.ACCEPTED,
    label: 'Accepted',
    statuses: [PROPOSAL_STATUS.ACCEPTED],
    emptyTitle: 'Nothing accepted yet',
    emptyDescription:
      'An accepted proposal becomes a funded order. Keep proposing — the ones that land show up here.',
  }),
  Object.freeze({
    value: TAB.DECLINED,
    label: 'Declined',
    statuses: [PROPOSAL_STATUS.DECLINED],
    emptyTitle: 'No declined proposals',
    emptyDescription: 'Briefs the buyer decided not to take forward would be listed here.',
  }),
  Object.freeze({
    value: TAB.ARCHIVED,
    label: 'Closed',
    statuses: [PROPOSAL_STATUS.WITHDRAWN, PROPOSAL_STATUS.EXPIRED],
    emptyTitle: 'Nothing closed',
    emptyDescription:
      'Proposals you withdrew, and ones that expired when their brief closed, end up here.',
  }),
])

const TAB_VALUES = TABS.map((tab) => tab.value)

/** URL-owned tab and page, so a shared link opens on the same tab (00 §12). */
const proposalsSchema = Object.freeze({
  tab: listParam.choice({ options: TAB_VALUES, fallback: TAB.ACTIVE, isFilter: false }),
  page: listParam.number({ fallback: 1, min: 1, max: 9999, integer: true, isFilter: false }),
})

export default function CreatorProposalsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const creatorUserId = user?.id ?? null

  const [editing, setEditing] = useState(null)

  const { values, setValue, setValues } = useListParams(proposalsSchema)
  const activeTab = TABS.find((tab) => tab.value === values.tab) ?? TABS[0]

  const { data: profile } = useApiQuery(
    () => creatorProfileService.getByUserId(creatorUserId),
    [creatorUserId],
    { enabled: Boolean(creatorUserId) }
  )

  const {
    data: counts,
    isLoading: isCountsLoading,
    refetch: refetchCounts,
  } = useApiQuery(() => proposalService.countsByStatus(creatorUserId), [creatorUserId], {
    enabled: Boolean(creatorUserId),
  })

  const statusKey = activeTab.statuses.join(',')

  const {
    data: page,
    isLoading,
    error,
    refetch,
  } = useApiQuery(
    () =>
      proposalService.listForCreator(creatorUserId, {
        page: values.page,
        limit: PAGE_SIZE,
        filters: { status: activeTab.statuses },
      }),
    [creatorUserId, statusKey, values.page],
    { enabled: Boolean(creatorUserId) }
  )

  const proposals = useMemo(() => page?.items ?? [], [page])
  const total = page?.total ?? 0

  // Only the Accepted tab needs the orders behind its offers, so only it asks.
  const acceptedIds = useMemo(
    () =>
      proposals
        .filter((proposal) => proposal.status === PROPOSAL_STATUS.ACCEPTED)
        .map((proposal) => proposal.id),
    [proposals]
  )
  const acceptedKey = acceptedIds.join(',')

  const { data: ordersByProposal } = useApiQuery(
    () => orderService.listByProposalIds(acceptedIds),
    [acceptedKey],
    { enabled: acceptedIds.length > 0 }
  )

  const refreshAll = useCallback(() => {
    refetch()
    refetchCounts()
  }, [refetch, refetchCounts])

  const countFor = useCallback(
    (tab) =>
      tab.statuses.reduce((sum, status) => sum + (counts?.byStatus?.[status] ?? 0), 0),
    [counts]
  )

  const handleWithdraw = useCallback(
    async (proposal) => {
      const title = proposal.request?.title ?? 'this request'
      // Irreversible — a brief takes one proposal per creator, withdrawn ones
      // included (contract §6.8) — so it gets a confirmation, and the
      // consequence is stated plainly (00 §12). No reason field: the creator
      // owes nobody an explanation for pulling their own offer (§4.6).
      const result = await confirm({
        title: 'Withdraw this proposal?',
        message: `Your proposal on “${title}” is taken off the buyer's board and they are notified. A request only takes one proposal per creator, so you will not be able to answer this brief again.`,
        confirmLabel: 'Withdraw proposal',
        tone: 'danger',
        requireReason: false,
      })
      if (!result) return

      try {
        await proposalService.withdrawProposal(proposal.id, { creatorId: creatorUserId })
        toast.success('Proposal withdrawn', { description: 'The buyer has been notified.' })
        refreshAll()
      } catch (failure) {
        toast.error('We could not withdraw this proposal', { description: failure?.message })
      }
    },
    [confirm, creatorUserId, refreshAll, toast]
  )

  const renderList = () => {
    if (error) {
      return (
        <ErrorState
          title="We could not load your proposals"
          message="Nothing has changed about them — this list just needs another go."
          error={error}
          onRetry={refetch}
        />
      )
    }

    if (isLoading) {
      return (
        <Box sx={{ display: 'grid', gap: { xs: 2, md: 2.5 } }}>
          {Array.from({ length: 3 }, (_, index) => (
            <ProposalListCardSkeleton key={`skeleton-${index}`} />
          ))}
        </Box>
      )
    }

    if (proposals.length === 0) {
      return (
        <EmptyState
          icon="solar:document-add-linear"
          title={activeTab.emptyTitle}
          description={activeTab.emptyDescription}
          primaryAction={{ label: 'Browse open requests', to: paths.CREATOR_BROWSE }}
        />
      )
    }

    return (
      <>
        {/* A plain grid, not a `ul` — see the note in `RequestBoard`. */}
        <StaggerList stagger={0.04} sx={{ display: 'grid', gap: { xs: 2, md: 2.5 } }}>
          {proposals.map((proposal) => (
            <ProposalListCard
              key={proposal.id}
              proposal={proposal}
              order={ordersByProposal?.get(proposal.id)}
              onEdit={() => setEditing(proposal)}
              onWithdraw={() => handleWithdraw(proposal)}
            />
          ))}
        </StaggerList>

        <PaginationControl
          page={values.page}
          pageSize={PAGE_SIZE}
          total={total}
          onPageChange={(next) => setValues({ page: next })}
          itemLabel="proposals"
          disabled={isLoading}
          hideOnSinglePage
        />
      </>
    )
  }

  return (
    <DashboardPage
      title="My proposals"
      subtitle="Every offer you have sent, and what has happened to it."
    >
      <Tabs
        value={activeTab.value}
        onChange={(event, next) => setValue('tab', next)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        aria-label="Proposal status"
        sx={{ borderBottom: 1, borderColor: 'divider', mb: { xs: 2.5, md: 3 } }}
      >
        {TABS.map((tab) => {
          const count = countFor(tab)
          return (
            <Tab
              key={tab.value}
              value={tab.value}
              label={
                <Badge
                  badgeContent={isCountsLoading ? 0 : count}
                  color={tab.value === TAB.ACTIVE ? 'primary' : 'default'}
                  max={99}
                  sx={{ '& .MuiBadge-badge': { right: -14, top: 2 } }}
                >
                  <Box component="span" sx={{ pr: count > 0 ? 1.5 : 0 }}>
                    {tab.label}
                  </Box>
                </Badge>
              }
              // The badge is decorative for AT; the label spells the count out.
              aria-label={
                isCountsLoading
                  ? tab.label
                  : `${tab.label}, ${formatNumber(count)} ${count === 1 ? 'proposal' : 'proposals'}`
              }
              sx={{ minHeight: 48, textTransform: 'none', fontWeight: 600 }}
            />
          )
        })}
      </Tabs>

      <Box role="tabpanel" aria-label={activeTab.label}>
        {renderList()}
      </Box>

      {editing ? (
        <ProposalDialog
          open
          onClose={() => setEditing(null)}
          request={editing.request}
          proposal={editing}
          creatorUserId={creatorUserId}
          creatorProfileId={profile?.id}
          onSubmitted={refreshAll}
        />
      ) : null}
    </DashboardPage>
  )
}
