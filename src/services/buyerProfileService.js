// Buyer business profiles — `docs/api-contract.md` §6.3. One per buyer account.

import { ID_PREFIX } from '@/utils/id'

import { createCrudService } from './api/crudFactory'

const buyerProfiles = createCrudService('buyerProfiles', { idPrefix: ID_PREFIX.BUYER_PROFILE })

/**
 * What "a complete business profile" means, in the order the profile screen
 * asks for it. Two of the seven live on the account rather than the profile
 * (`users.name`, `users.phone`), which is why
 * {@link getBuyerProfileCompleteness} takes both records.
 *
 * The list is the single definition behind the meter on the profile screen and
 * the first step of the buyer onboarding checklist, so the two can never
 * disagree about what is still missing.
 */
export const BUYER_PROFILE_FIELDS = Object.freeze([
  Object.freeze({ key: 'companyName', label: 'Company name', source: 'profile' }),
  Object.freeze({ key: 'industry', label: 'Industry', source: 'profile' }),
  Object.freeze({ key: 'location', label: 'Location', source: 'profile' }),
  Object.freeze({ key: 'website', label: 'Website', source: 'profile' }),
  Object.freeze({ key: 'bio', label: 'About your business', source: 'profile' }),
  Object.freeze({ key: 'name', label: 'Contact name', source: 'user' }),
  Object.freeze({ key: 'phone', label: 'Contact phone', source: 'user' }),
])

const hasValue = (value) => String(value ?? '').trim().length > 0

/**
 * How much of a buyer's business profile is filled in.
 *
 * A pure derivation over the two records — no request is made — so the profile
 * screen can recompute it on every keystroke while the same numbers drive the
 * onboarding checklist on the overview. Laravel will expose the same figure on
 * `GET /buyerProfiles/:id` as a read-only attribute; when it does, this stays
 * as the client-side preview of an unsaved form.
 *
 * @param {object|null} profile the `buyerProfiles` record (or draft form values)
 * @param {object|null} user the `users` record (or draft form values)
 * @returns {{percent: number, completed: number, total: number, missing: Array<{key: string, label: string}>}}
 */
export function getBuyerProfileCompleteness(profile, user) {
  const missing = BUYER_PROFILE_FIELDS.filter((field) => {
    const record = field.source === 'user' ? user : profile
    return !hasValue(record?.[field.key])
  }).map(({ key, label }) => ({ key, label }))

  const total = BUYER_PROFILE_FIELDS.length
  const completed = total - missing.length

  return { percent: Math.round((completed / total) * 100), completed, total, missing }
}

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
