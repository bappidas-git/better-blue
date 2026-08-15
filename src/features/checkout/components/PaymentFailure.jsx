import { useEffect, useRef } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'

import { FAILURE_ACTION, failureCopyFor } from '@/features/checkout/failureCopy'
import { paths } from '@/routes/paths'

// A payment that did not go through, explained.
//
// The copy is not written here — `failureCopy.js` maps the provider's code onto
// a sentence, so this component is only the shape it is read in (Prompt 19 §7).
// Every variant answers "were you charged?" in its first two lines, because
// that is the question, and the honest answer for a decline is no.
//
// `role="alert"` (§12) so the failure is announced rather than silently
// swapped in under someone who was mid-form.

/**
 * @param {object} props
 * @param {object} props.error the `ApiError` thrown by `initiateOrderPayment`
 * @param {string} [props.orderId] `ord_…` — the "view order" way out
 * @param {() => void} props.onRetry back to the form, card cleared
 */
export default function PaymentFailure({ error, orderId, onRetry }) {
  const heading = useRef(null)
  const copy = failureCopyFor(error)
  const canRetry = copy.action === FAILURE_ACTION.RETRY

  useEffect(() => {
    heading.current?.focus?.({ preventScroll: true })
  }, [])

  return (
    <Card
      role="alert"
      sx={{ borderColor: 'error.main', borderWidth: 1, borderStyle: 'solid' }}
    >
      <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <Box
              aria-hidden="true"
              sx={{
                flexShrink: 0,
                width: 48,
                height: 48,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: (theme) => alpha(theme.palette.error.main, 0.12),
                color: 'error.dark',
              }}
            >
              <Icon icon="solar:card-transfer-linear" width={26} />
            </Box>

            <Box sx={{ minWidth: 0 }}>
              <Typography
                ref={heading}
                tabIndex={-1}
                variant="h6"
                component="h2"
                sx={{ outline: 'none' }}
              >
                {copy.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                {copy.message}
              </Typography>
              {copy.hint ? (
                <Typography variant="body2" sx={{ mt: 1, fontWeight: 600 }}>
                  {copy.hint}
                </Typography>
              ) : null}
            </Box>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            {canRetry ? (
              <>
                <Button
                  onClick={onRetry}
                  variant="gradient"
                  size="large"
                  startIcon={<Icon icon="solar:refresh-linear" width={18} aria-hidden="true" />}
                >
                  Try again
                </Button>
                {/* The same destination as "try again": the form comes back
                    empty, so trying the same card and trying a different one
                    are the same two clicks. Naming both is the point — a buyer
                    whose card was declined is looking for the second one. */}
                <Button onClick={onRetry} variant="outlined" size="large">
                  Use a different card
                </Button>
              </>
            ) : orderId ? (
              <Button
                component={RouterLink}
                to={paths.buyerOrderDetail(orderId)}
                variant="gradient"
                size="large"
              >
                Check the order
              </Button>
            ) : null}

            <Button component={RouterLink} to={paths.BUYER_REQUESTS} color="inherit" size="large">
              Back to requests
            </Button>
          </Stack>

          <Typography variant="caption" color="text.secondary">
            Still stuck?{' '}
            <Link component={RouterLink} to={paths.CONTACT}>
              Contact support
            </Link>{' '}
            with the order reference and we will look into it.
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  )
}
