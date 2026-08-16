import { useCallback, useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Collapse from '@mui/material/Collapse'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useParams } from 'react-router-dom'

import KeyValueList from '@/components/data-display/KeyValueList'
import StatusChip from '@/components/data-display/StatusChip'
import TimelineList from '@/components/data-display/TimelineList'
import UserAvatar from '@/components/data-display/UserAvatar'
import ErrorState from '@/components/feedback/ErrorState'
import CardSkeleton from '@/components/feedback/skeletons/CardSkeleton'
import { useToast } from '@/components/feedback/ToastProvider'
import { PERMISSIONS, hasPermission } from '@/constants/permissions'
import { useAuth } from '@/context/AuthContext'
import InterventionDialogs from '@/features/admin/operations/components/InterventionDialogs'
import OrderMoneyCard from '@/features/admin/operations/components/OrderMoneyCard'
import {
  ORDER_DUE_SLA,
  isOrderOverdue,
  shortId,
} from '@/features/admin/operations/utils/operationsFilters'
import { AdminPageGuard, AgeBadge, EntityRefChip } from '@/features/admin/shared'
import DeliveryVersionList from '@/features/deliveries/components/DeliveryVersionList'
import RequestBriefPanel from '@/features/requests/components/RequestBriefPanel'
import useApiQuery from '@/hooks/useApiQuery'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { paths } from '@/routes/paths'
import { orderService } from '@/services/orderService'
import { EMPTY_PLACEHOLDER, formatDate, formatDateTime, formatNumber } from '@/utils/formatters'

// One order, in full — Prompt 31 §4.2.
//
// The buyer's screen and the creator's screen each show their own half of an
// engagement. This shows both halves plus the ledger, which is the only view
// from which a disagreement about what happened can actually be settled.
//
// Everything on it is a **shared component**: the brief is Prompt 23's
// `RequestBriefPanel`, the deliveries are Prompt 24's `DeliveryVersionList`, the
// history is Prompt 20's timeline through `getAdminOrderTimeline`, and the
// interventions call Prompt 17's `cancelOrder`. Nothing here is a fork of a
// party-facing view (§7), so a change to how a delivery reads reaches this
// screen without anyone remembering it exists.

