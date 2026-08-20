import { useState } from 'react'

import { Icon } from '@iconify/react'
import { Box, Button, Card, CardContent, Divider, Paper, Stack, Typography } from '@mui/material'
import { motion, useReducedMotion } from 'framer-motion'

import StatCard from '@/components/data-display/StatCard'
import AmbientGlow from '@/components/motion/AmbientGlow'
import AnimatedNumber from '@/components/motion/AnimatedNumber'
import FadeInView from '@/components/motion/FadeInView'
import PageTransition from '@/components/motion/PageTransition'
import StaggerList from '@/components/motion/StaggerList'
import {
  fadeIn,
  fadeInUp,
  listItem,
  scaleIn,
  staggerContainer,
} from '@/components/motion/motionPresets'
import { formatCurrency, formatNumber } from '@/utils/formatters'
import GalleryBlock from './GalleryBlock'

// Motion tab — the Prompt 02 presets plus the Prompt 04 wrappers. Everything
// animates transform/opacity only and honors prefers-reduced-motion through
// <MotionConfig reducedMotion="user"> in AppProviders (00 §7).

const MOTION_TILES = [
  { preset: 'fadeInUp', variants: fadeInUp, note: 'Section and card reveals' },
  { preset: 'scaleIn', variants: scaleIn, note: 'Dialogs and popovers' },
  { preset: 'fadeIn', variants: fadeIn, note: 'Low-emphasis content' },
  { preset: 'listItem', variants: listItem, note: 'Staggered list rows' },
]

const STAGGER_ITEMS = [
  { id: 'req_1', title: 'Spring menu photos', meta: 'Harbor Table · Food & Beverage' },
  { id: 'req_2', title: 'Launch reels', meta: 'Bloom Coffee Co · Food & Beverage' },
  { id: 'req_3', title: 'Studio product set', meta: 'Aurora Skincare · Beauty' },
  { id: 'req_4', title: 'Gym walkthrough clips', meta: 'Trailhead Fitness · Fitness' },
  { id: 'req_5', title: 'Listing tours', meta: 'Northside Realty · Real Estate' },
  { id: 'req_6', title: 'Onboarding explainer', meta: 'Cadence SaaS · Technology' },
]

// Cycled by the replay button — deterministic, so the demo never depends on
// randomness (which would also break under the seed-script import rules).
const NUMBER_SETS = [
  { earnings: 12480, orders: 18, rating: 4.8 },
  { earnings: 24310, orders: 27, rating: 4.9 },
  { earnings: 8150, orders: 11, rating: 4.6 },
]

function PresetsDemo() {
  const [runId, setRunId] = useState(0)
  const prefersReducedMotion = useReducedMotion()

  return (
    <Stack spacing={2} alignItems="flex-start">
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
        <Button
          variant="outlined"
          size="small"
          startIcon={<Icon icon="solar:restart-linear" />}
          onClick={() => setRunId((n) => n + 1)}
        >
          Replay
        </Button>
        {prefersReducedMotion && (
          <Typography variant="caption" color="text.secondary">
            Reduced motion is on — presets render statically.
          </Typography>
        )}
      </Stack>
      <Box
        key={runId}
        component={motion.div}
        variants={staggerContainer()}
        initial={prefersReducedMotion ? false : 'hidden'}
        animate="visible"
        sx={{
          display: 'grid',
          gap: 2,
          width: '100%',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
        }}
      >
        {MOTION_TILES.map((tile) => (
          <Paper
            key={tile.preset}
            component={motion.div}
            variants={tile.variants}
            variant="outlined"
            sx={{ p: 2.5 }}
          >
            <Typography variant="subtitle2" color="primary.light">
              {tile.preset}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {tile.note}
            </Typography>
          </Paper>
        ))}
      </Box>
    </Stack>
  )
}

function PageTransitionDemo() {
  const [runId, setRunId] = useState(0)

  return (
    <Stack spacing={2} alignItems="flex-start">
      <Button
        variant="outlined"
        size="small"
        startIcon={<Icon icon="solar:restart-linear" />}
        onClick={() => setRunId((n) => n + 1)}
      >
        Replay route enter
      </Button>
      <Paper variant="outlined" sx={{ p: 3, width: '100%' }}>
        <PageTransition key={runId}>
          <Typography variant="h6" component="p" gutterBottom>
            Discover creators
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Enters with an 8px rise and a fade over 250ms; leaves with a fade only, so an outgoing
            page never shifts layout. Prompt 08 wraps the router outlet in this component.
          </Typography>
        </PageTransition>
      </Paper>
    </Stack>
  )
}

