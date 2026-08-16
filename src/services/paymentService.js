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
import { NOTIFICATION_TYPE } from '@/constants/notificationTypes'
import { isAdminRole } from '@/constants/roles'
import {
  ORDER_STATUS_MACHINE,
  PAYMENT_STATUS_MACHINE,
} from '@/constants/stateMachines'
import {
  ORDER_STATUS,
  PAYMENT_STATUS,
  PAYOUT_STATUS,
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

import { API_ERROR_CODE, createApiError } from './api/apiError'
import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'
import { auditService } from './auditService'
import { creatorProfileService } from './creatorProfileService'
import { notificationService } from './notificationService'
import { getPaymentProvider } from './payments'
import { payoutService } from './payoutService'
import { settingsService, SETTINGS_FALLBACK } from './settingsService'

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
 */
async function latestBalanceOf(userId) {
  const { items } = await transactions.list({
    page: 1,
    limit: 5,
    sort: 'createdAt',
    order: SORT_ORDER.DESC,
    filters: { userId },
  })

  const latest = items.find((row) => Number.isFinite(Number(row.balanceAfter)))
  return latest ? Number(latest.balanceAfter) : 0
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

  // AFFILIATE-HOOK (Prompt 34): processConversion(order) — a completed order is
  // what converts a referral, and the referrer's share comes out of the
  // commission written just above (contract §7 operation 10). It belongs here,
  // after the money is settled, and must not be able to fail the settlement.

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
        action: 'payment.release',
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
        action: 'payment.refund',
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

    return payout
  },
})

// The dummy processor's test cards, re-exported so the checkout screen and the
// dev gallery can show them **without importing `services/payments/`** — that
// folder stays behind this service (Prompt 17 §7).
export { DUMMY_TEST_CARDS, PAYMENT_FAILURE_CODE } from './payments'

export default paymentService
