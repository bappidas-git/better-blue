// Creator storefronts — `docs/api-contract.md` §6.4. The resource behind the
// discovery grid, and the only public view of a creator.

import { ACCOUNT_STATUS } from '@/constants/statuses'
import { ID_PREFIX } from '@/utils/id'

import { createCrudService } from './api/crudFactory'
import { arrayContains, SORT_ORDER } from './api/listAdapter'
import { portfolioService } from './portfolioService'
import { userService } from './userService'

const creatorProfiles = createCrudService('creatorProfiles', {
  idPrefix: ID_PREFIX.CREATOR_PROFILE,
})

/** Default discovery ordering: best-rated first (contract §6.4). */
const DEFAULT_SORT = 'ratingAvg'

/* -------------------------------------------------------------------------- */
/* Profile completeness                                                       */
/* -------------------------------------------------------------------------- */

/**
 * What "a complete storefront" means, in the order the creator profile screen
 * asks for it — the same shape `BUYER_PROFILE_FIELDS` uses, with one addition:
 * a **weight**.
 *
 * The buyer's seven details are all roughly as consequential as each other, so
 * that helper counts them equally. A creator's are not: a missing payout method
 * means earnings cannot leave escrow at all, while a missing language list
 * costs a line on the About panel. Weighting is how the meter stops telling a
 * creator they are "90% done" when the one field standing between them and
 * getting paid is the empty one.
 *
 *   percent = round(100 × Σ weight(filled) / Σ weight(all))
 *
 * Weights, and why:
 *   4  payoutMethod   no payout method, no way to be paid
 *   3  bio            the thing a buyer actually reads before hiring
 *   2  tagline        the one line on every discovery card
 *   2  categories     decides which briefs this creator is matched to
 *   2  startingPrice  filterable, and sets the buyer's expectation
 *   1  displayName / contentTypes / location / languages / avatarUrl
 *
 * `avatarUrl` lives on `users` rather than the storefront, which is why
 * {@link getCreatorProfileCompleteness} takes both records — the same split
 * `getBuyerProfileCompleteness` handles.
 *
 * This list is the single definition behind the meter on the profile screen and
 * the first step of the creator onboarding checklist, so the two can never
 * disagree about what is still missing.
 */
export const CREATOR_PROFILE_FIELDS = Object.freeze([
  Object.freeze({ key: 'displayName', label: 'Display name', source: 'profile', weight: 1 }),
  Object.freeze({ key: 'tagline', label: 'Tagline', source: 'profile', weight: 2 }),
  Object.freeze({ key: 'bio', label: 'About you', source: 'profile', weight: 3 }),
  Object.freeze({ key: 'categories', label: 'Categories', source: 'profile', weight: 2 }),
  Object.freeze({ key: 'contentTypes', label: 'Content types', source: 'profile', weight: 1 }),
  Object.freeze({ key: 'startingPrice', label: 'Starting price', source: 'profile', weight: 2 }),
  Object.freeze({ key: 'location', label: 'Location', source: 'profile', weight: 1 }),
  Object.freeze({ key: 'languages', label: 'Languages', source: 'profile', weight: 1 }),
  Object.freeze({ key: 'payoutMethod', label: 'Payout method', source: 'profile', weight: 4 }),
  Object.freeze({ key: 'avatarUrl', label: 'Profile photo', source: 'user', weight: 1 }),
])

/**
 * Is this field filled in? One rule per shape, because "empty" means something
 * different for a string, a list, a price, and a payout method.
 */
function hasCreatorValue(key, value) {
  if (key === 'startingPrice') return Number(value) > 0
  if (key === 'payoutMethod') return String(value?.accountMasked ?? '').trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return String(value ?? '').trim().length > 0
}

