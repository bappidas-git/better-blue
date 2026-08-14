// Marketplace taxonomy — `docs/api-contract.md` §6.6.
//
// Twelve rows that almost never change and are needed by nearly every screen,
// so they are cached in memory for the session and fall back to the bundled
// list when the API cannot be reached.

import { CATEGORIES_FALLBACK } from '@/constants/categoriesFallback'
import { ID_PREFIX } from '@/utils/id'

import { API_ERROR_CODE } from './api/apiError'
import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'

const categories = createCrudService('categories', {
  idPrefix: ID_PREFIX.CATEGORY,
  // Categories carry no creation timestamp (contract §6.6).
  timestampField: null,
})

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
})

export default categoryService
