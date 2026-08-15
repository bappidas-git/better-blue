import { useEffect, useState } from 'react'

import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import FormTextField from '@/components/inputs/FormTextField'
import ResponsiveDialog from '@/components/layout/ResponsiveDialog'

// Declining a proposal, with the option to say why.
//
// A bespoke dialog rather than `useConfirm` because the consequence copy names
// a person and the reason is written *to* them — it deserves more room and a
// clearer helper line than a generic confirmation gives it (00 §12 still
// applies: explicit consequences, and a reason field where the domain wants one).

/** Long enough for a real sentence, short enough to stay a note. */
const REASON_MAX = 400

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {object|null} props.proposal the offer being declined
 * @param {(options: {reason?: string}) => void} props.onConfirm
 * @param {() => void} props.onClose
 * @param {boolean} [props.isSubmitting]
 */
export default function DeclineDialog({ open, proposal, onConfirm, onClose, isSubmitting = false }) {
  const [reason, setReason] = useState('')
  const creatorName = proposal?.creator?.name ?? 'this creator'

  // Each opening starts from a blank note — a reason typed for one creator must
  // never appear in a dialog about another.
  useEffect(() => {
    if (open) setReason('')
  }, [open, proposal?.id])

  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title="Decline this proposal?"
      maxWidth="xs"
      actions={
        <>
          <Button color="inherit" onClick={onClose} disabled={isSubmitting}>
            Keep it
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => onConfirm?.({ reason: reason.trim() || undefined })}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Declining…' : 'Decline proposal'}
          </Button>
        </>
      }
    >
      <Stack spacing={2.5}>
        <Typography variant="body2" color="text.secondary">
          {creatorName} is told their proposal was not selected, and it cannot be accepted
          afterwards. Your request stays open, so the other proposals are unaffected.
        </Typography>

        <FormTextField
          id="decline-proposal-reason"
          label="Reason (optional)"
          value={reason}
          onChange={setReason}
          placeholder="The budget was the deciding factor this time"
          helperText={`Shared with ${creatorName}. A sentence of feedback goes a long way.`}
          multiline
          minRows={3}
          maxLength={REASON_MAX}
          disabled={isSubmitting}
          autoFocus
        />
      </Stack>
    </ResponsiveDialog>
  )
}
