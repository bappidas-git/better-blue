import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'

// Loading placeholder shaped like a request/portfolio card: cover image,
// title, body lines, and a chip row. Sizes mirror the real card so the layout
// does not jump when data lands (00 §12).

/**
 * @param {object} props
 * @param {boolean} [props.media=true] include the cover image block
 * @param {number} [props.lines=2] body text lines
 * @param {boolean} [props.chips=true] include the meta chip row
 * @param {boolean} [props.actions=false] include a footer button row
 * @param {string} [props.label='Loading card'] accessible label announced while busy
 * @param {object} [props.sx] MUI system styles
 */
export default function CardSkeleton({
  media = true,
  lines = 2,
  chips = true,
  actions = false,
  label = 'Loading card',
  sx,
  ...rest
}) {
  return (
    <Card role="status" aria-busy="true" aria-label={label} sx={sx} {...rest}>
      {media ? <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 0 }} /> : null}
      <CardContent>
        <Skeleton variant="text" width="70%" sx={{ fontSize: '1.125rem' }} />
        <Box sx={{ mt: 1 }}>
          {Array.from({ length: lines }, (_, index) => (
            <Skeleton
              key={index}
              variant="text"
              width={index === lines - 1 ? '55%' : '100%'}
              sx={{ fontSize: '0.875rem' }}
            />
          ))}
        </Box>
        {chips ? (
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Skeleton variant="rounded" width={72} height={24} sx={{ borderRadius: 999 }} />
            <Skeleton variant="rounded" width={92} height={24} sx={{ borderRadius: 999 }} />
          </Stack>
        ) : null}
        {actions ? (
          <Stack direction="row" spacing={1.5} sx={{ mt: 2.5 }}>
            <Skeleton variant="rounded" width={128} height={44} />
            <Skeleton variant="rounded" width={96} height={44} />
          </Stack>
        ) : null}
      </CardContent>
    </Card>
  )
}
