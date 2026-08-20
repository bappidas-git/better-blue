import { useId } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import Link from '@mui/material/Link'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { visuallyHidden } from '@mui/utils'
import { Link as RouterLink } from 'react-router-dom'

import CreatorLevelBadge from '@/components/data-display/CreatorLevelBadge'
import OnlineDot from '@/components/data-display/OnlineDot'
import RatingStars from '@/components/data-display/RatingStars'
import UserAvatar from '@/components/data-display/UserAvatar'
import WorksSlider, { WorksSliderSkeleton } from '@/components/data-display/WorksSlider'
import EmptyState from '@/components/feedback/EmptyState'
import AmbientGlow from '@/components/motion/AmbientGlow'
import FadeInView from '@/components/motion/FadeInView'
import useApiQuery from '@/hooks/useApiQuery'
import { paths } from '@/routes/paths'
import { creatorMetaService } from '@/services'
import { formatCurrency, formatNumber } from '@/utils/formatters'

import formatContribution from '../utils/formatContribution'
import { cardLiftSx, glowBandSx } from '../utils/landingStyles'
import LandingSection from './LandingSection'

// **Top creators** — the marketplace's best storefronts, one per row (V2-05
// §3). Where the old featured grid showed six tiles and a cover photo, this
// shows four people properly: who they are along the top, a scrollable strip of
// what they have actually published through the middle, and the numbers a buyer
// decides on along the bottom.
//
// The ranking is `creatorMetaService`'s — level, then rating, then deliveries
// (V2-03) — and is not re-sorted here. This section renders storefronts; it
// does not decide which ones are good.
//
// The middle zone is `components/data-display/WorksSlider` — the scroll-snap
// strip this section introduced, lifted out unchanged by V2-09 so the creators
// page renders the same one rather than a second copy of it.

/** Storefronts in the row (V2-05 §3). */
const CREATOR_LIMIT = 4

/** Placeholder rows while the ranking is in flight. */
const SKELETON_COUNT = 2

/** The row a top-creator card is laid out in — wider than the feed column. */
const CARD_MAX_WIDTH = 880

/** Avatar diameter in the card's top zone — "large" without reaching profile size. */
const AVATAR_SIZE = 72

/** One labelled figure in the card's stat row. */
function Stat({ icon, children }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
      <Box aria-hidden="true" sx={{ display: 'flex', color: 'primary.main', flexShrink: 0 }}>
        <Icon icon={icon} width={17} />
      </Box>
      <Typography variant="body2" color="text.secondary" noWrap>
        {children}
      </Typography>
    </Stack>
  )
}

function TopCreatorCard({ creator }) {
  const titleId = useId()

  const contribution = formatContribution(creator.contributionCounts)
  const deliveries = Number(creator.deliveriesCount) || 0
  const items = Array.isArray(creator.portfolioItems) ? creator.portfolioItems : []

  return (
    <Card
      component="article"
      aria-labelledby={titleId}
      sx={[
        cardLiftSx,
        {
          width: '100%',
          maxWidth: CARD_MAX_WIDTH,
          mx: 'auto',
          // Glass over the page and the section's glow, the same treatment
          // `FeedCard` carries so the two bands read as one family
          // (docs/theme-v2.md §6).
          backgroundColor: 'var(--bb-glass-bg)',
          backdropFilter: 'blur(var(--bb-glass-blur))',
          WebkitBackdropFilter: 'blur(var(--bb-glass-blur))',
          '&:hover, &:focus-within': { borderColor: 'primary.main' },
        },
      ]}
    >
      <CardContent
        sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } } }}
      >
        {/* --- who they are ------------------------------------------------- */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 1.5, sm: 2.5 }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
        >
          <UserAvatar name={creator.displayName} size={AVATAR_SIZE} />

          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography id={titleId} variant="h6" component="h3" sx={{ fontWeight: 700 }}>
                <Link
                  component={RouterLink}
                  to={paths.creatorProfile(creator.id)}
                  underline="hover"
                  color="inherit"
                >
                  {creator.displayName}
                </Link>
              </Typography>

              {creator.verified ? (
                <>
                  <Box aria-hidden="true" sx={{ display: 'flex', color: 'primary.main' }}>
                    <Icon icon="tabler:rosette-discount-check-filled" width={18} />
                  </Box>
                  <Box component="span" sx={visuallyHidden}>
                    Verified creator
                  </Box>
                </>
              ) : null}

              <CreatorLevelBadge creator={creator} />
              <OnlineDot online={Boolean(creator.isOnline)} />
            </Stack>

            {creator.tagline ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                {creator.tagline}
              </Typography>
            ) : null}
          </Box>
        </Stack>

        {/* --- what they have published ------------------------------------- */}
        <Box sx={{ mt: 2.5 }}>
          <WorksSlider items={items} creatorName={creator.displayName} />
        </Box>

        <Divider sx={{ my: 2.5 }} />

        {/* --- and how it has gone ------------------------------------------ */}
        <Stack
          direction="row"
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          // Separate row and column gaps: the figures sit apart on a line, and
          // the line the action drops onto when they no longer fit stays close
          // enough to read as the same row rather than as a second block.
          sx={{ columnGap: { xs: 1.5, sm: 2.5 }, rowGap: 1 }}
        >
          <RatingStars value={creator.ratingAvg} count={creator.ratingCount} size="sm" />

          <Stat icon="solar:box-minimalistic-linear">
            {formatNumber(deliveries)} {deliveries === 1 ? 'delivery' : 'deliveries'}
          </Stat>

          {contribution ? <Stat icon="solar:gallery-linear">{contribution}</Stat> : null}

          <Stat icon="solar:tag-price-linear">
            From{' '}
            {formatCurrency(creator.startingPrice, creator.currency, { hideDecimals: true })}
          </Stat>

          {creator.location ? (
            <Stat icon="solar:map-point-linear">{creator.location}</Stat>
          ) : null}

          <Box sx={{ ml: { sm: 'auto' } }}>
            <Button
              component={RouterLink}
              to={paths.creatorProfile(creator.id)}
              variant="text"
              endIcon={<Icon icon="tabler:arrow-right" width={18} />}
              aria-label={`View ${creator.displayName}'s profile`}
            >
              View profile
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}

