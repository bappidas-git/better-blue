// Admin console aggregates — `docs/api-contract.md` §7.1, operations 24 and 25.
//
// MOCK-AGGREGATE: there is no `GET /admin/overview` and no `GET /admin/attention`.
// Every figure below is assembled in the browser from the collections JSON
// Server already serves — count queries read for their `X-Total-Count` (one row
// fetched, the header trusted), and three folds over a bounded page of rows.
// Laravel replaces each body with **one** cached request that does the same work
// in SQL; the function signatures do not change (00 §10, §15).
//
// Two rules this module exists to enforce (Prompt 28 §7):
//
//   1. **No admin page fetches a raw collection for a statistic.** If a screen
//      needs a number, it needs a function here — that is the only way the
//      derivation of a headline figure stays in one reviewable place, and the
//      only way the Laravel swap stays a swap.
//   2. **Nothing here throws.** An overview is a wall of independent widgets,
//      and one slow collection must not blank the other nine (§13). Each metric
//      loads in its own section, each failure is captured in `errors`, and its
//      field resolves to `null` so the page can offer a retry on that card
//      alone. `null` is never rendered as zero: "no disputes" and "we could not
//      count the disputes" are different sentences.
//
// Every metric's derivation is stated in JSDoc as a formula plus the query it
// becomes on the server. Where a figure is reconcilable against `server/db.json`
// by hand, the JSDoc says how — that is what makes the seed a test.

import dayjs from 'dayjs'

import { appConfig } from '@/config/appConfig'
import { ORDER_STATUS, PAYOUT_STATUS, TRANSACTION_TYPE } from '@/constants/statuses'
import { sumMoney } from '@/utils/money'

import { toApiError } from './api/apiError'
import { SORT_ORDER } from './api/listAdapter'
import { auditService } from './auditService'
import { categoryService } from './categoryService'
import { ACTIVE_DISPUTE_STATUSES, disputeService } from './disputeService'
import { moderationService } from './moderationService'
import { orderService } from './orderService'
import { paymentService } from './paymentService'
import { payoutService } from './payoutService'
import { userService } from './userService'

/** A count query: one row fetched, read for its `total` (never for its item). */
const COUNT_PARAMS = Object.freeze({ page: 1, limit: 1 })

/**
 * The provider's page ceiling (contract §4.1). It bounds the three reads that
 * fold rows client-side — this month's charges, six months of commissions, and
 * six months of orders. All three are comfortably inside it for the seeded
 * marketplace; the server-side version aggregates in SQL and has no such limit.
 *
 * MOCK-LIMIT: on a real marketplace these folds would silently truncate. That
 * is exactly why operations 24/25 exist as endpoints rather than as a habit.
 */
const FOLD_LIMIT = 100

/** Columns on the "Orders per week" chart, including the current part-week. */
export const OVERVIEW_WEEKS = 8

/** Columns on the "Commission revenue by month" chart, including this month. */
export const OVERVIEW_MONTHS = 6

/** Slices on the category donut — the rest are folded into "Other". */
export const CATEGORY_SLICES = 6

/** Rows per attention queue (§4.3: three items and a "view all"). */
export const ATTENTION_LIMIT = 3

/** Rows in the overview's audit activity feed. */
export const AUDIT_FEED_LIMIT = 8

/** How far back "new this week" reaches. */
const NEW_USER_WINDOW_DAYS = 7

/** Orders still in flight — neither finished nor abandoned (mirrors 00 §9). */
const ACTIVE_ORDER_STATUSES = Object.freeze([
  ORDER_STATUS.PENDING_PAYMENT,
  ORDER_STATUS.IN_PROGRESS,
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.REVISION_REQUESTED,
  ORDER_STATUS.DISPUTED,
])

/**
 * Orders whose next move is the creator's — the only two states where a missed
 * `deliveryDueAt` means somebody is actually late. A `delivered` order past its
 * date is waiting on the *buyer*, and a `disputed` one is waiting on us.
 */
