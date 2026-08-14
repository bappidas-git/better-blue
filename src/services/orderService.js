// Orders — `docs/api-contract.md` §6.9. The funded engagement, and the spine of
// the whole workflow: one order = one request + one accepted proposal.

import { ID_PREFIX } from '@/utils/id'

import { API_ERROR_CODE } from './api/apiError'
import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'
import { deliveryService } from './deliveryService'
import { paymentService } from './paymentService'
import { proposalService } from './proposalService'
import { requestService } from './requestService'
import { revisionService } from './revisionService'

const orders = createCrudService('orders', { idPrefix: ID_PREFIX.ORDER })

/** Newest order first (contract §6.9). */
const DEFAULT_SORT = 'createdAt'

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

  // —— workflow operations (added by later prompts) ——
  // acceptProposal — Prompt 15 (orders), contract §7 operation 1.
  // cancelOrder — Prompt 15, refunding the payment when the order was funded.
})

export default orderService