/** Same three zones, same heights — the row does not reflow when data lands. */
function TopCreatorCardSkeleton() {
  return (
    <Card aria-hidden="true" sx={{ width: '100%', maxWidth: CARD_MAX_WIDTH, mx: 'auto' }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack direction="row" spacing={2.5} alignItems="center">
          <Skeleton variant="circular" width={AVATAR_SIZE} height={AVATAR_SIZE} />
          <Box sx={{ flexGrow: 1 }}>
            <Skeleton variant="text" width="38%" height={28} />
            <Skeleton variant="text" width="72%" />
          </Box>
        </Stack>

        <WorksSliderSkeleton count={6} sx={{ mt: 2.5 }} />

        <Divider sx={{ my: 2.5 }} />

        <Stack direction="row" spacing={2.5} alignItems="center">
          <Skeleton variant="text" width={120} />
          <Skeleton variant="text" width={96} />
          <Skeleton variant="text" width={140} />
          <Skeleton variant="rounded" width={112} height={32} sx={{ ml: 'auto' }} />
        </Stack>
      </CardContent>
    </Card>
  )
}

export default function TopCreatorsSection() {
  const { data, isLoading, error } = useApiQuery(
    () => creatorMetaService.getTopCreators(CREATOR_LIMIT),
    []
  )

  const creators = Array.isArray(data) ? data : []

  // Same rule as the feed column above: a band that cannot load takes itself
  // off the page rather than taking the page down with it.
  if (error) return null

  return (
    <Box sx={{ position: 'relative', overflow: 'hidden' }}>
      <AmbientGlow placement="center" intensity="subtle" sx={glowBandSx} />

      <LandingSection
        sx={{ position: 'relative' }}
        eyebrow="Top of the marketplace"
        title="Creators businesses come back to"
        description="Ranked by the work behind them — completed deliveries first, then the rating buyers left on them. Every thumbnail is published work you can open on their storefront."
        headerProps={{ 'data-landing-reveal': true }}
        action={
          <Button
            component={RouterLink}
            to={paths.CREATORS}
            variant="outlined"
            endIcon={<Icon icon="tabler:arrow-right" width={18} />}
          >
            See all creators
          </Button>
        }
      >
        <Stack spacing={3} sx={{ mx: 'auto', maxWidth: CARD_MAX_WIDTH }}>
          {isLoading
            ? Array.from({ length: SKELETON_COUNT }, (_, index) => (
                <TopCreatorCardSkeleton key={`skeleton-${index}`} />
              ))
            : creators.map((creator, index) => (
                <FadeInView key={creator.id} delay={index * 0.08} sx={{ width: '100%' }}>
                  <TopCreatorCard creator={creator} />
                </FadeInView>
              ))}

          {!isLoading && creators.length === 0 ? (
            <EmptyState
              icon="tabler:users-group"
              title="No storefronts to rank yet"
              description="Creators who publish a portfolio and complete orders appear here. The full directory is open in the meantime."
              primaryAction={{ label: 'Browse all creators', to: paths.CREATORS }}
            />
          ) : null}
        </Stack>
      </LandingSection>
    </Box>
  )
}
