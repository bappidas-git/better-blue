import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import StaggerList from '@/components/motion/StaggerList'
import UserAvatar from '@/components/data-display/UserAvatar'

import LandingSection from './LandingSection'

// Marketing copy, not data: three invented businesses from the same world as
// the seed data (00 §1), written the way the people who actually sign off on
// this work talk about it. No real company or person is named.

const QUOTES = [
  {
    key: 'verde',
    quote:
      'We used to spend weeks sourcing a photographer for every menu change. Now the brief goes up once and the proposals already show relevant restaurant work.',
    name: 'Camille Duarte',
    role: 'Marketing Lead, Verde Kitchen',
  },
  {
    key: 'atlas',
    quote:
      'Escrow changed the internal conversation. Finance approves the budget up front, and the payment only moves once we have signed off on the files.',
    name: 'Jonas Weiss',
    role: 'Head of Brand, Atlas Travel Co',
  },
  {
    key: 'creator',
    quote:
      'The briefs are scoped before I quote, so I know the deliverables, the revisions, and the usage rights. I have not chased an invoice since I moved my commercial work here.',
    name: 'Ines Aguilar',
    role: 'Commercial photographer',
  },
]

function Testimonial({ item }) {
  return (
    <Card component="figure" sx={{ height: '100%', m: 0, p: { xs: 3, md: 3.5 } }}>
      <Stack spacing={2.5} sx={{ height: '100%' }}>
        <Box aria-hidden="true" sx={{ display: 'flex', color: 'primary.light' }}>
          <Icon icon="tabler:quote" width={28} />
        </Box>

        <Typography component="blockquote" variant="body1" sx={{ flexGrow: 1, m: 0 }}>
          {item.quote}
        </Typography>

        <Stack component="figcaption" direction="row" spacing={1.5} alignItems="center">
          <UserAvatar name={item.name} size="md" />
          <Box sx={{ minWidth: 0 }}>
            {/* An attribution is not a heading — MUI would map subtitle2 to
                <h6> and put three names into the page outline. */}
            <Typography variant="subtitle2" component="p">
              {item.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {item.role}
            </Typography>
          </Box>
        </Stack>
      </Stack>
    </Card>
  )
}

export default function Testimonials() {
  return (
    <LandingSection
      eyebrow="What people say"
      title="Teams commission here because the process holds"
      description="Clear briefs, priced proposals, and payment that only moves when the work is approved."
    >
      <StaggerList
        inView
        stagger={0.08}
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          gap: 3,
        }}
      >
        {QUOTES.map((item) => (
          <Testimonial key={item.key} item={item} />
        ))}
      </StaggerList>
    </LandingSection>
  )
}
