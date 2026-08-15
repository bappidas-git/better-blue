import { useCallback, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import FormTextField from '@/components/inputs/FormTextField'
import {
  CARD_BRAND_META,
  CVV_MAX_LENGTH,
  MAX_CARD_DIGITS,
  caretIndexForDigits,
  cardNumberRule,
  cvvRule,
  detectCardBrand,
  digitsOf,
  expiryRule,
  formatCardNumber,
  formatCvv,
  formatExpiry,
  lastFourOf,
} from '@/features/checkout/cardUtils'
import useForm from '@/hooks/useForm'
import { compose, minLength, required } from '@/utils/validators'

// The payment method form. It knows about *cards* and nothing about processors
// (Prompt 19 §7): on submit it hands the parent `{ brand, last4, number }`, and
// the parent hands that to `paymentService`. A different provider — or a stored
// method, or a wallet — replaces this component without the page changing.
//
// The number, expiry, and CVV live in React state for exactly as long as one
// submit takes and are never persisted (00 §14). Only `brand` and `last4`
// survive into the payment record.
//
// Accessibility (§12): every field carries the standard `autocomplete` token so
// a password manager can fill the form, `inputMode="numeric"` so phones open
// the number pad, and the caret is put back where the person left it after a
// keystroke reformats the value.

/** Field names, spelled once — the caret logic looks fields up by name. */
const NAME_FIELD = 'cardholderName'
const NUMBER_FIELD = 'cardNumber'
const EXPIRY_FIELD = 'expiry'
const CVV_FIELD = 'cvv'

const INITIAL_VALUES = Object.freeze({
  [NAME_FIELD]: '',
  [NUMBER_FIELD]: '',
  [EXPIRY_FIELD]: '',
  [CVV_FIELD]: '',
})

/**
 * @param {object} props
 * @param {string} props.formId DOM id, so a submit button rendered outside the
 *   form (the mobile sticky bar) can still submit it
 * @param {(method: {brand: string, last4: string, number: string,
 *   cardholderName: string}) => void} props.onSubmit — only `brand` and `last4`
 *   are ever stored; the rest is handed to the provider and dropped
 * @param {string} [props.initialName=''] cardholder name to start with. A retry
 *   after a decline remounts this form (the page keys it on the retry count),
 *   which is what clears the card — and this is what carries the name across.
 * @param {boolean} [props.disabled=false] freeze every control while a charge is in flight
 * @param {React.ReactNode} [props.submitSlot] the pay button, rendered inside the
 *   form on desktop and omitted on mobile where it lives in the sticky bar
 * @param {React.Ref} [props.fillRef] imperative handle exposing `fill(values)`,
 *   used by the dev-only test-card panel
 */
export default function DummyCardForm({
  formId,
  onSubmit,
  initialName = '',
  disabled = false,
  submitSlot,
  fillRef,
}) {
  const [showCvv, setShowCvv] = useState(false)

  const form = useForm({
    // `useForm` reads these once, on mount — which is exactly the semantics
    // wanted here: a retry remounts with the name and nothing else.
    initialValues: { ...INITIAL_VALUES, [NAME_FIELD]: initialName },
    // Declaration order is what `useForm` treats as "first invalid field", so
    // it deliberately matches the visual order of the fields below.
    validators: {
      [NAME_FIELD]: compose(
        required('Enter the name printed on the card.'),
        minLength(2, 'That name looks too short.')
      ),
      [NUMBER_FIELD]: cardNumberRule(),
      [EXPIRY_FIELD]: expiryRule(),
      [CVV_FIELD]: cvvRule(),
    },
  })

  const { setValue, setValues, registerField } = form

  // name -> input node. `useForm` registers its own ref to focus errors; this
  // map is what the caret restore reads, so both are attached to each input.
  const nodes = useRef({})
  const refCallbacks = useRef({})
  const pendingCaret = useRef(null)
  const valuesRef = useRef(form.values)
  valuesRef.current = form.values

  /** One stable ref callback per field, forwarding to `useForm`'s as well. */
  const inputRef = useCallback(
    (name) => {
      if (!refCallbacks.current[name]) {
        const registered = registerField(name)
        refCallbacks.current[name] = (node) => {
          if (node) nodes.current[name] = node
          else delete nodes.current[name]
          registered(node)
        }
      }
      return refCallbacks.current[name]
    },
    [registerField]
  )

  /**
   * Reformats as the person types, and remembers where the caret should land.
   *
   * At this point the DOM node still holds the *unformatted* text and the real
   * caret, so counting the digits to its left survives the reformat — which is
   * what makes correcting a digit in the middle of a card number possible at
   * all.
   */
  const handleFormatted = (name, formatter) => (next) => {
    const node = nodes.current[name]
    const selection = node?.selectionStart ?? String(next).length
    const digitsBefore = digitsOf(String(next).slice(0, selection)).length
    const formatted = formatter(next)

    pendingCaret.current = { name, index: caretIndexForDigits(formatted, digitsBefore) }
    setValue(name, formatted)
  }

  useLayoutEffect(() => {
    const pending = pendingCaret.current
    if (!pending) return
    pendingCaret.current = null

    const node = nodes.current[pending.name]
    if (node && node.selectionStart !== pending.index) {
      node.setSelectionRange(pending.index, pending.index)
    }
  })

  useImperativeHandle(
    fillRef,
    () => ({
      /**
       * Used only by the dev-only test-card panel — absent from any build.
       * A name already typed is kept: the panel is there to save typing a
       * sixteen-digit number, not to overwrite what someone entered.
       */
      fill: (values) =>
        setValues({
          ...valuesRef.current,
          ...values,
          [NAME_FIELD]: valuesRef.current[NAME_FIELD] || values[NAME_FIELD] || '',
        }),
    }),
    [setValues]
  )

  const brandMeta = CARD_BRAND_META[detectCardBrand(form.values[NUMBER_FIELD])]

  const submit = form.handleSubmit(async (values) => {
    const number = digitsOf(values[NUMBER_FIELD])
    await onSubmit?.({
      brand: detectCardBrand(number),
      last4: lastFourOf(number),
      number,
      cardholderName: values[NAME_FIELD],
    })
  })

  return (
    <Box component="form" id={formId} onSubmit={submit} noValidate>
      <Stack spacing={2.5}>
        <FormTextField
          {...form.fieldProps(NAME_FIELD)}
          inputRef={inputRef(NAME_FIELD)}
          label="Name on card"
          required
          disabled={disabled}
          autoComplete="cc-name"
          inputProps={{ autoCapitalize: 'words', maxLength: 60 }}
        />

        <FormTextField
          {...form.fieldProps(NUMBER_FIELD)}
          inputRef={inputRef(NUMBER_FIELD)}
          onChange={handleFormatted(NUMBER_FIELD, formatCardNumber)}
          label="Card number"
          required
          disabled={disabled}
          autoComplete="cc-number"
          placeholder="1234 5678 9012 3456"
          // Sixteen digits plus the three spaces that group them.
          inputProps={{ inputMode: 'numeric', maxLength: MAX_CARD_DIGITS + 3 }}
          endAdornment={
            <InputAdornment position="end">
              <Stack
                direction="row"
                spacing={0.75}
                alignItems="center"
                sx={{ color: 'text.secondary' }}
              >
                <Icon icon={brandMeta.icon} width={24} aria-hidden="true" />
                {/* The label carries the meaning, so a brand icon that fails to
                    resolve still leaves the network named. */}
                <Box component="span" sx={{ typography: 'caption' }}>
                  {brandMeta.label}
                </Box>
              </Stack>
            </InputAdornment>
          }
        />

        <Stack direction="row" spacing={2}>
          <FormTextField
            {...form.fieldProps(EXPIRY_FIELD)}
            inputRef={inputRef(EXPIRY_FIELD)}
            onChange={handleFormatted(EXPIRY_FIELD, formatExpiry)}
            label="Expiry"
            required
            disabled={disabled}
            autoComplete="cc-exp"
            placeholder="MM/YY"
            inputProps={{ inputMode: 'numeric', maxLength: 5 }}
          />

          <FormTextField
            {...form.fieldProps(CVV_FIELD)}
            inputRef={inputRef(CVV_FIELD)}
            onChange={(next) => setValue(CVV_FIELD, formatCvv(next))}
            label="Security code"
            required
            disabled={disabled}
            type={showCvv ? 'text' : 'password'}
            autoComplete="cc-csc"
            placeholder="123"
            inputProps={{ inputMode: 'numeric', maxLength: CVV_MAX_LENGTH }}
            endAdornment={
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowCvv((shown) => !shown)}
                  edge="end"
                  disabled={disabled}
                  aria-label={showCvv ? 'Hide security code' : 'Show security code'}
                  sx={{ width: 44, height: 44 }}
                >
                  <Icon
                    icon={showCvv ? 'solar:eye-closed-linear' : 'solar:eye-linear'}
                    width={20}
                  />
                </IconButton>
              </InputAdornment>
            }
          />
        </Stack>

        {submitSlot}

        <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="center">
          <Box sx={{ display: 'flex', color: 'text.disabled' }}>
            <Icon icon="solar:lock-keyhole-minimalistic-linear" width={14} aria-hidden="true" />
          </Box>
          <Typography variant="caption" color="text.secondary" align="center">
            Demo payment — no card is charged and no card number is stored.
          </Typography>
        </Stack>
      </Stack>
    </Box>
  )
}
