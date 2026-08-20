import { useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Checkbox from '@mui/material/Checkbox'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormHelperText from '@mui/material/FormHelperText'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { motion } from 'framer-motion'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'

import FormTextField from '@/components/inputs/FormTextField'
import { fadeInUp } from '@/components/motion/motionPresets'
import { ROLE_META, ROLES } from '@/constants/roles'
import { useAuth } from '@/context/AuthContext'
import PasswordField from '@/features/auth/components/PasswordField'
import RoleChoiceCards from '@/features/auth/components/RoleChoiceCards'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import useForm, { fieldId } from '@/hooks/useForm'
import { paths } from '@/routes/paths'
import { durations, easing } from '@/theme/motionTokens'
import {
  compose,
  email as emailRule,
  maxLength,
  minLength,
  oneOf,
  pattern,
  required,
} from '@/utils/validators'

// Registration, in two steps: what kind of account, then the details for it.
//
// Splitting them is what lets step two ask the right question — "what is your
// company called?" for a business, "what should buyers see?" for a creator —
// instead of one form hedging both. The chosen role is plain component state
// because it is the *shape* of the second step, not a field in it; everything
// step two collects lives in `useForm`, so stepping back and forward again
// never loses what was already typed.
//
// `AuthContext.register()` creates the account, its profile row, and the
// session; `GuestRoute` performs the redirect. This page decides neither.
//
// V2-06 added one way in from outside: `/register?role=buyer|creator` answers
// step one before the page opens, so a visitor who pressed "Register as a
// Creator" on the storefront lands on the details for that account rather than
// being asked the question they just answered. The choice stays theirs — the
// step header names the account being created and offers "Change" back to step
// one — and anything the parameter does not recognise is ignored.

const STEP = { ROLE: 0, DETAILS: 1 }

/**
 * URL parameter that preselects the account type. `paths.registerAs(role)`
 * builds the links; the landing page's audience panels, its closing band, and
 * `RoleGateDialog` are what send them.
 */
export const ROLE_PARAM = 'role'

/**
 * The roles a visitor may create for themselves. Admins are provisioned by the
 * admin team (Prompt 36), never registered, so a `?role=admin` URL falls
 * through to the role step like any other unrecognised value.
 */
const JOINABLE_ROLES = [ROLES.BUYER, ROLES.CREATOR]

/** Card body floor, so stepping forward never snaps the card shorter. */
const MIN_BODY_HEIGHT = 300

const PASSWORD_HINT = 'At least 8 characters, including a letter and a number.'

const ROLE_REQUIRED_MESSAGE =
  'Choose whether you are joining as a business or as a creator.'

/** The second name field changes with the role — the whole point of step one. */
const PROFILE_FIELD = {
  [ROLES.BUYER]: {
    name: 'companyName',
    label: 'Company name',
    helper: 'The business commissioning the content. You can change this later.',
    autoComplete: 'organization',
  },
  [ROLES.CREATOR]: {
    name: 'displayName',
    label: 'Creator or studio name',
    helper: 'How buyers will see you across the marketplace. You can change this later.',
    autoComplete: 'nickname',
  },
}

/** Step-two rules. The profile field is whichever one the role asks for. */
function detailValidators(profileField) {
  return {
    name: compose(required('Enter your name.'), minLength(2), maxLength(80)),
    [profileField.name]: compose(
      required(`Enter your ${profileField.label.toLowerCase()}.`),
      minLength(2),
      maxLength(80)
    ),
    email: compose(required('Enter your email address.'), emailRule()),
    password: compose(
      required('Choose a password.'),
      minLength(8, PASSWORD_HINT),
      pattern(/[A-Za-z]/, PASSWORD_HINT),
      pattern(/\d/, PASSWORD_HINT)
    ),
    confirmPassword: compose(
      required('Re-enter your password.'),
      (value, values) => (value === values.password ? undefined : 'Both passwords must match.')
    ),
    // `required()` treats `false` as a value, so the acceptance box needs the
    // rule that insists on `true` specifically.
    acceptedTerms: oneOf([true], 'Please accept the Terms of Service and Content Policy.'),
  }
}

export default function RegisterPage() {
  useDocumentTitle('Create your account')

  const { register } = useAuth()
  const [searchParams] = useSearchParams()

  // The `?role=` parameter is read once, at mount, and the chosen role is plain
  // state from there on: a visitor who steps back and picks the other card is
  // not fighting the URL that opened the page, and nothing has to rewrite it.
  const [role, setRole] = useState(() => {
    const requested = searchParams.get(ROLE_PARAM)
    return JOINABLE_ROLES.includes(requested) ? requested : ''
  })
  const [step, setStep] = useState(() => (role ? STEP.DETAILS : STEP.ROLE))
  const [roleError, setRoleError] = useState(null)
  const [error, setError] = useState(null)

  // Whether step two should take focus when it mounts — true once the visitor
  // has *stepped* into it, false when a `?role=` link opened the page there.
  // Moving focus into a field on page load would carry a screen reader past the
  // heading, the step's explanation, and the "Change" affordance (00 §13).
  const [focusDetails, setFocusDetails] = useState(false)

  const profileField = PROFILE_FIELD[role] ?? PROFILE_FIELD[ROLES.BUYER]

  const form = useForm({
    initialValues: {
      name: '',
      email: '',
      companyName: '',
      displayName: '',
      password: '',
      confirmPassword: '',
      acceptedTerms: false,
    },
    // `useForm` reads the validator map fresh on every submit and blur, so the
    // rule set follows the role without the form being rebuilt.
    validators: detailValidators(profileField),
  })

  function chooseRole(nextRole) {
    setRole(nextRole)
    setRoleError(null)
  }

  function handleRoleSubmit(event) {
    event.preventDefault()
    if (!role) {
      setRoleError(ROLE_REQUIRED_MESSAGE)
      return
    }
    setFocusDetails(true)
    setStep(STEP.DETAILS)
  }

  const handleDetailsSubmit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      await register({
        role,
        name: values.name,
        email: values.email,
        password: values.password,
        companyName: values.companyName,
        displayName: values.displayName,
      })
      // No navigation here — GuestRoute sends the new member to their role home.
    } catch (failure) {
      setError(failure)
    }
  })

  const isRoleStep = step === STEP.ROLE
  const roleLabel = ROLE_META[role]?.label

  return (
    <Card component={motion.div} variants={fadeInUp} initial="hidden" animate="visible">
      <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
        <Stack spacing={3}>
          <Stack spacing={1}>
            <Typography variant="overline" color="text.secondary">
              Step {step + 1} of 2
            </Typography>
            <Typography variant="h4" component="h1" id="register-heading">
              {isRoleStep ? 'Join BetterBlue' : 'Create your account'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isRoleStep
                ? 'Tell us how you plan to use BetterBlue. Each account is one or the other.'
                : 'A few details and you are in. The rest of your profile can wait.'}
            </Typography>

            {/* Which account is being created, and the way to change it — the
                answer to step one is otherwise invisible to someone a `?role=`
                link dropped straight onto step two. Outside the <form>, so it
                is never mistaken for one of its fields; the submit button below
                is the only thing Enter reaches. */}
            {isRoleStep || !roleLabel ? null : (
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                flexWrap="wrap"
                useFlexGap
                sx={{ pt: 0.5 }}
              >
                <Typography variant="body2" color="text.secondary">
                  Creating a{' '}
                  <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    {roleLabel}
                  </Box>{' '}
                  account
                </Typography>
                <Button
                  variant="text"
                  size="small"
                  disabled={form.isSubmitting}
                  onClick={() => setStep(STEP.ROLE)}
                  startIcon={<Icon icon="tabler:pencil" width={16} />}
                >
                  Change
                </Button>
              </Stack>
            )}
          </Stack>

          {error ? (
            <Alert
              severity="error"
              role="alert"
              icon={<Icon icon="tabler:alert-circle" width={22} />}
            >
              <Box component="span" sx={{ fontWeight: 600, display: 'block' }}>
                We could not create your account
              </Box>
              {error.message}
            </Alert>
          ) : null}

          {/* A real <form>, so Enter submits the step from any field. */}
          <Box
            component="form"
            onSubmit={isRoleStep ? handleRoleSubmit : handleDetailsSubmit}
            noValidate
          >
            {/* A floor rather than a fixed height: the card can grow for an
                error message, but never snaps shorter as the steps swap.
                The step animates *in* only — `key` remounts it, so there is no
                exit to wait on and the incoming fields are in the DOM (and
                focusable) the moment the step changes. */}
            <Box sx={{ minHeight: MIN_BODY_HEIGHT }}>
              <Box
                key={step}
                component={motion.div}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: durations.fast / 1000, ease: easing }}
              >
                {isRoleStep ? (
                  <Stack spacing={2}>
                    <RoleChoiceCards
                      name="register-role"
                      ariaLabelledBy="register-heading"
                      value={role}
                      onChange={chooseRole}
                    />
                    {roleError ? (
                      <FormHelperText error role="alert">
                        {roleError}
                      </FormHelperText>
                    ) : null}
                  </Stack>
                ) : (
                  <Stack spacing={2.5}>
                    {/* Stepping forward puts focus here, so a keyboard or
                        screen reader user carries on where the form did rather
                        than at the top of the document. `autoFocus` fires
                        exactly when this field mounts, which an effect on `step`
                        cannot promise. It is off for the one render that is not
                        a step at all — a `?role=` link opening the page here,
                        where taking focus would skip the heading (see
                        `focusDetails`). */}
                    <FormTextField
                      label="Your name"
                      autoComplete="name"
                      autoFocus={focusDetails}
                      required
                      {...form.fieldProps('name')}
                    />

                    <FormTextField
                      label={profileField.label}
                      helperText={profileField.helper}
                      autoComplete={profileField.autoComplete}
                      required
                      {...form.fieldProps(profileField.name)}
                    />

                    <FormTextField
                      label="Email address"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      required
                      {...form.fieldProps('email')}
                    />

                    <PasswordField
                      label="Password"
                      autoComplete="new-password"
                      helperText={PASSWORD_HINT}
                      required
                      {...form.fieldProps('password')}
                    />

                    <PasswordField
                      label="Confirm password"
                      autoComplete="new-password"
                      required
                      {...form.fieldProps('confirmPassword')}
                    />

                    <Box>
                      <FormControlLabel
                        sx={{ alignItems: 'flex-start', mr: 0 }}
                        control={
                          <Checkbox
                            id={fieldId('acceptedTerms')}
                            name="acceptedTerms"
                            checked={Boolean(form.values.acceptedTerms)}
                            onChange={(event) =>
                              form.setValue('acceptedTerms', event.target.checked)
                            }
                            onBlur={() => form.handleBlur('acceptedTerms')}
                            inputRef={form.registerField('acceptedTerms')}
                            sx={{ mt: -1 }}
                          />
                        }
                        label={
                          <Typography variant="body2" color="text.secondary">
                            I agree to the{' '}
                            <Link component={RouterLink} to={paths.TERMS}>
                              Terms of Service
                            </Link>{' '}
                            and the{' '}
                            <Link component={RouterLink} to={paths.CONTENT_POLICY}>
                              Content Policy
                            </Link>
                            , which sets out what may and may not be published on BetterBlue.
                          </Typography>
                        }
                      />
                      {form.touched.acceptedTerms && form.errors.acceptedTerms ? (
                        <FormHelperText error role="alert">
                          {form.errors.acceptedTerms}
                        </FormHelperText>
                      ) : null}
                    </Box>
                  </Stack>
                )}
              </Box>
            </Box>

            <Stack spacing={1} sx={{ pt: 3 }}>
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
                {isRoleStep
                  ? 'Continue'
                  : form.isSubmitting
                    ? 'Creating your account…'
                    : 'Create account'}
              </Button>

              {isRoleStep ? null : (
                <Button
                  variant="text"
                  color="inherit"
                  size="large"
                  fullWidth
                  disabled={form.isSubmitting}
                  onClick={() => setStep(STEP.ROLE)}
                  startIcon={<Icon icon="tabler:arrow-left" width={18} />}
                >
                  Back
                </Button>
              )}
            </Stack>
          </Box>

          <Divider />

          <Typography variant="body2" color="text.secondary" textAlign="center">
            Already have an account?{' '}
            <Link component={RouterLink} to={paths.LOGIN}>
              Sign in
            </Link>
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  )
}