const OVERDUE_ORDER_STATUSES = Object.freeze([
  ORDER_STATUS.IN_PROGRESS,
  ORDER_STATUS.REVISION_REQUESTED,
])

/** Runs one widget's load and reports its failure rather than rejecting with it. */
async function section(load) {
  try {
    return { data: await load(), error: null }
  } catch (failure) {
    return { data: null, error: toApiError(failure) }
  }
}

/**
 * The last {@link OVERVIEW_MONTHS} months, oldest first, as empty buckets.
 * `key` is `YYYY-MM` for matching, `label` the short month name for the axis.
 */
function emptyMonths(now) {
  const thisMonth = dayjs(now).startOf('month')

  return Array.from({ length: OVERVIEW_MONTHS }, (unused, index) => {
    const month = thisMonth.subtract(OVERVIEW_MONTHS - 1 - index, 'month')
    return { key: month.format('YYYY-MM'), label: month.format('MMM'), amount: 0 }
  })
}

/**
 * The last {@link OVERVIEW_WEEKS} weeks, oldest first, as empty buckets.
 *
 * Weeks start on Monday (`dayjs().startOf('week')` is locale-Sunday, so the
 * boundary is computed from the ISO day number instead) and the final bucket is
 * the current, partial week — the same "including today" convention the monthly
 * charts use, so no dashboard on the platform draws a different last column.
 */
function emptyWeeks(now) {
  const thisWeek = startOfWeek(now)

  return Array.from({ length: OVERVIEW_WEEKS }, (unused, index) => {
    const week = thisWeek.subtract(OVERVIEW_WEEKS - 1 - index, 'week')
    return { key: week.format('YYYY-MM-DD'), label: week.format('D MMM'), orders: 0 }
  })
}

/** Monday 00:00 of the week containing `value`, as a dayjs. */
function startOfWeek(value) {
  const day = dayjs(value).startOf('day')
  // `day()` is 0–6 with Sunday at 0; Monday-based offset puts Sunday six days in.
  const offset = (day.day() + 6) % 7
  return day.subtract(offset, 'day')
}

/* -------------------------------------------------------------------------- */
/* Metric loaders — one per widget, each its own failure boundary              */
/* -------------------------------------------------------------------------- */

/**
 * **GMV this month** = Σ |amount| over `transactions` where `type = 'charge'`
 * and `createdAt ≥ start of the current month.
 *
 * Gross merchandise value is what buyers *committed* — the escrow charge — not
 * what has since been released, refunded, or is still held. Charge rows are
 * signed negative (money leaving the buyer, contract §6.13), so they are summed
 * as absolutes.
 *
 * **Reconcile:** filter `db.transactions` to `type === 'charge'` and a
 * `createdAt` in the current month, then sum `Math.abs(amount)`.
 *
 * **Laravel:** `SELECT SUM(ABS(amount)) FROM transactions WHERE type = 'charge'
 * AND created_at >= ?` inside `GET /admin/overview`.
 */
async function loadGmv(now) {
  const monthStart = dayjs(now).startOf('month').toISOString()
  const { items } = await paymentService.listTransactions({
    page: 1,
    limit: FOLD_LIMIT,
    filters: { type: TRANSACTION_TYPE.CHARGE, createdAt_gte: monthStart },
  })

  return {
    gmvThisMonth: sumMoney(items.map((row) => Math.abs(Number(row.amount) || 0))),
    currency: items[0]?.currency ?? appConfig.defaultCurrency,
  }
}

