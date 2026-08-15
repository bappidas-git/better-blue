import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import LinearProgress from '@mui/material/LinearProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { visuallyHidden } from '@mui/utils'

import RatingStars from '@/components/data-display/RatingStars'
import { RATING_SCALE } from '@/services'
import { formatNumber } from '@/utils/formatters'

// The rating at a glance: the average large enough to read from the scroll
// position, and the 5→1 distribution that tells a buyer whether a 4.6 is
// "consistently good" or "mostly great with two bad days".

/** Spelled-out ratings for the text equivalent of each bar. */
const RATING_WORDS = Object.freeze({
  5: 'five-star',
  4: 'four-star',
  3: 'three-star',
  2: 'two-star',
  1: 'one-star',
})

/**
 * @param {object} props
 * @param {{total: number, average: number, distribution: Object<number, number>}} props.breakdown
 *   the result of `reviewService.getBreakdown`
 */
export default function ReviewsSummary({ breakdown }) {
  const total = Number(breakdown?.total) || 0
  const average = Number(breakdown?.average) || 0
  const distribution = breakdown?.distribution ?? {}

  return (
    <Card variant="outlined" sx={{ p: { xs: 2.5, md: 3 } }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={{ xs: 3, sm: 4 }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
      >
        <Stack spacing={0.5} sx={{ flexShrink: 0, minWidth: { sm: 160 } }}>
          <Typography variant="h2" component="p" sx={{ lineHeight: 1 }}>
            {average.toFixed(1)}
          </Typography>
          <RatingStars value={average} size="sm" showValue={false} />
          <Typography variant="body2" color="text.secondary">
            {formatNumber(total)} {total === 1 ? 'review' : 'reviews'}
          </Typography>
        </Stack>

        <Box sx={{ width: '100%', minWidth: 0 }}>
          {RATING_SCALE.map((rating) => {
            const count = Number(distribution[rating]) || 0
            const share = total > 0 ? (count / total) * 100 : 0
            const sentence = `${formatNumber(count)} ${RATING_WORDS[rating]} ${
              count === 1 ? 'review' : 'reviews'
            }`

            return (
              <Stack key={rating} direction="row" spacing={1.5} alignItems="center" sx={{ py: 0.4 }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  aria-hidden="true"
                  sx={{ width: 12, textAlign: 'right', flexShrink: 0 }}
                >
                  {rating}
                </Typography>

                {/* The bar is decorative — the sentence beside it is the value,
                    and it is what assistive tech announces. */}
                <LinearProgress
                  aria-hidden="true"
                  variant="determinate"
                  value={share}
                  sx={{
                    flexGrow: 1,
                    height: 8,
                    borderRadius: 999,
                    bgcolor: 'background.default',
                    '& .MuiLinearProgress-bar': { borderRadius: 999, bgcolor: 'warning.main' },
                  }}
                />

                <Typography
                  variant="body2"
                  color="text.secondary"
                  aria-hidden="true"
                  sx={{ width: 32, textAlign: 'right', flexShrink: 0 }}
                >
                  {formatNumber(count)}
                </Typography>
                <Box component="span" sx={visuallyHidden}>
                  {sentence}
                </Box>
              </Stack>
            )
          })}
        </Box>
      </Stack>
    </Card>
  )
}
