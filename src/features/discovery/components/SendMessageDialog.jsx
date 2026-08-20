import { useEffect, useId, useRef, useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

import CreatorLevelBadge from '@/components/data-display/CreatorLevelBadge'
import UserAvatar from '@/components/data-display/UserAvatar'
import { useToast } from '@/components/feedback/ToastProvider'
import ResponsiveDialog from '@/components/layout/ResponsiveDialog'
import useApiMutation from '@/hooks/useApiMutation'
import { directMessagesService, DIRECT_MESSAGE_MAX, DIRECT_MESSAGE_MIN } from '@/services'
import { formatNumber } from '@/utils/formatters'

// "Send message" for a signed-in buyer — Storefront V2 (`prompts-v2/09` §4).
//
// A first contact, not a brief: who the buyer is writing to across the top, one
// field, and a send. There is no subject, no attachment, and no price, because
// none of those is what this is for — a buyer with a job to specify has the
// feed board, and this is the message that comes before one exists.
//
// **The bounds come from `directMessagesService`**, not from numbers written
// here, so the counter and the rejection agree by construction — the rule
// `ReplyComposer` follows for feed replies.
//
// **Honest limitation:** there is no creator-side inbox yet. The message is
// written to `directMessages` and raises a notification on the creator's bell;
// the dialog says so rather than implying a conversation is about to start.

/** Rows the field opens at — enough for a paragraph without dominating the sheet. */
const FIELD_ROWS = 5

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {object|null} props.creator the storefront being written to
 * @param {string} props.buyerId `usr_…` — the signed-in buyer
 */
export default function SendMessageDialog({ open, onClose, creator, buyerId }) {
  const toast = useToast()
  const fieldId = useId()

  const [value, setValue] = useState('')
  const [isTouched, setTouched] = useState(false)
  const fieldRef = useRef(null)

  const { mutate, isLoading, error, reset } = useApiMutation((...args) =>
    directMessagesService.sendMessage(...args)
  )

  // A dialog is remounted with the same component instance each time it opens,
  // so the draft and the last failure are cleared on the way *in* rather than
  // on the way out — closing mid-send would otherwise leave the next creator
  // looking at the previous one's message.
  useEffect(() => {
    if (!open) return undefined

    setValue('')
    setTouched(false)
    reset()

    // MUI's focus trap parks focus on the dialog container on mount, which
    // lands *after* React honours `autoFocus` and takes it back. A frame later
    // the trap has finished and the field can keep it — which is what makes the
    // dialog usable without a first Tab.
    const frame = window.requestAnimationFrame(() => fieldRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [open, creator?.id, reset])

  const body = value.trim()
  const isTooShort = body.length < DIRECT_MESSAGE_MIN
  const isTooLong = body.length > DIRECT_MESSAGE_MAX
  const isInvalid = isTooShort || isTooLong
  // Nothing is wrong with an empty box somebody has not tried to send yet.
  const showError = isTouched && isInvalid

  // The field error the service returned, if it named one — so a rule enforced
  // server-side lands under the field rather than only in a toast (00 §12).
  const serverFieldError = error?.details?.body ?? null

  const handleSubmit = async (event) => {
    event.preventDefault()
    setTouched(true)

    // Submit is never disabled on an invalid draft, only while one is in
    // flight: clicking the footer button blurs the field, and a button that
    // goes dead under the pointer at that moment tells nobody why. Pressing it
    // runs the check, shows the message under the field, and puts the cursor
    // back in it — 00 §12's "first invalid field focused on submit".
    if (isInvalid || !creator) {
      fieldRef.current?.focus()
      return
    }
    if (isLoading) return

    try {
      await mutate(creator.id, { buyerId, body })
    } catch {
      // `useApiMutation` records it for the inline alert below; the toast says
      // it out loud. A failed send keeps what was written.
      toast.error('We could not send your message.', {
        description: 'Nothing was lost — try again in a moment.',
      })
      return
    }

    toast.success(`Message sent to ${creator.displayName}`, {
      description: 'They have been notified. You will hear back through BetterBlue.',
    })
    onClose?.()
  }

  const helper = showError
    ? isTooShort
      ? `Write at least ${formatNumber(DIRECT_MESSAGE_MIN)} characters so the creator can answer it.`
      : `Keep it under ${formatNumber(DIRECT_MESSAGE_MAX)} characters.`
    : (serverFieldError ??
      'Say what you sell, what you need shot, and roughly when. A creator can answer that.')

  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      title="Send a message"
      description={
        creator
          ? `Open a conversation with ${creator.displayName} about commissioning content.`
          : undefined
      }
      actions={
        <Stack
          direction={{ xs: 'column-reverse', sm: 'row' }}
          spacing={1}
          sx={{ width: '100%', justifyContent: 'flex-end' }}
        >
          <Button variant="text" color="inherit" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={`${fieldId}-form`}
            variant="gradient"
            disabled={isLoading}
            startIcon={<Icon icon="solar:plain-linear" width={18} aria-hidden="true" />}
          >
            {isLoading ? 'Sending…' : 'Send message'}
          </Button>
        </Stack>
      }
    >
      {creator ? (
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2.5 }}>
          <UserAvatar name={creator.displayName} size={48} />
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {creator.displayName}
              </Typography>
              <CreatorLevelBadge creator={creator} tooltip={false} />
            </Stack>
            {creator.tagline ? (
              <Typography variant="body2" color="text.secondary">
                {creator.tagline}
              </Typography>
            ) : null}
          </Box>
        </Stack>
      ) : null}

      <Box component="form" id={`${fieldId}-form`} noValidate onSubmit={handleSubmit}>
        <TextField
          id={fieldId}
          label="Your message"
          placeholder="Tell them about your business and the content you need."
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => setTouched(true)}
          inputRef={fieldRef}
          multiline
          minRows={FIELD_ROWS}
          fullWidth
          disabled={isLoading}
          error={showError || Boolean(serverFieldError)}
          // Both lines live in the helper slot, so MUI wires them into
          // `aria-describedby` and the count is read with the field rather than
          // announced on every keystroke.
          helperText={
            <Box
              component="span"
              sx={{
                display: 'flex',
                gap: 1,
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <Box component="span" sx={{ minWidth: 0 }}>
                {helper}
              </Box>
              <Box
                component="span"
                sx={{
                  flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums',
                  color: isTooLong ? 'error.dark' : 'inherit',
                }}
              >
                {formatNumber(body.length)}/{formatNumber(DIRECT_MESSAGE_MAX)}
              </Box>
            </Box>
          }
        />
      </Box>

      {error && !serverFieldError ? (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error.message ?? 'We could not send your message.'}
        </Alert>
      ) : null}

      {/* Said plainly rather than implied: the creator gets a notification, and
          replying to it is not built yet. A buyer who expects a thread and
          finds none would be right to feel misled. */}
      <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mt: 2 }}>
        <Box aria-hidden="true" sx={{ display: 'flex', color: 'text.secondary', mt: 0.25 }}>
          <Icon icon="solar:info-circle-linear" width={20} />
        </Box>
        <Typography variant="caption" color="text.secondary">
          Your message is delivered to the creator’s notifications. Threaded replies are coming —
          for now, a creator who wants the work will reach you through a proposal on one of your
          feeds.
        </Typography>
      </Stack>
    </ResponsiveDialog>
  )
}
