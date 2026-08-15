// The creator dashboard overview — one composite read behind one function
// (`docs/api-contract.md` §7.1, operation 18).
//
// MOCK-AGGREGATE: there is no `GET /creator/overview`. Everything below is
// assembled in the browser from the collections JSON Server already serves, in
// exactly the shape `buyerDashboardService.getOverview` established for the
// buyer side (Prompt 15): count queries read for their `X-Total-Count`, a page
// of ledger rows folded into monthly totals, and the member's newest
// notifications. Laravel replaces the whole body with one cached request to
// `GET /creator/overview`; the return shape and this function's signature do
// not change.
//
// **Nothing here throws.** An overview is four independent widgets, and one
// slow collection must not blank the other three (Prompt 21 §13): the four
// sections load in parallel, each failure is captured in `errors`, and its
// fields resolve to `null` so the page can offer a retry on that card alone.

import dayjs from 'dayjs'

import { appConfig } from '@/config/appConfig'
import {
  CONTENT_STATUS,
  ORDER_STATUS,
  PROPOSAL_STATUS,
  REQUEST_STATUS,
  TRANSACTION_TYPE,
} from '@/constants/statuses'
import { sumMoney } from '@/utils/money'

import { toApiError } from './api/apiError'
import { creatorProfileService, getCreatorProfileCompleteness } from './creatorProfileService'
import { notificationService } from './notificationService'
import { orderService } from './orderService'
import { paymentService } from './paymentService'
import { portfolioService } from './portfolioService'
import { proposalService } from './proposalService'
import { requestService } from './requestService'

/** A count query: one row, read for its `total`. */
const COUNT_PARAMS = Object.freeze({ page: 1, limit: 1 })

/**
 * The provider's page ceiling (contract §4.1). It bounds the one read that
 * folds rows client-side — the creator's ledger — which is comfortably inside
 * it for any realistic account. The server-side version has no such limit.
 */
const FOLD_LIMIT = 100

/** Offers still in play: sent, or shortlisted but not yet decided. */
const ACTIVE_PROPOSAL_STATUSES = Object.freeze([
  PROPOSAL_STATUS.SUBMITTED,
  PROPOSAL_STATUS.SHORTLISTED,
])

/**
 * Orders still in flight — everything that is neither finished nor abandoned.
 * The same five statuses the buyer overview calls "active", so the two sides of
 * one engagement always agree about whether it is live.
 */
const ACTIVE_ORDER_STATUSES = Object.freeze([
  ORDER_STATUS.PENDING_PAYMENT,
  ORDER_STATUS.IN_PROGRESS,
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.REVISION_REQUESTED,
  ORDER_STATUS.DISPUTED,
])

/**
 * Portfolio work sitting with Trust & Safety rather than live on the storefront
 * (00 §9 — the moderation half of `CONTENT_STATUS`).
 */
const IN_REVIEW_CONTENT_STATUSES = Object.freeze([
  CONTENT_STATUS.SUBMITTED,
  CONTENT_STATUS.UNDER_REVIEW,
])

/**
 * Ledger rows that make up *earned* money: the escrow release and the negative
 * commission that pairs with it, which net to `order.creatorEarnings`. This is
 * the same rule `paymentService.getEarningsSummary` applies to the lifetime
 * figure, restated here so the chart and the tiles cannot disagree — payouts
 * and affiliate commission are movements of the balance, not earnings from
 * marketplace work, and are deliberately excluded.
 */
const EARNING_TYPES = new Set([TRANSACTION_TYPE.RELEASE, TRANSACTION_TYPE.COMMISSION])

/** Columns on the earnings chart, including the current (partial) month. */
export const EARNINGS_MONTHS = 6

/** Rows in the overview's activity feed. */
export const ACTIVITY_LIMIT = 8

/**
 * The last {@link EARNINGS_MONTHS} months, oldest first, as empty buckets.
 * `key` is `YYYY-MM` for matching, `label` is the short month name for the axis.
 */
function emptyEarningsMonths(now) {
  const thisMonth = dayjs(now).startOf('month')

  return Array.from({ length: EARNINGS_MONTHS }, (unused, index) => {
    const month = thisMonth.subtract(EARNINGS_MONTHS - 1 - index, 'month')
    return { key: month.format('YYYY-MM'), label: month.format('MMM'), amount: 0 }
  })
}

