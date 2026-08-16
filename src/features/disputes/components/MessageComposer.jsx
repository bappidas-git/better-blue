import { useCallback, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import FormTextField from '@/components/inputs/FormTextField'
import AttachmentChips from '@/features/disputes/components/AttachmentChips'
import useAttachmentQueue, {
  EVIDENCE_ACCEPT,
  EVIDENCE_MAX_SIZE_MB,
} from '@/features/disputes/hooks/useAttachmentQueue'
import { DISPUTE_MESSAGE_MAX, MAX_MESSAGE_ATTACHMENTS } from '@/services/disputeService'

// Where a party answers.
//
// Two rules shape this component. First, a send that fails keeps the draft
// (§13) — the text is only cleared once the service has resolved, because
// losing four paragraphs to a dropped connection during a dispute is the worst
// moment on the whole platform to lose four paragraphs. Second, when the thread
// is closed the composer does not appear as a disabled field with no
// explanation: it is replaced by a sentence saying why, and where to go instead
// (§12).

/**
 * @param {object} props
 * @param {(payload: {body: string, attachments: object[]}) => Promise<*>} props.onSend
 *   posts the message — rejects to keep the draft intact
 * @param {boolean} [props.disabled] the thread is closed
 * @param {React.ReactNode} [props.disabledReason] why, in a sentence
 * @param {boolean} [props.awaitingViewer] our team has asked this member for something
 */
export default function MessageComposer({ onSend, disabled, disabledReason, awaitingViewer }) {
  const [body, setBody] = useState('')
  const [isSending, setSending] = useState(false)
  const queue = useAttachmentQueue({ max: MAX_MESSAGE_ATTACHMENTS })

  const { reset: resetQueue } = queue
  const canSend = body.trim().length > 0 && !queue.isBlocked && !isSending

  const send = useCallback(async () => {
    if (!canSend) return

    setSending(true)
    try {
      await onSend?.({ body: body.trim(), attachments: queue.files })
      // Cleared only on success — see the note above.
      setBody('')
      resetQueue()
    } catch {
      // Reported by the page; the draft and the attachments stay put.
    } finally {
      setSending(false)
    }
  }, [body, canSend, onSend, queue.files, resetQueue])

  if (disabled) {
    return (
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, bgcolor: 'background.default' }}>
        <Stack direction="row" spacing={1.25} alignItems="flex-start">
          <Box aria-hidden="true" sx={{ color: 'text.secondary', display: 'flex', pt: 0.25 }}>
            <Icon icon="solar:lock-keyhole-minimalistic-linear" width={20} />
          </Box>
          <Typography variant="body2" color="text.secondary">
            {disabledReason}
          </Typography>
        </Stack>
      </Paper>
    )
  }

  return (
    <Paper variant="outlined" component="section" aria-label="Reply to this dispute" sx={{ p: { xs: 2, md: 2.5 } }}>
      <FormTextField
        id="dispute-reply"
        name="body"
        label="Your message"
        value={body}
        onChange={setBody}
        multiline
        minRows={3}
        maxRows={10}
        maxLength={DISPUTE_MESSAGE_MAX}
        helperText={
          awaitingViewer
            ? 'Our team is waiting on this — send whatever you can and the review picks straight back up.'
            : 'Everyone on this dispute — both parties and our team — can read what you write here.'
        }
      />

      <Box aria-live="polite" sx={{ mt: queue.entries.length > 0 ? 1.5 : 0 }}>
        <AttachmentChips
          entries={queue.entries}
          onRemove={queue.removeFile}
          onRetry={queue.retryFile}
          label="Files attached to this message"
        />
        {/* Visually hidden, and hidden **without stretching the layout**. The
            units are explicit because MUI's `sx` reads a bare `width: 1` as
            `100%`, not `1px` — which made this absolutely-positioned box as
            wide as the composer and put a 1px horizontal scrollbar on the
            dispute screen at 360px (00 §13). Found and corrected in Prompt 33;
            nothing about what this renders has changed. */}
        <Box
          sx={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            whiteSpace: 'nowrap',
          }}
        >
          {queue.status}
        </Box>
      </Box>

      {queue.overflowNotice ? (
        <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 1 }}>
          {queue.overflowNotice}
        </Typography>
      ) : null}

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        sx={{ mt: 2 }}
      >
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
              // Reset so picking the same file twice still fires a change.
              event.target.value = ''
            }}
            sx={{ display: 'none' }}
          />
        </Button>

        <Button
          onClick={send}
          variant="gradient"
          disabled={!canSend}
          startIcon={<Icon icon="solar:plain-linear" width={18} aria-hidden="true" />}
          sx={{ minHeight: 44 }}
        >
          {isSending ? 'Sending…' : 'Send message'}
        </Button>
      </Stack>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
        Up to {MAX_MESSAGE_ATTACHMENTS} files, {EVIDENCE_MAX_SIZE_MB} MB each — images or PDFs.
      </Typography>
    </Paper>
  )
}
