import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

import StaggerList from '@/components/motion/StaggerList'
import { paths } from '@/routes/paths'

import EscrowExplainer from '../components/EscrowExplainer'
import InfoCtaBand from '../components/InfoCtaBand'
import InfoPageLayout from '../components/InfoPageLayout'
import InfoSection from '../components/InfoSection'
import JourneyTimeline from '../components/JourneyTimeline'
import {
  BUYER_JOURNEY,
  CREATOR_JOURNEY,
  ESCROW_FOOTNOTE,
  ESCROW_STAGES,
  HOW_IT_WORKS_FAQ_TEASERS,
  HOW_IT_WORKS_INTRO,
} from '../content/howItWorks'

// The full walkthrough — replaces the one-paragraph stub Prompt 10 put here so
// the landing page's "see the full walkthrough" link had somewhere to go.
//
// Both journeys are the same workflow told from each side, which is the point:
// the buyer's "fund securely" and the creator's "get paid" are the two ends of
// one escrowed payment. Motion is Framer only (00 §7 — GSAP belongs to the
// landing page); every reveal runs once, on scroll.

export default function HowItWorksPage() {
  return (
    <InfoPageLayout
      documentTitle="How it works"
      eyebrow="How it works"
      title="From brief to licensed content"
      intro={HOW_IT_WORKS_INTRO}
      maxWidth="lg"
      contentWidth="wide"
    >
      <InfoSection
        id="for-businesses"
        eyebrow="For businesses"
        title="Commission the content you need"
        description="Post what you need, compare priced proposals, and pay only when the work is right."
      >
        <JourneyTimeline steps={BUYER_JOURNEY} />
      </InfoSection>

      <InfoSection
        id="for-creators"
        eyebrow="For creators"
        title="Get hired for the work you already do"
        description="Publish the commercial work you want to be booked for, propose on the briefs that suit you, and get paid on approval."
      >
        <JourneyTimeline steps={CREATOR_JOURNEY} />
      </InfoSection>

      <InfoSection
        id="payment-protection"
        title="How payment protection works"
        description="The same escrow sits behind every order, whichever side of it you are on."
      >
        <EscrowExplainer stages={ESCROW_STAGES} footnote={ESCROW_FOOTNOTE} />
      </InfoSection>

      <InfoSection
        id="common-questions"
        title="Common questions"
        description="The four that come up most often — the FAQ answers the rest."
        action={
          <Button
            component={RouterLink}
            to={paths.FAQ}
            variant="text"
            endIcon={<Icon icon="tabler:arrow-right" width={18} />}
          >
            Read the full FAQ
          </Button>
        }
      >
        <StaggerList
          inView
          sx={{
            display: 'grid',
            gap: { xs: 2, md: 3 },
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
          }}
        >
          {HOW_IT_WORKS_FAQ_TEASERS.map((teaser) => (
            <Card key={teaser.key} sx={{ height: '100%' }}>
              <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                <Stack spacing={1.25}>
                  <Typography variant="subtitle1" component="h3">
                    {teaser.question}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {teaser.answer}
                  </Typography>
                  <Box>
                    <Button
                      component={RouterLink}
                      to={`${paths.FAQ}#${teaser.group}`}
                      variant="text"
                      size="small"
                      endIcon={<Icon icon="tabler:arrow-right" width={16} />}
                      sx={{ ml: -1.75 }}
                    >
                      More on this
                    </Button>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </StaggerList>
      </InfoSection>

      <InfoCtaBand
        title="Ready to brief your next campaign?"
        description="Publishing a content request is free, and you only pay once you have accepted a proposal you are happy with."
        primary={{ label: 'Join BetterBlue', to: paths.REGISTER, icon: 'tabler:file-text' }}
        secondary={{ label: 'See pricing', to: paths.PRICING, icon: 'tabler:receipt' }}
      />
    </InfoPageLayout>
  )
}
