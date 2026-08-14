import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'

// Loading placeholder matching `StatCard` — same padding, same icon tile, same
// value height, so a dashboard grid holds its shape while numbers load.

/**
 * @param {object} props
 * @param {boolean} [props.icon=true] include the icon tile
 * @param {boolean} [props.delta=true] include the delta line under the value
 * @param {string} [props.label='Loading statistic'] accessible label announced while busy
 * @param {object} [props.sx] MUI system styles
 */
export default function StatSkeleton({
  icon = true,
  delta = true,
  label = 'Loading statistic',
  sx,
  ...rest
}) {
  return (
    <Card role="status" aria-busy="true" aria-label={label} sx={sx} {...rest}>
      <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Skeleton variant="text" width="55%" sx={{ fontSize: '0.75rem' }} />
            <Skeleton variant="text" width="70%" sx={{ fontSize: '2rem', mt: 0.5 }} />
            {delta ? (
              <Skeleton variant="text" width="45%" sx={{ fontSize: '0.75rem', mt: 0.5 }} />
            ) : null}
          </Box>
          {icon ? <Skeleton variant="rounded" width={44} height={44} /> : null}
        </Stack>
      </CardContent>
    </Card>
  )
}
