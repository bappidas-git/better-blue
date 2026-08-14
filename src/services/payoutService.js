// Creator settlements — `docs/api-contract.md` §6.15.

import { ID_PREFIX } from '@/utils/id'

import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'

const payouts = createCrudService('payouts', {
  idPrefix: ID_PREFIX.PAYOUT,
  // Payouts are stamped `requestedAt`, not `createdAt` (contract §6.15).
  timestampField: 'requestedAt',
})

export const payoutService = Object.freeze({
  /**
   * Payout history (own) or the settlement queue (admin).
   *
   * @param {import('./api/listAdapter').ListParams} [params] filters:
   *   `creatorId`, `status`, `requestedAt_gte`/`requestedAt_lte`;
   *   sorts: `requestedAt`, `amount`
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  list: (params = {}) => payouts.list({ sort: 'requestedAt', order: SORT_ORDER.DESC, ...params }),

  /**
   * @param {string} id `pyo_…`
   * @returns {Promise<object>} the settlement
   * @throws {ApiError} `not_found`
   */
  getById: (id) => payouts.getById(id),

  /**
   * A creator's settlements.
   *
   * @param {string} creatorId `usr_…`
   * @param {import('./api/listAdapter').ListParams} [params] any filter above
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  listByCreator(creatorId, params = {}) {
    return payoutService.list({ ...params, filters: { ...params.filters, creatorId } })
  },

  /**
   * Records a settlement request. `method` is snapshotted onto the row so a
   * later change of bank details cannot rewrite history (contract §6.15).
   *
   * @param {object} payload the new settlement
   * @returns {Promise<object>} the created settlement
   */
  create: (payload) => payouts.create(payload),

  /**
   * Advances a settlement's status (admin), following `PAYOUT_STATUS_MACHINE`.
   * Only a `paid` payout writes a `payout` ledger row.
   *
   * @param {string} id `pyo_…`
   * @param {object} patch changed fields only
   * @returns {Promise<object>} the updated settlement
   */
  update: (id, patch) => payouts.update(id, patch),

  // —— workflow operations (added by later prompts) ——
  // requestPayout — Prompt 18 (earnings), contract §7 operation 11: validates
  // the amount against the available balance and `payoutMinAmount`.
  // processPayout / markPaid / rejectPayout — Prompt 31 (admin finance).
})

export default payoutService
