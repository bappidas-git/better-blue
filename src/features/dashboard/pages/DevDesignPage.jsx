import { useState } from 'react'

import { Box, Chip, Container, Stack, Tab, Tabs, Typography } from '@mui/material'

import Logo from '@/components/brand/Logo'
import ComponentsGallery from '@/features/dashboard/components/devGallery/ComponentsGallery'
import FormsGallery from '@/features/dashboard/components/devGallery/FormsGallery'
import MotionGallery from '@/features/dashboard/components/devGallery/MotionGallery'
import TokensGallery from '@/features/dashboard/components/devGallery/TokensGallery'

// Dev-only design gallery. Mounted from App.jsx while routing does not exist
// yet; Prompt 08 moves it to /dev/design. Every tab renders real library
// components — the gallery is the acceptance surface for Prompts 02–04, so
// anything added to `src/components` should show up here in every state it
// supports. Sample copy and fixtures are business-safe (00 §1) and inline
// fixtures are allowed only in this gallery (Prompt 04 §9).

const TABS = [
  { value: 'tokens', label: 'Tokens', Panel: TokensGallery },
  { value: 'components', label: 'Components', Panel: ComponentsGallery },
  { value: 'forms', label: 'Forms', Panel: FormsGallery },
  { value: 'motion', label: 'Motion', Panel: MotionGallery },
]

export default function DevDesignPage() {
  const [tab, setTab] = useState('tokens')
  const active = TABS.find((entry) => entry.value === tab) ?? TABS[0]
  const { Panel } = active

  return (
    <Box component="main" sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 }, py: { xs: 4, md: 8 } }}>
        <Box component="header" sx={{ mb: { xs: 3, md: 4 } }}>
          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            sx={{ mb: 2 }}
          >
            <Logo variant="full" size={36} />
            <Chip label="Dev only" size="small" />
          </Stack>
          <Typography variant="h3" component="h1" gutterBottom>
            Design gallery
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '68ch' }}>
            Visual verification for the BetterBlue design system and shared component library:
            locked tokens, feedback and data-display components, form fields with validation, and
            motion wrappers. Prompt 08 moves this page to /dev/design.
          </Typography>
        </Box>

        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: (theme) => theme.zIndex.appBar,
            bgcolor: 'background.default',
            borderBottom: 1,
            borderColor: 'divider',
            mb: { xs: 4, md: 6 },
          }}
        >
          <Tabs
            value={tab}
            onChange={(event, next) => setTab(next)}
            aria-label="Design gallery sections"
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
          >
            {TABS.map((entry) => (
              <Tab
                key={entry.value}
                value={entry.value}
                label={entry.label}
                id={`gallery-tab-${entry.value}`}
                aria-controls={`gallery-panel-${entry.value}`}
              />
            ))}
          </Tabs>
        </Box>

        <Box
          role="tabpanel"
          id={`gallery-panel-${active.value}`}
          aria-labelledby={`gallery-tab-${active.value}`}
        >
          <Panel />
        </Box>
      </Container>
    </Box>
  )
}
