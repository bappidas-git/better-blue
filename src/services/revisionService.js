// Buyer change requests — `docs/api-contract.md` §6.11. One per revision
// asked for against a specific delivered version.

import { ID_PREFIX } from '@/utils/id'

import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'

const revisions = createCrudService('revisions', { idPrefix: ID_PREFIX.REVISION })

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
})

export default revisionService
