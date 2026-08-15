// Delivered versions — `docs/api-contract.md` §6.10.
//
// One record per delivered **version**: asking for changes closes that version
// at `revision_requested`, and the creator's next submission is a new record.

import { NOTIFICATION_TYPE } from '@/constants/notificationTypes'
import { DELIVERY_STATUS_MACHINE } from '@/constants/stateMachines'
import { DELIVERY_STATUS, ORDER_STATUS } from '@/constants/statuses'
import { ID_PREFIX } from '@/utils/id'
import { assertTransition } from '@/utils/stateMachine'

import { API_ERROR_CODE, createApiError } from './api/apiError'
import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'
import { notificationService } from './notificationService'
// CYCLE: `orderService` imports this module for its delivery reads, and
// `acceptDelivery` calls back into it to complete the order — the two halves of
// one intention that genuinely live in different files (contract §7 operation
// 6). Neither module touches the other at evaluation time; both dereference
// only inside function bodies, which is what makes the cycle harmless. Laravel
// collapses the pair into one controller and it disappears.
import { orderService } from './orderService'

const deliveries = createCrudService('deliveries', {
  idPrefix: ID_PREFIX.DELIVERY,
  // Deliveries are stamped `submittedAt`, not `createdAt` (contract §6.10).
  timestampField: 'submittedAt',
})

/** Latest version first (contract §6.10). */
const DEFAULT_SORT = 'version'

const nowIso = () => new Date().toISOString()

/** A bell item must never fail a delivery that has already been accepted. */
async function notifyQuietly(notification) {
  try {
    return await notificationService.notify(notification)
  } catch {
    return null
  }
}

export const deliveryService = Object.freeze({
  /**
   * @param {import('./api/listAdapter').ListParams} [params] filters: `orderId`,
   *   `status`; sorts: `version`, `submittedAt`
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  list: (params = {}) => deliveries.list({ sort: DEFAULT_SORT, order: SORT_ORDER.DESC, ...params }),

  /**
   * @param {string} id `dlv_…`
   * @returns {Promise<object>} the version
   * @throws {ApiError} `not_found`
   */
  getById: (id) => deliveries.getById(id),

  /**
   * Every version on one order, newest first — the delivery timeline.
   *
   * @param {string} orderId `ord_…`
   * @param {import('./api/listAdapter').ListParams} [params] any filter above
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  listByOrder(orderId, params = {}) {
    return deliveryService.list({
      ...params,
      filters: { ...params.filters, orderId },
    })
  },

  /**
   * Records a delivered version. `files` come from `uploadService` and are
   * stored inline (contract §5, §6.10).
   *
   * @param {object} payload the new version
   * @returns {Promise<object>} the created version
   */
  create: (payload) => deliveries.create(payload),

  /**
   * @param {string} id `dlv_…`
   * @param {object} patch changed fields only
   * @returns {Promise<object>} the updated version
   */
  update: (id, patch) => deliveries.update(id, patch),

  /* —— workflow operations —————————————————————————————————————————————— */

  /**
   * **Accepts a delivered version** — the click that completes an order and pays
   * a creator (contract §7 operation 6).
   *
   * Irreversible by design, and the reason the screen in front of it asks twice:
   * accepting is the buyer saying the work is what they asked for, which is
   * precisely what releases money BetterBlue is holding on their behalf. There
   * is no un-accept; a problem found afterwards is a dispute.
   *
   * The version closes at `accepted`, then `orderService.completeOrder` releases
   * the escrow and closes the order. That order matters: a version marked
   * accepted with the money still held is recoverable — support releases it —
   * whereas money released against a version nobody accepted is not.
   *
   * SECURITY: the ownership check is UX only (00 §11). Laravel scopes the
   * operation to the signed-in buyer as well.
   *
   * @param {string} deliveryId `dlv_…`
   * @param {object} [options]
   * @param {string} [options.actorId] the acting buyer — rejected unless they
   *   own the order
   * @returns {Promise<{delivery: object, order: object, payment: object|null,
   *   creatorEarnings: number|null}>} everything the success screen renders
   * @throws {ApiError} `conflict` when the version has already been responded to
   *   or the order has moved on · `forbidden` · `not_found`
   *
   * **Future endpoint:** `POST /deliveries/:id/accept` →
   * `{ delivery, order, payment }`, all of it in one transaction.
   *
   * Auto-acceptance after `platformSettings.general.autoAcceptDays` is a
   * **scheduled job** server-side (contract §7). The mock era only *shows* the
   * date it would fall on — nothing here runs on a timer.
   */
  async acceptDelivery(deliveryId, { actorId } = {}) {
    const delivery = await deliveries.getById(deliveryId)
    const order = await orderService.getById(delivery.orderId)

    if (actorId && order.buyerId !== actorId) {
      throw createApiError(API_ERROR_CODE.FORBIDDEN, 'This order belongs to another account.')
    }
    if (delivery.status !== DELIVERY_STATUS.SUBMITTED) {
      throw createApiError(
        API_ERROR_CODE.CONFLICT,
        'This delivery has already been responded to. Reload the page to see where it got to.',
        { from: delivery.status, to: DELIVERY_STATUS.ACCEPTED },
        409
      )
    }
    if (order.status !== ORDER_STATUS.DELIVERED) {
      throw createApiError(
        API_ERROR_CODE.CONFLICT,
        'This order is not waiting on your review. Reload the page to see where it got to.',
        { from: order.status, to: ORDER_STATUS.COMPLETED },
        409
      )
    }

    let acceptedStatus
    try {
      acceptedStatus = assertTransition(
        DELIVERY_STATUS_MACHINE,
        delivery.status,
        DELIVERY_STATUS.ACCEPTED
      )
    } catch (failure) {
      throw createApiError(
        API_ERROR_CODE.CONFLICT,
        'This delivery can no longer be accepted.',
        { from: delivery.status, to: DELIVERY_STATUS.ACCEPTED, transition: failure.message },
        409
      )
    }

    const accepted = await deliveries.update(delivery.id, {
      status: acceptedStatus,
      respondedAt: nowIso(),
    })

    const completion = await orderService.completeOrder(order.id, {
      actor: actorId ? { id: actorId } : undefined,
    })

    await notifyQuietly({
      userId: order.creatorId,
      type: NOTIFICATION_TYPE.DELIVERY_ACCEPTED,
      title: 'Delivery accepted',
      body:
        `The buyer accepted version ${delivery.version} of “${order.title}”. ` +
        'The escrow has been released to you.',
      entityType: 'order',
      entityId: order.id,
    })

    return {
      delivery: accepted,
      order: completion.order,
      payment: completion.payment,
      creatorEarnings: completion.creatorEarnings,
    }
  },
})

export default deliveryService
