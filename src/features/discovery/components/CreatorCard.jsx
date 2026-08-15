import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { motion } from 'framer-motion'
import { Link as RouterLink } from 'react-router-dom'

import RatingStars from '@/components/data-display/RatingStars'
import UserAvatar from '@/components/data-display/UserAvatar'
import { paths } from '@/routes/paths'
import { durations, easing } from '@/theme/motionTokens'
import { formatNumber, formatCurrency } from '@/utils/formatters'

import PortfolioStrip from './PortfolioStrip'

// One storefront in the discovery grid. Premium-minimal: identity, the promise,
// the proof (rating and completed orders), the price, and three samples — in
// that reading order, with nothing boxed or bordered inside the card.

/** Category chips shown before the rest collapse into a "+n". */
const MAX_CATEGORY_CHIPS = 2

/** Hover/focus state the card publishes to `PortfolioStrip` (00 §7). */
const cardVariants = {
  rest: { y: 0 },
  hover: { y: -4, transition: { duration: durations.fast / 1000, ease: easing } },
}

/**
 * The card is a single link, so the whole tile is one tab stop — which means it
 * needs one accessible name carrying everything a sighted person reads at a
 * glance. Screen readers announce this instead of the tile's contents.
 */
function accessibleName(profile, { rating }) {
  const parts = [profile.displayName]

  if (profile.verified) parts.push('verified creator')
  if (profile.tagline) parts.push(profile.tagline)
  if (rating > 0) {
    parts.push(`rated ${rating.toFixed(1)} out of 5 from ${formatNumber(profile.ratingCount)} reviews`)
  } else {
    parts.push('no reviews yet')
  }
  parts.push(
    `from ${formatCurrency(profile.startingPrice, profile.currency, { hideDecimals: true })}`
  )

  return `${parts.join(', ')}. View profile.`
}

/**
 * The loading placeholder for this exact card, block for block — avatar, name,
 * two tagline lines, chips, rating row, sample strip, price. It lives beside
 * the card rather than in the shared skeleton set so the two can only ever be
 * changed together, and the grid does not resettle when the data lands (00 §12).
 */
export function CreatorCardSkeleton() {
  return (
    <Card
      variant="outlined"
      role="status"
      aria-busy="true"
      aria-label="Loading creator"
      sx={{ height: '100%', p: 2.5 }}
    >
      <Stack spacing={1.75}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Skeleton variant="circular" width={56} height={56} />
          <Box sx={{ flexGrow: 1 }}>
            <Skeleton variant="text" width="65%" sx={{ fontSize: '1rem' }} />
            <Skeleton variant="text" width="45%" sx={{ fontSize: '0.75rem' }} />
          </Box>
        </Stack>

        <Box>
          <Skeleton variant="text" width="100%" sx={{ fontSize: '0.875rem' }} />
          <Skeleton variant="text" width="70%" sx={{ fontSize: '0.875rem' }} />
        </Box>

        <Stack direction="row" spacing={0.75}>
          <Skeleton variant="rounded" width={80} height={24} sx={{ borderRadius: 999 }} />
          <Skeleton variant="rounded" width={96} height={24} sx={{ borderRadius: 999 }} />
        </Stack>

        <Skeleton variant="text" width="55%" sx={{ fontSize: '0.875rem' }} />

        <PortfolioStrip isLoading />

        <Skeleton variant="text" width="40%" sx={{ fontSize: '0.875rem' }} />
      </Stack>
    </Card>
  )
}

/**
 * @param {object} props
 * @param {object} props.profile a `creatorProfiles` record
 * @param {Object<string, string>} [props.categoryNames] category id → display name
 * @param {object[]} [props.preview] published portfolio items for the strip
 * @param {boolean} [props.isPreviewLoading=false] the preview batch is in flight
 */
export default function CreatorCard({
  profile,
  categoryNames = {},
  preview,
  isPreviewLoading = false,
}) {
  const rating = Number(profile.ratingAvg) || 0
  const categoryIds = profile.categories ?? []
  const chips = categoryIds
    .slice(0, MAX_CATEGORY_CHIPS)
    .map((categoryId) => categoryNames[categoryId] ?? categoryId)
  const overflow = categoryIds.length - chips.length

  return (
    <Box
      component={motion.div}
      variants={cardVariants}
      initial="rest"
      animate="rest"
      whileHover="hover"
      // Keyboard users get the same reveal: the strip lifts when the card's link
      // takes focus, not only under a pointer.
      whileFocus="hover"
      sx={{ height: '100%', display: 'flex' }}
    >
      <Card
        variant="outlined"
        sx={{
          height: '100%',
          width: '100%',
          transition: (theme) =>
            theme.transitions.create(['border-color', 'box-shadow'], {
              duration: durations.fast,
            }),
          '&:hover, &:focus-within': {
            borderColor: 'primary.light',
            boxShadow: (theme) => theme.customShadows.z2,
          },
        }}
      >
        <CardActionArea
          component={RouterLink}
          to={paths.creatorProfile(profile.id)}
          // The profile's back control reads this: discovery keeps its filters,
          // sort, and page in the query string, so the only way back to *this*
          // result set is the history entry. Nothing else about discovery's URL
          // behaviour changes (Prompt 13 §17).
          state={{ fromDiscovery: true }}
          aria-label={accessibleName(profile, { rating })}
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            justifyContent: 'flex-start',
            p: 2.5,
          }}
        >
          <Stack spacing={1.75} sx={{ width: '100%', height: '100%' }}>
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <UserAvatar name={profile.displayName} size="lg" />

              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Typography variant="subtitle1" component="h3" noWrap sx={{ fontWeight: 700 }}>
                    {profile.displayName}
                  </Typography>
                  {profile.verified ? (
                    <Box
                      sx={{ display: 'flex', color: 'primary.main', flexShrink: 0 }}
                      role="img"
                      aria-label="Verified creator"
                    >
                      <Icon icon="tabler:rosette-discount-check-filled" width={18} />
                    </Box>
                  ) : null}
                </Stack>

                <Typography variant="caption" color="text.secondary" noWrap component="p">
                  {profile.location}
                </Typography>
              </Box>
            </Stack>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 2,
                overflow: 'hidden',
                // Two lines of space whether or not the tagline fills them, so
                // cards in a row keep their internal rhythm aligned.
                minHeight: (theme) => `calc(${theme.typography.body2.lineHeight} * 2em)`,
              }}
            >
              {profile.tagline}
            </Typography>

            {chips.length > 0 ? (
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                {chips.map((name) => (
                  <Chip key={name} label={name} size="small" variant="outlined" />
                ))}
                {overflow > 0 ? (
                  <Chip label={`+${overflow}`} size="small" variant="outlined" />
                ) : null}
              </Stack>
            ) : null}

            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
              {rating > 0 ? (
                <RatingStars value={rating} count={profile.ratingCount} size="sm" />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  New creator
                </Typography>
              )}
              {profile.completedOrders > 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {formatNumber(profile.completedOrders)} orders
                </Typography>
              ) : null}
            </Stack>

            <Box sx={{ mt: 'auto', pt: 0.5 }}>
              <PortfolioStrip items={preview} isLoading={isPreviewLoading} />
            </Box>

            <Typography variant="body2" color="text.secondary">
              From{' '}
              <Box component="span" sx={{ color: 'text.primary', fontWeight: 700 }}>
                {formatCurrency(profile.startingPrice, profile.currency, { hideDecimals: true })}
              </Box>
            </Typography>
          </Stack>
        </CardActionArea>
      </Card>
    </Box>
  )
}
