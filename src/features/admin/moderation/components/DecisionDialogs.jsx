import { useEffect } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import FormSelect from '@/components/inputs/FormSelect'
import FormTextField from '@/components/inputs/FormTextField'
import ResponsiveDialog from '@/components/layout/ResponsiveDialog'
import { REJECTION_REASONS } from '@/constants/policy'
import useForm from '@/hooks/useForm'
import {
  MODERATION_DECISION,
  MODERATION_NOTES_MAX,
  MODERATION_NOTES_MIN,
} from '@/services/moderationService'
import { compose, maxLength, minLength, required } from '@/utils/validators'

// The four decision dialogs — Prompt 30 §4.3.
//
// One component, four configurations, for the reason `AccountActionDialogs` is
// one component: they are one decision with four destinations, and writing them
// as four files would produce four drifting versions of the same consequence
// copy.
//
// Two rules they exist to enforce (00 §12, §14):
//
//   1. **Every negative decision states its consequence in plain sentences** —
//      what the creator will see, and what happens to the content. Not "are you
//      sure".
//   2. **Nothing negative is recorded without a reason the creator can read.**
//      The note is quoted to them verbatim and stored on the case; the service
//      enforces the same floor independently, so a screen cannot skip it.
//
// Approval is the exception, and deliberately a light one: a single confirm
// with an optional note. Approving is the reversible half of the job — a
// mistaken approval can be restricted an hour later — and making a reviewer
// justify good news in writing is how a queue of forty stops moving.

/** Reason options, straight from the policy constants (§7 — single-sourced). */
const REASON_OPTIONS = REJECTION_REASONS.map((reason) => ({
  value: reason.code,
  label: reason.label,
}))

/** Copy and behaviour per decision. */
const DIALOG = Object.freeze({
  [MODERATION_DECISION.APPROVE]: Object.freeze({
    title: 'Approve this submission?',
    icon: 'solar:check-circle-linear',
    tone: 'success',
    confirmLabel: 'Approve',
    consequence: {
      portfolio_item:
        'It is published to the creator’s public profile immediately and becomes discoverable in search.',
      delivery:
        'The deliverable is cleared. The buyer already has it; this records that it meets the Content Policy.',
    },
    note: 'The creator is told it was approved. A note is optional — add one if there is something worth them knowing.',
    needsReason: false,
    needsNotes: false,
    notesLabel: 'Note to the creator (optional)',
    notesPlaceholder: 'e.g. Strong set. Consider adding the client credit next time.',
  }),
  [MODERATION_DECISION.REQUEST_CHANGES]: Object.freeze({
    title: 'Request changes?',
    icon: 'solar:pen-new-square-linear',
    tone: 'warning',
    confirmLabel: 'Request changes',
    consequence: {
      portfolio_item:
        'It stays off the public profile and returns to the creator, who can edit it and send it back for review.',
      delivery:
        'The case records that changes are needed. The buyer’s order is unaffected — this does not request a revision on their behalf.',
    },
    note: 'Your note is the whole message: say what to change, specifically enough to act on.',
    needsReason: false,
    needsNotes: true,
    notesLabel: 'What needs to change?',
    notesPlaceholder:
      'e.g. The third image has the client’s logo cropped mid-frame. Re-crop it or swap that frame, and re-submit.',
  }),
  [MODERATION_DECISION.REJECT]: Object.freeze({
    title: 'Reject this submission?',
    icon: 'solar:close-circle-linear',
    tone: 'error',
    confirmLabel: 'Reject submission',
    consequence: {
      portfolio_item:
        'It is not published, and the creator sees the reason and your note on the item in their portfolio. They can make changes and re-submit.',
      delivery:
        'The case records a policy breach against this version. The order is unaffected; act on the account separately if it warrants it.',
    },
    note: 'The reason and your note are both shown to the creator and stored on the case for the next reviewer.',
    needsReason: true,
    needsNotes: true,
    notesLabel: 'Why is this being rejected?',
    notesPlaceholder:
      'e.g. The backing track is a commercial release with no licence supplied. Replace it or send the licence, and re-submit.',
  }),
  [MODERATION_DECISION.RESTRICT]: Object.freeze({
    title: 'Restrict this content?',
    icon: 'solar:eye-closed-linear',
    tone: 'warning',
    confirmLabel: 'Restrict content',
    consequence: {
      portfolio_item:
        'It is removed from the public profile and from discovery straight away. Nothing is deleted — the creator keeps the item and can appeal through support.',
      delivery:
        'Its files are flagged restricted, which keeps them out of any reuse surface. The buyer who commissioned the work keeps it, and the order is unaffected.',
    },
    note: 'This acts on content that is already live, so the creator is told at once, with the reason and your note.',
    needsReason: true,
    needsNotes: true,
    notesLabel: 'Why is this being restricted?',
    notesPlaceholder:
      'e.g. Upheld report: the backdrop is licensed stock being used commercially without rights.',
  }),
})

