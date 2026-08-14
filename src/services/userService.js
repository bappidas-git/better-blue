// Accounts — `docs/api-contract.md` §6.2.
//
// Members reach each other through `creatorProfiles` / `buyerProfiles`; this
// service backs the admin directory, self-service profile edits, and the
// account lookups other services need.

import { ID_PREFIX } from '@/utils/id'

import { createCrudService } from './api/crudFactory'

const users = createCrudService('users', { idPrefix: ID_PREFIX.USER })

/**
 * MOCK-AUTH: JSON Server serialises `users.password` on every response
 * (contract §6.2, §9.4). Nothing above the services layer may ever see it, so
 * it is dropped here on the way out. `authService` (Prompt 09) reads the
 * credential record through `apiClient` directly for the mock sign-in check —
 * it is the one module that needs the field, and the only one.
 *
 * Laravel never serialises the column at all and this function disappears.
 */
function withoutCredentials(user) {
  if (!user || typeof user !== 'object') return user
  const safe = { ...user }
  delete safe.password
  return safe
}

export const userService = Object.freeze({
  /**
   * The user directory (admin).
   *
   * @param {import('./api/listAdapter').ListParams} [params] filters:
   *   `role`, `accountStatus`, `email`, `referredByCode`,
   *   `createdAt_gte`/`createdAt_lte`; sorts: `createdAt`, `lastLoginAt`, `name`
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  async list(params = {}) {
    const result = await users.list(params)
    return { ...result, items: result.items.map(withoutCredentials) }
  },

  /**
   * One account.
   *
   * @param {string} id `usr_…`
   * @returns {Promise<object>} the account, without credentials
   * @throws {ApiError} `not_found`
   */
  async getById(id) {
    return withoutCredentials(await users.getById(id))
  },

  /**
   * Sign-in identifier lookup — email is unique across the platform.
   *
   * @param {string} email exact address
   * @returns {Promise<object|null>} the account, or `null` when unregistered
   */
  async findByEmail(email) {
    if (!email) return null
    const { items } = await users.list({ page: 1, limit: 1, filters: { email } })
    return items.length > 0 ? withoutCredentials(items[0]) : null
  },

  /**
   * Fetches several accounts in one round trip — repeated `id` params are OR'd
   * (contract §4.1). Used wherever a list needs its records' owners.
   *
   * @param {string[]} ids up to 100 account ids
   * @returns {Promise<object[]>} the accounts that exist, in server order
   */
  async listByIds(ids = []) {
    const unique = [...new Set(ids.filter(Boolean))]
    if (unique.length === 0) return []
    const { items } = await users.list({ page: 1, limit: 100, filters: { id: unique } })
    return items.map(withoutCredentials)
  },

  /**
   * Self-update (`name`, `phone`, `avatarUrl`, `notificationPrefs`) or an admin
   * status action (`accountStatus`).
   *
   * `notificationPrefs` is a whole-object replacement — send all seven
   * categories (contract §6.2).
   *
   * @param {string} id `usr_…`
   * @param {object} patch changed fields only
   * @returns {Promise<object>} the updated account
   */
  async update(id, patch) {
    return withoutCredentials(await users.update(id, patch))
  },

  /**
   * Creates an admin account (super admin only — `buyer`/`creator` accounts are
   * created by registration in `authService`).
   *
   * @param {object} payload the new account
   * @returns {Promise<object>} the created account
   */
  async create(payload) {
    return withoutCredentials(await users.create(payload))
  },

  // —— workflow operations (added by later prompts) ——
  // suspendUser / blacklistUser / reactivateUser — Prompt 29 (admin users),
  // each writing an audit entry and an `account_status_changed` notification.
})

export default userService
