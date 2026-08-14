// Creator storefronts — `docs/api-contract.md` §6.4. The resource behind the
// discovery grid, and the only public view of a creator.

import { ACCOUNT_STATUS } from '@/constants/statuses'
import { ID_PREFIX } from '@/utils/id'

import { createCrudService } from './api/crudFactory'
import { arrayContains, SORT_ORDER } from './api/listAdapter'
import { userService } from './userService'

const creatorProfiles = createCrudService('creatorProfiles', {
  idPrefix: ID_PREFIX.CREATOR_PROFILE,
})

/** Default discovery ordering: best-rated first (contract §6.4). */
const DEFAULT_SORT = 'ratingAvg'

/**
 * Translates the contract's discovery filters (§6.4) onto the stored fields.
 * Callers pass what the UI knows — `category`, `priceMin`, `ratingMin` — and
 * never the field names underneath.
 */
function toDiscoveryFilters({
  availability,
  category,
  contentType,
  priceMin,
  priceMax,
  ratingMin,
  verified,
  featured,
  ...rest
} = {}) {
  const filters = { ...rest }

  if (availability !== undefined) filters.availability = availability
  if (verified !== undefined) filters.verified = verified
  if (featured !== undefined) filters.featured = featured
  // `categories` and `contentTypes` are arrays on the record, so membership —
  // not equality — is what the adapter has to express.
  if (category) filters.categories = arrayContains(category)
  if (contentType) filters.contentTypes = arrayContains(contentType)
  if (priceMin !== undefined && priceMin !== '') filters.startingPrice_gte = priceMin
  if (priceMax !== undefined && priceMax !== '') filters.startingPrice_lte = priceMax
  if (ratingMin !== undefined && ratingMin !== '') filters.ratingAvg_gte = ratingMin

  return filters
}

/**
 * MOCK-JOIN: a suspended creator's storefront must disappear from discovery,
 * but `accountStatus` lives on `users` and JSON Server cannot join (contract
 * §6.4). So the page is fetched, then one batched `GET /users?id=…&id=…` drops
 * profiles whose owner is not `active`.
 *
 * The cost: a second round trip, and a `total` that is approximate on pages
 * where a profile is dropped. Laravel replaces both with a single
 * `join users … where account_status = 'active'`.
 */
async function withActiveOwnersOnly(result) {
  const userIds = result.items.map((profile) => profile.userId).filter(Boolean)
  if (userIds.length === 0) return result

  let activeIds
  try {
    const owners = await userService.listByIds(userIds)
    activeIds = new Set(
      owners
        .filter((owner) => owner.accountStatus === ACCOUNT_STATUS.ACTIVE)
        .map((owner) => owner.id)
    )
  } catch {
    // The owner lookup is a safety filter, not the payload. If it fails, show
    // the profiles rather than an empty grid — the same records the public
    // profile pages already serve.
    return result
  }

  const items = result.items.filter((profile) => activeIds.has(profile.userId))
  return { ...result, items, total: Math.max(result.total - (result.items.length - items.length), items.length) }
}

export const creatorProfileService = Object.freeze({
  /**
   * Raw listing without the discovery filter mapping — prefer `search`.
   *
   * @param {import('./api/listAdapter').ListParams} [params]
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  list: (params) => creatorProfiles.list(params),

  /**
   * @param {string} id `cpr_…`
   * @returns {Promise<object>} the public storefront
   * @throws {ApiError} `not_found`
   */
  getById: (id) => creatorProfiles.getById(id),

  /**
   * The profile behind an account.
   *
   * @param {string} userId `usr_…`
   * @returns {Promise<object|null>} the profile, or `null` when there is none
   */
  async getByUserId(userId) {
    if (!userId) return null
    const { items } = await creatorProfiles.list({ page: 1, limit: 1, filters: { userId } })
    return items[0] ?? null
  },

  /**
   * The discovery grid (contract §6.4).
   *
   * @param {object} [params]
   * @param {number} [params.page=1]
   * @param {number} [params.limit=12]
   * @param {string} [params.sort='ratingAvg'] `ratingAvg` | `startingPrice` |
   *   `completedOrders` | `responseTimeHours` | `createdAt`
   * @param {'asc'|'desc'} [params.order='desc']
   * @param {string} [params.search] matches `displayName`, `tagline`, `bio`, `location`
   * @param {boolean} [params.availability] only creators accepting work
   * @param {string|string[]} [params.category] `cat_…` (repeat for OR)
   * @param {string|string[]} [params.contentType] `photo` | `video` | `bundle`
   * @param {number} [params.priceMin] inclusive `startingPrice` floor
   * @param {number} [params.priceMax] inclusive `startingPrice` ceiling
   * @param {number} [params.ratingMin] inclusive `ratingAvg` floor, e.g. `4.5`
   * @param {boolean} [params.verified]
   * @param {boolean} [params.featured]
   * @param {boolean} [params.activeOwnersOnly=true] hide storefronts whose
   *   account is suspended, blacklisted, or deactivated
   * @param {object} [params.filters] the same discovery filters, nested — this
   *   is the shape `usePaginatedQuery` passes, and it wins over the top-level
   *   spelling when both are present
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  async search({
    page,
    limit,
    sort,
    order,
    search,
    activeOwnersOnly = true,
    filters,
    ...rest
  } = {}) {
    const result = await creatorProfiles.list({
      page,
      limit,
      sort: sort ?? DEFAULT_SORT,
      order: order ?? SORT_ORDER.DESC,
      search,
      // Discovery filters are accepted both at the top level (`search({ category })`,
      // which reads naturally at a call site) and under `filters`, which is the
      // standard `ListParams` shape every list hook builds.
      filters: toDiscoveryFilters({ ...rest, ...filters }),
    })
    return activeOwnersOnly ? withActiveOwnersOnly(result) : result
  },

  /**
   * Featured creators for the landing page and empty states.
   *
   * @param {number} [limit=6] how many to return
   * @returns {Promise<object[]>} featured storefronts, best-rated first
   */
  async listFeatured(limit = 6) {
    const { items } = await creatorProfileService.search({
      page: 1,
      limit,
      featured: true,
      sort: DEFAULT_SORT,
      order: SORT_ORDER.DESC,
    })
    return items
  },

  /**
   * Created alongside the account at registration (contract §2.1).
   *
   * @param {object} payload the new storefront
   * @returns {Promise<object>} the created storefront
   */
  create: (payload) => creatorProfiles.create(payload),

  /**
   * Edits the storefront. `ratingAvg`, `ratingCount`, and `completedOrders` are
   * derived and read-only; `verified` and `featured` are admin-only.
   *
   * @param {string} id `cpr_…`
   * @param {object} patch changed fields only
   * @returns {Promise<object>} the updated storefront
   */
  update: (id, patch) => creatorProfiles.update(id, patch),
})

export default creatorProfileService
