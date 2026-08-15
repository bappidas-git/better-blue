import { useId } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

import FadeInView from '@/components/motion/FadeInView'
import { useAuth } from '@/context/AuthContext'
import { paths } from '@/routes/paths'

// The closing panel on an information page. Deliberately quieter than the
// landing page's full-colour band (00 §6 — the gradient is an accent): a tinted
// card with the gradient kept to the primary button.
//
// Like the landing CTAs, a sign-up call to action is auth-aware: asking someone
// who is already signed in to "join BetterBlue" is the fastest way to look
// broken, so a primary action pointing at `/register` becomes their dashboard
// instead. Any other primary action (contacting support, say) is left alone.

/**
 * @param {object} props
 * @param {React.ReactNode} props.title panel heading (an `h2`)
 * @param {React.ReactNode} [props.description] supporting copy
 * @param {{label: string, to: string, icon?: string}} props.primary primary action
 * @param {{label: string, to: string, icon?: string}} [props.secondary] secondary action
 */
export default function InfoCtaBand({ title, description, primary, secondary }) {
  const headingId = useId()
  const { user, isAuthenticated } = useAuth()

  const primaryCta =
    isAuthenticated && primary.to === paths.REGISTER
      ? { label: 'Go to dashboard', to: paths.roleHome(user.role), icon: 'tabler:layout-dashboard' }
      : primary

  return (
    <FadeInView component="section" aria-labelledby={headingId}>
      <Box
        sx={{
          borderRadius: 4,
          bgcolor: 'primary.surface',
          border: 1,
          borderColor: 'primary.lighter',
          px: { xs: 3, md: 6 },
          py: { xs: 4, md: 6 },
        }}
      >
        <Stack spacing={2} alignItems={{ xs: 'stretch', md: 'center' }} textAlign={{ md: 'center' }}>
          <Typography id={headingId} variant="h4" component="h2">
            {title}
          </Typography>

          {description ? (
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '58ch' }}>
              {description}
            </Typography>
          ) : null}

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{ pt: 1, width: { xs: '100%', sm: 'auto' }, justifyContent: 'center' }}
          >
            <Button
              component={RouterLink}
              to={primaryCta.to}
              variant="gradient"
              size="large"
              startIcon={primaryCta.icon ? <Icon icon={primaryCta.icon} width={20} /> : null}
            >
              {primaryCta.label}
            </Button>

            {secondary ? (
              <Button
                component={RouterLink}
                to={secondary.to}
                variant="outlined"
                size="large"
                startIcon={secondary.icon ? <Icon icon={secondary.icon} width={20} /> : null}
              >
                {secondary.label}
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </Box>
    </FadeInView>
  )
}
