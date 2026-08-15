import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

import KeyValueList from '@/components/data-display/KeyValueList'
import StatusChip from '@/components/data-display/StatusChip'
import EmptyState from '@/components/feedback/EmptyState'
import ErrorState from '@/components/feedback/ErrorState'
import ListSkeleton from '@/components/feedback/skeletons/ListSkeleton'
import SideSheet from '@/components/layout/SideSheet'
import { amountColor, signedAmount } from '@/features/payments/ledgerDisplay'
import useApiQuery from '@/hooks/useApiQuery'
import { paths } from '@/routes/paths'
import { paymentService } from '@/services/paymentService'
import { EMPTY_PLACEHOLDER, formatCurrency, formatDateTime } from '@/utils/formatters'

// The receipt for one payment: the record itself, its timestamps, and every
// ledger row written against it.
//
// The ledger rows are the interesting half. A completed order's payment has a
// `charge` on the buyer's side; a refunded one has the charge and the refund
// sitting under it. Reading them together is how a buyer answers "so what
// actually happened to my money", which is the only question a receipt exists
// to answer.
//
// Full-screen below `sm` — `SideSheet` handles that, along with the focus trap,
// Escape, and focus return (Prompt 04).

/** Ledger rows on one payment are a handful; this is a ceiling, not a page. */
const LEDGER_LIMIT = 20

/** A payment field worth a row only when it holds something. */
const rowIf = (condition, row) => (condition ? [row] : [])

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {object|null} props.payment the payment being receipted
 * @param {string} [props.orderTitle] resolved by the page
 */
export default function ReceiptSheet({ open, onClose, payment, orderTitle }) {
  const paymentId = payment?.id

  const { data, isLoading, error, refetch } = useApiQuery(
    () =>
      paymentService.listTransactions({
        page: 1,
        limit: LEDGER_LIMIT,
        filters: { paymentId },
      }),
    [paymentId],
    { enabled: Boolean(open && paymentId) }
  )

  const rows = data?.items ?? []

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title="Payment receipt"
      description={orderTitle ?? payment?.orderId}
      width={480}
      actions={
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
      }
    >
      {payment ? (
        <Stack spacing={3}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="center">
              <Typography variant="h5" component="p" sx={{ fontWeight: 800 }}>
                {formatCurrency(payment.amount, payment.currency)}
              </Typography>
              <StatusChip status={payment.status} tooltip />
            </Stack>

            {payment.orderId ? (
              <Button
                component={RouterLink}
                to={paths.buyerOrderDetail(payment.orderId)}
                size="small"
                variant="outlined"
                color="inherit"
                sx={{ alignSelf: 'flex-start' }}
              >
                Open the order
              </Button>
            ) : null}
          </Stack>

          <Divider />

          <KeyValueList
            dense
            labelWidth={160}
            items={[
              {
                label: 'Paid with',
                // `method.brand` is the provider's own spelling (`visa`), so it
                // is cased for reading rather than rewritten.
                value: payment.method?.last4 ? (
                  <Box component="span" sx={{ textTransform: 'capitalize' }}>
                    {`${payment.method.brand ?? 'card'} ending ${payment.method.last4}`}
                  </Box>
                ) : (
                  EMPTY_PLACEHOLDER
                ),
              },
              { label: 'Payment reference', value: payment.id },
              { label: 'Order reference', value: payment.orderId ?? EMPTY_PLACEHOLDER },
              { label: 'Started', value: formatDateTime(payment.createdAt) },
              ...rowIf(payment.heldAt, {
                label: 'Held in escrow',
                value: formatDateTime(payment.heldAt),
              }),
              ...rowIf(payment.releasedAt, {
                label: 'Released',
                value: formatDateTime(payment.releasedAt),
              }),
              ...rowIf(payment.refundedAt, {
                label: 'Refunded',
                value: formatDateTime(payment.refundedAt),
              }),
              ...rowIf(Number.isFinite(Number(payment.refundedAmount)), {
                label: 'Amount refunded',
                value: formatCurrency(payment.refundedAmount, payment.currency),
              }),
              ...rowIf(payment.failureReason, {
                label: 'Why it failed',
                value: payment.failureReason,
              }),
            ]}
          />

          <Divider />

          <Box>
            <Typography variant="subtitle2" component="h3" sx={{ mb: 1.5 }}>
              Ledger entries
            </Typography>

            {error ? (
              <ErrorState
                dense
                title="The ledger did not load"
                message="The payment above is accurate — only these rows failed to arrive."
                error={error}
                onRetry={refetch}
              />
            ) : isLoading ? (
              <ListSkeleton rows={2} avatar={false} label="Loading ledger entries" />
            ) : rows.length === 0 ? (
              <EmptyState
                dense
                icon="solar:bill-list-linear"
                title="No ledger entries yet"
                description="A row is written the moment money actually moves. A payment that never settled has none."
              />
            ) : (
              <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', m: 0, p: 0 }}>
                {rows.map((row) => (
                  <Stack
                    key={row.id}
                    component="li"
                    direction="row"
                    spacing={2}
                    justifyContent="space-between"
                    alignItems="flex-start"
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <StatusChip status={row.type} size="sm" showDot={false} variant="outlined" />
                      <Typography variant="body2" sx={{ mt: 0.75 }}>
                        {row.description}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDateTime(row.createdAt)}
                      </Typography>
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        fontVariantNumeric: 'tabular-nums',
                        color: amountColor(row),
                      }}
                    >
                      {signedAmount(row)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            )}
          </Box>
        </Stack>
      ) : null}
    </SideSheet>
  )
}
