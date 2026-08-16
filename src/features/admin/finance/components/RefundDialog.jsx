import { useEffect, useMemo, useState } from 'react'

import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import FormTextField from '@/components/inputs/FormTextField'
import CurrencyField from '@/components/inputs/CurrencyField'
import ResponsiveDialog from '@/components/layout/ResponsiveDialog'
import { formatCurrency } from '@/utils/formatters'

// Returning escrow to a buyer, from the finance console — Prompt 32 §4.2.
//
// This dialog is the confirmation, not a step before one: the consequence is
// spelled out in full, the amount is bounded and validated as it is typed, and
// the reason is mandatory because both parties are told and the entry is
// audited (00 §12). There is deliberately no second "are you sure?" on top —
// two dialogs teach a reader to click through the first one.
//
// The partial branch is not a variant of the full one. A partial refund
// **settles the remainder in the same operation** (`docs/payments.md` §6):
// the buyer gets their part back, the creator is released the rest, and
// commission is charged only on what the creator kept. That is a different
// sentence from "some money went back", so the dialog says it before the
// button is pressed rather than after.

const MODE = Object.freeze({ FULL: 'full', PARTIAL: 'partial' })

const REASON_MIN = 10
const REASON_MAX = 400

/**
 * Validates the typed amount against the held escrow — the same bound
 * `paymentService.refundPayment` enforces (`0 < x ≤ held`), checked here so the
 * reader is told before they submit rather than by a toast afterwards.
 *
 * @returns {{amount: number|null, error: string|null}}
 */
