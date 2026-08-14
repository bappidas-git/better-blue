import InputAdornment from '@mui/material/InputAdornment'
import Typography from '@mui/material/Typography'

import FormTextField from '@/components/inputs/FormTextField'

// Money input with the unified field contract. Emits a sanitized numeric
// *string* while typing (so "12." and "12.5" survive mid-keystroke) and
// normalizes to two decimals on blur. Convert with `Number(value)` when
// submitting; render stored amounts with `formatCurrency` (00 §8).

/** Keeps digits and a single decimal point, capped at two decimal places. */
function sanitize(raw) {
  const cleaned = String(raw ?? '').replace(/[^\d.]/g, '')
  const [whole, ...fractionParts] = cleaned.split('.')
  if (fractionParts.length === 0) return whole
  return `${whole}.${fractionParts.join('').slice(0, 2)}`
}

/**
 * @param {object} props
 * @param {string} [props.id] DOM id — `useForm` supplies `field-<name>`
 * @param {string} [props.name] field name
 * @param {React.ReactNode} props.label visible label
 * @param {string|number} [props.value=''] current amount
 * @param {(value: string) => void} props.onChange receives the sanitized numeric string
 * @param {() => void} [props.onBlur] blur handler — runs after the 2dp normalization
 * @param {string|boolean} [props.error] error message (or `true` for a bare error state)
 * @param {React.ReactNode} [props.helperText] guidance shown when there is no error
 * @param {boolean} [props.required=false] marks the field required
 * @param {string} [props.currencySymbol='$'] prefix adornment — USD is the platform default
 */
export default function CurrencyField({
  value = '',
  onChange,
  onBlur,
  currencySymbol = '$',
  ...rest
}) {
  const handleChange = (next) => onChange?.(sanitize(next))

  const handleBlur = () => {
    const numeric = Number(value)
    if (value !== '' && value !== null && Number.isFinite(numeric)) {
      const normalized = numeric.toFixed(2)
      if (normalized !== String(value)) onChange?.(normalized)
    }
    onBlur?.()
  }

  return (
    <FormTextField
      value={value ?? ''}
      onChange={handleChange}
      onBlur={handleBlur}
      // `inputMode` gets the numeric keypad on phones without the spinner
      // arrows and locale quirks of `type="number"`.
      inputProps={{ inputMode: 'decimal', pattern: '[0-9]*\\.?[0-9]*' }}
      startAdornment={
        <InputAdornment position="start">
          <Typography component="span" color="text.secondary">
            {currencySymbol}
          </Typography>
        </InputAdornment>
      }
      {...rest}
    />
  )
}