/**
 * **Commission revenue** — BetterBlue's own earnings, from the `commissions`
 * collection rather than from the ledger, because there is exactly one
 * commission row per released order (contract §6.14) and it is the record the
 * finance screens reconcile against.
 *
 * - `revenueByMonth` = Σ `amount` grouped by `createdAt` month, six buckets,
 *   oldest first, zero-filled.
 * - `commissionRevenueThisMonth` = the last bucket — folded from the *same*
 *   rows, so the headline figure and the final bar can never disagree.
 *
 * A commission is dated when the escrow was released, not when the order was
 * placed: revenue is recognised on settlement.
 *
 * **Reconcile:** group `db.commissions` by `createdAt.slice(0, 7)` and sum
 * `amount`.
 *
 * **Laravel:** `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, SUM(amount)
 * FROM commissions WHERE created_at >= ? GROUP BY month`.
 */
async function loadCommissionRevenue(now) {
  const windowStart = dayjs(now)
    .startOf('month')
    .subtract(OVERVIEW_MONTHS - 1, 'month')
    .toISOString()

  const { items } = await paymentService.listCommissions({
    page: 1,
    limit: FOLD_LIMIT,
    filters: { createdAt_gte: windowStart },
  })

  const buckets = emptyMonths(now)
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]))

  items.forEach((commission) => {
    const bucket = byKey.get(dayjs(commission.createdAt).format('YYYY-MM'))
    if (bucket) bucket.amount = sumMoney([bucket.amount, commission.amount ?? 0])
  })

  return {
    revenueByMonth: buckets,
    commissionRevenueThisMonth: buckets[buckets.length - 1]?.amount ?? 0,
  }
}

/**
 * **Order volume and mix**, folded from one bounded page of orders so the two
 * charts are drawn from identical rows.
 *
 * - `ordersByWeek` = COUNT(orders) grouped by the Monday of `createdAt`, eight
 *   buckets, oldest first, zero-filled. Counts *placed* orders — an order is
 *   marketplace activity from the moment it exists, whether or not it was ever
 *   funded.
 * - `categoryDistribution` = COUNT(orders) grouped by `categoryId` over the same
 *   six-month window, largest first, capped at {@link CATEGORY_SLICES} slices
 *   with the remainder folded into a single "Other" row so the donut always
 *   totals the window.
 *
 * Category names come from `categoryService.listActive()` (cached); a category
 * that has been deactivated since an order was placed still has orders, so an
 * unresolved id falls back to a readable placeholder rather than vanishing.
 *
 * **Reconcile:** count `db.orders` by ISO week of `createdAt`, and by
 * `categoryId`.
 *
 * **Laravel:** two `GROUP BY`s — `YEARWEEK(created_at)` and `category_id` — over
 * the same windowed subquery.
 */
async function loadOrderSeries(now) {
  const windowStart = dayjs(now)
    .startOf('month')
    .subtract(OVERVIEW_MONTHS - 1, 'month')
    .toISOString()

  const [{ items }, categories] = await Promise.all([
    orderService.list({
      page: 1,
      limit: FOLD_LIMIT,
      filters: { createdAt_gte: windowStart },
    }),
    // A missing category list costs the donut its labels, not its data.
    categoryService.listActive().catch(() => []),
  ])

  const weeks = emptyWeeks(now)
  const byWeek = new Map(weeks.map((bucket) => [bucket.key, bucket]))
  items.forEach((order) => {
    const bucket = byWeek.get(startOfWeek(order.createdAt).format('YYYY-MM-DD'))
    if (bucket) bucket.orders += 1
  })

  const nameById = new Map(categories.map((category) => [category.id, category.name]))
  const counts = new Map()
  items.forEach((order) => {
    const id = order.categoryId ?? 'unknown'
    counts.set(id, (counts.get(id) ?? 0) + 1)
  })

  const ranked = [...counts.entries()]
    .map(([id, value]) => ({ id, name: nameById.get(id) ?? 'Uncategorised', value }))
    .sort((a, b) => b.value - a.value)

  const top = ranked.slice(0, CATEGORY_SLICES)
  const rest = ranked.slice(CATEGORY_SLICES)
  const categoryDistribution =
    rest.length > 0
      ? [...top, { id: 'other', name: 'Other', value: rest.reduce((sum, row) => sum + row.value, 0) }]
      : top

  return { ordersByWeek: weeks, categoryDistribution }
}

