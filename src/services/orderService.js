// Orders — `docs/api-contract.md` §6.9. The funded engagement, and the spine of
// the whole workflow: one order = one request + one accepted proposal.
//
// The two workflow operations at the bottom of this file bracket an order's
// life: `acceptProposal` creates it (contract §7 operation 1) and `cancelOrder`
// ends it early. Everything in between — funding, releasing, refunding — is
// `paymentService`, because it moves money (`docs/payments.md`).

import { NOTIFICATION_TYPE } from '@/constants/notificationTypes'
import { isAdminRole, ROLES } from '@/constants/roles'
import {
  ORDER_STATUS_MACHINE,
  PROPOSAL_STATUS_MACHINE,
  REQUEST_STATUS_MACHINE,
} from '@/constants/stateMachines'
import {
  DELIVERY_STATUS,
  ORDER_STATUS,
  PAYMENT_STATUS,
  PROPOSAL_STATUS,
  REQUEST_STATUS,
} from '@/constants/statuses'
import { REFUND_CONTEXT } from '@/constants/transactionTemplates'
import { appConfig } from '@/config/appConfig'
import { formatCurrency, formatNumber } from '@/utils/formatters'
import { ID_PREFIX } from '@/utils/id'
import { applyRate, subtractMoney } from '@/utils/money'
import { assertTransition } from '@/utils/stateMachine'

import { API_ERROR_CODE, createApiError } from './api/apiError'
import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'
import { creatorProfileService } from './creatorProfileService'
import { deliveryService } from './deliveryService'
import { disputeService } from './disputeService'
import { notificationService } from './notificationService'
import { auditService } from './auditService'
import { paymentService } from './paymentService'
import { proposalService } from './proposalService'
import { requestService } from './requestService'
import { revisionService } from './revisionService'

const orders = createCrudService('orders', { idPrefix: ID_PREFIX.ORDER })

/** Newest order first (contract §6.9). */
const DEFAULT_SORT = 'createdAt'

/** Provider page ceiling (contract §4.1) — bounds the losing-offer fold. */
const FOLD_LIMIT = 100

/** Offers a buyer may still accept (contract §6.8). */
const ACCEPTABLE_PROPOSAL_STATUSES = [PROPOSAL_STATUS.SUBMITTED, PROPOSAL_STATUS.SHORTLISTED]

/**
 * Orders still in flight — everything that is neither finished nor abandoned.
 * The definition both dashboards mean by "active", kept here so the two
 * overviews and `countActiveByCreator` cannot drift apart.
 */
const ACTIVE_ORDER_STATUSES = [
  ORDER_STATUS.PENDING_PAYMENT,
  ORDER_STATUS.IN_PROGRESS,
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.REVISION_REQUESTED,
  ORDER_STATUS.DISPUTED,
]

/** Order states an admin may cancel out of, refunding the escrow on the way. */
const ADMIN_CANCELLABLE_STATUSES = [
  ORDER_STATUS.IN_PROGRESS,
  ORDER_STATUS.REVISION_REQUESTED,
  ORDER_STATUS.DISPUTED,
]

/**
 * Rows folded when counting a buyer's orders by status (contract §4.1 caps a
 * page at 100). Comfortably above any seeded account; a buyer past it gets a
 * count flagged `capped` rather than a quietly wrong one.
 */
const COUNT_LIMIT = 100

const nowIso = () => new Date().toISOString()

/**
 * The kinds of thing that happen to an order. Composed by
 * {@link orderService.getOrderTimeline} and rendered by `TimelineList`, so the
 * buyer's, the creator's, and the admin's history of an order are the same
 * history (Prompt 20 §4.1).
 */
export const ORDER_EVENT_TYPE = Object.freeze({
  ORDER_CREATED: 'order_created',
  PAYMENT_FAILED: 'payment_failed',
  PAYMENT_HELD: 'payment_held',
  DELIVERY_SUBMITTED: 'delivery_submitted',
  REVISION_REQUESTED: 'revision_requested',
  DELIVERY_ACCEPTED: 'delivery_accepted',
  PAYMENT_RELEASED: 'payment_released',
  PAYMENT_REFUNDED: 'payment_refunded',
  DISPUTE_OPENED: 'dispute_opened',
  DISPUTE_RESOLVED: 'dispute_resolved',
  ORDER_COMPLETED: 'order_completed',
  ORDER_CANCELLED: 'order_cancelled',
})