/**
 * Section 1 — the storefront itself, plus everything derived from it: how many
 * live briefs match what this creator does, and how finished the profile is.
 *
 * `openMatchingRequests` is the only figure that depends on another record
 * first: "matching" means *in one of the storefront's categories*, so the
 * categories have to be known before the count can be asked for. A creator who
 * has not chosen any yet skips the second request and gets `0` — which is
 * honest, and is precisely what the onboarding checklist is there to fix.
 */
async function loadProfile(creatorUserId, user) {
  const profile = await creatorProfileService.getByUserId(creatorUserId)
  const categories = profile?.categories ?? []

  const openMatchingRequests =
    categories.length === 0
      ? 0
      : (
          await requestService.list({
            ...COUNT_PARAMS,
            filters: { status: REQUEST_STATUS.OPEN, categoryId: [...categories] },
          })
        ).total

  return {
    profile,
    openMatchingRequests,
    profileCompleteness: getCreatorProfileCompleteness(profile, user),
  }
}

/** Section 2 — the two "how busy am I" counts, plus the onboarding inputs. */
async function loadPipeline(creatorUserId, creatorProfileId) {
  const [activeProposals, proposalsTotal, activeOrders, ordersTotal, published, inReview] =
    await Promise.all([
      proposalService.listByCreator(creatorUserId, {
        ...COUNT_PARAMS,
        filters: { status: [...ACTIVE_PROPOSAL_STATUSES] },
      }),
      proposalService.listByCreator(creatorUserId, COUNT_PARAMS),
      orderService.listByCreator(creatorUserId, {
        ...COUNT_PARAMS,
        filters: { status: [...ACTIVE_ORDER_STATUSES] },
      }),
      orderService.listByCreator(creatorUserId, COUNT_PARAMS),
      // Portfolio items hang off the **storefront** id, not the account id
      // (contract §6.5). A creator with no storefront yet has no portfolio
      // either, so both counts are zero without a request.
      creatorProfileId
        ? portfolioService.listByCreator(creatorProfileId, {
            ...COUNT_PARAMS,
            statuses: CONTENT_STATUS.PUBLISHED,
          })
        : { total: 0 },
      creatorProfileId
        ? portfolioService.listByCreator(creatorProfileId, {
            ...COUNT_PARAMS,
            statuses: [...IN_REVIEW_CONTENT_STATUSES],
          })
        : { total: 0 },
    ])

  return {
    activeProposals: activeProposals.total,
    proposalsTotal: proposalsTotal.total,
    activeOrders: activeOrders.total,
    ordersTotal: ordersTotal.total,
    portfolioCounts: { published: published.total, inReview: inReview.total },
  }
}

/**
 * Section 3 — the balances (straight from the payments service, so the figure
 * on this tile and the figure on the payout screen are literally the same
 * calculation) and the monthly series behind the chart.
 */
async function loadEarnings(creatorUserId, now) {
  const [earningsSummary, ledger] = await Promise.all([
    paymentService.getEarningsSummary(creatorUserId),
    paymentService.listTransactions({
      page: 1,
      limit: FOLD_LIMIT,
      filters: { userId: creatorUserId },
    }),
  ])

  const byMonth = emptyEarningsMonths(now)
  const bucketByKey = new Map(byMonth.map((bucket) => [bucket.key, bucket]))

  ledger.items
    .filter((row) => EARNING_TYPES.has(row.type))
    .forEach((row) => {
      const bucket = bucketByKey.get(dayjs(row.createdAt).format('YYYY-MM'))
      // `commission` rows are negative, so the release and its fee net to what
      // the creator actually earned that month.
      if (bucket) bucket.amount = sumMoney([bucket.amount, row.amount])
    })

  return { earningsSummary, earningsByMonth: byMonth, currency: earningsSummary.currency }
}

