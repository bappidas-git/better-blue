// Marketplace taxonomy — `docs/api-contract.md` §6.6.
//
// Twelve rows that almost never change and are needed by nearly every screen,
// so they are cached in memory for the session and fall back to the bundled
// list when the API cannot be reached.

import { CATEGORIES_FALLBACK } from '@/constants/categoriesFallback'
import { ROLES } from '@/constants/roles'
import { ID_PREFIX } from '@/utils/id'

import { API_ERROR_CODE, createApiError } from './api/apiError'
import { createCrudService } from './api/crudFactory'
import { arrayContains, SORT_ORDER } from './api/listAdapter'
import { auditService } from './auditService'

const categories = createCrudService('categories', {
  idPrefix: ID_PREFIX.CATEGORY,
  // Categories carry no creation timestamp (contract §6.6).
  timestampField: null,
})

/**
 * Read-only handles on the two collections that *reference* a category, used
 * only to count how much content would be affected by deactivating one.
 *
 * MOCK-COUNT: two counted reads per category, because JSON Server has no
 * aggregate. The Laravel API answers this with one
 * `GET /categories?withCounts=1` and a pair of `COUNT(*) … GROUP BY
 * category_id` queries; when it does, {@link categoryService.getUsageCounts}
 * becomes a single request and no call site changes.
 */
const creatorProfiles = createCrudService('creatorProfiles')
const contentRequests = createCrudService('contentRequests')

/** Upper bound on a taxonomy read — twelve rows today, room to grow. */
const CATEGORY_LIMIT = 100

/** Slug rules: lowercase, digits, single hyphens, no leading/trailing hyphen. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * A URL-safe slug from a display name — `'Food & Beverage'` → `'food-beverage'`.
 * Exported so the admin dialog can show the slug it is about to save while the
 * name is still being typed, using the same rule the service applies.
 *
 * @param {string} value a category name (or a hand-edited slug)
 * @returns {string} the normalised slug, possibly empty
 */
export function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    // Ampersands read as "and" in a name and as nothing in a slug — dropping
    // them keeps `Food & Beverage` → `food-beverage`, which is what is seeded.
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

/** Rejects a slug the API (and later a `UNIQUE` index) would not accept. */
function assertUsableSlug(slug) {
  if (!slug || !SLUG_PATTERN.test(slug)) {
    throw createApiError(API_ERROR_CODE.VALIDATION_FAILED, 'That web address is not usable.', {
      slug: ['Use lowercase letters, numbers, and single hyphens — for example “food-beverage”.'],
    })
  }
}

/**
 * The bundled list, shaped like an API row. `active` and `sortOrder` are added
 * the same way `scripts/seed-db.js` adds them, so the fallback and the seeded
 * collection are byte-identical.
 */
const FALLBACK_ROWS = Object.freeze(
  CATEGORIES_FALLBACK.map((category, index) =>
    Object.freeze({ ...category, active: true, sortOrder: index + 1 })
  )
)

/**
 * Session cache. Categories are read on nearly every page and change only when
 * an admin edits them, so one fetch per session is the right trade — with
 * `invalidate()` for the admin screen that changes them (Prompt 32).
 */
let cache = null

