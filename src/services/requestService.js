// Buyer briefs — `docs/api-contract.md` §6.7. The demand side of the
// marketplace and the source of the public request board.

import { REQUEST_STATUS } from '@/constants/statuses'
import { ID_PREFIX } from '@/utils/id'

import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'

const contentRequests = createCrudService('contentRequests', { idPrefix: ID_PREFIX.REQUEST })

/** Newest published brief first (contract §6.7). */
const DEFAULT_SORT = 'publishedAt'

export const requestService = Object.freeze({
  /**
   * @param {import('./api/listAdapter').ListParams} [params] filters:
   *   `buyerId`, `status`, `categoryId`, `contentType`, `usageRights`,
   *   `budgetMin_gte`/`budgetMax_lte`, `deadline_gte`/`deadline_lte`;
   *   sorts: `publishedAt`, `createdAt`, `deadline`, `budgetMax`, `proposalsCount`
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  list: (params = {}) =>
    contentRequests.list({ sort: DEFAULT_SORT, order: SORT_ORDER.DESC, ...params }),

  /**
   * @param {string} id `req_…`
   * @returns {Promise<object>} the brief
   * @throws {ApiError} `not_found`
   */
  getById: (id) => contentRequests.getById(id),

  /**
   * The public request board — open briefs only.
   *
   * @param {import('./api/listAdapter').ListParams} [params] any filter above
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  listOpen(params = {}) {
    return requestService.list({
      ...params,
      filters: { ...params.filters, status: REQUEST_STATUS.OPEN },
    })
  },

  /**
   * "My requests" — every brief a buyer owns, drafts included.
   *
   * @param {string} buyerId `usr_…`
   * @param {import('./api/listAdapter').ListParams} [params] any filter above
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  listByBuyer(buyerId, params = {}) {
    return requestService.list({
      sort: 'createdAt',
      order: SORT_ORDER.DESC,
      ...params,
      filters: { ...params.filters, buyerId },
    })
  },

  /**
   * Creates a brief. Starts as `draft`; publishing is a `PATCH` to
   * `{ status: 'open', publishedAt }`.
   *
   * @param {object} payload the new brief
   * @returns {Promise<object>} the created brief
   */
  create: (payload) => contentRequests.create(payload),

  /**
   * Edits, publishes, or cancels a brief. `proposalsCount` and
   * `awardedProposalId` are derived and never sent by a feature — awarding
   * happens inside `orderService.acceptProposal` (contract §7).
   *
   * @param {string} id `req_…`
   * @param {object} patch changed fields only
   * @returns {Promise<object>} the updated brief
   */
  update: (id, patch) => contentRequests.update(id, patch),

  // —— workflow operations (added by later prompts) ——
  // publishRequest / cancelRequest / closeRequest — Prompt 12 (requests),
  // enforcing REQUEST_STATUS_MACHINE via `utils/stateMachine#assertTransition`.
})

export default requestService
