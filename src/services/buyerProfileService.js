// Buyer business profiles — `docs/api-contract.md` §6.3. One per buyer account.

import { ID_PREFIX } from '@/utils/id'

import { createCrudService } from './api/crudFactory'

const buyerProfiles = createCrudService('buyerProfiles', { idPrefix: ID_PREFIX.BUYER_PROFILE })

export const buyerProfileService = Object.freeze({
  /**
   * @param {import('./api/listAdapter').ListParams} [params] filters: `userId`,
   *   `industry`; sorts: `createdAt`, `totalSpent`
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  list: (params) => buyerProfiles.list(params),

  /**
   * @param {string} id `bpr_…`
   * @returns {Promise<object>} the business profile
   * @throws {ApiError} `not_found`
   */
  getById: (id) => buyerProfiles.getById(id),

  /**
   * The profile behind an account — the lookup every buyer surface starts from.
   *
   * @param {string} userId `usr_…`
   * @returns {Promise<object|null>} the profile, or `null` when there is none
   */
  async getByUserId(userId) {
    if (!userId) return null
    const { items } = await buyerProfiles.list({ page: 1, limit: 1, filters: { userId } })
    return items[0] ?? null
  },

  /**
   * Created alongside the account at registration, so a buyer is never left
   * without a profile (contract §2.1).
   *
   * @param {object} payload the new profile
   * @returns {Promise<object>} the created profile
   */
  create: (payload) => buyerProfiles.create(payload),

  /**
   * Edits business details. `totalSpent` is derived and read-only.
   *
   * @param {string} id `bpr_…`
   * @param {object} patch changed fields only
   * @returns {Promise<object>} the updated profile
   */
  update: (id, patch) => buyerProfiles.update(id, patch),
})

export default buyerProfileService
