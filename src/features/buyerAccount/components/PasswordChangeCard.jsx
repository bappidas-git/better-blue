import { Icon } from '@iconify/react'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import { useToast } from '@/components/feedback/ToastProvider'
import FormTextField from '@/components/inputs/FormTextField'
import useApiMutation from '@/hooks/useApiMutation'
import useForm from '@/hooks/useForm'
import { PASSWORD_MIN_LENGTH, authService } from '@/services/authService'
import { compose, minLength, pattern, required } from '@/utils/validators'

// Change-password form. Three fields, one rule set, and no surprises: the new
// password has to satisfy the same requirements sign-up asks for, and the
// confirmation has to match.
//
// MOCK-AUTH: `authService.changePassword` compares the current password in the
// browser against the plain-text value JSON Server stores, then `PATCH`es the
// replacement (00 §14). Laravel verifies the hash, hashes the new value, and
// revokes the member's other sessions — none of which can happen here, which is
// exactly why the check lives behind a service function that will be swapped.

const PASSWORD_HINT = `At least ${PASSWORD_MIN_LENGTH} characters, including a letter and a number.`

const validators = {
  currentPassword: required('Enter your current password.'),
  newPassword: compose(
    required('Choose a new password.'),
    minLength(PASSWORD_MIN_LENGTH, PASSWORD_HINT),
    pattern(/[A-Za-z]/, PASSWORD_HINT),
    pattern(/\d/, PASSWORD_HINT)
  ),
  confirmPassword: compose(
    required('Re-enter your new password.'),
    (value, values) => (value === values.newPassword ? undefined : 'Both passwords must match.')
  ),
}

const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' }

export default function PasswordChangeCard() {
  const toast = useToast()
  const form = useForm({ initialValues: EMPTY, validators })
  const { mutate, isLoading } = useApiMutation(authService.changePassword)

  const handleSubmit = form.handleSubmit(async (values, { reset, setError }) => {
    try {
      await mutate({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      // Nothing about a password belongs in component state a moment longer
      // than it takes to send it.
      reset(EMPTY)
      toast.success('Password changed', {
        description: 'Use your new password the next time you sign in.',
      })
    } catch (failure) {
      Object.entries(failure?.details ?? {}).forEach(([field, message]) => {
        if (field in values) setError(field, Array.isArray(message) ? message[0] : message)
      })
      toast.error('We could not change your password', { description: failure?.message })
    }
  })

  return (
    <Stack component="form" onSubmit={handleSubmit} spacing={3} noValidate>
      <Stack spacing={0.5}>
        <Typography variant="subtitle2" component="h3">
          Change your password
        </Typography>
        <Typography variant="body2" color="text.secondary">
          You stay signed in on this device after changing it.
        </Typography>
      </Stack>

      <FormTextField
        label="Current password"
        type="password"
        required
        autoComplete="current-password"
        {...form.fieldProps('currentPassword')}
      />
      <FormTextField
        label="New password"
        type="password"
        required
        autoComplete="new-password"
        helperText={PASSWORD_HINT}
        {...form.fieldProps('newPassword')}
      />
      <FormTextField
        label="Confirm new password"
        type="password"
        required
        autoComplete="new-password"
        {...form.fieldProps('confirmPassword')}
      />

      <Stack direction="row" justifyContent="flex-start">
        <Button
          type="submit"
          variant="contained"
          disabled={isLoading}
          startIcon={isLoading ? null : <Icon icon="tabler:lock" width={18} aria-hidden="true" />}
        >
          {isLoading ? 'Changing…' : 'Change password'}
        </Button>
      </Stack>
    </Stack>
  )
}
