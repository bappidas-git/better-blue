import { useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

// The failure half of every data surface — 00 §12: "error = ErrorState with
// retry". People get a plain sentence and a button; the raw ApiError stays one
// click away for whoever is debugging.

/** Turns an ApiError-shaped object (or anything else) into readable detail text. */
function toDetailText(error) {
  if (!error) return ''
  if (typeof error === 'string') return error

  const lines = []
  if (error.status) lines.push(`Status: ${error.status}`)
  if (error.code) lines.push(`Code: ${error.code}`)
  if (error.message) lines.push(`Message: ${error.message}`)
  if (error.details) {
    try {
      lines.push(`Details: ${JSON.stringify(error.details, null, 2)}`)
    } catch {
      // Circular or otherwise unserializable payload — the fields above are enough.
    }
  }
  return lines.join('\n') || String(error.message ?? error)
}

/**
 * @param {object} props
 * @param {React.ReactNode} [props.title='Something went wrong'] friendly headline
 * @param {React.ReactNode} [props.message] friendly explanation — avoid jargon here
 * @param {Error|object|string} [props.error] the raw failure, shown in the collapsible detail
 * @param {() => void} [props.onRetry] retry handler — the button only renders when given
 * @param {string} [props.retryLabel='Try again'] retry button text
 * @param {boolean} [props.dense=false] tighter padding for cards and side panels
 * @param {object} [props.sx] MUI system styles
 */
export default function ErrorState({
  title = 'Something went wrong',
  message = 'We could not load this right now. Check your connection and try again.',
  error,
  onRetry,
  retryLabel = 'Try again',
  dense = false,
  sx,
  ...rest
}) {
  const [showDetail, setShowDetail] = useState(false)
  const detail = toDetailText(error)

  return (
    <Stack
      role="alert"
      alignItems="center"
      textAlign="center"
      spacing={2}
      sx={{
        px: 3,
        py: dense ? 4 : { xs: 6, md: 8 },
        mx: 'auto',
        maxWidth: 520,
        ...sx,
      }}
      {...rest}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: dense ? 56 : 72,
          height: dense ? 56 : 72,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          bgcolor: (theme) => alpha(theme.palette.error.main, 0.12),
          color: 'error.main',
        }}
      >
        <Icon icon="tabler:alert-triangle" width={dense ? 26 : 32} />
      </Box>

      <Box>
        <Typography variant="h6" component="p" gutterBottom>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      </Box>

      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap justifyContent="center">
        {onRetry ? (
          <Button
            variant="contained"
            onClick={onRetry}
            startIcon={<Icon icon="tabler:refresh" width={18} />}
          >
            {retryLabel}
          </Button>
        ) : null}
        {detail ? (
          <Button
            variant="text"
            color="inherit"
            onClick={() => setShowDetail((open) => !open)}
            aria-expanded={showDetail}
            endIcon={
              <Icon icon={showDetail ? 'tabler:chevron-up' : 'tabler:chevron-down'} width={18} />
            }
          >
            {showDetail ? 'Hide details' : 'Technical details'}
          </Button>
        ) : null}
      </Stack>

      {detail ? (
        <Collapse in={showDetail} sx={{ width: '100%' }}>
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 2,
              textAlign: 'left',
              borderRadius: 1.5,
              bgcolor: 'background.default',
              border: 1,
              borderColor: 'divider',
              color: 'text.secondary',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '0.75rem',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowX: 'auto',
            }}
          >
            {detail}
          </Box>
        </Collapse>
      ) : null}
    </Stack>
  )
}
