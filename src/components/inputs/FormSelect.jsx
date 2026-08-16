import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'

// Select with the unified field contract. Options are plain
// `{ value, label }` objects — the same shape `SortSelect` and
// `FilterChipGroup` take, so option lists move between them freely.

/**
 * @param {object} props
 * @param {string} [props.id] DOM id — `useForm` supplies `field-<name>`
 * @param {string} [props.name] field name
 * @param {React.ReactNode} props.label visible label
 * @param {string|string[]} [props.value] selected value (array when `multiple`)
 * @param {(value: string|string[]) => void} props.onChange receives the new value
 * @param {() => void} [props.onBlur] blur handler — `useForm` validates here
 * @param {{value: string, label: string, disabled?: boolean}[]} props.options selectable options
 * @param {string|boolean} [props.error] error message (or `true` for a bare error state)
 * @param {React.ReactNode} [props.helperText] guidance shown when there is no error
 * @param {boolean} [props.required=false] marks the field required
 * @param {boolean} [props.multiple=false] multi-select, rendering chips for the selection
 * @param {string} [props.placeholder] label for the empty option (single-select only)
 * @param {'small'|'medium'} [props.size='medium'] MUI density
 */
export default function FormSelect({
  id,
  name,
  label,
  value,
  onChange,
  onBlur,
  options = [],
  error,
  helperText,
  required = false,
  multiple = false,
  placeholder,
  size = 'medium',
  fullWidth = true,
  disabled = false,
  inputRef,
  sx,
  ...rest
}) {
  const hasError = Boolean(error)
  const message = typeof error === 'string' && error ? error : helperText
  const selected = multiple ? (Array.isArray(value) ? value : []) : (value ?? '')
  const labelFor = (optionValue) =>
    options.find((option) => option.value === optionValue)?.label ?? optionValue

  return (
    <TextField
      select
      id={id}
      name={name}
      label={label}
      value={selected}
      onChange={(event) => onChange?.(event.target.value)}
      onBlur={onBlur}
      error={hasError}
      helperText={message}
      required={required}
      size={size}
      fullWidth={fullWidth}
      disabled={disabled}
      inputRef={inputRef}
      sx={sx}
      // A placeholder is rendered *inside* the field while the value is still
      // empty, and MUI only floats the label when it thinks the field is empty —
      // so without this the two draw on top of each other ("Actor" over
      // "Anyone"). Pinned only when there is a placeholder to collide with, so
      // every other select keeps its resting label. Found by Prompt 36's audit
      // filters; it fixes the same overlap on every placeholder select already
      // shipped (moderation decisions, raise-dispute, portfolio item, contact).
      InputLabelProps={placeholder ? { shrink: true } : undefined}
      SelectProps={{
        multiple,
        displayEmpty: Boolean(placeholder) && !multiple,
        renderValue: multiple
          ? (values) =>
              values.length ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {values.map((item) => (
                    <Chip key={item} label={labelFor(item)} size="small" color="primary" />
                  ))}
                </Box>
              ) : (
                <Box component="span" sx={{ color: 'text.disabled' }}>
                  {placeholder ?? 'Select options'}
                </Box>
              )
          : undefined,
      }}
      {...rest}
    >
      {!multiple && placeholder ? (
        <MenuItem value="">
          <Box component="span" sx={{ color: 'text.secondary' }}>
            {placeholder}
          </Box>
        </MenuItem>
      ) : null}
      {options.map((option) => (
        <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  )
}