/**
 * How much of a creator's storefront is filled in.
 *
 * A pure derivation over the two records — no request is made — so the profile
 * screen can recompute it on every keystroke while the same numbers drive the
 * onboarding checklist on the creator overview. Laravel will expose the same
 * figure on `GET /creatorProfiles/:id` as a read-only attribute; when it does,
 * this stays as the client-side preview of an unsaved form.
 *
 * @param {object|null} profile the `creatorProfiles` record (or draft form values)
 * @param {object|null} user the `users` record (or draft form values)
 * @returns {{percent: number, completed: number, total: number,
 *   missing: Array<{key: string, label: string}>}} `completed`/`total` are
 *   **weights**, not field counts — the meter prints the percentage, and the
 *   chips below it name what is missing
 */
export function getCreatorProfileCompleteness(profile, user) {
  const missing = CREATOR_PROFILE_FIELDS.filter((field) => {
    const record = field.source === 'user' ? user : profile
    return !hasCreatorValue(field.key, record?.[field.key])
  })

  const total = CREATOR_PROFILE_FIELDS.reduce((sum, field) => sum + field.weight, 0)
  const missingWeight = missing.reduce((sum, field) => sum + field.weight, 0)
  const completed = total - missingWeight

  return {
    percent: Math.round((completed / total) * 100),
    completed,
    total,
    missing: missing.map(({ key, label }) => ({ key, label })),
  }
}

/* -------------------------------------------------------------------------- */
/* Payout details                                                             */
/* -------------------------------------------------------------------------- */

/** How many trailing digits of an account number survive masking. */
const ACCOUNT_VISIBLE_DIGITS = 4

/**
 * Turns a typed account number into the **only** form BetterBlue keeps.
 *
 * SECURITY (00 §14): the full number is never stored, never sent, and never
 * leaves the form's own component state — this function runs on the way into
 * the patch body, so what reaches the API is `"**** 4821"` and nothing else.
 * That is enough for a creator to recognise which account they nominated, which
 * is all the payout screens (Prompt 25) and the settlement console (Prompt 32)
 * ever display. A real payout integration would exchange the number for a
 * provider token server-side and store that token instead; the masked string
 * stays as the display value either way.
 *
 * @param {string} accountNumber as typed — digits, spaces, and dashes tolerated
 * @returns {string} `"**** 1234"`, or `''` when there are too few digits
 */
export function maskAccountNumber(accountNumber) {
  const digits = String(accountNumber ?? '').replace(/\D/g, '')
  if (digits.length < ACCOUNT_VISIBLE_DIGITS) return ''
  return `**** ${digits.slice(-ACCOUNT_VISIBLE_DIGITS)}`
}

/* -------------------------------------------------------------------------- */
/* Orderings                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Named discovery orderings (contract §6.4 + `recommended`).
 *
 * The discovery UI carries one of these tokens in its `sort` URL parameter and
 * hands it straight back to `search({ ordering })`; which stored column and
 * direction each one resolves to is this module's business, not a page's
 * (00 §10). Tokens are stable, so a shared URL keeps meaning what it meant.
 */
export const CREATOR_ORDERING = Object.freeze({
  RECOMMENDED: 'recommended',
  TOP_RATED: 'top_rated',
  PRICE_LOW_HIGH: 'price_asc',
  PRICE_HIGH_LOW: 'price_desc',
  MOST_ORDERS: 'most_orders',
  FASTEST_RESPONSE: 'response_time',
  NEWEST: 'newest',
})

const ORDERING_QUERY = Object.freeze({
  // `recommended` sorts on `featured` so the editorial picks lead globally, and
  // is then re-ordered by the composite below — see `sortByRecommended`.
  [CREATOR_ORDERING.RECOMMENDED]: { sort: 'featured', order: SORT_ORDER.DESC },
  [CREATOR_ORDERING.TOP_RATED]: { sort: 'ratingAvg', order: SORT_ORDER.DESC },
  [CREATOR_ORDERING.PRICE_LOW_HIGH]: { sort: 'startingPrice', order: SORT_ORDER.ASC },
  [CREATOR_ORDERING.PRICE_HIGH_LOW]: { sort: 'startingPrice', order: SORT_ORDER.DESC },
  [CREATOR_ORDERING.MOST_ORDERS]: { sort: 'completedOrders', order: SORT_ORDER.DESC },
  [CREATOR_ORDERING.FASTEST_RESPONSE]: { sort: 'responseTimeHours', order: SORT_ORDER.ASC },
  [CREATOR_ORDERING.NEWEST]: { sort: 'createdAt', order: SORT_ORDER.DESC },
})

