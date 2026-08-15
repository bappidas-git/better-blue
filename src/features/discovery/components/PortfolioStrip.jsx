import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import { motion } from 'framer-motion'

import { imageUrl } from '@/constants/images'
import { durations, easing } from '@/theme/motionTokens'

// The three published samples along the bottom of a creator card — the fastest
// answer to "can this person shoot what I need?".
//
// The thumbnails arrive after the card does (`creatorProfileService
// .listPortfolioPreviews`), so the strip owns a skeleton of its own and holds
// the exact height the real one takes: the grid never reflows when they land.

/** Placeholder tiles while the batch is in flight — the usual published count. */
const PLACEHOLDER_COUNT = 3

const THUMB_WIDTH = 240
const THUMB_HEIGHT = 180

/**
 * Variants react to the card's `rest`/`hover` state, which framer propagates
 * down from the `CreatorCard` wrapper. Transform and opacity only (00 §7), and
 * `<MotionConfig reducedMotion="user">` in the app shell turns the movement off
 * for anyone who asked for that.
 */
const stripVariants = {
  rest: { transition: { staggerChildren: 0.04, staggerDirection: -1 } },
  hover: { transition: { staggerChildren: 0.04 } },
}

const thumbVariants = {
  rest: { y: 0, opacity: 0.86 },
  hover: {
    y: -4,
    opacity: 1,
    transition: { duration: durations.fast / 1000, ease: easing },
  },
}

const tileSx = {
  flex: 1,
  minWidth: 0,
  aspectRatio: '4 / 3',
  borderRadius: 1.5,
  overflow: 'hidden',
  bgcolor: 'background.default',
}

/**
 * @param {object} props
 * @param {object[]} [props.items] published portfolio items (max three are shown)
 * @param {boolean} [props.isLoading=false] the preview batch is still in flight
 */
export default function PortfolioStrip({ items, isLoading = false }) {
  const samples = (items ?? []).slice(0, PLACEHOLDER_COUNT)

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', gap: 0.75 }} aria-hidden="true">
        {Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
          <Skeleton key={index} variant="rounded" sx={[tileSx, { height: 'auto' }]} />
        ))}
      </Box>
    )
  }

  if (samples.length === 0) return null

  return (
    <Box
      component={motion.div}
      variants={stripVariants}
      // Decorative: the card's link already announces who this is and what they
      // charge, and every sample is described on the profile it links to.
      aria-hidden="true"
      sx={{ display: 'flex', gap: 0.75 }}
    >
      {samples.map((item) => (
        <Box
          key={item.id}
          component={motion.div}
          variants={thumbVariants}
          sx={tileSx}
        >
          <Box
            component="img"
            src={item.thumbnailUrl || imageUrl(item.id, THUMB_WIDTH, THUMB_HEIGHT)}
            width={THUMB_WIDTH}
            height={THUMB_HEIGHT}
            alt=""
            loading="lazy"
            decoding="async"
            sx={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </Box>
      ))}
    </Box>
  )
}
