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
  ORDER_STATUS,
  PROPOSAL_STATUS,
  REQUEST_STATUS,
} from '@/constants/statuses'
import { REFUND_CONTEXT } from '@/constants/transactionTemplates'
import { appConfig } from '@/config/appConfig'
import { ID_PREFIX } from '@/utils/id'
import { applyRate, subtractMoney } from '@/utils/money'
import { assertTransition } from '@/utils/stateMachine'

import { API_ERROR_CODE, createApiError } from './api/apiError'
import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'
import { deliveryService } from './deliveryService'
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

/** Order states an admin may cancel out of, refunding the escrow on the way. */
const ADMIN_CANCELLABLE_STATUSES = [
  ORDER_STATUS.IN_PROGRESS,
  ORDER_STATUS.REVISION_REQUESTED,
  ORDER_STATUS.DISPUTED,
]

const nowIso = () => new Date().toISOString()

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
