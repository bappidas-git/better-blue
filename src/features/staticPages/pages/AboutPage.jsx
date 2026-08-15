import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import KeyValueList from '@/components/data-display/KeyValueList'
import StaggerList from '@/components/motion/StaggerList'
import { paths } from '@/routes/paths'

import InfoCtaBand from '../components/InfoCtaBand'
import InfoPageLayout from '../components/InfoPageLayout'
import InfoSection from '../components/InfoSection'
import { ABOUT_BUILD_NOTE, ABOUT_FACTS, ABOUT_INTRO, ABOUT_MISSION, ABOUT_VALUES } from '../content/about'

// About BetterBlue. No team section by design: inventing founders and bios for
// a marketplace build would be dressing, and the honest version of this page is
// what the product does and the principles it is built on (00 §1).

const factItems = ABOUT_FACTS.map((fact) => ({ label: fact.title, value: fact.description }))

export default function AboutPage() {
  return (
    <InfoPageLayout
      documentTitle="About BetterBlue"
      eyebrow="About"
      title="Commercial content, commissioned properly"
      intro={ABOUT_INTRO}
      maxWidth="lg"
      contentWidth="wide"
    >
      <InfoSection id="mission" title="Why BetterBlue exists">
        <Stack spacing={2}>
          {ABOUT_MISSION.map((paragraph) => (
            <Typography key={paragraph} variant="body1" color="text.secondary" sx={{ maxWidth: '68ch' }}>
              {paragraph}
            </Typography>
          ))}
        </Stack>
      </InfoSection>

      <InfoSection
        id="values"
        title="What we hold to"
        description="Three principles, each of them built into how the product behaves rather than stated and forgotten."
      >
        <StaggerList
          inView
          sx={{
            display: 'grid',
            gap: { xs: 2, md: 3 },
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
          }}
        >
          {ABOUT_VALUES.map((value) => (
            <Card key={value.key} sx={{ height: '100%' }}>
              <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                <Stack spacing={1.5}>
                  <Box
                    aria-hidden="true"
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 2,
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: 'primary.surface',
                      color: 'primary.main',
                    }}
                  >
                    <Icon icon={value.icon} width={22} />
                  </Box>

                  <Typography variant="h6" component="h3">
                    {value.title}
                  </Typography>

                  <Typography variant="body2" color="text.secondary">
                    {value.description}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </StaggerList>
      </InfoSection>

      <InfoSection id="how-we-work" title="How we work">
        <KeyValueList items={factItems} divided labelWidth={220} />

        <Typography variant="caption" component="p" color="text.secondary" sx={{ mt: 3, maxWidth: '68ch' }}>
          {ABOUT_BUILD_NOTE}
        </Typography>
      </InfoSection>

      <InfoCtaBand
        title="Start with a brief, or with a portfolio"
        description="Businesses publish what they need and compare priced proposals. Creators publish the commercial work they want to be hired for."
        primary={{ label: 'Join BetterBlue', to: paths.REGISTER, icon: 'tabler:user-plus' }}
        secondary={{ label: 'See how it works', to: paths.HOW_IT_WORKS, icon: 'tabler:route' }}
      />
    </InfoPageLayout>
  )
}
