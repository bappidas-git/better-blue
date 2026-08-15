import { useCallback, useMemo, useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import { useParams } from 'react-router-dom'

import KeyValueList from '@/components/data-display/KeyValueList'
import StatusChip from '@/components/data-display/StatusChip'
import TimelineList from '@/components/data-display/TimelineList'
import UserAvatar from '@/components/data-display/UserAvatar'
import { useConfirm } from '@/components/feedback/ConfirmDialogProvider'
import EmptyState from '@/components/feedback/EmptyState'
import ErrorState from '@/components/feedback/ErrorState'
import CardSkeleton from '@/components/feedback/skeletons/CardSkeleton'
import { useToast } from '@/components/feedback/ToastProvider'
import StickyActionBar from '@/components/layout/StickyActionBar'
import { useAuth } from '@/context/AuthContext'
import DeliveryComposer from '@/features/deliveries/components/DeliveryComposer'
import DeliveryVersionList from '@/features/deliveries/components/DeliveryVersionList'
import EarningsCard from '@/features/deliveries/components/EarningsCard'
import FulfillmentChecklist from '@/features/deliveries/components/FulfillmentChecklist'
import RevisionContextBanner from '@/features/deliveries/components/RevisionContextBanner'
import useDeliveryComposer from '@/features/deliveries/hooks/useDeliveryComposer'
import {
  creatorOrderActions,
  describeAutoAccept,
  describeCreatorProgress,
  describeDue,
  describeRevisions,
} from '@/features/orders/utils/orderDisplay'
import RequestBriefPanel from '@/features/requests/components/RequestBriefPanel'
import useApiQuery from '@/hooks/useApiQuery'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { paths } from '@/routes/paths'
import { API_ERROR_CODE } from '@/services/api/apiError'
import { categoryService } from '@/services/categoryService'
import { deliveryService } from '@/services/deliveryService'
import { orderService } from '@/services/orderService'
import { requestService } from '@/services/requestService'
import { settingsService, SETTINGS_FALLBACK } from '@/services/settingsService'
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/utils/formatters'

// The creator's order workspace — where work is handed over.
//
// Four sections, and the one a creator arrives for is Delivery, so it opens
// there: the brief is a page away when they need to check a spec, the timeline
// and the earnings are reference. The composer is the only thing on this screen
// that writes anything, and it appears in exactly the two states the services
// will accept a delivery from — an order that is `delivered`, `completed`, or
// `disputed` has no composer at all rather than one that fails on submit.
//
// The submission itself is `deliveryService.submitDelivery` (contract §7
// operation 5): version numbering, the order transition, resolving the revision
// it answers, the moderation record, and the buyer's notification all happen
// there, in one call, and this page only redraws around the result.
//
// Every mutation on this page can fail on a stale read — a buyer disputing in
// another tab, an admin cancelling underneath. That case is handled the same way
// as on the buyer's side: say what happened, refetch, redraw around the truth.

const TAB = Object.freeze({
  DELIVERY: 'delivery',
  BRIEF: 'brief',
  TIMELINE: 'timeline',
  EARNINGS: 'earnings',
})

const TABS = [
  { value: TAB.DELIVERY, label: 'Delivery' },
  { value: TAB.BRIEF, label: 'Brief' },
  { value: TAB.TIMELINE, label: 'Timeline' },
  { value: TAB.EARNINGS, label: 'Earnings' },
]

/** The business this order is for, and how to read it back. */
function BuyerCard({ buyer }) {
  if (!buyer) return null

  const name = buyer.companyName ?? buyer.name

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Typography variant="subtitle2" component="h2" sx={{ mb: 2 }}>
          Commissioned by
        </Typography>
        <Stack direction="row" spacing={1.75} alignItems="center">
          <UserAvatar name={name} src={buyer.logoUrl} size="lg" />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {name}
            </Typography>
            {buyer.industry || buyer.location ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {[buyer.industry, buyer.location].filter(Boolean).join(' · ')}
              </Typography>
            ) : null}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}

