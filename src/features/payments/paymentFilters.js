// The vocabulary of the buyer's money screen: the two tabs, the values each
// filter can take, and how all of it is spelled in the URL (00 §12 — "filters
// sync to URL query params").
//
// Kept out of the page for the same reason `buyerRequestFilters.js` is: the tab
// strip, the two queries, the filter controls, and the CSV export all read the
// same definitions, and a value added here needs no change anywhere else.

import { PAYMENT_STATUS, TRANSACTION_TYPE } from '@/constants/statuses'
import { discoveryParam } from '@/features/discovery/hooks/useDiscoveryParams'

export const PAYMENTS_TAB = Object.freeze({
  PAYMENTS: 'payments',
  TRANSACTIONS: 'transactions',
})

export const PAYMENTS_TABS = Object.freeze([
  Object.freeze({ key: PAYMENTS_TAB.PAYMENTS, label: 'Payments' }),
  Object.freeze({ key: PAYMENTS_TAB.TRANSACTIONS, label: 'Transactions' }),
])

const TAB_KEYS = PAYMENTS_TABS.map((tab) => tab.key)

/**
 * Payment states a buyer can actually have, in lifecycle order.
 *
 * `initiated` and `processing` are deliberately absent: they are the inside of
 * a charge that is still happening, not a state anybody filters their history
 * by. They still *render* — a seeded `processing` retry appears in the list
 * with its own chip; there is simply no filter chip for it.
 */
export const PAYMENT_STATUS_FILTERS = Object.freeze([
  PAYMENT_STATUS.HELD,
  PAYMENT_STATUS.RELEASED,
  PAYMENT_STATUS.REFUNDED,
  PAYMENT_STATUS.PARTIALLY_REFUNDED,
  PAYMENT_STATUS.FAILED,
])

/**
 * Ledger types a buyer's own rows can carry. A buyer never has `release`,
 * `commission`, or `payout` rows — those belong to a creator's balance
 * (`docs/payments.md` §7) — so offering them as filters would be offering
 * guaranteed empty results.
 */
export const BUYER_TRANSACTION_TYPES = Object.freeze([
  TRANSACTION_TYPE.CHARGE,
  TRANSACTION_TYPE.REFUND,
  TRANSACTION_TYPE.PARTIAL_REFUND,
])

/**
 * Query-string schema for `/buyer/payments`. Declared at module scope so its
 * identity is stable across renders, as `useDiscoveryParams` requires.
 *
 * `from`/`to` share a group so a date range counts as one active filter rather
 * than two.
 */
export const BUYER_PAYMENT_PARAMS = Object.freeze({
  tab: discoveryParam.choice({
    options: TAB_KEYS,
    fallback: PAYMENTS_TAB.PAYMENTS,
    isFilter: false,
  }),
  status: discoveryParam.choice({ options: [...PAYMENT_STATUS_FILTERS], fallback: null }),
  type: discoveryParam.choice({ options: [...BUYER_TRANSACTION_TYPES], fallback: null }),
  from: discoveryParam.text({ fallback: '', maxLength: 10, group: 'date' }),
  to: discoveryParam.text({ fallback: '', maxLength: 10, group: 'date' }),
  page: discoveryParam.number({ fallback: 1, min: 1, integer: true, isFilter: false }),
})

/**
 * A `YYYY-MM-DD` day turned into the ISO instant a range comparison needs.
 *
 * `createdAt` is stored as a full timestamp, so a `to` of "the 4th" has to mean
 * the *end* of the 4th or a payment taken that afternoon falls outside a range
 * that plainly includes its day.
 *
 * @param {string} day a `YYYY-MM-DD` string from `FormDateField`
 * @param {'start'|'end'} edge which end of the day is wanted
 * @returns {string|undefined} an ISO timestamp, or `undefined` for an empty input
 */
export function dayBoundaryIso(day, edge) {
  if (!day) return undefined
  return edge === 'end' ? `${day}T23:59:59.999Z` : `${day}T00:00:00.000Z`
}
