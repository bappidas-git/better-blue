import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'

// Loading placeholder for creator/buyer profile headers: large avatar, name,
// meta line, skill chips, and a short bio block.

/**
 * @param {object} props
 * @param {number} [props.bioLines=3] paragraph lines under the chips
 * @param {boolean} [props.chips=true] include the skill/category chip row
 * @param {string} [props.label='Loading profile'] accessible label announced while busy
 * @param {object} [props.sx] MUI system styles
 */
export default function ProfileSkeleton({
  bioLines = 3,
  chips = true,
  label = 'Loading profile',
  sx,
  ...rest
}) {
  return (
    <Box role="status" aria-busy="true" aria-label={label} sx={sx} {...rest}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={{ xs: 2, sm: 3 }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
      >
        <Skeleton variant="circular" width={96} height={96} sx={{ flexShrink: 0 }} />
        <Box sx={{ flexGrow: 1, width: '100%', minWidth: 0 }}>
          <Skeleton variant="text" width="45%" sx={{ fontSize: '1.625rem' }} />
          <Skeleton variant="text" width="60%" sx={{ fontSize: '0.875rem' }} />
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
            <Skeleton variant="rounded" width={104} height={28} sx={{ borderRadius: 999 }} />
            <Skeleton variant="rounded" width={80} height={28} sx={{ borderRadius: 999 }} />
          </Stack>
        </Box>
      </Stack>

      {chips ? (
        <Stack direction="row" spacing={1} sx={{ mt: 3 }} flexWrap="wrap" useFlexGap>
          {[96, 120, 84, 108].map((width, index) => (
            <Skeleton
              key={index}
              variant="rounded"
              width={width}
              height={32}
              sx={{ borderRadius: 999 }}
            />
          ))}
        </Stack>
      ) : null}

      <Box sx={{ mt: 3 }}>
        {Array.from({ length: bioLines }, (_, index) => (
          <Skeleton
            key={index}
            variant="text"
            width={index === bioLines - 1 ? '60%' : '100%'}
            sx={{ fontSize: '1rem' }}
          />
        ))}
      </Box>
    </Box>
  )
}
