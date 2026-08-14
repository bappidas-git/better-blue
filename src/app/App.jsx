import { Suspense, lazy } from 'react'

import { Box, Stack, Typography } from '@mui/material'
import { visuallyHidden } from '@mui/utils'

import Logo from '@/components/brand/Logo'
import { env } from '@/config/env'

// Temporary dev-only mount for the design gallery (00 §4). `import.meta.env.DEV`
// is statically replaced at build time, so the gallery chunk never ships in
// production bundles. Prompt 08 replaces this with the real router and moves
// the gallery to /dev/design.
const DevDesignPage = import.meta.env.DEV
  ? lazy(() => import('@/features/dashboard/pages/DevDesignPage'))
  : null

export default function App() {
  if (DevDesignPage && env.enableDevPages) {
    return (
      <Suspense fallback={null}>
        <DevDesignPage />
      </Suspense>
    )
  }

  // Themed placeholder shell — replaced by the real app shell in Prompt 08.
  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: { xs: 2, md: 4 },
      }}
    >
      <Stack spacing={2.5} alignItems="center" textAlign="center">
        <Typography component="h1" sx={visuallyHidden}>
          BetterBlue
        </Typography>
        <Logo variant="full" size={40} />
        <Typography variant="body1" color="text.secondary">
          Commercial content, made by creators.
        </Typography>
        <Typography variant="caption" color="text.secondary">
          API: {env.apiBaseUrl}
        </Typography>
      </Stack>
    </Box>
  )
}
