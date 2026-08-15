import TimelineList from '@/components/data-display/TimelineList'
import { PROPOSAL_STATUS, REQUEST_STATUS } from '@/constants/statuses'
import { formatNumber } from '@/utils/formatters'

// What has happened to this brief, in order.
//
// DERIVED, NOT RECORDED: BetterBlue has no `requestEvents` collection — the
// timeline is reconstructed from the timestamps the brief and its proposals
// already carry (§4.2, "simple derived list"). That is why it is coarse: the
// proposals that arrived are one summary line rather than one line each, and an
// entry with no timestamp behind it is simply not shown rather than guessed at.
//
// A real event log would give exact ordering and every intermediate state; if
// one is ever added, this function is where it plugs in.

/** The proposal summary line reads differently depending on what happened. */
function proposalSummary(proposals) {
  const total = proposals.length
  const shortlisted = proposals.filter((p) => p.status === PROPOSAL_STATUS.SHORTLISTED).length
  const declined = proposals.filter((p) => p.status === PROPOSAL_STATUS.DECLINED).length

  const parts = []
  if (shortlisted > 0) parts.push(`${formatNumber(shortlisted)} shortlisted`)
  if (declined > 0) parts.push(`${formatNumber(declined)} declined`)

  return {
    title: `${formatNumber(total)} ${total === 1 ? 'proposal' : 'proposals'} received`,
    description: parts.length > 0 ? parts.join(' · ') : 'None decided yet.',
  }
}

/**
 * Builds the timeline entries for a brief.
 *
 * @param {object} request the brief
 * @param {object[]} proposals its offers, enriched or plain
 * @returns {object[]} `TimelineList` items, oldest first
 */
function buildRequestActivity(request, proposals = []) {
  if (!request) return []

  const entries = [
    {
      id: 'created',
      icon: 'solar:document-add-linear',
      title: 'Request created',
      description: 'Saved as a private draft.',
      timestamp: request.createdAt,
      tone: 'neutral',
    },
  ]

  if (request.publishedAt) {
    entries.push({
      id: 'published',
      icon: 'solar:global-linear',
      title: 'Published to the request board',
      description: 'Creators could see the brief and start proposing.',
      timestamp: request.publishedAt,
      tone: 'info',
    })
  }

  if (proposals.length > 0) {
    // Dated by the newest offer, so the summary sits after publication and
    // before the award rather than floating at the top of the list.
    const newest = proposals.reduce(
      (latest, proposal) => (proposal.createdAt > latest ? proposal.createdAt : latest),
      proposals[0].createdAt
    )
    const summary = proposalSummary(proposals)
    entries.push({
      id: 'proposals',
      icon: 'solar:inbox-in-linear',
      title: summary.title,
      description: summary.description,
      timestamp: newest,
      tone: 'brand',
    })
  }

  const awarded = proposals.find((proposal) => proposal.status === PROPOSAL_STATUS.ACCEPTED)
  if (awarded) {
    entries.push({
      id: 'awarded',
      icon: 'solar:medal-ribbon-linear',
      title: 'Proposal accepted',
      description: awarded.creator?.name
        ? `${awarded.creator.name} was awarded the work, and every other proposal was declined.`
        : 'The work was awarded, and every other proposal was declined.',
      timestamp: awarded.respondedAt ?? undefined,
      tone: 'success',
    })
  }

  if (request.status === REQUEST_STATUS.COMPLETED) {
    entries.push({
      id: 'completed',
      icon: 'solar:verified-check-linear',
      title: 'Request completed',
      description: 'The content was delivered and accepted.',
      tone: 'success',
    })
  }

  if (request.status === REQUEST_STATUS.CLOSED) {
    entries.push({
      id: 'closed',
      icon: 'solar:archive-linear',
      title: 'Request closed',
      description: request.closureReason
        ? `Closed without an award. Reason: ${request.closureReason}`
        : 'Closed without an award.',
      timestamp: request.closedAt ?? undefined,
      tone: 'neutral',
    })
  }

  if (request.status === REQUEST_STATUS.CANCELLED) {
    entries.push({
      id: 'cancelled',
      icon: 'tabler:circle-x',
      title: 'Request cancelled',
      description: request.closureReason
        ? `Reason: ${request.closureReason}`
        : 'Withdrawn before it was awarded.',
      timestamp: request.cancelledAt ?? undefined,
      tone: 'warning',
    })
  }

  return entries
}

/**
 * @param {object} props
 * @param {object} props.request the brief
 * @param {object[]} [props.proposals] its offers
 */
export default function RequestActivityTimeline({ request, proposals }) {
  return (
    <TimelineList
      items={buildRequestActivity(request, proposals)}
      emptyText="Nothing has happened on this request yet."
    />
  )
}