/**
 * Bayesian prior for the `recommended` score: an unrated storefront starts at
 * the marketplace average and needs `PRIOR_WEIGHT` reviews of its own before
 * its rating dominates. Without it a single five-star review outranks a 4.7
 * earned over thirty orders.
 */
const PRIOR_RATING = 4.4
const PRIOR_WEIGHT = 5

function recommendedScore(profile) {
  const rating = Number(profile?.ratingAvg) || 0
  const count = Number(profile?.ratingCount) || 0
  return (rating * count + PRIOR_RATING * PRIOR_WEIGHT) / (count + PRIOR_WEIGHT)
}

/**
 * MOCK-SORT: `recommended` is "featured first, then the rating composite" — two
 * columns in opposite-but-independent directions. JSON Server can express a
 * multi-column `_sort`, but the contract's list parameters carry a *single*
 * `order` (§4.1), so the second column's direction is unreachable without
 * bending the adapter. The page is therefore fetched ordered by `featured` —
 * which is globally correct, and the only part that decides *which* records
 * land on the page — and the composite is applied to the returned page here.
 *
 * The cost: within one featured group, the composite orders each page
 * internally rather than across page boundaries. Laravel replaces the whole
 * thing with `ORDER BY featured DESC, recommendation_score DESC` (or a stored
 * ranking column refreshed on review write), and this function is deleted.
 */
function sortByRecommended(result) {
  const items = [...result.items].sort((a, b) => {
    const featured = Number(Boolean(b.featured)) - Number(Boolean(a.featured))
    if (featured !== 0) return featured

    const score = recommendedScore(b) - recommendedScore(a)
    if (score !== 0) return score

    return (Number(b.completedOrders) || 0) - (Number(a.completedOrders) || 0)
  })
  return { ...result, items }
}

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

/* -------------------------------------------------------------------------- */
/* Portfolio preview enrichment                                               */
/* -------------------------------------------------------------------------- */

/** Thumbnails shown on a discovery card. */
const PREVIEW_LIMIT = 3

/**
 * How many preview requests are in flight at once. A page of cards would
 * otherwise open one connection per creator the instant the grid renders, which
 * on a dozen cards is enough to queue behind the browser's per-host limit and
 * delay every one of them.
 */
const PREVIEW_CONCURRENCY = 4

