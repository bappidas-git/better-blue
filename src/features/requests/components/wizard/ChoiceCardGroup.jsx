import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { visuallyHidden } from '@mui/utils'

// Picture-and-a-sentence alternative to a `<select>`, for the two choices that
// deserve explaining rather than listing: what kind of content this is, and
// what the buyer may do with it afterwards.
//
// Like `features/auth/components/RoleChoiceCards`, every card is a **real radio
// input** wrapped in a `<label>`. Arrow keys move between options, Space picks
// one, and the group announces as "radio, 2 of 3" — none of which a
// `role="radio"` div with a keydown handler gets right for free (§12).

/**
 * @param {object} props
 * @param {string} props.name radio group name — unique on the page
 * @param {React.ReactNode} props.label visible group label
 * @param {string} [props.value] the selected option's value
 * @param {(value: string) => void} props.onChange called with the chosen value
 * @param {() => void} [props.onBlur] blur handler — `useForm` validates here
 * @param {{value: string, label: string, description?: string, icon?: string}[]} props.options
 * @param {string|boolean} [props.error] error message shown under the group
 * @param {React.ReactNode} [props.helperText] guidance shown when there is no error
 * @param {boolean} [props.required=false] marks the group required
 * @param {number} [props.columns=1] cards per row from `sm` up
 * @param {boolean} [props.disabled=false] freeze the whole group
 * @param {(node: *) => void} [props.inputRef] ref to the first input, so
 *   `useForm` can focus the group when it is the first field in error
 */
export default function ChoiceCardGroup({
  name,
  label,
  value,
  onChange,
  onBlur,
  options = [],
  error,
  helperText,
  required = false,
  columns = 1,
  disabled = false,
  inputRef,
  sx,
}) {
  const hasError = Boolean(error)
  const message = typeof error === 'string' && error ? error : helperText
  const labelId = `${name}-choice-label`
  const messageId = message ? `${name}-choice-help` : undefined

  return (
    <Box component="fieldset" sx={{ border: 0, m: 0, p: 0, minWidth: 0, ...sx }}>
      <FormLabel component="legend" required={required} error={hasError} id={labelId} sx={{ mb: 1.5 }}>
        {label}
      </FormLabel>

      <Box
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={messageId}
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr', sm: `repeat(${columns}, minmax(0, 1fr))` },
        }}
      >
        {options.map((option, index) => {
          const selected = value === option.value

          return (
            <Stack
              key={option.value}
              component="label"
              direction="row"
              spacing={2}
              alignItems="flex-start"
              sx={{
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1,
                p: 2,
                borderRadius: 2,
                border: 1,
                borderColor: selected ? 'primary.main' : hasError ? 'error.main' : 'divider',
                bgcolor: selected ? 'primary.surface' : 'background.paper',
                // Drawn outside the border, so choosing a card does not shift
                // the layout by a pixel.
                boxShadow: (theme) =>
                  selected ? `0 0 0 2px ${theme.palette.primary.main}` : 'none',
                transition: (theme) =>
                  theme.transitions.create(['border-color', 'background-color', 'box-shadow']),
                '&:hover': { borderColor: selected || disabled ? undefined : 'text.disabled' },
                // The input is invisible, so its focus ring has to land here.
                '&:focus-within': {
                  outline: (theme) => `2px solid ${theme.palette.primary.main}`,
                  outlineOffset: 2,
                },
              }}
            >
              <Box
                component="input"
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange?.(option.value)}
                onBlur={onBlur}
                ref={index === 0 ? inputRef : undefined}
                sx={visuallyHidden}
              />

              {option.icon ? (
                <Box
                  aria-hidden="true"
                  sx={{
                    flexShrink: 0,
                    width: 44,
                    height: 44,
                    borderRadius: 2,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: selected ? 'primary.main' : 'primary.surface',
                    color: selected ? 'primary.contrastText' : 'primary.main',
                  }}
                >
                  <Icon icon={option.icon} width={24} />
                </Box>
              ) : null}

              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle1" component="span" sx={{ display: 'block' }}>
                  {option.label}
                </Typography>
                {option.description ? (
                  <Typography variant="body2" color="text.secondary">
                    {option.description}
                  </Typography>
                ) : null}
              </Box>
            </Stack>
          )
        })}
      </Box>

      {message ? (
        <FormHelperText id={messageId} error={hasError} sx={{ mx: 0, mt: 1 }}>
          {message}
        </FormHelperText>
      ) : null}
    </Box>
  )
}
