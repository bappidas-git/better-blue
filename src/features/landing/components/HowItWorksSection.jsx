import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

import StaggerList from '@/components/motion/StaggerList'
import { paths } from '@/routes/paths'

import LandingSection from './LandingSection'

// Four steps, in the order the product actually runs them (00 §18): the brief,
// the offers, the shoot, and the release of the escrowed payment.
//
// Motion here is split by element, never doubled up (00 §7): GSAP reveals the
// header and draws the rail between the steps, Framer staggers the step cards.

const STEPS = [
  {
    key: 'post',
    icon: 'tabler:file-text',
    title: 'Post a feed',
    description:
      'Describe the content you need, the budget you have, and the usage rights the work has to carry.',
  },
  {
    key: 'review',
    icon: 'tabler:checklist',
    title: 'Review proposals',
    description:
      'Compare priced offers from creators whose portfolios already show relevant commercial work.',
  },
  {
    key: 'produce',
    icon: 'tabler:camera',
    title: 'Creator produces',
    description:
      'Your creator shoots, edits, and delivers inside the order, with revisions agreed up front.',
  },
  {
    key: 'release',
    icon: 'tabler:shield-check',
    title: 'Approve & release payment',
    description:
      'Approve the deliverable and BetterBlue releases the payment it held in escrow to the creator.',
  },
]

/** Icon tile size, and the column gap the rail has to bridge (theme spacing 3). */
const ICON_TILE = 56
const COLUMN_GAP = 24

function Step({ step, index, showRail }) {
  return (
    <Stack spacing={1.5} sx={{ height: '100%' }}>
      <Box sx={{ position: 'relative' }}>
        <Box
          aria-hidden="true"
          sx={{
            // Opaque and above the rail, so the line reads as running between
            // the tiles rather than through them.
            position: 'relative',
            zIndex: 1,
            width: ICON_TILE,
            height: ICON_TILE,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'primary.surface',
            color: 'primary.main',
          }}
        >
          <Icon icon={step.icon} width={26} />
        </Box>

        {showRail ? (
          <Box
            aria-hidden="true"
            data-landing-connector
            sx={{
              display: { xs: 'none', md: 'block' },
              position: 'absolute',
              left: ICON_TILE,
              // Bridges the grid gap so the rail lands on the next tile.
              right: `-${COLUMN_GAP}px`,
              top: ICON_TILE / 2 - 1,
              height: 2,
              borderRadius: 1,
              bgcolor: 'divider',
            }}
          />
        ) : null}
      </Box>

      <Box>
        <Typography variant="overline" component="p" color="text.secondary">
          {`Step ${String(index + 1).padStart(2, '0')}`}
        </Typography>
        <Typography variant="h6" component="h3">
          {step.title}
        </Typography>
      </Box>

      <Typography variant="body2" color="text.secondary">
        {step.description}
      </Typography>
    </Stack>
  )
}

export default function HowItWorksSection() {
  return (
    <LandingSection
      eyebrow="How it works"
      title="From brief to licensed content in four steps"
      description="Every order runs through the same protected workflow, so both sides know what happens next and when the money moves."
      headerProps={{ 'data-landing-reveal': true }}
      action={
        <Button
          component={RouterLink}
          to={paths.HOW_IT_WORKS}
          variant="text"
          endIcon={<Icon icon="tabler:arrow-right" width={18} />}
        >
          See the full walkthrough
        </Button>
      }
    >
      <StaggerList
        inView
        stagger={0.08}
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: { xs: 4, md: `${COLUMN_GAP}px` },
        }}
      >
        {STEPS.map((step, index) => (
          <Step
            key={step.key}
            step={step}
            index={index}
            showRail={index < STEPS.length - 1}
          />
        ))}
      </StaggerList>
    </LandingSection>
  )
}
