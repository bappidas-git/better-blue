import { useMemo } from 'react'

import Container from '@mui/material/Container'
import { Navigate } from 'react-router-dom'

import AppLoader from '@/app/AppLoader'
import PageHeader from '@/components/layout/PageHeader'
import { ROLES } from '@/constants/roles'
import { useAuth } from '@/context/AuthContext'
import useApiQuery from '@/hooks/useApiQuery'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import useFeatureFlag from '@/hooks/useFeatureFlag'
import { paths } from '@/routes/paths'
import { creatorProfileService } from '@/services/creatorProfileService'
import { proposalService } from '@/services/proposalService'

import BoardUnavailable from '../components/BoardUnavailable'
import RequestBoard from '../components/RequestBoard'

// The public request board — every open brief on BetterBlue, readable by
// anyone, with the actions behind each one gated on who is reading (§4.2).
//
// Prompt 11 mounted this route with a placeholder so the top nav and the footer
// had somewhere to land; this is the screen it promised. The route entry in
// `publicRoutes.jsx` is unchanged.
//
// Behind `features.publicRequestBoard` (contract §6.27). With the flag off a
// visitor is told the board is not public today, and a *creator* — who has
// their own board inside the dashboard, which the flag does not touch — is sent
// straight there rather than shown a wall.

export default function RequestBoardPage() {
  useDocumentTitle('Browse content requests')

  const { user } = useAuth()
  const { isEnabled, isLoading: isFlagLoading } = useFeatureFlag('publicRequestBoard')

  const isCreator = user?.role === ROLES.CREATOR
  const creatorUserId = isCreator ? user.id : null

  // The storefront behind the account: its id is what makes an "Invited" badge
  // mean anything (`invitedCreatorId` is a `cpr_…`), and its categories are the
  // default slice of the board a creator cares about.
  const { data: profile } = useApiQuery(
    () => creatorProfileService.getByUserId(creatorUserId),
    [creatorUserId],
    { enabled: Boolean(creatorUserId) }
  )

  // Which briefs this creator has already answered, and how that went, so the
  // cards say so rather than inviting a duplicate the service would refuse.
  const { data: myProposals } = useApiQuery(
    () => proposalService.listByCreator(creatorUserId, { page: 1, limit: 100 }),
    [creatorUserId],
    { enabled: Boolean(creatorUserId) }
  )

  const proposalStatusByRequest = useMemo(
    () =>
      new Map(
        (myProposals?.items ?? []).map((proposal) => [proposal.requestId, proposal.status])
      ),
    [myProposals]
  )

  if (isFlagLoading) {
    return <AppLoader label="Loading the request board" />
  }

  if (!isEnabled) {
    return isCreator ? <Navigate to={paths.CREATOR_BROWSE} replace /> : <BoardUnavailable />
  }

  return (
    <Container maxWidth="xl" sx={{ px: { xs: 2, md: 4 }, py: { xs: 4, md: 6 } }}>
      <PageHeader
        title="Open content requests"
        subtitle="Businesses post the commercial content they need — the deliverables, the budget, the deadline, and the usage rights — and creators answer with a priced proposal. Everything here is open and taking proposals right now."
      />

      <RequestBoard
        variant="public"
        creatorProfileId={profile?.id}
        proposalStatusByRequest={proposalStatusByRequest}
        emptyAction={{ label: 'Browse creators instead', to: paths.CREATORS }}
      />
    </Container>
  )
}
