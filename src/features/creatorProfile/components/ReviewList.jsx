import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import RatingStars from '@/components/data-display/RatingStars'
import UserAvatar from '@/components/data-display/UserAvatar'
import { formatDate, formatNumber } from '@/utils/formatters'

// The reviews themselves — buyer, rating, date, and what they actually said.
// Five at a time: enough to read a pattern, short enough that the section does
// not bury the rest of the profile.

/** Placeholder cards while the first page resolves. */
const SKELETON_COUNT = 3

/** The business behind a review, falling back gracefully as fields go missing. */
function attribution(buyer) {
  const name = buyer?.name?.trim()
  const company = buyer?.companyName?.trim()

  if (name && company) return { primary: name, secondary: company }
  if (company) return { primary: company, secondary: null }
  if (name) return { primary: name, secondary: null }
  return { primary: 'Verified buyer', secondary: null }
}

function ReviewCard({ review }) {
  const { primary, secondary } = attribution(review.buyer)
  const rating = Number(review.rating) || 0

  return (
    <Card variant="outlined" component="article" sx={{ p: { xs: 2, md: 2.5 } }}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <UserAvatar name={primary} size="md" sx={{ flexShrink: 0 }} />

        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={{ xs: 0.5, sm: 2 }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" component="h3" noWrap>
                {primary}
              </Typography>
              {secondary ? (
                <Typography variant="caption" color="text.secondary" component="p" noWrap>
                  {secondary}
                </Typography>
              ) : null}
            </Box>

            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexShrink: 0 }}>
              <RatingStars value={rating} size="sm" showValue={false} />
              <Typography variant="caption" color="text.secondary" component="time">
                {formatDate(review.createdAt)}
              </Typography>
            </Stack>
          </Stack>

          {review.comment ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
              {review.comment}
            </Typography>
          ) : null}
        </Box>
      </Stack>
    </Card>
  )
}

/**
 * @param {object} props
 * @param {object[]} [props.reviews] the reviews loaded so far, newest first
 * @param {number} [props.total=0] how many the creator has in all
 * @param {boolean} [props.isLoading=false] the first page is in flight
 * @param {boolean} [props.isLoadingMore=false] a "Load more" request is in flight
 * @param {() => void} [props.onLoadMore] shows the next five
 */
export default function ReviewList({
  reviews = [],
  total = 0,
  isLoading = false,
  isLoadingMore = false,
  onLoadMore,
}) {
  if (isLoading) {
    return (
      <Stack spacing={2} role="status" aria-busy="true" aria-label="Loading reviews">
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <Card key={index} variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
            <Stack direction="row" spacing={1.5}>
              <Skeleton variant="circular" width={40} height={40} sx={{ flexShrink: 0 }} />
              <Box sx={{ flexGrow: 1 }}>
                <Skeleton variant="text" width="30%" sx={{ fontSize: '0.875rem' }} />
                <Skeleton variant="text" width="100%" sx={{ fontSize: '0.875rem' }} />
                <Skeleton variant="text" width="80%" sx={{ fontSize: '0.875rem' }} />
              </Box>
            </Stack>
          </Card>
        ))}
      </Stack>
    )
  }

  const remaining = Math.max(total - reviews.length, 0)

  return (
    <Stack spacing={2}>
      {reviews.map((review) => (
        <ReviewCard key={review.id} review={review} />
      ))}

      {remaining > 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 0.5 }}>
          <Button variant="outlined" onClick={onLoadMore} disabled={isLoadingMore}>
            {isLoadingMore
              ? 'Loading…'
              : `Load more reviews (${formatNumber(remaining)} left)`}
          </Button>
        </Box>
      ) : null}
    </Stack>
  )
}
