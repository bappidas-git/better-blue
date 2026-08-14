import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'

// Loading placeholder for edit forms — label + 44px input per field, matching
// the `Form*` field components' touch height (00 §13).

/**
 * @param {object} props
 * @param {number} [props.fields=4] number of field placeholders
 * @param {1|2} [props.columns=1] field columns on desktop (always 1 on mobile)
 * @param {boolean} [props.actions=true] include the submit/cancel button row
 * @param {string} [props.label='Loading form'] accessible label announced while busy
 * @param {object} [props.sx] MUI system styles
 */
export default function FormSkeleton({
  fields = 4,
  columns = 1,
  actions = true,
  label = 'Loading form',
  sx,
  ...rest
}) {
  return (
    <Box role="status" aria-busy="true" aria-label={label} sx={sx} {...rest}>
      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: '1fr', md: `repeat(${columns}, 1fr)` },
        }}
      >
        {Array.from({ length: fields }, (_, index) => (
          <Box key={index}>
            <Skeleton variant="text" width="35%" sx={{ fontSize: '0.875rem', mb: 0.5 }} />
            <Skeleton variant="rounded" height={44} />
          </Box>
        ))}
      </Box>

      {actions ? (
        <Stack direction="row" spacing={1.5} sx={{ mt: 4 }}>
          <Skeleton variant="rounded" width={140} height={44} />
          <Skeleton variant="rounded" width={96} height={44} />
        </Stack>
      ) : null}
    </Box>
  )
}
