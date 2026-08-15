import { useMemo, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import MediaLightbox from '@/components/data-display/MediaLightbox'
import StatusChip from '@/components/data-display/StatusChip'
import { DELIVERY_STATUS } from '@/constants/statuses'
import DeliveryFilesGrid from '@/features/deliveries/components/DeliveryFilesGrid'
import { formatFileSize } from '@/features/orders/utils/orderDisplay'
import { MEDIA_TYPE } from '@/services/uploadService'
import { formatDateTime, formatNumber } from '@/utils/formatters'

// Every version of a delivery, newest first — the record both sides of an order
// read.
//
// Versions are records, not drafts: asking for changes closes a version and the
// answer arrives as a new one (00 §9), so nothing here is ever edited or
// removed. The buyer sees what they have received; the creator sees what they
// have sent, and what came back.
//
// The list owns the lightbox rather than each card, because a lightbox opened
// on version 2's third file should page through version 1's as well — the
// files of an order are one reel, and the flattening that makes that work has
// to happen where the whole list is known.

/** Flattens every version's files into one lightbox reel, in list order. */
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

/** What the buyer did with a version, read back under it. */
function VersionResponse({ delivery, revision }) {
  const isAccepted = delivery?.status === DELIVERY_STATUS.ACCEPTED
  const isSentBack = delivery?.status === DELIVERY_STATUS.REVISION_REQUESTED

  if (!isAccepted && !isSentBack) return null

  return (
    <Box
      sx={{
        mt: 2,
        p: 2,
        borderRadius: 2,
        bgcolor: 'background.default',
        border: 1,
        borderColor: isAccepted ? 'success.light' : 'warning.light',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: revision?.notes ? 1 : 0 }}>
        <Box
          aria-hidden="true"
          sx={{ display: 'flex', color: isAccepted ? 'success.dark' : 'warning.dark' }}
        >
          <Icon icon={isAccepted ? 'tabler:circle-check' : 'solar:restart-linear'} width={18} />
        </Box>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {isAccepted ? 'Accepted by the buyer' : 'The buyer asked for changes'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {formatDateTime(delivery?.respondedAt)}
        </Typography>
      </Stack>

      {isSentBack && revision?.notes ? (
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
          {revision.notes}
        </Typography>
      ) : null}
    </Box>
  )
}

/** One delivered version: what was said, what was handed over, what came back. */
function DeliveryVersion({ delivery, revision, showResponse, onOpenFile }) {
  const files = delivery?.files ?? []

  return (
    <Card component="li" sx={{ listStyle: 'none' }}>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ mb: 1.5 }}
        >
          <Typography variant="subtitle2" component="h3">
            Version {formatNumber(delivery?.version ?? 1)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {formatDateTime(delivery?.submittedAt)}
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <StatusChip status={delivery?.status} size="sm" tooltip />
        </Stack>

        {delivery?.message ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ whiteSpace: 'pre-line', mb: files.length > 0 ? 2 : 0 }}
          >
            {delivery.message}
          </Typography>
        ) : null}

        <DeliveryFilesGrid
          files={files}
          label={`Files in version ${delivery?.version ?? 1}`}
          onOpenFile={onOpenFile}
          emptyText="No files were attached to this version."
        />

        {showResponse ? <VersionResponse delivery={delivery} revision={revision} /> : null}
      </CardContent>
    </Card>
  )
}

/**
 * @param {object} props
 * @param {object[]} [props.deliveries] every version, newest first
 * @param {object[]} [props.revisions] change requests, matched to the version
 *   they closed — only read when `showResponses` is set
 * @param {boolean} [props.showResponses=false] render what the buyer did with
 *   each version underneath it. Off by default: the buyer's own view says that
 *   above the list instead (Prompt 20), and this is the creator's answer to
 *   "what came back?" (Prompt 24 §4.4)
 * @param {string} [props.lightboxTitle] accessible title for the media viewer
 */
export default function DeliveryVersionList({
  deliveries = [],
  revisions = [],
  showResponses = false,
  lightboxTitle = 'Deliverables',
}) {
  const [lightboxIndex, setLightboxIndex] = useState(null)

  const items = useMemo(() => buildMediaItems(deliveries), [deliveries])

  // A version's own file index has to become an index into the flattened reel.
  const offsets = useMemo(() => {
    let running = 0
    return deliveries.map((delivery) => {
      const start = running
      running += delivery.files?.length ?? 0
      return start
    })
  }, [deliveries])

  const revisionByDeliveryId = useMemo(
    () => new Map(revisions.map((revision) => [revision.deliveryId, revision])),
    [revisions]
  )

  if (deliveries.length === 0) return null

  return (
    <>
      <Stack component="ul" spacing={{ xs: 2, md: 2.5 }} sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {deliveries.map((delivery, index) => (
          <DeliveryVersion
            key={delivery.id}
            delivery={delivery}
            revision={revisionByDeliveryId.get(delivery.id)}
            showResponse={showResponses}
            onOpenFile={(fileIndex) => setLightboxIndex(offsets[index] + fileIndex)}
          />
        ))}
      </Stack>

      <MediaLightbox
        open={lightboxIndex !== null}
        items={items}
        defaultIndex={lightboxIndex ?? 0}
        onClose={() => setLightboxIndex(null)}
        title={lightboxTitle}
      />
    </>
  )
}
