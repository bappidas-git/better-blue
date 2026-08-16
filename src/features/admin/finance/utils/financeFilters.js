// The finance console's vocabulary: its tabs, the values each filter can take,
// and how all of it is spelled in the URL (00 §12 — "filters sync to URL query
// params") — Prompt 32 §4.
//
// Split out of the pages for the same reason `moderation/utils/moderationQueue.js`
// is: the pages render, this decides what a tab *means*. Three screens read
// from it, and the settlement queue's tab keys in particular are shared between
// the queue, its summary cards, and its CSV export.

import dayjs from 'dayjs'

import { PAYOUT_STATUS, STATUS_META, TRANSACTION_TYPE } from '@/constants/statuses'
import { listParam } from '@/hooks/useListParams'

/** Rows per page across all three finance screens — dense, tabular, scannable. */
export const FINANCE_PAGE_SIZE = 20

/**
 * Rows one CSV export may pull. Well above the seeded marketplace and below the
 * point where a browser building a file becomes a bad idea — the same ceiling
 * Prompt 31's exports use, said out loud in the toast when it bites.
 */
export const FINANCE_EXPORT_LIMIT = 500

/* -------------------------------------------------------------------------- */
/* Payments screen                                                            */
/* -------------------------------------------------------------------------- */

/** Tab keys — stable, they appear in shared URLs. */
export const PAYMENTS_TAB = Object.freeze({
  OVERVIEW: 'overview',
  ESCROW: 'escrow',
  LEDGER: 'ledger',
})

export const PAYMENTS_TABS = Object.freeze([
  Object.freeze({ key: PAYMENTS_TAB.OVERVIEW, label: 'Overview' }),
  Object.freeze({ key: PAYMENTS_TAB.ESCROW, label: 'Escrow' }),
  Object.freeze({ key: PAYMENTS_TAB.LEDGER, label: 'Transactions' }),
])

const PAYMENTS_TAB_KEYS = PAYMENTS_TABS.map((tab) => tab.key)

/**
 * Every `TRANSACTION_TYPE`, because the platform ledger genuinely carries all
 * of them — unlike the buyer's and the creator's, which each see a subset
 * (`features/payments/paymentFilters.js`, `features/earnings/earningsFilters.js`).
 */
export const LEDGER_TYPES = Object.freeze(Object.values(TRANSACTION_TYPE))

/**
 * Age thresholds for the escrow monitor's `AgeBadge`, in days.
 *
 * Deliberately looser than a queue SLA: held money is not late, it is held.
 * Escrow past a fortnight simply means an engagement nobody has finished, which
 * is worth a colour and not an alarm.
 */
export const ESCROW_SLA = Object.freeze({ warnAfterDays: 14, errorAfterDays: 30 })

/** URL schema for `/admin/payments`. Module scope — `useListParams` needs stable identity. */
export const PAYMENTS_PARAMS = Object.freeze({
  tab: listParam.choice({
    options: PAYMENTS_TAB_KEYS,
    fallback: PAYMENTS_TAB.OVERVIEW,
    isFilter: false,
  }),
  type: listParam.choice({ options: [...LEDGER_TYPES], fallback: null }),
  q: listParam.text({ fallback: '', maxLength: 40 }),
  from: listParam.text({ fallback: '', maxLength: 10, group: 'date' }),
  to: listParam.text({ fallback: '', maxLength: 10, group: 'date' }),
  page: listParam.number({ fallback: 1, min: 1, integer: true, isFilter: false }),
})

/* -------------------------------------------------------------------------- */
/* Settlements screen                                                         */
/* -------------------------------------------------------------------------- */

/**
 * The queue's four tabs. `statuses` is what each one filters payouts by, and
 * `actionable` marks the two an admin can still do something about — which is
 * what turns batch selection on and off without the page knowing why.
 *
 * "Completed" rather than "Paid": the tab holds settled records, and a reader
 * scanning tabs for "where did my request go" reads an outcome, not a status.
 */
export const SETTLEMENT_TAB = Object.freeze({
  REQUESTED: 'requested',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
})

export const SETTLEMENT_TABS = Object.freeze([
  Object.freeze({
    key: SETTLEMENT_TAB.REQUESTED,
    label: 'Requested',
    status: PAYOUT_STATUS.REQUESTED,
    actionable: true,
  }),
  Object.freeze({
    key: SETTLEMENT_TAB.PROCESSING,
    label: 'Processing',
    status: PAYOUT_STATUS.PROCESSING,
    actionable: true,
  }),
  Object.freeze({
    key: SETTLEMENT_TAB.COMPLETED,
    label: 'Completed',
    status: PAYOUT_STATUS.PAID,
    actionable: false,
  }),
  Object.freeze({
    key: SETTLEMENT_TAB.REJECTED,
    label: 'Rejected',
    status: PAYOUT_STATUS.REJECTED,
    actionable: false,
  }),
])

