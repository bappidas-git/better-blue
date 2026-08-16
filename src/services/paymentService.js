// Escrow payments and the ledger — `docs/api-contract.md` §6.12, §6.13, §7
// operations 2–4 and 11. The architecture is documented end to end in
// `docs/payments.md`; this file is that document in code.
//
// Three rules hold everything together:
//
// 1. **The provider is invisible above this file.** `services/payments/` is
//    imported here and nowhere else (Prompt 17 §7). Features see payment
//    records, never charges, references, or card numbers.
// 2. **One money movement = exactly one `transactions` row.** Every write goes
//    through `writeTransaction`, and every description comes from
//    `constants/transactionTemplates.js`.
// 3. **Every amount goes through `utils/money.js`.** No `*`, `+`, or `-` on
//    money outside those helpers.
//
// MOCK-ATOMICITY: each workflow below is a sequence of REST calls with no
// transaction around it (contract §7). They are ordered so the least damaging
// thing happens first — provider → payment → order → ledger → notifications —
// and a failure after the money moved throws a deliberately loud `server_error`
// naming what was written and what was not. Laravel wraps the whole sequence in
// `DB::transaction()` and this paragraph goes away.

import dayjs from 'dayjs'

import { appConfig } from '@/config/appConfig'
import { AUDIT_ACTION } from '@/constants/auditActions'
import { NOTIFICATION_TYPE } from '@/constants/notificationTypes'
import { PERMISSIONS } from '@/constants/permissions'
import { isAdminRole } from '@/constants/roles'
import {
  ORDER_STATUS_MACHINE,
  PAYMENT_STATUS_MACHINE,
  PAYOUT_STATUS_MACHINE,
} from '@/constants/stateMachines'
import {
  ORDER_STATUS,
  PAYMENT_STATUS,
  PAYOUT_SOURCE,
  PAYOUT_STATUS,
  payoutSourceOf,
  TRANSACTION_TYPE,
} from '@/constants/statuses'
import {
  REFUND_CONTEXT,
  transactionDescription,
} from '@/constants/transactionTemplates'
import { formatCurrency } from '@/utils/formatters'
import { ID_PREFIX } from '@/utils/id'
import {
  applyRate,
  round2,
  subtractMoney,
  sumMoney,
  toAmount,
} from '@/utils/money'
import { assertTransition } from '@/utils/stateMachine'

// Prompt 34: the AFFILIATE-HOOK in `settleEscrow` and the settlement of an
// affiliate-sourced payout in `markPayoutPaid`. `affiliateService` imports
// `payoutService` but never this module, so the graph stays acyclic — and both
// entry points are documented to resolve rather than throw, which is what lets
// them sit inside a money path at all.
import { affiliateService } from './affiliateService'
import { API_ERROR_CODE, createApiError } from './api/apiError'
import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'
import { auditService } from './auditService'
import { creatorProfileService } from './creatorProfileService'
// CYCLE (Prompt 32): the escrow monitor flags a held payment whose order is
// contested, and `disputeService` reaches back here through `orderService`. The
// harmless shape that pair already has — nothing is dereferenced at evaluation
// time, only inside function bodies. Imported rather than re-declared because
// "which dispute statuses are live" is a rule with one home (§4.2).
import { ACTIVE_DISPUTE_STATUSES, disputeService } from './disputeService'
import { notificationService } from './notificationService'
import { getPaymentProvider } from './payments'
import { payoutService } from './payoutService'
import { settingsService, SETTINGS_FALLBACK } from './settingsService'
// CYCLE (Prompt 32): `userService` imports this module for a member's money
// aggregates, and the admin finance reads below call back for the names behind
// a ledger row. The harmless shape `disputeService`/`orderService` already
// have — neither module touches the other at evaluation time, and both
// dereference only inside function bodies. It is imported rather than replaced
// by a raw collection handle because `listByIds` strips credentials, and an
// admin table is exactly where that must not be re-derived by hand.
import { userService } from './userService'

const payments = createCrudService('payments', { idPrefix: ID_PREFIX.PAYMENT })
const transactions = createCrudService('transactions', { idPrefix: ID_PREFIX.TRANSACTION })
const commissions = createCrudService('commissions', { idPrefix: ID_PREFIX.COMMISSION })

// The escrow workflow reads and moves the order it is funding, and
// `orderService` already imports *this* service — so it keeps its own handle on
// the collection rather than importing back and making the services graph
// cyclic. `orders.status` is only ever moved here through `assertTransition`,
// exactly as it is there (contract §6.9).
const orders = createCrudService('orders', { idPrefix: ID_PREFIX.ORDER })

/** Provider page ceiling (contract §4.1) — bounds the folds below. */
const FOLD_LIMIT = 100

/**
 * Payment states that mean money was actually taken for an order, and it must
 * not be charged again.
 *
 * `processing` is deliberately **not** here: an attempt whose tab was closed
 * mid-charge would otherwise strand the order forever, and the seeded checkout
 * scenario (`ord_001`) carries exactly that — a failed attempt plus a
 * `processing` retry (contract §7 operation 2). Retrying leaves the stale row
 * where it is. Laravel prevents the genuine double charge with the idempotency
 * key from contract §1.8, which the mock stack has no way to honour.
 */
const LIVE_PAYMENT_STATUSES = Object.freeze([
  PAYMENT_STATUS.HELD,
  PAYMENT_STATUS.RELEASED,
  PAYMENT_STATUS.REFUNDED,
  PAYMENT_STATUS.PARTIALLY_REFUNDED,
])

/** Order states in which the buyer's money is sitting in escrow. */
const ESCROW_HELD_ORDER_STATUSES = Object.freeze([
  ORDER_STATUS.IN_PROGRESS,
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.REVISION_REQUESTED,
  ORDER_STATUS.DISPUTED,
])

/** Payout states that have already reserved part of the balance. */
const PENDING_PAYOUT_STATUSES = Object.freeze([
  PAYOUT_STATUS.REQUESTED,
  PAYOUT_STATUS.PROCESSING,
])

/**
 * Ledger types that move a **BetterBlue balance** and therefore carry a
 * `balanceAfter` (contract §6.13). A buyer's `charge` settles against their
 * card and holds no balance, so its `balanceAfter` is `null`.
 */
const BALANCE_BEARING_TYPES = new Set([
  TRANSACTION_TYPE.RELEASE,
  TRANSACTION_TYPE.COMMISSION,
  TRANSACTION_TYPE.PAYOUT,
  TRANSACTION_TYPE.AFFILIATE_COMMISSION,
])

/** Ledger types that make up a creator's lifetime earnings. */
const EARNING_TYPES = new Set([TRANSACTION_TYPE.RELEASE, TRANSACTION_TYPE.COMMISSION])

/** Ledger types that return money to a buyer — one figure on the finance summary. */
const REFUND_TYPES = new Set([TRANSACTION_TYPE.REFUND, TRANSACTION_TYPE.PARTIAL_REFUND])

/**
 * Columns on the admin finance summary — six months including the current
 * partial one, matching `adminService.OVERVIEW_MONTHS` so the console's two
 * revenue charts cover the same window.
 */
export const FINANCE_SUMMARY_MONTHS = 6

/**
 * How long escrow has been sitting, in days, as the buckets the escrow monitor
 * legends and groups by (Prompt 32 §4.2). Open-ended at the top: `maxDays` of
 * `null` means "and everything older".
 *
 * Held money is not a queue anybody works, so these are not an SLA — they are a
 * shape. A marketplace whose escrow is mostly in the first bucket is settling
 * work; one whose escrow is mostly in the last has orders nobody is finishing.
 */
export const ESCROW_AGING_BUCKETS = Object.freeze([
  Object.freeze({ key: 'fresh', label: '0–7 days', minDays: 0, maxDays: 7 }),
  Object.freeze({ key: 'week', label: '8–14 days', minDays: 8, maxDays: 14 }),
  Object.freeze({ key: 'fortnight', label: '15–30 days', minDays: 15, maxDays: 30 }),
  Object.freeze({ key: 'stale', label: 'Over 30 days', minDays: 31, maxDays: null }),
])

/** Payout states an admin can still act on, oldest-first in the queue. */
const ACTIONABLE_PAYOUT_STATUSES = Object.freeze([
  PAYOUT_STATUS.REQUESTED,
  PAYOUT_STATUS.PROCESSING,
])

/**
 * Columns on the earnings screen's chart — a full trailing year, including the
 * current partial month (Prompt 25 §4.2). The creator overview's own chart is
 * six (`creatorDashboardService.EARNINGS_MONTHS`); this one is the financial
 * centre and shows the whole year the accountant asks about.
 */
export const EARNINGS_BREAKDOWN_MONTHS = 12

/**
 * Orders that carry money for a creator: the four in which escrow is held, plus
 * the completed ones whose escrow has been released. `pending_payment`,
 * `cancelled`, and `refunded` are deliberately absent — nothing is, or ever
 * will be, owed to the creator on them.
 */
const EARNING_ORDER_STATUSES = Object.freeze([
  ...ESCROW_HELD_ORDER_STATUSES,
  ORDER_STATUS.COMPLETED,
])

const nowIso = () => new Date().toISOString()

/** `conflict` is the contract's code for "not in the right state" (§3.2). */
const invalidState = (message, details) =>
  createApiError(API_ERROR_CODE.CONFLICT, message, details, 409)

/**
 * Runs a status change through its machine and reports a rejection the way the
 * contract does: `409 conflict` with `details: { from, to }` (§8.1).
 * `assertTransition` throws a plain `Error`, so it is mapped here rather than
 * leaking a non-`ApiError` out of the services layer.
 */
function transitionTo(machine, from, to, message) {
  try {
    return assertTransition(machine, from, to)
  } catch (failure) {
    throw invalidState(message, { from, to, transition: failure.message })
  }
}

/**
 * Thrown when a sequence fails **after** money moved. There is no rollback in
 * the mock stack (contract §7), so the error names exactly what was written:
 * silently swallowing it is how a payment ends up `held` against an order that
 * never started.
 */
function inconsistency(step, done, cause) {
  return createApiError(
    API_ERROR_CODE.SERVER_ERROR,
    `The payment was taken but ${step} did not complete. ` +
      'Support needs to reconcile this order by hand — nothing was rolled back.',
    { step, completed: done, cause: cause?.message }
  )
}

/**
 * Card metadata that may be stored: a brand and a masked tail, never a full
 * number (contract §9.4). The number is handed to the provider and dropped.
 */
