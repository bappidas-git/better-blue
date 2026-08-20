// Landing-page marketplace numbers — `docs/api-contract.md` §7.13.
//
// The public home page prints three counts: creator storefronts, completed
// orders, and briefs posted. No endpoint returns them, so under JSON Server each
// one is a `_limit=1` request read for its `X-Total-Count` (00 §10, the pattern
// documented in `adminService`) and the three run in parallel. Laravel replaces
// the whole function with one cached `GET /stats/landing`.
//
// V2-04 dropped the fourth count — active categories. Categories no longer
// appear anywhere in the storefront, and a public page that still asked for the
// taxonomy would be the one request left proving otherwise. The collection, the
// admin screens, and `categoryService` are untouched.
//
// Nothing here throws. A marketing page must render whatever it can, so a count
// that fails resolves to `null` and the band simply drops that tile — the
// signature is the same one the future single endpoint will satisfy.

import { ORDER_STATUS } from '@/constants/statuses'

import { creatorProfileService } from './creatorProfileService'
import { orderService } from './orderService'
import { requestService } from './requestService'

/** A count query: one row, read for its `total`. */
const COUNT_PARAMS = { page: 1, limit: 1 }

/**
 * Session cache. The numbers move slowly and the home page is the most-visited
 * route in the product, so one fetch per session is the right trade — with
 * `invalidate()` for anything that needs a fresh read.
 *
 * Only a fully successful read is cached: a partial result would pin a missing
 * tile for the rest of the session.
 */
let cache = null

/** Resolves to the number, or to `null` when the request failed. */
async function countOrNull(load) {
  try {
    const value = await load()
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

/**
 * @typedef {object} LandingStats
 * @property {number|null} creators creator storefronts on the marketplace
 * @property {number|null} completedOrders orders delivered, approved, and paid out
 * @property {number|null} contentRequests briefs buyers have posted
 */

export const landingService = Object.freeze({
  /**
   * The stats band on the landing page.
   *
   * @param {object} [options]
   * @param {boolean} [options.force=false] bypass the session cache
   * @returns {Promise<LandingStats>} every field is a number, or `null` when
   *   that one count could not be read — this never rejects
   */
  async getStats({ force = false } = {}) {
    if (cache && !force) return cache

    const [creators, completedOrders, contentRequests] = await Promise.all([
      countOrNull(async () => (await creatorProfileService.list(COUNT_PARAMS)).total),
      countOrNull(
        async () =>
          (
            await orderService.list({
              ...COUNT_PARAMS,
              filters: { status: ORDER_STATUS.COMPLETED },
            })
          ).total
      ),
      countOrNull(async () => (await requestService.list(COUNT_PARAMS)).total),
    ])

    const stats = { creators, completedOrders, contentRequests }
    if (Object.values(stats).every((value) => value !== null)) cache = stats
    return stats
  },

  /** Drops the cached counts — call after anything that moves them. */
  invalidate() {
    cache = null
  },
})

export default landingService
