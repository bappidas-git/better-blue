// Creator offers on a brief — `docs/api-contract.md` §6.8.
//
// Proposals are never public: only the buyer who posted the brief and the
// creator who sent the offer may read one. `creatorId` points at `users.id`.

import { ID_PREFIX } from '@/utils/id'

import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'

const proposals = createCrudService('proposals', { idPrefix: ID_PREFIX.PROPOSAL })

/** Newest offer first (contract §6.8). */
const DEFAULT_SORT = 'createdAt'

export const proposalService = Object.freeze({
  /**
   * @param {import('./api/listAdapter').ListParams} [params] filters:
   *   `requestId`, `creatorId`, `status`, `price_gte`/`price_lte`;
   *   sorts: `createdAt`, `price`, `deliveryDays`
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  list: (params = {}) => proposals.list({ sort: DEFAULT_SORT, order: SORT_ORDER.DESC, ...params }),

  /**
   * @param {string} id `prp_…`
   * @returns {Promise<object>} the offer
   * @throws {ApiError} `not_found`
   */
  getById: (id) => proposals.getById(id),

  /**
   * Every offer on one brief — the buyer's comparison view.
   *
   * @param {string} requestId `req_…`
   * @param {import('./api/listAdapter').ListParams} [params] any filter above
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  listByRequest(requestId, params = {}) {
    return proposalService.list({
      ...params,
      filters: { ...params.filters, requestId },
    })
  },

  /**
   * "My proposals" — every offer a creator has sent.
   *
   * @param {string} creatorId `usr_…`
   * @param {import('./api/listAdapter').ListParams} [params] any filter above
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  listByCreator(creatorId, params = {}) {
    return proposalService.list({
      ...params,
      filters: { ...params.filters, creatorId },
    })
  },

  /**
   * Guards the "one proposal per creator per request" rule (contract §6.8)
   * before the submit form opens.
   *
   * MOCK-GUARD: this is a read-before-write check, so two submissions racing
   * each other can both pass it. Laravel makes it a
   * `UNIQUE (request_id, creator_id)` constraint.
   *
   * @param {string} requestId `req_…`
   * @param {string} creatorId `usr_…`
   * @returns {Promise<boolean>} `true` when an offer already exists
   */
  async hasCreatorProposed(requestId, creatorId) {
    if (!requestId || !creatorId) return false
    const { total } = await proposals.list({
      page: 1,
      limit: 1,
      filters: { requestId, creatorId },
    })
    return total > 0
  },

  /**
   * Submits an offer. `sampleItemIds` must reference published portfolio items
   * belonging to the proposing creator.
   *
   * @param {object} payload the new offer
   * @returns {Promise<object>} the created offer
   */
  create: (payload) => proposals.create(payload),

  /**
   * Withdraws (creator), shortlists, or declines (buyer) an offer.
   * **Accepting is not a `PATCH`** — it creates an order, so it goes through
   * `orderService.acceptProposal` (contract §7).
   *
   * @param {string} id `prp_…`
   * @param {object} patch changed fields only
   * @returns {Promise<object>} the updated offer
   */
  update: (id, patch) => proposals.update(id, patch),

  // —— workflow operations (added by later prompts) ——
  // submitProposal / withdrawProposal / shortlistProposal / declineProposal —
  // Prompt 13 (proposals). `submitProposal` also bumps the brief's
  // `proposalsCount` and notifies the buyer.
})

export default proposalService