/** Button colour per tone. */
const CONFIRM_COLOR = Object.freeze({
  success: 'primary',
  warning: 'warning',
  error: 'error',
})

/**
 * @param {object} props
 * @param {string|null} props.decision a `MODERATION_DECISION` value, or `null`
 *   when no dialog is open
 * @param {string} props.subjectType a `MODERATION_SUBJECT` value — picks the
 *   consequence copy, which differs in kind between a portfolio item and a
 *   deliverable
 * @param {string} [props.subjectTitle] what is being decided on
 * @param {(payload: {decision: string, notes: string, reasonCode: string}) => Promise<*>} props.onConfirm
 *   runs the service call; the dialog stays open and shows the message if it throws
 * @param {() => void} props.onClose dismissal
 */
export default function DecisionDialogs({
  decision,
  subjectType,
  subjectTitle,
  onConfirm,
  onClose,
}) {
  const config = decision ? DIALOG[decision] : null

  const form = useForm({
    initialValues: { notes: '', reasonCode: '' },
    validators: {
      notes: config?.needsNotes
        ? compose(
            required('A note is required — the creator reads it.'),
            minLength(
              MODERATION_NOTES_MIN,
              `Write at least ${MODERATION_NOTES_MIN} characters, so the creator knows what to do next.`
            ),
            maxLength(MODERATION_NOTES_MAX)
          )
        : maxLength(MODERATION_NOTES_MAX),
      reasonCode: config?.needsReason ? required('Pick the reason that applies.') : undefined,
    },
  })

  const { reset } = form
  // A fresh form per opening: the reason for rejecting one submission is never
  // the right starting point for the next.
  useEffect(() => {
    if (decision) reset({ notes: '', reasonCode: '' })
  }, [decision, reset])

  if (!config) return null

  const submit = form.handleSubmit(async (values) => {
    try {
      await onConfirm({
        decision,
        notes: values.notes.trim(),
        reasonCode: values.reasonCode || undefined,
      })
      onClose()
    } catch (failure) {
      // Field-level messages land on the field; anything else is a banner the
      // reader can act on, and the dialog stays open with their words intact.
      const fieldError = failure?.details?.notes ?? failure?.details?.reasonCode
      const field = failure?.details?.notes ? 'notes' : 'reasonCode'
      if (fieldError) {
        form.setError(field, Array.isArray(fieldError) ? fieldError[0] : fieldError)
      } else {
        form.setError('form', failure?.message ?? 'We could not record that decision.')
      }
    }
  })

  const describedBy = 'moderation-decision-consequence'
  const consequence = config.consequence[subjectType] ?? config.consequence.portfolio_item

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
            {form.isSubmitting ? 'Recording…' : config.confirmLabel}
          </Button>
        </>
      }
    >
      <Box component="form" onSubmit={submit} noValidate aria-describedby={describedBy}>
        <Stack spacing={2}>
          <Alert severity={config.tone} variant="outlined" id={describedBy}>
            {subjectTitle ? (
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                {subjectTitle}
              </Typography>
            ) : null}
            <Typography variant="body2">{consequence}</Typography>
          </Alert>

          <Typography variant="body2" color="text.secondary">
            {config.note}
          </Typography>

          {form.errors.form ? <Alert severity="error">{form.errors.form}</Alert> : null}

          {config.needsReason ? (
            <FormSelect
              label="Reason"
              required
              options={REASON_OPTIONS}
              placeholder="Choose a reason"
              helperText="From the Content Policy. The creator sees this label."
              {...form.fieldProps('reasonCode')}
            />
          ) : null}

          <FormTextField
            label={config.notesLabel}
            placeholder={config.notesPlaceholder}
            required={config.needsNotes}
            multiline
            minRows={3}
            maxLength={MODERATION_NOTES_MAX}
            helperText={
              config.needsNotes
                ? `At least ${MODERATION_NOTES_MIN} characters. Sent to the creator and stored on the case.`
                : 'Sent to the creator if you write one, and stored on the case.'
            }
            // Deliberately not autofocused — see the note in
            // `AccountActionDialogs`: the trap's focus move marks the field
            // touched and prints "a note is required" before anybody has typed.
            {...form.fieldProps('notes')}
          />
        </Stack>
      </Box>
    </ResponsiveDialog>
  )
}
