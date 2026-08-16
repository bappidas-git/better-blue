import { useState } from 'react'

import Typography from '@mui/material/Typography'

import MediaLightbox from '@/components/data-display/MediaLightbox'
import DeliveryFilesGrid from '@/features/deliveries/components/DeliveryFilesGrid'
import { MEDIA_TYPE } from '@/services/uploadService'

// The files attached to a dispute — the opening evidence, and the attachments
// on any one message.
//
// The tiles and the viewer are the ones the order surfaces already use
// (`DeliveryFilesGrid` + `MediaLightbox`, 00 §16.4): evidence is the same kind
// of object as a deliverable, and a member who has opened one full-size on this
// platform should not meet a second, different viewer here.

/** Contract file objects (§5.1) → the lightbox's item shape. */
const toMediaItems = (files) =>
  files.map((file) => ({
    id: file.id,
    type: file.mediaType === MEDIA_TYPE.VIDEO ? 'video' : 'image',
    src: file.url,
    poster: file.thumbnailUrl,
    alt: file.name,
    caption: file.name,
  }))

/**
 * @param {object} props
 * @param {object[]} [props.files] contract file objects (§5.1)
 * @param {string} props.label accessible name for the grid, e.g. `Evidence attached to this dispute`
 * @param {string} [props.emptyText] shown instead of the grid when there is nothing attached
 */
export default function EvidenceGrid({ files = [], label, emptyText }) {
  const [openAt, setOpenAt] = useState(null)

  if (files.length === 0) {
    return emptyText ? (
      <Typography variant="body2" color="text.secondary">
        {emptyText}
      </Typography>
    ) : null
  }

  return (
    <>
      <DeliveryFilesGrid files={files} label={label} onOpenFile={(index) => setOpenAt(index)} />

      <MediaLightbox
        open={openAt !== null}
        items={toMediaItems(files)}
        index={openAt ?? 0}
        onIndexChange={setOpenAt}
        onClose={() => setOpenAt(null)}
        title={label}
      />
    </>
  )
}
