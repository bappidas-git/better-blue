import { useEffect } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import FormTextField from '@/components/inputs/FormTextField'
import ResponsiveDialog from '@/components/layout/ResponsiveDialog'
import { describeRevisions } from '@/features/orders/utils/orderDisplay'
import useForm from '@/hooks/useForm'
import { compose, maxLength, minLength, required } from '@/utils/validators'
import { formatNumber } from '@/utils/formatters'

// Asking for changes. The form is one field, and the whole design of the screen
// is about what goes in it.
//
// Revisions are bounded by what was agreed in the proposal, so this dialog says
// how many are left *before* someone spends one, and refuses outright when the
// allowance is gone — with the way forward named rather than a dead end.
//
// The notes are read by a person who has just done several days of work, which
// is why the minimum length is 30 characters and the placeholder shows what a
// useful note looks like. "Not what I wanted" costs everyone another round.

/** Shortest note worth sending — long enough to name what and where. */
export const NOTES_MIN = 30

/** Cap, matching the contract's `revisions.notes` column. */
export const NOTES_MAX = 1000

const PLACEHOLDER =
  'Be specific about what needs to change and where, e.g. “The plating reel runs 27 seconds — it needs a trim to under 25. The dining room caption reads ‘Autumn Squash’ and should read ‘Roast Squash & Sage’ to match the printed menu.”'

/**
 * @param {object} props
 * @param {boolean} props.open whether the dialog is shown
 * @param {() => void} props.onClose dismiss handler
 * @param {(notes: string) => Promise<void>} props.onSubmit sends the request; the
 *   dialog stays open if it rejects, so the notes are never lost
 * @param {object} props.order the order the changes are against
 */
export default function RequestRevisionDialog({ open, onClose, onSubmit, order }) {
  const revisions = describeRevisions(order)

  const form = useForm({
    initialValues: { notes: '' },
    validators: {
      notes: compose(
        required('Tell the creator what needs to change.'),
        minLength(NOTES_MIN, `Use at least ${NOTES_MIN} characters — enough to say what and where.`),
        maxLength(NOTES_MAX)
      ),
    },
  })

  const { reset } = form
  // A dialog reopened after a successful request must not still hold the last
  // one's notes.
  useEffect(() => {
    if (open) reset({ notes: '' })
  }, [open, reset])

  const submit = form.handleSubmit(async (values) => {
    await onSubmit(values.notes.trim())
  })

  if (revisions.isExhausted) {
    return (
      <ResponsiveDialog
        open={open}
        onClose={onClose}
        title="No revisions left on this order"
        description={`This engagement included ${formatNumber(revisions.included)} ${
          revisions.included === 1 ? 'revision' : 'revisions'
        }, and ${revisions.included === 1 ? 'it has' : 'they have'} been used.`}
        actions={
          <Button onClick={onClose} variant="contained">
            Close
          </Button>
        }
      >
        <Alert severity="warning" icon={<Icon icon="solar:info-circle-linear" width={20} />}>
          <AlertTitle>Revision limit reached</AlertTitle>
          Contact the creator via a dispute if the delivery does not match the brief. Our team will
          look at the brief and the delivery and decide — your payment stays in escrow until they do.
        </Alert>
      </ResponsiveDialog>
    )
  }

  return (
    <ResponsiveDialog
      open={open}
      onClose={form.isSubmitting ? undefined : onClose}
      title="Request changes"
      description="The creator gets your notes and submits a new version. Your payment stays in escrow."
      actions={
        <>
          <Button onClick={onClose} color="inherit" disabled={form.isSubmitting}>
            Cancel
          </Button>
          <Button onClick={submit} variant="contained" disabled={form.isSubmitting}>
            {form.isSubmitting ? 'Sending…' : 'Send request'}
          </Button>
        </>
      }
    >
      <Stack component="form" spacing={2} onSubmit={submit} noValidate>
        {/* `role="status"`: the counter changes as revisions are spent, and it is
            the number that decides whether this dialog is even usable (§12). */}
        <Typography variant="body2" role="status" sx={{ fontWeight: 600 }}>
          {formatNumber(revisions.remaining)}{' '}
          {revisions.remaining === 1 ? 'revision' : 'revisions'} left of{' '}
          {formatNumber(revisions.included)} included in this order.
        </Typography>

        <FormTextField
          label="What needs to change?"
          required
          multiline
          minRows={5}
          maxRows={12}
          maxLength={NOTES_MAX}
          placeholder={PLACEHOLDER}
          helperText="Reference the file and the moment. Professional and specific gets a better second version than a general note."
          {...form.fieldProps('notes')}
        />
      </Stack>
    </ResponsiveDialog>
  )
}
