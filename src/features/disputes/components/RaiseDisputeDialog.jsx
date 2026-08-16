import { useCallback, useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import FormSelect from '@/components/inputs/FormSelect'
import FormTextField from '@/components/inputs/FormTextField'
import ResponsiveDialog from '@/components/layout/ResponsiveDialog'
import { getStatusMeta } from '@/constants/statuses'
import AttachmentChips from '@/features/disputes/components/AttachmentChips'
import useAttachmentQueue, {
  EVIDENCE_ACCEPT,
  EVIDENCE_MAX_SIZE_MB,
} from '@/features/disputes/hooks/useAttachmentQueue'
import { DISPUTE_CATEGORY_OPTIONS } from '@/features/disputes/utils/disputeDisplay'
import {
  DISPUTE_DESCRIPTION_MAX,
  DISPUTE_DESCRIPTION_MIN,
  MAX_EVIDENCE_FILES,
} from '@/services/disputeService'

// Raising a dispute — the form behind "Report an issue" on an order.
//
// The consequence note is not decoration. Opening a dispute freezes an order
// for both people on it, so the dialog says that plainly *before* the submit
// button rather than in a toast afterwards, and says how long it usually takes,
// because the thing everybody wants to know at this moment is "and then what?"
// The register stays procedural throughout (§6): this is a process with a
// timescale, not an accusation.
//
// Validation mirrors `disputeService.createDispute` exactly, so nothing reaches
// the service to be refused — and the service refuses it again regardless
// (00 §11).

/** Validates the statement the way the service will, so the field can say it first. */
function validateDescription(value) {
  const text = String(value ?? '').trim()
  if (text.length === 0) return 'Tell us what went wrong.'
  if (text.length < DISPUTE_DESCRIPTION_MIN) {
    return `Use at least ${DISPUTE_DESCRIPTION_MIN} characters — enough for our team to act on.`
  }
  if (text.length > DISPUTE_DESCRIPTION_MAX) {
    return `Keep this under ${DISPUTE_DESCRIPTION_MAX} characters.`
  }
  return null
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {(payload: {category: string, description: string, evidenceFiles: object[]}) => Promise<*>}
 *   props.onSubmit opens the dispute — rejects to keep the form intact
 * @param {object} props.order the order being disputed
 */
export default function RaiseDisputeDialog({ open, onClose, onSubmit, order }) {
  const [category, setCategory] = useState('')
  const [categoryTouched, setCategoryTouched] = useState(false)
  const [description, setDescription] = useState('')
  const [descriptionTouched, setDescriptionTouched] = useState(false)
  const [isSubmitting, setSubmitting] = useState(false)
  const queue = useAttachmentQueue({ max: MAX_EVIDENCE_FILES })

  const { reset: resetQueue } = queue
  const descriptionError = validateDescription(description)
  const categoryError = category ? null : 'Choose what this is about.'
  const canSubmit = !descriptionError && !categoryError && !queue.isBlocked && !isSubmitting

  const close = useCallback(() => {
    if (isSubmitting) return
    onClose?.()
  }, [isSubmitting, onClose])

  const submit = useCallback(async () => {
    setCategoryTouched(true)
    setDescriptionTouched(true)
    if (!canSubmit) return

    setSubmitting(true)
    try {
      await onSubmit?.({
        category,
        description: description.trim(),
        evidenceFiles: queue.files,
      })
      // Cleared only on success — a failed submit keeps everything typed.
      setCategory('')
      setDescription('')
      setCategoryTouched(false)
      setDescriptionTouched(false)
      resetQueue()
    } catch {
      // Reported by the page; the form keeps its contents.
    } finally {
      setSubmitting(false)
    }
  }, [canSubmit, category, description, onSubmit, queue.files, resetQueue])

  const categoryHint = category ? getStatusMeta(category).description : null

  return (
    <ResponsiveDialog
      open={open}
      onClose={close}
      title="Report an issue with this order"
      description={order?.title}
      maxWidth="sm"
      actions={
        <>
          <Button onClick={close} color="inherit" disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={submit} variant="gradient" disabled={!canSubmit}>
            {isSubmitting ? 'Opening…' : 'Open dispute'}
          </Button>
        </>
      }
    >
      <Stack spacing={2.5}>
        <Alert
          severity="info"
          icon={<Icon icon="solar:info-circle-linear" width={22} />}
          sx={{ alignItems: 'flex-start' }}
        >
          This pauses the order while our team reviews it — most issues resolve within a few days.
          Your payment stays exactly where it is, held by BetterBlue, until there is a decision.
        </Alert>

        <FormSelect
          id="dispute-category"
          name="category"
          label="What is this about?"
          value={category}
          onChange={(next) => setCategory(next)}
          onBlur={() => setCategoryTouched(true)}
          options={DISPUTE_CATEGORY_OPTIONS.map(({ value, label }) => ({ value, label }))}
          placeholder="Choose a category"
          required
          error={categoryTouched ? categoryError : null}
          helperText={categoryHint ?? 'Pick the closest match — our team will read the detail below.'}
        />

        <FormTextField
          id="dispute-description"
          name="description"
          label="What happened?"
          value={description}
          onChange={setDescription}
          onBlur={() => setDescriptionTouched(true)}
          multiline
          minRows={5}
          maxRows={12}
          maxLength={DISPUTE_DESCRIPTION_MAX}
          required
          error={descriptionTouched ? descriptionError : null}
          helperText="Describe what doesn’t match the order terms — dates, what was agreed, and what arrived. The other party reads this too."
        />

        <Box>
          <Typography variant="subtitle2" component="h3" sx={{ mb: 0.5 }}>
            Evidence (optional)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Screenshots, the brief, an email — anything that shows what you mean. Up to{' '}
            {MAX_EVIDENCE_FILES} files, {EVIDENCE_MAX_SIZE_MB} MB each.
          </Typography>

          <Button
            component="label"
            variant="outlined"
            color="inherit"
            disabled={queue.isFull || queue.isUploading}
            startIcon={<Icon icon="solar:paperclip-linear" width={18} aria-hidden="true" />}
            sx={{ minHeight: 44 }}
          >
            Attach files
            <Box
              component="input"
              type="file"
              multiple
              accept={EVIDENCE_ACCEPT}
              onChange={(event) => {
                queue.addFiles(event.target.files)
                event.target.value = ''
              }}
              sx={{ display: 'none' }}
            />
          </Button>

          <Box aria-live="polite" sx={{ mt: queue.entries.length > 0 ? 1.5 : 0 }}>
            <AttachmentChips
              entries={queue.entries}
              onRemove={queue.removeFile}
              onRetry={queue.retryFile}
              label="Evidence attached to this dispute"
            />
            <Box sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
              {queue.status}
            </Box>
          </Box>

          {queue.overflowNotice ? (
            <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 1 }}>
              {queue.overflowNotice}
            </Typography>
          ) : null}
        </Box>
      </Stack>
    </ResponsiveDialog>
  )
}
