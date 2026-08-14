// Trust & Safety casework — `docs/api-contract.md` §6.16, §6.17.

import { ID_PREFIX } from '@/utils/id'

import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'

const disputes = createCrudService('disputes', { idPrefix: ID_PREFIX.DISPUTE })
const disputeMessages = createCrudService('disputeMessages', {
  idPrefix: ID_PREFIX.DISPUTE_MESSAGE,
})

/** Newest-first comparison on an ISO timestamp field. */
const byCreatedAtDesc = (a, b) =>
  String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))

export const disputeService = Object.freeze({
  /**
   * My disputes, or the case queue (admin).
   *
   * @param {import('./api/listAdapter').ListParams} [params] filters: `orderId`,
   *   `raisedById`, `againstId`, `assignedAdminId`, `status`, `category`,
   *   `createdAt_gte`/`createdAt_lte`; sorts: `createdAt`, `updatedAt`
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  list: (params = {}) => disputes.list({ sort: 'createdAt', order: SORT_ORDER.DESC, ...params }),

  /**
   * @param {string} id `dsp_…`
   * @returns {Promise<object>} the case
   * @throws {ApiError} `not_found`
   */
  getById: (id) => disputes.getById(id),

  /**
   * Every case a member is party to, on either side.
   *
   * MOCK-QUERY: `raisedById` and `againstId` are separate fields and JSON
   * Server has no `OR` across two of them, so this is two requests merged
   * client-side — which also makes the merged `total` approximate. Laravel does
   * it in one `where(raised_by_id, $id)->orWhere(against_id, $id)`.
   *
   * @param {string} userId `usr_…`
   * @param {import('./api/listAdapter').ListParams} [params] any filter above
   * @returns {Promise<import('./api/listAdapter').ListResult>} newest first
   */
  async listByUser(userId, params = {}) {
    const [raised, against] = await Promise.all([
      disputeService.list({ ...params, filters: { ...params.filters, raisedById: userId } }),
      disputeService.list({ ...params, filters: { ...params.filters, againstId: userId } }),
    ])

    const byId = new Map()
    raised.items.concat(against.items).forEach((dispute) => byId.set(dispute.id, dispute))
    const items = Array.from(byId.values()).sort(byCreatedAtDesc)

    return { items, total: items.length, page: raised.page, limit: raised.limit }
  },

  /**
   * The case thread.
   *
   * **This is not access control.** Filtering `internal` on the client keeps
   * admin notes out of the UI, but JSON Server still puts them on the wire
   * (contract §6.17) — the single most important thing for the Laravel
   * developer to enforce server-side.
   *
   * @param {string} disputeId `dsp_…`
   * @param {object} [options]
   * @param {boolean} [options.includeInternal=false] admin view — include internal notes
   * @returns {Promise<import('./api/listAdapter').ListResult>} oldest first
   */
  async listMessages(disputeId, { includeInternal = false, ...params } = {}) {
    const result = await disputeMessages.list({
      sort: 'createdAt',
      order: SORT_ORDER.ASC,
      limit: 100,
      ...params,
      filters: {
        ...params.filters,
        disputeId,
        ...(includeInternal ? {} : { internal: false }),
      },
    })

    if (includeInternal) return result
    // Filtered again defensively before anything renders.
    return { ...result, items: result.items.filter((message) => message.internal !== true) }
  },

  /**
   * Posts a message on a case. `internal: true` is admin-only.
   *
   * @param {object} payload the new message
   * @returns {Promise<object>} the created message
   */
  createMessage: (payload) => disputeMessages.create(payload),

  /**
   * Opens a case. Moving the order to `disputed` and holding the payment are
   * part of the workflow operation in Prompt 19, not of this write.
   *
   * @param {object} payload the new case
   * @returns {Promise<object>} the created case
   */
  create: (payload) => disputes.create(payload),

  /**
   * Assigns, moves status, or closes a case (admin), following
   * `DISPUTE_STATUS_MACHINE`.
   *
   * @param {string} id `dsp_…`
   * @param {object} patch changed fields only
   * @returns {Promise<object>} the updated case
   */
  update: (id, patch) => disputes.update(id, patch),

  // —— workflow operations (added by later prompts) ——
  // openDispute / postMessage — Prompt 19 (disputes).
  // resolveDispute — Prompt 33 (admin disputes), contract §7 operation 8:
  // release, full refund, or partial refund plus the audit entry.
})

export default disputeService
