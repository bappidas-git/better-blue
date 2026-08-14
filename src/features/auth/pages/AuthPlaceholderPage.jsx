import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import { Link as RouterLink } from 'react-router-dom'

import useDocumentTitle from '@/hooks/useDocumentTitle'
import { paths } from '@/routes/paths'

// TEMP: replaced in Prompt 09 by the real LoginPage / RegisterPage (forms,
// AuthContext, guards, role redirects). It exists now so /login and /register
// are real, deep-linkable routes that prove AuthLayout works instead of blank
// screens or a 404.

const COPY = {
  login: {
    title: 'Log in',
    lead: 'Sign in to manage your content requests, proposals, and orders.',
    swapLabel: 'Create an account instead',
    swapTo: paths.REGISTER,
  },
  register: {
    title: 'Join BetterBlue',
    lead: 'Create an account as a business commissioning content, or as a creator producing it.',
    swapLabel: 'I already have an account',
    swapTo: paths.LOGIN,
  },
}

/**
 * @param {object} props
 * @param {'login'|'register'} props.mode which screen this placeholder stands in for
 */
export default function AuthPlaceholderPage({ mode = 'login' }) {
  const copy = COPY[mode] ?? COPY.login
  useDocumentTitle(copy.title)

  return (
    <Card>
      <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
        <Stack spacing={2}>
          <Typography variant="h4" component="h1">
            {copy.title}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {copy.lead}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            The sign-in form arrives in Prompt 09.
          </Typography>
          <Button
            component={RouterLink}
            to={copy.swapTo}
            variant="outlined"
            sx={{ alignSelf: 'flex-start' }}
          >
            {copy.swapLabel}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  )
}
