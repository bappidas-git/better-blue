import { useCallback, useMemo } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink, useParams } from 'react-router-dom'

import KeyValueList from '@/components/data-display/KeyValueList'
import StatusChip from '@/components/data-display/StatusChip'
import UserAvatar from '@/components/data-display/UserAvatar'
import ErrorState from '@/components/feedback/ErrorState'
import CardSkeleton from '@/components/feedback/skeletons/CardSkeleton'
import { useToast } from '@/components/feedback/ToastProvider'
import { DISPUTE_STATUS } from '@/constants/statuses'
import { useAuth } from '@/context/AuthContext'
import DisputeStatusBanner from '@/features/disputes/components/DisputeStatusBanner'
import DisputeThread from '@/features/disputes/components/DisputeThread'
import EvidenceGrid from '@/features/disputes/components/EvidenceGrid'
import MessageComposer from '@/features/disputes/components/MessageComposer'
import ResolutionCard from '@/features/disputes/components/ResolutionCard'
import {
  categoryLabel,
  counterpartId,
  disputeRoutesFor,
  isAwaitingViewer,
  isRaisedByViewer,
  isSettled,
} from '@/features/disputes/utils/disputeDisplay'
import useApiQuery from '@/hooks/useApiQuery'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { BOTTOM_NAV_HEIGHT } from '@/layouts/dashboard/MobileBottomNav'
import { API_ERROR_CODE } from '@/services/api/apiError'
import { disputeService } from '@/services/disputeService'
import { orderService } from '@/services/orderService'
import { userService } from '@/services/userService'
import { formatCurrency, formatDate } from '@/utils/formatters'

// One dispute, from a party's chair — the same screen on both dashboards.
//
// Two columns at `lg` (§11): the conversation, which is what the page is for,
// and a meta sidebar holding the order, the parties, and the opening evidence.
// Below `lg` the sidebar follows the thread rather than pushing it off the first
// screenful, and the composer sticks to the bottom of the thread column.
//
// **Internal notes are never rendered here.** `disputeService.listMessages` is
// asked for this reader's role and filters them out twice — once in the query
// and once defensively over the result — and the production API must filter
// them server-side (contract §6.17). There is deliberately no branch in this
// page that could render one.

