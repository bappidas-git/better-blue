import { Icon } from '@iconify/react'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

import KeyValueList from '@/components/data-display/KeyValueList'
import StatusChip from '@/components/data-display/StatusChip'
import { PAYMENT_STATUS } from '@/constants/statuses'
import { paths } from '@/routes/paths'
import { EMPTY_PLACEHOLDER, formatCurrency, formatDateTime } from '@/utils/formatters'

// Where the money on this order is, and what it did to get there.
//
// A buyer's view deliberately stops at "what I paid and where it is". The
// commission split and the creator's net are the creator's business and the
// admin's; showing a buyer the fee taken out of someone else's fee is noise at
// best (`docs/payments.md`).

/** One sentence explaining the payment's state in plain words. */
const ESCROW_COPY = {
  [PAYMENT_STATUS.HELD]: 'BetterBlue is holding this money. It reaches the creator only when you accept the delivery.',
  [PAYMENT_STATUS.RELEASED]: 'Released to the creator when you accepted the delivery.',
  [PAYMENT_STATUS.REFUNDED]: 'Returned in full to the card it came from.',
  [PAYMENT_STATUS.PARTIALLY_REFUNDED]: 'Part of this was returned to you and the rest was released to the creator.',
  [PAYMENT_STATUS.FAILED]: 'This attempt was declined, so nothing was charged.',
  [PAYMENT_STATUS.PROCESSING]: 'This attempt did not finish. Nothing has been taken — you can pay again from checkout.',
  [PAYMENT_STATUS.INITIATED]: 'This attempt did not finish. Nothing has been taken — you can pay again from checkout.',
}

/**
 * @param {object} props
 * @param {object} props.order the order record
 * @param {object|null} props.payment the payment behind it, or `null` before funding
 */
export default function PaymentSummaryCard({ order, payment }) {
  if (!payment) {
    return (
      <Card>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography variant="subtitle2" component="h2" sx={{ mb: 1 }}>
            Payment
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This order has not been funded yet. {formatCurrency(order?.price, order?.currency)} goes
            into escrow when you pay, and stays there until you accept the delivery.
          </Typography>
          <Button
            component={RouterLink}
            to={paths.buyerCheckout(order?.id)}
            variant="gradient"
            startIcon={<Icon icon="solar:card-linear" width={18} aria-hidden="true" />}
          >
            Complete payment
          </Button>
        </CardContent>
      </Card>
    )
  }

  const refunded = Number(payment.refundedAmount) || 0

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 2 }}
        >
          <Typography variant="subtitle2" component="h2">
            Payment
          </Typography>
          <StatusChip status={payment.status} size="sm" tooltip />
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          {ESCROW_COPY[payment.status] ?? 'This payment is being processed.'}
        </Typography>

        <KeyValueList
          divided
          labelWidth={180}
          items={[
            {
              label: 'Order total',
              value: (
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {formatCurrency(payment.amount, payment.currency ?? order?.currency)}
                </Typography>
              ),
            },
            ...(refunded > 0
              ? [
                  {
                    label: 'Refunded to you',
                    value: formatCurrency(refunded, payment.currency ?? order?.currency),
                  },
                ]
              : []),
            {
              label: 'Paid with',
              value: payment.method?.last4
                ? `Card ending ${payment.method.last4}`
                : EMPTY_PLACEHOLDER,
            },
            { label: 'Paid on', value: formatDateTime(payment.heldAt ?? payment.createdAt) },
            ...(payment.releasedAt
              ? [{ label: 'Released on', value: formatDateTime(payment.releasedAt) }]
              : []),
            { label: 'Payment reference', value: payment.id },
          ]}
        />

        <Button
          component={RouterLink}
          to={paths.BUYER_PAYMENTS}
          variant="outlined"
          color="inherit"
          startIcon={<Icon icon="solar:bill-list-linear" width={18} aria-hidden="true" />}
          sx={{ mt: 2.5 }}
        >
          View receipt
        </Button>
      </CardContent>
    </Card>
  )
}
