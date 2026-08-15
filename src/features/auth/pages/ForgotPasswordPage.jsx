import { useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CircularProgress from '@mui/material/CircularProgress'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { motion } from 'framer-motion'
import { Link as RouterLink } from 'react-router-dom'

import FormTextField from '@/components/inputs/FormTextField'
import { fadeInUp } from '@/components/motion/motionPresets'
import { appConfig } from '@/config/appConfig'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import useForm from '@/hooks/useForm'
import { paths } from '@/routes/paths'
import { compose, email as emailRule, required } from '@/utils/validators'

// Password reset — the request half of it.
//
// MOCK-AUTH: **nothing is sent.** There is no reset endpoint in the contract
// (§2.1 defines login, register, me, and logout only) and no mail transport
// behind JSON Server, so this screen collects the address, validates it, and
// shows the confirmation. It is here because a sign-in form without a way out
// of a forgotten password is a dead end, and because the copy and the flow are
// the parts worth designing now.
//
// The confirmation is deliberately the *same* whether or not the address has an
// account. That is the standard defence against using a reset form to discover
// which addresses are registered — and it is the behaviour Laravel's
// `Password::sendResetLink` already implements, so this screen does not change
// when the real endpoint (`POST /auth/forgot-password` → `204`) arrives.

export default function ForgotPasswordPage() {
  useDocumentTitle('Reset your password')

  const [submittedTo, setSubmittedTo] = useState(null)

  const form = useForm({
    initialValues: { email: '' },
    validators: {
      email: compose(required('Enter the email address you signed up with.'), emailRule()),
    },
  })

  const submit = form.handleSubmit(async (values) => {
    // MOCK-AUTH: no request. Laravel replaces this line with
    // `apiClient.post('/auth/forgot-password', { email })`, and the success
    // state below stays exactly as it is.
    setSubmittedTo(values.email.trim())
  })

  if (submittedTo) {
    return (
      <Card component={motion.div} variants={fadeInUp} initial="hidden" animate="visible">
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={3}>
            <Box
              aria-hidden="true"
              sx={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                bgcolor: (theme) => alpha(theme.palette.success.main, 0.14),
                color: 'success.dark',
              }}
            >
              <Icon icon="tabler:mail-check" width={28} />
            </Box>

            <Stack spacing={1.5}>
              <Typography variant="h5" component="h1">
                Check your inbox
              </Typography>
              {/* Announced on arrival — the form it replaced is gone, so
                  without this the change is silent to a screen reader. */}
              <Typography variant="body1" color="text.secondary" role="status">
                If an account exists for <strong>{submittedTo}</strong>, we have sent reset
                instructions to it. The link is valid for one hour.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Nothing arrived? Check your spam folder, or email{' '}
                <Link href={`mailto:${appConfig.supportEmail}`}>{appConfig.supportEmail}</Link>.
              </Typography>
            </Stack>

            <Stack spacing={1}>
              <Button component={RouterLink} to={paths.LOGIN} variant="contained" size="large">
                Back to sign in
              </Button>
              <Button
                variant="text"
                color="inherit"
                size="large"
                onClick={() => {
                  setSubmittedTo(null)
                  form.reset()
                }}
              >
                Use a different email address
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card component={motion.div} variants={fadeInUp} initial="hidden" animate="visible">
      <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
        <Stack spacing={3}>
          <Stack spacing={1}>
            <Typography variant="h4" component="h1">
              Reset your password
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Enter the email address on your account and we will send you a link to choose a new
              password.
            </Typography>
          </Stack>

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
                {form.isSubmitting ? 'Sending…' : 'Send reset instructions'}
              </Button>
            </Stack>
          </Box>

          <Typography variant="body2" color="text.secondary" textAlign="center">
            Remembered it?{' '}
            <Link component={RouterLink} to={paths.LOGIN}>
              Back to sign in
            </Link>
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  )
}
