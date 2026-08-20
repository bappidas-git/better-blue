import { useId, useLayoutEffect } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Link from '@mui/material/Link'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

import AmbientGlow from '@/components/motion/AmbientGlow'
import { imageUrl } from '@/constants/images'
import useApiQuery from '@/hooks/useApiQuery'
import { paths } from '@/routes/paths'
import { creatorMetaService } from '@/services'

import formatContribution from '../utils/formatContribution'
import styles from './Hero.module.css'

// The top of the page. The copy is placeholder Lorem Ipsum (V2-04 §1) — the
// final wording is still being written, and shipping lorem is how the layout
// gets reviewed without the words standing in for the design. The typographic
// hierarchy is the real deliverable here: eyebrow, display headline, lead
// paragraph, two CTAs, a three-item proof row.
//
// The visual is a composition of floating cards, each one a **featured
// creator**: their storefront photo, their name linking to their profile, and
// what they have contributed to the marketplace. So the hero is no longer a
// still life of stock categories — it points at real people the visitor can
// click through to.
//
// Motion is GSAP's (00 §7 — marketing surfaces). Every element the timeline
// touches is marked with a `data-landing-*` attribute and is fully visible
// without it: `useLandingAnimations` writes the hidden state at runtime, and
// only when the visitor has not asked for reduced motion.

/** Cards in the composition. Fewer featured storefronts simply means fewer. */
const HERO_CARD_LIMIT = 4

/** Column layout — cards alternate between the two columns, left first. */
const COLUMN_KEYS = ['left', 'right']

/**
 * Portrait and landscape cards alternate so the arrangement reads as settled
 * rather than as a grid: with the two-column split above, tall/wide/wide/tall
 * puts one of each in every column.
 */
const isWideCard = (index) => index === 1 || index === 2

/** Requested pixel sizes — they match the rendered aspect ratios, so the box the
 *  `<img>` reserves and the file that lands in it agree and nothing shifts. */
const CARD_SIZES = {
  tall: { width: 480, height: 600 },
  wide: { width: 480, height: 360 },
}

/**
 * Placeholder Lorem Ipsum, sized to the copy it stands in for: three short
 * proof points, the same length as the claims that will replace them.
 */
const TRUST_POINTS = [
  { key: 'one', icon: 'tabler:rosette-discount-check', label: 'Lorem ipsum dolor sit' },
  { key: 'two', icon: 'tabler:shield-lock', label: 'Consectetur adipiscing' },
  { key: 'three', icon: 'tabler:license', label: 'Sed do eiusmod tempor' },
]

/** Splits the cards into the two columns, keeping their order left-to-right. */
function toColumns(cards) {
  return COLUMN_KEYS.map((_, columnIndex) =>
    cards.filter((_card, index) => index % COLUMN_KEYS.length === columnIndex)
  )
}

function CreatorCard({ creator, wide }) {
  const size = wide ? CARD_SIZES.wide : CARD_SIZES.tall
  const contribution = formatContribution(creator.contributionCounts)

  return (
    <Box className={styles.card} data-landing-hero-card>
      <img
        className={`${styles.media} ${wide ? styles.mediaWide : ''}`}
        src={imageUrl(creator.id, size.width, size.height)}
        width={size.width}
        height={size.height}
        // Decorative: the caption right below carries the creator's name, so a
        // screen reader announcing the photograph too would only repeat it.
        alt=""
        loading="eager"
        decoding="async"
      />

      <Box className={styles.caption}>
        <Link
          component={RouterLink}
          to={paths.creatorProfile(creator.id)}
          // The card around it is decoration; keeping the click on the link
          // means nothing else in the composition can ever react to it.
          onClick={(event) => event.stopPropagation()}
          className={styles.creatorLink}
          variant="subtitle2"
          underline="none"
          noWrap
        >
          {creator.displayName}
        </Link>

        {contribution ? (
          // Wraps rather than truncates: at 360px the two-column stage leaves
          // roughly 130px of caption, and half a figure is worse than two lines.
          <Typography variant="caption" color="text.secondary" component="p">
            {contribution}
          </Typography>
        ) : null}
      </Box>
    </Box>
  )
}

/** Same shell, same reserved box — the composition does not move when data lands. */
function CardPlaceholder({ wide }) {
  return (
    <Box className={styles.card} aria-hidden="true">
      <Skeleton
        variant="rectangular"
        sx={{ width: '100%', height: 'auto', aspectRatio: wide ? '4 / 3' : '4 / 5' }}
      />
      <Box className={styles.caption}>
        <Skeleton variant="text" width="62%" sx={{ fontSize: '0.875rem' }} />
        <Skeleton variant="text" width="78%" sx={{ fontSize: '0.75rem' }} />
      </Box>
    </Box>
  )
}

/**
 * @param {object} props
 * @param {() => void} [props.onCardsReady] called once the creator cards are in
 *   the DOM, so the page's GSAP layer can bind its intro and parallax to them
 */
