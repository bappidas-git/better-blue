import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

import StatusChip from '@/components/data-display/StatusChip'
import UserAvatar from '@/components/data-display/UserAvatar'
import { CONTENT_TYPE, MODERATION_SUBJECT, STATUS_META } from '@/constants/statuses'
import { AgeBadge } from '@/features/admin/shared'
import { truncate } from '@/utils/formatters'

// One case in the queue — Prompt 30 §4.2.
//
// Media-forward, because a content review starts with looking at the content:
// the thumbnail is the first thing on the row and the largest thing on it. The
// rest is what a reviewer needs to decide whether to pick this one up —
// who sent it, what kind of thing it is, and how long it has been waiting.
//
// The whole card is one control. A row with a clickable title *and* a clickable
// creator chip inside a clickable card is three tab stops and two ways to open
// the wrong thing; the creator is named here and linked on the review screen,
// where there is room to mean it.

/** Thumbnail box — 4:3, matching the portfolio grid on the public profile. */
const THUMB = { xs: 88, sm: 104 }

/** What the tile shows when there is no image, or the image fails to load. */
function MediaFallback({ label }) {
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={0.5}
      sx={{ width: '100%', height: '100%', color: 'text.secondary', px: 0.5 }}
    >
      <Icon icon="solar:gallery-remove-linear" width={20} aria-hidden="true" />
      <Typography variant="caption" align="center" sx={{ lineHeight: 1.2 }}>
        {label}
      </Typography>
    </Stack>
  )
}

/**
 * @param {object} props
 * @param {object} props.review an entry from `moderationService.listReviewBoard`
 * @param {(id: string) => string} [props.categoryNameFor] category id → name
 * @param {{warnAfterDays: number, errorAfterDays: number}} props.sla age thresholds
 * @param {() => void} props.onOpen open the review screen
 */
export default function QueueCard({ review, categoryNameFor, sla, onOpen }) {
  const isDelivery = review.subjectType === MODERATION_SUBJECT.DELIVERY
  const creatorName = review.creator?.name ?? 'Unknown creator'
  const category = review.categoryId ? categoryNameFor?.(review.categoryId) : null
  const typeLabel = review.contentType
    ? (STATUS_META[review.contentType]?.label ?? review.contentType)
    : null

  return (
    <Card component="li" sx={{ listStyle: 'none' }}>
      <CardActionArea
        onClick={onOpen}
        // The accessible name is the whole row, in the order it is read on
        // screen — a card announced as "open" and nothing else is a dead end.
        aria-label={`Review ${review.subjectTitle}, submitted by ${creatorName}`}
        sx={{ p: { xs: 1.5, sm: 2 } }}
      >
        <Stack direction="row" spacing={{ xs: 1.5, sm: 2 }} alignItems="flex-start">
          <Box
            sx={{
              flexShrink: 0,
              width: THUMB,
              height: 'auto',
              aspectRatio: '4 / 3',
              borderRadius: 1.5,
              overflow: 'hidden',
              bgcolor: 'primary.surface',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            {review.thumbnailUrl ? (
              <Box
                component="img"
                src={review.thumbnailUrl}
                // Decorative here: the card's accessible name already carries
                // the title, and repeating it would announce it twice.
                alt=""
                loading="lazy"
                decoding="async"
                sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <MediaFallback label={isDelivery ? 'No preview' : 'No image'} />
            )}
          </Box>

          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="subtitle2" component="h3" sx={{ lineHeight: 1.35 }}>
              {truncate(review.subjectTitle, 90)}
            </Typography>

            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.25 }}>
              {creatorName}
              {isDelivery && review.fileCount
                ? ` · ${review.fileCount} ${review.fileCount === 1 ? 'file' : 'files'}`
                : ''}
            </Typography>

            <Stack
              direction="row"
              spacing={0.75}
              flexWrap="wrap"
              useFlexGap
              alignItems="center"
              sx={{ mt: 1 }}
            >
              <StatusChip status={review.status} size="sm" />
              {typeLabel ? (
                <Chip
                  size="small"
                  variant="outlined"
                  icon={
                    <Icon
                      icon={
                        review.contentType === CONTENT_TYPE.VIDEO
                          ? 'tabler:player-play'
                          : 'tabler:photo'
                      }
                      width={14}
                      aria-hidden="true"
                    />
                  }
                  label={typeLabel}
                />
              ) : null}
              {category ? <Chip size="small" variant="outlined" label={category} /> : null}
              {isDelivery ? (
                <Chip size="small" variant="outlined" label="Deliverable" />
              ) : null}
            </Stack>
          </Box>

          <Stack spacing={1} alignItems="flex-end" sx={{ flexShrink: 0 }}>
            <AgeBadge date={review.submittedAt} noun="Submitted" {...sla} />
            {review.reviewerId ? (
              <Tooltip title="A reviewer has claimed this case">
                <Box sx={{ display: 'inline-flex' }}>
                  <UserAvatar name={review.reviewerName ?? 'Reviewer'} size="sm" />
                </Box>
              </Tooltip>
            ) : null}
          </Stack>
        </Stack>
      </CardActionArea>
    </Card>
  )
}
