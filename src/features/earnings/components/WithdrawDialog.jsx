import { useEffect, useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'

import CurrencyField from '@/components/inputs/CurrencyField'
import ResponsiveDialog from '@/components/layout/ResponsiveDialog'
import { CREATOR_PAYOUT_METHOD_ANCHOR } from '@/features/creatorAccount/components/PayoutMethodCard'
import { focusFieldById } from '@/hooks/useForm'
import { paths } from '@/routes/paths'
import { formatCurrency } from '@/utils/formatters'

// Withdrawing is the one irreversible-feeling thing on this screen, so the
// dialog is deliberately calm: the balance first, one field, the destination
// spelled out, and a single confirm.
//
// **Every bound is checked twice and only computed once.** The inline messages
// below compare against `available` and `minimum`, both handed down from
// `paymentService.getEarningsBreakdown`; `paymentService.requestPayout` then
// re-derives the balance from the ledger and rejects anything that does not fit
// (`docs/payments.md` §8). The client check exists to explain, not to
// authorise — a request that slips past it still fails, with the service's own
// `validation_failed` message landing on this field.
//
// The success state stays in the dialog rather than closing it. "Requested" is
// not "paid", and a toast that vanishes is the wrong place to say so.

/**
 * Amount as a number, or `null` for anything that is not one. `CurrencyField`
 * emits a sanitised numeric **string** so "12." survives mid-keystroke.
 */
function toNumber(value) {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** The dialog's own bounds check — the message under the field, not the gate. */
function localError(amount, { available, minimum, currency }) {
  if (amount === null) return 'Enter the amount you would like to withdraw.'
  if (amount <= 0) return 'Enter an amount greater than zero.'
  if (amount < minimum) {
    return `The minimum payout is ${formatCurrency(minimum, currency)}.`
  }
  if (amount > available) {
    return `You have ${formatCurrency(available, currency)} available right now.`
  }
  return null
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {number} props.available the withdrawable balance
 * @param {number} props.minimum `platformSettings.general.payoutMinAmount`
 * @param {string} [props.currency]
 * @param {object|null} [props.method] the stored payout method, or `null`
 * @param {(amount: number) => Promise<object>} props.onConfirm requests the payout;
 *   rejects with the service's `ApiError`
 * @param {boolean} [props.isSubmitting=false]
 */
export default function WithdrawDialog({
  open,
  onClose,
  available = 0,
  minimum = 0,
  currency,
  method,
  onConfirm,
  isSubmitting = false,
}) {
  const [amount, setAmount] = useState('')
  const [touched, setTouched] = useState(false)
  const [serverError, setServerError] = useState(null)
  const [requested, setRequested] = useState(null)

  // Every open starts from a clean sheet: a stale amount, a stale error, or a
  // previous success card would all be worse than an empty field.
  useEffect(() => {
    if (!open) return
    setAmount('')
    setTouched(false)
    setServerError(null)
    setRequested(null)
  }, [open])

  const hasMethod = Boolean(method?.accountMasked)
  const numeric = toNumber(amount)
  const bounds = { available, minimum, currency }
  const validation = localError(numeric, bounds)
  const showError = touched && Boolean(validation)
  const canSubmit = hasMethod && !validation && !isSubmitting

  const handleSubmit = async (event) => {
    event.preventDefault()
    setTouched(true)
    setServerError(null)
    if (!canSubmit) {
      // An amount that does not fit gets the message *and* the cursor, rather
      // than a button that quietly stops working (00 §12). "No payout method"
      // is the one thing the field cannot fix, so it stays on the alert above
      // with its own "Add one" link.
      if (hasMethod && validation) focusFieldById('withdraw-amount')
      return
    }

    try {
      const payout = await onConfirm(numeric)
      setRequested(payout)
    } catch (failure) {
      // Field-level detail under the field, headline in the alert; the dialog
      // stays open either way so the amount is not retyped from memory (§13).
      setServerError({
        message: failure?.message ?? 'We could not request that payout.',
        amount: failure?.details?.amount,
      })
    }
  }

  const actions = requested ? (
    <Button variant="contained" onClick={onClose} sx={{ minHeight: 44 }}>
      Done
    </Button>
  ) : (
    <>
      <Button color="inherit" onClick={onClose} disabled={isSubmitting} sx={{ minHeight: 44 }}>
        Cancel
      </Button>
      <Button
        type="submit"
        form="withdraw-form"
        variant="contained"
        disabled={!hasMethod || isSubmitting}
        sx={{ minHeight: 44 }}
      >
        {isSubmitting ? 'Requesting…' : 'Request payout'}
      </Button>
    </>
  )

  return (
    <ResponsiveDialog
      open={open}
      onClose={isSubmitting ? undefined : onClose}
      title={requested ? 'Payout requested' : 'Withdraw your balance'}
      description={
        requested
          ? undefined
          : 'Payouts are reviewed by our finance team before the money is sent.'
      }
      actions={actions}
    >
      {requested ? (
        <Stack spacing={2} alignItems="flex-start">
          <Box
            aria-hidden="true"
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              color: 'success.dark',
              bgcolor: (theme) => alpha(theme.palette.success.main, 0.12),
            }}
          >
            <Icon icon="solar:check-circle-linear" width={26} />
          </Box>
          <Box>
            <Typography variant="h6" component="p" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(requested.amount, requested.currency ?? currency)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Payout requested — processed by our team, typically within 3 business days. It is
              already deducted from your available balance and shows as <strong>Requested</strong>{' '}
              in your payout history until it settles.
            </Typography>
          </Box>
        </Stack>
      ) : (
        <Box component="form" id="withdraw-form" onSubmit={handleSubmit} noValidate>
          <Stack spacing={2.5}>
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: (theme) => alpha(theme.palette.success.main, 0.08),
                border: 1,
                borderColor: (theme) => alpha(theme.palette.success.main, 0.22),
              }}
            >
              <Typography variant="overline" component="p" color="text.secondary">
                Available to withdraw
              </Typography>
              <Typography
                variant="h5"
                component="p"
                sx={{ fontVariantNumeric: 'tabular-nums', color: 'success.dark' }}
              >
                {formatCurrency(available, currency)}
              </Typography>
            </Box>

            {hasMethod ? null : (
              <Alert
                severity="warning"
                action={
                  <Button
                    component={RouterLink}
                    to={`${paths.CREATOR_PROFILE}#${CREATOR_PAYOUT_METHOD_ANCHOR}`}
                    color="inherit"
                    size="small"
                  >
                    Add one
                  </Button>
                }
              >
                Add a payout method on your profile before you withdraw — we have nowhere to send
                this yet.
              </Alert>
            )}

            {serverError?.message ? <Alert severity="error">{serverError.message}</Alert> : null}

            <Box>
              <CurrencyField
                id="withdraw-amount"
                name="amount"
                label="Amount to withdraw"
                value={amount}
                onChange={setAmount}
                onBlur={() => setTouched(true)}
                required
                disabled={!hasMethod || isSubmitting}
                error={serverError?.amount || (showError ? validation : undefined)}
                helperText={`Minimum ${formatCurrency(minimum, currency)} · maximum ${formatCurrency(
                  available,
                  currency
                )}`}
                inputProps={{
                  inputMode: 'decimal',
                  pattern: '[0-9]*\\.?[0-9]*',
                  // Announced by assistive tech alongside the label, so the
                  // bounds are heard and not only seen (§12).
                  'aria-valuemin': minimum,
                  'aria-valuemax': available,
                }}
              />
              <Box sx={{ mt: 1 }}>
                <Chip
                  label={`Withdraw all · ${formatCurrency(available, currency)}`}
                  onClick={() => {
                    setAmount(String(available))
                    setTouched(true)
                  }}
                  disabled={!hasMethod || isSubmitting || available <= 0}
                  size="small"
                  variant="outlined"
                />
              </Box>
            </Box>

            <Divider />

            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box aria-hidden="true" sx={{ display: 'flex', color: 'text.secondary' }}>
                <Icon icon="solar:card-linear" width={22} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary" component="p">
                  Sending to
                </Typography>
                <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {hasMethod ? `Bank account ${method.accountMasked}` : 'No payout method yet'}
                </Typography>
              </Box>
            </Stack>
          </Stack>
        </Box>
      )}
    </ResponsiveDialog>
  )
}
