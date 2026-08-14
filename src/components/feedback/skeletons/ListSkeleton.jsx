import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'

// Loading placeholder for stacked rows — proposal lists, notification lists,
// and DataTable's mobile card mode all use it.

/**
 * @param {object} props
 * @param {number} [props.rows=3] number of placeholder rows
 * @param {boolean} [props.avatar=true] include the leading avatar circle
 * @param {boolean} [props.trailing=true] include the trailing value/chip block
 * @param {boolean} [props.divided=true] draw hairlines between rows
 * @param {string} [props.label='Loading list'] accessible label announced while busy
 * @param {object} [props.sx] MUI system styles
 */
export default function ListSkeleton({
  rows = 3,
  avatar = true,
  trailing = true,
  divided = true,
  label = 'Loading list',
  sx,
  ...rest
}) {
  return (
    <Box role="status" aria-busy="true" aria-label={label} sx={sx} {...rest}>
      {Array.from({ length: rows }, (_, index) => (
        <Stack
          key={index}
          direction="row"
          spacing={2}
          alignItems="center"
          sx={{
            py: 2,
            borderBottom: divided && index < rows - 1 ? 1 : 0,
            borderColor: 'divider',
          }}
        >
          {avatar ? <Skeleton variant="circular" width={44} height={44} /> : null}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Skeleton variant="text" width="45%" sx={{ fontSize: '1rem' }} />
            <Skeleton variant="text" width="70%" sx={{ fontSize: '0.875rem' }} />
          </Box>
          {trailing ? (
            <Skeleton variant="rounded" width={84} height={28} sx={{ borderRadius: 999 }} />
          ) : null}
        </Stack>
      ))}
    </Box>
  )
}
