import { useCallback, useMemo, useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { Link as RouterLink, useParams } from 'react-router-dom'

import KeyValueList from '@/components/data-display/KeyValueList'
import StatusChip from '@/components/data-display/StatusChip'
import TimelineList from '@/components/data-display/TimelineList'
import UserAvatar from '@/components/data-display/UserAvatar'
import EmptyState from '@/components/feedback/EmptyState'
import ErrorState from '@/components/feedback/ErrorState'
import CardSkeleton from '@/components/feedback/skeletons/CardSkeleton'
import { useToast } from '@/components/feedback/ToastProvider'
import StickyActionBar from '@/components/layout/StickyActionBar'
import { getStatusMeta, ORDER_STATUS } from '@/constants/statuses'
import { useAuth } from '@/context/AuthContext'
import OrderDisputeBanner from '@/features/disputes/components/OrderDisputeBanner'
import RaiseDisputeAction from '@/features/disputes/components/RaiseDisputeAction'
import AcceptDeliveryDialog from '@/features/orders/components/AcceptDeliveryDialog'
import DeliverySection from '@/features/orders/components/DeliverySection'
import OrderStateBanner from '@/features/orders/components/OrderStateBanner'
import PaymentSummaryCard from '@/features/orders/components/PaymentSummaryCard'
import RequestRevisionDialog from '@/features/orders/components/RequestRevisionDialog'
import {
  describeDue,
  describeRevisions,
  orderActions,
} from '@/features/orders/utils/orderDisplay'
import { formatBudget } from '@/features/requests/utils/requestDisplay'
import ReviewDialog from '@/features/reviews/components/ReviewDialog'
import ReviewDisplay from '@/features/reviews/components/ReviewDisplay'
import useApiMutation from '@/hooks/useApiMutation'
import useApiQuery from '@/hooks/useApiQuery'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { paths } from '@/routes/paths'
import { API_ERROR_CODE } from '@/services/api/apiError'
import { categoryService } from '@/services/categoryService'
import { creatorProfileService } from '@/services/creatorProfileService'
import { deliveryService } from '@/services/deliveryService'
import { disputeService } from '@/services/disputeService'
import { orderService } from '@/services/orderService'
import { reviewService } from '@/services/reviewService'
import { revisionService } from '@/services/revisionService'
import { settingsService, SETTINGS_FALLBACK } from '@/services/settingsService'
import { userService } from '@/services/userService'
import { EMPTY_PLACEHOLDER, formatCurrency, formatDate, formatNumber } from '@/utils/formatters'

// The order workspace — the screen the buyer's half of BetterBlue exists for.
//
// Four sections rather than one long page, because a buyer arrives here for one
// of four reasons: to review what was delivered, to reread what they asked for,
// to check what has happened, or to find the receipt. Deliverables is the
// default, since it is the only section with anything to *do* in it.
//
// Every status change on this page goes through a service (00 §7) and every one
// of them can fail on a stale read — someone accepting in a second tab, a
// dispute opened underneath. That case is handled the same way throughout: say
// what happened, refetch, and let the page redraw itself around the truth.

const TAB = Object.freeze({
  OVERVIEW: 'overview',
  DELIVERABLES: 'deliverables',
  TIMELINE: 'timeline',
  PAYMENT: 'payment',
})

const TABS = [
  { value: TAB.DELIVERABLES, label: 'Deliverables' },
  { value: TAB.OVERVIEW, label: 'Overview' },
  { value: TAB.TIMELINE, label: 'Timeline' },
  { value: TAB.PAYMENT, label: 'Payment' },
]

/** The creator, their rating, and the way to their profile. */
function CreatorCard({ creator, profile }) {
  if (!creator) return null

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Typography variant="subtitle2" component="h2" sx={{ mb: 2 }}>
          Awarded to
        </Typography>
        <Stack direction="row" spacing={1.75} alignItems="center">
          <UserAvatar name={creator.name} src={creator.avatarUrl} size="lg" />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {profile?.displayName ?? creator.name}
            </Typography>
            {profile?.tagline ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {profile.tagline}
              </Typography>
            ) : null}
          </Box>
        </Stack>

        {profile?.id ? (
          <Button
            component={RouterLink}
            to={paths.creatorProfile(profile.id)}
            variant="outlined"
            color="inherit"
            fullWidth
            sx={{ mt: 2 }}
            startIcon={<Icon icon="solar:user-circle-linear" width={18} aria-hidden="true" />}
          >
            View profile
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default function BuyerOrderDetailPage() {
  const { orderId } = useParams()
  const { user } = useAuth()
  const toast = useToast()

  const [tab, setTab] = useState(TAB.DELIVERABLES)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [acceptOpen, setAcceptOpen] = useState(false)
  const [revisionOpen, setRevisionOpen] = useState(false)
  const [justAccepted, setJustAccepted] = useState(null)

  const { data, isLoading, error, refetch } = useApiQuery(
    () => orderService.getWithRelations(orderId),
    [orderId],
    { enabled: Boolean(orderId) }
  )

  const order = data?.order
  const request = data?.request
  const creatorId = order?.creatorId

  const { data: creator } = useApiQuery(() => userService.getById(creatorId), [creatorId], {
    enabled: Boolean(creatorId),
  })
  const { data: creatorProfile } = useApiQuery(
    () => creatorProfileService.getByUserId(creatorId),
    [creatorId],
    { enabled: Boolean(creatorId) }
  )

  const { data: review, refetch: refetchReview } = useApiQuery(
    () => reviewService.getByOrderId(orderId),
    [orderId],
    { enabled: Boolean(orderId) }
  )

  // Prompt 26: only asked for on a frozen order, since it exists purely to give
  // the dispute banner somewhere to link to. A failure leaves the banner in
  // place without its link rather than failing the page.
  const isDisputed = order?.status === ORDER_STATUS.DISPUTED
  const { data: dispute } = useApiQuery(
    () => disputeService.findForOrder(orderId).catch(() => null),
    [orderId, isDisputed],
    { enabled: Boolean(orderId) && isDisputed }
  )

  // Settings are cached in the service for a minute (Prompt 07), so this is one
  // request for the whole dashboard rather than one per visit. It only ever
  // feeds display copy, so a failure falls back rather than surfacing.
  const { data: settings } = useApiQuery(
    () => settingsService.getSettings().catch(() => SETTINGS_FALLBACK),
    []
  )
  const autoAcceptDays = settings?.general?.autoAcceptDays

  // The timeline is the one read that is not needed on first paint, so it waits
  // until someone asks for it.
  const {
    data: timeline,
    isLoading: timelineLoading,
    error: timelineError,
    refetch: refetchTimeline,
  } = useApiQuery(() => orderService.getOrderTimeline(orderId), [orderId], {
    enabled: Boolean(orderId) && tab === TAB.TIMELINE,
  })

  const { data: categories } = useApiQuery(() => categoryService.listActive(), [])
  const categoryLabel = useMemo(
    () => (categories ?? []).find((category) => category.id === order?.categoryId)?.name,
    [categories, order?.categoryId]
  )

  const accept = useApiMutation(deliveryService.acceptDelivery)
  const requestChanges = useApiMutation(revisionService.requestRevision)
  const submitReview = useApiMutation(reviewService.submitReview)

  /**
   * The one failure worth its own handling: the order moved while this tab was
   * open. Nothing the buyer did was wrong, so the page apologises for the stale
   * screen rather than for them, and refetches into the truth.
   */
  const handleFailure = useCallback(
    (failure, fallback) => {
      if (failure?.code === API_ERROR_CODE.CONFLICT) {
        toast.error(failure.message, {
          description: 'This page was showing an older version of the order. It has been refreshed.',
        })
        // Both reads, because either can be the stale one: the order moved
        // under an accept, or a review landed under a review.
        refetch()
        refetchReview()
        return
      }
      toast.error(failure?.message ?? fallback)
    },
    [refetch, refetchReview, toast]
  )

  const deliveries = data?.deliveries ?? []
  const revisions = data?.revisions ?? []
  const payment = data?.payment ?? null
  const newestDelivery = deliveries[0]

  const onAccept = useCallback(async () => {
    try {
      const result = await accept.mutate(newestDelivery?.id, { actorId: user?.id })
      setJustAccepted({ creatorEarnings: result?.creatorEarnings ?? null })
      toast.success('Delivery accepted', {
        description: 'The escrow has been released and the order is complete.',
      })
      refetch()
      refetchTimeline()
    } catch (failure) {
      handleFailure(failure, 'We could not accept this delivery.')
    } finally {
      // Closed either way: on success there is nothing left to confirm, and on a
      // stale-state failure the page behind it has already been refetched.
      setAcceptOpen(false)
    }
  }, [accept, handleFailure, newestDelivery?.id, refetch, refetchTimeline, toast, user?.id])

  const onRequestRevision = useCallback(
    async (notes) => {
      try {
        await requestChanges.mutate(newestDelivery?.id, { notes, actorId: user?.id })
        toast.success('Changes requested', {
          description: 'The creator has your notes and will submit a new version.',
        })
        setRevisionOpen(false)
        refetch()
        refetchTimeline()
      } catch (failure) {
        handleFailure(failure, 'We could not send your request.')
        // Rethrown so the dialog stays open on anything the buyer can fix, with
        // their notes still in the field.
        throw failure
      }
    },
    [handleFailure, newestDelivery?.id, refetch, refetchTimeline, requestChanges, toast, user?.id]
  )

  const onSubmitReview = useCallback(
    async (values) => {
      try {
        await submitReview.mutate(orderId, { ...values, actorId: user?.id })
        toast.success('Review published', {
          description: 'Thank you — it now appears on the creator’s public profile.',
        })
        setReviewOpen(false)
        setJustAccepted(null)
        refetchReview()
      } catch (failure) {
        handleFailure(failure, 'We could not publish your review.')
        throw failure
      }
    },
    [handleFailure, orderId, refetchReview, submitReview, toast, user?.id]
  )

  const copyOrderId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(order?.id ?? '')
      toast.success('Order reference copied')
    } catch {
      toast.error('Your browser would not let us copy that. You can select it by hand instead.')
    }
  }, [order?.id, toast])

  /* -- loading and failure ------------------------------------------------ */

  if (error) {
    return (
      <DashboardPage title="Order" backTo={paths.BUYER_ORDERS} maxWidth="md">
        <ErrorState
          title="We could not open this order"
          message="It may have been removed, or the link may be wrong. Your other orders are unaffected."
          error={error}
          onRetry={refetch}
        />
      </DashboardPage>
    )
  }

  if (isLoading || !order) {
    return (
      <DashboardPage title="Order" backTo={paths.BUYER_ORDERS} maxWidth="md">
        <CardSkeleton media={false} lines={5} label="Loading your order" />
      </DashboardPage>
    )
  }

  // SECURITY: a UX guard only (00 §11) — it stops a mistyped or shared link
  // showing another business's engagement. The API must scope the read as well.
  if (user?.id && order.buyerId !== user.id) {
    return (
      <DashboardPage title="Order" backTo={paths.BUYER_ORDERS} maxWidth="md">
        <ErrorState
          title="This order is not yours"
          message="It belongs to another BetterBlue account, so we cannot show it here."
        />
      </DashboardPage>
    )
  }

  const actions = orderActions(order, { review })
  const due = describeDue(order)
  const revisionSummary = describeRevisions(order)
  const isBusy = accept.isLoading || requestChanges.isLoading

  /* -- panels ------------------------------------------------------------- */

  const overviewPanel = (
    <Stack spacing={{ xs: 2, md: 3 }}>
      <Card>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography variant="subtitle2" component="h2" sx={{ mb: 1 }}>
            What you asked for
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
            {request?.description ??
              'The brief behind this order is no longer available, but everything agreed at award time is recorded below.'}
          </Typography>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography variant="subtitle2" component="h2" sx={{ mb: 2 }}>
            Agreed at award
          </Typography>
          <KeyValueList
            divided
            labelWidth={190}
            items={[
              { label: 'Category', value: categoryLabel ?? EMPTY_PLACEHOLDER },
              {
                label: 'Content type',
                value: <StatusChip status={order.contentType} size="sm" tooltip />,
              },
              ...(request?.quantity
                ? [{ label: 'Deliverables', value: formatNumber(request.quantity) }]
                : []),
              ...(request?.usageRights
                ? [
                    {
                      label: 'Usage rights',
                      value: <StatusChip status={request.usageRights} size="sm" tooltip />,
                      hint: getStatusMeta(request.usageRights).description,
                    },
                  ]
                : []),
              ...(request
                ? [{ label: 'Original budget', value: formatBudget(request) }]
                : []),
              {
                label: 'Agreed price',
                value: (
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {formatCurrency(order.price, order.currency)}
                  </Typography>
                ),
              },
              { label: 'Revisions', value: revisionSummary.label },
              {
                label: 'Delivery due',
                value: (
                  <Typography variant="body2" sx={{ fontWeight: 500, color: due.tone }}>
                    {due.date}
                    {due.relative ? ` · ${due.relative}` : ''}
                  </Typography>
                ),
              },
              { label: 'Ordered on', value: formatDate(order.createdAt) },
            ]}
          />

          {request ? (
            <Link
              component={RouterLink}
              to={paths.buyerRequestDetail(request.id)}
              variant="body2"
              underline="hover"
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 2.5 }}
            >
              <Icon icon="solar:clipboard-list-linear" width={16} aria-hidden="true" />
              Open the original brief
            </Link>
          ) : null}
        </CardContent>
      </Card>

      {review ? <ReviewDisplay review={review} creatorName={creator?.name} /> : null}
    </Stack>
  )

  const timelinePanel = (
    <Card>
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Typography variant="subtitle2" component="h2" sx={{ mb: 2.5 }}>
          Everything that has happened
        </Typography>

        {timelineError ? (
          <ErrorState
            dense
            title="The history did not load"
            message="Nothing about the order has changed — this list just needs another go."
            error={timelineError}
            onRetry={refetchTimeline}
          />
        ) : timelineLoading ? (
          <CardSkeleton media={false} lines={5} label="Loading this order's history" />
        ) : (
          <TimelineList
            items={timeline ?? []}
            emptyText="Nothing has happened on this order yet."
          />
        )}
      </CardContent>
    </Card>
  )

  return (
    <DashboardPage
      title={order.title}
      documentTitle={order.title}
      backTo={paths.BUYER_ORDERS}
      meta={
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <StatusChip status={order.status} tooltip />
          <Tooltip title="Copy order reference">
            <IconButton
              onClick={copyOrderId}
              aria-label={`Copy order reference ${order.id}`}
              size="small"
              sx={{ width: 40, height: 40 }}
            >
              <Icon icon="tabler:copy" width={18} />
            </IconButton>
          </Tooltip>
          <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {order.id}
          </Typography>
        </Stack>
      }
      actions={
        /* Prompt 26 filled the DISPUTE-SLOT that stood here: "Report an issue"
           now lives in the overflow menu, which renders itself only on the
           order states a dispute can be raised from. */
        <Stack direction="row" spacing={1} alignItems="center">
          {actions.canPay ? (
            <Button
              component={RouterLink}
              to={paths.buyerCheckout(order.id)}
              variant="gradient"
              startIcon={<Icon icon="solar:card-linear" width={18} aria-hidden="true" />}
            >
              Complete payment
            </Button>
          ) : null}
          <RaiseDisputeAction order={order} onOpened={refetch} />
        </Stack>
      }
    >
      <Stack spacing={{ xs: 2, md: 2.5 }}>
        {/* Exactly one banner at a time. On a disputed order the dispute banner
            supersedes the state banner: they say the same thing, and only one
            of them can link to the case. */}
        {isDisputed ? (
          <OrderDisputeBanner order={order} dispute={dispute} role={user?.role} />
        ) : (
          <OrderStateBanner order={order} autoAcceptDays={autoAcceptDays} />
        )}

        {justAccepted ? (
          <Alert
            severity="success"
            icon={<Icon icon="solar:verified-check-bold" width={22} />}
            action={
              review ? undefined : (
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  onClick={() => setReviewOpen(true)}
                  sx={{ whiteSpace: 'nowrap', minHeight: 44 }}
                >
                  Leave a review
                </Button>
              )
            }
            sx={{ alignItems: 'center' }}
          >
            <AlertTitle sx={{ mb: 0.25 }}>Done — the creator has been paid</AlertTitle>
            {justAccepted.creatorEarnings
              ? `${formatCurrency(justAccepted.creatorEarnings, order.currency)} reached ${
                  creator?.name ?? 'the creator'
                } after commission. `
              : 'The escrow has been released. '}
            A short review helps the next business decide.
          </Alert>
        ) : actions.canLeaveReview ? (
          <Alert
            severity="info"
            icon={<Icon icon="solar:star-linear" width={22} />}
            action={
              <Button
                size="small"
                variant="contained"
                onClick={() => setReviewOpen(true)}
                sx={{ whiteSpace: 'nowrap', minHeight: 44 }}
              >
                Leave a review
              </Button>
            }
            sx={{ alignItems: 'center' }}
          >
            <AlertTitle sx={{ mb: 0.25 }}>How was working with {creator?.name ?? 'this creator'}?</AlertTitle>
            Reviews are the main thing other businesses read before hiring. It takes a minute.
          </Alert>
        ) : null}

        <Box
          sx={{
            display: 'grid',
            gap: { xs: 2, md: 3 },
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 5fr) minmax(0, 2fr)' },
            alignItems: 'start',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Tabs
              value={tab}
              onChange={(event, next) => setTab(next)}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              aria-label="Order sections"
              sx={{ borderBottom: 1, borderColor: 'divider', mb: { xs: 2, md: 2.5 } }}
            >
              {TABS.map((entry) => (
                <Tab
                  key={entry.value}
                  value={entry.value}
                  label={entry.label}
                  sx={{ minHeight: 48, textTransform: 'none', fontWeight: 600 }}
                />
              ))}
            </Tabs>

            <Box role="tabpanel" aria-label={tab}>
              {tab === TAB.DELIVERABLES ? (
                <DeliverySection
                  order={order}
                  deliveries={deliveries}
                  revisions={revisions}
                  creator={creator}
                  autoAcceptDays={autoAcceptDays}
                  onAccept={() => setAcceptOpen(true)}
                  onRequestRevision={() => setRevisionOpen(true)}
                  isBusy={isBusy}
                />
              ) : null}

              {tab === TAB.OVERVIEW ? overviewPanel : null}
              {tab === TAB.TIMELINE ? timelinePanel : null}
              {tab === TAB.PAYMENT ? (
                <PaymentSummaryCard order={order} payment={payment} />
              ) : null}
            </Box>
          </Box>

          {/* Side meta: who and what, always on screen at `lg` regardless of
              which section is open. Below `lg` it follows the panel rather than
              pushing the review actions off the first screenful. */}
          <Stack spacing={{ xs: 2, md: 2.5 }} sx={{ minWidth: 0 }}>
            <CreatorCard creator={creator} profile={creatorProfile} />

            <Card>
              <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                <Typography variant="subtitle2" component="h2" sx={{ mb: 1.5 }}>
                  At a glance
                </Typography>
                <Typography
                  variant="h5"
                  component="p"
                  sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
                >
                  {formatCurrency(order.price, order.currency)}
                </Typography>
                <Divider sx={{ my: 2 }} />
                <KeyValueList
                  dense
                  labelWidth={120}
                  items={[
                    {
                      label: 'Payment',
                      value: payment ? (
                        <StatusChip status={payment.status} size="sm" tooltip />
                      ) : (
                        'Not yet funded'
                      ),
                    },
                    { label: 'Delivery due', value: due.date },
                    { label: 'Revisions', value: revisionSummary.label },
                    { label: 'Versions', value: formatNumber(deliveries.length) },
                  ]}
                />
              </CardContent>
            </Card>

            {deliveries.length === 0 && tab !== TAB.DELIVERABLES ? (
              <EmptyState
                dense
                icon="solar:box-linear"
                title="Nothing delivered yet"
                description="Files appear here the moment the creator submits them."
              />
            ) : null}
          </Stack>
        </Box>
      </Stack>

      {/* The decision has to be reachable with a thumb without scrolling to
          find it (§11). Mobile only — on desktop the review card is already on
          screen. */}
      {actions.canReview ? (
        <StickyActionBar mobileOnly justify="space-between" sx={{ mx: { xs: -2, sm: -3 }, mt: 2 }}>
          <Button
            onClick={() => setRevisionOpen(true)}
            color="inherit"
            variant="outlined"
            disabled={isBusy}
            sx={{ flexGrow: 1 }}
          >
            Request changes
          </Button>
          <Button
            onClick={() => setAcceptOpen(true)}
            variant="gradient"
            disabled={isBusy}
            sx={{ flexGrow: 1 }}
            startIcon={<Icon icon="tabler:circle-check" width={18} aria-hidden="true" />}
          >
            Accept
          </Button>
        </StickyActionBar>
      ) : null}

      <AcceptDeliveryDialog
        open={acceptOpen}
        onClose={() => setAcceptOpen(false)}
        onConfirm={onAccept}
        isSubmitting={accept.isLoading}
        order={order}
        creator={creator}
      />

      <RequestRevisionDialog
        open={revisionOpen}
        onClose={() => setRevisionOpen(false)}
        onSubmit={onRequestRevision}
        order={order}
      />

      <ReviewDialog
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onSubmit={onSubmitReview}
        creatorName={creator?.name}
        orderTitle={order.title}
      />
    </DashboardPage>
  )
}
