import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Paper from '@mui/material/Paper'
import Radio from '@mui/material/Radio'
import Slider from '@mui/material/Slider'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import CurrencyField from '@/components/inputs/CurrencyField'
import FormTextField from '@/components/inputs/FormTextField'
import ResponsiveDialog from '@/components/layout/ResponsiveDialog'
import { DISPUTE_RESOLUTION } from '@/constants/statuses'
import OutcomePreview from '@/features/admin/disputes/components/OutcomePreview'
import useApiQuery from '@/hooks/useApiQuery'
import useDebounce from '@/hooks/useDebounce'
import { paymentService } from '@/services/paymentService'
import { RESOLUTION_NOTE_MAX, RESOLUTION_NOTE_MIN } from '@/services/disputeService'
import { formatCurrency } from '@/utils/formatters'

// Issuing a binding decision — Prompt 33 §4.4.
//
// Two steps, and the second one is not decoration. Everywhere else in the
// console a single confirming dialog is right (00 §12, and `RefundDialog` says
// so in as many words); this is the exception the same rule names: the action
// moves somebody's money **and** ends an order **and** cannot be undone, and
// the reviewer should read what they chose stated back to them before it
// happens. The wording of the second step is deliberately flat — "binding",
// "immediately", the exact figures — because a decision surface that dramatises
// is a decision surface people stop reading.
//
// The money is never computed here. `paymentService.previewSettlement` prices
// every outcome with the rate the settlement itself will charge (§7), and the
// partial amount is debounced through it rather than multiplied on screen.

/** Quiet period before a dragged or typed amount is priced. Matches `EarningsPreview`. */
const QUOTE_DELAY_MS = 250

const STEP = Object.freeze({ DECIDE: 'decide', CONFIRM: 'confirm', DONE: 'done' })

/** The three endings, in the order a reviewer weighs them. */
const OUTCOMES = Object.freeze([
  Object.freeze({
    value: DISPUTE_RESOLUTION.RELEASE_PAYMENT,
    label: 'Release payment to the creator',
    icon: 'solar:hand-money-linear',
    consequence:
      'The escrow is released in full, minus the usual commission, and the order completes. Nothing goes back to the buyer.',
  }),
  Object.freeze({
    value: DISPUTE_RESOLUTION.FULL_REFUND,
    label: 'Refund the buyer in full',
    icon: 'solar:card-recive-linear',
    consequence:
      'The whole escrow goes back to the buyer’s card and the order is marked refunded. The creator is paid nothing for it.',
  }),
  Object.freeze({
    value: DISPUTE_RESOLUTION.PARTIAL_REFUND,
    label: 'Partial refund',
    icon: 'solar:scale-linear',
    consequence:
      'Part of the escrow goes back to the buyer and the balance is released to the creator in the same step. The order completes — the engagement stands, at an adjusted price.',
  }),
])

/** An outcome card: a radio, a consequence, and — once chosen — its money. */
function OutcomeCard({ option, selected, onSelect, children }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 1.75, md: 2 },
        borderColor: selected ? 'primary.main' : 'divider',
        borderWidth: selected ? 2 : 1,
        bgcolor: (theme) => (selected ? alpha(theme.palette.primary.main, 0.04) : 'transparent'),
        transition: (theme) => theme.transitions.create(['border-color', 'background-color']),
      }}
    >
      <Box
        component="label"
        sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start', cursor: 'pointer' }}
      >
        <Radio
          checked={selected}
          onChange={() => onSelect(option.value)}
          value={option.value}
          name="dispute-outcome"
          inputProps={{ 'aria-describedby': `outcome-${option.value}-consequence` }}
          sx={{ p: 0.5, mt: '-2px' }}
        />
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Icon icon={option.icon} width={18} aria-hidden="true" />
            <Typography variant="subtitle2" component="span" sx={{ fontWeight: 700 }}>
              {option.label}
            </Typography>
          </Stack>
          <Typography
            id={`outcome-${option.value}-consequence`}
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5 }}
          >
            {option.consequence}
          </Typography>
        </Box>
      </Box>

      {selected && children ? <Box sx={{ mt: 1.5, pl: { xs: 0, sm: 4.5 } }}>{children}</Box> : null}
    </Paper>
  )
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {object} props.dispute the case being decided
 * @param {object} [props.order] the order it froze — its title and currency
 * @param {() => void} props.onClose
 * @param {(input: {outcome: string, amountRefunded?: number, note: string}) => Promise<object>}
 *   props.onResolve resolves with the service result; rejects to keep the
 *   dialog open with the failure shown
 */
