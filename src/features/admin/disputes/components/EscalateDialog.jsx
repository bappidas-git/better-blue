import { useCallback, useEffect, useState } from 'react'

import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import FormTextField from '@/components/inputs/FormTextField'
import ResponsiveDialog from '@/components/layout/ResponsiveDialog'
import { focusFieldById } from '@/hooks/useForm'
import { DISPUTE_MESSAGE_MAX } from '@/services/disputeService'

// Handing a case to a senior reviewer — Prompt 33 §4.3.
//
// The note is **internal**, and that is the point: escalation is a conversation
// between reviewers about a decision neither party should be pre-empting. Both
// parties do see the status change — Prompt 26's banner tells them it is with a
// senior reviewer and will take a little longer — and neither sees a word of
// why, which is exactly the split this dialog has to make unmistakable.

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {(input: {note: string}) => Promise<void>} props.onSubmit resolves when
 *   the case has been escalated; rejects to keep the dialog open
 */
export default function EscalateDialog({ open, onClose, onSubmit }) {
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [failure, setFailure] = useState(null)

  useEffect(() => {
    if (!open) return
    setNote('')
    setTouched(false)
    setFailure(null)
  }, [open])

  const trimmed = note.trim()
  const noteError = trimmed.length === 0 ? 'Say why this needs a senior review.' : null
  const canSubmit = !noteError && !submitting

  const submit = useCallback(async () => {
    setTouched(true)
    if (!canSubmit) {
      // The message is revealed *and* the cursor lands on the field it belongs
      // to, rather than leaving the reader to find it (00 §12).
      if (noteError) focusFieldById('escalation-note')
      return
    }

    setSubmitting(true)
    setFailure(null)
    try {
      await onSubmit({ note: trimmed })
    } catch (error) {
      setFailure(error)
    } finally {
      setSubmitting(false)
    }
  }, [canSubmit, noteError, onSubmit, trimmed])

  return (
    <ResponsiveDialog
      open={open}
      onClose={submitting ? undefined : onClose}
      title="Escalate to a senior reviewer"
      description="The case moves to Escalated and everyone who can resolve disputes is told."
      maxWidth="sm"
      actions={
        <>
          <Button variant="text" color="inherit" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="contained" color="warning" onClick={submit} disabled={submitting}>
            {submitting ? 'Escalating…' : 'Escalate case'}
          </Button>
        </>
      }
    >
      <Stack spacing={2.5}>
        {failure ? (
          <Alert severity="error" onClose={() => setFailure(null)}>
            {failure?.message ?? 'The case could not be escalated. Nothing has changed.'}
          </Alert>
        ) : null}

        <FormTextField
          id="escalation-note"
          name="note"
          label="Internal note"
          value={note}
          onChange={setNote}
          onBlur={() => setTouched(true)}
          required
          multiline
          minRows={4}
          maxLength={DISPUTE_MESSAGE_MAX}
          error={touched ? (noteError ?? false) : false}
          helperText="What the senior reviewer needs to know: what you have checked, and what you are unsure about."
        />

        <Alert severity="warning" variant="outlined" icon={false}>
          <Typography variant="body2">
            <strong>This note is internal.</strong> It goes on the case thread marked Internal, and
            the buyer and the creator never see it. They are told only that a senior reviewer has
            the case.
          </Typography>
        </Alert>
      </Stack>
    </ResponsiveDialog>
  )
}
