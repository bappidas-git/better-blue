import { useId, useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

import FormSelect from '@/components/inputs/FormSelect'
import FormTextField from '@/components/inputs/FormTextField'
import { useToast } from '@/components/feedback/ToastProvider'
import FadeInView from '@/components/motion/FadeInView'
import { appConfig } from '@/config/appConfig'
import { useAuth } from '@/context/AuthContext'
import useApiMutation from '@/hooks/useApiMutation'
import useForm from '@/hooks/useForm'
import { paths } from '@/routes/paths'
import { supportService } from '@/services'
import { compose, email, minLength, oneOf, required } from '@/utils/validators'

import InfoPageLayout from '../components/InfoPageLayout'
import {
  CONTACT_INTRO,
  CONTACT_RESPONSE_TIME,
  CONTACT_ROUTES,
  CONTACT_SUBJECTS,
  contactSubjectLabel,
} from '../content/contact'

// Contact support. The form writes a real `supportTickets` record through
// `supportService.createTicket` — the same inbox the admin console reads
// (contract §6.22) — so a message sent here is a ticket, not a mailto.
//
// Signed-out visitors can use it: name and email live on the ticket itself, and
// `userId` is attached only when there is a session to attach.

const MIN_MESSAGE_LENGTH = 20

const SUBJECT_VALUES = CONTACT_SUBJECTS.map((subject) => subject.value)

export default function ContactPage() {
  const toast = useToast()
  const { user } = useAuth()
  const formHeadingId = useId()
  const asideHeadingId = useId()

  const [sentTicket, setSentTicket] = useState(null)
  const { mutate, isLoading, error, reset: resetMutation } = useApiMutation(
    supportService.createTicket
  )

  // Prefilled from the session when there is one — nobody signed in should have
  // to retype their own name and address.
  const form = useForm({
    initialValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      subject: '',
      message: '',
    },
    validators: {
      name: compose(required('Tell us who to reply to.'), minLength(2)),
      email: compose(required('We need an email address to reply to.'), email()),
      subject: compose(required('Choose what your message is about.'), oneOf(SUBJECT_VALUES)),
      message: compose(
        required('Tell us what you need help with.'),
        minLength(
          MIN_MESSAGE_LENGTH,
          `Please add a little more detail — at least ${MIN_MESSAGE_LENGTH} characters.`
        )
      ),
    },
  })

  /** Spreadable field props, with an errored helper announced as an alert. */
  const fieldProps = (name) => {
    const props = form.fieldProps(name)
    return props.error ? { ...props, FormHelperTextProps: { role: 'alert' } } : props
  }

  const handleSubmit = form.handleSubmit(async (values, { reset }) => {
    try {
      const ticket = await mutate({
        name: values.name.trim(),
        email: values.email.trim(),
        // The topic label is what the support inbox displays as the subject.
        subject: contactSubjectLabel(values.subject),
        body: values.message.trim(),
        ...(user?.id ? { userId: user.id } : null),
      })

      setSentTicket(ticket)
      toast.success('Message sent', { description: CONTACT_RESPONSE_TIME })
      reset()
    } catch (failure) {
      // The values stay exactly as typed — a failed send must never cost
      // someone their message (00 §12).
      toast.error('We could not send your message', { description: failure.message })
    }
  })

  return (
    <InfoPageLayout
      documentTitle="Contact us"
      eyebrow="Support"
      title="Contact BetterBlue"
      intro={CONTACT_INTRO}
      maxWidth="lg"
      contentWidth="wide"
    >
      <Box
        sx={{
          display: 'grid',
          alignItems: 'start',
          gap: { xs: 3, md: 5 },
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 7fr) minmax(0, 5fr)' },
        }}
      >
        <FadeInView component="section" aria-labelledby={formHeadingId}>
          <Card>
            <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
              {sentTicket ? (
                <Stack spacing={2.5} alignItems="flex-start">
                  <Box
                    aria-hidden="true"
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: 'success.main',
                      color: 'success.contrastText',
                    }}
                  >
                    <Icon icon="tabler:check" width={28} />
                  </Box>

                  <Box>
                    <Typography id={formHeadingId} variant="h5" component="h2">
                      Thanks — your message is with us
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                      {CONTACT_RESPONSE_TIME} We will reply to the address you gave us.
                    </Typography>
                  </Box>

                  <Typography variant="body2" color="text.secondary">
                    Your reference is{' '}
                    <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                      {sentTicket.id}
                    </Box>
                    . Quote it if you need to follow up.
                  </Typography>

                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1.5}
                    sx={{ width: { xs: '100%', sm: 'auto' } }}
                  >
                    <Button
                      variant="outlined"
                      startIcon={<Icon icon="tabler:pencil-plus" width={20} />}
                      onClick={() => {
                        setSentTicket(null)
                        resetMutation()
                      }}
                    >
                      Send another message
                    </Button>
                    <Button component={RouterLink} to={paths.FAQ} variant="text">
                      Browse the FAQ
                    </Button>
                  </Stack>
                </Stack>
              ) : (
                <Stack component="form" spacing={2.5} onSubmit={handleSubmit} noValidate>
                  <Box>
                    <Typography id={formHeadingId} variant="h5" component="h2">
                      Send us a message
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {CONTACT_RESPONSE_TIME}
                    </Typography>
                  </Box>

                  {error ? (
                    <Alert severity="error" role="alert">
                      {error.message}
                    </Alert>
                  ) : null}

                  <FormTextField
                    label="Your name"
                    required
                    autoComplete="name"
                    {...fieldProps('name')}
                  />

                  <FormTextField
                    label="Email address"
                    type="email"
                    required
                    autoComplete="email"
                    helperText="Where we send our reply."
                    {...fieldProps('email')}
                  />

                  <FormSelect
                    label="What is it about?"
                    required
                    options={CONTACT_SUBJECTS}
                    placeholder="Choose a topic"
                    {...fieldProps('subject')}
                  />

                  <FormTextField
                    label="Message"
                    required
                    multiline
                    minRows={5}
                    maxLength={2000}
                    helperText="Include any order or request reference you already have."
                    {...fieldProps('message')}
                  />

                  <Box>
                    <Button
                      type="submit"
                      variant="gradient"
                      size="large"
                      disabled={isLoading}
                      startIcon={<Icon icon="tabler:send" width={20} />}
                      sx={{ width: { xs: '100%', sm: 'auto' } }}
                    >
                      {isLoading ? 'Sending…' : 'Send message'}
                    </Button>
                  </Box>
                </Stack>
              )}
            </CardContent>
          </Card>
        </FadeInView>

        <FadeInView component="aside" aria-labelledby={asideHeadingId} delay={0.08}>
          <Stack spacing={3}>
            <Box>
              <Typography id={asideHeadingId} variant="h6" component="h2">
                Before you write
              </Typography>

              <Stack spacing={2.5} sx={{ mt: 2 }}>
                {CONTACT_ROUTES.map((route) => (
                  <Stack key={route.key} direction="row" spacing={1.5} alignItems="flex-start">
                    <Box
                      aria-hidden="true"
                      sx={{
                        width: 40,
                        height: 40,
                        flexShrink: 0,
                        borderRadius: 2,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: 'primary.surface',
                        color: 'primary.main',
                      }}
                    >
                      <Icon icon={route.icon} width={20} />
                    </Box>

                    <Box>
                      <Typography variant="subtitle2" component="h3">
                        {route.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                        {route.description}
                      </Typography>
                    </Box>
                  </Stack>
                ))}
              </Stack>
            </Box>

            <Box
              sx={{
                borderRadius: 3,
                border: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
                p: 2.5,
              }}
            >
              <Typography variant="subtitle2" component="h3">
                Prefer email?
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Write to us at{' '}
                <Link href={`mailto:${appConfig.supportEmail}`} underline="hover">
                  {appConfig.supportEmail}
                </Link>
                . The form above reaches the same team and gives you a reference straight away.
              </Typography>

              <Stack direction="row" spacing={2} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
                <Link
                  component={RouterLink}
                  to={paths.FAQ}
                  variant="body2"
                  underline="hover"
                  sx={{ display: 'inline-flex', alignItems: 'center', minHeight: 44 }}
                >
                  Help &amp; FAQ
                </Link>
                <Link
                  component={RouterLink}
                  to={paths.CONTENT_POLICY}
                  variant="body2"
                  underline="hover"
                  sx={{ display: 'inline-flex', alignItems: 'center', minHeight: 44 }}
                >
                  Content Policy
                </Link>
              </Stack>
            </Box>
          </Stack>
        </FadeInView>
      </Box>
    </InfoPageLayout>
  )
}
