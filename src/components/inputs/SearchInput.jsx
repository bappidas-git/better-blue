import { useEffect, useRef, useState } from 'react'

import { Icon } from '@iconify/react'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import TextField from '@mui/material/TextField'

import { useDebounce } from '@/hooks/useDebounce'

// Toolbar search for every list page (00 §12). Typing stays instant while
// `onChange` only fires once the field has been quiet for `debounceMs`, so
// URL params and queries are not rewritten on every keystroke. Clearing is
// immediate — waiting 300ms to empty a field feels broken.

/**
 * @param {object} props
 * @param {string} [props.value=''] current (debounced) search term
 * @param {(value: string) => void} props.onChange called with the debounced term
 * @param {string} [props.placeholder='Search'] placeholder text
 * @param {string} [props.label] accessible label — defaults to the placeholder
 * @param {number} [props.debounceMs=300] quiet period before `onChange` fires
 * @param {'small'|'medium'} [props.size='small'] MUI density
 * @param {boolean} [props.fullWidth=true] stretch to the container width
 * @param {boolean} [props.autoFocus=false] focus on mount
 * @param {boolean} [props.disabled=false] disable the field
 */
export default function SearchInput({
  value = '',
  onChange,
  placeholder = 'Search',
  label,
  debounceMs = 300,
  size = 'small',
  fullWidth = true,
  autoFocus = false,
  disabled = false,
  sx,
  ...rest
}) {
  const [draft, setDraft] = useState(value)
  // Last value this component handed out (or received) — the reference point
  // that keeps external updates and debounced emissions from ping-ponging.
  const settled = useRef(value)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const debounced = useDebounce(draft, debounceMs)

  useEffect(() => {
    if (value === settled.current) return
    settled.current = value
    setDraft(value)
  }, [value])

  useEffect(() => {
    if (debounced === settled.current) return
    settled.current = debounced
    onChangeRef.current?.(debounced)
  }, [debounced])

  const clear = () => {
    setDraft('')
    settled.current = ''
    onChange?.('')
  }

  return (
    <TextField
      type="search"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      placeholder={placeholder}
      size={size}
      fullWidth={fullWidth}
      autoFocus={autoFocus}
      disabled={disabled}
      inputProps={{ 'aria-label': label ?? placeholder }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <Icon icon="tabler:search" width={20} aria-hidden="true" />
          </InputAdornment>
        ),
        endAdornment: draft ? (
          <InputAdornment position="end">
            <IconButton
              aria-label="Clear search"
              onClick={clear}
              edge="end"
              size="small"
              sx={{ width: 40, height: 40 }}
            >
              <Icon icon="tabler:x" width={18} />
            </IconButton>
          </InputAdornment>
        ) : null,
        // The browser's own clear affordance would duplicate ours.
        sx: { '& input[type="search"]::-webkit-search-cancel-button': { display: 'none' } },
      }}
      sx={sx}
      {...rest}
    />
  )
}
