// The affiliate console's vocabulary: its tabs, what each one filters by, and
// how that is spelled in the URL (00 §12 — "filters sync to URL query params")
// — Prompt 34 §4.4.
//
// Split out of the page for the same reason `finance/utils/financeFilters.js`
// is: the page renders, this decides what a tab *means*. The keys appear in
// shared URLs, so they are stable.

import { AFFILIATE_EARNING_STATUS, AFFILIATE_PROFILE_STATUS, PAYOUT_STATUS } from '@/constants/statuses'
import { listParam } from '@/hooks/useListParams'

/** Rows per page across the console — dense, tabular, scannable. */
export const AFFILIATE_PAGE_SIZE = 20

/** Rows one CSV export may pull, matching the finance console's ceiling. */
export const AFFILIATE_EXPORT_LIMIT = 500

/** How many earnings one batch approval may take in a single run. */
export const AFFILIATE_BATCH_LIMIT = 25

/* -------------------------------------------------------------------------- */
/* Tabs                                                                       */
/* -------------------------------------------------------------------------- */

export const AFFILIATE_TAB = Object.freeze({
  AFFILIATES: 'affiliates',
  EARNINGS: 'earnings',
  PAYOUTS: 'payouts',
})

export const AFFILIATE_TABS = Object.freeze([
  Object.freeze({ key: AFFILIATE_TAB.AFFILIATES, label: 'Affiliates' }),
  Object.freeze({ key: AFFILIATE_TAB.EARNINGS, label: 'Earnings approval' }),
  Object.freeze({ key: AFFILIATE_TAB.PAYOUTS, label: 'Payouts' }),
])

const AFFILIATE_TAB_KEYS = AFFILIATE_TABS.map((tab) => tab.key)

/**
 * The earnings sub-queues. `pending` is the one with work in it, so it opens
 * first and is the only tab whose rows carry checkboxes — an `approved` earning
 * has nothing left to approve, and a control that cannot act is worse than none
 * (the discipline Prompt 32's settlement queue sets).
 */
export const EARNING_QUEUE = Object.freeze([
  Object.freeze({
    key: AFFILIATE_EARNING_STATUS.PENDING,
    label: 'Awaiting review',
    status: AFFILIATE_EARNING_STATUS.PENDING,
    actionable: true,
  }),
  Object.freeze({
    key: AFFILIATE_EARNING_STATUS.APPROVED,
    label: 'Approved',
    status: AFFILIATE_EARNING_STATUS.APPROVED,
    actionable: false,
  }),
  Object.freeze({
    key: AFFILIATE_EARNING_STATUS.PAID,
    label: 'Paid',
    status: AFFILIATE_EARNING_STATUS.PAID,
    actionable: false,
  }),
  Object.freeze({
    key: AFFILIATE_EARNING_STATUS.VOID,
    label: 'Void',
    status: AFFILIATE_EARNING_STATUS.VOID,
    actionable: false,
  }),
])

const EARNING_QUEUE_BY_KEY = new Map(EARNING_QUEUE.map((entry) => [entry.key, entry]))

/** The earnings sub-queue behind a key, falling back to the one with work in it. */
export function earningQueue(key) {
  return EARNING_QUEUE_BY_KEY.get(key) ?? EARNING_QUEUE_BY_KEY.get(AFFILIATE_EARNING_STATUS.PENDING)
}

/** The payout sub-queues — the same four states Prompt 32's queue works in. */
export const AFFILIATE_PAYOUT_QUEUE = Object.freeze([
  Object.freeze({ key: 'requested', label: 'Requested', status: PAYOUT_STATUS.REQUESTED }),
  Object.freeze({ key: 'processing', label: 'Processing', status: PAYOUT_STATUS.PROCESSING }),
  Object.freeze({ key: 'completed', label: 'Completed', status: PAYOUT_STATUS.PAID }),
  Object.freeze({ key: 'rejected', label: 'Rejected', status: PAYOUT_STATUS.REJECTED }),
])

const PAYOUT_QUEUE_BY_KEY = new Map(AFFILIATE_PAYOUT_QUEUE.map((entry) => [entry.key, entry]))

/** The payout sub-queue behind a key, falling back to the one with work in it. */
export function affiliatePayoutQueue(key) {
  return PAYOUT_QUEUE_BY_KEY.get(key) ?? PAYOUT_QUEUE_BY_KEY.get('requested')
}

/**
 * Age thresholds for accrued commission awaiting review.
 *
 * Looser than the settlement queue's (3/7 days): nobody is waiting on a bank
 * transfer here, they are waiting on a decision — but a commission nobody has
 * looked at in a fortnight is a member wondering whether the program is real.
 */
export const EARNING_SLA = Object.freeze({ warnAfterDays: 7, errorAfterDays: 14 })

/** URL schema for `/admin/affiliates`. Module scope — `useListParams` needs stable identity. */
export const AFFILIATES_PARAMS = Object.freeze({
  tab: listParam.choice({
    options: AFFILIATE_TAB_KEYS,
    fallback: AFFILIATE_TAB.AFFILIATES,
    isFilter: false,
  }),
  status: listParam.choice({
    options: Object.values(AFFILIATE_PROFILE_STATUS),
    fallback: null,
  }),
  queue: listParam.choice({
    options: EARNING_QUEUE.map((entry) => entry.key),
    fallback: AFFILIATE_EARNING_STATUS.PENDING,
    isFilter: false,
  }),
  payoutQueue: listParam.choice({
    options: AFFILIATE_PAYOUT_QUEUE.map((entry) => entry.key),
    fallback: 'requested',
    isFilter: false,
  }),
  page: listParam.number({ fallback: 1, min: 1, integer: true, isFilter: false }),
})
