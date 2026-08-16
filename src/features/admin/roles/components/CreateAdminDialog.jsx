import { useEffect } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import FormTextField from '@/components/inputs/FormTextField'
import ResponsiveDialog from '@/components/layout/ResponsiveDialog'
import PermissionPicker from '@/features/admin/roles/components/PermissionPicker'
import useForm from '@/hooks/useForm'
import { compose, email, maxLength, minLength, required } from '@/utils/validators'

// Add an admin — Prompt 36 §4.2.
//
// Three fields and a decision. The decision is the picker: an admin account is
// nothing but its permission array, so creating one without choosing what it can
// do is not a shortcut worth offering — the service refuses an empty grant and
// this dialog refuses to submit one.
//
// The confirm bar is sticky on a phone (§11): the picker is long, and a
// "Create admin" button parked below sixteen checkboxes is a button nobody
// finds.

const NAME_MIN = 2
const NAME_MAX = 80

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {(values: {name: string, email: string, permissions: string[]}) => Promise<void>}
 *   props.onSubmit resolves when created; rejects with an `ApiError` whose
 *   `details.email` lands under the email field
 */
export default function CreateAdminDialog({ open, onClose, onSubmit }) {
  const form = useForm({
    initialValues: { name: '', email: '', permissions: [] },
    validators: {
      name: compose(
        required('Give the new admin a name.'),
        minLength(NAME_MIN),
        maxLength(NAME_MAX)
      ),
      email: compose(required('They need an address to sign in with.'), email()),
      permissions: (value) =>
        Array.isArray(value) && value.length > 0
          ? undefined
          : 'Choose at least one permission — an admin with none can sign in and see nothing.',
    },
  })

  const { reset } = form

  // Re-seeded on every open, so a cancelled draft is not waiting the next time.
  useEffect(() => {
    if (!open) return
    reset({ name: '', email: '', permissions: [] })
  }, [open, reset])

  const submit = form.handleSubmit(async (values, helpers) => {
    try {
      await onSubmit({
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        permissions: values.permissions,
      })
    } catch (failure) {
      // A duplicate address is the one failure the reader can fix here, so it
      // lands under its field rather than only in a toast (§13).
      const message = failure?.details?.email
      helpers.setError('email', Array.isArray(message) ? message[0] : message)
    }
  })

  const count = form.values.permissions?.length ?? 0

  return (
    <ResponsiveDialog
      open={open}
      onClose={form.isSubmitting ? undefined : onClose}
      title="Add an admin"
      description="They sign in with a temporary password shown once on the next screen, and see exactly the sections you grant below."
      maxWidth="md"
      actions={
        <>
          <Button
            onClick={onClose}
            color="inherit"
            disabled={form.isSubmitting}
            sx={{ minHeight: 44 }}
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            variant="gradient"
            disabled={form.isSubmitting}
            sx={{ minHeight: 44 }}
          >
            {form.isSubmitting ? 'Creating…' : `Create admin${count > 0 ? ` · ${count}` : ''}`}
          </Button>
        </>
      }
    >
      <Stack component="form" onSubmit={submit} spacing={2.5} noValidate>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <FormTextField
              label="Name"
              required
              maxLength={NAME_MAX}
              helperText="Shown beside every action they take in the audit log."
              {...form.fieldProps('name')}
            />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <FormTextField
              label="Email"
              type="email"
              required
              helperText="Their sign-in address. It has to be one nobody else uses."
              {...form.fieldProps('email')}
            />
          </Box>
        </Stack>

        <Alert severity="info" icon={<Icon icon="solar:info-circle-linear" width={20} />}>
          Roles are fixed — this account is an <strong>Admin</strong>. What makes one admin
          different from another is the permissions below, and you can change them at any time.
        </Alert>

        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Permissions
          </Typography>
          {form.touched.permissions && form.errors.permissions ? (
            <Typography variant="caption" color="error" component="p" sx={{ mb: 1 }}>
              {form.errors.permissions}
            </Typography>
          ) : null}
          <PermissionPicker
            value={form.values.permissions}
            onChange={(next) => form.setValue('permissions', next)}
            disabled={form.isSubmitting}
          />
        </Box>
      </Stack>
    </ResponsiveDialog>
  )
}
