import { useState } from 'react'

import { Box, Chip, Container, Stack, Tab, Tabs, Typography } from '@mui/material'

import Logo from '@/components/brand/Logo'
import { appConfig } from '@/config/appConfig'
import ApiGallery from '@/features/dashboard/components/devGallery/ApiGallery'
import ComponentsGallery from '@/features/dashboard/components/devGallery/ComponentsGallery'
import FormsGallery from '@/features/dashboard/components/devGallery/FormsGallery'
import MotionGallery from '@/features/dashboard/components/devGallery/MotionGallery'
import PaymentsGallery from '@/features/dashboard/components/devGallery/PaymentsGallery'
import TokensGallery from '@/features/dashboard/components/devGallery/TokensGallery'
import WidgetsGallery from '@/features/dashboard/components/devGallery/WidgetsGallery'
import useDocumentTitle from '@/hooks/useDocumentTitle'

// Dev-only design gallery, mounted at /dev/design inside PublicLayout and only
// when `import.meta.env.DEV && env.enableDevPages` (see src/routes/index.jsx).
// Every tab renders real library components — the gallery is the acceptance
// surface for Prompts 02–04, so anything added to `src/components` should show
// up here in every state it supports. Sample copy and fixtures are business-safe
// (00 §1) and inline fixtures are allowed only in this gallery (Prompt 04 §9).

const TABS = [
  { value: 'tokens', label: 'Tokens', Panel: TokensGallery },
  { value: 'components', label: 'Components', Panel: ComponentsGallery },
  { value: 'forms', label: 'Forms', Panel: FormsGallery },
  { value: 'motion', label: 'Motion', Panel: MotionGallery },
  { value: 'widgets', label: 'Widgets', Panel: WidgetsGallery },
  { value: 'api', label: 'API', Panel: ApiGallery },
  { value: 'payments', label: 'Payments', Panel: PaymentsGallery },
]

export default function DevDesignPage() {
  const [tab, setTab] = useState('tokens')
  const active = TABS.find((entry) => entry.value === tab) ?? TABS[0]
  const { Panel } = active
  useDocumentTitle('Design gallery')

  return (
    <Box sx={{ bgcolor: 'background.default' }}>
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
            locked tokens, feedback and data-display components, form fields with validation,
            motion wrappers, the dashboard widget kit, and the API layer running against the
            seeded mock database.
          </Typography>
        </Box>

        <Box
          sx={{
            position: 'sticky',
            // Parks under the sticky public top nav instead of behind it.
            top: { xs: appConfig.topNavHeight.xs, md: appConfig.topNavHeight.md },
            zIndex: (theme) => theme.zIndex.appBar - 1,
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
