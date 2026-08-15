import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

// How finished a business profile is, and exactly what is still missing.
//
// It reads its numbers from `getBuyerProfileCompleteness` (services layer), so
// the figure here, the one on the dashboard's onboarding checklist, and the one
// a future API returns are all the same calculation. Because the page recomputes
// it from the *form values* rather than the saved record, the bar moves as
// fields are filled in, before anything is saved.

/**
 * @param {object} props
 * @param {{percent: number, completed: number, total: number, missing: Array<{key: string, label: string}>}} props.completeness
 *   `completed`/`total` may be weights rather than field counts (the creator
 *   profile weights its fields), which is why only the percentage and the
 *   missing labels are rendered as numbers a reader would check.
 * @param {React.ReactNode} [props.completeMessage] the line shown at 100% —
 *   overridden by the creator profile, whose readers are buyers rather than
 *   creators (Prompt 21)
 * @param {object} [props.sx] MUI system styles
 */
export default function ProfileCompletenessMeter({
  completeness,
  completeMessage = 'Everything is filled in. Creators can see who they would be working with.',
  sx,
}) {
  const { percent, completed, total, missing } = completeness
  const isComplete = percent === 100

  return (
    <Box sx={sx}>
      <Stack direction="row" spacing={2} alignItems="baseline" sx={{ mb: 1 }}>
        <Typography variant="subtitle2" component="h3" sx={{ flexGrow: 1 }}>
          Profile completeness
        </Typography>
        {/* The percentage is text, not just a bar width (§12). */}
        <Typography variant="subtitle2" sx={{ color: isComplete ? 'success.main' : 'primary.main' }}>
          {percent}%
        </Typography>
      </Stack>

      <LinearProgress
        variant="determinate"
        value={percent}
        color={isComplete ? 'success' : 'primary'}
        aria-label={`Profile completeness: ${percent} percent, ${completed} of ${total} details added`}
        sx={{ height: 8, borderRadius: 4 }}
      />

      {isComplete ? (
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1.5 }}>
          <Box aria-hidden="true" sx={{ display: 'flex', color: 'success.main' }}>
            <Icon icon="tabler:circle-check" width={18} />
          </Box>
          <Typography variant="body2" color="text.secondary">
            {completeMessage}
          </Typography>
        </Stack>
      ) : (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {completed} of {total} details added. Still missing:
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {missing.map((field) => (
              <Chip key={field.key} label={field.label} size="small" variant="outlined" />
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  )
}
