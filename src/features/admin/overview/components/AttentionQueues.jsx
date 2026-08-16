import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

import EmptyState from '@/components/feedback/EmptyState'
import ErrorState from '@/components/feedback/ErrorState'
import ListSkeleton from '@/components/feedback/skeletons/ListSkeleton'
import StatusChip from '@/components/data-display/StatusChip'
import { ORDER_STATUS } from '@/constants/statuses'
import { AgeBadge, EntityRefChip } from '@/features/admin/shared'
import { categoryLabel } from '@/features/disputes/utils/disputeDisplay'
import { paths } from '@/routes/paths'
import { formatDate, formatNumber } from '@/utils/formatters'

// "What has been waiting longest" — three queues, three rows each.
//
// The KPI band above says *how many*; this section says *which ones*, oldest
// first, because the oldest item in a queue is the person the platform has kept
// waiting longest. Each row carries an `AgeBadge`, so a card that is merely
// busy looks different from one that is neglected.
//
// Every queue is its own failure boundary and its own empty state, and the
// empty state is **positive**: an empty moderation queue is a good afternoon,
// not missing data (§13).
//
// The "View all" links are comment-gated until the prompt that builds their
// screen — the same rule `navConfig` follows, for the same reason. Moderation
// went live with Prompt 30 and orders with Prompt 31; disputes waits for 33.

/**
 * The order list, opened the way this card reads it: the live states, due
 * soonest first. The card shows three rows and this is where the rest are —
 * landing on an unfiltered list would make the reader redo the filtering the
 * card already did for them.
 */
const ADMIN_ORDERS_BY_DUE_DATE = `${paths.ADMIN_ORDERS}?status=${ORDER_STATUS.IN_PROGRESS}&status=${ORDER_STATUS.REVISION_REQUESTED}&sort=due`

/** Age thresholds per queue, in days. Beyond these the badge turns amber, then red. */
const SLA = Object.freeze({
  disputes: { warnAfterDays: 3, errorAfterDays: 7 },
  moderation: { warnAfterDays: 2, errorAfterDays: 5 },
  orders: { warnAfterDays: 2, errorAfterDays: 5 },
})

/** One queue card: heading, count, rows, and whatever state it is in. */
function QueueCard({ title, icon, description, count, loading, error, onRetry, empty, children }) {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent
        sx={{ p: { xs: 2, md: 2.5 }, flexGrow: 1, display: 'flex', flexDirection: 'column' }}
      >
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.5 }}>
          <Box
            aria-hidden="true"
            sx={{
              flexShrink: 0,
              width: 32,
              height: 32,
              borderRadius: 1.5,
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'primary.surface',
              color: 'primary.main',
            }}
          >
            <Icon icon={icon} width={18} />
          </Box>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="subtitle2" component="h3" noWrap>
              {title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {typeof count === 'number' ? `${formatNumber(count)} shown` : description}
            </Typography>
          </Box>
        </Stack>

        {error ? (
          <ErrorState
            dense
            title="This queue did not load"
            message="The other queues are fine — this card just needs another go."
            error={error}
            onRetry={onRetry}
          />
        ) : loading ? (
          <ListSkeleton rows={3} label={`Loading ${String(title).toLowerCase()}`} />
        ) : (
          (children ?? empty)
        )}
      </CardContent>
    </Card>
  )
}

/** A row: what it is, who it is about, and how long it has been sitting there. */
function QueueRow({ primary, secondary, chip, badge, isLast }) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="flex-start"
      sx={{ py: 1.25, borderBottom: isLast ? 0 : 1, borderColor: 'divider' }}
    >
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
          {primary}
        </Typography>
        {secondary ? (
          <Typography variant="caption" color="text.secondary" component="p" noWrap>
            {secondary}
          </Typography>
        ) : null}
        {chip ? <Box sx={{ mt: 0.75 }}>{chip}</Box> : null}
      </Box>
      <Box sx={{ flexShrink: 0, pt: 0.25 }}>{badge}</Box>
    </Stack>
  )
}

/** Positive empty state — nothing waiting is the goal, not a gap in the data. */
function NothingWaiting({ message }) {
  return (
    <EmptyState
      dense
      icon="solar:check-circle-linear"
      title="Nothing needs attention"
      description={message}
      sx={{ py: 3 }}
    />
  )
}

