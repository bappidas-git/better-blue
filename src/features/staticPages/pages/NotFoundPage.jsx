import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

import Logo from '@/components/brand/Logo'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import { paths } from '@/routes/paths'

// The router's catch-all. Anything the route table cannot match lands here
// inside PublicLayout, so people keep the nav and footer and never hit a blank
// screen (00 §12: an empty result always offers the way out).

export default function NotFoundPage() {
  useDocumentTitle('Page not found')

  return (
    <Container maxWidth="sm" sx={{ px: { xs: 2, md: 4 }, py: { xs: 8, md: 14 } }}>
      <Stack spacing={3} alignItems="center" textAlign="center">
        <Logo variant="mark" size={48} />

        <Stack spacing={1.5} alignItems="center">
          <Typography variant="overline" component="p" color="text.secondary">
            Error 404
          </Typography>
          <Typography variant="h3" component="h1">
            We could not find that page
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '48ch' }}>
            The link may be out of date, or the page may have moved. Start from the home page
            or jump straight into the creator marketplace.
          </Typography>
        </Stack>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ pt: 1, width: { xs: '100%', sm: 'auto' } }}
        >
          <Button component={RouterLink} to={paths.HOME} variant="gradient" size="large">
            Go to home
          </Button>
          <Button component={RouterLink} to={paths.CREATORS} variant="outlined" size="large">
            Find creators
          </Button>
        </Stack>
      </Stack>
    </Container>
  )
}
