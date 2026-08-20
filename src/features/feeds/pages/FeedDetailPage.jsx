import { useMemo, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Container from '@mui/material/Container'
import Divider from '@mui/material/Divider'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink, useLocation, useParams } from 'react-router-dom'

import KeyValueList from '@/components/data-display/KeyValueList'
import StatusChip from '@/components/data-display/StatusChip'
import UserAvatar from '@/components/data-display/UserAvatar'
import ErrorState from '@/components/feedback/ErrorState'
import CardSkeleton from '@/components/feedback/skeletons/CardSkeleton'
import PageHeader from '@/components/layout/PageHeader'
import { getStatusMeta, REQUEST_STATUS } from '@/constants/statuses'
import ProposalDialog from '@/features/proposals/components/ProposalDialog'
import useProposeGate, { VIEWER } from '@/features/proposals/hooks/useProposeGate'
import { LIVE_PROPOSAL_STATUSES } from '@/features/proposals/utils/proposalDisplay'
import BoardUnavailable from '@/features/requests/components/BoardUnavailable'
import RequestBriefPanel from '@/features/requests/components/RequestBriefPanel'
import { isInvitedTo } from '@/features/requests/utils/boardFilters'
import {
  describeDeadline,
  formatBudget,
  formatQuantity,
} from '@/features/requests/utils/requestDisplay'
import useApiQuery from '@/hooks/useApiQuery'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import useFeatureFlag from '@/hooks/useFeatureFlag'
import { paths } from '@/routes/paths'
import { categoryService } from '@/services/categoryService'
import { requestService } from '@/services/requestService'
import { EMPTY_PLACEHOLDER, formatDate, formatNumber } from '@/utils/formatters'


// One **feed**, read from the outside — the public counterpart of the buyer's
// own detail screen (Prompt 18).
//
// V2-02 renamed this screen: it was `RequestBoardDetailPage` at
// `/requests/:requestId`, it is `FeedDetailPage` at `/feeds/:feedId`, and the
// old URL redirects here. Presentation only — `:feedId` still carries the
// `req_…` id `requestService` expects, and the brief renderer, the propose
// gate, and the services behind them are untouched.
//
// The **brief itself is identical** on both: `RequestBriefPanel` is the shared
// renderer, so a creator reads exactly what the buyer wrote and the two screens
// cannot describe a request differently. What differs is everything around it —
// the buyer's business card instead of the proposal board, and an action panel
// that changes with who is reading (§4.3).

/** A labelled block in the sidebar. */
function SidebarCard({ title, children }) {
  return (
    <Card>
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        {title ? (
          <Typography variant="subtitle2" component="h2" sx={{ mb: 2 }}>
            {title}
          </Typography>
        ) : null}
        {children}
      </CardContent>
    </Card>
  )
}

/**
 * The panel that decides what a reader can *do* with this brief.
 *
 * Every closed door explains itself in a visible line rather than a tooltip
 * (§12): a gate a creator cannot read is a gate they cannot clear.
 */
