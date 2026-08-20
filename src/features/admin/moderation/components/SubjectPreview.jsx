import { useEffect, useMemo, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import MediaLightbox from '@/components/data-display/MediaLightbox'
import { MEDIA_TYPE } from '@/services/uploadService'
import { MODERATION_SUBJECT } from '@/constants/statuses'
import { formatNumber } from '@/utils/formatters'

// The content, at the size a decision can be made from — Prompt 30 §4.3.
//
// This is the loudest thing on the review screen and it should be: everything
// else on the page is context for what is in this box. It is a viewer, not a
// gallery — one item at a time, fit to the frame or shown at full size, with
// the deliverable's other files listed beside it.
//
// MOCK-MEDIA: seeded media is placeholder photography for every record, video
// ones included — there is no video file behind a `mediaType: 'video'` (contract
// §5.2). A `<video>` pointed at it renders an empty player, so items marked as
// video are previewed as stills and labelled. Real uploads change this line and
// nothing else.

/** How the image sits in the frame. */
const ZOOM = Object.freeze({ FIT: 'fit', ACTUAL: 'actual' })

/** Frame height. Tall enough to judge framing and lighting; short enough to scroll past. */
const FRAME_HEIGHT = { xs: 260, md: 460 }

/** Turns whatever the case is about into a list of previewable media. */
function toMediaItems(subject, subjectType) {
  if (!subject) return []

  if (subjectType === MODERATION_SUBJECT.DELIVERY) {
    return (subject.files ?? []).map((file) => ({
      id: file.id,
      src: file.url,
      thumbnailUrl: file.thumbnailUrl ?? file.url,
      name: file.name,
      alt: file.name,
      isVideo: file.mediaType === MEDIA_TYPE.VIDEO,
      sizeKb: file.sizeKb,
      restricted: Boolean(file.restricted),
    }))
  }

  return [
    {
      id: subject.id,
      src: subject.mediaUrl,
      thumbnailUrl: subject.thumbnailUrl ?? subject.mediaUrl,
      name: subject.title,
      alt: subject.title,
      isVideo: subject.mediaType === MEDIA_TYPE.VIDEO,
    },
  ]
}

/** Filename and a reason, for media that is missing or refuses to load (§13). */
function BrokenMedia({ name }) {
  return (
    <Stack alignItems="center" spacing={1} sx={{ color: 'common.white', px: 3, py: 6 }}>
      <Icon icon="solar:gallery-remove-linear" width={32} aria-hidden="true" />
      <Typography variant="body2" align="center">
        This file could not be displayed.
      </Typography>
      <Typography variant="caption" align="center" sx={{ opacity: 0.8, wordBreak: 'break-all' }}>
        {name ?? 'Unnamed file'}
      </Typography>
    </Stack>
  )
}

/**
 * @param {object} props
 * @param {object|null} props.subject the `portfolioItems` or `deliveries` record
 * @param {string} props.subjectType a `MODERATION_SUBJECT` value
 * @param {string} props.title what the case is about, for the viewer's label
 */
export default function SubjectPreview({ subject, subjectType, title }) {
  const items = useMemo(() => toMediaItems(subject, subjectType), [subject, subjectType])

  const [index, setIndex] = useState(0)
  const [zoom, setZoom] = useState(ZOOM.FIT)
  const [broken, setBroken] = useState({})
  const [lightboxOpen, setLightboxOpen] = useState(false)

  // A different case means a different file list; start at the first one.
  useEffect(() => {
    setIndex(0)
    setZoom(ZOOM.FIT)
    setBroken({})
  }, [subject?.id])

  const active = items[Math.min(index, Math.max(items.length - 1, 0))]
  const isBroken = active ? Boolean(broken[active.id]) : false

  const lightboxItems = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        // See MOCK-MEDIA above: everything opens as a still in the mock era.
        type: 'image',
        src: item.src,
        alt: item.alt,
        caption: item.name,
      })),
    [items]
  )

  if (items.length === 0) {
    return (
      <Card
        component="section"
        aria-labelledby="review-preview-heading"
        sx={{ p: { xs: 2.5, md: 3 } }}
      >
        <Typography id="review-preview-heading" variant="subtitle2" component="h2">
          Content preview
        </Typography>
        <Stack alignItems="center" spacing={1} sx={{ py: 6, color: 'text.secondary' }}>
          <Icon icon="solar:gallery-remove-linear" width={28} aria-hidden="true" />
          <Typography variant="body2">
            There is nothing to preview — the content this case refers to could not be loaded.
          </Typography>
          <Typography variant="caption">
            Decide from the metadata and the history, or come back once it is reachable.
          </Typography>
        </Stack>
      </Card>
    )
  }

  return (
    <Card component="section" aria-labelledby="review-preview-heading">
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ px: { xs: 2, md: 2.5 }, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <Typography
          id="review-preview-heading"
          variant="subtitle2"
          component="h2"
          sx={{ flexGrow: 1, minWidth: 0 }}
        >
          Content preview
          {items.length > 1 ? (
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              {index + 1} of {items.length}
            </Typography>
          ) : null}
        </Typography>

        <Button
          size="small"
          onClick={() => setZoom(zoom === ZOOM.FIT ? ZOOM.ACTUAL : ZOOM.FIT)}
          startIcon={
            <Icon
              icon={zoom === ZOOM.FIT ? 'solar:maximize-square-linear' : 'solar:minimize-square-linear'}
              width={16}
              aria-hidden="true"
            />
          }
        >
          {zoom === ZOOM.FIT ? 'Full size' : 'Fit to frame'}
        </Button>

        <Button
          size="small"
          onClick={() => setLightboxOpen(true)}
          startIcon={<Icon icon="solar:full-screen-linear" width={16} aria-hidden="true" />}
        >
          Expand
        </Button>
      </Stack>

      <Box
        sx={{
          position: 'relative',
          display: 'grid',
          placeItems: zoom === ZOOM.FIT ? 'center' : 'start',
          height: FRAME_HEIGHT,
          overflow: zoom === ZOOM.FIT ? 'hidden' : 'auto',
          // Near-black stage — `text.primary` is the light ink on this theme.
          bgcolor: (theme) => alpha(theme.palette.common.black, 0.9),
        }}
      >
        {isBroken || !active?.src ? (
          <BrokenMedia name={active?.name} />
        ) : (
          <Box
            component="img"
            key={active.id}
            src={active.src}
            alt={active.alt ?? 'Submitted content'}
            onError={() => setBroken((previous) => ({ ...previous, [active.id]: true }))}
            sx={
              zoom === ZOOM.FIT
                ? { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }
                : { maxWidth: 'none', display: 'block' }
            }
          />
        )}

        {active?.isVideo ? (
          <Chip
            size="small"
            icon={<Icon icon="tabler:player-play-filled" width={13} aria-hidden="true" />}
            label="Video · still preview"
            sx={{
              position: 'absolute',
              top: 12,
              left: 12,
              bgcolor: 'background.paper',
              fontWeight: 600,
            }}
          />
        ) : null}

        {active?.restricted ? (
          <Chip
            size="small"
            color="warning"
            label="Restricted file"
            sx={{ position: 'absolute', top: 12, right: 12, fontWeight: 600 }}
          />
        ) : null}
      </Box>

      {items.length > 1 ? (
        <Box sx={{ px: { xs: 2, md: 2.5 }, py: 1.5 }}>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
            Files in this delivery
          </Typography>
          <Stack
            component="ul"
            direction="row"
            spacing={1}
            sx={{ listStyle: 'none', m: 0, p: 0, overflowX: 'auto', pb: 0.5 }}
          >
            {items.map((item, itemIndex) => (
              <Box component="li" key={item.id} sx={{ flexShrink: 0 }}>
                <ButtonBase
                  onClick={() => {
                    setIndex(itemIndex)
                    setZoom(ZOOM.FIT)
                  }}
                  aria-label={`Preview ${item.name}`}
                  aria-current={itemIndex === index}
                  sx={{
                    display: 'block',
                    width: 96,
                    borderRadius: 1.5,
                    p: 0.5,
                    border: 2,
                    borderColor: itemIndex === index ? 'primary.main' : 'transparent',
                    textAlign: 'left',
                  }}
                >
                  <Box
                    sx={{
                      width: '100%',
                      aspectRatio: '4 / 3',
                      borderRadius: 1,
                      overflow: 'hidden',
                      bgcolor: 'primary.surface',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    {broken[item.id] || !item.thumbnailUrl ? (
                      <Icon icon="solar:document-linear" width={18} aria-hidden="true" />
                    ) : (
                      <Box
                        component="img"
                        src={item.thumbnailUrl}
                        alt=""
                        loading="lazy"
                        sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    )}
                  </Box>
                  <Typography
                    variant="caption"
                    component="span"
                    sx={{
                      display: 'block',
                      mt: 0.5,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.name}
                  </Typography>
                  {item.sizeKb ? (
                    <Typography variant="caption" color="text.secondary" component="span">
                      {formatNumber(Math.round(item.sizeKb / 1024))} MB
                    </Typography>
                  ) : null}
                </ButtonBase>
              </Box>
            ))}
          </Stack>
        </Box>
      ) : null}

      <MediaLightbox
        open={lightboxOpen}
        items={lightboxItems}
        index={index}
        onIndexChange={setIndex}
        onClose={() => setLightboxOpen(false)}
        title={title ?? 'Content preview'}
      />
    </Card>
  )
}
