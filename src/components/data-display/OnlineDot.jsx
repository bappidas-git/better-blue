import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { visuallyHidden } from '@mui/utils'

// "Online now" — a creator who is around to answer (Storefront V2,
// prompts-v2/03).
//
// MOCK-PRESENCE: `creatorProfiles.isOnline` is a seeded flag, not a live
// session. There is no presence channel in the prototype, so this renders a
// state rather than tracking one; the Laravel build would drive the same field
// from a heartbeat or a websocket and nothing here would change.
//
// `UserAvatar` already has a presence dot for the corner of an avatar. This is
// the standalone label version — the row of text beside a name — so the two do
// not overlap.

/**
 * The pulse. Scale and opacity only, so it never triggers layout, and it is
 * declared here rather than in `global.css` because it is the only thing that
 * uses it (`docs/theme-v2.md` names one shared keyframe; this is a local one).
 *
 * Under `prefers-reduced-motion` the global rule in `global.css` already
 * collapses every animation to 0.01ms, which would leave the ring frozen at
 * its starting scale — a faint halo, not a broken one. The media query below
 * removes it outright instead, so the reduced-motion rendering is a clean solid
 * dot.
 */
const PULSE_SX = {
  '@keyframes bb-online-pulse': {
    '0%': { transform: 'scale(1)', opacity: 0.55 },
    '70%': { transform: 'scale(2.4)', opacity: 0 },
    '100%': { transform: 'scale(2.4)', opacity: 0 },
  },
  animation: 'bb-online-pulse 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite',
  '@media (prefers-reduced-motion: reduce)': { animation: 'none', display: 'none' },
}

/**
 * @param {object} props
 * @param {boolean} [props.online=true] render nothing when `false`, so a caller
 *   can drop `{creator.isOnline && …}` and just pass the flag
 * @param {boolean} [props.showLabel=true] show "Online now" beside the dot; when
 *   `false` the label is still announced, just not drawn
 * @param {string} [props.label='Online now'] the wording
 * @param {number} [props.size=8] dot diameter in px
 */
export default function OnlineDot({
  online = true,
  showLabel = true,
  label = 'Online now',
  size = 8,
  sx,
  ...rest
}) {
  if (!online) return null

  const dot = (
    <Box
      component="span"
      aria-hidden="true"
      sx={{
        position: 'relative',
        display: 'inline-flex',
        flexShrink: 0,
        width: size,
        height: size,
      }}
    >
      <Box
        component="span"
        sx={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          bgcolor: 'success.main',
          ...PULSE_SX,
        }}
      />
      <Box
        component="span"
        sx={{
          position: 'relative',
          width: size,
          height: size,
          borderRadius: '50%',
          bgcolor: 'success.main',
          boxShadow: (theme) => `0 0 8px ${alpha(theme.palette.success.main, 0.55)}`,
        }}
      />
    </Box>
  )

  return (
    <Stack
      direction="row"
      spacing={0.75}
      alignItems="center"
      sx={{ minWidth: 0, ...sx }}
      {...rest}
    >
      {dot}
      {showLabel ? (
        // `success.dark` is the readable shade on a dark surface (theme-v2 §3).
        <Typography variant="caption" sx={{ color: 'success.dark', fontWeight: 600 }} noWrap>
          {label}
        </Typography>
      ) : (
        <Box component="span" sx={visuallyHidden}>
          {label}
        </Box>
      )}
    </Stack>
  )
}
