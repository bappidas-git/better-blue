import { useId } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

import { imageUrl } from '@/constants/images'

import useLandingCtas from '../hooks/useLandingCtas'
import styles from './Hero.module.css'

// The top of the page, and the product's whole positioning in one screen
// (00 §1): businesses commission professional creators for commercial photos
// and videos. Copy stays business-first; the visual is four "content cards"
// standing in for the work that gets ordered here.
//
// Motion is GSAP's (00 §7 — marketing surfaces). Every element the timeline
// touches is marked with a `data-landing-*` attribute and is fully visible
// without it: `useLandingAnimations` writes the hidden state at runtime, and
// only when the visitor has not asked for reduced motion.

/**
 * Seeds are stable strings, so each card always renders the same generic
 * professional photograph (00 §1). Sizes match the rendered aspect ratios, so
 * the reserved box and the file agree and nothing shifts on load.
 */
const CARDS = [
  {
    key: 'food',
    title: 'Menu launch shoot',
    meta: 'Food & Beverage · 12 photos',
    seed: 'bb-hero-food-shoot',
    width: 480,
    height: 600,
  },
  {
    key: 'product',
    title: 'Product hero shots',
    meta: 'E-commerce · Photo + video',
    seed: 'bb-hero-product-shot',
    width: 480,
    height: 360,
    wide: true,
  },
  {
    key: 'travel',
    title: 'Destination reel',
    meta: 'Travel & Hospitality · 45s video',
    seed: 'bb-hero-travel',
    width: 480,
    height: 360,
    wide: true,
  },
  {
    key: 'fitness',
    title: 'Class promo video',
    meta: 'Fitness & Wellness · 3 cuts',
    seed: 'bb-hero-fitness',
    width: 480,
    height: 600,
  },
]

/** Column layout of the composition — [left column, right column (dropped)]. */
const COLUMNS = [
  ['food', 'travel'],
  ['product', 'fitness'],
]

/**
 * Qualitative proof points rather than counts: the stats band further down the
 * page prints real numbers from the API, and a marketing figure sitting beside
 * them would contradict them.
 */
const TRUST_POINTS = [
  { key: 'vetted', icon: 'tabler:rosette-discount-check', label: 'Vetted professional creators' },
  { key: 'escrow', icon: 'tabler:shield-lock', label: 'Escrow-protected payments' },
  { key: 'rights', icon: 'tabler:license', label: 'Commercial usage rights included' },
]

const CARDS_BY_KEY = Object.fromEntries(CARDS.map((card) => [card.key, card]))

function ContentCard({ card }) {
  return (
    <Box className={styles.card} data-landing-hero-card>
      <img
        className={`${styles.media} ${card.wide ? styles.mediaWide : ''}`}
        src={imageUrl(card.seed, card.width, card.height)}
        width={card.width}
        height={card.height}
        // Decorative: the card's own caption carries the meaning, so a screen
        // reader announcing the stock photograph would only add noise (00 §13).
        alt=""
        loading="eager"
        decoding="async"
      />
      <Box className={styles.caption}>
        {/* `component="p"`: MUI maps subtitle2 onto an <h6>, and a decorative
            card label has no business in the page's heading outline. */}
        <Typography variant="subtitle2" component="p" noWrap>
          {card.title}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap component="p">
          {card.meta}
        </Typography>
      </Box>
    </Box>
  )
}

export default function Hero() {
  const headingId = useId()
  const { primary, secondary } = useLandingCtas()

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
      <Box className={`${styles.glow} ${styles.glowPrimary}`} aria-hidden="true" />
      <Box className={`${styles.glow} ${styles.glowSecondary}`} aria-hidden="true" />

      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 } }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1.05fr 1fr' },
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
              The commercial content marketplace
            </Typography>

            <Typography
              id={headingId}
              variant="h1"
              component="h1"
              sx={{ maxWidth: '15ch' }}
              data-landing-hero-copy
            >
              Custom photos &amp; videos for your brand, made by professional creators
            </Typography>

            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ maxWidth: '56ch', fontSize: { md: '1.125rem' } }}
              data-landing-hero-copy
            >
              Post a brief, compare proposals from creators who shoot for businesses like
              yours, and release payment only once the content is delivered and approved.
            </Typography>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              sx={{ pt: 0.5, width: { xs: '100%', sm: 'auto' } }}
              data-landing-hero-copy
            >
              <Button
                component={RouterLink}
                to={primary.to}
                variant="gradient"
                size="large"
                startIcon={<Icon icon={primary.icon} width={20} />}
                sx={{ borderRadius: 999 }}
              >
                {primary.label}
              </Button>
              <Button
                component={RouterLink}
                to={secondary.to}
                variant="outlined"
                size="large"
                startIcon={<Icon icon={secondary.icon} width={20} />}
                sx={{ borderRadius: 999 }}
              >
                {secondary.label}
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

          {/* Decorative composition — labelled cards, no interactive targets, so
              it stays out of the keyboard path entirely. */}
          <Box className={styles.stage} data-landing-hero-stage>
            {COLUMNS.map((column, index) => (
              <Box
                key={column.join('-')}
                className={`${styles.column} ${index === 1 ? styles.columnLower : ''}`}
              >
                {column.map((key) => (
                  <ContentCard key={key} card={CARDS_BY_KEY[key]} />
                ))}
              </Box>
            ))}
          </Box>
        </Box>
      </Container>
    </Box>
  )
}
