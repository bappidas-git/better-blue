// The buyer dashboard overview — one composite read behind one function
// (`docs/api-contract.md` §7.1, operation 14).
//
// MOCK-AGGREGATE: there is no `GET /buyer/overview`. Everything below is
// assembled in the browser from the collections JSON Server already serves —
// count queries read for their `X-Total-Count` (the pattern documented in
// `adminService`), a page of payments folded into monthly totals, and the
// member's newest notifications. Laravel replaces the whole body with one
// cached request to `GET /buyer/overview` that computes the same figures with
// four `SELECT COUNT(*)`s and a `GROUP BY MONTH(created_at)`; the return shape
// and this function's signature do not change.
//
// **Nothing here throws.** An overview is four independent widgets, and one
// slow collection must not blank the other three (Prompt 15 §13): the three
// sections load in parallel, each failure is captured in `errors`, and its
// fields resolve to `null` so the page can offer a retry on that card alone.

import dayjs from 'dayjs'

import { appConfig } from '@/config/appConfig'
import {
  ORDER_STATUS,
  PAYMENT_STATUS,
  PROPOSAL_STATUS,
  REQUEST_STATUS,
} from '@/constants/statuses'

import { toApiError } from './api/apiError'
import { buyerProfileService } from './buyerProfileService'
import { notificationService } from './notificationService'
import { orderService } from './orderService'
import { paymentService } from './paymentService'
import { proposalService } from './proposalService'
import { requestService } from './requestService'

/** A count query: one row, read for its `total`. */
const COUNT_PARAMS = Object.freeze({ page: 1, limit: 1 })

/**
 * The provider's page ceiling (contract §4.1). It bounds the two reads that
 * fold rows client-side — the open briefs a buyer is collecting proposals on,
 * and their payment history. Both are comfortably inside it for any realistic
 * account, and the server-side version has no such limit.
 */
const FOLD_LIMIT = 100

/** Briefs that still want the buyer's attention: live, or awarded but not closed. */
const ACTIVE_REQUEST_STATUSES = Object.freeze([REQUEST_STATUS.OPEN, REQUEST_STATUS.AWARDED])

/** Offers a buyer has not decided on yet. */
const AWAITING_PROPOSAL_STATUSES = Object.freeze([
  PROPOSAL_STATUS.SUBMITTED,
  PROPOSAL_STATUS.SHORTLISTED,
])

/** Orders still in flight — everything that is neither finished nor abandoned. */
const ACTIVE_ORDER_STATUSES = Object.freeze([
  ORDER_STATUS.PENDING_PAYMENT,
  ORDER_STATUS.IN_PROGRESS,
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.REVISION_REQUESTED,
  ORDER_STATUS.DISPUTED,
])

/**
 * Payment states that count as money spent, net of refunds — the same rule the
 * seed uses to derive `buyerProfiles.totalSpent` (contract §6.3), so the tile
 * and the stored aggregate always agree.
 */
const SPENT_PAYMENT_STATUSES = new Set([
  PAYMENT_STATUS.HELD,
  PAYMENT_STATUS.RELEASED,
  PAYMENT_STATUS.PARTIALLY_REFUNDED,
])

/** Columns on the spend chart, including the current (partial) month. */
export const SPEND_MONTHS = 6

/** Rows in the overview's activity feed. */
export const ACTIVITY_LIMIT = 8

/** Currency-safe rounding, matching `scripts/seed-utils.js#round2`. */
const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100

/** What a buyer actually paid on one payment: charged, less anything refunded. */
const netAmount = (payment) => Number(payment.amount ?? 0) - Number(payment.refundedAmount ?? 0)

/**
 * The last {@link SPEND_MONTHS} months, oldest first, as empty buckets.
 * `key` is `YYYY-MM` for matching, `label` is the short month name for the axis.
 */
function emptySpendMonths(now) {
  const thisMonth = dayjs(now).startOf('month')

  return Array.from({ length: SPEND_MONTHS }, (unused, index) => {
    const month = thisMonth.subtract(SPEND_MONTHS - 1 - index, 'month')
    return { key: month.format('YYYY-MM'), label: month.format('MMM'), amount: 0 }
  })
}

/**
 * Section 1 — the stat band, plus what the onboarding checklist needs to know.
 *
 * `proposalsAwaiting` is the only figure that cannot be a single count: it is
 * scoped to the buyer's *open* briefs, so the brief ids have to be known first.
 * A buyer with nothing open skips the second request entirely.
 */
async function loadSummary(buyerId) {
  const [openRequests, activeRequests, requestsTotal, activeOrders, ordersTotal, profile] =
    await Promise.all([
      requestService.listByBuyer(buyerId, {
        page: 1,
        limit: FOLD_LIMIT,
        filters: { status: REQUEST_STATUS.OPEN },
      }),
      requestService.listByBuyer(buyerId, {
        ...COUNT_PARAMS,
        filters: { status: [...ACTIVE_REQUEST_STATUSES] },
      }),
      requestService.listByBuyer(buyerId, COUNT_PARAMS),
      orderService.listByBuyer(buyerId, {
        ...COUNT_PARAMS,
        filters: { status: [...ACTIVE_ORDER_STATUSES] },
      }),
      orderService.listByBuyer(buyerId, COUNT_PARAMS),
      buyerProfileService.getByUserId(buyerId),
    ])

  const openRequestIds = openRequests.items.map((request) => request.id)
  const proposalsAwaiting =
    openRequestIds.length === 0
      ? 0
      : (
          await proposalService.list({
            ...COUNT_PARAMS,
            filters: {
              requestId: openRequestIds,
              status: [...AWAITING_PROPOSAL_STATUSES],
            },
          })
        ).total

  return {
    activeRequests: activeRequests.total,
    proposalsAwaiting,
    activeOrders: activeOrders.total,
    requestsTotal: requestsTotal.total,
    ordersTotal: ordersTotal.total,
    // The onboarding checklist pairs this with the *account* record, which the
    // session already holds, through
    // `buyerProfileService#getBuyerProfileCompleteness` — re-fetching the
    // signed-in user here just to compute a percentage would be a wasted round
    // trip on every dashboard visit.
    profile,
  }
}