export const categoryService = Object.freeze({
  /**
   * @param {import('./api/listAdapter').ListParams} [params] filters: `active`,
   *   `slug`; sort: `sortOrder`
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  list: (params) => categories.list(params),

  /**
   * @param {string} id `cat_…`
   * @returns {Promise<object>} the category
   * @throws {ApiError} `not_found`
   */
  getById: (id) => categories.getById(id),

  /**
   * Active categories in display order — the list every filter, select, and
   * navigation surface uses.
   *
   * Cached for the session. When the API is unreachable it resolves with
   * `CATEGORIES_FALLBACK` instead of throwing, because a missing taxonomy would
   * empty every filter on the page; a genuine API error (a 500, a bad path) is
   * still thrown.
   *
   * @param {object} [options]
   * @param {boolean} [options.force=false] bypass the cache and refetch
   * @returns {Promise<object[]>} active categories, `sortOrder` ascending
   */
  async listActive({ force = false } = {}) {
    if (cache && !force) return cache

    try {
      const { items } = await categories.list({
        page: 1,
        limit: 100,
        sort: 'sortOrder',
        order: SORT_ORDER.ASC,
        filters: { active: true },
      })
      cache = items
      return cache
    } catch (error) {
      if (error?.code === API_ERROR_CODE.NETWORK_ERROR) return FALLBACK_ROWS
      throw error
    }
  },

  /** Drops the cached list — call after an admin edits the taxonomy. */
  invalidate() {
    cache = null
  },

  /**
   * Adds a category (admin).
   *
   * @param {object} payload the new category
   * @returns {Promise<object>} the created category
   */
  async create(payload) {
    const created = await categories.create(payload)
    cache = null
    return created
  },

  /**
   * Renames, reorders, or deactivates a category (admin). Categories are
   * deactivated, never deleted (contract §6.6).
   *
   * @param {string} id `cat_…`
   * @param {object} patch changed fields only
   * @returns {Promise<object>} the updated category
   */
  async update(id, patch) {
    const updated = await categories.update(id, patch)
    cache = null
    return updated
  },

  /* -- admin taxonomy management (Prompt 35) ------------------------------- */

  /**
   * **Every** category, active and inactive, in display order — the list the
   * admin screen manages. `listActive` is what the rest of the product reads;
   * this is the only place a deactivated row is meant to be visible.
   *
   * Not cached: an admin editing the taxonomy needs to see what they just did.
   *
   * @returns {Promise<object[]>} categories, `sortOrder` ascending
   */
  async listAll() {
    const { items } = await categories.list({
      page: 1,
      limit: CATEGORY_LIMIT,
      sort: 'sortOrder',
      order: SORT_ORDER.ASC,
    })
    return items
  },

  /**
   * How much content points at each category — the numbers behind the
   * deactivation warning ("Existing content keeps it; hidden from new
   * selections", contract §6.6).
   *
   * Best effort per category: a failed count resolves to `null` rather than
   * failing the screen, and the dialog says "in use" without a number rather
   * than claiming zero.
   *
   * @param {string[]} categoryIds the ids to count
   * @returns {Promise<Object<string, {creators: number|null, requests: number|null}>>}
   */
  async getUsageCounts(categoryIds = []) {
    // One counted read per collection per category: `limit: 1` fetches a single
    // row and reads the true total from the list envelope, so the count is
    // exact regardless of how large the collection gets (see MOCK-COUNT above).
    const countOrNull = async (service, filters) => {
      try {
        const { total } = await service.list({ page: 1, limit: 1, filters })
        return Number.isFinite(total) ? total : null
      } catch {
        return null
      }
    }

    const entries = await Promise.all(
      categoryIds.map(async (id) => {
        const [creators, requests] = await Promise.all([
          countOrNull(creatorProfiles, { categories: arrayContains(id) }),
          countOrNull(contentRequests, { categoryId: id }),
        ])
        return [id, { creators, requests }]
      })
    )

    return Object.fromEntries(entries)
  },

  /**
   * Is `slug` free? Slugs are the category's public web address, so two rows
   * sharing one is a conflict the API rejects and a `UNIQUE` index will later
   * make impossible (contract §6.6).
   *
   * @param {string} slug the candidate, already normalised by {@link slugify}
   * @param {object} [options]
   * @param {string} [options.excludeId] the row being edited — its own slug is
   *   not a clash with itself
   * @returns {Promise<boolean>} `false` when another category holds it
   */
  async isSlugAvailable(slug, { excludeId } = {}) {
    if (!slug) return false
    const { items } = await categories.list({ page: 1, limit: 2, filters: { slug } })
    return items.every((category) => category.id === excludeId)
  },

  /**
   * Adds a category (super admin) and records it.
   *
   * The slug is normalised and checked before the write, the new row lands at
   * the end of the display order, and the session cache is dropped so every
   * select on the site offers it immediately.
   *
   * @param {object} input
   * @param {string} input.name display name
   * @param {string} [input.slug] web address — derived from `name` when omitted
   * @param {string} input.icon Iconify name, e.g. `tabler:shirt`
   * @param {boolean} [input.active=true] whether it is offered in new selections
   * @param {object} [options]
   * @param {object} [options.actor] the signed-in super admin, `{ id, role }`
   * @returns {Promise<object>} the created category
   * @throws {ApiError} `validation_failed` (unusable slug) · `conflict` (slug taken)
   */
  async createCategory({ name, slug, icon, active = true } = {}, { actor } = {}) {
    const normalizedSlug = slugify(slug || name)
    assertUsableSlug(normalizedSlug)

    if (!(await this.isSlugAvailable(normalizedSlug))) {
      throw createApiError(API_ERROR_CODE.CONFLICT, 'Another category already uses that web address.', {
        slug: ['Pick a different name, or edit the web address by hand.'],
      })
    }

    const existing = await this.listAll()
    const sortOrder = existing.reduce((highest, row) => Math.max(highest, row.sortOrder ?? 0), 0) + 1

    const created = await this.create({
      name: String(name ?? '').trim(),
      slug: normalizedSlug,
      icon: String(icon ?? '').trim(),
      active: active !== false,
      sortOrder,
    })

    await logCategoryAction(actor, 'category.create', created, {
      name: created.name,
      slug: created.slug,
    })

    return created
  },

  /**
   * Renames a category, changes its icon, or edits its web address (super admin).
   *
   * @param {string} id `cat_…`
   * @param {object} patch `{ name?, slug?, icon? }` — changed fields only
   * @param {object} [options]
   * @param {object} [options.actor] the signed-in super admin
   * @param {object} [options.previous] the row as it was, for the audit diff
   * @returns {Promise<object>} the updated category
   * @throws {ApiError} `validation_failed` · `conflict` (slug taken)
   */
  async updateCategory(id, patch = {}, { actor, previous } = {}) {
    const next = { ...patch }

    if (next.slug !== undefined) {
      next.slug = slugify(next.slug)
      assertUsableSlug(next.slug)
      if (!(await this.isSlugAvailable(next.slug, { excludeId: id }))) {
        throw createApiError(
          API_ERROR_CODE.CONFLICT,
          'Another category already uses that web address.',
          { slug: ['Pick a different one — two categories cannot share an address.'] }
        )
      }
    }
    if (next.name !== undefined) next.name = String(next.name).trim()
    if (next.icon !== undefined) next.icon = String(next.icon).trim()

    const updated = await this.update(id, next)

    await logCategoryAction(actor, 'category.update', updated, {
      changes: Object.keys(next).map((key) => ({
        key,
        from: previous?.[key],
        to: next[key],
      })),
    })

    return updated
  },

  /**
   * Switches a category on or off for **new** selections (super admin).
   *
   * Deactivation is the only removal there is: every request, order, and
   * portfolio item already tagged with it keeps its tag and keeps rendering the
   * name — the row simply stops being offered (contract §6.6). There is no
   * delete, here or in the contract.
   *
   * @param {string} id `cat_…`
   * @param {boolean} active
   * @param {object} [options]
   * @param {object} [options.actor] the signed-in super admin
   * @param {{creators: number|null, requests: number|null}} [options.usage] the
   *   counts the reader was shown, recorded so the trail says what was known
   * @returns {Promise<object>} the updated category
   */
  async setCategoryActive(id, active, { actor, usage } = {}) {
    const updated = await this.update(id, { active: Boolean(active) })

    await logCategoryAction(
      actor,
      active ? 'category.activate' : 'category.deactivate',
      updated,
      { name: updated.name, ...(usage ? { usage } : {}) }
    )

    return updated
  },

  /**
   * Moves a category one place up or down the display order (super admin).
   *
   * Implemented as a **swap** with the neighbour rather than a renumber of the
   * whole list: two writes instead of twelve, and a failed second write leaves
   * a duplicate `sortOrder` rather than a hole — which the ascending sort still
   * renders sensibly.
   *
   * @param {string} id `cat_…`
   * @param {'up'|'down'} direction
   * @param {object} [options]
   * @param {object} [options.actor] the signed-in super admin
   * @returns {Promise<object[]>} the reordered list
   * @throws {ApiError} `validation_failed` when the row is already at that end
   */
  async moveCategory(id, direction, { actor } = {}) {
    const ordered = await this.listAll()
    const index = ordered.findIndex((category) => category.id === id)
    const target = direction === 'up' ? index - 1 : index + 1

    if (index < 0 || target < 0 || target >= ordered.length) {
      throw createApiError(
        API_ERROR_CODE.VALIDATION_FAILED,
        'That category is already at the end of the list.'
      )
    }

    const moved = ordered[index]
    const neighbour = ordered[target]

    await this.update(moved.id, { sortOrder: neighbour.sortOrder })
    await this.update(neighbour.id, { sortOrder: moved.sortOrder })

    await logCategoryAction(actor, 'category.reorder', moved, {
      name: moved.name,
      direction,
      from: moved.sortOrder,
      to: neighbour.sortOrder,
    })

    return this.listAll()
  },
})

/**
 * Writes a `category.*` audit entry (contract §6.26).
 *
 * Best effort, like every other cross-cutting emit in the services layer: the
 * taxonomy change has already happened, and refusing to acknowledge it because
 * the trail write failed would leave the screen lying about what it did.
 */
async function logCategoryAction(actor, action, category, meta) {
  if (!actor?.id) return
  try {
    await auditService.log({
      actorId: actor.id,
      actorRole: actor.role ?? ROLES.SUPER_ADMIN,
      action,
      entityType: 'category',
      entityId: category?.id,
      meta: meta ?? {},
    })
  } catch {
    // Nothing to undo — the category is saved either way.
  }
}

export default categoryService