function StaggerDemo() {
  const [runId, setRunId] = useState(0)

  return (
    <Stack spacing={2}>
      <Button
        variant="outlined"
        size="small"
        startIcon={<Icon icon="solar:restart-linear" />}
        onClick={() => setRunId((n) => n + 1)}
        sx={{ alignSelf: 'flex-start' }}
      >
        Replay stagger
      </Button>
      <StaggerList
        key={runId}
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
        }}
      >
        {STAGGER_ITEMS.map((item) => (
          <Card key={item.id} sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle2">{item.title}</Typography>
              <Typography variant="caption" color="text.secondary">
                {item.meta}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </StaggerList>
    </Stack>
  )
}

function AnimatedNumberDemo() {
  const [index, setIndex] = useState(0)
  const numbers = NUMBER_SETS[index % NUMBER_SETS.length]

  return (
    <Stack spacing={2}>
      <Button
        variant="outlined"
        size="small"
        startIcon={<Icon icon="solar:restart-linear" />}
        onClick={() => setIndex((n) => n + 1)}
        sx={{ alignSelf: 'flex-start' }}
      >
        Change values
      </Button>
      <Stack direction="row" spacing={4} flexWrap="wrap" useFlexGap alignItems="baseline">
        <Box>
          <Typography variant="overline" component="p" color="text.secondary">
            Currency
          </Typography>
          <Typography variant="h4" component="p">
            <AnimatedNumber value={numbers.earnings} format={(value) => formatCurrency(value)} />
          </Typography>
        </Box>
        <Box>
          <Typography variant="overline" component="p" color="text.secondary">
            Count
          </Typography>
          <Typography variant="h4" component="p">
            <AnimatedNumber value={numbers.orders} format={formatNumber} />
          </Typography>
        </Box>
        <Box>
          <Typography variant="overline" component="p" color="text.secondary">
            Decimal
          </Typography>
          <Typography variant="h4" component="p">
            <AnimatedNumber value={numbers.rating} format={(value) => value.toFixed(1)} />
          </Typography>
        </Box>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          maxWidth: 640,
        }}
      >
        <StatCard
          label="Earnings this month"
          value={numbers.earnings}
          format={(value) => formatCurrency(value)}
          icon="tabler:wallet"
        />
        <StatCard label="Active orders" value={numbers.orders} icon="tabler:briefcase" iconTone="info" />
      </Box>
    </Stack>
  )
}

export default function MotionGallery() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <Stack spacing={{ xs: 6, md: 8 }} divider={<Divider />}>
      <GalleryBlock
        title="Reduced motion"
        caption="Framer honors the OS setting through MotionConfig; CSS transitions are zeroed in global.css. Toggle the setting in your OS and reload to verify everything below becomes static."
      >
        <Paper variant="outlined" sx={{ p: 2, display: 'inline-flex', gap: 1, alignItems: 'center' }}>
          <Icon
            icon={prefersReducedMotion ? 'tabler:player-pause' : 'tabler:player-play'}
            width={20}
          />
          <Typography variant="body2">
            prefers-reduced-motion is currently{' '}
            <strong>{prefersReducedMotion ? 'on' : 'off'}</strong>
          </Typography>
        </Paper>
      </GalleryBlock>

      <GalleryBlock
        title="AmbientGlow"
        caption="Positioned radial blobs behind a hero or section header — pure CSS, no JS loop, aria-hidden and pointer-events: none, clipped to the parent so a blob can never widen a 360px page. Static by design, so reduced motion needs no special case."
      >
        <Box
          sx={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 3,
            border: 1,
            borderColor: 'divider',
            bgcolor: 'background.default',
            px: { xs: 3, md: 6 },
            py: { xs: 6, md: 8 },
          }}
        >
          <AmbientGlow placement="hero" intensity="medium" />
          <Stack spacing={1.5} sx={{ position: 'relative', maxWidth: 520 }}>
            <Typography variant="overline" component="p" color="secondary.light">
              Behind a hero
            </Typography>
            <Typography variant="h3" component="p">
              Commission content your brand can trust
            </Typography>
            <Typography variant="body1" color="text.secondary">
              The glow sits under the copy at z-index 0; everything above it needs
              position: relative to stay on top.
            </Typography>
          </Stack>
        </Box>
      </GalleryBlock>

      <GalleryBlock
        title="Motion presets"
        caption="Framer variants from motionTokens (250ms base, ease-out-expo-like), shared by every feature."
      >
        <PresetsDemo />
      </GalleryBlock>

      <GalleryBlock
        title="PageTransition"
        caption="Route-level enter/exit wrapper."
      >
        <PageTransitionDemo />
      </GalleryBlock>

      <GalleryBlock
        title="FadeInView"
        caption="Reveals once when scrolled into view, with a negative viewport margin so it fires after the element is properly on screen. Scroll this block out of view and back to confirm it does not replay."
      >
        <Stack spacing={2}>
          {['Briefs', 'Proposals', 'Deliveries'].map((title, index) => (
            <FadeInView key={title} delay={index * 0.05}>
              <Paper variant="outlined" sx={{ p: 3 }}>
                <Typography variant="subtitle2">{title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Revealed on scroll — once only.
                </Typography>
              </Paper>
            </FadeInView>
          ))}
        </Stack>
      </GalleryBlock>

      <GalleryBlock
        title="StaggerList"
        caption="Container + item variants from the presets; children are wrapped automatically so pages keep writing plain map() markup."
      >
        <StaggerDemo />
      </GalleryBlock>

      <GalleryBlock
        title="AnimatedNumber"
        caption="Spring count-up that writes straight to the DOM node instead of re-rendering each frame. Under reduced motion the final value renders immediately."
      >
        <AnimatedNumberDemo />
      </GalleryBlock>
    </Stack>
  )
}