export default function Hero({ onCardsReady }) {
  const headingId = useId()

  const { data, isLoading } = useApiQuery(
    () => creatorMetaService.getFeaturedWithContributions(HERO_CARD_LIMIT),
    []
  )

  const creators = (Array.isArray(data) ? data : []).slice(0, HERO_CARD_LIMIT)
  const hasCards = creators.length > 0
  // A failed or empty featured shelf costs the hero its decoration, not its
  // message: the copy column simply takes the full width.
  const showStage = isLoading || hasCards

  // Layout effect, not effect: this makes the page's GSAP layer run in the same
  // frame the cards were added, so the timeline writes their hidden "from"
  // state before the browser has painted them.
  useLayoutEffect(() => {
    if (hasCards) onCardsReady?.()
  }, [hasCards, onCardsReady])

  return (
    <Box
      component="section"
      aria-labelledby={headingId}
      className={styles.hero}
      sx={{
        display: 'flex',
        alignItems: 'center',
        // Fills the fold on desktop without the nav; natural height on phones.
        minHeight: { md: 'calc(90vh - 64px)' },
        py: { xs: 7, md: 10 },
      }}
    >
      <AmbientGlow placement="hero" intensity="medium" />

      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 }, position: 'relative' }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: showStage ? '1.05fr 1fr' : '1fr' },
            gap: { xs: 6, md: 8 },
            alignItems: 'center',
          }}
        >
          {/* Copy first in the DOM, so it is also first for keyboard and
              screen-reader users on every breakpoint. */}
          <Stack spacing={2.5} sx={{ minWidth: 0 }}>
            <Typography
              variant="overline"
              component="p"
              sx={{ color: 'primary.main' }}
              data-landing-hero-copy
            >
              Lorem ipsum dolor amet
            </Typography>

            <Typography
              id={headingId}
              variant="h1"
              component="h1"
              sx={{ maxWidth: '15ch' }}
              data-landing-hero-copy
            >
              Consectetur adipiscing elit sed do{' '}
              {/* Display sizes only, and only the tail of the line: the gradient
                  fill is AA-large, so the sentence keeps most of its contrast
                  (docs/theme-v2.md §7). */}
              <Box component="span" className="bb-gradient-text">
                eiusmod tempor
              </Box>
            </Typography>

            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ maxWidth: '56ch', fontSize: { md: '1.125rem' } }}
              data-landing-hero-copy
            >
              Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
              aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in
              voluptate velit esse cillum dolore.
            </Typography>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              sx={{ pt: 0.5, width: { xs: '100%', sm: 'auto' } }}
              data-landing-hero-copy
            >
              {/* One pair of CTAs for everybody. A signed-in visitor gets the
                  same two doors as a visitor who has never been here: the
                  storefront is the destination now, not the dashboard. */}
              <Button
                component={RouterLink}
                to={paths.FEEDS}
                variant="gradient"
                size="large"
                startIcon={<Icon icon="tabler:layout-list" width={20} />}
                sx={{ borderRadius: 999 }}
              >
                View Feeds
              </Button>
              <Button
                component={RouterLink}
                to={paths.CREATORS}
                variant="outlined"
                size="large"
                startIcon={<Icon icon="tabler:users-group" width={20} />}
                sx={{ borderRadius: 999 }}
              >
                Explore Creators
              </Button>
            </Stack>

            <Stack
              component="ul"
              direction={{ xs: 'column', sm: 'row' }}
              spacing={{ xs: 1, sm: 2.5 }}
              flexWrap="wrap"
              useFlexGap
              sx={{ listStyle: 'none', m: 0, p: 0, pt: 1 }}
              data-landing-hero-copy
            >
              {TRUST_POINTS.map((point) => (
                <Stack
                  component="li"
                  key={point.key}
                  direction="row"
                  spacing={0.75}
                  alignItems="center"
                >
                  <Box aria-hidden="true" sx={{ display: 'flex', color: 'primary.main' }}>
                    <Icon icon={point.icon} width={18} />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {point.label}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Stack>

          {showStage ? (
            <Box className={styles.stage} data-landing-hero-stage>
              {toColumns(
                isLoading
                  ? Array.from({ length: HERO_CARD_LIMIT }, (_, index) => ({
                      key: `placeholder-${index}`,
                      wide: isWideCard(index),
                    }))
                  : creators.map((creator, index) => ({
                      key: creator.id,
                      wide: isWideCard(index),
                      creator,
                    }))
              ).map((column, columnIndex) => (
                <Box
                  key={COLUMN_KEYS[columnIndex]}
                  className={`${styles.column} ${columnIndex === 1 ? styles.columnLower : ''}`}
                >
                  {column.map((card) =>
                    card.creator ? (
                      <CreatorCard key={card.key} creator={card.creator} wide={card.wide} />
                    ) : (
                      <CardPlaceholder key={card.key} wide={card.wide} />
                    )
                  )}
                </Box>
              ))}
            </Box>
          ) : null}
        </Box>
      </Container>
    </Box>
  )
}
