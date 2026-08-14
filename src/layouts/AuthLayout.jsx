import { Suspense } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Outlet, ScrollRestoration } from 'react-router-dom'

import AppLoader from '@/app/AppLoader'
import Logo from '@/components/brand/Logo'

// Split shell for sign-in and registration (Prompt 09 fills the card slot).
// Left: a quiet brand panel that disappears below `md` so a phone gets the full
// width for the form. Right: a centered, width-capped slot — pages render their
// own Card inside it.
//
// The panel is washed in the brand *tints*, not the brand gradient: 00 §6 keeps
// the saturated gradient for CTAs, the logo, and small accents, so the only
// place it appears here is the logo mark itself.

const MAIN_ID = 'main'

const VALUE_POINTS = [
  'Vetted creators across food, retail, fitness, travel, and SaaS brands',
  'Payments held securely until you approve the delivered content',
  'Every upload reviewed against the BetterBlue Content Policy',
]

export default function AuthLayout() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 5fr) minmax(0, 7fr)' },
      }}
    >
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 6,
          p: { md: 6, lg: 8 },
          backgroundImage: (theme) =>
            `linear-gradient(160deg, ${theme.palette.primary.surface} 0%, ${theme.palette.secondary.surface} 100%)`,
          borderRight: 1,
          borderColor: 'divider',
        }}
      >
        <Logo variant="full" size={32} />

        <Stack spacing={3}>
          <Typography variant="h3" component="p" sx={{ maxWidth: '16ch' }}>
            Commercial content, made by creators your brand can trust
          </Typography>

          <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {VALUE_POINTS.map((point) => (
              <Stack component="li" key={point} direction="row" spacing={1.5}>
                <Box sx={{ color: 'primary.main', display: 'flex', pt: '2px' }}>
                  <Icon icon="tabler:circle-check" width={20} />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {point}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Stack>

        <Typography variant="caption" color="text.secondary">
          © 2026 BetterBlue. Professional commercial content marketplace.
        </Typography>
      </Box>

      <Box
        component="main"
        id={MAIN_ID}
        tabIndex={-1}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          px: { xs: 2, md: 4 },
          py: { xs: 5, md: 8 },
          outline: 'none',
        }}
      >
        <Stack spacing={4} sx={{ width: '100%', maxWidth: 440 }}>
          {/* The brand panel is hidden on phones, so the logo comes along here. */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, justifyContent: 'center' }}>
            <Logo asLink size={30} />
          </Box>

          <Suspense fallback={<AppLoader />}>
            <Outlet />
          </Suspense>
        </Stack>
      </Box>

      <ScrollRestoration />
    </Box>
  )
}