export default function ResolveDialog({ open, dispute, order, onClose, onResolve }) {
  const [step, setStep] = useState(STEP.DECIDE)
  const [outcome, setOutcome] = useState(DISPUTE_RESOLUTION.RELEASE_PAYMENT)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [failure, setFailure] = useState(null)
  const [result, setResult] = useState(null)

  const headingRef = useRef(null)
  const orderId = order?.id ?? dispute?.orderId

  // Reopening on another case must not inherit the last one's decision.
  useEffect(() => {
    if (!open) return
    setStep(STEP.DECIDE)
    setOutcome(DISPUTE_RESOLUTION.RELEASE_PAYMENT)
    setAmount('')
    setNote('')
    setTouched(false)
    setFailure(null)
    setResult(null)
  }, [open, dispute?.id])

  // Stepwise focus: each step moves the reader to its own heading rather than
  // leaving them wherever the previous step's button was (§12).
  useEffect(() => {
    if (open) headingRef.current?.focus()
  }, [open, step])

  /* -- the money ----------------------------------------------------------- */

  const { data: escrow, isLoading: escrowLoading } = useApiQuery(
    () => paymentService.previewSettlement(orderId),
    [orderId],
    { enabled: Boolean(orderId) && open }
  )

  const held = escrow?.held ?? 0
  const isPartial = outcome === DISPUTE_RESOLUTION.PARTIAL_REFUND

  const debouncedAmount = useDebounce(amount, QUOTE_DELAY_MS)
  const { data: partial, isLoading: partialLoading } = useApiQuery(
    () => paymentService.previewSettlement(orderId, { refundAmount: Number(debouncedAmount) }),
    [orderId, debouncedAmount],
    { enabled: Boolean(orderId) && open && isPartial && Number(debouncedAmount) > 0 }
  )

  const fullRefund = useMemo(
    () => (escrow ? { ...escrow, refundedAmount: escrow.held } : null),
    [escrow]
  )

  const previewFor = (value) => {
    if (value === DISPUTE_RESOLUTION.FULL_REFUND) return fullRefund
    if (value === DISPUTE_RESOLUTION.PARTIAL_REFUND) return partial
    return escrow
  }

  /* -- validation ---------------------------------------------------------- */

  const typedAmount = Number(amount)
  const amountError = !isPartial
    ? null
    : amount === '' || !Number.isFinite(typedAmount) || typedAmount <= 0
      ? 'Enter how much goes back to the buyer.'
      : typedAmount >= held
        ? `That is the whole escrow — choose “Refund the buyer in full” instead.`
        : null

  const trimmedNote = note.trim()
  const noteError =
    trimmedNote.length === 0
      ? 'Explain the decision — both parties read this.'
      : trimmedNote.length < RESOLUTION_NOTE_MIN
        ? `Give a little more detail — at least ${RESOLUTION_NOTE_MIN} characters.`
        : null

  const noEscrow = !escrowLoading && held <= 0
  const canContinue = !amountError && !noteError && !noEscrow

  /* -- actions ------------------------------------------------------------- */

  const chooseOutcome = useCallback(
    (next) => {
      setOutcome(next)
      setFailure(null)
      // A sensible starting point rather than a blank slider: half the escrow
      // is where a split conversation usually begins, and it is immediately
      // adjustable. Only seeded once, so a reviewer's own figure survives a
      // change of mind and back again.
      if (next === DISPUTE_RESOLUTION.PARTIAL_REFUND && amount === '' && held > 0) {
        setAmount((held / 2).toFixed(2))
      }
    },
    [amount, held]
  )

  const submit = useCallback(async () => {
    setSubmitting(true)
    setFailure(null)
    try {
      const outcomeResult = await onResolve({
        outcome,
        ...(isPartial ? { amountRefunded: typedAmount } : {}),
        note: trimmedNote,
      })
      setResult(outcomeResult ?? {})
      setStep(STEP.DONE)
    } catch (error) {
      setFailure(error)
      // Back to the decision: whatever went wrong, the reviewer needs the form
      // rather than a confirmation of something that did not happen.
      setStep(STEP.DECIDE)
    } finally {
      setSubmitting(false)
    }
  }, [isPartial, onResolve, outcome, trimmedNote, typedAmount])

  /* -- rendering ----------------------------------------------------------- */

  const chosen = OUTCOMES.find((option) => option.value === outcome)
  const chosenPreview = previewFor(outcome)
  const settlement = result?.settlement

  const heading = (text) => (
    <Typography
      ref={headingRef}
      tabIndex={-1}
      variant="subtitle2"
      component="h3"
      sx={{ outline: 'none' }}
    >
      {text}
    </Typography>
  )

  const decideStep = (
    <Stack spacing={2.5}>
      {heading('Choose the outcome')}

      {failure ? (
        <Alert severity="error" onClose={() => setFailure(null)}>
          {failure?.message ?? 'The decision could not be issued. Nothing has changed.'}
        </Alert>
      ) : null}

      {noEscrow ? (
        <Alert severity="warning" variant="outlined">
          There is no payment held on this order, so a decision here would move nothing. Check the
          order before deciding.
        </Alert>
      ) : null}

      <Stack spacing={1.5} role="radiogroup" aria-label="Outcome">
        {OUTCOMES.map((option) => (
          <OutcomeCard
            key={option.value}
            option={option}
            selected={outcome === option.value}
            onSelect={chooseOutcome}
          >
            {option.value === DISPUTE_RESOLUTION.PARTIAL_REFUND ? (
              <Stack spacing={1.5}>
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    component="label"
                    id="partial-amount-label"
                    htmlFor="partial-refund-amount"
                  >
                    How much goes back to the buyer?
                  </Typography>
                  <Slider
                    value={Math.min(Math.max(Number(amount) || 0, 0), held)}
                    onChange={(event, next) => setAmount(Number(next).toFixed(2))}
                    min={0}
                    max={held}
                    step={1}
                    disabled={held <= 0}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => formatCurrency(value, escrow?.currency)}
                    aria-labelledby="partial-amount-label"
                    // The field below carries the exact figure; the slider is
                    // the coarse control, so its own text is the same number.
                    getAriaValueText={(value) => formatCurrency(value, escrow?.currency)}
                    sx={{ mt: 1 }}
                  />
                </Box>

                <CurrencyField
                  id="partial-refund-amount"
                  name="amountRefunded"
                  label="Amount returned to the buyer"
                  value={amount}
                  onChange={setAmount}
                  onBlur={() => setTouched(true)}
                  required
                  error={touched ? (amountError ?? false) : false}
                  helperText={`Between ${formatCurrency(0.01, escrow?.currency)} and ${formatCurrency(
                    Math.max(held - 0.01, 0),
                    escrow?.currency
                  )}.`}
                />

                <OutcomePreview
                  outcome={option.value}
                  preview={partial}
                  isLoading={partialLoading || escrowLoading}
                  dense
                />
              </Stack>
            ) : (
              <OutcomePreview
                outcome={option.value}
                preview={previewFor(option.value)}
                isLoading={escrowLoading}
                dense
              />
            )}
          </OutcomeCard>
        ))}
      </Stack>

      <FormTextField
        id="resolution-note"
        name="note"
        label="Why you decided this"
        value={note}
        onChange={setNote}
        onBlur={() => setTouched(true)}
        required
        multiline
        minRows={4}
        maxLength={RESOLUTION_NOTE_MAX}
        error={touched ? (noteError ?? false) : false}
        helperText={`Both the buyer and the creator read this word for word on their copy of the dispute. At least ${RESOLUTION_NOTE_MIN} characters.`}
      />
    </Stack>
  )

  const confirmStep = (
    <Stack spacing={2.5}>
      {heading('Confirm this decision')}

      <Alert
        severity="warning"
        variant="outlined"
        icon={<Icon icon="solar:shield-warning-linear" width={20} aria-hidden="true" />}
      >
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          This is binding and executes immediately.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          The money moves, the order is closed out, both parties are notified, and the decision is
          written to the audit trail. It cannot be undone from here.
        </Typography>
      </Alert>

      <Box>
        <Typography variant="subtitle2" component="p" sx={{ mb: 0.5 }}>
          {chosen?.label}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {chosen?.consequence}
        </Typography>
      </Box>

      <OutcomePreview outcome={outcome} preview={chosenPreview} isLoading={escrowLoading} />

      <Box>
        <Typography variant="subtitle2" component="p" sx={{ mb: 0.5 }}>
          What both parties will read
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ whiteSpace: 'pre-line', wordBreak: 'break-word' }}
        >
          {trimmedNote}
        </Typography>
      </Box>
    </Stack>
  )

  const doneStep = (
    <Stack spacing={2.5}>
      {heading('Decision issued')}

      <Stack direction="row" spacing={1.25} alignItems="flex-start">
        <Box sx={{ color: 'success.main', display: 'flex', pt: 0.25 }}>
          <Icon icon="solar:shield-check-linear" width={22} aria-hidden="true" />
        </Box>
        <Typography variant="body2" color="text.secondary">
          The case is resolved and the money has moved. Both parties have been notified and the
          decision is on their copy of the dispute, with your reasoning.
        </Typography>
      </Stack>

      <Divider />

      <OutcomePreview outcome={outcome} preview={settlement ?? chosenPreview} />

      <Typography variant="caption" color="text.secondary">
        The order and the ledger have been updated. Close this case from the workspace once both
        parties have had a chance to read the outcome.
      </Typography>
    </Stack>
  )

  const actions = () => {
    if (step === STEP.DONE) {
      return (
        <Button variant="contained" onClick={onClose}>
          Done
        </Button>
      )
    }
    if (step === STEP.CONFIRM) {
      return (
        <>
          <Button
            variant="text"
            color="inherit"
            onClick={() => setStep(STEP.DECIDE)}
            disabled={submitting}
          >
            Back
          </Button>
          <Button variant="contained" color="primary" onClick={submit} disabled={submitting}>
            {submitting ? 'Issuing…' : 'Issue decision'}
          </Button>
        </>
      )
    }
    return (
      <>
        <Button variant="text" color="inherit" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            setTouched(true)
            if (canContinue) setStep(STEP.CONFIRM)
          }}
          disabled={!canContinue}
        >
          Review decision
        </Button>
      </>
    )
  }

  return (
    <ResponsiveDialog
      open={open}
      onClose={submitting ? undefined : onClose}
      title="Resolve this dispute"
      description={
        order?.title
          ? `${order.title} · ${formatCurrency(held, escrow?.currency)} held`
          : 'Decide what happens to the money held on this order'
      }
      maxWidth="sm"
      actions={actions()}
    >
      {step === STEP.DECIDE ? decideStep : step === STEP.CONFIRM ? confirmStep : doneStep}
    </ResponsiveDialog>
  )
}