function storableMethod(method) {
  const digits = String(method?.number ?? '').replace(/\D/g, '')
  return {
    brand: method?.brand ?? 'card',
    last4: String(method?.last4 ?? digits.slice(-4)),
  }
}

/** ISO timestamp `days` after `iso` — the delivery clock starts at funding. */
function addDaysIso(iso, days) {
  const start = Date.parse(iso)
  const count = Number(days)
  if (!Number.isFinite(start) || !Number.isFinite(count)) return null
  return new Date(start + count * 24 * 60 * 60 * 1000).toISOString()
}

/**
 * The creator's balance before a new row.
 *
 * MOCK-BALANCE: `balanceAfter` is derived and JSON Server derives nothing
 * (contract §6.13), so the newest balance-bearing row is read back and added
 * to. Two concurrent writes would produce two rows with the same balance —
 * Laravel computes it inside the transaction instead.
 *
 * **Ties on `createdAt` are broken by id** (Prompt 32). A release and the
 * commission debited against it are written with the *same* timestamp — that is
 * true of every seeded settlement and of `settleEscrow` — so "newest row" is
 * ambiguous exactly where it matters most, and picking the release would treat
 * the gross amount as the balance and lose the fee. Ids order correctly for
 * both kinds of row: the seed's are zero-padded sequences, and
 * `generateId` mints a base-36 timestamp that always sorts above them.
 */
async function latestBalanceOf(userId) {
  const { items } = await transactions.list({
    page: 1,
    limit: 5,
    sort: 'createdAt',
    order: SORT_ORDER.DESC,
    filters: { userId },
  })

  const candidates = items.filter((row) => Number.isFinite(Number(row.balanceAfter)))
  if (candidates.length === 0) return 0

  const newest = candidates.reduce((best, row) => {
    const gap = Date.parse(row.createdAt) - Date.parse(best.createdAt)
    if (gap > 0) return row
    if (gap < 0) return best
    return String(row.id) > String(best.id) ? row : best
  })

  return Number(newest.balanceAfter)
}

/**
 * **The only writer of `transactions`.** One call = one money movement
 * (Prompt 17 §4.4).
 *
 * @param {object} entry
 * @param {string} entry.type a `TRANSACTION_TYPE` value
 * @param {string} entry.userId whose ledger this row belongs to
 * @param {number} entry.amount signed from `userId`'s perspective — negative
 *   when money leaves them, positive when it arrives
 * @param {object} [entry.context] copy context for `transactionDescription`
 * @param {string} [entry.orderId]
 * @param {string} [entry.paymentId]
 * @param {string} [entry.payoutId]
 * @returns {Promise<object>} the created row
 */
async function writeTransaction({ type, userId, amount, context, orderId, paymentId, payoutId }) {
  const signed = round2(amount)
  const balanceAfter = BALANCE_BEARING_TYPES.has(type)
    ? round2(sumMoney([await latestBalanceOf(userId), signed]))
    : null

  return transactions.create({
    type,
    ...(orderId ? { orderId } : {}),
    ...(paymentId ? { paymentId } : {}),
    ...(payoutId ? { payoutId } : {}),
    userId,
    amount: signed,
    currency: appConfig.defaultCurrency,
    description: transactionDescription(type, context ?? {}),
    balanceAfter,
  })
}

/** Fire-and-forget notify: a bell item must never fail a settled payment. */
async function notifyQuietly(notification) {
  try {
    return await notificationService.notify(notification)
  } catch {
    return null
  }
}

/** Audit only when a member of staff did it (00 §14). */
async function auditIfAdmin(actor, entry) {
  if (!actor?.id || !isAdminRole(actor.role)) return null
  try {
    return await auditService.log({ actorId: actor.id, actorRole: actor.role, ...entry })
  } catch {
    return null
  }
}

/** The payment currently holding an order's money, or `null`. */
async function findHeldPayment(orderId) {
  const { items } = await payments.list({
    page: 1,
    limit: 1,
    sort: 'createdAt',
    order: SORT_ORDER.DESC,
    filters: { orderId, status: PAYMENT_STATUS.HELD },
  })
  return items[0] ?? null
}

/**
 * The commission rate that applies to an order. The rate is **frozen on the
 * order at award time** (contract §6.9), so a later settings change cannot
 * reprice work that is already under way; settings are only consulted for an
 * order that predates the field.
 */
async function rateForOrder(order) {
  const frozen = Number(order?.commissionRate)
  if (Number.isFinite(frozen)) return frozen
  const { rate } = await paymentService.computeCommission(order?.price ?? 0, {
    categoryId: order?.categoryId,
    creatorId: order?.creatorId,
  })
  return rate
}

/**
 * Settles escrow to the creator: the two ledger rows, the commission record,
 * the order's money fields, and the creator's notification.
 *
 * Shared by `releasePayment` and the partial-refund branch of `refundPayment`,
 * which settle the same way on different bases — the full price in the first
 * case, the retained amount in the second (contract §6.14: `baseAmount` is
 * "the amount actually settled").
 */
async function settleEscrow({ order, payment, baseAmount, rate, settledAt }) {
  const commissionAmount = applyRate(baseAmount, rate)
  const creatorEarnings = subtractMoney(baseAmount, commissionAmount)

  const releaseRow = await writeTransaction({
    type: TRANSACTION_TYPE.RELEASE,
    userId: order.creatorId,
    amount: baseAmount,
    orderId: order.id,
    paymentId: payment.id,
    context: { title: order.title },
  })

  const commission = await commissions.create({
    orderId: order.id,
    rate,
    baseAmount,
    amount: commissionAmount,
    currency: order.currency ?? appConfig.defaultCurrency,
  })

  const commissionRow = await writeTransaction({
    type: TRANSACTION_TYPE.COMMISSION,
    userId: order.creatorId,
    amount: -commissionAmount,
    orderId: order.id,
    paymentId: payment.id,
    context: { title: order.title, rate },
  })

  // Orders carry their money fields from award time; an order that somehow
  // reached settlement without them gets them from what actually settled,
  // rather than being left with nulls on the earnings screens.
  const moneyPatch = {}
  if (!Number.isFinite(Number(order.commissionAmount))) {
    moneyPatch.commissionAmount = commissionAmount
  }
  if (!Number.isFinite(Number(order.creatorEarnings))) {
    moneyPatch.creatorEarnings = creatorEarnings
  }
  if (!Number.isFinite(Number(order.commissionRate))) moneyPatch.commissionRate = rate
  const settledOrder = Object.keys(moneyPatch).length
    ? await orders.update(order.id, moneyPatch)
    : order

  await notifyQuietly({
    userId: order.creatorId,
    type: NOTIFICATION_TYPE.PAYMENT_RELEASED,
    title: 'Payment released',
    body:
      `${formatCurrency(creatorEarnings, order.currency)} from “${order.title}” is on its way to ` +
      'your BetterBlue balance, after commission. Request a payout whenever you are ready.',
    entityType: 'order',
    entityId: order.id,
  })

  // AFFILIATE-HOOK (Prompt 34): a completed order is what converts a referral,
  // and the referrer's share comes out of the commission written just above
  // (contract §7 operation 10). One line, deliberately: the feature flag, every
  // eligibility guard, and all of the failure handling live inside
  // `processConversion`, which is documented to **never throw** — it resolves to
  // `null` and logs a warning instead. Money has already moved by the time this
  // runs, so a referral problem must not be able to fail the settlement, and
  // there is nothing here that could grow a way to.
  await affiliateService.processConversion(settledOrder, { commissionAmount })

  return {
    commission,
    creatorEarnings,
    order: settledOrder,
    transactions: [releaseRow, commissionRow],
    settledAt,
  }
}

/**
 * The last `months` calendar months as empty buckets, oldest first. `key` is
 * `YYYY-MM` for matching a row's `createdAt`; `label` is what the axis prints.
 *
 * Deliberately the same shape `creatorDashboardService` builds for the overview
 * chart, so the two series are the same data at two lengths rather than two
 * calculations that could drift.
 */
function emptyMonthBuckets(now, months) {
  const thisMonth = dayjs(now ?? undefined).startOf('month')

  return Array.from({ length: months }, (unused, index) => {
    const month = thisMonth.subtract(months - 1 - index, 'month')
    return { key: month.format('YYYY-MM'), label: month.format('MMM'), amount: 0 }
  })
}

/**
 * The newest payment per order, from one page of payment rows.
 *
 * An order can carry several payments — a decline leaves its failed record
 * behind and a retry adds another (`docs/payments.md` §5) — and the live one is
 * always the most recent.
 */
function latestPaymentByOrder(rows = []) {
  const byOrder = new Map()
  rows.forEach((payment) => {
    const current = byOrder.get(payment.orderId)
    if (!current || Date.parse(payment.createdAt) >= Date.parse(current.createdAt)) {
      byOrder.set(payment.orderId, payment)
    }
  })
  return byOrder
}

/** The date an earnings row is filed under: when it settled, else when it started. */
function earningsRowDate(order) {
  return order.completedAt ?? order.activatedAt ?? order.createdAt ?? null
}

/* -------------------------------------------------------------------------- */
/* Admin finance folds (Prompt 32)                                            */
/* -------------------------------------------------------------------------- */

/** Pages one fold may walk — 1,000 rows, far beyond the seeded marketplace. */
const FOLD_PAGE_CAP = 10

/**
 * Pages a list function to exhaustion, up to {@link FOLD_PAGE_CAP} pages.
 *
 * MOCK-AGGREGATE: the platform-wide finance reads below are the first in the
 * product whose row count is not bounded by one member — a six-month ledger
 * outgrows the provider's 100-row page ceiling (contract §4.1) on any real
 * marketplace, and quietly summing the first page would print a number that is
 * simply wrong. So the fold walks pages and **says so** when it stopped early:
 * every caller returns `truncated`, and every screen prints a warning rather
 * than a total it cannot stand behind. Laravel answers each of these with one
 * `GROUP BY` and the whole helper goes away.
 *
 * @param {(params: object) => Promise<import('./api/listAdapter').ListResult>} listFn
 * @param {object} params list params — `page` is supplied by the walk
 * @returns {Promise<{items: object[], total: number, truncated: boolean}>}
 */
async function foldPages(listFn, params = {}) {
  const items = []
  let page = 1
  let total = 0

  for (; page <= FOLD_PAGE_CAP; page += 1) {
    // Sequential by necessity: the number of pages is not known until the first
    // response, and a fold that guessed would read pages that do not exist.
    // eslint-disable-next-line no-await-in-loop
    const result = await listFn({ ...params, page, limit: FOLD_LIMIT })
    total = result.total ?? items.length + result.items.length
    items.push(...result.items)
    if (items.length >= total || result.items.length === 0) break
  }

  return { items, total, truncated: items.length < total }
}

