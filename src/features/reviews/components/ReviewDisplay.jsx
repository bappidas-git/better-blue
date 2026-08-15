import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import RatingStars from '@/components/data-display/RatingStars'
import { formatDate } from '@/utils/formatters'

// A review the buyer has already left, read back to them.
//
// Read-only in the strongest sense: there is no edit affordance because there is
// no edit endpoint (contract §6.18). Showing one and refusing it later would be
// worse than never offering it, so the card simply states what was published and
// when.

/**
 * @param {object} props
 * @param {object} props.review the review record
 * @param {string} [props.creatorName] who it was left for
 * @param {boolean} [props.dense=false] drop the card chrome — for use inside another card
 */
export default function ReviewDisplay({ review, creatorName, dense = false }) {
  if (!review) return null

  const body = (
    <>
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1 }}>
        <Box aria-hidden="true" sx={{ color: 'text.secondary', display: 'flex' }}>
          <Icon icon="solar:star-linear" width={18} />
        </Box>
        <Typography variant="subtitle2" component="h2">
          {creatorName ? `Your review of ${creatorName}` : 'Your review'}
        </Typography>
      </Stack>

      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
        <RatingStars value={Number(review.rating) || 0} size="sm" precision={1} />
        <Typography variant="caption" color="text.secondary">
          Published {formatDate(review.createdAt)}
        </Typography>
      </Stack>

      {review.comment ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, whiteSpace: 'pre-line' }}>
          {review.comment}
        </Typography>
      ) : null}
    </>
  )

  if (dense) return <Box>{body}</Box>

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>{body}</CardContent>
    </Card>
  )
}
