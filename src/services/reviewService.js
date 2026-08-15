// Buyer ratings — `docs/api-contract.md` §6.18. One review per order, only on
// completed orders, and never editable.

import { ID_PREFIX } from '@/utils/id'

import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'
import { buyerProfileService } from './buyerProfileService'
import { userService } from './userService'

const reviews = createCrudService('reviews', { idPrefix: ID_PREFIX.REVIEW })

/** The rating scale, high to low — the order a breakdown's bars read in. */
export const RATING_SCALE = Object.freeze([5, 4, 3, 2, 1])

/** Reviews pulled per request while tallying a breakdown (adapter cap). */
const BREAKDOWN_PAGE_SIZE = 100

/**
 * Pages a breakdown will walk before it settles for a sample. Five hundred
 * ratings is far past the point where one more changes a distribution bar, and
 * it stops a creator with thousands of reviews from opening a request storm.
 */
const BREAKDOWN_MAX_PAGES = 5

/** Accounts fetched in one batch when attributing a page of reviews. */
const ATTRIBUTION_LIMIT = 100

export const reviewService = Object.freeze({
  /**
   * @param {import('./api/listAdapter').ListParams} [params] filters:
   *   `creatorId`, `buyerId`, `orderId`, `rating`, `rating_gte`;
   *   sorts: `createdAt`, `rating`
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  list: (params = {}) => reviews.list({ sort: 'createdAt', order: SORT_ORDER.DESC, ...params }),

  /**
   * @param {string} id `rvw_…`
   * @returns {Promise<object>} the review
   * @throws {ApiError} `not_found`
   */
  getById: (id) => reviews.getById(id),

  /**
   * The reviews shown on a creator's public profile.
   *
   * @param {string} creatorId `usr_…`
   * @param {import('./api/listAdapter').ListParams} [params] any filter above
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  listByCreator(creatorId, params = {}) {
    return reviewService.list({ ...params, filters: { ...params.filters, creatorId } })
  },

  /**
   * The same page of reviews, with each one attributed to the business that
   * left it — what a public profile shows under the comment.
   *
   * MOCK-JOIN: `reviews` carries `buyerId` only, so the name and the company
   * come from two batched follow-ups (`GET /users?id=…&id=…` and
   * `GET /buyerProfiles?userId=…&userId=…`). The attribution is decoration
   * around the rating: if either lookup fails the reviews still render, with
   * the buyer left anonymous.
   *
   * > **Laravel** — `GET /reviews?creatorId=…&include=buyer` resolves both in
   * > one round trip and this function collapses to `listByCreator`.
   *
   * @param {string} creatorId `usr_…`
   * @param {import('./api/listAdapter').ListParams} [params] paging and sorting
   * @returns {Promise<import('./api/listAdapter').ListResult>} items carry a
   *   `buyer: { name, companyName }` (either field may be `null`)
   */
  async listByCreatorWithBuyers(creatorId, params = {}) {
    const result = await reviewService.listByCreator(creatorId, params)
    if (result.items.length === 0) return result

    const buyerIds = [...new Set(result.items.map((review) => review.buyerId).filter(Boolean))]

    let accounts = {}
    let businesses = {}
    if (buyerIds.length > 0) {
      try {
        const [owners, profiles] = await Promise.all([
          userService.listByIds(buyerIds),
          buyerProfileService.list({
            page: 1,
            limit: ATTRIBUTION_LIMIT,
            filters: { userId: buyerIds },
          }),
        ])
        accounts = Object.fromEntries(owners.map((owner) => [owner.id, owner]))
        businesses = Object.fromEntries(
          profiles.items.map((profile) => [profile.userId, profile])
        )
      } catch {
        // See above — a missing name must not cost the reader the rating.
      }
    }

    const items = result.items.map((review) => ({
      ...review,
      buyer: {
        name: accounts[review.buyerId]?.name ?? null,
        companyName: businesses[review.buyerId]?.companyName ?? null,
      },
    }))

    return { ...result, items }
  },

  /**
   * The 5→1 distribution behind the rating summary on a creator's profile.
   *
   * MOCK-AGGREGATE: JSON Server cannot group, so the ratings are paged in and
   * tallied here — up to `BREAKDOWN_MAX_PAGES × BREAKDOWN_PAGE_SIZE` of them.
   * Past that the distribution describes the newest ratings rather than all of
   * them, which `isPartial` says out loud rather than quietly implying.
   *
   * > **Laravel** — `GET /reviews/breakdown?creatorId=…` backed by
   * > `SELECT rating, COUNT(*) … GROUP BY rating`: one query, exact, no cap.
   * > Reported as an addition in `docs/api-contract.md` §6.18.
   *
   * @param {string} creatorId `usr_…`
   * @returns {Promise<{total: number, counted: number, average: number,
   *   distribution: Object<number, number>, isPartial: boolean}>}
   */
  async getBreakdown(creatorId) {
    const distribution = Object.fromEntries(RATING_SCALE.map((rating) => [rating, 0]))
    const empty = { total: 0, counted: 0, average: 0, distribution, isPartial: false }
    if (!creatorId) return empty

    let total = 0
    let counted = 0
    let sum = 0

    for (let page = 1; page <= BREAKDOWN_MAX_PAGES; page += 1) {
      // Sequential by definition: each page's size decides whether to ask for
      // the next one.
      // eslint-disable-next-line no-await-in-loop
      const result = await reviews.list({
        page,
        limit: BREAKDOWN_PAGE_SIZE,
        filters: { creatorId },
      })

      total = result.total
      result.items.forEach((review) => {
        const rating = Math.round(Number(review.rating))
        if (distribution[rating] === undefined) return
        distribution[rating] += 1
        counted += 1
        sum += rating
      })

      if (result.items.length < BREAKDOWN_PAGE_SIZE || counted >= total) break
    }

    return {
      total,
      counted,
      // One decimal, matching the stored `ratingAvg` the cards render.
      average: counted > 0 ? Math.round((sum / counted) * 10) / 10 : 0,
      distribution,
      isPartial: counted < total,
    }
  },

  /**
   * The review left on one order — the "already reviewed" guard, and what the
   * order detail page renders once it exists.
   *
   * @param {string} orderId `ord_…`
   * @returns {Promise<object|null>} the review, or `null` when there is none
   */
  async getByOrderId(orderId) {
    if (!orderId) return null
    const { items } = await reviews.list({ page: 1, limit: 1, filters: { orderId } })
    return items[0] ?? null
  },

  /**
   * Leaves a review. `buyerId`, `creatorId`, and `requestId` are derived from
   * the order (contract §6.18).
   *
   * @param {object} payload the new review
   * @returns {Promise<object>} the created review
   */
  create: (payload) => reviews.create(payload),

  // —— workflow operations (added by later prompts) ——
  // submitReview — Prompt 21 (reviews): guards "completed order, not yet
  // reviewed", then recomputes the creator's `ratingAvg`/`ratingCount`, which
  // nothing recalculates server-side in the mock era (contract §6.18).
})

export default reviewService