const SETTLEMENT_TAB_BY_KEY = new Map(SETTLEMENT_TABS.map((tab) => [tab.key, tab]))

/** The tab behind a key, falling back to the queue an admin opens on. */
export function settlementTab(key) {
  return SETTLEMENT_TAB_BY_KEY.get(key) ?? SETTLEMENT_TAB_BY_KEY.get(SETTLEMENT_TAB.REQUESTED)
}

/**
 * Age thresholds for a waiting settlement. Tighter than escrow's, because this
 * *is* a queue: somebody asked for their own money and is waiting on us.
 */
export const SETTLEMENT_SLA = Object.freeze({ warnAfterDays: 3, errorAfterDays: 7 })

/** URL schema for `/admin/settlements`. */
export const SETTLEMENTS_PARAMS = Object.freeze({
  tab: listParam.choice({
    options: SETTLEMENT_TABS.map((tab) => tab.key),
    fallback: SETTLEMENT_TAB.REQUESTED,
    isFilter: false,
  }),
  page: listParam.number({ fallback: 1, min: 1, integer: true, isFilter: false }),
})

/* -------------------------------------------------------------------------- */
/* Commissions screen                                                         */
/* -------------------------------------------------------------------------- */

/** Months offered in the period picker, including the current partial one. */
export const COMMISSION_PERIOD_MONTHS = 12

/** URL schema for `/admin/commissions`. `month` is `YYYY-MM`, or `''` for all time. */
export const COMMISSIONS_PARAMS = Object.freeze({
  month: listParam.text({ fallback: '', maxLength: 7 }),
  page: listParam.number({ fallback: 1, min: 1, integer: true, isFilter: false }),
})

/**
 * The period picker's options, newest first, with an "all time" entry at the
 * end. Built from the clock rather than from the data: a month with no
 * commissions is a real answer, and hiding it would leave a reader wondering
 * whether the month was empty or the filter was broken.
 *
 * @param {Date|string} [now] injectable clock
 * @param {number} [count={@link COMMISSION_PERIOD_MONTHS}]
 * @returns {{value: string, label: string}[]}
 */
export function monthOptions(now, count = COMMISSION_PERIOD_MONTHS) {
  const thisMonth = dayjs(now ?? undefined).startOf('month')

  return [
    ...Array.from({ length: count }, (unused, index) => {
      const month = thisMonth.subtract(index, 'month')
      return { value: month.format('YYYY-MM'), label: month.format('MMMM YYYY') }
    }),
    { value: '', label: 'All time' },
  ]
}

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                             */
/* -------------------------------------------------------------------------- */

/** `{ value, label }` for a status or ledger type, using its `STATUS_META` label. */
export const statusOption = (value) =>
  Object.freeze({ value, label: STATUS_META[value]?.label ?? value })

/** Ledger type chips, in the order money moves through the platform. */
export const LEDGER_TYPE_OPTIONS = Object.freeze([
  TRANSACTION_TYPE.CHARGE,
  TRANSACTION_TYPE.RELEASE,
  TRANSACTION_TYPE.COMMISSION,
  TRANSACTION_TYPE.REFUND,
  TRANSACTION_TYPE.PARTIAL_REFUND,
  TRANSACTION_TYPE.PAYOUT,
  TRANSACTION_TYPE.AFFILIATE_COMMISSION,
].map(statusOption))

/**
 * A `YYYY-MM-DD` day turned into the ISO instant a range comparison needs —
 * the same helper the buyer's payment screen carries, because a `to` of "the
 * 4th" has to mean the *end* of the 4th.
 *
 * @param {string} day from `FormDateField`
 * @param {'start'|'end'} edge
 * @returns {string|undefined} an ISO timestamp, or `undefined` for an empty input
 */
export function dayBoundary(day, edge) {
  if (!day) return undefined
  return edge === 'end' ? `${day}T23:59:59.999Z` : `${day}T00:00:00.000Z`
}

/** A payout method, masked, for a queue row. Never the full account number. */
export function payoutMethodLabel(method) {
  if (!method) return null
  const masked = method.accountMasked ?? null
  if (!masked) return method.accountName ?? null
  return method.accountName ? `${method.accountName} · ${masked}` : masked
}