function ActionPanel({ request, gate, onPropose }) {
  const location = useLocation()
  const isOpen = request.status === REQUEST_STATUS.OPEN

  if (gate.viewer === VIEWER.GUEST) {
    return (
      <SidebarCard>
        <Stack spacing={1.5}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Sign in as a creator to propose
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Proposals come with your price, your delivery time, and up to three pieces of your
            published work. We will bring you straight back to this brief.
          </Typography>
          <Button
            component={RouterLink}
            // `state.from` is what `GuestRoute` reads after sign-in, so the
            // detour through the form returns to this exact brief (Prompt 09).
            to={paths.LOGIN}
            state={{ from: location }}
            variant="gradient"
            size="large"
            fullWidth
          >
            Sign in to propose
          </Button>
          <Button component={RouterLink} to={paths.REGISTER} variant="outlined" fullWidth>
            Create a creator account
          </Button>
        </Stack>
      </SidebarCard>
    )
  }

  if (gate.viewer === VIEWER.BUYER || gate.viewer === VIEWER.OTHER) {
    return (
      <SidebarCard>
        <Stack spacing={1}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            You are viewing this as a business
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Only creators send proposals. If you need content like this, post your own brief and
            creators will come to you.
          </Typography>
          <Button
            component={RouterLink}
            to={gate.viewer === VIEWER.BUYER ? paths.BUYER_REQUEST_NEW : paths.HOME}
            variant="outlined"
            sx={{ alignSelf: 'flex-start', mt: 0.5 }}
          >
            {gate.viewer === VIEWER.BUYER ? 'Post a request' : 'Back to BetterBlue'}
          </Button>
        </Stack>
      </SidebarCard>
    )
  }

  /* -- creator ------------------------------------------------------------ */

  if (gate.hasProposed) {
    const status = gate.existingProposal?.status
    const isLive = LIVE_PROPOSAL_STATUSES.includes(status)

    return (
      <SidebarCard>
        <Stack spacing={1.5} alignItems="flex-start">
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip
              icon={<Icon icon="tabler:check" width={16} aria-hidden="true" />}
              label="Proposal submitted"
              color="success"
              sx={{ fontWeight: 600 }}
            />
            <StatusChip status={status} size="sm" tooltip />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            You answered this brief on {formatDate(gate.existingProposal?.createdAt)}.{' '}
            {isLive
              ? 'You can edit or withdraw it until the buyer responds.'
              : 'A request only takes one proposal per creator, so this brief is closed to you now.'}
          </Typography>
          <Button component={RouterLink} to={paths.CREATOR_PROPOSALS} variant="outlined" fullWidth>
            Manage my proposals
          </Button>
        </Stack>
      </SidebarCard>
    )
  }

  return (
    <SidebarCard>
      <Stack spacing={1.5}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {isOpen ? 'Interested in this brief?' : 'This brief has closed'}
        </Typography>

        <Button
          variant="gradient"
          size="large"
          fullWidth
          disabled={!gate.canPropose}
          onClick={onPropose}
          startIcon={<Icon icon="tabler:send" width={18} aria-hidden="true" />}
        >
          Send a proposal
        </Button>

        {gate.blockers.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Your price, your delivery time, and up to three samples. The buyer is notified as soon
            as you send it.
          </Typography>
        ) : (
          <Stack spacing={1.5} component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {gate.blockers.map((blocker) => (
              <Stack key={blocker.key} component="li" spacing={0.5}>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Box sx={{ color: 'warning.main', display: 'flex', pt: '2px' }}>
                    <Icon icon="tabler:info-circle" width={18} aria-hidden="true" />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {blocker.message}
                  </Typography>
                </Stack>
                {blocker.action ? (
                  <Link component={RouterLink} to={blocker.action.to} variant="body2" sx={{ pl: 3.5 }}>
                    {blocker.action.label}
                  </Link>
                ) : null}
              </Stack>
            ))}
          </Stack>
        )}
      </Stack>
    </SidebarCard>
  )
}