/** What the creator sees while the buyer has the work. */
function AwaitingReviewCard({ order, delivery, autoAcceptDays }) {
  const autoAccept = describeAutoAccept(order, autoAcceptDays)

  return (
    <Card sx={{ borderColor: 'info.main', borderWidth: 1, borderStyle: 'solid' }}>
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1 }}>
          <Box aria-hidden="true" sx={{ color: 'info.dark', display: 'flex' }}>
            <Icon icon="solar:inbox-line-linear" width={20} />
          </Box>
          <Typography variant="subtitle2" component="h2">
            Version {formatNumber(delivery?.version ?? 1)} is with the buyer
          </Typography>
        </Stack>

        <Typography variant="body2" color="text.secondary">
          Sent {formatDateTime(delivery?.submittedAt)} with{' '}
          {formatNumber(delivery?.files?.length ?? 0)}{' '}
          {(delivery?.files?.length ?? 0) === 1 ? 'file' : 'files'}. They can accept it or ask for
          changes; the escrow is released to you the moment they accept.
          {autoAccept
            ? ` If they do neither, BetterBlue accepts it on your behalf on ${autoAccept.date}.`
            : ''}
        </Typography>
      </CardContent>
    </Card>
  )
}

export default function CreatorOrderDetailPage() {
  const { orderId } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()

  const [tab, setTab] = useState(TAB.DELIVERY)
  const [justSubmitted, setJustSubmitted] = useState(null)

  const { data, isLoading, error, refetch } = useApiQuery(
    () => orderService.getWithRelations(orderId),
    [orderId],
    { enabled: Boolean(orderId) }
  )

  const order = data?.order
  const request = data?.request ?? null
  const deliveries = useMemo(() => data?.deliveries ?? [], [data])
  const revisions = useMemo(() => data?.revisions ?? [], [data])
  const payment = data?.payment ?? null
  const buyerId = order?.buyerId

  const { data: buyers } = useApiQuery(
    () => requestService.getBuyerSummaries([buyerId]).catch(() => new Map()),
    [buyerId],
    { enabled: Boolean(buyerId) }
  )
  const buyer = buyers?.get(buyerId) ?? null

  // Settings are cached in the service for a minute (Prompt 07), and only ever
  // feed display copy here, so a failure falls back rather than surfacing.
  const { data: settings } = useApiQuery(
    () => settingsService.getSettings().catch(() => SETTINGS_FALLBACK),
    []
  )
  const autoAcceptDays = settings?.general?.autoAcceptDays

  const { data: categories } = useApiQuery(() => categoryService.listActive(), [])
  const categoryLabel = useMemo(
    () => (categories ?? []).find((category) => category.id === order?.categoryId)?.name,
    [categories, order?.categoryId]
  )

  // The timeline is the one read not needed on first paint, so it waits until
  // someone asks for it.
  const {
    data: timeline,
    isLoading: timelineLoading,
    error: timelineError,
    refetch: refetchTimeline,
  } = useApiQuery(() => orderService.getOrderTimeline(orderId), [orderId], {
    enabled: Boolean(orderId) && tab === TAB.TIMELINE,
  })

  const actions = creatorOrderActions(order)
  // The change request being answered: the newest one still open on the order.
  const openRevision = useMemo(
    () => revisions.find((revision) => !revision.resolvedAt) ?? revisions[0] ?? null,
    [revisions]
  )

  const submitVersion = useCallback(
    async ({ message, files }) => {
      try {
        const result = await deliveryService.submitDelivery(orderId, {
          message,
          files,
          revisionId: actions.isAnsweringRevision ? openRevision?.id : undefined,
          actorId: user?.id,
        })
        setJustSubmitted({ version: result?.delivery?.version ?? null })
        toast.success('Delivery sent', {
          description: 'The buyer has been notified and can review it now.',
        })
        refetch()
        refetchTimeline()
        return result
      } catch (failure) {
        if (failure?.code === API_ERROR_CODE.CONFLICT) {
          toast.error(failure.message, {
            description: 'This page was showing an older version of the order. It has been refreshed.',
          })
          refetch()
        } else {
          toast.error(failure?.message ?? 'We could not submit this delivery.')
        }
        // Rethrown so the composer keeps the note and the uploaded files.
        throw failure
      }
    },
    [
      actions.isAnsweringRevision,
      openRevision?.id,
      orderId,
      refetch,
      refetchTimeline,
      toast,
      user?.id,
    ]
  )

  const composer = useDeliveryComposer({ onSubmit: submitVersion })
  const { submit: composerSubmit } = composer

  const confirmAndSubmit = useCallback(async () => {
    const confirmed = await confirm({
      title: 'Submit this delivery?',
      message:
        'The buyer will be notified and will review your work — make sure it matches the brief. ' +
        'You cannot edit a version once it is sent; changes go out as a new version.',
      confirmLabel: 'Submit delivery',
    })
    if (!confirmed) return

    try {
      await composerSubmit()
    } catch {
      // Already reported by `submitVersion`; the composer kept its contents.
    }
  }, [composerSubmit, confirm])

  /* -- loading and failure ------------------------------------------------ */

  if (error) {
    return (
      <DashboardPage title="Order" backTo={paths.CREATOR_ORDERS} maxWidth="md">
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
      <DashboardPage title="Order" backTo={paths.CREATOR_ORDERS} maxWidth="md">
        <CardSkeleton media={false} lines={5} label="Loading your order" />
      </DashboardPage>
    )
  }

  // SECURITY: a UX guard only (00 §11) — it stops a mistyped or shared link
  // showing another creator's engagement. The API must scope the read as well.
  if (user?.id && order.creatorId !== user.id) {
    return (
      <DashboardPage title="Order" backTo={paths.CREATOR_ORDERS} maxWidth="md">
        <ErrorState
          title="This order is not yours"
          message="It belongs to another BetterBlue account, so we cannot show it here."
        />
      </DashboardPage>
    )
  }

  const due = describeDue(order)
  const progress = describeCreatorProgress(order)
  const revisionSummary = describeRevisions(order)
  const newestDelivery = deliveries[0]
  const nextVersion = deliveries.length + 1

  /* -- panels ------------------------------------------------------------- */

  const deliveryPanel = (
    <Stack spacing={{ xs: 2, md: 3 }}>
      {justSubmitted ? (
        <Alert
          severity="success"
          icon={<Icon icon="solar:verified-check-bold" width={22} />}
          onClose={() => setJustSubmitted(null)}
        >
          <AlertTitle sx={{ mb: 0.25 }}>
            Version {formatNumber(justSubmitted.version ?? nextVersion - 1)} is on its way
          </AlertTitle>
          {buyer?.companyName ?? buyer?.name ?? 'The buyer'} has been notified. Nothing else is
          needed from you until they respond.
        </Alert>
      ) : null}

      {actions.canDeliver ? (
        <DeliveryComposer
          composer={composer}
          isAnsweringRevision={actions.isAnsweringRevision}
          nextVersion={nextVersion}
          onSubmit={confirmAndSubmit}
        />
      ) : null}

      {actions.isAwaitingReview && newestDelivery ? (
        <AwaitingReviewCard
          order={order}
          delivery={newestDelivery}
          autoAcceptDays={autoAcceptDays}
        />
      ) : null}

      {deliveries.length > 0 ? (
        <Box>
          <Typography variant="subtitle2" component="h2" sx={{ mb: 1.5 }}>
            {deliveries.length === 1 ? 'What you sent' : 'Version history'}
          </Typography>
          <DeliveryVersionList
            deliveries={deliveries}
            revisions={revisions}
            showResponses
            lightboxTitle={`Deliverables — ${order.title}`}
          />
        </Box>
      ) : actions.canDeliver ? null : (
        <EmptyState
          icon="solar:box-linear"
          title="Nothing delivered yet"
          description="Files you hand over appear here, version by version, with whatever the buyer said about each one."
        />
      )}
    </Stack>
  )

  const briefPanel = (
    <Stack spacing={{ xs: 2, md: 3 }}>
      <FulfillmentChecklist request={request} order={order} />
      {request ? (
        <RequestBriefPanel request={request} categoryLabel={categoryLabel} />
      ) : (
        <EmptyState
          dense
          icon="solar:clipboard-list-linear"
          title="The original brief is unavailable"
          description="Everything agreed when your proposal was accepted is recorded on the order itself."
        />
      )}
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
          <TimelineList items={timeline ?? []} emptyText="Nothing has happened on this order yet." />
        )}
      </CardContent>
    </Card>
  )

  return (
    <DashboardPage
      title={order.title}
      documentTitle={order.title}
      backTo={paths.CREATOR_ORDERS}
      meta={
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <StatusChip status={order.status} tooltip />
          {due.relative ? (
            <Chip
              size="small"
              variant="outlined"
              color={due.isOverdue ? 'error' : 'default'}
              icon={<Icon icon="solar:calendar-linear" width={16} />}
              label={due.isOverdue ? `Due ${due.relative}` : `Due ${due.date}`}
              title={due.label}
              sx={{ maxWidth: '100%' }}
            />
          ) : null}
        </Stack>
      }
    >
      <Stack spacing={{ xs: 2, md: 2.5 }}>
        {actions.isAnsweringRevision ? (
          <RevisionContextBanner
            order={order}
            revision={openRevision}
            onRespond={tab === TAB.DELIVERY ? undefined : () => setTab(TAB.DELIVERY)}
          />
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
              {tab === TAB.DELIVERY ? deliveryPanel : null}
              {tab === TAB.BRIEF ? briefPanel : null}
              {tab === TAB.TIMELINE ? timelinePanel : null}
              {tab === TAB.EARNINGS ? <EarningsCard order={order} payment={payment} /> : null}
            </Box>
          </Box>

          {/* Side meta: who this is for and what was agreed, on screen at `lg`
              whichever section is open. Below `lg` it follows the panel rather
              than pushing the composer off the first screenful. */}
          <Stack spacing={{ xs: 2, md: 2.5 }} sx={{ minWidth: 0 }}>
            <BuyerCard buyer={buyer} />

            <Card>
              <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                <Typography variant="subtitle2" component="h2" sx={{ mb: 1.5 }}>
                  At a glance
                </Typography>
                <Typography variant="overline" color="text.secondary">
                  Net to you
                </Typography>
                <Typography
                  variant="h5"
                  component="p"
                  sx={{ fontWeight: 800, color: 'success.dark', fontVariantNumeric: 'tabular-nums' }}
                >
                  {formatCurrency(order.creatorEarnings, order.currency)}
                </Typography>
                <Divider sx={{ my: 2 }} />
                <KeyValueList
                  dense
                  labelWidth={120}
                  items={[
                    { label: 'Status', value: <StatusChip status={order.status} size="sm" tooltip /> },
                    {
                      label: 'Delivery due',
                      value: (
                        <Typography variant="body2" sx={{ fontWeight: 500, color: due.tone }}>
                          {due.date}
                        </Typography>
                      ),
                    },
                    { label: 'Revisions', value: revisionSummary.label },
                    { label: 'Versions sent', value: formatNumber(deliveries.length) },
                    { label: 'Ordered on', value: formatDate(order.createdAt) },
                  ]}
                />

                {progress.text ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    {progress.text}
                  </Typography>
                ) : null}
              </CardContent>
            </Card>
          </Stack>
        </Box>
      </Stack>

      {/* The one action on this screen has to be reachable with a thumb without
          hunting for it (§11). Mobile only — on desktop the composer's own
          button is already on screen. */}
      {actions.canDeliver ? (
        <StickyActionBar mobileOnly sx={{ mx: { xs: -2, sm: -3 }, mt: 2 }}>
          <Button
            onClick={() => {
              if (tab !== TAB.DELIVERY) {
                setTab(TAB.DELIVERY)
                return
              }
              confirmAndSubmit()
            }}
            variant="gradient"
            disabled={tab === TAB.DELIVERY && !composer.canSubmit}
            sx={{ flexGrow: 1 }}
            startIcon={<Icon icon="solar:box-linear" width={18} aria-hidden="true" />}
          >
            {tab === TAB.DELIVERY
              ? composer.isBusy
                ? 'Sending…'
                : 'Submit delivery'
              : 'Go to delivery'}
          </Button>
        </StickyActionBar>
      ) : null}
    </DashboardPage>
  )
}