/** One party's card — who they are and how to get to their account. */
function PartyCard({ role, user, meta }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Typography variant="caption" color="text.secondary" component="p">
          {role}
        </Typography>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1 }}>
          <UserAvatar name={user?.name ?? 'Unknown'} src={user?.avatarUrl} size="md" />
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="subtitle2" component="p" noWrap>
              {user?.name ?? 'Account unavailable'}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p" noWrap>
              {user?.email ?? EMPTY_PLACEHOLDER}
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
          {user?.id ? <EntityRefChip type="user" id={user.id} label="Open account" /> : null}
          {user?.accountStatus ? <StatusChip status={user.accountStatus} size="sm" tooltip /> : null}
        </Stack>

        {meta ? (
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
            {meta}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default function AdminOrderDetailPage() {
  const { orderId } = useParams()
  const { user: actor } = useAuth()
  const toast = useToast()
  const canManage = hasPermission(actor, PERMISSIONS.ORDERS_MANAGE)

  const [busy, setBusy] = useState(false)
  const [briefOpen, setBriefOpen] = useState(false)

  const { data, isLoading, error, refetch } = useApiQuery(
    () => orderService.getAdminOrderContext(orderId),
    [orderId],
    { enabled: Boolean(orderId) }
  )

  const order = data?.order
  const overdue = isOrderOverdue(order)

  const cancelOrder = useCallback(
    async (reason) => {
      setBusy(true)
      try {
        await orderService.cancelOrder(orderId, {
          byRole: actor?.role,
          actorId: actor?.id,
          reason,
        })
        toast.success('The order has been cancelled.', {
          description:
            'Any escrow has gone back to the buyer, both parties have been notified, and the action is in the audit trail.',
        })
        refetch()
      } catch (failure) {
        toast.error(failure?.message ?? 'We could not cancel this order.')
      } finally {
        setBusy(false)
      }
    },
    [actor, orderId, refetch, toast]
  )

  const addNote = useCallback(
    async (note) => {
      setBusy(true)
      try {
        await orderService.addAdminNote(orderId, { note, actor })
        toast.success('Note saved.', { description: 'It is on the timeline, admin-side only.' })
        refetch()
      } catch (failure) {
        toast.error(failure?.message ?? 'We could not save that note.')
      } finally {
        setBusy(false)
      }
    },
    [actor, orderId, refetch, toast]
  )

  const body = () => {
    if (error) {
      return (
        <ErrorState
          error={error}
          onRetry={refetch}
          title="We could not load this order"
          message="The order may have been removed, or the API is briefly unreachable."
        />
      )
    }
    if (isLoading || !order) {
      return <CardSkeleton media={false} lines={8} label="Loading this order" />
    }

    return (
      <Stack spacing={{ xs: 2, md: 2.5 }}>
        {data.dispute ? (
          <Alert
            severity="error"
            variant="outlined"
            icon={<Icon icon="solar:shield-warning-linear" width={20} aria-hidden="true" />}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              This order is under dispute.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Case {data.dispute.id} was raised {formatDate(data.dispute.createdAt)} and is{' '}
              {data.dispute.status?.replace(/_/g, ' ')}. Resolve it from the disputes console —
              a resolution settles the money and closes the order in one action, which a
              cancellation here does not.
            </Typography>
            {/* Prompt 33 built the workspace, so this leads straight to it. */}
            <Box sx={{ mt: 1 }}>
              <EntityRefChip
                type="dispute"
                id={data.dispute.id}
                label="Open the dispute"
              />
            </Box>
          </Alert>
        ) : null}

        {overdue ? (
          <Alert severity="warning" variant="outlined">
            Delivery was due {formatDate(order.deliveryDueAt)} and the work is still outstanding.
          </Alert>
        ) : null}

        <Box
          sx={{
            display: 'grid',
            gap: { xs: 2, md: 2.5 },
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
          }}
        >
          <PartyCard
            role="Buyer"
            user={data.buyer}
            meta={`Ordered ${formatDateTime(order.createdAt)}`}
          />
          <PartyCard
            role="Creator"
            user={data.creator}
            meta={
              order.deliveryDays
                ? `Agreed turnaround: ${formatNumber(order.deliveryDays)} days`
                : undefined
            }
          />
        </Box>

        <Box
          sx={{
            display: 'grid',
            gap: { xs: 2, md: 2.5 },
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) minmax(0, 1fr)' },
          }}
        >
          <OrderMoneyCard
            order={order}
            payment={data.payment}
            transactions={data.transactions}
          />

          <Card>
            <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
              <Typography variant="subtitle2" component="h2" sx={{ mb: 2 }}>
                Engagement
              </Typography>
              <KeyValueList
                divided
                labelWidth={190}
                items={[
                  { label: 'Category', value: data.category?.name ?? EMPTY_PLACEHOLDER },
                  {
                    label: 'Content type',
                    value: <StatusChip status={order.contentType} size="sm" tooltip />,
                  },
                  {
                    label: 'Revisions',
                    value: `${formatNumber(order.revisionsUsed ?? 0)} used of ${formatNumber(
                      order.revisionsIncluded ?? 0
                    )} included`,
                  },
                  {
                    label: 'Delivery due',
                    value: order.deliveryDueAt ? (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">{formatDate(order.deliveryDueAt)}</Typography>
                        {overdue ? (
                          <AgeBadge
                            date={order.deliveryDueAt}
                            overdue
                            noun="Delivery"
                            {...ORDER_DUE_SLA}
                          />
                        ) : null}
                      </Stack>
                    ) : (
                      'Starts when the order is funded'
                    ),
                  },
                  {
                    label: 'Completed',
                    value: order.completedAt ? formatDateTime(order.completedAt) : EMPTY_PLACEHOLDER,
                  },
                  {
                    label: 'Cancelled',
                    value: order.cancelledAt ? formatDateTime(order.cancelledAt) : EMPTY_PLACEHOLDER,
                  },
                ]}
              />

              <Box sx={{ mt: 2.5 }}>
                <InterventionDialogs
                  order={order}
                  payment={data.payment}
                  canManage={canManage}
                  busy={busy}
                  onCancelOrder={cancelOrder}
                  onAddNote={addNote}
                />
              </Box>
            </CardContent>
          </Card>
        </Box>

        {data.request ? (
          <Card>
            <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="subtitle2" component="h2" sx={{ flexGrow: 1 }}>
                  The brief behind this order
                </Typography>
                <Button
                  size="small"
                  onClick={() => setBriefOpen((previous) => !previous)}
                  aria-expanded={briefOpen}
                  endIcon={
                    <Icon
                      icon={briefOpen ? 'tabler:chevron-up' : 'tabler:chevron-down'}
                      width={18}
                      aria-hidden="true"
                    />
                  }
                >
                  {briefOpen ? 'Hide' : 'Show'}
                </Button>
              </Stack>

              <Collapse in={briefOpen} unmountOnExit>
                <Box sx={{ mt: 2 }}>
                  <RequestBriefPanel
                    request={data.request}
                    categoryLabel={data.category?.name}
                  />
                </Box>
              </Collapse>
            </CardContent>
          </Card>
        ) : null}

        {data.deliveries.length > 0 ? (
          <Box>
            <Typography variant="subtitle2" component="h2" sx={{ mb: 1.5 }}>
              Deliveries
            </Typography>
            <DeliveryVersionList
              deliveries={data.deliveries}
              revisions={data.revisions}
              showResponses
              lightboxTitle={`Deliverables for ${order.title}`}
            />
          </Box>
        ) : null}

        <Card>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Typography variant="subtitle2" component="h2" sx={{ mb: 2 }}>
              History
            </Typography>
            <TimelineList
              emptyText="Nothing has happened on this order yet."
              items={data.timeline.map((entry) => ({
                id: entry.id,
                icon: entry.icon,
                tone: entry.tone,
                // `TimelineList` renders `title` inside a `<p>`, so the
                // "Internal" marker has to be inline elements all the way
                // down — a `Stack`/`Chip` default `div` here is invalid HTML.
                title: entry.internal ? (
                  <Box
                    component="span"
                    sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
                  >
                    {entry.title}
                    <Chip
                      component="span"
                      size="small"
                      color="warning"
                      label="Internal"
                      sx={{ fontWeight: 600 }}
                    />
                  </Box>
                ) : (
                  entry.title
                ),
                description: entry.description,
                timestamp: entry.at,
              }))}
            />
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>
              Entries marked Internal are admin-only notes. The buyer and the creator see the same
              history without them.
            </Typography>
          </CardContent>
        </Card>
      </Stack>
    )
  }

  return (
    <DashboardPage
      title={order?.title ?? 'Order'}
      documentTitle={order ? `${order.title} · Order` : 'Order'}
      subtitle={order ? `${shortId(order.id)} · ${order.id}` : undefined}
      backTo={paths.ADMIN_ORDERS}
      maxWidth={false}
      meta={order ? <StatusChip status={order.status} tooltip /> : null}
    >
      <AdminPageGuard permission={PERMISSIONS.ORDERS_MANAGE}>{body()}</AdminPageGuard>
    </DashboardPage>
  )
}
