import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import EmptyState from '@/components/feedback/EmptyState'
import { ORDER_STATUS } from '@/constants/statuses'
import DeliveryVersionList from '@/features/deliveries/components/DeliveryVersionList'
import ReviewActionsCard from '@/features/orders/components/ReviewActionsCard'
import { formatDateTime } from '@/utils/formatters'

// Everything the creator has handed over, and the decision that sits on top of
// it.
//
// Newest version first, because the version being reviewed is the one that
// matters and the older ones are context. The review card sits *above* the
// files on a delivered order — it is what the buyer came here to do — and
// disappears entirely in every other state, replaced by whatever is true
// instead: a note of what was asked for, or a record of what was accepted.
//
// The versions themselves — cards, file grid, and the lightbox that pages
// across all of them — are `features/deliveries/DeliveryVersionList`, shared
// with the creator's workspace (Prompt 24 §4.2). The two decisions open dialogs
// the *page* holds, because the mobile action bar has to be able to open the
// same two from outside this section (§11), and the page is what refetches
// after either of them lands.

/** The buyer's own words, read back while the creator works on them. */
function RevisionWaitingCard({ revision }) {
  return (
    <Card sx={{ borderColor: 'warning.main', borderWidth: 1, borderStyle: 'solid' }}>
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1 }}>
          <Box aria-hidden="true" sx={{ color: 'warning.dark', display: 'flex' }}>
            <Icon icon="solar:restart-linear" width={20} />
          </Box>
          <Typography variant="subtitle2" component="h2">
            You asked for changes
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: revision?.notes ? 1.5 : 0 }}>
          Sent {formatDateTime(revision?.createdAt)}. The creator will submit a new version — you
          will be notified the moment they do, and nothing leaves escrow before then.
        </Typography>
        {revision?.notes ? (
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: 'background.default',
              border: 1,
              borderColor: 'divider',
            }}
          >
            <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
              {revision.notes}
            </Typography>
          </Box>
        ) : null}
      </CardContent>
    </Card>
  )
}

/**
 * @param {object} props
 * @param {object} props.order the order record
 * @param {object[]} props.deliveries every version, newest first
 * @param {object[]} props.revisions every change request, newest first
 * @param {{name?: string}} [props.creator] who delivered it
 * @param {number} [props.autoAcceptDays] `platformSettings.general.autoAcceptDays`
 * @param {() => void} props.onAccept opens the page's accept confirmation
 * @param {() => void} props.onRequestRevision opens the page's revision form
 * @param {boolean} [props.isBusy] a decision is already in flight
 */
export default function DeliverySection({
  order,
  deliveries = [],
  revisions = [],
  creator,
  autoAcceptDays,
  onAccept,
  onRequestRevision,
  isBusy = false,
}) {
  const isDelivered = order?.status === ORDER_STATUS.DELIVERED
  const isAwaitingRevision = order?.status === ORDER_STATUS.REVISION_REQUESTED
  const isCompleted = order?.status === ORDER_STATUS.COMPLETED
  const acceptedVersion = deliveries.find((delivery) => delivery.respondedAt && isCompleted)

  if (deliveries.length === 0) {
    return (
      <EmptyState
        icon="solar:box-linear"
        title="Nothing delivered yet"
        description={
          order?.status === ORDER_STATUS.PENDING_PAYMENT
            ? 'The creator starts once the order is funded. Delivered files will appear here for you to review.'
            : 'The creator has not submitted anything yet. You will be notified the moment they do, and the files will appear here.'
        }
      />
    )
  }

  return (
    <Stack spacing={{ xs: 2, md: 3 }}>
      {isDelivered ? (
        <ReviewActionsCard
          order={order}
          onAccept={onAccept}
          onRequestChanges={onRequestRevision}
          autoAcceptDays={autoAcceptDays}
          isBusy={isBusy}
        />
      ) : null}

      {isAwaitingRevision ? <RevisionWaitingCard revision={revisions[0]} /> : null}

      {isCompleted && acceptedVersion ? (
        <Card>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 0.75 }}>
              <Box aria-hidden="true" sx={{ color: 'success.dark', display: 'flex' }}>
                <Icon icon="solar:verified-check-linear" width={20} />
              </Box>
              <Typography variant="subtitle2" component="h2">
                You accepted version {acceptedVersion.version}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Accepted {formatDateTime(acceptedVersion.respondedAt)}, which released the escrow to{' '}
              {creator?.name ?? 'the creator'}. The files stay here for your records.
            </Typography>
          </CardContent>
        </Card>
      ) : null}

      <DeliveryVersionList
        deliveries={deliveries}
        lightboxTitle={`Deliverables — ${order?.title ?? 'this order'}`}
      />
    </Stack>
  )
}