/**
 * **Active orders** = COUNT(orders) whose status is one of
 * `pending_payment`, `in_progress`, `delivered`, `revision_requested`,
 * `disputed` — every engagement the marketplace is still carrying.
 *
 * **Reconcile:** count `db.orders` outside `completed`/`cancelled`/`refunded`.
 *
 * **Laravel:** `SELECT COUNT(*) FROM orders WHERE status IN (…)`.
 */
async function loadActiveOrders() {
  const { total } = await orderService.list({
    ...COUNT_PARAMS,
    filters: { status: [...ACTIVE_ORDER_STATUSES] },
  })
  return total
}

/**
 * **New members this week** = COUNT(users) where
 * `createdAt ≥ now − {@link NEW_USER_WINDOW_DAYS} days`. Every role, admins
 * included: this is platform growth, not a supply/demand split.
 *
 * **Laravel:** `SELECT COUNT(*) FROM users WHERE created_at >= ?`.
 */
async function loadNewUsers(now) {
  const since = dayjs(now).subtract(NEW_USER_WINDOW_DAYS, 'day').toISOString()
  const { total } = await userService.list({
    ...COUNT_PARAMS,
    filters: { createdAt_gte: since },
  })
  return total
}

/**
 * **Open disputes** = COUNT(disputes) in `ACTIVE_DISPUTE_STATUSES` — `open`,
 * `under_review`, `awaiting_buyer`, `awaiting_creator`, `escalated`. The set is
 * imported from `disputeService` rather than re-listed, so the number here and
 * the "one open dispute per order" rule can never drift apart.
 *
 * **Reconcile:** count `db.disputes` outside `resolved`/`closed`.
 *
 * **Laravel:** `SELECT COUNT(*) FROM disputes WHERE status IN (…)`.
 */
async function loadOpenDisputes() {
  const { total } = await disputeService.list({
    ...COUNT_PARAMS,
    filters: { status: [...ACTIVE_DISPUTE_STATUSES] },
  })
  return total
}

/**
 * **Moderation queue** = COUNT(moderationReviews) in `submitted` or
 * `under_review` — the undecided cases, which is exactly what
 * `moderationService.listQueue` selects.
 *
 * **Reconcile:** count `db.moderationReviews` with those two statuses.
 *
 * **Laravel:** `SELECT COUNT(*) FROM moderation_reviews WHERE status IN (…)`.
 */
async function loadModerationQueue() {
  const { total } = await moderationService.listQueue(COUNT_PARAMS)
  return total
}

/**
 * **Pending settlements** = COUNT(payouts) with status `requested` — creator
 * withdrawals nobody has picked up yet. `processing` is deliberately excluded:
 * it is already somebody's job, so counting it would inflate a queue depth.
 *
 * **Laravel:** `SELECT COUNT(*) FROM payouts WHERE status = 'requested'`.
 */
async function loadPendingSettlements() {
  const { total } = await payoutService.list({
    ...COUNT_PARAMS,
    filters: { status: PAYOUT_STATUS.REQUESTED },
  })
  return total
}

/* -------------------------------------------------------------------------- */
/* Attention queues                                                           */
/* -------------------------------------------------------------------------- */

/** The oldest undecided disputes, with the order each one is about. */
async function loadOldestDisputes(limit) {
  const { items } = await disputeService.list({
    page: 1,
    limit,
    sort: 'createdAt',
    order: SORT_ORDER.ASC,
    filters: { status: [...ACTIVE_DISPUTE_STATUSES] },
  })

  // One extra round trip buys every row a name a human recognises — "Tasting
  // menu stills" rather than `ord_047` (§12). `listByIds` answers with a
  // `Map` keyed by id (unlike `userService`'s, which answers with an array).
  const orderById = await orderService
    .listByIds(items.map((dispute) => dispute.orderId))
    .catch(() => new Map())

  return items.map((dispute) => ({
    ...dispute,
    orderTitle: orderById.get(dispute.orderId)?.title ?? null,
  }))
}