/** `portfolio_item` → `Portfolio item`, for the moderation queue's subject line. */
function subjectLabel(subjectType) {
  if (!subjectType) return 'Content'
  const text = String(subjectType).replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * @param {object} props
 * @param {import('@/services/adminService').AdminAttentionQueues} [props.queues]
 * @param {boolean} [props.loading=false]
 * @param {() => void} [props.onRetry] refetch all three queues
 */
export default function AttentionQueues({ queues, loading = false, onRetry }) {
  const errors = queues?.errors ?? {}
  const disputes = queues?.oldestOpenDisputes ?? []
  const moderation = queues?.oldestModerationItems ?? []
  const orders = queues?.overdueOrders ?? []

  return (
    <Box
      sx={{
        display: 'grid',
        gap: { xs: 2, md: 2.5 },
        gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
      }}
    >
      <QueueCard
        title="Oldest open disputes"
        icon="solar:shield-warning-linear"
        description="Cases waiting on a decision"
        count={loading || errors.disputes ? undefined : disputes.length}
        loading={loading}
        error={errors.disputes}
        onRetry={onRetry}
        empty={<NothingWaiting message="No dispute is waiting on Trust & Safety right now." />}
      >
        {disputes.length > 0
          ? disputes.map((dispute, index) => (
              <QueueRow
                key={dispute.id}
                primary={dispute.orderTitle ?? 'Order under dispute'}
                secondary={categoryLabel(dispute.category)}
                chip={
                  <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                    <StatusChip status={dispute.status} size="sm" showDot={false} />
                    <EntityRefChip type="order" id={dispute.orderId} label={dispute.orderId} />
                  </Stack>
                }
                badge={<AgeBadge date={dispute.createdAt} noun="Raised" {...SLA.disputes} />}
                isLast={index === disputes.length - 1}
              />
            ))
          : null}
        {/* TODO(Prompt 33): a "View all disputes" link to `paths.ADMIN_DISPUTES`. */}
      </QueueCard>

      <QueueCard
        title="Moderation waiting"
        icon="tabler:shield-check"
        description="Content awaiting review"
        count={loading || errors.moderation ? undefined : moderation.length}
        loading={loading}
        error={errors.moderation}
        onRetry={onRetry}
        empty={<NothingWaiting message="The review queue is clear. Nothing is waiting on us." />}
      >
        {moderation.length > 0
          ? moderation.map((review, index) => (
              <QueueRow
                key={review.id}
                primary={`${subjectLabel(review.subjectType)} from ${review.creatorName ?? 'a creator'}`}
                secondary="Waiting for a reviewer"
                chip={
                  <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                    <StatusChip status={review.status} size="sm" showDot={false} />
                    <EntityRefChip
                      type={review.subjectType}
                      id={review.subjectId}
                      label={review.subjectId}
                    />
                  </Stack>
                }
                badge={<AgeBadge date={review.submittedAt} noun="Submitted" {...SLA.moderation} />}
                isLast={index === moderation.length - 1}
              />
            ))
          : null}
        {/* Prompt 30 built the console, so this link is live. The other two
            stay comments until their screens land. */}
        <Box sx={{ mt: 'auto', pt: 1.5 }}>
          <Link
            component={RouterLink}
            to={paths.ADMIN_MODERATION}
            variant="body2"
            underline="hover"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
          >
            Open the review queue
            <Icon icon="tabler:arrow-right" width={16} aria-hidden="true" />
          </Link>
        </Box>
      </QueueCard>

      <QueueCard
        title="Overdue orders"
        icon="solar:clock-circle-linear"
        description="Past their delivery date"
        count={loading || errors.orders ? undefined : orders.length}
        loading={loading}
        error={errors.orders}
        onRetry={onRetry}
        empty={<NothingWaiting message="Every order in flight is still inside its delivery date." />}
      >
        {orders.length > 0
          ? orders.map((order, index) => (
              <QueueRow
                key={order.id}
                primary={order.title}
                secondary={`Due ${formatDate(order.deliveryDueAt)}`}
                chip={
                  <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                    <StatusChip status={order.status} size="sm" showDot={false} />
                    <EntityRefChip type="order" id={order.id} label={order.id} />
                  </Stack>
                }
                badge={<AgeBadge date={order.deliveryDueAt} overdue noun="Delivery" {...SLA.orders} />}
                isLast={index === orders.length - 1}
              />
            ))
          : null}
        {/* Prompt 31 built the order console, so this link is live. The
            disputes one stays a comment until Prompt 33. */}
        <Box sx={{ mt: 'auto', pt: 1.5 }}>
          <Link
            component={RouterLink}
            to={ADMIN_ORDERS_BY_DUE_DATE}
            variant="body2"
            underline="hover"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
          >
            Open the order list
            <Icon icon="tabler:arrow-right" width={16} aria-hidden="true" />
          </Link>
        </Box>
      </QueueCard>
    </Box>
  )
}