export default function FeedDetailPage() {
  // A feed is a content request, so the storefront-facing `:feedId` is read
  // under the name the service layer uses for it.
  const { feedId: requestId } = useParams()
  const { isEnabled, isLoading: isFlagLoading } = useFeatureFlag('publicRequestBoard')

  const [isDialogOpen, setDialogOpen] = useState(false)

  // `isLoading` is deliberately unused: the skeleton below keys off `!request`
  // so a refetch never unmounts the page (and, with it, the proposal dialog).
  const {
    data: board,
    error,
    refetch,
  } = useApiQuery(() => requestService.getBoardRequest(requestId), [requestId], {
    enabled: Boolean(requestId),
  })

  const request = board?.request ?? null
  const buyer = board?.buyer ?? null

  useDocumentTitle(request?.title ?? 'Feed')

  const { data: categories } = useApiQuery(() => categoryService.listActive(), [])
  const categoryLabel = useMemo(
    () => (categories ?? []).find((category) => category.id === request?.categoryId)?.name,
    [categories, request?.categoryId]
  )

  const gate = useProposeGate({ request })

  const isInvited = isInvitedTo(request, gate.creatorProfileId)

  /* -- flag, loading, and failure ----------------------------------------- */

  // The flag hides the *public* board. A creator reaching a brief from their
  // dashboard must still be able to open it, so only signed-out visitors and
  // buyers meet the wall.
  if (!isFlagLoading && !isEnabled && gate.viewer !== VIEWER.CREATOR) {
    return <BoardUnavailable />
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 }, py: { xs: 4, md: 6 } }}>
        <ErrorState
          title="We could not open this feed"
          message="It may have been withdrawn, or the link may be wrong. The rest of the feeds are unaffected."
          error={error}
          onRetry={refetch}
        />
      </Container>
    )
  }

  // `!request` rather than `isLoading`: a refetch — which is exactly what a sent
  // proposal triggers — keeps the previous `data`, and swapping the page for a
  // skeleton would unmount the dialog before it could show that the proposal
  // landed. Only the *first* load has nothing to draw.
  if (!request) {
    return (
      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 }, py: { xs: 4, md: 6 } }}>
        <CardSkeleton media={false} lines={6} label="Loading this feed" />
      </Container>
    )
  }

  const deadline = describeDeadline(request)
  const proposals = Number(request.proposalsCount) || 0

  return (
    <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 }, py: { xs: 4, md: 6 } }}>
      <PageHeader
        title={request.title}
        backTo={gate.viewer === VIEWER.CREATOR ? paths.CREATOR_BROWSE : paths.FEEDS}
        backLabel={
          gate.viewer === VIEWER.CREATOR ? 'Back to the request board' : 'Back to feeds'
        }
        meta={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <StatusChip status={request.status} tooltip />
            {isInvited ? (
              <Chip
                size="small"
                color="primary"
                icon={<Icon icon="tabler:mail-star" width={14} aria-hidden="true" />}
                aria-label="This buyer invited you to propose on this request"
                label="Invited"
                sx={{ fontWeight: 600 }}
              />
            ) : null}
          </Stack>
        }
      />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' },
          gap: { xs: 2, md: 3 },
          alignItems: 'start',
        }}
      >
        {/* The brief. Identical to what the buyer sees on their own screen. */}
        <Box sx={{ minWidth: 0, order: { xs: 2, md: 1 } }}>
          <RequestBriefPanel request={request} categoryLabel={categoryLabel} />
        </Box>

        {/* Sidebar: what to do, the numbers at a glance, and who is asking.
            First on a phone, because the action is the reason to be here. */}
        <Stack spacing={{ xs: 2, md: 3 }} sx={{ order: { xs: 1, md: 2 }, minWidth: 0 }}>
          <ActionPanel request={request} gate={gate} onPropose={() => setDialogOpen(true)} />

          <SidebarCard title="At a glance">
            <KeyValueList
              divided
              labelWidth={130}
              items={[
                { label: 'Budget', value: formatBudget(request) },
                {
                  label: 'Deadline',
                  value: (
                    <Typography variant="body2" sx={{ fontWeight: 500, color: deadline.tone }}>
                      {deadline.date}
                    </Typography>
                  ),
                  hint: deadline.relative || undefined,
                },
                {
                  label: 'Deliverables',
                  value: formatQuantity(request, getStatusMeta(request.contentType).label),
                },
                {
                  label: 'Usage rights',
                  value: <StatusChip status={request.usageRights} size="sm" tooltip />,
                },
                {
                  label: 'Proposals',
                  value:
                    proposals === 0
                      ? 'None yet'
                      : `${formatNumber(proposals)} so far`,
                },
              ]}
            />
          </SidebarCard>

          <SidebarCard title="About the business">
            {buyer ? (
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <UserAvatar
                    name={buyer.companyName ?? buyer.name}
                    src={buyer.logoUrl}
                    size="lg"
                    variant="rounded"
                  />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {buyer.companyName ?? buyer.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {buyer.industry ?? EMPTY_PLACEHOLDER}
                    </Typography>
                  </Box>
                </Stack>

                {buyer.bio ? (
                  <Typography variant="body2" color="text.secondary">
                    {buyer.bio}
                  </Typography>
                ) : null}

                <Divider />

                <KeyValueList
                  labelWidth={140}
                  items={[
                    { label: 'Member since', value: formatDate(buyer.memberSince) },
                    {
                      label: 'Completed orders',
                      value: formatNumber(buyer.completedOrders ?? 0),
                    },
                    ...(buyer.location ? [{ label: 'Location', value: buyer.location }] : []),
                  ]}
                />
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                We could not load this business’s details just now. The brief above is unaffected.
              </Typography>
            )}
          </SidebarCard>
        </Stack>
      </Box>

      {gate.isCreator && gate.creatorUserId ? (
        <ProposalDialog
          open={isDialogOpen}
          onClose={() => setDialogOpen(false)}
          request={request}
          creatorUserId={gate.creatorUserId}
          creatorProfileId={gate.creatorProfileId}
          onSubmitted={() => {
            gate.refresh()
            refetch()
          }}
        />
      ) : null}
    </Container>
  )
}
