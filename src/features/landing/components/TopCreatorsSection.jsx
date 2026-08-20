import { useCallback, useEffect, useId, useRef, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
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
import EmptyState from '@/components/feedback/EmptyState'
import AmbientGlow from '@/components/motion/AmbientGlow'
import FadeInView from '@/components/motion/FadeInView'
import { imageUrl } from '@/constants/images'
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
// The slider is **pure CSS scroll-snap**: `overflow-x: auto` plus snap points,
// swiped natively on a phone and nudged by two buttons on a desktop. The only
// JavaScript is a `scrollBy` per button and a check of where the strip has got
// to, so the buttons can say when there is nothing left in that direction.

/** Storefronts in the row (V2-05 §3). */
const CREATOR_LIMIT = 4

/** Placeholder rows while the ranking is in flight. */
const SKELETON_COUNT = 2

/** The row a top-creator card is laid out in — wider than the feed column. */
const CARD_MAX_WIDTH = 880

/** Avatar diameter in the card's top zone — "large" without reaching profile size. */
const AVATAR_SIZE = 72

/** One work tile: a fixed box that reserves its space before the photo lands. */
const TILE_WIDTH = { xs: 132, sm: 156 }
const TILE_RATIO = '4 / 3'

/** Requested thumbnail size — matches the tile ratio, so nothing is re-scaled. */
const THUMB = { width: 320, height: 240 }

/** How far a click on an arrow travels: most of the strip, then snap. */
const SCROLL_FRACTION = 0.8

/** How wide the fade at a scrollable edge is, in px. */
const EDGE_FADE = 24

/**
 * Slack allowed when deciding whether a strip is at one of its ends. Scroll
 * offsets are fractional and snapping lands on sub-pixel positions, so an exact
 * comparison leaves an arrow enabled with nowhere to go.
 */
const EDGE_TOLERANCE = 2

/**
 * The edge fade, drawn only on the sides that have something behind them — a
 * strip at rest keeps its first tile at full strength, and the fade appears as
 * soon as there is work scrolled past it.
 *
 * A mask reads the **alpha** channel of its gradient, so the opaque stop is a
 * placeholder for "keep this part" and carries no palette meaning — which is
 * why it is a bare `#000` rather than a theme colour (docs/theme-v2.md §11 bans
 * colour literals; this paints nothing).
 *
 * @param {{start: boolean, end: boolean}} edges which sides have more to show
 * @returns {string} a `mask-image` value, or `none` when nothing scrolls
 */
function fadeMask({ start, end }) {
  if (!start && !end) return 'none'

  return [
    'linear-gradient(to right,',
    start ? 'transparent 0,' : '#000 0,',
    `#000 ${EDGE_FADE}px,`,
    `#000 calc(100% - ${EDGE_FADE}px),`,
    end ? 'transparent 100%)' : '#000 100%)',
  ].join(' ')
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

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

/**
 * The middle zone: a creator's published work, scrolled horizontally.
 *
 * A strip that overflows is a named, focusable region, so it takes arrow keys
 * on every breakpoint — including the ones where the buttons are hidden and a
 * keyboard would otherwise have no way to move it at all.
 *
 * @param {object} props
 * @param {object[]} props.items published portfolio items
 * @param {string} props.creatorName whose work this is — used in the labels
 */
function WorksSlider({ items, creatorName }) {
  const stripRef = useRef(null)
  const [edges, setEdges] = useState({ start: false, end: false })
  const [ringed, setRinged] = useState(false)

  // Where the strip has got to, so the arrows can be disabled at the ends and
  // dropped entirely when everything already fits. The updater returns the
  // previous object when nothing changed, so React bails out and a scroll
  // gesture does not re-render the card on every frame.
  const syncEdges = useCallback(() => {
    const strip = stripRef.current
    if (!strip) return

    const remaining = strip.scrollWidth - strip.clientWidth - strip.scrollLeft
    const start = strip.scrollLeft > EDGE_TOLERANCE
    const end = remaining > EDGE_TOLERANCE

    setEdges((previous) =>
      previous.start === start && previous.end === end ? previous : { start, end }
    )
  }, [])

  useEffect(() => {
    const strip = stripRef.current
    if (!strip) return undefined

    syncEdges()
    strip.addEventListener('scroll', syncEdges, { passive: true })
    // A breakpoint change alters how many tiles fit, and with it whether the
    // arrows are needed at all.
    window.addEventListener('resize', syncEdges)

    return () => {
      strip.removeEventListener('scroll', syncEdges)
      window.removeEventListener('resize', syncEdges)
    }
  }, [syncEdges, items.length])

  const scrollStrip = useCallback((direction) => {
    const strip = stripRef.current
    if (!strip) return

    strip.scrollBy({
      left: direction * Math.round(strip.clientWidth * SCROLL_FRACTION),
      // Reduced motion gets the same destination without the travel.
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }, [])

  /**
   * The strip's focus ring is drawn on the wrapper below rather than on the
   * strip itself, because an outline paints *outside* the border box and the
   * edge-fade mask clips everything the strip paints — a ring on the strip is
   * invisible however bright it is. The wrapper is unmasked, so the ring
   * survives; the mirror of `:focus-visible` keeps it off a mouse click.
   */
  const handleStripFocus = (event) => setRinged(event.target.matches(':focus-visible'))

  if (items.length === 0) {
    return (
      <Typography variant="body2" color="text.disabled">
        No published work on this storefront yet.
      </Typography>
    )
  }

  const canScroll = edges.start || edges.end

  const arrowSx = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 2,
    // Desktop affordance only: a phone swipes the strip, and `display: none`
    // keeps the buttons out of the tab order there as well as out of sight.
    display: { xs: 'none', md: 'inline-flex' },
    bgcolor: 'background.elevated',
    border: 1,
    borderColor: 'divider',
    '&:hover': { bgcolor: 'background.paper' },
    '&.Mui-disabled': { opacity: 0.35, bgcolor: 'background.elevated' },
  }

  return (
    <Box
      sx={{
        position: 'relative',
        borderRadius: 'var(--bb-radius-sm)',
        ...(ringed
          ? {
              outline: (theme) => `2px solid ${theme.palette.primary.light}`,
              outlineOffset: 2,
            }
          : null),
      }}
    >
      {canScroll ? (
        <IconButton
          size="small"
          onClick={() => scrollStrip(-1)}
          disabled={!edges.start}
          aria-label={`Show earlier work by ${creatorName}`}
          sx={{ ...arrowSx, left: 0 }}
        >
          <Icon icon="tabler:chevron-left" width={20} />
        </IconButton>
      ) : null}

      <Box
        ref={stripRef}
        component="ul"
        // A scroll container only a mouse or a finger can move is unusable from
        // a keyboard, so a strip with somewhere to go takes a tab stop. One
        // that already fits does not — a dead tab stop is worse than none.
        tabIndex={canScroll ? 0 : -1}
        aria-label={`Published work by ${creatorName}`}
        onFocus={handleStripFocus}
        onBlur={() => setRinged(false)}
        sx={{
          display: 'flex',
          gap: 1,
          listStyle: 'none',
          m: 0,
          p: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollSnapType: 'x mandatory',
          maskImage: fadeMask(edges),
          WebkitMaskImage: fadeMask(edges),
          // The ring lives on the wrapper — see `handleStripFocus`.
          '&:focus-visible': { outline: 'none' },
        }}
      >
        {items.map((item) => (
          <Box
            component="li"
            key={item.id}
            sx={{
              flex: '0 0 auto',
              width: TILE_WIDTH,
              aspectRatio: TILE_RATIO,
              borderRadius: 'var(--bb-radius-sm)',
              overflow: 'hidden',
              bgcolor: 'primary.surface',
              scrollSnapAlign: 'start',
            }}
          >
            <Box
              component="img"
              src={item.thumbnailUrl || imageUrl(item.id, THUMB.width, THUMB.height)}
              alt={item.title}
              loading="lazy"
              decoding="async"
              sx={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </Box>
        ))}
      </Box>

      {canScroll ? (
        <IconButton
          size="small"
          onClick={() => scrollStrip(1)}
          disabled={!edges.end}
          aria-label={`Show more work by ${creatorName}`}
          sx={{ ...arrowSx, right: 0 }}
        >
          <Icon icon="tabler:chevron-right" width={20} />
        </IconButton>
      ) : null}
    </Box>
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

        <Stack direction="row" spacing={1} sx={{ mt: 2.5, overflow: 'hidden' }}>
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton
              key={index}
              variant="rounded"
              sx={{ flex: '0 0 auto', width: TILE_WIDTH, aspectRatio: TILE_RATIO, height: 'auto' }}
            />
          ))}
        </Stack>

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
