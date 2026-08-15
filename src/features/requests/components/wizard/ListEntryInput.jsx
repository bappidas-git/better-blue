import { useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import FormHelperText from '@mui/material/FormHelperText'
import Stack from '@mui/material/Stack'

import FormTextField from '@/components/inputs/FormTextField'

// A short list of instructions, entered one line at a time.
//
// The brief stores do's and don'ts as free text, but writing a paragraph on a
// phone is miserable and reads worse to the creator, so the wizard collects
// points: type one, press Enter (or Add), and it becomes a removable chip.
// `useRequestWizard` joins the list back into the single string the record
// keeps, and splits it again when a draft is resumed.

/** Longest one point may be — beyond this it belongs in the brand guidelines. */
const ENTRY_MAX = 160

/**
 * @param {object} props
 * @param {string} [props.id] DOM id — `useForm` supplies `field-<name>`
 * @param {string} [props.name] field name
 * @param {React.ReactNode} props.label visible label
 * @param {string[]} [props.value=[]] the points entered so far
 * @param {(entries: string[]) => void} props.onChange receives the next list
 * @param {() => void} [props.onBlur] blur handler — `useForm` validates here
 * @param {string|boolean} [props.error] error message
 * @param {React.ReactNode} [props.helperText] guidance shown when there is no error
 * @param {string} [props.placeholder] example of a good entry
 * @param {number} [props.maxEntries] cap on how many points can be added
 * @param {boolean} [props.disabled=false]
 */
export default function ListEntryInput({
  id,
  name,
  label,
  value = [],
  onChange,
  onBlur,
  error,
  helperText,
  placeholder,
  maxEntries,
  disabled = false,
  inputRef,
}) {
  const [entry, setEntry] = useState('')

  const entries = Array.isArray(value) ? value : []
  const isFull = Boolean(maxEntries) && entries.length >= maxEntries
  const hasError = Boolean(error)
  const message = typeof error === 'string' && error ? error : helperText

  const add = () => {
    const next = entry.trim()
    // Duplicates are dropped silently: re-adding a point you already made is a
    // slip, not something worth an error message about.
    if (!next || isFull || entries.includes(next)) {
      setEntry('')
      return
    }
    onChange?.([...entries, next])
    setEntry('')
  }

  const removeAt = (index) => onChange?.(entries.filter((_, position) => position !== index))

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <FormTextField
          id={id}
          name={name}
          label={label}
          value={entry}
          onChange={setEntry}
          onBlur={onBlur}
          error={hasError ? true : undefined}
          placeholder={placeholder}
          maxLength={ENTRY_MAX}
          disabled={disabled || isFull}
          inputRef={inputRef}
          onKeyDown={(event) => {
            // Enter adds a point rather than submitting the step — the wizard's
            // Next button owns that.
            if (event.key !== 'Enter') return
            event.preventDefault()
            add()
          }}
        />
        <Button
          onClick={add}
          disabled={disabled || isFull || entry.trim() === ''}
          variant="outlined"
          sx={{ mt: 1, minHeight: 44, flexShrink: 0 }}
          startIcon={<Icon icon="tabler:plus" width={18} aria-hidden="true" />}
        >
          Add
        </Button>
      </Stack>

      {entries.length > 0 ? (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
          {entries.map((item, index) => (
            <Chip
              key={item}
              label={item}
              onDelete={disabled ? undefined : () => removeAt(index)}
              deleteIcon={<Icon icon="tabler:x" width={16} />}
              // The delete button carries the only clue about *which* chip it
              // removes, so it says so out loud.
              title={item}
              sx={{ maxWidth: '100%', height: 'auto', py: 0.75, '& .MuiChip-label': { whiteSpace: 'normal' } }}
            />
          ))}
        </Stack>
      ) : null}

      {message || isFull ? (
        <FormHelperText error={hasError} sx={{ mx: 1.75 }}>
          {hasError || !isFull ? message : `That is the ${maxEntries} points this list holds.`}
        </FormHelperText>
      ) : null}
    </Box>
  )
}
