import { useId, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'

import { REPLY_BODY_MAX, REPLY_BODY_MIN } from '@/services/feedService'
import { formatNumber } from '@/utils/formatters'

// The box a creator writes in — used both to open a reply and to add to one
// (Storefront V2, `prompts-v2/08` §2).
//
// One component for both, because they are the same control with different
// copy: the same bounds, the same counter, the same disabled rules. Two would
// have drifted the first time the limit moved.
//
// **The bounds come from `feedService`**, not from a number written here.
// `createReply` and `addReplyMessage` validate every message against
// `REPLY_BODY_MIN`/`REPLY_BODY_MAX` on the way out (V2-03), so a composer with
// its own idea of "long enough" would be a composer that lets a creator write a
// message the service then refuses. Importing the constants is what makes the
// counter and the rejection agree by construction.

/**
 * @param {object} props
 * @param {string} props.label the field's visible label
 * @param {string} props.placeholder
 * @param {string} props.submitLabel the button
 * @param {(body: string) => Promise<*>} props.onSubmit resolves once the
 *   message is away — the composer clears itself only then, so a failed send
 *   never costs the creator what they wrote
 * @param {boolean} [props.isSubmitting=false]
 * @param {boolean} [props.disabled=false]
 * @param {string} [props.hint] a line under the field, when there is one worth
 *   saying; the counter shares the slot either way
 * @param {number} [props.rows=4]
 * @param {object} [props.inputRef] ref onto the textarea, for `intent=reply`
 * @param {object} [props.sx]
 */
export default function ReplyComposer({
  label,
  placeholder,
  submitLabel,
  onSubmit,
  isSubmitting = false,
  disabled = false,
  hint,
  rows = 4,
  inputRef,
  sx,
}) {
  const fieldId = useId()
  const [value, setValue] = useState('')
  const [isTouched, setTouched] = useState(false)

  const body = value.trim()
  const isTooShort = body.length < REPLY_BODY_MIN
  const isTooLong = body.length > REPLY_BODY_MAX
  const isInvalid = isTooShort || isTooLong
  // Nothing is wrong with an empty box the creator has not tried to send yet.
  const showError = isTouched && isInvalid

  const handleSubmit = async (event) => {
    event.preventDefault()
    setTouched(true)
    if (isInvalid || isSubmitting || disabled) return

    try {
      await onSubmit(body)
    } catch {
      // Only a resolved submit clears the field: a rejected one leaves the text
      // where the creator can send it again. Saying *why* is the caller's job —
      // it owns the mutation and toasts the failure (00 §12).
      return
    }
    setValue('')
    setTouched(false)
  }

  const message = showError
    ? isTooShort
      ? `Write at least ${formatNumber(REPLY_BODY_MIN)} characters so the buyer has something to answer.`
      : `Keep it under ${formatNumber(REPLY_BODY_MAX)} characters.`
    : hint

  return (
    <Box
      component="form"
      noValidate
      onSubmit={handleSubmit}
      sx={{
        // The glow is the composer's focus state, one element at a time and
        // never behind body copy (docs/theme-v2.md §5). The field keeps its own
        // purple ring; this is the halo around the box that holds it.
        borderRadius: 'var(--bb-radius-lg)',
        transition: (theme) => theme.transitions.create('box-shadow', { duration: 200 }),
        '&:focus-within': { boxShadow: (theme) => theme.customShadows.glowPurple },
        ...sx,
      }}
    >
      <TextField
        id={fieldId}
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => setTouched(true)}
        inputRef={inputRef}
        multiline
        minRows={rows}
        fullWidth
        disabled={disabled || isSubmitting}
        error={showError}
        // Both lines live in the helper slot, so MUI wires them into
        // `aria-describedby` and the count is read with the field rather than
        // announced on every keystroke.
        helperText={
          <Box
            component="span"
            sx={{ display: 'flex', gap: 1, justifyContent: 'space-between', alignItems: 'baseline' }}
          >
            <Box component="span" sx={{ minWidth: 0 }}>
              {message}
            </Box>
            <Box
              component="span"
              sx={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums', color: isTooLong ? 'error.dark' : 'inherit' }}
            >
              {formatNumber(body.length)}/{formatNumber(REPLY_BODY_MAX)}
            </Box>
          </Box>
        }
      />

      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
        <Button
          type="submit"
          variant="gradient"
          disabled={disabled || isSubmitting || (isTouched && isInvalid)}
          startIcon={<Icon icon="solar:plain-linear" width={18} aria-hidden="true" />}
        >
          {isSubmitting ? 'Sending…' : submitLabel}
        </Button>
      </Stack>
    </Box>
  )
}