/**
 * Section 2 — lifetime spend and the monthly series behind the chart, folded
 * from one page of payments so both numbers come from the same rows and cannot
 * disagree.
 */
async function loadSpend(buyerId, now) {
  const { items } = await paymentService.list({
    page: 1,
    limit: FOLD_LIMIT,
    filters: { buyerId },
  })

  const spent = items.filter((payment) => SPENT_PAYMENT_STATUSES.has(payment.status))
  const byMonth = emptySpendMonths(now)
  const bucketByKey = new Map(byMonth.map((bucket) => [bucket.key, bucket]))

  spent.forEach((payment) => {
    const bucket = bucketByKey.get(dayjs(payment.createdAt).format('YYYY-MM'))
    if (bucket) bucket.amount = round2(bucket.amount + netAmount(payment))
  })

  return {
    totalSpent: round2(spent.reduce((sum, payment) => sum + netAmount(payment), 0)),
    currency: items[0]?.currency ?? appConfig.defaultCurrency,
    spendByMonth: byMonth,
  }
}

/** Section 3 — the newest notifications, rendered by `ActivityFeed`. */
async function loadActivity(buyerId) {
  const { items } = await notificationService.listByUser(buyerId, {
    page: 1,
    limit: ACTIVITY_LIMIT,
  })
  return items
}

/** Runs a section and reports the failure rather than rejecting with it. */
async function section(load) {
  try {
    return { data: await load(), error: null }
  } catch (failure) {
    return { data: null, error: toApiError(failure) }
  }
}

/**
 * @typedef {object} BuyerOverview
 * @property {number|null} activeRequests briefs that are open or awarded
 * @property {number|null} proposalsAwaiting undecided offers on open briefs
 * @property {number|null} activeOrders orders in flight
 * @property {number|null} requestsTotal every brief the buyer has ever posted
 * @property {number|null} ordersTotal every order the buyer has ever had
 * @property {object|null} profile the buyer's business profile, or `null`
 * @property {boolean} isFreshAccount no briefs and no orders — show onboarding
 * @property {number|null} totalSpent lifetime spend, net of refunds
 * @property {string} currency ISO 4217 code for `totalSpent` and the chart
 * @property {Array<{key: string, label: string, amount: number}>|null} spendByMonth
 *   six buckets, oldest first, including the current partial month
 * @property {Array<object>|null} recentActivity newest notifications, newest first
 * @property {{summary: ApiError|null, spend: ApiError|null, activity: ApiError|null}} errors
 *   which sections failed — each maps to one retryable card
 */

export const buyerDashboardService = Object.freeze({
  /**
   * Everything the buyer overview renders, in three parallel section loads.
   *
   * **Future endpoint:** `GET /buyer/overview` (contract §7.1 operation 14) —
   * one authenticated request returning this exact object for the signed-in
   * buyer, with the counts and the spend series computed in SQL. The mock
   * version derives the same figures from up to eight REST calls; the buyer id
   * is a parameter here only because the mock stack has no session to read it
   * from, and Laravel takes it from the bearer token instead.
   *
   * @param {string} buyerId `usr_…`
   * @param {object} [options]
   * @param {Date|string} [options.now] injectable clock for the month buckets
   * @returns {Promise<BuyerOverview>} never rejects — see `errors`
   */
  async getOverview(buyerId, { now } = {}) {
    const empty = {
      activeRequests: null,
      proposalsAwaiting: null,
      activeOrders: null,
      requestsTotal: null,
      ordersTotal: null,
      profile: null,
      isFreshAccount: false,
      totalSpent: null,
      currency: appConfig.defaultCurrency,
      spendByMonth: null,
      recentActivity: null,
      errors: { summary: null, spend: null, activity: null },
    }

    if (!buyerId) return empty

    const [summary, spend, activity] = await Promise.all([
      section(() => loadSummary(buyerId)),
      section(() => loadSpend(buyerId, now)),
      section(() => loadActivity(buyerId)),
    ])

    return {
      ...empty,
      ...(summary.data ?? {}),
      // A brand-new buyer is one with nothing to show yet — the overview swaps
      // its stat band for the onboarding checklist. Unknown counts (the
      // section failed) are never treated as zero: an empty dashboard shown to
      // an established buyer because a request timed out would be a lie.
      isFreshAccount:
        summary.data?.requestsTotal === 0 && summary.data?.ordersTotal === 0,
      ...(spend.data ?? {}),
      recentActivity: activity.data,
      errors: { summary: summary.error, spend: spend.error, activity: activity.error },
    }
  },
})

export default buyerDashboardService
