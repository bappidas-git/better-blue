import { Component } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { isRouteErrorResponse, useRouteError } from 'react-router-dom'

import { env } from '@/config/env'
import { useLinkProps } from '@/hooks/useLinkProps'
import { paths } from '@/routes/paths'

// Two nets under the same trapeze:
//
// - `ErrorBoundary` (class) wraps <RouterProvider> in App.jsx and catches render
//   errors that escape everything else, including a router that fails to boot.
// - `RouteErrorElement` is the router's `errorElement`, so a failure inside one
//   route (render or, later, a loader/action) is handled without tearing the
//   rest of the app down.
//
// Both render the same screen. People get a plain sentence and two ways out;
// the stack is developer-only (00 §14 — never leak internals in production).

/** Pulls readable text out of a thrown Error, a router ErrorResponse, or a string. */
function toDetailText(error) {
  if (!error) return ''
  if (typeof error === 'string') return error
  if (isRouteErrorResponse(error)) {
    return [`Status: ${error.status}`, error.statusText, String(error.data ?? '')]
      .filter(Boolean)
      .join('\n')
  }
  return error.stack || error.message || String(error)
}

function ErrorScreen({ error }) {
  const homeLinkProps = useLinkProps(paths.HOME)
  const detail = env.isDev ? toDetailText(error) : ''

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 8, md: 12 }, px: { xs: 2, md: 4 } }}>
      <Stack spacing={3} alignItems="center" textAlign="center">
        <Box
          aria-hidden="true"
          sx={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            bgcolor: (theme) => alpha(theme.palette.error.main, 0.12),
            color: 'error.main',
          }}
        >
          <Icon icon="tabler:alert-triangle" width={32} />
        </Box>

        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Something went wrong
          </Typography>
          <Typography variant="body1" color="text.secondary">
            This page ran into an unexpected problem. Reloading usually clears it — if it keeps
            happening, head back home and try again from there.
          </Typography>
        </Box>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          <Button
            variant="gradient"
            size="large"
            onClick={() => window.location.reload()}
            startIcon={<Icon icon="tabler:refresh" width={18} />}
          >
            Reload the page
          </Button>
          <Button variant="outlined" size="large" {...homeLinkProps}>
            Go to home
          </Button>
        </Stack>

        {detail ? (
          <Box
            component="pre"
            sx={{
              width: '100%',
              m: 0,
              p: 2,
              textAlign: 'left',
              borderRadius: 1.5,
              bgcolor: 'background.paper',
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
        ) : null}
      </Stack>
    </Container>
  )
}

/** Router-level failures — wired as `errorElement` on every top-level branch. */
export function RouteErrorElement() {
  const error = useRouteError()
  return <ErrorScreen error={error} />
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, errorInfo) {
    // The console is the reporting sink for now; a real error tracker plugs in
    // here when the Laravel backend lands.
    console.error('[ErrorBoundary] Uncaught render error', error, errorInfo)
  }

  render() {
    if (this.state.error) return <ErrorScreen error={this.state.error} />
    return this.props.children
  }
}