/** Whole days between an ISO timestamp and `now`, floored at zero. */
function ageInDays(iso, now) {
  const from = dayjs(iso)
  if (!from.isValid()) return 0
  return Math.max(0, dayjs(now ?? undefined).diff(from, 'day'))
}

/** The {@link ESCROW_AGING_BUCKETS} entry an age in days falls into. */
function bucketForAge(days) {
  return (
    ESCROW_AGING_BUCKETS.find(
      (bucket) => days >= bucket.minDays && (bucket.maxDays === null || days <= bucket.maxDays)
    ) ?? ESCROW_AGING_BUCKETS[ESCROW_AGING_BUCKETS.length - 1]
  )
}

/**
 * The last `months` calendar months as empty finance buckets, oldest first —
 * the summary's own shape, alongside {@link emptyMonthBuckets} which the
 * creator's single-figure chart uses.
 */
function emptyFinanceMonths(now, months) {
  const thisMonth = dayjs(now ?? undefined).startOf('month')

  return Array.from({ length: months }, (unused, index) => {
    const month = thisMonth.subtract(months - 1 - index, 'month')
    return {
      key: month.format('YYYY-MM'),
      label: month.format('MMM'),
      chargeVolume: 0,
      released: 0,
      refunded: 0,
      commissionRevenue: 0,
      payoutsPaid: 0,
    }
  })
}

/** Adds `amount` to one field of a month bucket, in cent space. */
function addToMonth(bucket, field, amount) {
  if (bucket) bucket[field] = sumMoney([bucket[field], amount])
}

/**
 * Resolves member ids to accounts, keyed by id, never rejecting: a finance
 * table missing a name is readable; one that failed to load is not.
 */
async function namesByIdFor(ids) {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return new Map()
  const people = await userService.listByIds(unique).catch(() => [])
  return new Map(people.map((person) => [person.id, person]))
}

/**
 * **Who a settlement pays.** Prompt 34 put a second kind of row in `payouts`:
 * an affiliate commission settlement, which carries `userId` + `affiliateId`
 * instead of `creatorId` (`payouts.source`, contract §6.15). Everything below
 * that notifies, audits, or writes a ledger row asks this rather than reading
 * `creatorId` directly, so the queue Prompt 32 built settles both kinds without
 * either one having to know about the other.
 *
 * @param {object} payout
 * @returns {string|undefined} the recipient's `usr_…`
 */
function payoutRecipientId(payout) {
  return payout?.creatorId ?? payout?.userId ?? undefined
}

