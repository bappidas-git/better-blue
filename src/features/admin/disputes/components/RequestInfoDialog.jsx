import { useCallback, useEffect, useState } from 'react'

import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import FormTextField from '@/components/inputs/FormTextField'
import ResponsiveDialog from '@/components/layout/ResponsiveDialog'
import { focusFieldById } from '@/hooks/useForm'
import { ROLES } from '@/constants/roles'
import { DISPUTE_MESSAGE_MAX, canRequestInfo } from '@/services/disputeService'

// Asking one party for something — Prompt 33 §4.3.
//
// The message is **public**, and the dialog says so before the field rather
// than after it. A request made privately is a request the other side cannot
// see was made, and in casework that is how an impartial decision stops looking
// impartial.
//
// Only the parties the machine can actually park the case on are offered: with
// a case already sitting with the buyer there is no `awaiting_buyer →
// awaiting_creator` edge (00 §9), and offering the creator here would be
// offering an action that fails on send.

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {object} props.dispute the case
 * @param {{buyer: object|null, creator: object|null}} [props.parties] for the
 *   names on the two options
 * @param {() => void} props.onClose
 * @param {(input: {from: string, message: string}) => Promise<void>} props.onSubmit
 *   resolves when the request has been sent; rejects to keep the dialog open
 */
export default function RequestInfoDialog({ open, dispute, parties, onClose, onSubmit }) {
  const canAskBuyer = canRequestInfo(dispute, ROLES.BUYER)
  const canAskCreator = canRequestInfo(dispute, ROLES.CREATOR)

  const [from, setFrom] = useState(ROLES.BUYER)
  const [message, setMessage] = useState('')
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [failure, setFailure] = useState(null)

  useEffect(() => {
    if (!open) return
    setFrom(canAskBuyer ? ROLES.BUYER : ROLES.CREATOR)
    setMessage('')
    setTouched(false)
    setFailure(null)
  }, [open, dispute?.id, canAskBuyer])

  const trimmed = message.trim()
  const messageError = trimmed.length === 0 ? 'Say what you need from them.' : null
  const canSubmit = !messageError && !submitting

  const submit = useCallback(async () => {
    setTouched(true)
    if (!canSubmit) {
      if (messageError) focusFieldById('request-info-message')
      return
    }

    setSubmitting(true)
    setFailure(null)
    try {
      await onSubmit({ from, message: trimmed })
    } catch (error) {
      setFailure(error)
    } finally {
      setSubmitting(false)
    }
  }, [canSubmit, from, messageError, onSubmit, trimmed])

  const option = (role, label, person) => (
    <FormControlLabel
      value={role}
      control={<Radio />}
      disabled={role === ROLES.BUYER ? !canAskBuyer : !canAskCreator}
      label={
        <Box>
          <Typography variant="body2" component="span" sx={{ fontWeight: 600 }}>
            {label}
          </Typography>
          {person?.name ? (
            <Typography variant="caption" color="text.secondary" component="span" sx={{ ml: 1 }}>
              {person.name}
            </Typography>
          ) : null}
        </Box>
      }
    />
  )

  return (
    <ResponsiveDialog
      open={open}
      onClose={submitting ? undefined : onClose}
      title="Ask a party for more information"
      description="The case parks with them until they reply, then comes straight back to you."
      maxWidth="sm"
      actions={
        <>
          <Button variant="text" color="inherit" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="contained" onClick={submit} disabled={submitting}>
            {submitting ? 'Sending…' : 'Send request'}
          </Button>
        </>
      }
    >
      <Stack spacing={2.5}>
        {failure ? (
          <Alert severity="error" onClose={() => setFailure(null)}>
            {failure?.message ?? 'The request could not be sent. Nothing has changed.'}
          </Alert>
        ) : null}

        <Box>
          <Typography variant="subtitle2" component="p" id="request-info-target" sx={{ mb: 0.5 }}>
            Who are you asking?
          </Typography>
          <RadioGroup
            aria-labelledby="request-info-target"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          >
            {option(ROLES.BUYER, 'The buyer', parties?.buyer)}
            {option(ROLES.CREATOR, 'The creator', parties?.creator)}
          </RadioGroup>
        </Box>

        <FormTextField
          id="request-info-message"
          name="message"
          label="What do you need?"
          value={message}
          onChange={setMessage}
          onBlur={() => setTouched(true)}
          required
          multiline
          minRows={4}
          maxLength={DISPUTE_MESSAGE_MAX}
          error={touched ? (messageError ?? false) : false}
          helperText="Posted on the thread, where both parties can read it."
        />

        <Alert severity="info" variant="outlined" icon={false}>
          <Typography variant="body2">
            <strong>Both parties see this message.</strong> Only the one you choose is notified and
            asked to reply — use an internal note if this is for the team.
          </Typography>
        </Alert>
      </Stack>
    </ResponsiveDialog>
  )
}
