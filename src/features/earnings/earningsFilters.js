// The vocabulary of the creator's financial centre: the three tabs, the values
// each filter can take, and how all of it is spelled in the URL (00 §12 —
// "filters sync to URL query params").
//
// Kept out of the page for the same reason `features/payments/paymentFilters.js`
// is: the tab strip, three independent queries, the filter controls, and the
// CSV export all read the same definitions, and a value added here needs no
// change anywhere else. `dayBoundaryIso` is imported from that module rather
// than restated — the two screens read the same ledger and must agree on what
// "up to the 4th" means (00 §16.4).

import { TRANSACTION_TYPE } from '@/constants/statuses'
import { discoveryParam } from '@/features/discovery/hooks/useDiscoveryParams'

export { dayBoundaryIso } from '@/features/payments/paymentFilters'

export const EARNINGS_TAB = Object.freeze({
  OVERVIEW: 'overview',
  TRANSACTIONS: 'transactions',
  PAYOUTS: 'payouts',
})

export const EARNINGS_TABS = Object.freeze([
  Object.freeze({ key: EARNINGS_TAB.OVERVIEW, label: 'Overview' }),
  Object.freeze({ key: EARNINGS_TAB.TRANSACTIONS, label: 'Transactions' }),
  Object.freeze({ key: EARNINGS_TAB.PAYOUTS, label: 'Payouts' }),
])

const TAB_KEYS = EARNINGS_TABS.map((tab) => tab.key)

/**
 * Ledger types a creator's own rows can carry (`docs/payments.md` §7).
 *
 * `charge` is absent because a creator is never charged, and `refund` because a
 * refund is credited to the **buyer**: an order refunded in full simply never
 * produces a creator row at all. `partial_refund` is offered because a creator
 * whose order was partly returned looks for it by name, even though the row
 * that lands on their ledger is the smaller `release` beside it — the filter
 * finding nothing is a truthful answer to "what did the refund take from me".
 */
export const CREATOR_TRANSACTION_TYPES = Object.freeze([
  TRANSACTION_TYPE.RELEASE,
  TRANSACTION_TYPE.COMMISSION,
  TRANSACTION_TYPE.PAYOUT,
  TRANSACTION_TYPE.AFFILIATE_COMMISSION,
])

/**
 * Query-string schema for `/creator/earnings`. Declared at module scope so its
 * identity is stable across renders, as `useListParams` requires.
 *
 * `from`/`to` share a group so a date range counts as one active filter rather
 * than two.
 */
export const CREATOR_EARNINGS_PARAMS = Object.freeze({
  tab: discoveryParam.choice({
    options: TAB_KEYS,
    fallback: EARNINGS_TAB.OVERVIEW,
    isFilter: false,
  }),
  type: discoveryParam.choice({ options: [...CREATOR_TRANSACTION_TYPES], fallback: null }),
  from: discoveryParam.text({ fallback: '', maxLength: 10, group: 'date' }),
  to: discoveryParam.text({ fallback: '', maxLength: 10, group: 'date' }),
  page: discoveryParam.number({ fallback: 1, min: 1, integer: true, isFilter: false }),
})