/** `{ icon, tone }` per event type — the visual half of the timeline. */
const EVENT_STYLE = Object.freeze({
  [ORDER_EVENT_TYPE.ORDER_CREATED]: { icon: 'solar:medal-ribbon-linear', tone: 'brand' },
  [ORDER_EVENT_TYPE.PAYMENT_FAILED]: { icon: 'solar:card-linear', tone: 'error' },
  [ORDER_EVENT_TYPE.PAYMENT_HELD]: { icon: 'solar:lock-keyhole-linear', tone: 'success' },
  [ORDER_EVENT_TYPE.DELIVERY_SUBMITTED]: { icon: 'solar:box-linear', tone: 'info' },
  [ORDER_EVENT_TYPE.REVISION_REQUESTED]: { icon: 'solar:restart-linear', tone: 'warning' },
  [ORDER_EVENT_TYPE.DELIVERY_ACCEPTED]: { icon: 'solar:check-circle-linear', tone: 'success' },
  [ORDER_EVENT_TYPE.PAYMENT_RELEASED]: { icon: 'solar:wallet-money-linear', tone: 'success' },
  [ORDER_EVENT_TYPE.PAYMENT_REFUNDED]: { icon: 'solar:card-recive-linear', tone: 'info' },
  [ORDER_EVENT_TYPE.DISPUTE_OPENED]: { icon: 'solar:danger-triangle-linear', tone: 'error' },
  [ORDER_EVENT_TYPE.DISPUTE_RESOLVED]: { icon: 'solar:shield-check-linear', tone: 'success' },
  [ORDER_EVENT_TYPE.ORDER_COMPLETED]: { icon: 'solar:verified-check-linear', tone: 'success' },
  [ORDER_EVENT_TYPE.ORDER_CANCELLED]: { icon: 'solar:close-circle-linear', tone: 'neutral' },
})

/** One timeline entry, or `null` when the moment it describes never happened. */
function event(type, at, title, description) {
  if (!at) return null
  return { id: `${type}:${at}`, type, at, title, description, ...EVENT_STYLE[type] }
}

/** `conflict` is the contract's code for "not in the right state" (§3.2). */
const invalidState = (message, details) =>
  createApiError(API_ERROR_CODE.CONFLICT, message, details, 409)

/**
 * Runs a status change through its machine and reports a rejection the way the
 * contract does: `409 conflict` with `details: { from, to }` (§8.1).
 */
function transitionTo(machine, from, to, message) {
  try {
    return assertTransition(machine, from, to)
  } catch (failure) {
    throw invalidState(message, { from, to, transition: failure.message })
  }
}

/**
 * Brings a creator's `completedOrders` back in line after an order closes.
 *
 * MOCK-AGGREGATE (contract §6.4): `creatorProfiles.completedOrders` is a derived
 * column with nothing deriving it, and the public profile prints it beside the
 * rating. `seed-db.js` recomputes it from `orders`; this does the same thing at
 * runtime, folding one capped page. Never throws — the order is the record and
 * the counter is a cache of it, so a completion must not fail over a stale tile.
 */
async function recountCompletedOrders(creatorId) {
  if (!creatorId) return null

  try {
    const [{ total }, profile] = await Promise.all([
      orders.list({
        page: 1,
        limit: 1,
        filters: { creatorId, status: ORDER_STATUS.COMPLETED },
      }),
      creatorProfileService.getByUserId(creatorId),
    ])
    if (!profile) return null
    await creatorProfileService.update(profile.id, { completedOrders: total })
    return total
  } catch {
    return null
  }
}

/** A bell item must never fail an order that has already changed hands. */
async function notifyQuietly(notification) {
  try {
    return await notificationService.notify(notification)
  } catch {
    return null
  }
}

/**
 * Resolves to `null` instead of throwing when a related record is missing.
 * Anything other than `not_found` still propagates — a 500 on the payment
 * lookup is a real failure, an absent payment is just an unfunded order.
 */
function orNull(promise) {
  return promise.catch((error) => {
    if (error?.code === API_ERROR_CODE.NOT_FOUND) return null
    throw error
  })
}