function validateAmount(raw, held, currency) {
  const amount = Number(raw)

  if (raw === '' || raw === null || !Number.isFinite(amount)) {
    return { amount: null, error: 'Enter the amount to return.' }
  }
  if (amount <= 0) {
    return { amount: null, error: 'Enter an amount greater than zero.' }
  }
  if (amount > held) {
    return {
      amount: null,
      error: `That is more than the ${formatCurrency(held, currency)} held on this order.`,
    }
  }
  return { amount, error: null }
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {object|null} props.payment the held payment row, with its `order`
 * @param {() => void} props.onClose
 * @param {(input: {amount: number|undefined, reason: string}) => Promise<void>} props.onSubmit
 *   resolves when the refund has been issued; rejects to keep the dialog open
 */
export default function RefundDialog({ open, payment, onClose, onSubmit }) {
  const [mode, setMode] = useState(MODE.FULL)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [failure, setFailure] = useState(null)

  const held = Number(payment?.amount) || 0
  const currency = payment?.currency

  // Reopening on another order must not inherit the last one's numbers.
  useEffect(() => {
    if (!open) return
    setMode(MODE.FULL)
    setAmount('')
    setReason('')
    setTouched(false)
    setFailure(null)
  }, [open, payment?.id])

  const isPartial = mode === MODE.PARTIAL

  const amountCheck = useMemo(
    () => (isPartial ? validateAmount(amount, held, currency) : { amount: held, error: null }),
    [amount, currency, held, isPartial]
  )

  const trimmedReason = reason.trim()
  const reasonError =
    trimmedReason.length === 0
      ? 'Record why this escrow is being returned.'
      : trimmedReason.length < REASON_MIN
        ? `Give a little more detail — at least ${REASON_MIN} characters.`
        : null

  const canSubmit = !amountCheck.error && !reasonError && !submitting

  const retained = isPartial && amountCheck.amount ? held - amountCheck.amount : 0

  const handleSubmit = async () => {
    setTouched(true)
    if (!canSubmit) return

    setSubmitting(true)
    setFailure(null)
    try {
      await onSubmit({
        // A full refund sends no amount at all: the service defaults to the
        // whole held sum, which cannot drift from a figure typed on a screen.
        amount: isPartial ? amountCheck.amount : undefined,
        reason: trimmedReason,
      })
    } catch (error) {
      setFailure(error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onClose={submitting ? undefined : onClose}
      title="Refund this escrow"
      description={
        payment?.order?.title
          ? `${formatCurrency(held, currency)} held on “${payment.order.title}”`
          : `${formatCurrency(held, currency)} held on this order`
      }
      maxWidth="sm"
      actions={
        <>
          <Button variant="text" color="inherit" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="contained" color="error" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Refunding…' : 'Refund escrow'}
          </Button>
        </>
      }
    >
      <Stack spacing={2.5}>
        {failure ? (
          <Alert severity="error" onClose={() => setFailure(null)}>
            {failure?.message ?? 'The refund could not be issued. Nothing has changed.'}
          </Alert>
        ) : null}

        {/* Said before anything is chosen, because it is the reason somebody
            should usually close this dialog again (§4.2). */}
        <Alert severity="info" variant="outlined" icon={false}>
          <Typography variant="body2">
            <strong>Prefer dispute resolution for contested orders.</strong> A refund issued here is
            a finance intervention: only one side has been heard, and there is no case record
            afterwards. If the buyer and the creator disagree, open or resolve the dispute instead.
          </Typography>
        </Alert>

        <Box>
          <Typography
            variant="subtitle2"
            component="p"
            id="refund-amount-mode-label"
            sx={{ mb: 0.5 }}
          >
            How much goes back?
          </Typography>
          <RadioGroup
            aria-labelledby="refund-amount-mode-label"
            value={mode}
            onChange={(event) => setMode(event.target.value)}
          >
            <FormControlLabel
              value={MODE.FULL}
              control={<Radio />}
              label={`Everything — ${formatCurrency(held, currency)} back to the buyer`}
            />
            <FormControlLabel value={MODE.PARTIAL} control={<Radio />} label="Part of it" />
          </RadioGroup>
        </Box>

        {isPartial ? (
          <CurrencyField
            id="refund-amount"
            name="amount"
            label="Amount to return"
            value={amount}
            onChange={setAmount}
            onBlur={() => setTouched(true)}
            required
            error={touched ? (amountCheck.error ?? false) : false}
            helperText={`Between ${formatCurrency(0.01, currency)} and ${formatCurrency(held, currency)}.`}
          />
        ) : null}

        <FormTextField
          id="refund-reason"
          name="reason"
          label="Reason"
          value={reason}
          onChange={setReason}
          onBlur={() => setTouched(true)}
          required
          multiline
          minRows={3}
          maxLength={REASON_MAX}
          error={touched ? (reasonError ?? false) : false}
          helperText="Both the buyer and the creator are told, and this is recorded in the audit trail."
        />

        {/* The consequence, in the shape it will actually take. `aria-live` so a
            reader who switches to partial hears the settlement rule (§12).
            While a partial amount is missing or out of range there is **no**
            consequence to state: falling back to the full-refund sentence would
            describe an outcome the dialog is not about to produce. */}
        <Alert
          severity={isPartial && !amountCheck.amount ? 'info' : 'warning'}
          variant="outlined"
          role="status"
          aria-live="polite"
        >
          <Typography variant="body2" component="div">
            {isPartial && !amountCheck.amount ? (
              'Enter an amount to see exactly what happens to this escrow.'
            ) : isPartial ? (
              <>
                <strong>{formatCurrency(amountCheck.amount, currency)}</strong> goes back to the
                buyer&apos;s card. The remaining{' '}
                <strong>{formatCurrency(retained, currency)}</strong> is released to the creator in
                the same step, with BetterBlue&apos;s commission charged only on that remainder.
                Both parties are notified. This cannot be undone.
              </>
            ) : (
              <>
                <strong>{formatCurrency(held, currency)}</strong> goes back to the buyer&apos;s
                card. The creator receives nothing from this order and BetterBlue earns no
                commission on it. Both parties are notified. This cannot be undone.
              </>
            )}
          </Typography>
        </Alert>
      </Stack>
    </ResponsiveDialog>
  )
}
