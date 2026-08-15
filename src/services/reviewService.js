// Buyer ratings — `docs/api-contract.md` §6.18. One review per order, only on
// completed orders, and never editable.

import { ORDER_STATUS } from '@/constants/statuses'
import { ID_PREFIX } from '@/utils/id'

import { API_ERROR_CODE, createApiError } from './api/apiError'
import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'
import { buyerProfileService } from './buyerProfileService'
import { creatorProfileService } from './creatorProfileService'
import { userService } from './userService'

const reviews = createCrudService('reviews', { idPrefix: ID_PREFIX.REVIEW })

// A review is left *on an order*, and `orderService` is a much larger module
// that would import back into this one for the buyer's order screens. As
// `paymentService` does for the same reason (Prompt 17), this file keeps its
// own read handle on the collection rather than making the services graph
// cyclic. Nothing here ever writes an order.
const orders = createCrudService('orders', { idPrefix: ID_PREFIX.ORDER })

/** Lowest and highest star a review may carry (contract §6.18). */
export const RATING_MIN = 1
export const RATING_MAX = 5

/** Ratings folded when recomputing a creator's average (adapter cap, §4.1). */
const AGGREGATE_LIMIT = 100

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

  /* —— workflow operations —————————————————————————————————————————————— */

  /**
   * **Leaves a review on a completed order** (contract §6.18).
   *
   * Three rules, all of them enforced here because JSON Server enforces none of
   * them: one review per order, only on a `completed` order, and only by the
   * buyer who paid for it. Reviews are never editable — a public rating that
   * could be revised after the fact is not a rating — so the guard against a
   * second one is the only thing standing between a creator's profile and a
   * buyer changing their mind.
   *
   * `buyerId`, `creatorId`, and `requestId` are **derived from the order**, not
   * taken from the caller (§9.2).
   *
   * MOCK-AGGREGATE: nothing recalculates `creatorProfiles.ratingAvg` /
   * `ratingCount`, so this reads the creator's ratings back, recomputes the
   * average to one decimal, and `PATCH`es the storefront. It is **not atomic
   * with the review**: a failure there leaves a real review and a stale average,
   * which is why it never throws — the rating is the record, the aggregate is a
   * cache of it, and the next review repairs it.
   *
   * @param {string} orderId `ord_…`
   * @param {object} options
   * @param {number} options.rating 1–5, whole stars
   * @param {string} options.comment what the buyer wants other businesses to know
   * @param {string} [options.actorId] the acting buyer — rejected unless they
   *   own the order
   * @returns {Promise<object>} the created review
   * @throws {ApiError} `conflict` when the order is not completed or already
   *   carries a review · `forbidden` · `validation_failed` on the rating ·
   *   `not_found`
   *
   * **Future endpoint:** `POST /reviews` → `{ review }`, with
   * `reviews.order_id UNIQUE` making a second review structurally impossible
   * and the aggregate recomputed in the same transaction.
   */
  async submitReview(orderId, { rating, comment, actorId } = {}) {
    const order = await orders.getById(orderId)

    if (actorId && order.buyerId !== actorId) {
      throw createApiError(API_ERROR_CODE.FORBIDDEN, 'This order belongs to another account.')
    }
    if (order.status !== ORDER_STATUS.COMPLETED) {
      throw createApiError(
        API_ERROR_CODE.CONFLICT,
        'You can review an engagement once it is complete.',
        { from: order.status, expected: ORDER_STATUS.COMPLETED },
        409
      )
    }

    const stars = Math.round(Number(rating))
    if (!Number.isFinite(stars) || stars < RATING_MIN || stars > RATING_MAX) {
      throw createApiError(
        API_ERROR_CODE.VALIDATION_FAILED,
        'Choose a rating between one and five stars.',
        { rating: `Choose between ${RATING_MIN} and ${RATING_MAX} stars.` },
        422
      )
    }

    const existing = await reviewService.getByOrderId(orderId)
    if (existing) {
      throw createApiError(
        API_ERROR_CODE.CONFLICT,
        'You have already reviewed this order, and reviews cannot be changed.',
        { reviewId: existing.id },
        409
      )
    }

    const review = await reviews.create({
      orderId,
      requestId: order.requestId ?? null,
      buyerId: order.buyerId,
      creatorId: order.creatorId,
      rating: stars,
      comment,
    })

    await reviewService.recomputeCreatorAggregates(order.creatorId)

    return review
  },

  /**
   * Recomputes and stores a creator's `ratingAvg` / `ratingCount`.
   *
   * MOCK-AGGREGATE (contract §6.18): derived columns with nothing deriving them.
   * Folded from one capped page of the creator's ratings and `PATCH`ed onto the
   * storefront, which is what makes a new review show up on the public profile.
   * Never throws — see {@link submitReview}.
   *
   * @param {string} creatorId `usr_…`
   * @returns {Promise<{ratingAvg: number, ratingCount: number}|null>} `null` when
   *   the recompute could not be completed
   */
  async recomputeCreatorAggregates(creatorId) {
    if (!creatorId) return null

    try {
      const [{ items, total }, profile] = await Promise.all([
        reviews.list({ page: 1, limit: AGGREGATE_LIMIT, filters: { creatorId } }),
        creatorProfileService.getByUserId(creatorId),
      ])

      const scores = items
        .map((entry) => Number(entry.rating))
        .filter((value) => Number.isFinite(value))

      const ratingAvg =
        scores.length > 0
          ? Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10) / 10
          : 0

      // `total` rather than `scores.length`: the count is exact even when the
      // average is folded from the newest page only.
      const aggregates = { ratingAvg, ratingCount: total }
      await creatorProfileService.update(profile.id, aggregates)
      return aggregates
    } catch {
      return null
    }
  },
})

export default reviewService
