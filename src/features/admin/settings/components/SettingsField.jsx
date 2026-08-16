import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

// One field, with the two things every setting on this screen has to carry
// (Prompt 35 §6): **what changing it does**, and **who reads it**.
//
// A configuration screen is the one place in the product where a reader cannot
// see the consequence of their edit on the same page — the effect of
// `autoAcceptDays` shows up on somebody else's order three screens away. So the
// helper line states the live effect in a sentence, and the "Used by" chips
// name the surfaces that will change. Both are data on the section, not prose
// buried in a component.
//
// The field itself is `children`, so this wrapper stays agnostic: a text input,
// a percent input, a switch row, or a whole table all take the same treatment.

/**
 * @param {object} props
 * @param {React.ReactNode} props.children the control — a `Form*` field, a switch, a table
 * @param {React.ReactNode} [props.helper] what changing this value actually does,
 *   in one sentence. Rendered under the control, always visible — this is not a
 *   validation message and it does not disappear when one appears.
 * @param {string[]} [props.usedBy] the surfaces that read this value
 * @param {React.ReactNode} [props.children] the control itself
 * @param {object} [props.sx] MUI system styles
 */
export default function SettingsField({ children, helper, usedBy = [], sx }) {
  return (
    <Box sx={{ minWidth: 0, ...sx }}>
      {children}

      {helper ? (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.75, maxWidth: '68ch' }}>
          {helper}
        </Typography>
      ) : null}

      {usedBy.length > 0 ? (
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1, alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary" component="span">
            Used by
          </Typography>
          {usedBy.map((surface) => (
            <Chip
              key={surface}
              label={surface}
              size="small"
              variant="outlined"
              sx={{ height: 22, fontSize: 12 }}
            />
          ))}
        </Stack>
      ) : null}
    </Box>
  )
}
