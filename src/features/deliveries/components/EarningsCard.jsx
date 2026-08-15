import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import KeyValueList from '@/components/data-display/KeyValueList'
import StatusChip from '@/components/data-display/StatusChip'
import { PAYMENT_STATUS } from '@/constants/statuses'
import { formatCurrency, formatDateTime, formatPercent } from '@/utils/formatters'

// What this order is worth to the creator, and where the money currently is.
//
// The net figure is the headline and the gross is the subline, which is the
// opposite of the buyer's payment card by design (`docs/payments.md`): a buyer
// cares what they are paying, a creator cares what arrives. Both numbers come
// off the **order's own snapshot** — `commissionRate`, `commissionAmount`, and
// `creatorEarnings` were fixed when the proposal was accepted — so a later
// change to the platform rate cannot reprice work that has already been agreed
// (contract §6.9).

/** One sentence about where the escrow is, from the creator's side. */
const ESCROW_COPY = {
  [PAYMENT_STATUS.HELD]:
    'BetterBlue is holding the buyer’s payment. It is released to you the moment they accept your delivery.',
  [PAYMENT_STATUS.RELEASED]: 'Released to your BetterBlue balance, less the commission.',
  [PAYMENT_STATUS.PARTIALLY_REFUNDED]:
    'Part of this payment went back to the buyer and the rest was released to you.',
  [PAYMENT_STATUS.REFUNDED]: 'This payment was returned to the buyer in full, so nothing is owed to you.',
  [PAYMENT_STATUS.FAILED]: 'The buyer’s payment was declined, so nothing has been funded yet.',
}

/**
 * @param {object} props
 * @param {object} props.order the order record
 * @param {object|null} [props.payment] the payment behind it, or `null` before funding
 */
export default function EarningsCard({ order, payment }) {
  const currency = order?.currency
  const gross = Number(order?.price) || 0
  const commission = Number(order?.commissionAmount) || 0
  const net = Number(order?.creatorEarnings) || 0
  const isReleased = payment?.status === PAYMENT_STATUS.RELEASED

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Typography variant="subtitle2" component="h2" sx={{ mb: 2 }}>
          Your earnings
        </Typography>

        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: (theme) => alpha(theme.palette.success.main, 0.08),
            border: 1,
            borderColor: (theme) => alpha(theme.palette.success.main, 0.22),
          }}
        >
          <Typography variant="overline" color="text.secondary">
            {isReleased ? 'Released to you' : 'Net to you'}
          </Typography>
          <Typography
            variant="h4"
            component="p"
            sx={{ fontWeight: 800, color: 'success.dark', fontVariantNumeric: 'tabular-nums' }}
          >
            {formatCurrency(net, currency)}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            from {formatCurrency(gross, currency)} agreed with the buyer
          </Typography>
        </Box>

        <Divider sx={{ my: 2.5 }} />

        <KeyValueList
          divided
          labelWidth={190}
          items={[
            { label: 'Order value', value: formatCurrency(gross, currency) },
            {
              label: `BetterBlue commission (${formatPercent(order?.commissionRate, {
                maximumFractionDigits: 1,
              })})`,
              value: `− ${formatCurrency(commission, currency)}`,
            },
            {
              label: 'Net to you',
              value: (
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {formatCurrency(net, currency)}
                </Typography>
              ),
            },
            {
              label: 'Escrow',
              value: payment ? (
                <StatusChip status={payment.status} size="sm" tooltip />
              ) : (
                'Not funded yet'
              ),
            },
            ...(payment?.releasedAt
              ? [{ label: 'Released on', value: formatDateTime(payment.releasedAt) }]
              : []),
          ]}
        />

        <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ mt: 2.5 }}>
          <Box aria-hidden="true" sx={{ color: 'text.secondary', display: 'flex', pt: '2px' }}>
            <Icon
              icon={isReleased ? 'solar:wallet-money-linear' : 'solar:lock-keyhole-linear'}
              width={20}
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            {payment
              ? (ESCROW_COPY[payment.status] ?? 'This payment is still being processed.')
              : 'The buyer has not funded this order yet. Nothing is due to you until they do.'}
          </Typography>
        </Stack>

        {/* TODO(Prompt 25): a "View earnings" link to `paths.CREATOR_EARNINGS`
            belongs here once the earnings and payouts screens exist. Deliberately
            not rendered yet — a link that lands on the dashboard 404 is worse
            than no link (Prompt 14's rule for `navConfig`, applied to a page). */}
      </CardContent>
    </Card>
  )
}
