import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

import useDocumentTitle from '@/hooks/useDocumentTitle'
import { paths } from '@/routes/paths'

// STUB: the landing page's "how it works" section links here, and a marketing
// page must never hand a visitor a 404. Prompt 12 replaces this with the full
// walkthrough (the four steps in detail, escrow, revisions, disputes, and the
// content policy); until then this page states the workflow in one paragraph
// and keeps both routes out of it available.

export default function HowItWorksPage() {
  useDocumentTitle('How it works')

  return (
    <Container maxWidth="md" sx={{ px: { xs: 2, md: 4 }, py: { xs: 8, md: 12 } }}>
      <Stack spacing={3}>
        <Stack spacing={1.5}>
          <Typography variant="overline" component="p" sx={{ color: 'primary.main' }}>
            How it works
          </Typography>
          <Typography variant="h2" component="h1">
            Brief, proposals, production, release
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '68ch' }}>
            A business posts a content request describing the deliverables, budget, deadline,
            and usage rights. Creators respond with priced proposals. When one is accepted, the
            buyer funds the order and BetterBlue holds the payment in escrow while the creator
            produces and delivers the content. Once the buyer approves the deliverable, the
            payment is released to the creator, minus the platform commission.
          </Typography>
        </Stack>

        <Alert severity="info" icon={<Icon icon="tabler:info-circle" width={20} />}>
          The full guide — with the revision, dispute, and content-policy detail — is coming to
          this page shortly.
        </Alert>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ pt: 1, width: { xs: '100%', sm: 'auto' } }}
        >
          <Button component={RouterLink} to={paths.REGISTER} variant="gradient" size="large">
            Post a content request
          </Button>
          <Button component={RouterLink} to={paths.HOME} variant="outlined" size="large">
            Back to home
          </Button>
        </Stack>
      </Stack>
    </Container>
  )
}
