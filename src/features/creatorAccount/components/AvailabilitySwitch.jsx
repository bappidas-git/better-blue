import Box from '@mui/material/Box'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

// The compact twin of `AvailabilityCard`: the same flag, in the page header
// beside the top bar, so a creator can close their storefront from any of their
// screens without hunting for the card.
//
// Both render from `useCreatorAvailability`, which owns the state and the round
// trip — this component draws a switch and nothing else.

/**
 * @param {object} props
 * @param {boolean} props.isAvailable current state
 * @param {(next: boolean) => void} props.onChange
 * @param {boolean} [props.disabled=false] while a save is in flight
 * @param {object} [props.sx] MUI system styles
 */
export default function AvailabilitySwitch({ isAvailable, onChange, disabled = false, sx }) {
  return (
    <Tooltip
      title={
        isAvailable
          ? 'Listed in the creator directory'
          : 'Hidden from the creator directory'
      }
    >
      <Box sx={sx}>
        <FormControlLabel
          sx={{ mr: 0 }}
          control={
            <Switch
              checked={isAvailable}
              onChange={(event) => onChange?.(event.target.checked)}
              disabled={disabled}
              color="success"
              size="small"
              // The visible label is one word to fit a header; the full
              // sentence — state included — goes to assistive technology, and
              // wins over the label text (§12).
              inputProps={{
                'aria-label': isAvailable
                  ? 'Accepting new requests. Switch off to hide your storefront from the directory.'
                  : 'Not accepting new requests. Switch on to list your storefront in the directory.',
              }}
            />
          }
          label={
            <Typography
              component="span"
              variant="body2"
              sx={{ fontWeight: 600, color: isAvailable ? 'success.dark' : 'text.secondary' }}
            >
              {isAvailable ? 'Available' : 'Unavailable'}
            </Typography>
          }
        />
      </Box>
    </Tooltip>
  )
}
