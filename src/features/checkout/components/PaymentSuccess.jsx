import { useEffect, useRef } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { motion, useReducedMotion } from 'framer-motion'
import { Link as RouterLink } from 'react-router-dom'

import KeyValueList from '@/components/data-display/KeyValueList'
import { durations, easing } from '@/theme/motionTokens'
import { paths } from '@/routes/paths'
import { EMPTY_PLACEHOLDER, formatCurrency, formatDateTime } from '@/utils/formatters'

// The moment after a payment lands. Restrained on purpose: one mark that draws
// itself, then straight into the two things a buyer wants — proof of what was
// taken, and what happens next.
//
// Reduced motion (00 §7) is honoured by `useReducedMotion`, which reflects the
// `reducedMotion="user"` MotionConfig the app is wrapped in: the same mark is
// simply already drawn.
//
// The heading takes focus on arrival, because the page has changed underneath
// someone who was last looking at a card form (§12).

/** The circle-and-tick, drawn once. */
function SuccessMark() {
  const reduced = useReducedMotion()

  const badge = reduced
    ? {}
    : {
        initial: { scale: 0.6, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        transition: { duration: durations.base / 1000, ease: easing },
      }

  return (
    <Box
      component={motion.div}
      {...badge}
      aria-hidden="true"
      sx={{
        width: 72,
        height: 72,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: (theme) => alpha(theme.palette.success.main, 0.14),
        color: 'success.dark',
      }}
    >
      <Icon icon="solar:check-circle-bold" width={44} />
    </Box>
  )
}

/** One numbered step of "what happens next". */
function NextStep({ index, icon, title, description }) {
  return (
    <Stack direction="row" spacing={1.75} alignItems="flex-start" component="li">
      <Box
        aria-hidden="true"
        sx={{
          flexShrink: 0,
          width: 36,
          height: 36,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'primary.lighter',
          color: 'primary.dark',
        }}
      >
        <Icon icon={icon} width={20} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {index}. {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </Box>
    </Stack>
  )
}

/**
 * @param {object} props
 * @param {object} props.payment the `held` payment record
 * @param {object} props.order the order it funded
 * @param {object} [props.creator] who the work was awarded to
 */
export default function PaymentSuccess({ payment, order, creator }) {
  const heading = useRef(null)

  useEffect(() => {
    heading.current?.focus?.({ preventScroll: true })
  }, [])

  const currency = payment?.currency ?? order?.currency
  const creatorName = creator?.name ?? 'the creator'

  return (
    <Stack spacing={{ xs: 2, md: 3 }}>
      <Card>
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Stack spacing={2.5} alignItems="center" sx={{ textAlign: 'center' }}>
            <SuccessMark />

            <Box>
              <Typography
                ref={heading}
                tabIndex={-1}
                variant="h5"
                component="h2"
                sx={{ fontWeight: 800, outline: 'none' }}
              >
                Payment held in escrow
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                {formatCurrency(payment?.amount, currency)} is secured with BetterBlue. It reaches{' '}
                {creatorName} only once you have approved the delivery.
              </Typography>
            </Box>
          </Stack>

          <Divider sx={{ my: { xs: 3, md: 3.5 } }} />

          <KeyValueList
            dense
            labelWidth={180}
            items={[
              {
                label: 'Amount held',
                value: (
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {formatCurrency(payment?.amount, currency)}
                  </Typography>
                ),
              },
              {
                label: 'Paid with',
                value: payment?.method?.last4
                  ? `Card ending ${payment.method.last4}`
                  : EMPTY_PLACEHOLDER,
              },
              { label: 'Payment reference', value: payment?.id ?? EMPTY_PLACEHOLDER },
              { label: 'Order reference', value: order?.id ?? EMPTY_PLACEHOLDER },
              {
                label: 'Paid on',
                value: formatDateTime(payment?.heldAt ?? payment?.createdAt),
              },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography variant="subtitle2" component="h3" sx={{ mb: 2 }}>
            What happens next
          </Typography>

          <Stack component="ol" spacing={2} sx={{ listStyle: 'none', m: 0, p: 0 }}>
            <NextStep
              index={1}
              icon="solar:bell-linear"
              title={`${creatorName} has been notified`}
              description="They can see the order is funded and can start immediately."
            />
            <NextStep
              index={2}
              icon="solar:camera-linear"
              title="The content gets produced"
              description="The delivery clock started with your payment. You will be told the moment work is submitted."
            />
            <NextStep
              index={3}
              icon="solar:check-square-linear"
              title="You review, then the money moves"
              description="Approve the delivery and the escrow is released. Ask for a revision instead, and nothing moves."
            />
          </Stack>
        </CardContent>
      </Card>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <Button
          component={RouterLink}
          to={paths.buyerOrderDetail(order?.id)}
          variant="gradient"
          size="large"
          startIcon={<Icon icon="solar:box-linear" width={18} aria-hidden="true" />}
        >
          View order
        </Button>
        <Button component={RouterLink} to={paths.BUYER_REQUESTS} variant="outlined" size="large">
          Back to requests
        </Button>
      </Stack>
    </Stack>
  )
}