/** The oldest undecided moderation cases, with the creator who submitted them. */
async function loadOldestModeration(limit) {
  // `listQueue` is already oldest-first — that is the order a reviewer works.
  const { items } = await moderationService.listQueue({ page: 1, limit })

  const creators = await userService
    .listByIds(items.map((review) => review.creatorId))
    .catch(() => [])
  const nameById = new Map(creators.map((user) => [user.id, user.name]))

  return items.map((review) => ({ ...review, creatorName: nameById.get(review.creatorId) ?? null }))
}

/**
 * Orders past their delivery date that have not been delivered — longest
 * overdue first, so the worst case is the first thing read.
 */
async function loadOverdueOrders(limit, now) {
  const { items } = await orderService.list({
    page: 1,
    limit,
    sort: 'deliveryDueAt',
    order: SORT_ORDER.ASC,
    filters: {
      status: [...OVERDUE_ORDER_STATUSES],
      deliveryDueAt_lte: dayjs(now).toISOString(),
    },
  })
  return items
}

/* -------------------------------------------------------------------------- */
/* Service                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * @typedef {object} AdminOverviewStats
 * @property {string} currency ISO 4217 code for every money field
 * @property {number|null} gmvThisMonth escrow charged this calendar month
 * @property {number|null} commissionRevenueThisMonth BetterBlue's fee this month
 * @property {number|null} activeOrders engagements still in flight
 * @property {number|null} newUsersThisWeek accounts created in the last 7 days
 * @property {number|null} openDisputes cases neither resolved nor closed
 * @property {number|null} moderationQueueSize undecided Trust & Safety cases
 * @property {number|null} pendingSettlements payout requests nobody has picked up
 * @property {Array<{key: string, label: string, orders: number}>|null} ordersByWeek
 *   eight buckets, oldest first, including the current part-week
 * @property {Array<{key: string, label: string, amount: number}>|null} revenueByMonth
 *   six buckets, oldest first, including the current part-month
 * @property {Array<{id: string, name: string, value: number}>|null} categoryDistribution
 *   orders per category, largest first, capped with an "Other" remainder
 * @property {Object<string, ApiError|null>} errors which widgets failed — one
 *   key per card, each mapping to its own retry
 */

/**
 * @typedef {object} AdminAttentionQueues
 * @property {Array<object>|null} oldestOpenDisputes disputes, oldest first, each
 *   carrying `orderTitle`
 * @property {Array<object>|null} oldestModerationItems moderation cases, oldest
 *   first, each carrying `creatorName`
 * @property {Array<object>|null} overdueOrders undelivered orders past their
 *   delivery date, longest overdue first
 * @property {{disputes: ApiError|null, moderation: ApiError|null, orders: ApiError|null}} errors
 */

