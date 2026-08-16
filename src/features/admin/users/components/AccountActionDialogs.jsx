import { useEffect } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import FormTextField from '@/components/inputs/FormTextField'
import ResponsiveDialog from '@/components/layout/ResponsiveDialog'
import { ACCOUNT_STATUS } from '@/constants/statuses'
import useForm from '@/hooks/useForm'
import { STATUS_REASON_MAX_LENGTH, STATUS_REASON_MIN_LENGTH } from '@/services/userService'
import { compose, maxLength, minLength, required } from '@/utils/validators'

// The three account-status dialogs — Prompt 29 §4.4.
//
// One component, three configurations, because they are one decision with three
// destinations and the shape is identical: say what will happen, take a reason,
// confirm. Writing them as three files would have produced three drifting
// versions of the same consequence copy.
//
// Two rules they exist to enforce (00 §12, §14):
//
//   1. **Nothing irreversible happens without stated consequences.** Each
//      dialog says, in plain sentences, what the member will experience — not
//      "are you sure".
//   2. **A restriction is never recorded without a reason.** The reason is
//      quoted back to the member in their notification and stored on the
//      account, so a colleague opening it next week can see why. Ten characters
//      is the floor; the service enforces the same floor independently.

/** The dialog's copy and behaviour per destination status. */
const DIALOG = Object.freeze({
  [ACCOUNT_STATUS.SUSPENDED]: Object.freeze({
    title: 'Suspend this account?',
    icon: 'solar:pause-circle-linear',
    tone: 'warning',
    confirmLabel: 'Suspend account',
    consequence:
      'They will not be able to sign in or transact until the account is reactivated, and their public content is hidden from discovery and from their profile page.',
    note: 'They are told immediately, and the reason below is quoted to them verbatim.',
    reasonRequired: true,
    reasonLabel: 'Why is this account being suspended?',
    reasonPlaceholder:
      'e.g. Licensing review following an upheld report about stock imagery in the portfolio.',
  }),
  [ACCOUNT_STATUS.BLACKLISTED]: Object.freeze({
    title: 'Blacklist this account?',
    icon: 'solar:forbidden-circle-linear',
    tone: 'error',
    confirmLabel: 'Blacklist account',
    consequence:
      'Their account is closed: sign-in is blocked, their public content is hidden, and they cannot open a new engagement. Nothing is deleted — their orders, payments, and history are retained.',
    note: 'By policy this is treated as permanent and is only reversed by a super admin after review. The action, the reason, and your name are written to the audit trail.',
    reasonRequired: true,
    reasonLabel: 'Why is this account being blacklisted?',
    reasonPlaceholder:
      'e.g. Repeated Content Policy breaches after a suspension and a written warning.',
  }),
  [ACCOUNT_STATUS.ACTIVE]: Object.freeze({
    title: 'Reactivate this account?',
    icon: 'solar:play-circle-linear',
    tone: 'success',
    confirmLabel: 'Reactivate account',
    consequence:
      'They will be able to sign in again, and their public profile and content become visible immediately.',
    note: 'They are told the account is active again. A note is optional — add one if the outcome of the review is worth recording.',
    reasonRequired: false,
    reasonLabel: 'Note (optional)',
    reasonPlaceholder: 'e.g. Licensing evidence supplied and accepted; review closed.',
  }),
})

/** Button colour per tone — `warning` and `error` both read as destructive. */
const CONFIRM_COLOR = Object.freeze({
  warning: 'warning',
  error: 'error',
  success: 'primary',
})

/**
 * @param {object} props
 * @param {string|null} props.status the destination `ACCOUNT_STATUS`, or `null`
 *   when no dialog is open
 * @param {object|null} props.user the account being acted on
 * @param {(payload: {status: string, reason: string}) => Promise<*>} props.onConfirm
 *   runs the service call; the dialog stays open and shows the message if it throws
 * @param {() => void} props.onClose dismissal
 */
export default function AccountActionDialogs({ status, user, onConfirm, onClose }) {
  const config = status ? DIALOG[status] : null

  const form = useForm({
    initialValues: { reason: '' },
    validators: {
      reason: config?.reasonRequired
        ? compose(
            required('A reason is required — the member reads it.'),
            minLength(
              STATUS_REASON_MIN_LENGTH,
              `Write at least ${STATUS_REASON_MIN_LENGTH} characters, so the next admin can act on it.`
            ),
            maxLength(STATUS_REASON_MAX_LENGTH)
          )
        : maxLength(STATUS_REASON_MAX_LENGTH),
    },
  })

  const { reset } = form
  // A fresh form per opening: the reason for suspending one account is never
  // the right starting point for the next.
  useEffect(() => {
    if (status) reset({ reason: '' })
  }, [status, user?.id, reset])

  if (!config || !user) return null

  const submit = form.handleSubmit(async (values) => {
    try {
      await onConfirm({ status, reason: values.reason.trim() })
      onClose()
    } catch (failure) {
      // Field-level messages land on the field; anything else is a banner the
      // reader can act on, and the dialog stays open with their words intact.
      const fieldError = failure?.details?.reason
      form.setError('reason', Array.isArray(fieldError) ? fieldError[0] : fieldError)
      if (!fieldError) {
        form.setError('form', failure?.message ?? 'We could not apply that change.')
      }
    }
  })

  const describedBy = 'account-action-consequence'

  return (
    <ResponsiveDialog
      open
      onClose={form.isSubmitting ? () => {} : onClose}
      title={config.title}
      maxWidth="sm"
      actions={
        <>
          <Button onClick={onClose} disabled={form.isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={CONFIRM_COLOR[config.tone]}
            onClick={submit}
            disabled={form.isSubmitting}
            startIcon={<Icon icon={config.icon} width={18} aria-hidden="true" />}
          >
            {form.isSubmitting ? 'Working…' : config.confirmLabel}
          </Button>
        </>
      }
    >
      <Box component="form" onSubmit={submit} noValidate aria-describedby={describedBy}>
        <Stack spacing={2}>
          <Alert severity={config.tone} variant="outlined" id={describedBy}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              {user.name} · {user.email}
            </Typography>
            <Typography variant="body2">{config.consequence}</Typography>
          </Alert>

          <Typography variant="body2" color="text.secondary">
            {config.note}
          </Typography>

          {form.errors.form ? <Alert severity="error">{form.errors.form}</Alert> : null}

          <FormTextField
            label={config.reasonLabel}
            placeholder={config.reasonPlaceholder}
            required={config.reasonRequired}
            multiline
            minRows={3}
            maxLength={STATUS_REASON_MAX_LENGTH}
            helperText={
              config.reasonRequired
                ? `At least ${STATUS_REASON_MIN_LENGTH} characters. Shared with the member and recorded on the account.`
                : 'Recorded on the account and shared with the member if you write one.'
            }
            // Deliberately **not** autofocused. The dialog's focus trap moves
            // focus off an autofocused field as it mounts, which fires the
            // field's blur handler and makes `useForm` mark it touched — so an
            // empty required field opened with "A reason is required" already
            // printed under it, before anybody had typed a character. The
            // consequence copy above is what should be read first anyway.
            {...form.fieldProps('reason')}
          />
        </Stack>
      </Box>
    </ResponsiveDialog>
  )
}
