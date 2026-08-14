import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'

// Text input with the unified field contract every BetterBlue form uses:
// `{ label, value, onChange(value), error, helperText, required }`. Features
// pass values, not events, so `useForm().fieldProps(name)` spreads straight in.

/**
 * @param {object} props
 * @param {string} [props.id] DOM id — `useForm` supplies `field-<name>` so submit can focus it
 * @param {string} [props.name] field name
 * @param {React.ReactNode} props.label visible label (never use placeholder-as-label)
 * @param {string} [props.value=''] current value
 * @param {(value: string) => void} props.onChange receives the new value, not the event
 * @param {() => void} [props.onBlur] blur handler — `useForm` validates here
 * @param {string|boolean} [props.error] error message (or `true` for a bare error state)
 * @param {React.ReactNode} [props.helperText] guidance shown when there is no error
 * @param {boolean} [props.required=false] marks the field required
 * @param {boolean} [props.multiline=false] render a textarea
 * @param {number} [props.minRows=3] textarea starting height
 * @param {number} [props.maxRows] textarea growth cap
 * @param {number} [props.maxLength] hard character cap — also renders a live counter
 * @param {string} [props.type='text'] input type
 * @param {React.ReactNode} [props.startAdornment] leading adornment
 * @param {React.ReactNode} [props.endAdornment] trailing adornment
 * @param {'small'|'medium'} [props.size='medium'] MUI density (both stay ≥ 44px tall)
 */
export default function FormTextField({
  id,
  name,
  label,
  value = '',
  onChange,
  onBlur,
  error,
  helperText,
  required = false,
  multiline = false,
  minRows = 3,
  maxRows,
  maxLength,
  type = 'text',
  startAdornment,
  endAdornment,
  size = 'medium',
  fullWidth = true,
  inputRef,
  inputProps,
  InputProps,
  sx,
  ...rest
}) {
  const hasError = Boolean(error)
  const message = typeof error === 'string' && error ? error : helperText
  const length = String(value ?? '').length

  const helper =
    message || maxLength ? (
      <Box component="span" sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}>
        <Box component="span">{message}</Box>
        {maxLength ? (
          <Box
            component="span"
            sx={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
            aria-hidden="true"
          >
            {length}/{maxLength}
          </Box>
        ) : null}
      </Box>
    ) : null

  return (
    <TextField
      id={id}
      name={name}
      label={label}
      value={value ?? ''}
      onChange={(event) => onChange?.(event.target.value)}
      onBlur={onBlur}
      error={hasError}
      helperText={helper}
      required={required}
      multiline={multiline}
      minRows={multiline ? minRows : undefined}
      maxRows={multiline ? maxRows : undefined}
      type={type}
      size={size}
      fullWidth={fullWidth}
      inputRef={inputRef}
      inputProps={{ maxLength, ...inputProps }}
      InputProps={{ startAdornment, endAdornment, ...InputProps }}
      sx={sx}
      {...rest}
    />
  )
}
