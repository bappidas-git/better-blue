import { useCallback, useEffect, useMemo, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import { useNavigate } from 'react-router-dom'

import MediaLightbox from '@/components/data-display/MediaLightbox'
import EmptyState from '@/components/feedback/EmptyState'
import ErrorState from '@/components/feedback/ErrorState'
import ListSkeleton from '@/components/feedback/skeletons/ListSkeleton'
import { useToast } from '@/components/feedback/ToastProvider'
import FilterChipGroup from '@/components/inputs/FilterChipGroup'
import SortSelect from '@/components/inputs/SortSelect'
import { PROPOSAL_STATUS, REQUEST_STATUS } from '@/constants/statuses'
import AcceptConfirmDialog from '@/features/proposals/components/AcceptConfirmDialog'
import CompareBar from '@/features/proposals/components/CompareBar'
import CompareDialog from '@/features/proposals/components/CompareDialog'
import DeclineDialog from '@/features/proposals/components/DeclineDialog'
import ProposalCard from '@/features/proposals/components/ProposalCard'
import ProposalDetailSheet from '@/features/proposals/components/ProposalDetailSheet'
import useCompareSelection, {
  COMPARE_MAX,
  COMPARE_MIN,
} from '@/features/proposals/hooks/useCompareSelection'
import {
  arrangeProposals,
  isLiveProposal,
  PROPOSAL_FILTER,
  PROPOSAL_SORT,
  PROPOSAL_SORT_OPTIONS,
  toMediaItems,
} from '@/features/proposals/utils/proposalDisplay'
import useApiMutation from '@/hooks/useApiMutation'
import { paths } from '@/routes/paths'
import { orderService } from '@/services/orderService'
import { proposalService } from '@/services/proposalService'

// The buyer's decision surface: every proposal on one brief, and the four
// things that can be done to them — shortlist, compare, decline, accept.
//
// The panel owns the interaction state (which sheet is open, what is selected)
// and the mutations; the cards and dialogs below it are presentational, and the
// page above it owns the data (00 §16.9). Every mutation ends the same way:
// toast, then `onRefetch` — the list is never patched in place, because
// accepting changes four other records too.

/** Room under the last card for the fixed compare bar. */
const COMPARE_BAR_CLEARANCE = 96

/**
 * @param {object} props
 * @param {object} props.request the brief these proposals are on
 * @param {object[]} props.proposals enriched offers from `listForRequestReview`
 * @param {boolean} props.isLoading
 * @param {object|null} props.error
 * @param {() => void} props.onRefetch
 * @param {string} props.buyerId the signed-in buyer, `usr_…`
 */
export default function ProposalReviewPanel({
  request,
  proposals = [],
  isLoading,
  error,
  onRefetch,
  buyerId,
}) {
  const navigate = useNavigate()
  const toast = useToast()

  const [sort, setSort] = useState(PROPOSAL_SORT.SHORTLISTED)
  const [filter, setFilter] = useState(PROPOSAL_FILTER.ALL)
  const [openProposalId, setOpenProposalId] = useState(null)
  const [decliningId, setDecliningId] = useState(null)
  const [acceptingId, setAcceptingId] = useState(null)
  const [compareOpen, setCompareOpen] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [shortlistingId, setShortlistingId] = useState(null)

  const compare = useCompareSelection()
  const { keepOnly: keepComparable, stop: stopCompare } = compare

  const shortlist = useApiMutation(proposalService.shortlistProposal)
  const decline = useApiMutation(proposalService.declineProposal)
  const accept = useApiMutation(orderService.acceptProposal)

  // Accepting is only ever offered while the brief is open — an awarded brief
  // hides it, and `orderService.acceptProposal` refuses it a second time
  // regardless (§5, accept idempotence).
  const canDecide = request?.status === REQUEST_STATUS.OPEN

  const byId = useMemo(
    () => new Map(proposals.map((proposal) => [proposal.id, proposal])),
    [proposals]
  )

  const shortlistedCount = useMemo(
    () => proposals.filter((proposal) => proposal.status === PROPOSAL_STATUS.SHORTLISTED).length,
    [proposals]
  )

  const liveProposals = useMemo(() => proposals.filter(isLiveProposal), [proposals])

  const visible = useMemo(
    () => arrangeProposals(proposals, { sort, filter }),
    [filter, proposals, sort]
  )

  // Only offers still in play can be compared — three declined proposals side
  // by side answers no question anyone is asking.
  const comparableIds = useMemo(
    () => liveProposals.map((proposal) => proposal.id),
    [liveProposals]
  )

  useEffect(() => {
    keepComparable(comparableIds)
  }, [comparableIds, keepComparable])

  const openProposal = openProposalId ? byId.get(openProposalId) : null
  const declining = decliningId ? byId.get(decliningId) : null
  const accepting = acceptingId ? byId.get(acceptingId) : null
  const selected = compare.selectedIds.map((id) => byId.get(id)).filter(Boolean)

  // The one card being written to dims, rather than the whole grid freezing.
  const busyId = shortlistingId ?? (accept.isLoading ? acceptingId : null)

  /* -- mutations --------------------------------------------------------- */

  const handleShortlist = useCallback(
    async (proposal) => {
      const next = proposal.status !== PROPOSAL_STATUS.SHORTLISTED
      setShortlistingId(proposal.id)
      try {
        await shortlist.mutate(proposal.id, { shortlisted: next })
        toast.success(next ? 'Added to your shortlist' : 'Removed from your shortlist', {
          description: next
            ? `${proposal.creator?.name ?? 'The creator'} has been told they are a strong candidate.`
            : undefined,
        })
      } catch (failure) {
        toast.error('We could not update your shortlist', { description: failure?.message })
      } finally {
        setShortlistingId(null)
        onRefetch?.()
      }
    },
    [onRefetch, shortlist, toast]
  )

  const handleDecline = useCallback(
    async ({ reason }) => {
      if (!declining) return
      try {
        await decline.mutate(declining.id, { reason })
        toast.success('Proposal declined', {
          description: `${declining.creator?.name ?? 'The creator'} has been told.`,
        })
        setDecliningId(null)
        setOpenProposalId(null)
      } catch (failure) {
        toast.error('We could not decline that proposal', {
          description: failure?.message ?? 'Reload the page and try again.',
        })
        setDecliningId(null)
      } finally {
        onRefetch?.()
      }
    },
    [decline, declining, onRefetch, toast]
  )

  /**
   * Awarding. `acceptProposal` does the whole job (contract §7 operation 1) and
   * hands back the unfunded order, so the only thing left here is to take the
   * buyer to it. A failure is almost always a stale tab — someone already
   * awarded this brief — so the service's own message is shown and the screen
   * refetches to catch up (§13).
   */
  const handleAccept = useCallback(async () => {
    if (!accepting) return
    try {
      const order = await accept.mutate(accepting.id, { buyerId })
      toast.success('Proposal accepted', {
        description: 'Fund the order to start the clock — your payment is held in escrow.',
      })
      setAcceptingId(null)
      setOpenProposalId(null)
      stopCompare()
      setCompareOpen(false)
      navigate(paths.buyerCheckout(order.id))
    } catch (failure) {
      toast.error('We could not accept that proposal', {
        description:
          failure?.message ?? 'It may have changed since this page loaded. Reload and try again.',
      })
      setAcceptingId(null)
      onRefetch?.()
    }
  }, [accept, accepting, buyerId, navigate, onRefetch, stopCompare, toast])

  /* -- render ------------------------------------------------------------ */

  if (error) {
    return (
      <ErrorState
        title="We could not load the proposals"
        message="They are all still there — this list just needs another go."
        error={error}
        onRetry={onRefetch}
      />
    )
  }

  if (isLoading) return <ListSkeleton rows={3} label="Loading proposals" />

  if (proposals.length === 0) {
    return (
      <EmptyState
        icon="solar:inbox-in-linear"
        title="No proposals yet"
        description={
          canDecide
            ? 'Creators can see this brief on the request board. Proposals usually start arriving within 48 hours.'
            : 'This request never received a proposal.'
        }
      />
    )
  }

  return (
    <Box sx={{ pb: compare.active ? `${COMPARE_BAR_CLEARANCE}px` : 0 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', md: 'center' }}
        sx={{ mb: 2.5 }}
      >
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <FilterChipGroup
            label="Filter proposals"
            value={filter}
            onChange={(next) => setFilter(next ?? PROPOSAL_FILTER.ALL)}
            allowClear={false}
            options={[
              { value: PROPOSAL_FILTER.ALL, label: 'All', count: proposals.length },
              {
                value: PROPOSAL_FILTER.SHORTLISTED,
                label: 'Shortlisted',
                icon: 'tabler:star',
                count: shortlistedCount,
              },
            ]}
          />
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <SortSelect
            value={sort}
            onChange={setSort}
            options={PROPOSAL_SORT_OPTIONS}
            label="Sort proposals"
            minWidth={180}
          />
          {liveProposals.length >= COMPARE_MIN ? (
            <Button
              variant={compare.active ? 'contained' : 'outlined'}
              onClick={compare.active ? compare.stop : compare.start}
              aria-pressed={compare.active}
              startIcon={<Icon icon="tabler:columns-3" width={18} aria-hidden="true" />}
              sx={{ flexShrink: 0 }}
            >
              Compare
            </Button>
          ) : null}
        </Stack>
      </Stack>

      {visible.length === 0 ? (
        <EmptyState
          dense
          icon="tabler:star-off"
          title="Nothing shortlisted yet"
          description="Star the proposals you are seriously considering and they will collect here."
          primaryAction={{
            label: 'Show all proposals',
            onClick: () => setFilter(PROPOSAL_FILTER.ALL),
            variant: 'outlined',
          }}
        />
      ) : (
        <Box
          component="ul"
          sx={{
            listStyle: 'none',
            m: 0,
            p: 0,
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
          }}
        >
          {visible.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              canDecide={canDecide}
              compareMode={compare.active && isLiveProposal(proposal)}
              selected={compare.isSelected(proposal.id)}
              selectionFull={compare.isFull}
              onToggleCompare={compare.toggle}
              onOpen={(entry) => setOpenProposalId(entry.id)}
              onShortlist={handleShortlist}
              onDecline={(entry) => setDecliningId(entry.id)}
              onAccept={(entry) => setAcceptingId(entry.id)}
              onOpenSample={(entry, index) => setLightbox({ proposalId: entry.id, index })}
              busy={busyId === proposal.id}
            />
          ))}
        </Box>
      )}

      {compare.active ? (
        <CompareBar
          count={compare.selectedIds.length}
          min={COMPARE_MIN}
          max={COMPARE_MAX}
          onCompare={() => setCompareOpen(true)}
          onCancel={compare.stop}
        />
      ) : null}

      <ProposalDetailSheet
        open={Boolean(openProposal)}
        proposal={openProposal}
        canDecide={canDecide}
        onClose={() => setOpenProposalId(null)}
        onShortlist={handleShortlist}
        onDecline={(entry) => setDecliningId(entry.id)}
        onAccept={(entry) => setAcceptingId(entry.id)}
        onOpenSample={(entry, index) => setLightbox({ proposalId: entry.id, index })}
        busy={shortlist.isLoading}
      />

      <CompareDialog
        open={compareOpen && selected.length >= COMPARE_MIN}
        proposals={selected}
        canDecide={canDecide}
        onClose={() => setCompareOpen(false)}
        onShortlist={handleShortlist}
        onAccept={(entry) => setAcceptingId(entry.id)}
        busy={shortlist.isLoading || accept.isLoading}
      />


      <DeclineDialog
        open={Boolean(declining)}
        proposal={declining}
        onConfirm={handleDecline}
        onClose={() => setDecliningId(null)}
        isSubmitting={decline.isLoading}
      />

      <AcceptConfirmDialog
        open={Boolean(accepting)}
        proposal={accepting}
        otherLiveProposals={Math.max(liveProposals.length - 1, 0)}
        onConfirm={handleAccept}
        onClose={() => setAcceptingId(null)}
        isSubmitting={accept.isLoading}
      />

      <MediaLightbox
        open={Boolean(lightbox)}
        items={
          lightbox
            ? toMediaItems(
                byId.get(lightbox.proposalId)?.samples,
                byId.get(lightbox.proposalId)?.creator?.name
              )
            : []
        }
        defaultIndex={lightbox?.index ?? 0}
        onClose={() => setLightbox(null)}
        title={`Sample work — ${byId.get(lightbox?.proposalId)?.creator?.name ?? 'creator'}`}
      />
    </Box>
  )
}
