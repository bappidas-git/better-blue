// Delivered versions — `docs/api-contract.md` §6.10.
//
// One record per delivered **version**: asking for changes closes that version
// at `revision_requested`, and the creator's next submission is a new record.

import { ID_PREFIX } from '@/utils/id'

import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'

const deliveries = createCrudService('deliveries', {
  idPrefix: ID_PREFIX.DELIVERY,
  // Deliveries are stamped `submittedAt`, not `createdAt` (contract §6.10).
  timestampField: 'submittedAt',
})

/** Latest version first (contract §6.10). */
const DEFAULT_SORT = 'version'

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

  // —— workflow operations (added by later prompts) ——
  // submitDelivery / acceptDelivery / requestRevision — Prompt 16 (deliveries),
  // contract §7 operations 5–7. `acceptDelivery` also releases escrow.
})

export default deliveryService