export const paymentService = Object.freeze({
  /**
   * Payment history (buyer's own, or admin-wide).
   *
   * @param {import('./api/listAdapter').ListParams} [params] filters: `orderId`,
   *   `buyerId`, `status`, `createdAt_gte`/`createdAt_lte`,
   *   `amount_gte`/`amount_lte`; sorts: `createdAt`, `amount`
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  list: (params = {}) => payments.list({ sort: 'createdAt', order: SORT_ORDER.DESC, ...params }),

  /**
   * A buyer's own payment history — the read behind `/buyer/payments`
   * (Prompt 19). A thin lens on {@link list}, spelled out so a screen never has
   * to know that scoping to a member means adding a `buyerId` filter; the
   * Laravel endpoint derives it from the token instead and takes no such
   * parameter at all.
   *
   * @param {string} buyerId `usr_…`
   * @param {import('./api/listAdapter').ListParams} [params] any filter of {@link list}
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   *
   * **Future endpoint:** `GET /buyer/payments`.
   */
  listByBuyer(buyerId, params = {}) {
    return paymentService.list({ ...params, filters: { ...params.filters, buyerId } })
  },

  /**
   * @param {string} id `pay_…`
   * @returns {Promise<object>} the payment
   * @throws {ApiError} `not_found`
   */
  getById: (id) => payments.getById(id),

  /**
   * The payment behind an order. There is one per order plus retries, so the
   * most recent attempt is the live one.
   *
   * @param {string} orderId `ord_…`
   * @returns {Promise<object|null>} the payment, or `null` before the order is funded
   */
  async getByOrderId(orderId) {
    if (!orderId) return null
    const { items } = await payments.list({
      page: 1,
      limit: 1,
      sort: 'createdAt',
      order: SORT_ORDER.DESC,
      filters: { orderId },
    })
    return items[0] ?? null
  },

  /**
   * The ledger (contract §6.13). `amount` is signed from the perspective of
   * `userId`: money leaving is negative, money arriving is positive.
   *
   * Append-only — there is no create, update, or delete. Rows are written by
   * the escrow workflow as a side effect of money actually moving.
   *
   * @param {import('./api/listAdapter').ListParams} [params] filters: `userId`,
   *   `orderId`, `paymentId`, `payoutId`, `type`,
   *   `createdAt_gte`/`createdAt_lte`; sort: `createdAt`
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  listTransactions: (params = {}) =>
    transactions.list({ sort: 'createdAt', order: SORT_ORDER.DESC, ...params }),

  /**
   * One ledger line.
   *
   * @param {string} id `txn_…`
   * @returns {Promise<object>} the transaction
   * @throws {ApiError} `not_found`
   */
  getTransactionById: (id) => transactions.getById(id),

  /**
   * The fee records (admin `payments.manage`, contract §6.14) — exactly one per
   * released order.
   *
   * @param {import('./api/listAdapter').ListParams} [params] filters: `orderId`,
   *   `createdAt_gte`/`createdAt_lte`; sorts: `createdAt`, `amount`
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  listCommissions: (params = {}) =>
    commissions.list({ sort: 'createdAt', order: SORT_ORDER.DESC, ...params }),

  /* —— workflow operations —————————————————————————————————————————————— */

  /**
   * BetterBlue's fee on an amount — the one place the rate is resolved
   * (contract §6.14: `amount = round(baseAmount × rate, 2)`).
   *
   * Writes nothing, so screens can call it to preview a fee before anything is
   * committed. A category override beats the platform default; both come from
   * `platformSettings` through `settingsService`, which falls back rather than
   * throwing, because a missing rate would silently price an order at zero
   * commission.
   *
   * @param {number} amount the base amount, in currency units
   * @param {object} [context]
   * @param {string} [context.categoryId] `cat_…` — checked for an override
   * @param {string} [context.creatorId] `usr_…` — reserved, see below
   * @returns {Promise<{rate: number, amount: number}>} the rate as a decimal
   *   fraction and the fee, rounded to cents
   *
   * **Future endpoint:** part of `POST /proposals/:id/accept` and
   * `POST /orders/:id/release` — the server recomputes the fee and never trusts
   * a client-sent amount (contract §9.3).
   */
  async computeCommission(amount, { categoryId, creatorId } = {}) {
    const rate = await settingsService.getCommissionRate({ categoryId })

    // CREATOR-RATE-HOOK (Prompt 35, admin settings): a per-creator negotiated
    // rate overrides the category rate here — `creatorId` is already threaded
    // through every call site so that change stays inside this function.
    void creatorId

    return { rate, amount: applyRate(amount, rate) }
  },

  /**
   * **What resolving an order would do to its escrow** — a read, and the only
   * supported way for a screen to show a settlement before it happens
   * (contract §7 operation 43; Prompt 33 §7: money previews come from here,
   * never from arithmetic in a component).
   *
   * Writes nothing. Every figure comes from the same helpers the settlement
   * itself uses — {@link rateForOrder} for the rate (frozen on the order first,
   * so a preview cannot quote a rate the release would not charge) and
   * `applyRate`/`subtractMoney` for the split — so a preview and the ledger row
   * it predicts cannot drift.
   *
   * One `refundAmount` drives all three dispute outcomes
   * (`docs/payments.md` §6): `0` is a release, the whole held amount is a full
   * refund, and anything between is the partial split where **commission is
   * charged only on what the creator keeps**.
   *
   * @param {string} orderId `ord_…`
   * @param {object} [options]
   * @param {number} [options.refundAmount=0] the part going back to the buyer
   * @param {boolean} [options.refundAll=false] preview a **full** refund without
   *   having to read the held amount first — the same "no amount means all of
   *   it" convention {@link refundPayment} follows, and the reason a caller
   *   never computes the escrow total itself
   * @returns {Promise<{orderId: string, currency: string, held: number,
   *   refundedAmount: number, baseAmount: number, rate: number,
   *   commissionAmount: number, creatorEarnings: number, payment: object|null}>}
   *   `held` is `0` when nothing is in escrow, which is what a caller checks
   *   before offering a settlement at all
   * @throws {ApiError} `not_found` when the order does not exist
   *
   * **Future endpoint:** `GET /orders/:id/settlement-preview?refundAmount=…`,
   * gated the same way the operation it previews is. The server computes it
   * from its own records and never echoes a client-sent amount (§9.3).
   */
  async previewSettlement(orderId, { refundAmount = 0, refundAll = false } = {}) {
    const order = await orders.getById(orderId)
    const held = await findHeldPayment(orderId)

    const escrow = round2(held?.amount ?? 0)
    // Clamped rather than rejected: this is a preview of a number somebody is
    // still typing, and `refundPayment` is where an impossible amount is
    // refused (§13).
    const refunded = refundAll
      ? escrow
      : Math.min(Math.max(toAmount(refundAmount) ?? 0, 0), escrow)
    const baseAmount = subtractMoney(escrow, refunded)
    const rate = await rateForOrder(order)
    const commissionAmount = applyRate(baseAmount, rate)

    return {
      orderId,
      currency: held?.currency ?? order.currency ?? appConfig.defaultCurrency,
      held: escrow,
      refundedAmount: refunded,
      baseAmount,
      rate,
      commissionAmount,
      creatorEarnings: subtractMoney(baseAmount, commissionAmount),
      payment: held,
    }
  },

  /**
   * **Funds an order.** The buyer pays, the money is held in escrow, and work
   * starts (contract §7 operation 2).
   *
   * Written in the order that fails safest: charge the provider, settle the
   * payment record, start the order, write the ledger, then notify. A decline
   * stops after the payment record and leaves the order untouched, so the buyer
   * can simply try another card.
   *
   * @param {string} orderId `ord_…`
   * @param {object} options
   * @param {object} options.method `{ brand, last4, number? }` — the number is
   *   handed to the provider and never stored (contract §9.4)
   * @returns {Promise<object>} the `held` payment
   * @throws {ApiError} `conflict` when the order is not `pending_payment` or
   *   already has money against it · `payment_failed` (402) on a decline, with
   *   `details.reason` carrying the provider's code and `details.payment` the
   *   failed record · `server_error` when the sequence broke after the charge
   *
   * **Future endpoint:** `POST /orders/:id/pay` → `{ order, payment }`. The
   * amount is not in the request — the server reads it from the order.
   */
  async initiateOrderPayment(orderId, { method } = {}) {
    const order = await orders.getById(orderId)

    if (order.status !== ORDER_STATUS.PENDING_PAYMENT) {
      throw invalidState(
        'This order is not waiting for payment. Reload the page to see where it got to.',
        { from: order.status, to: ORDER_STATUS.IN_PROGRESS }
      )
    }

    const existing = await payments.list({
      page: 1,
      limit: FOLD_LIMIT,
      filters: { orderId, status: [...LIVE_PAYMENT_STATUSES] },
    })
    if (existing.total > 0) {
      throw invalidState('This order has already been paid for.', {
        paymentId: existing.items[0]?.id,
        status: existing.items[0]?.status,
      })
    }

    const provider = await getPaymentProvider()
    const amount = round2(order.price)
    const currency = order.currency ?? appConfig.defaultCurrency

    const payment = await payments.create({
      orderId,
      buyerId: order.buyerId,
      amount,
      currency,
      provider: provider.key,
      method: storableMethod(method),
      status: PAYMENT_STATUS.INITIATED,
      providerRef: null,
      heldAt: null,
      releasedAt: null,
      refundedAt: null,
    })

    const charge = await provider.createPayment({ amount, currency, method })
    await payments.update(payment.id, {
      status: transitionTo(
        PAYMENT_STATUS_MACHINE,
        payment.status,
        PAYMENT_STATUS.PROCESSING,
        'This payment can no longer be processed.'
      ),
      providerRef: charge.providerRef,
    })

    const confirmation = await provider.confirmPayment(charge.providerRef)

    if (confirmation.status !== 'succeeded') {
      const failed = await payments.update(payment.id, {
        status: transitionTo(
          PAYMENT_STATUS_MACHINE,
          PAYMENT_STATUS.PROCESSING,
          PAYMENT_STATUS.FAILED,
          'This payment can no longer be failed.'
        ),
        failureReason: confirmation.failureReason,
      })

      // A decline is a `402` in the target contract (§6.12), so it is a thrown
      // `ApiError` here too: checkout branches on `error.details.reason` and
      // keeps doing exactly that after the Laravel swap.
      throw createApiError(
        API_ERROR_CODE.PAYMENT_FAILED,
        confirmation.failureReason,
        { reason: confirmation.failureCode, payment: failed },
        402
      )
    }

    const heldAt = nowIso()

    try {
      const held = await payments.update(payment.id, {
        status: transitionTo(
          PAYMENT_STATUS_MACHINE,
          PAYMENT_STATUS.PROCESSING,
          PAYMENT_STATUS.HELD,
          'This payment can no longer be held.'
        ),
        heldAt,
      })

      const orderPatch = {
        status: transitionTo(
          ORDER_STATUS_MACHINE,
          order.status,
          ORDER_STATUS.IN_PROGRESS,
          'This order can no longer be started.'
        ),
        activatedAt: heldAt,
      }
      // The delivery clock starts when the money does, not when the proposal
      // was accepted — `acceptProposal` stores `deliveryDays` and this is where
      // it becomes a date (Prompt 17 §4.3).
      const dueAt = addDaysIso(heldAt, order.deliveryDays)
      if (dueAt) orderPatch.deliveryDueAt = dueAt

      await orders.update(orderId, orderPatch)

      await writeTransaction({
        type: TRANSACTION_TYPE.CHARGE,
        userId: order.buyerId,
        amount: -amount,
        orderId,
        paymentId: payment.id,
        context: { title: order.title },
      })

      await Promise.all([
        notifyQuietly({
          userId: order.creatorId,
          type: NOTIFICATION_TYPE.ORDER_PAID,
          title: 'Order funded — you can start',
          body:
            `“${order.title}” is funded. ${formatCurrency(amount, currency)} is held in escrow ` +
            'and released to you when the buyer accepts your delivery.',
          entityType: 'order',
          entityId: orderId,
        }),
        notifyQuietly({
          userId: order.buyerId,
          type: NOTIFICATION_TYPE.ORDER_PAID,
          title: 'Payment received',
          body:
            `We are holding ${formatCurrency(amount, currency)} for “${order.title}”. ` +
            'Nothing reaches the creator until you accept the delivery.',
          entityType: 'order',
          entityId: orderId,
        }),
      ])

      return held
    } catch (failure) {
      if (failure?.code === API_ERROR_CODE.CONFLICT) throw failure
      throw inconsistency('the order could not be started', { paymentId: payment.id }, failure)
    }
  },

  /**
   * **Releases escrow to the creator**, minus commission — the most
   * consequential operation in the product (contract §7 operation 3).
   *
   * Moves money only. The order's own transition to `completed` belongs to the
   * caller (`orderService` / `deliveryService.acceptDelivery`), because
   * accepting a delivery, auto-accepting, and resolving a dispute all release
   * the same way but finish the order differently.
   *
   * @param {string} orderId `ord_…`
   * @param {object} [options]
   * @param {string} [options.reason='buyer_accepted'] why it was released —
   *   recorded in the audit entry for an admin release
   * @param {{id: string, role: string}} [options.actor] who released it; an
   *   admin actor also writes a `payment.release` audit entry
   * @returns {Promise<{payment: object, commission: object, creatorEarnings: number,
   *   transactions: object[]}>}
   * @throws {ApiError} `conflict` when no payment is held on the order
   *
   * **Future endpoint:** `POST /orders/:id/release` →
   * `{ order, payment, commission, transactions }`, one transaction guarded by
   * `commissions.order_id UNIQUE` so a double release is impossible.
   */
  async releasePayment(orderId, { reason = 'buyer_accepted', actor } = {}) {
    const order = await orders.getById(orderId)
    const held = await findHeldPayment(orderId)

    if (!held) {
      throw invalidState(
        'There is no payment held on this order, so there is nothing to release.',
        { orderId, expected: PAYMENT_STATUS.HELD }
      )
    }

    // What actually settles: the escrow, less anything a dispute already sent
    // back (contract §6.14).
    const baseAmount = subtractMoney(held.amount, held.refundedAmount ?? 0)
    const rate = await rateForOrder(order)
    const releasedAt = nowIso()

    const payment = await payments.update(held.id, {
      status: transitionTo(
        PAYMENT_STATUS_MACHINE,
        held.status,
        PAYMENT_STATUS.RELEASED,
        'This payment can no longer be released.'
      ),
      releasedAt,
    })

    try {
      const settlement = await settleEscrow({
        order,
        payment,
        baseAmount,
        rate,
        settledAt: releasedAt,
      })

      await auditIfAdmin(actor, {
        action: AUDIT_ACTION.PAYMENT_RELEASE,
        entityType: 'payment',
        entityId: payment.id,
        meta: {
          orderId,
          reason,
          baseAmount,
          commissionAmount: settlement.commission.amount,
          creatorEarnings: settlement.creatorEarnings,
        },
      })

      return {
        payment,
        commission: settlement.commission,
        creatorEarnings: settlement.creatorEarnings,
        transactions: settlement.transactions,
      }
    } catch (failure) {
      throw inconsistency(
        'the release could not be recorded in full',
        { paymentId: payment.id, status: PAYMENT_STATUS.RELEASED },
        failure
      )
    }
  },

  /**
   * **Returns money to the buyer**, in full or in part (contract §7 operation 4).
   *
   * Partial-refund policy, and the reason it is written down here as well as in
   * `docs/payments.md`: **commission applies only to the portion the creator
   * keeps.** A partial refund therefore settles in the same call — the buyer
   * gets their part back, the creator is released the remainder, and the
   * commission is charged on that remainder (`commissions.baseAmount =
   * amount − refunded`). The payment ends `partially_refunded` carrying both
   * `refundedAt` and `releasedAt`, which is a terminal state in
   * `PAYMENT_STATUS_MACHINE` — there is nothing left to settle afterwards.
   *
   * Moves money only; the order's own transition (`cancelled`, `refunded`, or
   * on to `completed`) belongs to the caller, because the machine reaches those
   * states from different places (00 §9).
   *
   * @param {string} orderId `ord_…`
   * @param {object} [options]
   * @param {number} [options.amount] defaults to the whole held amount
   * @param {string} [options.reason] shown to both parties and audited
   * @param {string} [options.context] a `REFUND_CONTEXT` clause for the ledger
   * @param {{id: string, role: string}} [options.actor] an admin actor also
   *   writes a `payment.refund` audit entry
   * @returns {Promise<object>} the `refunded` or `partially_refunded` payment
   * @throws {ApiError} `conflict` when no payment is held ·
   *   `validation_failed` with `details.amount` when the amount is not between
   *   zero and the held amount
   *
   * **Future endpoint:** `POST /payments/:id/refund` →
   * `{ payment, order, transactions }`, with the amount validated server-side.
   */
  async refundPayment(orderId, { amount, reason, context, actor } = {}) {
    const order = await orders.getById(orderId)
    const held = await findHeldPayment(orderId)

    if (!held) {
      throw invalidState(
        'There is no payment held on this order, so there is nothing to refund.',
        { orderId, expected: PAYMENT_STATUS.HELD }
      )
    }

    const requested = toAmount(amount ?? held.amount)
    if (requested === null || requested <= 0 || requested > held.amount) {
      throw createApiError(
        API_ERROR_CODE.VALIDATION_FAILED,
        'That refund amount is not valid for this payment.',
        {
          amount: `Enter an amount between ${formatCurrency(0.01, held.currency)} and ` +
            `${formatCurrency(held.amount, held.currency)}.`,
        },
        422
      )
    }

    const isFull = requested >= held.amount
    const refundedAt = nowIso()
    const provider = await getPaymentProvider()
    await provider.refund(held.providerRef, requested)

    try {
      const payment = await payments.update(held.id, {
        status: transitionTo(
          PAYMENT_STATUS_MACHINE,
          held.status,
          isFull ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.PARTIALLY_REFUNDED,
          'This payment can no longer be refunded.'
        ),
        refundedAt,
        refundedAmount: requested,
        // A partial refund settles the rest in the same breath, so the payment
        // is released at the same moment it is refunded (contract §6.12).
        ...(isFull ? {} : { releasedAt: refundedAt }),
      })

      await writeTransaction({
        type: isFull ? TRANSACTION_TYPE.REFUND : TRANSACTION_TYPE.PARTIAL_REFUND,
        userId: order.buyerId,
        amount: requested,
        orderId,
        paymentId: payment.id,
        context: { title: order.title, context: context ?? REFUND_CONTEXT.DISPUTE },
      })

      let settlement = null
      if (!isFull) {
        settlement = await settleEscrow({
          order,
          payment,
          baseAmount: subtractMoney(held.amount, requested),
          rate: await rateForOrder(order),
          settledAt: refundedAt,
        })
      }

      const amountCopy = formatCurrency(requested, held.currency)
      await Promise.all([
        notifyQuietly({
          userId: order.buyerId,
          type: NOTIFICATION_TYPE.PAYMENT_REFUNDED,
          title: isFull ? 'Refund issued' : 'Partial refund issued',
          body:
            `${amountCopy} from “${order.title}” is on its way back to your card. ` +
            'Card refunds usually settle within a few working days.',
          entityType: 'order',
          entityId: orderId,
        }),
        notifyQuietly({
          userId: order.creatorId,
          type: NOTIFICATION_TYPE.PAYMENT_REFUNDED,
          title: isFull ? 'Order refunded' : 'Partial refund on your order',
          body: isFull
            ? `The escrow on “${order.title}” has been returned to the buyer. ${reason ?? ''}`.trim()
            : `${amountCopy} of the escrow on “${order.title}” was returned to the buyer; ` +
              `${formatCurrency(settlement?.creatorEarnings ?? 0, held.currency)} has been released to you.`,
          entityType: 'order',
          entityId: orderId,
        }),
      ])

      await auditIfAdmin(actor, {
        action: AUDIT_ACTION.PAYMENT_REFUND,
        entityType: 'payment',
        entityId: payment.id,
        meta: { orderId, amount: requested, full: isFull, reason },
      })

      return payment
    } catch (failure) {
      if (failure?.code === API_ERROR_CODE.CONFLICT) throw failure
      throw inconsistency(
        'the refund could not be recorded in full',
        { paymentId: held.id, refundedAmount: requested },
        failure
      )
    }
  },

  /**
   * A creator's money, in the four figures the earnings screens show
   * (Prompt 18 builds on this).
   *
   * - `held` — escrow on orders still in flight; not theirs yet.
   * - `available` — balance they can withdraw today: everything the ledger has
   *   settled, less payouts already requested or processing.
   * - `paidOut` — settlements actually paid.
   * - `lifetime` — every release net of commission, ever.
   *
   * MOCK-AGGREGATE: four figures folded from up to three list calls, each
   * capped at {@link FOLD_LIMIT} rows (contract §4.1) — comfortably above any
   * seeded creator, and gone the moment Laravel answers this with one query.
   *
   * @param {string} creatorId `usr_…`
   * @returns {Promise<{held: number, available: number, paidOut: number,
   *   lifetime: number, pendingPayouts: number, balance: number, currency: string}>}
   *
   * **Future endpoint:** `GET /creator/earnings` — one authenticated request
   * computing all of it with three `SUM()`s.
   */
  async getEarningsSummary(creatorId) {
    const empty = {
      held: 0,
      available: 0,
      paidOut: 0,
      lifetime: 0,
      pendingPayouts: 0,
      balance: 0,
      currency: appConfig.defaultCurrency,
    }
    if (!creatorId) return empty

    const [activeOrders, ledger, payouts] = await Promise.all([
      orders.list({
        page: 1,
        limit: FOLD_LIMIT,
        filters: { creatorId, status: [...ESCROW_HELD_ORDER_STATUSES] },
      }),
      transactions.list({ page: 1, limit: FOLD_LIMIT, filters: { userId: creatorId } }),
      payoutService.listByCreator(creatorId, { page: 1, limit: FOLD_LIMIT }),
    ])

    const held = sumMoney(
      activeOrders.items.map((order) =>
        Number.isFinite(Number(order.creatorEarnings))
          ? order.creatorEarnings
          : subtractMoney(order.price, order.commissionAmount ?? 0)
      )
    )

    const lifetime = sumMoney(
      ledger.items.filter((row) => EARNING_TYPES.has(row.type)).map((row) => row.amount)
    )

    // The ledger balance is the balance of record (contract §6.13): every row
    // this creator's account carries, payouts and affiliate commission
    // included.
    const balance = sumMoney(ledger.items.map((row) => row.amount))

    const paidOut = sumMoney(
      payouts.items
        .filter((payout) => payout.status === PAYOUT_STATUS.PAID)
        .map((payout) => payout.amount)
    )

    const pendingPayouts = sumMoney(
      payouts.items
        .filter((payout) => PENDING_PAYOUT_STATUSES.includes(payout.status))
        .map((payout) => payout.amount)
    )

    return {
      held,
      // Money already claimed by an open request is not available twice.
      available: Math.max(0, subtractMoney(balance, pendingPayouts)),
      paidOut,
      lifetime,
      pendingPayouts,
      balance,
      currency: ledger.items[0]?.currency ?? appConfig.defaultCurrency,
    }
  },

  /**
   * **Everything `/creator/earnings` prints**, computed here so no component
   * ever does money arithmetic (Prompt 25 §7): the four summary figures, one
   * row per order that carries money, the totals under them, and a year of
   * monthly net earnings for the chart.
   *
   * The three views reconcile by construction because they are folded from the
   * same three reads:
   *
   * - the **summary** is {@link getEarningsSummary}, untouched — the tiles here
   *   and the tile on the creator overview are literally the same call;
   * - a **row's** `net` is `orders.creatorEarnings`, the figure frozen when the
   *   proposal was accepted, which is also what the `release`/`commission` pair
   *   nets to on the ledger (`docs/payments.md` §7);
   * - a **month's** `amount` is that same pair, bucketed by `createdAt`, so the
   *   chart sums to `lifetime` across the months it covers.
   *
   * MOCK-AGGREGATE: four list calls, each capped at {@link FOLD_LIMIT} rows
   * (contract §4.1) — comfortably above any seeded creator, and gone the moment
   * Laravel answers this with one query. A creator past that ceiling would see
   * a truncated breakdown, which is why the returned `truncated` flag exists
   * rather than the screen quietly showing a short list.
   *
   * @param {string} creatorId `usr_…`
   * @param {object} [options]
   * @param {Date|string} [options.now] injectable clock for the month buckets
   * @param {number} [options.months={@link EARNINGS_BREAKDOWN_MONTHS}] chart length
   * @returns {Promise<{summary: object, rows: object[], totals: object,
   *   monthly: Array<{key: string, label: string, amount: number}>,
   *   monthlyPeak: object|null, payoutMinimum: number, currency: string,
   *   truncated: boolean}>}
   *
   * **Future endpoint:** `GET /creator/earnings` — one authenticated request
   * returning this exact object, with the rows joined and the series grouped in
   * SQL. The creator id is a parameter in the mock only; the endpoint takes it
   * from the bearer token and ignores anything the client sends (§9.2).
   */
  async getEarningsBreakdown(creatorId, { now, months = EARNINGS_BREAKDOWN_MONTHS } = {}) {
    const [summary, settings] = await Promise.all([
      paymentService.getEarningsSummary(creatorId),
      settingsService.getSettings().catch(() => SETTINGS_FALLBACK),
    ])

    const payoutMinimum = Number(
      settings?.general?.payoutMinAmount ?? SETTINGS_FALLBACK.general.payoutMinAmount
    )

    const empty = {
      summary,
      rows: [],
      totals: { count: 0, gross: 0, commissionAmount: 0, net: 0 },
      monthly: emptyMonthBuckets(now, months),
      monthlyPeak: null,
      payoutMinimum,
      currency: summary.currency,
      truncated: false,
    }
    if (!creatorId) return empty

    const [orderPage, ledger] = await Promise.all([
      orders.list({
        page: 1,
        limit: FOLD_LIMIT,
        sort: 'createdAt',
        order: SORT_ORDER.DESC,
        filters: { creatorId, status: [...EARNING_ORDER_STATUSES] },
      }),
      transactions.list({ page: 1, limit: FOLD_LIMIT, filters: { userId: creatorId } }),
    ])

    // MOCK-JOIN: orders carry no payment status and `_expand` is banned
    // (00 §10), so the escrow state of each row comes from one batched read.
    // Without it a completed order that was partially refunded would be printed
    // as a plain release, which is the one place these two records disagree.
    const orderIds = orderPage.items.map((order) => order.id)
    const paymentPage = orderIds.length
      ? await payments.list({
          page: 1,
          limit: FOLD_LIMIT,
          sort: 'createdAt',
          order: SORT_ORDER.ASC,
          filters: { orderId: orderIds },
        })
      : { items: [] }
    const paymentByOrder = latestPaymentByOrder(paymentPage.items)

    const rows = orderPage.items
      .map((order) => {
        const gross = round2(order.price)
        const rate = Number.isFinite(Number(order.commissionRate))
          ? Number(order.commissionRate)
          : null
        const commissionAmount = Number.isFinite(Number(order.commissionAmount))
          ? round2(order.commissionAmount)
          : applyRate(gross, rate ?? 0)
        const net = Number.isFinite(Number(order.creatorEarnings))
          ? round2(order.creatorEarnings)
          : subtractMoney(gross, commissionAmount)

        return {
          id: order.id,
          orderId: order.id,
          title: order.title,
          orderStatus: order.status,
          escrowStatus: paymentByOrder.get(order.id)?.status ?? null,
          isSettled: order.status === ORDER_STATUS.COMPLETED,
          settledAt: earningsRowDate(order),
          gross,
          commissionRate: rate,
          commissionAmount,
          net,
          currency: order.currency ?? summary.currency,
        }
      })
      .sort((a, b) => Date.parse(b.settledAt ?? 0) - Date.parse(a.settledAt ?? 0))

    const totals = {
      count: rows.length,
      gross: sumMoney(rows.map((row) => row.gross)),
      commissionAmount: sumMoney(rows.map((row) => row.commissionAmount)),
      net: sumMoney(rows.map((row) => row.net)),
    }

    const monthly = emptyMonthBuckets(now, months)
    const bucketByKey = new Map(monthly.map((bucket) => [bucket.key, bucket]))
    ledger.items
      .filter((row) => EARNING_TYPES.has(row.type))
      .forEach((row) => {
        const bucket = bucketByKey.get(dayjs(row.createdAt).format('YYYY-MM'))
        // `commission` rows are negative, so a release and its fee net to what
        // the creator actually kept that month.
        if (bucket) bucket.amount = sumMoney([bucket.amount, row.amount])
      })

    const monthlyPeak = monthly.reduce(
      (best, month) => (best === null || month.amount > best.amount ? month : best),
      null
    )

    return {
      ...empty,
      rows,
      totals,
      monthly,
      monthlyPeak: monthlyPeak && monthlyPeak.amount > 0 ? monthlyPeak : null,
      truncated: orderPage.total > orderPage.items.length || ledger.total > ledger.items.length,
    }
  },

  /**
   * **Requests a payout** of a creator's available balance (contract §7
   * operation 11).
   *
   * No ledger row is written here: money only leaves the balance when a finance
   * admin marks the payout `paid` (contract §6.15, Prompt 32). Until then the
   * amount is simply reserved out of `available`.
   *
   * SECURITY: the balance is computed in the browser and JSON Server checks
   * nothing — the clearest "never trust the client" case in this API (§9.3).
   * Laravel recomputes both the balance and the minimum server-side.
   *
   * @param {string} creatorId `usr_…`
   * @param {object} options
   * @param {number} options.amount how much to withdraw
   * @returns {Promise<object>} the `requested` payout
   * @throws {ApiError} `validation_failed` with `details.amount` when the
   *   amount is below `platformSettings.general.payoutMinAmount` or above the
   *   available balance
   *
   * **Future endpoint:** `POST /payouts` → `{ payout }`; the client sends only
   * the amount and the server derives the creator, the method, and the limits.
   */
  async requestPayout(creatorId, { amount } = {}) {
    const requested = toAmount(amount)

    const [settings, summary, profile] = await Promise.all([
      settingsService.getSettings().catch(() => SETTINGS_FALLBACK),
      paymentService.getEarningsSummary(creatorId),
      creatorProfileService.getByUserId(creatorId).catch(() => null),
    ])

    const minimum = Number(
      settings?.general?.payoutMinAmount ?? SETTINGS_FALLBACK.general.payoutMinAmount
    )

    if (requested === null || requested <= 0) {
      throw createApiError(
        API_ERROR_CODE.VALIDATION_FAILED,
        'Enter the amount you would like to withdraw.',
        { amount: 'Enter an amount.' },
        422
      )
    }

    if (requested < minimum) {
      throw createApiError(
        API_ERROR_CODE.VALIDATION_FAILED,
        'That is below the payout minimum.',
        {
          amount: `The minimum payout is ${formatCurrency(minimum, summary.currency)}.`,
          minimum,
        },
        422
      )
    }

    if (requested > summary.available) {
      throw createApiError(
        API_ERROR_CODE.VALIDATION_FAILED,
        'That is more than your available balance.',
        {
          amount: `You have ${formatCurrency(summary.available, summary.currency)} available` +
            (summary.pendingPayouts > 0
              ? `, with ${formatCurrency(summary.pendingPayouts, summary.currency)} already requested.`
              : '.'),
          available: summary.available,
        },
        422
      )
    }

    const payout = await payoutService.create({
      // Prompt 34: `payouts` now carries both creator earnings and affiliate
      // commission, so every row says which it is rather than being identified
      // by which field happens to be filled in (contract §6.15).
      source: PAYOUT_SOURCE.CREATOR,
      creatorId,
      amount: requested,
      currency: summary.currency,
      // Snapshotted so a later change of bank details cannot rewrite a
      // historical settlement (contract §6.15).
      method: profile?.payoutMethod ?? null,
      status: PAYOUT_STATUS.REQUESTED,
      processedAt: null,
    })

    await notifyQuietly({
      userId: creatorId,
      type: NOTIFICATION_TYPE.PAYOUT_REQUESTED,
      title: 'Payout requested',
      body:
        `${formatCurrency(requested, summary.currency)} is on its way to your bank account. ` +
        'Payouts are reviewed by our finance team and usually settle within three working days.',
      entityType: 'payout',
      entityId: payout.id,
    })

    // The finance queue hears about it too. Deferred by Prompt 27's audit
    // (`docs/notifications-audit.md` §3.2) precisely until the screen it deep
    // links to existed — `/admin/settlements` is Prompt 32's, and this is that
    // prompt. Best-effort like every other emit: a bell item must never fail a
    // withdrawal a creator is entitled to.
    try {
      await notificationService.notifyAdmins(PERMISSIONS.SETTLEMENTS_PROCESS, {
        type: NOTIFICATION_TYPE.PAYOUT_REQUESTED,
        title: 'Payout request waiting',
        body:
          `${formatCurrency(requested, summary.currency)} requested by a creator. ` +
          'Approve or reject it from the settlements queue.',
        entityType: 'payout',
        entityId: payout.id,
      })
    } catch {
      /* best-effort */
    }

    return payout
  },

  /* —— admin finance (Prompt 32) ———————————————————————————————————————— */

  /**
   * **The platform ledger**, with the names and titles behind each row
   * (Prompt 32 §4.3). The admin counterpart of {@link listTransactions}, which
   * returns bare rows: a finance screen printing "usr_creator_ava" is a screen
   * nobody can reconcile against anything.
   *
   * `search` matches an **order id** rather than free text — the ledger's
   * `description` is generated copy (`constants/transactionTemplates.js`) and
   * searching prose that the platform itself wrote finds nothing an admin was
   * looking for. The order is the thing a finance question is actually about.
   *
   * MOCK-JOIN: the page is fetched, then its users and orders are read in two
   * batched calls. Both fail soft — a row without a resolved name still shows
   * its money, which is the column that matters.
   *
   * @param {object} [params]
   * @param {number} [params.page=1]
   * @param {number} [params.limit=20]
   * @param {string|string[]} [params.type] a `TRANSACTION_TYPE` value, or several
   * @param {string} [params.userId] whose ledger
   * @param {string} [params.orderId] one engagement
   * @param {string} [params.search] an order id, exact — `ord_012`
   * @param {string} [params.from] ISO lower bound on `createdAt`
   * @param {string} [params.to] ISO upper bound on `createdAt`
   * @param {'asc'|'desc'} [params.order='desc']
   * @returns {Promise<import('./api/listAdapter').ListResult & {items: object[]}>}
   *   each item carries `user` and `order` (either may be `null`)
   *
   * **Future endpoint:** `GET /admin/transactions` — the same filters, with the
   * two joins done in SQL.
   */
  async adminListTransactions({
    page = 1,
    limit = 20,
    type,
    userId,
    orderId,
    search,
    from,
    to,
    order = SORT_ORDER.DESC,
  } = {}) {
    const filters = {}
    if (type) filters.type = type
    if (userId) filters.userId = userId
    // A search *is* an order filter, so a typed id and a picked order cannot
    // disagree: the explicit one wins.
    const searchedOrderId = orderId ?? (search ? String(search).trim() : undefined)
    if (searchedOrderId) filters.orderId = searchedOrderId
    if (from) filters.createdAt_gte = from
    if (to) filters.createdAt_lte = to

    const result = await transactions.list({
      page,
      limit,
      sort: 'createdAt',
      order,
      filters,
    })
    if (result.items.length === 0) return { ...result, items: [] }

    const [people, orderPage] = await Promise.all([
      namesByIdFor(result.items.map((row) => row.userId)),
      orders
        .list({
          page: 1,
          limit: FOLD_LIMIT,
          filters: { id: [...new Set(result.items.map((row) => row.orderId).filter(Boolean))] },
        })
        .catch(() => ({ items: [] })),
    ])

    const orderById = new Map(orderPage.items.map((row) => [row.id, row]))

    return {
      ...result,
      items: result.items.map((row) => ({
        ...row,
        user: people.get(row.userId) ?? null,
        order: row.orderId ? (orderById.get(row.orderId) ?? null) : null,
      })),
    }
  },

  /**
   * **Every payment BetterBlue is currently holding**, with both parties, the
   * engagement, how long it has been held, and whether it is contested
   * (Prompt 32 §4.2).
   *
   * "Held" is read from the **payment**, not the order: `held` is the one state
   * that means money is sitting with the platform (`docs/payments.md` §5), and
   * an order status is a statement about work rather than about money. The two
   * agree almost always, and this screen exists for the times they do not.
   *
   * MOCK-AGGREGATE: one fold over held payments (see {@link foldPages}), then
   * three batched joins. `truncated` is returned rather than hidden, because a
   * short escrow total is worse than no escrow total.
   *
   * **Reconcile:** filter `db.payments` to `status === 'held'` and sum `amount`.
   *
   * @param {object} [options]
   * @param {Date|string} [options.now] injectable clock for the ages
   * @returns {Promise<{items: object[], heldTotal: number, heldCount: number,
   *   agingBuckets: Array<{key: string, label: string, count: number, amount: number}>,
   *   currency: string, truncated: boolean}>}
   *
   * **Future endpoint:** `GET /admin/escrow` — one query with its joins and one
   * `GROUP BY` on the age buckets.
   */
  async getEscrowOverview({ now } = {}) {
    const fold = await foldPages(payments.list, {
      sort: 'heldAt',
      order: SORT_ORDER.ASC,
      filters: { status: PAYMENT_STATUS.HELD },
    })

    const buckets = ESCROW_AGING_BUCKETS.map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      count: 0,
      amount: 0,
    }))
    const bucketByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]))

    const empty = {
      items: [],
      heldTotal: 0,
      heldCount: 0,
      agingBuckets: buckets,
      currency: appConfig.defaultCurrency,
      truncated: fold.truncated,
    }
    if (fold.items.length === 0) return empty

    const orderIds = [...new Set(fold.items.map((payment) => payment.orderId).filter(Boolean))]

    const [orderPage, disputePage] = await Promise.all([
      orders.list({ page: 1, limit: FOLD_LIMIT, filters: { id: orderIds } }).catch(() => ({ items: [] })),
      // Only the *live* case matters here: a resolved dispute on a held payment
      // is history, and flagging it would send an admin looking for a decision
      // that has already been taken.
      disputeService
        .list({
          page: 1,
          limit: FOLD_LIMIT,
          filters: { orderId: orderIds, status: [...ACTIVE_DISPUTE_STATUSES] },
        })
        .catch(() => ({ items: [] })),
    ])

    const orderById = new Map(orderPage.items.map((row) => [row.id, row]))
    const disputeByOrderId = new Map()
    disputePage.items.forEach((dispute) => {
      if (!disputeByOrderId.has(dispute.orderId)) disputeByOrderId.set(dispute.orderId, dispute)
    })

    const people = await namesByIdFor(
      fold.items.flatMap((payment) => {
        const order = orderById.get(payment.orderId)
        return [payment.buyerId ?? order?.buyerId, order?.creatorId]
      })
    )

    const items = fold.items.map((payment) => {
      const order = orderById.get(payment.orderId) ?? null
      const heldAt = payment.heldAt ?? payment.createdAt
      const ageDays = ageInDays(heldAt, now)
      const bucket = bucketForAge(ageDays)

      const row = bucketByKey.get(bucket.key)
      if (row) {
        row.count += 1
        row.amount = sumMoney([row.amount, payment.amount])
      }

      return {
        ...payment,
        heldAt,
        ageDays,
        agingBucket: bucket.key,
        order,
        buyer: people.get(payment.buyerId ?? order?.buyerId) ?? null,
        creator: people.get(order?.creatorId) ?? null,
        dispute: disputeByOrderId.get(payment.orderId) ?? null,
      }
    })

    return {
      items,
      heldTotal: sumMoney(items.map((payment) => payment.amount)),
      heldCount: items.length,
      agingBuckets: buckets,
      currency: items[0]?.currency ?? appConfig.defaultCurrency,
      truncated: fold.truncated,
    }
  },

  /**
   * **The five figures finance reports on**, per month and for the window as a
   * whole (Prompt 32 §4.1):
   *
   * | Figure | Derivation |
   * |---|---|
   * | `chargeVolume` | Σ \|amount\| of `charge` rows — money taken from buyers |
   * | `released` | Σ `release` rows — escrow settled to creators, gross |
   * | `refunded` | Σ `refund` + `partial_refund` rows — money given back |
   * | `commissionRevenue` | Σ `commissions.amount` — BetterBlue's own earnings |
   * | `payoutsPaid` | Σ `payouts.amount` where `paid`, dated `processedAt` |
   *
   * `commissionRevenue` comes from the `commissions` collection rather than
   * from the ledger's `commission` rows, for the reason `docs/payments.md` §7
   * gives: the ledger row is a **debit against the creator's balance**, while
   * the `commissions` row is the platform's revenue record. They agree to the
   * cent — one is the negation of the other — and reading the revenue record is
   * what makes this figure reconcile with `adminService`'s overview chart,
   * which reads the same collection.
   *
   * A month is `createdAt` for ledger and commission rows and `processedAt` for
   * payouts: revenue is recognised on settlement, and a payout belongs to the
   * month the money actually left.
   *
   * @param {object} [options]
   * @param {Date|string} [options.now] injectable clock for the buckets
   * @param {number} [options.months={@link FINANCE_SUMMARY_MONTHS}] window length
   * @returns {Promise<{months: object[], current: object, totals: object,
   *   currency: string, truncated: boolean}>}
   *
   * **Future endpoint:** `GET /admin/finance/summary?months=6` — three
   * `GROUP BY DATE_FORMAT(…, '%Y-%m')` queries, unioned.
   */
  async getFinanceSummary({ now, months = FINANCE_SUMMARY_MONTHS } = {}) {
    const windowStart = dayjs(now ?? undefined)
      .startOf('month')
      .subtract(months - 1, 'month')
      .toISOString()

    const buckets = emptyFinanceMonths(now, months)
    const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]))
    const monthOf = (iso) => byKey.get(dayjs(iso).format('YYYY-MM'))

    const [ledger, commissionRows, paidPayouts] = await Promise.all([
      foldPages(transactions.list, {
        sort: 'createdAt',
        order: SORT_ORDER.ASC,
        filters: { createdAt_gte: windowStart },
      }),
      foldPages(commissions.list, {
        sort: 'createdAt',
        order: SORT_ORDER.ASC,
        filters: { createdAt_gte: windowStart },
      }),
      foldPages(payoutService.list, {
        sort: 'requestedAt',
        order: SORT_ORDER.ASC,
        filters: { status: PAYOUT_STATUS.PAID },
      }),
    ])

    ledger.items.forEach((row) => {
      const bucket = monthOf(row.createdAt)
      if (!bucket) return
      if (row.type === TRANSACTION_TYPE.CHARGE) {
        addToMonth(bucket, 'chargeVolume', Math.abs(Number(row.amount) || 0))
      } else if (row.type === TRANSACTION_TYPE.RELEASE) {
        addToMonth(bucket, 'released', row.amount)
      } else if (REFUND_TYPES.has(row.type)) {
        addToMonth(bucket, 'refunded', row.amount)
      }
    })

    commissionRows.items.forEach((row) => {
      addToMonth(monthOf(row.createdAt), 'commissionRevenue', row.amount)
    })

    // Payouts are filtered by status rather than by date — `processedAt` is the
    // date that matters and JSON Server cannot range-filter it alongside the
    // status without a compound index it does not have. The fold is bounded by
    // the paid set, which is small, and the window is applied here.
    paidPayouts.items.forEach((payout) => {
      addToMonth(monthOf(payout.processedAt ?? payout.requestedAt), 'payoutsPaid', payout.amount)
    })

    const fields = ['chargeVolume', 'released', 'refunded', 'commissionRevenue', 'payoutsPaid']
    const totals = Object.fromEntries(
      fields.map((field) => [field, sumMoney(buckets.map((bucket) => bucket[field]))])
    )

    return {
      months: buckets,
      current: buckets[buckets.length - 1],
      totals,
      currency: ledger.items[0]?.currency ?? appConfig.defaultCurrency,
      truncated: ledger.truncated || commissionRows.truncated || paidPayouts.truncated,
    }
  },

  /**
   * **The settlement queue**, with the member behind each request
   * (Prompt 32 §4.3). Oldest first by default: a payout is somebody waiting for
   * their own money, and the person kept waiting longest is the one to serve.
   *
   * Prompt 34 gave the queue a second kind of row — affiliate commission
   * settlements (`payouts.source`) — so `creator` here is "the person being
   * paid", resolved through {@link payoutRecipientId}. The finance console
   * takes the whole queue and labels each row with a source chip; the affiliate
   * console passes `source` to see only its own.
   *
   * @param {object} [params]
   * @param {string|string[]} [params.status] a `PAYOUT_STATUS` value, or several
   * @param {string} [params.source] a `PAYOUT_SOURCE` value — omit for both
   * @param {string} [params.affiliateId] narrow to one affiliate's settlements
   * @param {number} [params.page=1]
   * @param {number} [params.limit=20]
   * @param {'asc'|'desc'} [params.order='asc'] on `requestedAt`
   * @returns {Promise<import('./api/listAdapter').ListResult>} items carry `creator`
   *
   * **Future endpoint:** `GET /admin/payouts` — one query with its join.
   */
  async adminListSettlements({
    status,
    source,
    affiliateId,
    page = 1,
    limit = 20,
    order = SORT_ORDER.ASC,
  } = {}) {
    const result = await payoutService.list({
      page,
      limit,
      sort: 'requestedAt',
      order,
      filters: {
        ...(status ? { status } : null),
        ...(source ? { source } : null),
        ...(affiliateId ? { affiliateId } : null),
      },
    })
    if (result.items.length === 0) return { ...result, items: [] }

    const people = await namesByIdFor(result.items.map(payoutRecipientId))

    return {
      ...result,
      items: result.items.map((payout) => ({
        ...payout,
        creator: people.get(payoutRecipientId(payout)) ?? null,
      })),
    }
  },

  /**
   * The two figures above the settlement queue: what is owed and what has gone
   * out this month.
   *
   * @param {object} [options]
   * @param {Date|string} [options.now]
   * @returns {Promise<{pendingTotal: number, pendingCount: number,
   *   paidThisMonth: number, paidCountThisMonth: number, currency: string}>}
   */
  async getSettlementSummary({ now } = {}) {
    const monthStart = dayjs(now ?? undefined).startOf('month')

    const [pending, paid] = await Promise.all([
      foldPages(payoutService.list, {
        filters: { status: [...ACTIONABLE_PAYOUT_STATUSES] },
      }).catch(() => ({ items: [] })),
      foldPages(payoutService.list, { filters: { status: PAYOUT_STATUS.PAID } }).catch(() => ({
        items: [],
      })),
    ])

    const paidThisMonth = paid.items.filter((payout) =>
      dayjs(payout.processedAt ?? payout.requestedAt).isAfter(monthStart)
    )

    return {
      pendingTotal: sumMoney(pending.items.map((payout) => payout.amount)),
      pendingCount: pending.items.length,
      paidThisMonth: sumMoney(paidThisMonth.map((payout) => payout.amount)),
      paidCountThisMonth: paidThisMonth.length,
      currency: pending.items[0]?.currency ?? paid.items[0]?.currency ?? appConfig.defaultCurrency,
    }
  },

  /**
   * **Approves or rejects a settlement request** — the first of the two steps a
   * payout takes through the finance desk (contract §7 operation 32).
   *
   * Approving moves `requested → processing` and **moves no money**: the
   * transfer happens outside BetterBlue, and the ledger row is written when
   * somebody confirms it landed ({@link markPayoutPaid}). Two steps rather than
   * one because they are two different facts — "we accept this request" and
   * "the bank has sent it" — and collapsing them would have the platform assert
   * the second when only the first is known.
   *
   * Rejecting moves `requested → rejected` and requires a reason, which the
   * creator reads verbatim on their earnings screen (Prompt 25). No balance
   * changes either way: a rejected payout releases its reservation simply by
   * leaving `requested`, so the money becomes available again on the next read
   * of `getEarningsSummary`.
   *
   * @param {string} payoutId `pyo_…`
   * @param {object} options
   * @param {'approve'|'reject'} options.action
   * @param {string} [options.reason] required for a rejection
   * @param {{id: string, role: string}} [options.actor] the acting admin
   * @returns {Promise<object>} the updated settlement
   * @throws {ApiError} `conflict` when the payout has already moved on ·
   *   `validation_failed` when a rejection carries no reason
   *
   * **Future endpoint:** `POST /payouts/:id/process` → `{ payout }`, with the
   * transition guarded inside `DB::transaction()`.
   */
  async processPayout(payoutId, { action, reason, actor } = {}) {
    const payout = await payoutService.getById(payoutId)
    const isApproval = action === 'approve'

    if (!isApproval && action !== 'reject') {
      throw createApiError(
        API_ERROR_CODE.VALIDATION_FAILED,
        'A settlement is either approved or rejected.',
        { action: 'Choose approve or reject.' },
        422
      )
    }

    const trimmedReason = String(reason ?? '').trim()
    if (!isApproval && !trimmedReason) {
      throw createApiError(
        API_ERROR_CODE.VALIDATION_FAILED,
        'Tell the creator why their payout was rejected.',
        { reason: 'A reason is required — the creator reads it on their earnings screen.' },
        422
      )
    }

    const next = isApproval ? PAYOUT_STATUS.PROCESSING : PAYOUT_STATUS.REJECTED
    const processedAt = nowIso()

    const updated = await payoutService.update(payoutId, {
      status: transitionTo(
        PAYOUT_STATUS_MACHINE,
        payout.status,
        next,
        isApproval
          ? 'This settlement can no longer be approved — reload the queue.'
          : 'This settlement can no longer be rejected — reload the queue.'
      ),
      processedAt,
      ...(isApproval ? {} : { rejectedReason: trimmedReason }),
    })

    await notifyQuietly({
      userId: payoutRecipientId(payout),
      type: NOTIFICATION_TYPE.PAYOUT_PROCESSED,
      title: isApproval ? 'Payout approved' : 'Payout rejected',
      body: isApproval
        ? `${formatCurrency(payout.amount, payout.currency)} has been approved and is being ` +
          'transferred to your bank account. We will confirm as soon as it has been sent.'
        : `${formatCurrency(payout.amount, payout.currency)} was not paid out. ${trimmedReason} ` +
          'Your balance is untouched and you can request it again.',
      entityType: 'payout',
      entityId: payout.id,
    })

    // VOCABULARY: `payout.process` / `payout.mark_paid` / `payout.reject`, not
    // `payout.approve` / `payout.paid`. Contract §6.26 is explicit — "extend
    // the vocabulary, do not rename it" — and all three verbs are already in
    // the seeded set and in `AuditFeed`'s phrase map. Prompt 32 §4.1 suggested
    // `approve`/`paid`; adding those would leave two verbs for one event and an
    // audit trail that has to be searched twice.
    await auditIfAdmin(actor, {
      action: isApproval ? AUDIT_ACTION.PAYOUT_PROCESS : AUDIT_ACTION.PAYOUT_REJECT,
      entityType: 'payout',
      entityId: payout.id,
      meta: {
        source: payoutSourceOf(payout),
        creatorId: payoutRecipientId(payout),
        amount: payout.amount,
        fromStatus: payout.status,
        toStatus: next,
        ...(isApproval ? {} : { reason: trimmedReason }),
      },
    })

    return updated
  },

  /**
   * **Confirms a settlement was actually sent** — the second step, and the only
   * moment money leaves a creator's BetterBlue balance (contract §6.15,
   * `docs/payments.md` §5: "only a `paid` payout writes its `payout` ledger
   * row").
   *
   * MOCK-TRANSFER: no bank is called. The admin is asserting that a transfer
   * they made elsewhere has gone out, which is exactly what the confirmation
   * copy on the screen says — the prototype does not pretend to move money it
   * cannot move.
   *
   * @param {string} payoutId `pyo_…`
   * @param {object} [options]
   * @param {{id: string, role: string}} [options.actor] the acting admin
   * @returns {Promise<{payout: object, transaction: object}>}
   * @throws {ApiError} `conflict` when the payout is not `processing` ·
   *   `server_error` when the ledger row could not be written after the status
   *   moved — the one failure here that leaves work for a human
   *
   * **Future endpoint:** `POST /payouts/:id/paid` → `{ payout, transaction }`,
   * with the idempotency key from contract §1.8 so a retried confirmation
   * cannot debit a balance twice.
   */
  async markPayoutPaid(payoutId, { actor } = {}) {
    const payout = await payoutService.getById(payoutId)
    const paidAt = nowIso()

    const updated = await payoutService.update(payoutId, {
      status: transitionTo(
        PAYOUT_STATUS_MACHINE,
        payout.status,
        PAYOUT_STATUS.PAID,
        'This settlement cannot be marked paid from where it is — reload the queue.'
      ),
      processedAt: paidAt,
    })

    try {
      const transaction = await writeTransaction({
        type: TRANSACTION_TYPE.PAYOUT,
        userId: payoutRecipientId(payout),
        // Signed from the recipient's perspective: the money leaves their
        // BetterBlue balance for their bank (`docs/payments.md` §7).
        amount: -round2(payout.amount),
        payoutId: payout.id,
        context: { accountMasked: payout.method?.accountMasked },
      })

      // AFFILIATE-HOOK (Prompt 34): an affiliate settlement also closes the
      // approved commission behind it — the earnings become `paid` and each
      // writes its `affiliate_commission` credit, so the member's ledger nets
      // to zero against the row just written. Same contract as the conversion
      // hook: `settleAffiliatePayout` resolves rather than throwing, and does
      // nothing at all for a creator payout.
      await affiliateService.settleAffiliatePayout(updated)

      await notifyQuietly({
        userId: payoutRecipientId(payout),
        type: NOTIFICATION_TYPE.PAYOUT_PROCESSED,
        title: 'Payout sent',
        body:
          `${formatCurrency(payout.amount, payout.currency)} has been sent to ` +
          `${payout.method?.accountMasked ?? 'your bank account'}. ` +
          'Bank transfers usually settle within three working days.',
        entityType: 'payout',
        entityId: payout.id,
      })

      await auditIfAdmin(actor, {
        action: AUDIT_ACTION.PAYOUT_MARK_PAID,
        entityType: 'payout',
        entityId: payout.id,
        meta: {
          source: payoutSourceOf(payout),
          creatorId: payoutRecipientId(payout),
          amount: payout.amount,
          toStatus: PAYOUT_STATUS.PAID,
          transactionId: transaction.id,
        },
      })

      return { payout: updated, transaction }
    } catch (failure) {
      throw inconsistency(
        'the payout was marked paid but the ledger row was not written',
        { payoutId: payout.id, status: PAYOUT_STATUS.PAID },
        failure
      )
    }
  },

  /**
   * **Refunds escrow from the finance console** — a thin, named wrapper over
   * {@link refundPayment} (contract §7 operation 4).
   *
   * It exists so the escrow monitor has an intention-named call of its own and
   * so the refund context is right without every call site remembering it: a
   * refund issued from finance is an *intervention*, not a dispute outcome, and
   * the ledger row says so. Everything consequential — the amount bounds, the
   * partial-refund settlement, the notifications, the `payment.refund` audit
   * entry — stays in `refundPayment`, because a second implementation of a
   * refund is the last thing this product needs.
   *
   * @param {string} orderId `ord_…`
   * @param {object} options
   * @param {number} [options.amount] defaults to the whole held amount
   * @param {string} options.reason shown to both parties and audited
   * @param {{id: string, role: string}} options.actor the acting admin
   * @returns {Promise<object>} the `refunded` or `partially_refunded` payment
   * @throws {ApiError} `validation_failed` when no reason is given, and
   *   everything {@link refundPayment} throws
   */
  async adminRefundOrder(orderId, { amount, reason, actor } = {}) {
    const trimmedReason = String(reason ?? '').trim()
    if (!trimmedReason) {
      throw createApiError(
        API_ERROR_CODE.VALIDATION_FAILED,
        'Record why this escrow is being returned.',
        { reason: 'A reason is required — both parties are told, and it is audited.' },
        422
      )
    }

    return paymentService.refundPayment(orderId, {
      amount,
      reason: trimmedReason,
      context: REFUND_CONTEXT.INTERVENTION,
      actor,
    })
  },

  /**
   * **The commission records for a period** (Prompt 32 §4.4), with the order
   * behind each one. Exactly one row per settled order (contract §6.14), so
   * this list *is* platform revenue rather than a view of it.
   *
   * @param {object} [params]
   * @param {string} [params.month] `YYYY-MM` — the period; omit for everything
   * @param {number} [params.page=1]
   * @param {number} [params.limit=20]
   * @param {'asc'|'desc'} [params.order='desc'] on `createdAt`
   * @returns {Promise<import('./api/listAdapter').ListResult>} items carry `order`
   *
   * **Future endpoint:** `GET /admin/commissions?month=YYYY-MM`.
   */
  async adminListCommissions({ month, page = 1, limit = 20, order = SORT_ORDER.DESC } = {}) {
    const filters = {}
    if (month) {
      const start = dayjs(`${month}-01`)
      filters.createdAt_gte = start.startOf('month').toISOString()
      filters.createdAt_lte = start.endOf('month').toISOString()
    }

    const result = await commissions.list({ page, limit, sort: 'createdAt', order, filters })
    if (result.items.length === 0) return { ...result, items: [] }

    const orderPage = await orders
      .list({
        page: 1,
        limit: FOLD_LIMIT,
        filters: { id: [...new Set(result.items.map((row) => row.orderId).filter(Boolean))] },
      })
      .catch(() => ({ items: [] }))
    const orderById = new Map(orderPage.items.map((row) => [row.id, row]))

    return {
      ...result,
      items: result.items.map((row) => ({ ...row, order: orderById.get(row.orderId) ?? null })),
    }
  },

  /**
   * The three figures above the commissions table: what the period earned, the
   * average rate that produced it, and how many orders settled.
   *
   * `averageRate` is **weighted** — total commission over total base — not the
   * mean of the rate column. An unweighted average would let one small order at
   * a high rate move the platform's headline take rate, which is not what the
   * figure means.
   *
   * @param {object} [options]
   * @param {string} [options.month] `YYYY-MM`; omit for every commission ever
   * @returns {Promise<{total: number, baseTotal: number, averageRate: number|null,
   *   orderCount: number, currency: string, truncated: boolean}>}
   */
  async getCommissionSummary({ month } = {}) {
    const filters = {}
    if (month) {
      const start = dayjs(`${month}-01`)
      filters.createdAt_gte = start.startOf('month').toISOString()
      filters.createdAt_lte = start.endOf('month').toISOString()
    }

    const fold = await foldPages(commissions.list, {
      sort: 'createdAt',
      order: SORT_ORDER.ASC,
      filters,
    })

    const total = sumMoney(fold.items.map((row) => row.amount))
    const baseTotal = sumMoney(fold.items.map((row) => row.baseAmount))

    return {
      total,
      baseTotal,
      averageRate: baseTotal > 0 ? total / baseTotal : null,
      orderCount: fold.items.length,
      currency: fold.items[0]?.currency ?? appConfig.defaultCurrency,
      truncated: fold.truncated,
    }
  },
})

// The dummy processor's test cards, re-exported so the checkout screen and the
// dev gallery can show them **without importing `services/payments/`** — that
// folder stays behind this service (Prompt 17 §7).
export { DUMMY_TEST_CARDS, PAYMENT_FAILURE_CODE } from './payments'

export default paymentService
