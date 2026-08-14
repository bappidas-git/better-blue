import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

import useDocumentTitle from '@/hooks/useDocumentTitle'
import { paths } from '@/routes/paths'

// TEMP: replaced in Prompt 10 by the real landing page (GSAP hero, scroll
// scenes, category rails, social proof). This placeholder exists so the router
// has a home route to mount and the shell can be verified end to end.

export default function HomePage() {
  useDocumentTitle('Commercial content marketplace')

  return (
    <Container maxWidth="md" sx={{ px: { xs: 2, md: 4 }, py: { xs: 8, md: 14 } }}>
      <Stack spacing={3} alignItems={{ xs: 'flex-start', md: 'center' }}>
        <Typography
          variant="overline"
          component="p"
          sx={{ color: 'primary.main', fontWeight: 700 }}
        >
          Professional UGC, on demand
        </Typography>

        <Typography
          variant="h1"
          component="h1"
          sx={{ maxWidth: '18ch', textAlign: { xs: 'left', md: 'center' } }}
        >
          Commercial content, made by creators your brand can trust
        </Typography>

        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ maxWidth: '60ch', textAlign: { xs: 'left', md: 'center' } }}
        >
          Post a brief, compare proposals from vetted creators, and pay only when the
          photos and videos you commissioned are delivered and approved.
        </Typography>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ pt: 1, width: { xs: '100%', sm: 'auto' } }}
        >
          <Button
            component={RouterLink}
            to={paths.CREATORS}
            variant="gradient"
            size="large"
            sx={{ borderRadius: 999 }}
          >
            Find creators
          </Button>
          <Button component={RouterLink} to={paths.REQUESTS} variant="outlined" size="large">
            Browse open requests
          </Button>
        </Stack>

        <Box sx={{ pt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Placeholder landing page — the full experience arrives in Prompt 10.
          </Typography>
        </Box>
      </Stack>
    </Container>
  )
}