export default function DisputeDetailPage() {
  const { disputeId } = useParams()
  const { user } = useAuth()
  const toast = useToast()

  const viewerId = user?.id
  const role = user?.role
  const routes = disputeRoutesFor(role)

  const {
    data: dispute,
    isLoading,
    error,
    refetch,
  } = useApiQuery(() => disputeService.getById(disputeId), [disputeId], {
    enabled: Boolean(disputeId),
  })

  const orderId = dispute?.orderId
  const { data: order } = useApiQuery(
    () => orderService.getById(orderId).catch(() => null),
    [orderId],
    { enabled: Boolean(orderId) }
  )

  const {
    data: thread,
    isLoading: threadLoading,
    error: threadError,
    refetch: refetchThread,
  } = useApiQuery(
    () => disputeService.listMessages(disputeId, { viewerRole: role }),
    [disputeId, role],
    { enabled: Boolean(disputeId) }
  )

  const messages = useMemo(() => thread?.items ?? [], [thread])

  // MOCK-JOIN: messages carry `authorId` only (00 §10 bans `_expand`), so the
  // names and avatars on the thread come from one batched follow-up. A failure
  // leaves the bubbles intact with a generic name rather than failing the page.
  const authorIds = useMemo(() => {
    const ids = new Set(messages.map((message) => message.authorId).filter(Boolean))
    if (dispute?.raisedById) ids.add(dispute.raisedById)
    if (dispute?.againstId) ids.add(dispute.againstId)
    return [...ids]
  }, [messages, dispute?.raisedById, dispute?.againstId])

  const { data: people } = useApiQuery(
    () =>
      userService
        .listByIds(authorIds)
        .then((accounts) => new Map(accounts.map((account) => [account.id, account])))
        .catch(() => new Map()),
    [authorIds.join(',')],
    { enabled: authorIds.length > 0 }
  )

  const onSend = useCallback(
    async ({ body, attachments }) => {
      try {
        await disputeService.postMessage(disputeId, {
          authorId: viewerId,
          authorRole: role,
          body,
          attachments,
        })
        refetch()
        refetchThread()
      } catch (failure) {
        if (failure?.code === API_ERROR_CODE.CONFLICT) {
          toast.error(failure.message, {
            description: 'This page was showing an older version of the dispute. It has been refreshed.',
          })
          refetch()
          refetchThread()
        } else {
          toast.error(failure?.message ?? 'We could not send your message.')
        }
        // Rethrown so the composer keeps the draft (§13).
        throw failure
      }
    },
    [disputeId, refetch, refetchThread, role, toast, viewerId]
  )

  /* -- loading and failure ------------------------------------------------ */

  if (error) {
    return (
      <DashboardPage title="Dispute" backTo={routes.list} maxWidth="md">
        <ErrorState
          title="We could not open this dispute"
          message="It may have been removed, or the link may be wrong. Your other disputes are unaffected."
          error={error}
          onRetry={refetch}
        />
      </DashboardPage>
    )
  }

  if (isLoading || !dispute) {
    return (
      <DashboardPage title="Dispute" backTo={routes.list} maxWidth="md">
        <CardSkeleton media={false} lines={5} label="Loading this dispute" />
      </DashboardPage>
    )
  }

  // SECURITY: a UX guard only (00 §11) — it stops a mistyped or shared link
  // showing somebody else's casework. The API must scope the read as well.
  const isParty = !viewerId || viewerId === dispute.raisedById || viewerId === dispute.againstId
  if (!isParty) {
    return (
      <DashboardPage title="Dispute" backTo={routes.list} maxWidth="md">
        <ErrorState
          title="This dispute is not yours"
          message="It is between two other BetterBlue accounts, so we cannot show it here."
        />
      </DashboardPage>
    )
  }

  const settled = isSettled(dispute)
  const awaitsViewer = isAwaitingViewer(dispute, role)
  const otherParty = people?.get(counterpartId(dispute, viewerId))
  const opener = people?.get(dispute.raisedById)
  const raisedByViewer = isRaisedByViewer(dispute, viewerId)

  /* -- panels ------------------------------------------------------------- */

  const orderCard = (
    <Card>
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Typography variant="subtitle2" component="h2" sx={{ mb: 1.5 }}>
          The order
        </Typography>

        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {order?.title ?? 'This order is no longer available'}
        </Typography>

        {order ? (
          <>
            <Typography
              variant="h6"
              component="p"
              sx={{ mt: 1, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
            >
              {formatCurrency(order.price, order.currency)}
            </Typography>
            <Divider sx={{ my: 2 }} />
            <KeyValueList
              dense
              labelWidth={120}
              items={[
                { label: 'Order status', value: <StatusChip status={order.status} size="sm" tooltip /> },
                { label: 'Ordered on', value: formatDate(order.createdAt) },
                { label: 'Dispute opened', value: formatDate(dispute.createdAt) },
              ]}
            />
            <Link
              component={RouterLink}
              to={routes.orderDetail(order.id)}
              variant="body2"
              underline="hover"
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 2 }}
            >
              <Icon icon="solar:box-linear" width={16} aria-hidden="true" />
              Open the order
            </Link>
          </>
        ) : null}
      </CardContent>
    </Card>
  )

  const partiesCard = (
    <Card>
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Typography variant="subtitle2" component="h2" sx={{ mb: 2 }}>
          Who is on this
        </Typography>

        <Stack spacing={2}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <UserAvatar name={otherParty?.name ?? 'The other party'} src={otherParty?.avatarUrl} size="md" />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {otherParty?.name ?? 'The other party'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {raisedByViewer ? 'You raised this with them' : 'They raised this'}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              aria-hidden="true"
              sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'primary.lighter',
                color: 'primary.light',
              }}
            >
              <Icon icon="solar:shield-user-linear" width={22} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                BetterBlue Support
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {settled
                  ? 'Decided this case'
                  : dispute.assignedAdminId
                    ? 'Reviewing this case'
                    : 'Will pick this up shortly'}
              </Typography>
            </Box>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )

  const statementCard = (
    <Card component="section" aria-labelledby="dispute-statement-heading">
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Typography id="dispute-statement-heading" variant="subtitle2" component="h2" sx={{ mb: 1.5 }}>
          {raisedByViewer ? 'What you reported' : `What ${opener?.name ?? 'they'} reported`}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
          {dispute.description}
        </Typography>

        {(dispute.evidence ?? []).length > 0 ? (
          <Box sx={{ mt: 2.5 }}>
            <Typography variant="subtitle2" component="h3" sx={{ mb: 1.5 }}>
              Evidence attached at the start
            </Typography>
            <EvidenceGrid
              files={dispute.evidence}
              label="Evidence attached when this dispute was opened"
            />
          </Box>
        ) : null}
      </CardContent>
    </Card>
  )

  return (
    <DashboardPage
      title={categoryLabel(dispute.category)}
      documentTitle={`${categoryLabel(dispute.category)} — dispute`}
      backTo={routes.list}
      meta={
        // The heading is already the category, so the meta row carries the
        // status and the order it belongs to rather than repeating it.
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <StatusChip status={dispute.status} tooltip />
          {order ? (
            <Chip
              size="small"
              variant="outlined"
              icon={<Icon icon="solar:box-linear" width={14} aria-hidden="true" />}
              label={order.title}
              sx={{ maxWidth: { xs: 220, sm: 420 } }}
            />
          ) : null}
        </Stack>
      }
    >
      <Stack spacing={{ xs: 2, md: 2.5 }}>
        <DisputeStatusBanner dispute={dispute} role={role} />

        {settled ? (
          <ResolutionCard dispute={dispute} role={role} currency={order?.currency} />
        ) : null}

        <Box
          sx={{
            display: 'grid',
            gap: { xs: 2, md: 3 },
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 5fr) minmax(0, 2fr)' },
            alignItems: 'start',
          }}
        >
          <Stack spacing={{ xs: 2, md: 2.5 }} sx={{ minWidth: 0 }}>
            {/* The statement leads the thread column at every width: everything
                below it is a reply to it. */}
            <Box sx={{ display: { xs: 'block', lg: 'none' } }}>{orderCard}</Box>

            {statementCard}

            <Card>
              <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                <Typography variant="subtitle2" component="h2" sx={{ mb: 2 }}>
                  Conversation
                </Typography>
                <DisputeThread
                  messages={messages}
                  authors={people}
                  viewerId={viewerId}
                  isLoading={threadLoading}
                  error={threadError}
                  onRetry={refetchThread}
                />
              </CardContent>
            </Card>

            {/* Sticky above the mobile bottom nav so a long thread never puts
                the reply out of reach (§11). */}
            <Box
              sx={{
                position: { xs: 'sticky', lg: 'static' },
                bottom: { xs: `${BOTTOM_NAV_HEIGHT + 8}px`, lg: 'auto' },
                zIndex: 1,
                bgcolor: 'background.default',
              }}
            >
              <MessageComposer
                onSend={onSend}
                disabled={settled}
                awaitingViewer={awaitsViewer}
                disabledReason={
                  dispute.status === DISPUTE_STATUS.CLOSED
                    ? 'This dispute is closed, so the thread no longer takes messages. It stays here for your records — contact support if something is still outstanding.'
                    : 'A decision has been issued on this dispute, so the thread is closed. It stays here for your records — contact support if something is still outstanding.'
                }
              />
            </Box>
          </Stack>

          <Stack spacing={{ xs: 2, md: 2.5 }} sx={{ minWidth: 0 }}>
            <Box sx={{ display: { xs: 'none', lg: 'block' } }}>{orderCard}</Box>
            {partiesCard}
          </Stack>
        </Box>
      </Stack>
    </DashboardPage>
  )
}
