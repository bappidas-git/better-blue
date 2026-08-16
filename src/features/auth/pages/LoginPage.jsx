import { useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { motion } from 'framer-motion'
import { Link as RouterLink } from 'react-router-dom'

import FormTextField from '@/components/inputs/FormTextField'
import { fadeInUp } from '@/components/motion/motionPresets'
import { useAuth } from '@/context/AuthContext'
import AccountStatusScreen from '@/features/auth/components/AccountStatusScreen'
import DemoAccountsPanel from '@/features/auth/components/DemoAccountsPanel'
import PasswordField from '@/features/auth/components/PasswordField'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import useForm from '@/hooks/useForm'
import { paths } from '@/routes/paths'
import { API_ERROR_CODE } from '@/services/api/apiError'
import { compose, email as emailRule, required } from '@/utils/validators'

// Sign-in. The form validates locally, `AuthContext.login()` owns everything
// after that, and `GuestRoute` performs the redirect once the session lands —
// so this page never navigates, never touches storage, and never decides where
// anyone goes (00 §16.9).
//
// Two failures are worth telling apart. A rejected credential belongs in the
// alert region above the fields, where the person can fix it and retry; a
// non-active account is not a form error at all, so `AccountStatusScreen`
// replaces the form entirely.

/** Friendly copy per failure. The service's own message wins where it has one. */
function toErrorCopy(error) {
  if (!error) return null
  if (error.code === API_ERROR_CODE.NETWORK_ERROR) {
    return {
      title: 'We could not reach BetterBlue',
      body: `${error.message} Your details have been kept — try again in a moment.`,
    }
  }
  if (error.code === API_ERROR_CODE.UNAUTHORIZED) {
    return {
      title: 'Incorrect email or password',
      body: 'Check both and try again. Passwords are case-sensitive.',
    }
  }
  return { title: 'We could not sign you in', body: error.message }
}

export default function LoginPage() {
  useDocumentTitle('Log in')

  const { login, logout, accountStatusIssue, dismissAccountStatusIssue } = useAuth()
  const [error, setError] = useState(null)

  const form = useForm({
    initialValues: { email: '', password: '' },
    validators: {
      email: compose(required('Enter the email address you signed up with.'), emailRule()),
      password: required('Enter your password.'),
    },
  })

  const submit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      await login({ email: values.email, password: values.password })
      // No navigation here: the session changes, GuestRoute re-renders, and the
      // person lands on the page they were headed for (or their role home).
    } catch (failure) {
      setError(failure)
    }
  })

  // A suspended, blacklisted, or deactivated account (contract §2.3). Not
  // something a retry can fix, so the form makes way for an explanation.
  //
  // This screen also catches the *other* way an account is stopped: a boot
  // `me()` that came back `forbidden`, which signs the person out where they
  // stood and leaves the reason here. Signing out again is deliberate — it
  // clears anything left on this device and returns them to the public site.
  if (accountStatusIssue) {
    return (
      <AccountStatusScreen
        accountStatus={accountStatusIssue.accountStatus}
        message={accountStatusIssue.message}
        onDismiss={() => {
          dismissAccountStatusIssue()
          setError(null)
          form.reset()
        }}
        onSignOut={logout}
      />
    )
  }

  const errorCopy = toErrorCopy(error)

  return (
    <Card component={motion.div} variants={fadeInUp} initial="hidden" animate="visible">
      <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
        <Stack spacing={3}>
          <Stack spacing={1}>
            <Typography variant="h4" component="h1">
              Welcome back
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sign in to manage your content requests, proposals, and orders.
            </Typography>
          </Stack>

          {/* The live region is always announced when it appears; keeping it
              out of the DOM until there is something to say stops screen
              readers reporting an empty alert on every render. */}
          {errorCopy ? (
            <Alert
              severity="error"
              role="alert"
              icon={<Icon icon="tabler:alert-circle" width={22} />}
            >
              <Box component="span" sx={{ fontWeight: 600, display: 'block' }}>
                {errorCopy.title}
              </Box>
              {errorCopy.body}
            </Alert>
          ) : null}

          {/* A real <form>, so Enter submits from any field. */}
          <Box component="form" onSubmit={submit} noValidate>
            <Stack spacing={2.5}>
              <FormTextField
                label="Email address"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                {...form.fieldProps('email')}
              />

              <Box>
                <PasswordField
                  label="Password"
                  autoComplete="current-password"
                  required
                  {...form.fieldProps('password')}
                />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Link
                    component={RouterLink}
                    to={paths.FORGOT_PASSWORD}
                    variant="body2"
                    // A standalone control rather than a link inside a
                    // sentence, so it gets a real tap target (00 §13). The
                    // padding replaces the margin the wrapper used to add.
                    sx={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, px: 0.5 }}
                  >
                    Forgot your password?
                  </Link>
                </Box>
              </Box>

              <Button
                type="submit"
                variant="gradient"
                size="large"
                fullWidth
                disabled={form.isSubmitting}
                startIcon={
                  form.isSubmitting ? (
                    <CircularProgress size={18} color="inherit" aria-hidden="true" />
                  ) : undefined
                }
              >
                {form.isSubmitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </Stack>
          </Box>

          <Divider />

          <Typography variant="body2" color="text.secondary" textAlign="center">
            New to BetterBlue?{' '}
            <Link component={RouterLink} to={paths.REGISTER}>
              Create an account
            </Link>
          </Typography>

          <DemoAccountsPanel
            disabled={form.isSubmitting}
            onFill={(credentials) => {
              setError(null)
              form.setValues(credentials)
            }}
          />
        </Stack>
      </CardContent>
    </Card>
  )
}
