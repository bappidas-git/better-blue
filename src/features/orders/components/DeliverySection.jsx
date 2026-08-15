import { useMemo, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import MediaLightbox from '@/components/data-display/MediaLightbox'
import EmptyState from '@/components/feedback/EmptyState'
import { ORDER_STATUS } from '@/constants/statuses'
import DeliveryVersion from '@/features/orders/components/DeliveryVersion'
import ReviewActionsCard from '@/features/orders/components/ReviewActionsCard'
import { formatFileSize } from '@/features/orders/utils/orderDisplay'
import { MEDIA_TYPE } from '@/services/uploadService'
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
// The section owns its lightbox and nothing else. The two decisions open
// dialogs the *page* holds, because the mobile action bar has to be able to open
// the same two from outside this section (§11), and the page is what refetches
// after either of them lands.

/** Flattens every version's files into one lightbox reel, newest version first. */
function buildMediaItems(deliveries) {
  return deliveries.flatMap((delivery) =>
    (delivery.files ?? []).map((file) => ({
      id: file.id,
      type: file.mediaType === MEDIA_TYPE.VIDEO ? 'video' : 'image',
      src: file.url,
      poster: file.thumbnailUrl,
      alt: `${file.name} — version ${delivery.version} of this delivery`,
      caption: (
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <Box component="span">
            {file.name} · {file.mediaType === MEDIA_TYPE.VIDEO ? 'Video' : 'Image'} ·{' '}
            {formatFileSize(file.sizeKb)}
          </Box>
          {/* MOCK-UPLOAD: `files[].url` is a placeholder image URL (00 §15), so a
              browser opens it rather than saving it. The Laravel backend returns
              a signed download URL here and the link starts behaving like one. */}
          <Link
            href={file.url}
            download={file.name}
            target="_blank"
            rel="noopener noreferrer"
            underline="hover"
            sx={{ fontWeight: 600 }}
          >
            Download
          </Link>
        </Stack>
      ),
    }))
  )
}

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
  const [lightboxIndex, setLightboxIndex] = useState(null)

  const items = useMemo(() => buildMediaItems(deliveries), [deliveries])

  // A version's file index has to become an index into the flattened reel.
  const offsets = useMemo(() => {
    let running = 0
    return deliveries.map((delivery) => {
      const start = running
      running += delivery.files?.length ?? 0
      return start
    })
  }, [deliveries])

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

      <Stack component="ul" spacing={{ xs: 2, md: 2.5 }} sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {deliveries.map((delivery, index) => (
          <DeliveryVersion
            key={delivery.id}
            delivery={delivery}
            onOpenFile={(fileIndex) => setLightboxIndex(offsets[index] + fileIndex)}
          />
        ))}
      </Stack>

      <MediaLightbox
        open={lightboxIndex !== null}
        items={items}
        defaultIndex={lightboxIndex ?? 0}
        onClose={() => setLightboxIndex(null)}
        title={`Deliverables — ${order?.title ?? 'this order'}`}
      />
    </Stack>
  )
}
