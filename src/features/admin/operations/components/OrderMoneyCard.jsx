import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import KeyValueList from '@/components/data-display/KeyValueList'
import StatusChip from '@/components/data-display/StatusChip'
import { EMPTY_PLACEHOLDER, formatCurrency, formatDateTime, formatPercent } from '@/utils/formatters'

// The money on one order, as an operations desk needs to see it — Prompt 31 §4.2.
//
// Three questions in one card, in the order somebody actually asks them:
// what was agreed (price, commission, net), where the money is right now (the
// payment's status and its timestamps), and what has actually moved (the ledger
// rows against this order).
//
// The ledger is the part the buyer's and creator's screens do not get: they see
// their own side of it, and this shows both, which is the only view from which
// "the buyer paid 940 and the creator was credited 799" is checkable.

/** Ledger amounts are signed from the row owner's perspective (contract §6.13). */
function signedAmount(transaction) {
  const amount = transaction.amount ?? 0
  const formatted = formatCurrency(Math.abs(amount), transaction.currency)
  return amount < 0 ? `− ${formatted}` : `+ ${formatted}`
}

/** One ledger line. */
function TransactionRow({ transaction, isLast }) {
  const outgoing = (transaction.amount ?? 0) < 0

  return (
    <Stack
      component="li"
      direction="row"
      spacing={1.5}
      alignItems="flex-start"
      sx={{ py: 1.25, borderBottom: isLast ? 0 : 1, borderColor: 'divider', listStyle: 'none' }}
    >
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <StatusChip status={transaction.type} size="sm" showDot={false} tooltip />
          <Typography variant="caption" color="text.secondary">
            {formatDateTime(transaction.createdAt)}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {transaction.description}
        </Typography>
      </Box>

      <Typography
        variant="body2"
        sx={{ fontWeight: 700, flexShrink: 0, color: outgoing ? 'text.secondary' : 'success.dark' }}
      >
        {signedAmount(transaction)}
      </Typography>
    </Stack>
  )
}

/**
 * @param {object} props
 * @param {object} props.order the order
 * @param {object} [props.payment] its payment record, `null` when unfunded
 * @param {object[]} [props.transactions] ledger rows against this order
 */
export default function OrderMoneyCard({ order, payment, transactions = [] }) {
  const currency = order?.currency

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2 }}>
          <Box
            aria-hidden="true"
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1.5,
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'primary.surface',
              color: 'primary.main',
              flexShrink: 0,
            }}
          >
            <Icon icon="solar:wallet-money-linear" width={18} />
          </Box>
          <Typography variant="subtitle2" component="h2">
            Money
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          {payment ? <StatusChip status={payment.status} size="sm" tooltip /> : null}
        </Stack>

        <KeyValueList
          divided
          labelWidth={190}
          items={[
            { label: 'Order value', value: formatCurrency(order?.price, currency) },
            {
              label: 'BetterBlue commission',
              value: `${formatCurrency(order?.commissionAmount, currency)} · ${formatPercent(
                order?.commissionRate ?? 0
              )}`,
              hint: 'Snapshotted when the proposal was accepted — a later rate change cannot reprice it.',
            },
            {
              label: 'Creator net',
              value: formatCurrency(order?.creatorEarnings, currency),
            },
            {
              label: 'Escrow held',
              value: payment?.heldAt ? formatDateTime(payment.heldAt) : 'Not funded',
            },
            ...(payment?.releasedAt
              ? [{ label: 'Released', value: formatDateTime(payment.releasedAt) }]
              : []),
            ...(payment?.refundedAt
              ? [
                  {
                    label: 'Refunded',
                    value: `${formatCurrency(
                      payment.refundedAmount ?? payment.amount,
                      currency
                    )} · ${formatDateTime(payment.refundedAt)}`,
                  },
                ]
              : []),
            ...(payment?.failureReason
              ? [{ label: 'Payment failure', value: payment.failureReason }]
              : []),
          ]}
        />

        <Divider sx={{ my: 2.5 }} />

        <Typography variant="subtitle2" component="h3" sx={{ mb: 0.5 }}>
          Ledger
        </Typography>
        {transactions.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {EMPTY_PLACEHOLDER} No money has moved on this order yet.
          </Typography>
        ) : (
          <Box component="ul" aria-label="Ledger rows for this order" sx={{ m: 0, p: 0 }}>
            {transactions.map((transaction, index) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                isLast={index === transactions.length - 1}
              />
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
