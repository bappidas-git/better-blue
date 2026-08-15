import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

import StatusChip from '@/components/data-display/StatusChip'
import { paths } from '@/routes/paths'
import { EMPTY_PLACEHOLDER, formatCurrency, formatDate } from '@/utils/formatters'

// One payment, as a buyer reads it: what it was for, what it cost, where the
// money is now, and the way to a receipt.
//
// The amount is `payments.amount` — what was actually taken. Anything that has
// happened to it since (a release, a refund, the commission) is the ledger's
// business and lives in the receipt, not on the summary line.

/**
 * @param {object} props
 * @param {object} props.payment the payment record
 * @param {string} [props.orderTitle] the order's title, resolved by the page
 * @param {(payment: object) => void} [props.onReceipt] opens the receipt sheet
 */
export default function PaymentCard({ payment, orderTitle, onReceipt }) {
  const method = payment?.method?.last4 ? `Card ending ${payment.method.last4}` : null

  return (
    <Card component="li" sx={{ listStyle: 'none' }}>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 1.5, sm: 2 }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', sm: 'center' }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
              {payment?.orderId ? (
                <Link
                  component={RouterLink}
                  to={paths.buyerOrderDetail(payment.orderId)}
                  variant="subtitle2"
                  underline="hover"
                  sx={{ fontWeight: 700 }}
                >
                  {orderTitle ?? payment.orderId}
                </Link>
              ) : (
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {orderTitle ?? EMPTY_PLACEHOLDER}
                </Typography>
              )}
              <StatusChip status={payment?.status} size="sm" tooltip />
            </Stack>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {formatDate(payment?.createdAt)}
              {method ? ` · ${method}` : ''}
            </Typography>
          </Box>

          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            justifyContent={{ xs: 'space-between', sm: 'flex-end' }}
            sx={{ flexShrink: 0 }}
          >
            <Typography
              variant="h6"
              component="p"
              sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
            >
              {formatCurrency(payment?.amount, payment?.currency)}
            </Typography>

            <Button
              onClick={() => onReceipt?.(payment)}
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<Icon icon="solar:bill-list-linear" width={18} aria-hidden="true" />}
              sx={{ minHeight: 44 }}
            >
              Receipt
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}
