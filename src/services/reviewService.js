// Buyer ratings — `docs/api-contract.md` §6.18. One review per order, only on
// completed orders, and never editable.

import { ID_PREFIX } from '@/utils/id'

import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'

const reviews = createCrudService('reviews', { idPrefix: ID_PREFIX.REVIEW })

export const reviewService = Object.freeze({
  /**
   * @param {import('./api/listAdapter').ListParams} [params] filters:
   *   `creatorId`, `buyerId`, `orderId`, `rating`, `rating_gte`;
   *   sorts: `createdAt`, `rating`
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  list: (params = {}) => reviews.list({ sort: 'createdAt', order: SORT_ORDER.DESC, ...params }),

  /**
   * @param {string} id `rvw_…`
   * @returns {Promise<object>} the review
   * @throws {ApiError} `not_found`
   */
  getById: (id) => reviews.getById(id),

  /**
   * The reviews shown on a creator's public profile.
   *
   * @param {string} creatorId `usr_…`
   * @param {import('./api/listAdapter').ListParams} [params] any filter above
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  listByCreator(creatorId, params = {}) {
    return reviewService.list({ ...params, filters: { ...params.filters, creatorId } })
  },

  /**
   * The review left on one order — the "already reviewed" guard, and what the
   * order detail page renders once it exists.
   *
   * @param {string} orderId `ord_…`
   * @returns {Promise<object|null>} the review, or `null` when there is none
   */
  async getByOrderId(orderId) {
    if (!orderId) return null
    const { items } = await reviews.list({ page: 1, limit: 1, filters: { orderId } })
    return items[0] ?? null
  },

  /**
   * Leaves a review. `buyerId`, `creatorId`, and `requestId` are derived from
   * the order (contract §6.18).
   *
   * @param {object} payload the new review
   * @returns {Promise<object>} the created review
   */
  create: (payload) => reviews.create(payload),

  // —— workflow operations (added by later prompts) ——
  // submitReview — Prompt 21 (reviews): guards "completed order, not yet
  // reviewed", then recomputes the creator's `ratingAvg`/`ratingCount`, which
  // nothing recalculates server-side in the mock era (contract §6.18).
})

export default reviewService