/** Runs `worker` over `items` with at most `concurrency` promises in flight. */
async function mapWithConcurrency(items, concurrency, worker) {
  let cursor = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      await worker(items[index])
    }
  })
  await Promise.all(runners)
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
   * The storefront as the public profile page needs it: the record plus the
   * owner's account status, so a suspended creator gets the "currently
   * unavailable" screen instead of a live storefront (contract §6.4).
   *
   * MOCK-JOIN: the same gap `withActiveOwnersOnly` closes for the grid, for a
   * single record — `accountStatus` lives on `users` and JSON Server cannot
   * join, so this is a second `GET /users/:id`. It fails **open** for the same
   * reason the grid does: a user endpoint that is down is not evidence that a
   * creator was suspended, and hiding a working storefront over it is the worse
   * error. Suspension is enforced server-side either way (00 §11).
   *
   * > **Laravel** — `GET /creatorProfiles/:id` serialises `profileStatus` from
   * > the joined account (or 404s on a suspended one, if product prefers), and
   * > this second request disappears.
   *
   * @param {string} id `cpr_…`
   * @returns {Promise<object>} the storefront plus `profileStatus`, an
   *   `ACCOUNT_STATUS` value describing the account behind it
   * @throws {ApiError} `not_found`
   */
  async getPublicProfile(id) {
    const profile = await creatorProfiles.getById(id)

    let profileStatus = ACCOUNT_STATUS.ACTIVE
    try {
      const owner = await userService.getById(profile.userId)
      profileStatus = owner?.accountStatus ?? ACCOUNT_STATUS.ACTIVE
    } catch {
      // See above — the storefront is the payload, the status is a safety check.
    }

    return { ...profile, profileStatus }
  },

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
   * @param {string} [params.ordering] a `CREATOR_ORDERING` token — the spelling
   *   discovery uses; resolves to the `sort`/`order` pair below and wins over
   *   them when both are given
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
    ordering,
    sort,
    order,
    search,
    activeOwnersOnly = true,
    filters,
    ...rest
  } = {}) {
    const named = ORDERING_QUERY[ordering]

    const result = await creatorProfiles.list({
      page,
      limit,
      sort: named?.sort ?? sort ?? DEFAULT_SORT,
      order: named?.order ?? order ?? SORT_ORDER.DESC,
      search,
      // Discovery filters are accepted both at the top level (`search({ category })`,
      // which reads naturally at a call site) and under `filters`, which is the
      // standard `ListParams` shape every list hook builds.
      filters: toDiscoveryFilters({ ...rest, ...filters }),
    })

    const visible = activeOwnersOnly ? await withActiveOwnersOnly(result) : result
    return ordering === CREATOR_ORDERING.RECOMMENDED ? sortByRecommended(visible) : visible
  },

  /**
   * Sample work for a page of discovery cards — the three-thumbnail strip
   * (contract §6.5, published items only).
   *
   * MOCK-JOIN: JSON Server has no `include`, so this is one request per creator,
   * capped at `PREVIEW_CONCURRENCY` in flight. It lives here rather than in the
   * cards so no component ends up orchestrating requests (00 §10), and so the
   * whole thing collapses to a single call on migration day.
   *
   * > **Laravel** — one endpoint: `GET /creators?include=preview`, resolving the
   * > strip with an eager-loaded `hasMany … where status = 'published' limit 3`.
   * > Delete this function and read `portfolioPreview` off the search response.
   *
   * Kept separate from `search` on purpose: the grid paints from `search` alone
   * and the strips fill in behind their own skeletons, instead of every card
   * waiting on the slowest thumbnail query.
   *
   * @param {string[]} creatorIds `cpr_…` ids from the current page
   * @param {object} [options]
   * @param {number} [options.limit=3] thumbnails per creator
   * @returns {Promise<Object<string, object[]>>} published items keyed by creator
   *   id — a creator whose lookup failed maps to `[]` rather than rejecting the
   *   whole batch, because a missing strip must not empty the grid
   */
  async listPortfolioPreviews(creatorIds, { limit = PREVIEW_LIMIT } = {}) {
    const ids = [...new Set((creatorIds ?? []).filter(Boolean))]
    const previews = {}

    await mapWithConcurrency(ids, PREVIEW_CONCURRENCY, async (creatorId) => {
      try {
        const { items } = await portfolioService.listPublished(creatorId, { page: 1, limit })
        previews[creatorId] = items
      } catch {
        previews[creatorId] = []
      }
    })

    return previews
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

  /**
   * Opens or closes a storefront to new work — the switch on the creator
   * overview and the profile screen (Prompt 21 §4.4).
   *
   * Named rather than left as a bare `update({ availability })` because it is
   * one of the few edits with a **marketplace-wide** consequence: `search`
   * filters on `availability`, so turning it off removes the storefront from
   * discovery for as long as it stays off (contract §6.4). Orders already in
   * flight are untouched — this closes the front door, it does not abandon the
   * work behind it.
   *
   * @param {string} id `cpr_…`
   * @param {boolean} availability `true` to accept new requests
   * @returns {Promise<object>} the updated storefront
   *
   * **Future endpoint:** `PATCH /creatorProfiles/:id` → `{ availability }`,
   * authorised against the owner of the storefront (00 §11).
   */
  setAvailability: (id, availability) =>
    creatorProfiles.update(id, { availability: Boolean(availability) }),
})

export default creatorProfileService
