import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

import useDocumentTitle from '@/hooks/useDocumentTitle'
import { paths } from '@/routes/paths'

// STUB (Prompt 11): "Browse Requests" is in the public top nav and the footer,
// and Prompt 11 requires every nav and footer link to resolve — so this route
// exists rather than handing a visitor a 404.
//
// Prompt 23 replaces this file with the real request board (search, filters,
// board cards, and the auth-gated proposal flow behind them); the route entry
// it registers in `publicRoutes.jsx` stays as it is.

export default function RequestBoardPage() {
  useDocumentTitle('Browse content requests')

  return (
    <Container maxWidth="md" sx={{ px: { xs: 2, md: 4 }, py: { xs: 8, md: 12 } }}>
      <Stack spacing={3}>
        <Stack spacing={1.5}>
          <Typography variant="overline" component="p" sx={{ color: 'primary.main' }}>
            Browse requests
          </Typography>
          <Typography variant="h2" component="h1">
            Open briefs from businesses hiring creators
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '68ch' }}>
            Businesses publish content requests with the deliverables, budget, deadline, and
            usage rights they need, and creators respond with priced proposals. The public board
            lands here shortly.
          </Typography>
        </Stack>

        <Alert severity="info" icon={<Icon icon="tabler:info-circle" width={20} />}>
          The request board is being built. Create a creator account now and your portfolio will
          be ready for review by the time briefs open up.
        </Alert>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ pt: 1, width: { xs: '100%', sm: 'auto' } }}
        >
          <Button component={RouterLink} to={paths.REGISTER} variant="gradient" size="large">
            Become a creator
          </Button>
          <Button component={RouterLink} to={paths.HOW_IT_WORKS} variant="outlined" size="large">
            See how it works
          </Button>
        </Stack>
      </Stack>
    </Container>
  )
}
