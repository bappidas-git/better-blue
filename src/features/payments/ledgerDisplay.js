// How a ledger row reads on screen.
//
// `transactions.amount` is signed **from the perspective of `userId`**
// (`docs/payments.md` §7): money leaving is negative, money arriving is
// positive. That sign is the whole meaning of the row, so it is always shown
// explicitly — a `+` is written in, because a bare number next to a negative
// one is ambiguous exactly where it matters.
//
// No arithmetic happens here (Prompt 19 §7). These are display strings built
// from figures the service already computed.

import { formatCurrency } from '@/utils/formatters'

/** `-$1,250.00` / `+$1,000.00` — the sign is never implied. */
export function signedAmount(row) {
  const amount = Number(row?.amount)
  const formatted = formatCurrency(amount, row?.currency)
  return Number.isFinite(amount) && amount > 0 ? `+${formatted}` : formatted
}

/**
 * The colour a signed amount is printed in.
 *
 * Money arriving is green; money leaving is simply text. Colour is never the
 * only carrier of the meaning — the sign is right there in the string, which is
 * what keeps this readable without colour vision (00 §13).
 */
export function amountColor(row) {
  return Number(row?.amount) > 0 ? 'success.dark' : 'text.primary'
}
