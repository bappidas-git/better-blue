import dayjs from 'dayjs'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'

// Date input with the unified field contract, built on the MUI X DatePicker +
// dayjs adapter mounted in AppProviders.
//
// Values cross this boundary as ISO 8601 *strings* (00 §8), never dayjs
// objects: forms hand `useForm` exactly what a service will POST. The default
// `YYYY-MM-DD` format keeps a picked calendar day from drifting across the
// timezone boundary the way a full UTC timestamp would; pass
// `valueFormat="iso"` when the field genuinely represents an instant.

const toDayjs = (value) => {
  if (!value) return null
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed : null
}

/**
 * @param {object} props
 * @param {string} [props.id] DOM id — `useForm` supplies `field-<name>`
 * @param {string} [props.name] field name
 * @param {React.ReactNode} props.label visible label
 * @param {string} [props.value] ISO date string (or anything dayjs can parse)
 * @param {(value: string|null) => void} props.onChange receives an ISO string, or null when cleared
 * @param {() => void} [props.onBlur] blur handler — `useForm` validates here
 * @param {string|boolean} [props.error] error message (or `true` for a bare error state)
 * @param {React.ReactNode} [props.helperText] guidance shown when there is no error
 * @param {boolean} [props.required=false] marks the field required
 * @param {string} [props.valueFormat='YYYY-MM-DD'] emitted format — `'iso'` emits a full UTC timestamp
 * @param {string|Date} [props.minDate] earliest selectable date
 * @param {string|Date} [props.maxDate] latest selectable date
 * @param {boolean} [props.disablePast=false] block dates before today
 */
export default function FormDateField({
  id,
  name,
  label,
  value,
  onChange,
  onBlur,
  error,
  helperText,
  required = false,
  valueFormat = 'YYYY-MM-DD',
  minDate,
  maxDate,
  disablePast = false,
  disabled = false,
  fullWidth = true,
  inputRef,
  sx,
  ...rest
}) {
  const hasError = Boolean(error)
  const message = typeof error === 'string' && error ? error : helperText

  const handleChange = (next) => {
    if (!next || !next.isValid?.()) {
      onChange?.(null)
      return
    }
    onChange?.(valueFormat === 'iso' ? next.toISOString() : next.format(valueFormat))
  }

  return (
    <DatePicker
      label={label}
      value={toDayjs(value)}
      onChange={handleChange}
      minDate={toDayjs(minDate) ?? undefined}
      maxDate={toDayjs(maxDate) ?? undefined}
      disablePast={disablePast}
      disabled={disabled}
      sx={sx}
      slotProps={{
        textField: {
          id,
          name,
          onBlur,
          error: hasError,
          helperText: message,
          required,
          fullWidth,
          inputRef,
        },
        // 44px touch targets inside the calendar popup (00 §13).
        openPickerButton: { 'aria-label': 'Choose date', sx: { width: 44, height: 44 } },
      }}
      {...rest}
    />
  )
}
