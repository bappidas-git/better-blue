import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

import FadeInView from '@/components/motion/FadeInView'

import useLandingCtas from '../hooks/useLandingCtas'
import LandingSection from './LandingSection'

// Both sides of the marketplace, side by side, because the same page has to
// convince a marketing lead and a commercial photographer without either of
// them reading the other's pitch.

const BUYER_POINTS = [
  {
    key: 'briefs',
    icon: 'tabler:file-description',
    title: 'Briefs that get understood',
    description:
      'Set the deliverables, budget, deadline, and usage rights once. Every proposal answers the same brief.',
  },
  {
    key: 'escrow',
    icon: 'tabler:lock-dollar',
    title: 'Payment held in escrow',
    description:
      'Your payment is held by BetterBlue and released only after you approve the delivered content.',
  },
  {
    key: 'licensed',
    icon: 'tabler:license',
    title: 'Licensed, campaign-ready content',
    description:
      'Commercial usage rights are agreed in the order, so the files are cleared for the channels you named.',
  },
]

const CREATOR_POINTS = [
  {
    key: 'real-briefs',
    icon: 'tabler:target-arrow',
    title: 'Real briefs, real budgets',
    description:
      'Businesses post scoped work with a stated budget, so you quote on projects that are ready to run.',
  },
  {
    key: 'pricing',
    icon: 'tabler:coin',
    title: 'You set your pricing',
    description:
      'Price each proposal on its scope, with revisions and turnaround written down before you start.',
  },
  {
    key: 'payouts',
    icon: 'tabler:shield-check',
    title: 'Protected payouts',
    description:
      'The buyer funds the order before you shoot, and earnings are released to you on approval.',
  },
]

function Panel({ eyebrow, title, description, points, cta, variant }) {
  return (
    <Card sx={{ height: '100%', p: { xs: 3, md: 4 } }}>
      <Stack spacing={3} sx={{ height: '100%' }}>
        <Box>
          <Typography variant="overline" component="p" sx={{ color: 'primary.main' }}>
            {eyebrow}
          </Typography>
          <Typography variant="h4" component="h3" sx={{ mt: 0.5 }}>
            {title}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1.5 }}>
            {description}
          </Typography>
        </Box>

        <Stack component="ul" spacing={2.5} sx={{ listStyle: 'none', m: 0, p: 0, flexGrow: 1 }}>
          {points.map((point) => (
            <Stack component="li" key={point.key} direction="row" spacing={1.5}>
              <Box
                aria-hidden="true"
                sx={{
                  flexShrink: 0,
                  width: 40,
                  height: 40,
                  borderRadius: 1.5,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: 'primary.surface',
                  color: 'primary.main',
                }}
              >
                <Icon icon={point.icon} width={22} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle1" component="p">
                  {point.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {point.description}
                </Typography>
              </Box>
            </Stack>
          ))}
        </Stack>

        <Box>
          <Button
            component={RouterLink}
            to={cta.to}
            variant={variant}
            size="large"
            startIcon={<Icon icon={cta.icon} width={20} />}
            sx={{ borderRadius: 999 }}
          >
            {cta.label}
          </Button>
        </Box>
      </Stack>
    </Card>
  )
}

export default function AudiencePanels() {
  const { primary, secondary, isAuthenticated } = useLandingCtas()

  return (
    <LandingSection
      tone="paper"
      eyebrow="Built for both sides"
      title="One workflow, two very different jobs"
      description="Buyers need content they can publish. Creators need work that is scoped and paid. BetterBlue holds the middle."
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
          gap: 3,
        }}
      >
        <FadeInView sx={{ height: '100%' }}>
          <Panel
            eyebrow="For businesses"
            title="Commission content without the agency overhead"
            description="Post once, compare priced proposals, and keep the whole project — files, revisions, and payment — in one place."
            points={BUYER_POINTS}
            cta={primary}
            variant="gradient"
          />
        </FadeInView>

        <FadeInView delay={0.08} sx={{ height: '100%' }}>
          <Panel
            eyebrow="For creators"
            title="Get paid properly for commercial work"
            description="Browse briefs that match what you shoot, propose your own price, and deliver into a funded order."
            points={CREATOR_POINTS}
            cta={isAuthenticated ? primary : secondary}
            variant="outlined"
          />
        </FadeInView>
      </Box>
    </LandingSection>
  )
}
