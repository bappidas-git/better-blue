// Buyer change requests — `docs/api-contract.md` §6.11. One per revision
// asked for against a specific delivered version.

import { NOTIFICATION_TYPE } from '@/constants/notificationTypes'
import { DELIVERY_STATUS_MACHINE, ORDER_STATUS_MACHINE } from '@/constants/stateMachines'
import { DELIVERY_STATUS, ORDER_STATUS } from '@/constants/statuses'
import { ID_PREFIX } from '@/utils/id'
import { assertTransition } from '@/utils/stateMachine'

import { API_ERROR_CODE, createApiError } from './api/apiError'
import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'
import { notificationService } from './notificationService'

const revisions = createCrudService('revisions', { idPrefix: ID_PREFIX.REVISION })

// Asking for changes moves the delivery **and** the order, and `orderService`
// already imports this module — so, exactly as `paymentService` does for the
// same reason (Prompt 17), this file keeps its own handles on the two
// collections rather than importing back and making the services graph cyclic.
// Both statuses are still only ever moved through `assertTransition`.
const deliveries = createCrudService('deliveries', {
  idPrefix: ID_PREFIX.DELIVERY,
  timestampField: 'submittedAt',
})
const orders = createCrudService('orders', { idPrefix: ID_PREFIX.ORDER })

const nowIso = () => new Date().toISOString()

/** `conflict` is the contract's code for "not in the right state" (§3.2). */
const invalidState = (message, details) =>
  createApiError(API_ERROR_CODE.CONFLICT, message, details, 409)

/** Runs a status change through its machine, reporting a rejection as `409` (§8.1). */
function transitionTo(machine, from, to, message) {
  try {
    return assertTransition(machine, from, to)
  } catch (failure) {
    throw invalidState(message, { from, to, transition: failure.message })
  }
}

/** A bell item must never fail a revision that has already been recorded. */
async function notifyQuietly(notification) {
  try {
    return await notificationService.notify(notification)
  } catch {
    return null
  }
}

export const revisionService = Object.freeze({
  /**
   * @param {import('./api/listAdapter').ListParams} [params] filters: `orderId`,
   *   `deliveryId`; sort: `createdAt`
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  list: (params = {}) => revisions.list({ sort: 'createdAt', order: SORT_ORDER.DESC, ...params }),

  /**
   * @param {string} id `rev_…`
   * @returns {Promise<object>} the revision
   * @throws {ApiError} `not_found`
   */
  getById: (id) => revisions.getById(id),

  /**
   * Every change request on one order.
   *
   * @param {string} orderId `ord_…`
   * @param {import('./api/listAdapter').ListParams} [params] any filter above
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  listByOrder(orderId, params = {}) {
    return revisionService.list({
      ...params,
      filters: { ...params.filters, orderId },
    })
  },

  /**
   * Records a change request. Created by `deliveryService.requestRevision`
   * (contract §7 operation 7), never on its own.
   *
   * @param {object} payload the new revision
   * @returns {Promise<object>} the created revision
   */
  create: (payload) => revisions.create(payload),

  /**
   * @param {string} id `rev_…`
   * @param {object} patch changed fields only
   * @returns {Promise<object>} the updated revision
   */
  update: (id, patch) => revisions.update(id, patch),

  /* —— workflow operations —————————————————————————————————————————————— */

  /**
   * **Asks the creator for changes** (contract §7 operation 7).
   *
   * The delivered version closes at `revision_requested` — it is never reopened,
   * because the creator's answer is a *new* version (00 §9, and the reason
   * `DELIVERY_STATUS_MACHINE` has no edge back to `submitted`). The order steps
   * back to `revision_requested` and the allowance is spent.
   *
   * **The allowance is the whole point of the guard.** `revisionsIncluded` was
   * agreed in the accepted proposal and priced into the order, so a buyer cannot
   * spend a fourth revision on a two-revision engagement. When it is exhausted
   * the refusal names both numbers, so the screen can explain the limit rather
   * than merely refuse.
   *
   * MOCK-ATOMICITY: four writes with no transaction around them (contract §7).
   * They run revision → delivery → order, so an interruption leaves a recorded
   * request that support can reconcile rather than a spent allowance with
   * nothing to show for it. `revisionsUsed` is read-modify-written here, which
   * two simultaneous requests would lose; Laravel increments it atomically.
   *
   * SECURITY: the ownership check is UX only (00 §11) — Laravel derives the
   * buyer from the session and ignores any client-supplied id (contract §6.11).
   *
   * @param {string} deliveryId `dlv_…` the version being sent back
   * @param {object} options
   * @param {string} options.notes what needs to change — shown to the creator
   * @param {string} [options.actorId] the acting buyer; rejected unless they own
   *   the order
   * @returns {Promise<{revision: object, delivery: object, order: object}>}
   * @throws {ApiError} `conflict` when the order is not `delivered`, when the
   *   version has already been responded to, or when the allowance is spent
   *   (`details: { revisionsUsed, revisionsIncluded }`) · `forbidden` ·
   *   `not_found`
   *
   * **Future endpoint:** `POST /deliveries/:id/revisions` →
   * `{ revision, delivery, order }`, one transaction with the guard and the
   * increment both server-side.
   */
  async requestRevision(deliveryId, { notes, actorId } = {}) {
    const delivery = await deliveries.getById(deliveryId)
    const order = await orders.getById(delivery.orderId)

    if (actorId && order.buyerId !== actorId) {
      throw createApiError(
        API_ERROR_CODE.FORBIDDEN,
        'This order belongs to another account.'
      )
    }
    if (order.status !== ORDER_STATUS.DELIVERED) {
      throw invalidState(
        'This order is not waiting on your review. Reload the page to see where it got to.',
        { from: order.status, to: ORDER_STATUS.REVISION_REQUESTED }
      )
    }

    const used = Number(order.revisionsUsed) || 0
    const included = Number(order.revisionsIncluded) || 0
    if (used >= included) {
      throw invalidState(
        'This order has no revisions left. Raise a dispute if the delivery does not match the brief.',
        { revisionsUsed: used, revisionsIncluded: included }
      )
    }

    const requestedAt = nowIso()

    const revision = await revisions.create({
      orderId: order.id,
      deliveryId: delivery.id,
      // The server derives this from the session; the mock stack has only the
      // caller's word for it, so it falls back to the order's own buyer.
      requestedById: actorId ?? order.buyerId,
      notes,
      resolvedAt: null,
      createdAt: requestedAt,
    })

    const closedVersion = await deliveries.update(delivery.id, {
      status: transitionTo(
        DELIVERY_STATUS_MACHINE,
        delivery.status,
        DELIVERY_STATUS.REVISION_REQUESTED,
        'This delivery has already been responded to.'
      ),
      respondedAt: requestedAt,
    })

    const updatedOrder = await orders.update(order.id, {
      status: transitionTo(
        ORDER_STATUS_MACHINE,
        order.status,
        ORDER_STATUS.REVISION_REQUESTED,
        'This order can no longer be sent back for changes.'
      ),
      revisionsUsed: used + 1,
    })

    const remaining = included - (used + 1)
    await notifyQuietly({
      userId: order.creatorId,
      type: NOTIFICATION_TYPE.REVISION_REQUESTED,
      title: 'Changes requested',
      body:
        `The buyer has asked for changes on “${order.title}”. ` +
        `This was revision ${used + 1} of ${included}` +
        (remaining === 0 ? ', the last one included in this order.' : '.'),
      entityType: 'order',
      entityId: order.id,
    })

    return { revision, delivery: closedVersion, order: updatedOrder }
  },
})

export default revisionService
