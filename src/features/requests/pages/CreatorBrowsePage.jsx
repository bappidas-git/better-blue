import { useMemo } from 'react'

import { useAuth } from '@/context/AuthContext'
import useApiQuery from '@/hooks/useApiQuery'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { paths } from '@/routes/paths'
import { creatorProfileService } from '@/services/creatorProfileService'
import { proposalService } from '@/services/proposalService'
import { requestService } from '@/services/requestService'

import RequestBoard from '../components/RequestBoard'

// The creator's own view of the request board — the same board as `/requests`,
// inside the dashboard shell, and defaulted to the work they actually do.
//
// Two differences from the public page, both about *this* creator rather than
// about the board: it starts scoped to their storefront's categories (with an
// "All categories" toggle beside it), and it offers an invitations filter when
// a buyer has actually written a brief from their profile. Neither is behind
// `features.publicRequestBoard` — that flag hides the *public* listing, not a
// creator's ability to find work.

/** Invitations are looked for once; a creator rarely has more than a handful. */
const INVITE_PROBE_LIMIT = 1

export default function CreatorBrowsePage() {
  const { user } = useAuth()
  const creatorUserId = user?.id ?? null

  const { data: profile } = useApiQuery(
    () => creatorProfileService.getByUserId(creatorUserId),
    [creatorUserId],
    { enabled: Boolean(creatorUserId) }
  )

  const creatorProfileId = profile?.id ?? null

  // Frozen into a stable string so the board's memoised service params do not
  // change identity on every render of this page.
  const categoryKey = (profile?.categories ?? []).join(',')
  const defaultCategoryIds = useMemo(
    () => (categoryKey ? categoryKey.split(',') : []),
    [categoryKey]
  )

  // Is the "Invited to you" filter worth offering at all? A switch that can
  // only ever return nothing is worse than no switch.
  const { data: invites } = useApiQuery(
    () =>
      requestService.listOpen({
        page: 1,
        limit: INVITE_PROBE_LIMIT,
        filters: { invitedCreatorId: creatorProfileId },
      }),
    [creatorProfileId],
    { enabled: Boolean(creatorProfileId) }
  )

  const { data: myProposals } = useApiQuery(
    () => proposalService.listByCreator(creatorUserId, { page: 1, limit: 100 }),
    [creatorUserId],
    { enabled: Boolean(creatorUserId) }
  )

  // Not a plain "answered" set: a brief takes one proposal per creator whatever
  // became of it, so the card reports *which* state it is in.
  const proposalStatusByRequest = useMemo(
    () =>
      new Map(
        (myProposals?.items ?? []).map((proposal) => [proposal.requestId, proposal.status])
      ),
    [myProposals]
  )

  return (
    <DashboardPage
      title="Browse requests"
      subtitle="Open briefs from businesses hiring creators. Start with your own categories, then widen out."
      maxWidth="xl"
    >
      <RequestBoard
        variant="dashboard"
        creatorProfileId={creatorProfileId}
        defaultCategoryIds={defaultCategoryIds}
        showScopeToggle={defaultCategoryIds.length > 0}
        showInvitedFilter={(invites?.total ?? 0) > 0}
        proposalStatusByRequest={proposalStatusByRequest}
        emptyAction={{ label: 'Add portfolio work', to: paths.CREATOR_PORTFOLIO }}
      />
    </DashboardPage>
  )
}