export const orderService = Object.freeze({
  /**
   * @param {import('./api/listAdapter').ListParams} [params] filters: `buyerId`,
   *   `creatorId`, `status`, `categoryId`, `contentType`,
   *   `price_gte`/`price_lte`, `createdAt_gte`/`createdAt_lte`,
   *   `deliveryDueAt_lte`; sorts: `createdAt`, `deliveryDueAt`, `price`, `completedAt`
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  list: (params = {}) => orders.list({ sort: DEFAULT_SORT, order: SORT_ORDER.DESC, ...params }),

  /**
   * @param {string} id `ord_…`
   * @returns {Promise<object>} the order
   * @throws {ApiError} `not_found`
   */
  getById: (id) => orders.getById(id),

  /**
   * A buyer's orders.
   *
   * @param {string} buyerId `usr_…`
   * @param {import('./api/listAdapter').ListParams} [params] any filter above
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  listByBuyer(buyerId, params = {}) {
    return orderService.list({ ...params, filters: { ...params.filters, buyerId } })
  },

  /**
   * A creator's orders.
   *
   * @param {string} creatorId `usr_…`
   * @param {import('./api/listAdapter').ListParams} [params] any filter above
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  listByCreator(creatorId, params = {}) {
    return orderService.list({ ...params, filters: { ...params.filters, creatorId } })
  },

  /**
   * Everything the order detail page renders, in two round trips instead of
   * six sequential ones.
   *
   * MOCK-JOIN: `_embed`/`_expand` are banned (00 §10), so the related records
   * are fetched in parallel after the order itself. Laravel returns the whole
   * graph from `GET /orders/:id` with eager loading, and only this function
   * changes.
   *
   * @param {string} id `ord_…`
   * @returns {Promise<{order: object, request: object|null, proposal: object|null,
   *   deliveries: object[], revisions: object[], payment: object|null}>}
   * @throws {ApiError} `not_found` when the order itself does not exist
   */
  async getWithRelations(id) {
    const order = await orders.getById(id)

    const [request, proposal, deliveries, revisions, payment] = await Promise.all([
      order.requestId ? orNull(requestService.getById(order.requestId)) : null,
      order.proposalId ? orNull(proposalService.getById(order.proposalId)) : null,
      deliveryService.listByOrder(order.id),
      revisionService.listByOrder(order.id),
      paymentService.getByOrderId(order.id),
    ])

    return {
      order,
      request,
      proposal,
      deliveries: deliveries.items,
      revisions: revisions.items,
      payment,
    }
  },

  /**
   * How many orders a buyer has in each status — the counts on the tab strip of
   * `/buyer/orders`.
   *
   * A separate read from the list itself on purpose: the tabs describe the whole
   * account, so they must not change when someone searches or turns a page.
   *
   * MOCK-AGGREGATE: JSON Server cannot group, so one capped page is folded here
   * (contract §4.1). `capped` says so out loud rather than implying an
   * exactness the fold does not have.
   *
   * @param {string} buyerId `usr_…`
   * @returns {Promise<{total: number, capped: boolean, byStatus: Object<string, number>}>}
   *
   * **Future endpoint:** `GET /buyer/orders/counts` — one `GROUP BY status`.
   */
  async countsByStatus(buyerId) {
    const byStatus = Object.fromEntries(Object.values(ORDER_STATUS).map((status) => [status, 0]))
    if (!buyerId) return { total: 0, capped: false, byStatus }

    const { items, total } = await orderService.listByBuyer(buyerId, {
      page: 1,
      limit: COUNT_LIMIT,
    })

    items.forEach((order) => {
      if (byStatus[order.status] !== undefined) byStatus[order.status] += 1
    })

    return { total, capped: total > items.length, byStatus }
  },

  /**
   * How many orders a creator has in each status — the counts on the tab strip
   * of `/creator/orders` (Prompt 24 §4.3).
   *
   * The mirror of {@link orderService.countsByStatus}, and separate for the same
   * reason: the tabs describe the whole account, so a search or a page turn must
   * not move them.
   *
   * MOCK-AGGREGATE: one capped page folded client-side (contract §4.1), with
   * `capped` saying so rather than implying an exactness the fold lacks.
   *
   * @param {string} creatorId `usr_…`
   * @returns {Promise<{total: number, capped: boolean, byStatus: Object<string, number>}>}
   *
   * **Future endpoint:** `GET /creator/orders/counts` — one `GROUP BY status`.
   */
  async countsByCreatorStatus(creatorId) {
    const byStatus = Object.fromEntries(Object.values(ORDER_STATUS).map((status) => [status, 0]))
    if (!creatorId) return { total: 0, capped: false, byStatus }

    const { items, total } = await orderService.listByCreator(creatorId, {
      page: 1,
      limit: COUNT_LIMIT,
    })

    items.forEach((order) => {
      if (byStatus[order.status] !== undefined) byStatus[order.status] += 1
    })

    return { total, capped: total > items.length, byStatus }
  },

  /**
   * The nav badge: deliveries sitting on this buyer's desk. An order at
   * `delivered` is the one state where the marketplace is waiting on the buyer
   * and money is standing still, so it is the number worth putting on the nav.
   *
   * @param {string} buyerId `usr_…`
   * @returns {Promise<number>} `0` when nothing is waiting
   */
  async countAwaitingReview(buyerId) {
    if (!buyerId) return 0
    const { total } = await orderService.listByBuyer(buyerId, {
      page: 1,
      limit: 1,
      filters: { status: ORDER_STATUS.DELIVERED },
    })
    return total
  },

  /**
   * The orders created by a set of accepted proposals — how a creator's
   * proposal list links an accepted offer to the engagement it became
   * (Prompt 23 §4.6).
   *
   * MOCK-JOIN: one request with the ids OR'd (contract §4.1), rather than one
   * per card. Laravel: `GET /proposals?…&include=order`.
   *
   * @param {string[]} proposalIds `prp_…`
   * @returns {Promise<Map<string, object>>} `prp_…` → the order it created
   */
  async listByProposalIds(proposalIds = []) {
    const ids = [...new Set(proposalIds.filter(Boolean))]
    if (ids.length === 0) return new Map()

    const { items } = await orders.list({
      page: 1,
      limit: COUNT_LIMIT,
      filters: { proposalId: ids },
    })
    return new Map(items.map((order) => [order.proposalId, order]))
  },

  /**
   * How many engagements a business has taken all the way to completion — the
   * one number on the request board's buyer card that says whether a brief
   * comes from somebody who finishes what they start (Prompt 23 §4.3).
   *
   * @param {string} buyerId `usr_…`
   * @returns {Promise<number>} `0` when the business has none yet
   *
   * **Future endpoint:** part of `GET /contentRequests/:id?include=buyer` — a
   * counter cache on the buyer profile rather than a second query.
   */
  async countCompletedForBuyer(buyerId) {
    if (!buyerId) return 0
    const { total } = await orderService.listByBuyer(buyerId, {
      page: 1,
      limit: 1,
      filters: { status: ORDER_STATUS.COMPLETED },
    })
    return total
  },

  /**
   * How many of a creator's orders are still in flight — the number behind the
   * availability confirmation and the deactivation guard on the creator's own
   * screens (Prompt 21 §4.6).
   *
   * "In flight" is the same five statuses both dashboards call *active*, so a
   * creator, their buyer, and the guard that stops an account walking away from
   * live work all count the same engagements.
   *
   * @param {string} creatorId `usr_…`
   * @returns {Promise<number>} `0` when nothing is outstanding
   *
   * **Future endpoint:** `GET /creator/orders/counts` — one `SELECT COUNT(*)`.
   */
  async countActiveByCreator(creatorId) {
    if (!creatorId) return 0
    const { total } = await orderService.listByCreator(creatorId, {
      page: 1,
      limit: 1,
      filters: { status: [...ACTIVE_ORDER_STATUSES] },
    })
    return total
  },

  /**
   * The creator's nav badge: orders whose next move is theirs (Prompt 24 §4.7).
   *
   * Narrower than {@link orderService.countActiveByCreator} on purpose. That
   * one answers "what is outstanding" for the availability guard; this one
   * answers "what are you holding up", which is the only thing worth a number on
   * a nav entry — and it is exactly the pair of statuses behind the Active tab
   * it links to, so the badge and the tab can never disagree.
   *
   * @param {string} creatorId `usr_…`
   * @returns {Promise<number>} `0` when nothing is waiting on them
   */
  async countAwaitingDelivery(creatorId) {
    if (!creatorId) return 0
    const { total } = await orderService.listByCreator(creatorId, {
      page: 1,
      limit: 1,
      filters: { status: [ORDER_STATUS.IN_PROGRESS, ORDER_STATUS.REVISION_REQUESTED] },
    })
    return total
  },

  /**
   * **The history of one order**, oldest first — the single source behind the
   * buyer's, the creator's, and the admin's timeline (Prompt 20 §4.1).
   *
   * Composed rather than stored: there is no `events` collection, and there does
   * not need to be, because every moment worth showing already has a timestamp
   * on the record it belongs to. Anything that has not happened yet has a `null`
   * timestamp and simply produces no entry.
   *
   * MOCK-JOIN: five list calls in parallel (contract §7). A failure in any of
   * the *related* reads leaves that strand out rather than failing the timeline —
   * a missing dispute row must not cost the reader the delivery history — but a
   * missing order still throws, because there is no timeline without it.
   *
   * @param {string} orderId `ord_…`
   * @returns {Promise<{id: string, type: string, title: string,
   *   description?: string, at: string, tone: string, icon: string}[]>}
   * @throws {ApiError} `not_found` when the order does not exist
   *
   * **Future endpoint:** `GET /orders/:id/timeline` — composed server-side from
   * the same rows, or from a real `order_events` table.
   */
  async getOrderTimeline(orderId) {
    const order = await orders.getById(orderId)

    const emptyList = { items: [] }
    const [payments, deliveries, revisions, disputes] = await Promise.all([
      paymentService.list({ page: 1, limit: FOLD_LIMIT, filters: { orderId } }).catch(() => emptyList),
      deliveryService.listByOrder(orderId).catch(() => emptyList),
      revisionService.listByOrder(orderId).catch(() => emptyList),
      disputeService.list({ page: 1, limit: FOLD_LIMIT, filters: { orderId } }).catch(() => emptyList),
    ])

    const currency = order.currency ?? appConfig.defaultCurrency
    const money = (amount) => formatCurrency(amount, currency)

    const entries = [
      event(
        ORDER_EVENT_TYPE.ORDER_CREATED,
        order.createdAt,
        'Order opened',
        `The proposal was accepted at ${money(order.price)} and this order was created.`
      ),
    ]

    payments.items.forEach((payment) => {
      entries.push(
        event(
          ORDER_EVENT_TYPE.PAYMENT_FAILED,
          payment.status === PAYMENT_STATUS.FAILED ? payment.createdAt : null,
          'Payment declined',
          payment.failureReason ?? 'The card was declined and nothing was charged.'
        ),
        event(
          ORDER_EVENT_TYPE.PAYMENT_HELD,
          payment.heldAt,
          'Payment held in escrow',
          `${money(payment.amount)} was taken and held by BetterBlue. Work could start.`
        ),
        event(
          ORDER_EVENT_TYPE.PAYMENT_RELEASED,
          payment.status === PAYMENT_STATUS.RELEASED ? payment.releasedAt : null,
          'Escrow released',
          'The payment was released to the creator, less the BetterBlue commission.'
        ),
        event(
          ORDER_EVENT_TYPE.PAYMENT_REFUNDED,
          payment.refundedAt,
          payment.status === PAYMENT_STATUS.PARTIALLY_REFUNDED
            ? 'Partial refund issued'
            : 'Refund issued',
          `${money(payment.refundedAmount ?? payment.amount)} went back to the card it came from.`
        )
      )
    })

    deliveries.items.forEach((delivery) => {
      entries.push(
        event(
          ORDER_EVENT_TYPE.DELIVERY_SUBMITTED,
          delivery.submittedAt,
          `Delivery v${delivery.version} submitted`,
          `${formatNumber(delivery.files?.length ?? 0)} file${
            (delivery.files?.length ?? 0) === 1 ? '' : 's'
          } were handed over for review.`
        ),
        event(
          ORDER_EVENT_TYPE.DELIVERY_ACCEPTED,
          delivery.status === DELIVERY_STATUS.ACCEPTED ? delivery.respondedAt : null,
          `Delivery v${delivery.version} accepted`,
          'The buyer approved the work, which released the escrow.'
        )
      )
    })

    revisions.items.forEach((revision) => {
      entries.push(
        event(
          ORDER_EVENT_TYPE.REVISION_REQUESTED,
          revision.createdAt,
          'Changes requested',
          revision.notes
        )
      )
    })

    disputes.items.forEach((dispute) => {
      entries.push(
        event(
          ORDER_EVENT_TYPE.DISPUTE_OPENED,
          dispute.createdAt,
          'Dispute opened',
          dispute.reason ?? 'The order was referred to the BetterBlue team.'
        ),
        event(
          ORDER_EVENT_TYPE.DISPUTE_RESOLVED,
          dispute.resolvedAt,
          'Dispute resolved',
          dispute.resolutionNote ?? 'The BetterBlue team issued a decision.'
        )
      )
    })

    entries.push(
      event(
        ORDER_EVENT_TYPE.ORDER_COMPLETED,
        order.completedAt,
        'Order completed',
        'Everything on this engagement is settled.'
      ),
      event(
        ORDER_EVENT_TYPE.ORDER_CANCELLED,
        order.cancelledAt,
        'Order cancelled',
        'The engagement was called off.'
      )
    )

    return entries
      .filter(Boolean)
      .sort((a, b) => String(a.at).localeCompare(String(b.at)))
  },

  /**
   * Records an order. **Never called from a feature** — orders are created by
   * `acceptProposal` (contract §6.9, §7).
   *
   * @param {object} payload the new order
   * @returns {Promise<object>} the created order
   */
  create: (payload) => orders.create(payload),

  /**
   * Updates order fields. **`status` is never patched from a feature**: every
   * transition is a side effect of a composite operation, because each one also
   * moves money, writes ledger rows, and notifies (contract §6.9).
   *
   * @param {string} id `ord_…`
   * @param {object} patch changed fields only
   * @returns {Promise<object>} the updated order
   */
  update: (id, patch) => orders.update(id, patch),

  /* —— workflow operations —————————————————————————————————————————————— */

  /**
   * **Accepts a proposal and creates the order** (contract §7 operation 1).
   *
   * The buyer picks a winner: that offer is accepted, every other offer on the
   * brief is declined, the brief is awarded, and an unfunded order appears at
   * `pending_payment` for the buyer to pay (Prompt 19's checkout).
   *
   * The order **snapshots** the brief and the offer — title, category, content
   * type, price, revisions, and the commission rate as it stands right now — so
   * neither a later edit to the brief nor a change to the platform rate can
   * reprice work that has already been agreed (contract §6.9).
   *
   * `deliveryDays` is stored rather than a due date: the clock starts when the
   * order is funded, so `paymentService.initiateOrderPayment` is what turns it
   * into `deliveryDueAt` (Prompt 17 §4.3).
   *
   * MOCK-ATOMICITY: eight-plus REST calls with no transaction around them
   * (contract §7). They run in the order that fails least badly — accept, then
   * decline the rest, then create the order, then award the brief — so an
   * interruption leaves a brief that can be reconciled by hand rather than two
   * accepted offers.
   *
   * SECURITY: the ownership check below is UX only (00 §11); Laravel must scope
   * the operation to the signed-in buyer as well.
   *
   * @param {string} proposalId `prp_…`
   * @param {object} [options]
   * @param {string} [options.buyerId] the acting buyer — rejected unless they
   *   own the brief
   * @returns {Promise<object>} the new `pending_payment` order
   * @throws {ApiError} `conflict` when the offer or the brief has moved on ·
   *   `forbidden` when the caller does not own the brief · `not_found`
   *
   * **Future endpoint:** `POST /proposals/:id/accept` → `{ order, proposal }`,
   * one transaction with `orders.request_id UNIQUE` making a double-accept
   * structurally impossible.
   */
  async acceptProposal(proposalId, { buyerId } = {}) {
    const proposal = await proposalService.getById(proposalId)

    if (!ACCEPTABLE_PROPOSAL_STATUSES.includes(proposal.status)) {
      throw invalidState('This proposal can no longer be accepted.', {
        from: proposal.status,
        to: PROPOSAL_STATUS.ACCEPTED,
      })
    }

    const request = await requestService.getById(proposal.requestId)

    if (buyerId && request.buyerId !== buyerId) {
      throw createApiError(
        API_ERROR_CODE.FORBIDDEN,
        'This request belongs to another account.'
      )
    }
    if (request.status !== REQUEST_STATUS.OPEN) {
      throw invalidState('This request is no longer open, so it cannot be awarded.', {
        from: request.status,
        to: REQUEST_STATUS.AWARDED,
      })
    }

    const { rate } = await paymentService.computeCommission(proposal.price, {
      categoryId: request.categoryId,
      creatorId: proposal.creatorId,
    })
    const commissionAmount = applyRate(proposal.price, rate)
    const respondedAt = nowIso()

    await proposalService.update(proposal.id, {
      status: transitionTo(
        PROPOSAL_STATUS_MACHINE,
        proposal.status,
        PROPOSAL_STATUS.ACCEPTED,
        'This proposal can no longer be accepted.'
      ),
      respondedAt,
    })

    // Every other live offer on the brief loses, and its creator is told.
    const others = await proposalService.listByRequest(request.id, {
      page: 1,
      limit: FOLD_LIMIT,
      filters: { status: [...ACCEPTABLE_PROPOSAL_STATUSES] },
    })

    const losing = others.items.filter((offer) => offer.id !== proposal.id)
    for (const offer of losing) {
      // eslint-disable-next-line no-await-in-loop -- JSON Server rewrites
      // db.json on every write; parallel PATCHes here drop rows.
      await proposalService.update(offer.id, {
        status: PROPOSAL_STATUS.DECLINED,
        respondedAt,
      })
      // eslint-disable-next-line no-await-in-loop -- as above.
      await notifyQuietly({
        userId: offer.creatorId,
        type: NOTIFICATION_TYPE.PROPOSAL_DECLINED,
        title: 'Proposal not selected',
        body: `The buyer awarded “${request.title}” to another creator. Thanks for proposing.`,
        entityType: 'request',
        entityId: request.id,
      })
    }

    const order = await orders.create({
      requestId: request.id,
      proposalId: proposal.id,
      buyerId: request.buyerId,
      creatorId: proposal.creatorId,
      title: request.title,
      categoryId: request.categoryId,
      contentType: request.contentType,
      price: proposal.price,
      currency: proposal.currency ?? request.currency ?? appConfig.defaultCurrency,
      commissionRate: rate,
      commissionAmount,
      creatorEarnings: subtractMoney(proposal.price, commissionAmount),
      revisionsIncluded: proposal.revisionsIncluded ?? 0,
      revisionsUsed: 0,
      // The agreed turnaround; `deliveryDueAt` is computed from it at funding.
      deliveryDays: proposal.deliveryDays ?? null,
      deliveryDueAt: null,
      status: ORDER_STATUS.PENDING_PAYMENT,
      activatedAt: null,
      deliveredAt: null,
      completedAt: null,
      cancelledAt: null,
    })

    await requestService.update(request.id, {
      status: transitionTo(
        REQUEST_STATUS_MACHINE,
        request.status,
        REQUEST_STATUS.AWARDED,
        'This request can no longer be awarded.'
      ),
      awardedProposalId: proposal.id,
    })

    await notifyQuietly({
      userId: proposal.creatorId,
      type: NOTIFICATION_TYPE.PROPOSAL_ACCEPTED,
      title: 'Your proposal was accepted',
      body:
        `“${request.title}” is yours. The order opens once the buyer funds it — ` +
        'you will be notified the moment the payment is held in escrow.',
      entityType: 'order',
      entityId: order.id,
    })

    return order
  },

  /**
   * **Completes an order and pays the creator** — the end of the happy path
   * (contract §7 operation 6).
   *
   * Three things finish together: the escrow is released, the order closes at
   * `completed`, and the brief behind it is marked completed too. The money
   * moves *first*, deliberately: an order marked complete while BetterBlue still
   * holds the payment is the one inconsistency this workflow must never leave
   * behind, and the reverse — money released against an order that failed to
   * close — is at least visible to the creator and reconcilable by support.
   *
   * Reached from two places, which is why it is here rather than inside
   * `deliveryService`: the buyer accepting a delivery (Prompt 20) and Trust &
   * Safety resolving a dispute in the creator's favour (Prompt 30). The dispute
   * path settles the money itself through `resolveDispute`, so it passes
   * `release: false` rather than releasing twice.
   *
   * @param {string} orderId `ord_…`
   * @param {object} [options]
   * @param {boolean} [options.release=true] release the escrow on the way —
   *   `false` when the caller has already settled it
   * @param {string} [options.reason='buyer_accepted'] recorded on an admin release
   * @param {{id: string, role: string}} [options.actor] who completed it
   * @returns {Promise<{order: object, payment: object|null, commission: object|null,
   *   creatorEarnings: number|null}>}
   * @throws {ApiError} `conflict` when the order cannot be completed from where
   *   it is, or when there is no escrow left to release
   *
   * **Future endpoint:** part of `POST /deliveries/:id/accept` — the release and
   * the completion are the same transaction, so there is no window in which a
   * delivery is accepted but the creator has not been paid.
   */
  async completeOrder(orderId, { release = true, reason = 'buyer_accepted', actor } = {}) {
    const order = await orders.getById(orderId)

    // Checked before the money moves: a release against an order that cannot
    // reach `completed` would have to be unwound by hand.
    const completedStatus = transitionTo(
      ORDER_STATUS_MACHINE,
      order.status,
      ORDER_STATUS.COMPLETED,
      'This order can no longer be completed.'
    )

    const settlement = release ? await paymentService.releasePayment(orderId, { reason, actor }) : null

    const completedAt = nowIso()
    const completed = await orders.update(orderId, { status: completedStatus, completedAt })

    // The brief the order came from ends with it (contract §6.7). Best effort:
    // a brief that is already `completed` — or that an admin closed underneath
    // the order — must not fail a settlement that has happened.
    if (order.requestId) {
      try {
        const request = await requestService.getById(order.requestId)
        if (request.status === REQUEST_STATUS.AWARDED) {
          await requestService.update(request.id, { status: REQUEST_STATUS.COMPLETED })
        }
      } catch {
        // See above.
      }
    }

    await recountCompletedOrders(order.creatorId)

    await notifyQuietly({
      userId: order.creatorId,
      type: NOTIFICATION_TYPE.ORDER_COMPLETED,
      title: 'Order completed',
      body:
        `“${order.title}” is complete. ` +
        (settlement
          ? `${formatCurrency(settlement.creatorEarnings, order.currency)} has been added to your ` +
            'BetterBlue balance, after commission.'
          : 'Nothing further is needed from you.'),
      entityType: 'order',
      entityId: orderId,
    })

    return {
      order: completed,
      payment: settlement?.payment ?? null,
      commission: settlement?.commission ?? null,
      creatorEarnings: settlement?.creatorEarnings ?? null,
    }
  },

  /**
   * **Cancels an order.** Two paths, and they are deliberately different:
   *
   * - **Before payment** (`pending_payment`) either party may walk away. No
   *   money was collected, so nothing is refunded (contract §6.13).
   * - **After payment** only an admin may cancel, and the escrow goes back to
   *   the buyer in full through `paymentService.refundPayment` first — an order
   *   is never cancelled while BetterBlue is still holding the money.
   *
   * A cancellation from `disputed` is a Trust & Safety decision and reaches
   * this function through `disputeService.resolveDispute` (Prompt 30), which is
   * why the refund path is shared rather than reimplemented there.
   *
   * @param {string} orderId `ord_…`
   * @param {object} [options]
   * @param {string} [options.byRole] the acting role — an admin role unlocks
   *   the funded path
   * @param {string} [options.actorId] `usr_…`, needed for the audit entry
   * @param {string} [options.reason] shown to both parties and audited
   * @returns {Promise<object>} the `cancelled` order
   * @throws {ApiError} `conflict` when the order cannot be cancelled from where
   *   it is · `forbidden` when a party tries to cancel a funded order
   *
   * **Future endpoint:** `POST /orders/:id/cancel` → `{ order, payment }`, with
   * the refund and the cancellation in one transaction.
   */
  async cancelOrder(orderId, { byRole, actorId, reason } = {}) {
    const order = await orders.getById(orderId)
    const isAdmin = isAdminRole(byRole)
    const isFunded = order.status !== ORDER_STATUS.PENDING_PAYMENT

    if (isFunded && !isAdmin) {
      throw createApiError(
        API_ERROR_CODE.FORBIDDEN,
        'This order has been paid for, so it can only be cancelled by BetterBlue support. ' +
          'Open a dispute and our team will take it from there.'
      )
    }
    if (isFunded && !ADMIN_CANCELLABLE_STATUSES.includes(order.status)) {
      throw invalidState('This order can no longer be cancelled.', {
        from: order.status,
        to: ORDER_STATUS.CANCELLED,
      })
    }

    // Refund first: a cancelled order that still holds escrow is the one state
    // this workflow must never leave behind.
    let refund = null
    if (isFunded) {
      refund = await paymentService.refundPayment(orderId, {
        reason,
        context: REFUND_CONTEXT.CANCELLATION,
        actor: actorId ? { id: actorId, role: byRole } : undefined,
      })
    }

    const cancelledAt = nowIso()
    const cancelled = await orders.update(orderId, {
      status: transitionTo(
        ORDER_STATUS_MACHINE,
        order.status,
        ORDER_STATUS.CANCELLED,
        'This order can no longer be cancelled.'
      ),
      cancelledAt,
    })

    const body = refund
      ? `“${order.title}” has been cancelled and the payment returned to the buyer.` +
        (reason ? ` Reason: ${reason}` : '')
      : `“${order.title}” has been cancelled before payment, so nothing was charged.` +
        (reason ? ` Reason: ${reason}` : '')

    await Promise.all(
      [order.buyerId, order.creatorId].map((userId) =>
        notifyQuietly({
          userId,
          type: NOTIFICATION_TYPE.ORDER_CANCELLED,
          title: 'Order cancelled',
          body,
          entityType: 'order',
          entityId: orderId,
        })
      )
    )

    if (isAdmin && actorId) {
      try {
        await auditService.log({
          actorId,
          actorRole: byRole ?? ROLES.ADMIN,
          action: 'order.cancel',
          entityType: 'order',
          entityId: orderId,
          meta: { fromStatus: order.status, reason, refunded: refund?.refundedAmount ?? 0 },
        })
      } catch {
        // An unwritten audit line must not undo a cancellation that happened.
      }
    }

    return cancelled
  },
})

export default orderService