/** Section 4 — the newest notifications, rendered by `ActivityFeed`. */
async function loadActivity(creatorUserId) {
  const { items } = await notificationService.listByUser(creatorUserId, {
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
 * @typedef {object} CreatorOverview
 * @property {object|null} profile the creator's storefront, or `null`
 * @property {number|null} openMatchingRequests live briefs in this creator's categories
 * @property {number|null} activeProposals offers sent or shortlisted, undecided
 * @property {number|null} activeOrders orders in flight
 * @property {number|null} proposalsTotal every offer this creator has ever sent
 * @property {number|null} ordersTotal every order this creator has ever had
 * @property {object|null} earningsSummary `paymentService.getEarningsSummary`
 * @property {Array<{key: string, label: string, amount: number}>|null} earningsByMonth
 *   six buckets, oldest first, including the current partial month
 * @property {string} currency ISO 4217 code for every money figure here
 * @property {Array<object>|null} recentActivity newest notifications, newest first
 * @property {{percent: number, completed: number, total: number, missing: Array}|null} profileCompleteness
 * @property {{published: number, inReview: number}|null} portfolioCounts
 * @property {boolean} isFreshAccount no proposals and no orders — show onboarding
 * @property {{profile: ApiError|null, pipeline: ApiError|null, earnings: ApiError|null,
 *   activity: ApiError|null}} errors which sections failed — each maps to one
 *   retryable card
 */

export const creatorDashboardService = Object.freeze({
  /**
   * Everything the creator overview renders, in four parallel section loads.
   *
   * The storefront is fetched first because two of the other figures are scoped
   * by it — the matching-brief count needs its categories, the portfolio counts
   * need its id — so the pipeline section starts as soon as that one resolves
   * rather than waiting on the whole overview.
   *
   * **Future endpoint:** `GET /creator/overview` (contract §7.1 operation 18) —
   * one authenticated request returning this exact object for the signed-in
   * creator, with the counts and the earnings series computed in SQL. The mock
   * version derives the same figures from up to eleven REST calls; the creator
   * id is a parameter here only because the mock stack has no session to read
   * it from, and Laravel takes it from the bearer token instead.
   *
   * @param {string} creatorUserId `usr_…` — the **account** id, not `cpr_…`
   * @param {object} [options]
   * @param {object} [options.user] the signed-in `users` record. Passed in
   *   rather than fetched: the session already holds it, and `avatarUrl` is the
   *   one completeness field that lives there. Omit it and the profile photo
   *   simply counts as missing.
   * @param {Date|string} [options.now] injectable clock for the month buckets
   * @returns {Promise<CreatorOverview>} never rejects — see `errors`
   */
  async getOverview(creatorUserId, { user, now } = {}) {
    const empty = {
      profile: null,
      openMatchingRequests: null,
      activeProposals: null,
      activeOrders: null,
      proposalsTotal: null,
      ordersTotal: null,
      earningsSummary: null,
      earningsByMonth: null,
      currency: appConfig.defaultCurrency,
      recentActivity: null,
      profileCompleteness: null,
      portfolioCounts: null,
      isFreshAccount: false,
      errors: { profile: null, pipeline: null, earnings: null, activity: null },
    }

    if (!creatorUserId) return empty

    const profileSection = section(() => loadProfile(creatorUserId, user))

    const [profileResult, pipeline, earnings, activity] = await Promise.all([
      profileSection,
      // Chained on the storefront rather than run beside it, because the
      // portfolio counts are keyed by `cpr_…`. When the storefront read failed
      // there is no id to scope them by, so this section reports the same
      // failure rather than inventing zeroes.
      profileSection.then((result) =>
        section(() => loadPipeline(creatorUserId, result.data?.profile?.id))
      ),
      section(() => loadEarnings(creatorUserId, now)),
      section(() => loadActivity(creatorUserId)),
    ])

    return {
      ...empty,
      ...(profileResult.data ?? {}),
      ...(pipeline.data ?? {}),
      ...(earnings.data ?? {}),
      // A brand-new creator is one who has never offered on anything and never
      // been awarded work — the overview swaps its stat band for the onboarding
      // checklist. Unknown counts (the section failed) are never treated as
      // zero: an empty dashboard shown to an established creator because a
      // request timed out would be a lie.
      isFreshAccount: pipeline.data?.proposalsTotal === 0 && pipeline.data?.ordersTotal === 0,
      recentActivity: activity.data,
      errors: {
        profile: profileResult.error,
        pipeline: pipeline.error,
        earnings: earnings.error,
        activity: activity.error,
      },
    }
  },
})

export default creatorDashboardService