export const adminService = Object.freeze({
  /**
   * Every number the admin overview prints, in ten parallel section loads.
   *
   * **Future endpoint:** `GET /admin/overview` (contract §7.1 operation 24) —
   * one authenticated request returning this exact object, computed in SQL and
   * cached briefly for the whole admin team. Requires no single permission: the
   * console's landing screen is visible to anyone who can reach `/admin`, and
   * the figures behind each card are already aggregates rather than records.
   *
   * @param {object} [options]
   * @param {Date|string} [options.now] injectable clock for the buckets and the
   *   "this month" / "this week" boundaries
   * @returns {Promise<AdminOverviewStats>} never rejects — see `errors`
   */
  async getOverviewStats({ now } = {}) {
    const [
      gmv,
      commission,
      series,
      activeOrders,
      newUsers,
      openDisputes,
      moderationQueue,
      pendingSettlements,
    ] = await Promise.all([
      section(() => loadGmv(now)),
      section(() => loadCommissionRevenue(now)),
      section(() => loadOrderSeries(now)),
      section(loadActiveOrders),
      section(() => loadNewUsers(now)),
      section(loadOpenDisputes),
      section(loadModerationQueue),
      section(loadPendingSettlements),
    ])

    return {
      currency: gmv.data?.currency ?? appConfig.defaultCurrency,
      gmvThisMonth: gmv.data?.gmvThisMonth ?? null,
      commissionRevenueThisMonth: commission.data?.commissionRevenueThisMonth ?? null,
      revenueByMonth: commission.data?.revenueByMonth ?? null,
      ordersByWeek: series.data?.ordersByWeek ?? null,
      categoryDistribution: series.data?.categoryDistribution ?? null,
      activeOrders: activeOrders.data ?? null,
      newUsersThisWeek: newUsers.data ?? null,
      openDisputes: openDisputes.data ?? null,
      moderationQueueSize: moderationQueue.data ?? null,
      pendingSettlements: pendingSettlements.data ?? null,
      errors: {
        gmv: gmv.error,
        // One section, two widgets: the headline figure is the last bar of the
        // chart beside it, so they fail and retry together by construction.
        commission: commission.error,
        series: series.error,
        activeOrders: activeOrders.error,
        newUsers: newUsers.error,
        openDisputes: openDisputes.error,
        moderationQueue: moderationQueue.error,
        pendingSettlements: pendingSettlements.error,
      },
    }
  },

  /**
   * The three queues the console exists to keep empty — the oldest item in each
   * is the one the platform has kept somebody waiting on longest.
   *
   * **Future endpoint:** `GET /admin/attention?limit=3` (contract §7.1
   * operation 25) — three `ORDER BY … ASC LIMIT 3` reads with their joins,
   * returned together.
   *
   * @param {object} [options]
   * @param {number} [options.limit=3] rows per queue
   * @param {Date|string} [options.now] injectable clock for "overdue"
   * @returns {Promise<AdminAttentionQueues>} never rejects — see `errors`
   */
  async getAttentionQueues({ limit = ATTENTION_LIMIT, now } = {}) {
    const [disputes, moderation, orders] = await Promise.all([
      section(() => loadOldestDisputes(limit)),
      section(() => loadOldestModeration(limit)),
      section(() => loadOverdueOrders(limit, now)),
    ])

    return {
      oldestOpenDisputes: disputes.data,
      oldestModerationItems: moderation.data,
      overdueOrders: orders.data,
      errors: { disputes: disputes.error, moderation: moderation.error, orders: orders.error },
    }
  },

  /**
   * The newest entries in the administrative audit trail, with the acting team
   * member resolved to a name — the overview's activity feed.
   *
   * It lives here rather than in the page for the reason at the top of this
   * file: a screen that reads `auditLogs` directly to render a feed is one
   * refactor away from reading it to compute a number.
   *
   * **Future endpoint:** part of `GET /admin/overview` (contract §7.1
   * operation 24) — the same eight rows with the actor eager-loaded. Gated on
   * `audit.view` there; the mock stack cannot enforce it (§9.1).
   *
   * @param {object} [options]
   * @param {number} [options.limit=8] rows to return
   * @returns {Promise<Array<object>>} newest first, each row carrying `actorName`
   */
  async getRecentAuditActivity({ limit = AUDIT_FEED_LIMIT } = {}) {
    const { items } = await auditService.list({ page: 1, limit })

    const actors = await userService.listByIds(items.map((entry) => entry.actorId)).catch(() => [])
    const nameById = new Map(actors.map((user) => [user.id, user.name]))

    return items.map((entry) => ({ ...entry, actorName: nameById.get(entry.actorId) ?? null }))
  },
})

export default adminService
