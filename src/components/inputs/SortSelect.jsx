import { Icon } from '@iconify/react'
import InputAdornment from '@mui/material/InputAdornment'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'

// Toolbar sort control for list pages (00 §12). Options carry whatever value
// the page's query needs (`'createdAt:desc'`, `'budget:asc'`, …) — this
// component only reports the choice back.

/**
 * @param {object} props
 * @param {string} props.value currently selected option value
 * @param {(value: string) => void} props.onChange called with the new option value
 * @param {{value: string, label: string}[]} props.options sort options in display order
 * @param {string} [props.label='Sort by'] visible label
 * @param {'small'|'medium'} [props.size='small'] MUI density
 * @param {boolean} [props.fullWidth=false] stretch to the container width
 * @param {number|object} [props.minWidth=200] minimum control width
 */
export default function SortSelect({
  value,
  onChange,
  options = [],
  label = 'Sort by',
  size = 'small',
  fullWidth = false,
  minWidth = 200,
  disabled = false,
  sx,
  ...rest
}) {
  return (
    <TextField
      select
      label={label}
      value={value ?? ''}
      onChange={(event) => onChange?.(event.target.value)}
      size={size}
      fullWidth={fullWidth}
      disabled={disabled}
      sx={{ minWidth: fullWidth ? undefined : minWidth, ...sx }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <Icon icon="tabler:arrows-sort" width={18} aria-hidden="true" />
          </InputAdornment>
        ),
      }}
      {...rest}
    >
      {options.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  )
}
