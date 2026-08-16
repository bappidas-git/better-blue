import { useCallback, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import FormTextField from '@/components/inputs/FormTextField'
import AttachmentChips from '@/features/disputes/components/AttachmentChips'
import useAttachmentQueue, {
  EVIDENCE_ACCEPT,
  EVIDENCE_MAX_SIZE_MB,
} from '@/features/disputes/hooks/useAttachmentQueue'
import { DISPUTE_MESSAGE_MAX, MAX_MESSAGE_ATTACHMENTS } from '@/services/disputeService'

// Where a reviewer writes — Prompt 33 §4.3.
//
// Prompt 26's `MessageComposer` is the party's composer and stays exactly as it
// is. This is the admin's, and it exists because of the one thing the party's
// has no concept of: a message here goes to **two different audiences**, and
// sending the wrong one to the wrong audience is the most damaging mistake
// available on this screen.
//
// So the two modes are separated by everything at once (§6, §12): a labelled
// toggle, a different accent colour, a different icon, a different field label,
// different helper text, and a different word on the button — "Send to both
// parties" versus "Save internal note". Colour alone would not be enough, and
// the send label is what a reviewer actually reads before clicking.
//
// The attachment queue is Prompt 26's, unchanged. Everything else about how a
// message is validated and posted lives in `disputeService`.

const MODE = Object.freeze({ PUBLIC: 'public', INTERNAL: 'internal' })

const MODE_META = Object.freeze({
  [MODE.PUBLIC]: Object.freeze({
    label: 'Reply to parties',
    icon: 'solar:chat-round-line-linear',
    fieldLabel: 'Your reply',
    helper: 'The buyer and the creator both read this on their copy of the dispute.',
    send: 'Send to both parties',
    sending: 'Sending…',
    announce: 'Reply mode. Both parties will see this message.',
  }),
  [MODE.INTERNAL]: Object.freeze({
    label: 'Internal note',
    icon: 'solar:lock-keyhole-minimalistic-linear',
    fieldLabel: 'Internal note',
    helper: 'Team only. Neither party ever sees this, and nobody is notified about it.',
    send: 'Save internal note',
    sending: 'Saving…',
    announce: 'Internal note mode. Neither party will see this message.',
  }),
})

/**
 * @param {object} props
 * @param {(payload: {body: string, attachments: object[], internal: boolean}) => Promise<*>}
 *   props.onSend posts the message — rejects to keep the draft intact
 * @param {boolean} [props.disabled] the case is settled and takes no more messages
 * @param {React.ReactNode} [props.disabledReason] why, in a sentence
 */
export default function AdminThreadComposer({ onSend, disabled, disabledReason }) {
  const [mode, setMode] = useState(MODE.PUBLIC)
  const [body, setBody] = useState('')
  const [isSending, setSending] = useState(false)
  const queue = useAttachmentQueue({ max: MAX_MESSAGE_ATTACHMENTS })

  const { reset: resetQueue } = queue
  const internal = mode === MODE.INTERNAL
  const meta = MODE_META[mode]
  const canSend = body.trim().length > 0 && !queue.isBlocked && !isSending

  const send = useCallback(async () => {
    if (!canSend) return

    setSending(true)
    try {
      await onSend?.({ body: body.trim(), attachments: queue.files, internal })
      // Cleared only on success: losing a drafted decision explanation to a
      // dropped connection is the worst moment here to lose one (§13).
      setBody('')
      resetQueue()
    } catch {
      // Reported by the page; the draft and the attachments stay put.
    } finally {
      setSending(false)
    }
  }, [body, canSend, internal, onSend, queue.files, resetQueue])

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
    <Paper
      variant="outlined"
      component="section"
      aria-label="Post on this case"
      sx={{
        p: { xs: 2, md: 2.5 },
        // The whole panel changes colour with the mode, not just the button —
        // by the time somebody is reading the send label it is already too late
        // to notice they were in the wrong one.
        borderColor: internal ? 'warning.main' : 'divider',
        bgcolor: (theme) =>
          internal ? alpha(theme.palette.warning.main, 0.06) : 'background.paper',
        transition: (theme) => theme.transitions.create(['border-color', 'background-color']),
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        sx={{ mb: 2 }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={mode}
          onChange={(event, next) => {
            if (next) setMode(next)
          }}
          aria-label="Who can read this message"
          sx={{ flexShrink: 0 }}
        >
          {Object.values(MODE).map((value) => {
            const option = MODE_META[value]
            return (
              <ToggleButton
                key={value}
                value={value}
                aria-label={option.announce}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  minHeight: 40,
                  gap: 0.75,
                  '&.Mui-selected': value === MODE.INTERNAL ? { color: 'warning.dark' } : undefined,
                }}
              >
                <Icon icon={option.icon} width={16} aria-hidden="true" />
                {option.label}
              </ToggleButton>
            )
          })}
        </ToggleButtonGroup>

        {/* The mode said in words, and announced when it changes — the toggle's
            pressed state alone is not something a screen reader user tracks
            while typing (§12). */}
        <Typography
          variant="caption"
          role="status"
          aria-live="polite"
          sx={{ color: internal ? 'warning.dark' : 'text.secondary', fontWeight: internal ? 700 : 400 }}
        >
          {meta.announce}
        </Typography>
      </Stack>

      <FormTextField
        id="admin-dispute-message"
        name="body"
        label={meta.fieldLabel}
        value={body}
        onChange={setBody}
        multiline
        minRows={3}
        maxRows={10}
        maxLength={DISPUTE_MESSAGE_MAX}
        helperText={meta.helper}
      />

      <Box aria-live="polite" sx={{ mt: queue.entries.length > 0 ? 1.5 : 0 }}>
        <AttachmentChips
          entries={queue.entries}
          onRemove={queue.removeFile}
          onRetry={queue.retryFile}
          label="Files attached to this message"
        />
        {/* Visually hidden, and hidden **without stretching the layout**: MUI's
            `sx` reads a bare `width: 1` as `100%`, which is a full-width
            absolutely-positioned box and a horizontal scrollbar at 360px. The
            units are explicit here for that reason (§11). */}
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
        <Typography variant="caption" color="warning.dark" sx={{ display: 'block', mt: 1 }}>
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
          variant="contained"
          color={internal ? 'warning' : 'primary'}
          disabled={!canSend}
          startIcon={
            <Icon icon={internal ? 'solar:notebook-linear' : 'solar:plain-linear'} width={18} aria-hidden="true" />
          }
          sx={{ minHeight: 44 }}
        >
          {isSending ? meta.sending : meta.send}
        </Button>
      </Stack>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
        Up to {MAX_MESSAGE_ATTACHMENTS} files, {EVIDENCE_MAX_SIZE_MB} MB each — images or PDFs.
      </Typography>
    </Paper>
  )
}
