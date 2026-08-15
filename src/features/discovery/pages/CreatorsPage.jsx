import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

import useDocumentTitle from '@/hooks/useDocumentTitle'
import { paths } from '@/routes/paths'

// STUB (Prompt 11): "Find Creators" is in the public top nav, the footer, and
// the 404 page, and Prompt 11 requires every nav and footer link to resolve —
// so this route exists rather than handing a visitor a 404.
//
// Prompt 12 replaces this file with the real discovery page (search, filters,
// sort, URL-synced state, creator cards); the route entry it registers in
// `publicRoutes.jsx` stays as it is.

export default function CreatorsPage() {
  useDocumentTitle('Find creators')

  return (
    <Container maxWidth="md" sx={{ px: { xs: 2, md: 4 }, py: { xs: 8, md: 12 } }}>
      <Stack spacing={3}>
        <Stack spacing={1.5}>
          <Typography variant="overline" component="p" sx={{ color: 'primary.main' }}>
            Find creators
          </Typography>
          <Typography variant="h2" component="h1">
            Browse creators by category, rating, and rate
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '68ch' }}>
            BetterBlue creators publish portfolios of the commercial work they want to be hired
            for — product and brand photography, short-form video, testimonials, and lifestyle
            content. Searchable discovery lands here shortly.
          </Typography>
        </Stack>

        <Alert severity="info" icon={<Icon icon="tabler:info-circle" width={20} />}>
          Creator discovery is being built. In the meantime, publish a content request and
          creators will come to you with priced proposals.
        </Alert>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ pt: 1, width: { xs: '100%', sm: 'auto' } }}
        >
          <Button component={RouterLink} to={paths.REGISTER} variant="gradient" size="large">
            Post a content request
          </Button>
          <Button component={RouterLink} to={paths.HOW_IT_WORKS} variant="outlined" size="large">
            See how it works
          </Button>
        </Stack>
      </Stack>
    </Container>
  )
}
