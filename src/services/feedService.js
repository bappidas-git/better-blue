// The storefront's feed board — Storefront V2 (`prompts-v2/03`).
//
// **Nothing was renamed.** A "feed" is a `contentRequests` record and a
// "reply" lives in `feedReplies`; the collections, the ids (`req_…`), and
// `requestService` are all exactly what they were. This module is a façade over
// them that speaks the storefront's vocabulary — deal status instead of request
// status, offer price instead of a budget pair, replies instead of proposals —
// so the V2 pages never have to translate and the buyer dashboard, the admin
// console, and the Laravel migration keep reading the same records they always
// did.
//
// The other half of the file is the **reply** system, which is genuinely new.
// Replies are not proposals: no price, no deliverables, no state machine, and
// nothing downstream depends on one. See `docs/data-model.md` → `feedReplies`.
//
// PRIVACY: every read of a reply is filtered by `creatorId` before it leaves
// this module, so no surface can render a thread that belongs to somebody else.
// Like every other ownership check in this prototype that is **UX only** (00
// §11) — the Laravel API must scope the same queries to the signed-in creator.

import { NOTIFICATION_ENTITY, NOTIFICATION_TYPE } from '@/constants/notificationTypes'
import {
  FEED_DEAL_STATUS,
  REQUEST_STATUSES_BY_DEAL_STATUS,
  getFeedDealStatus,
} from '@/constants/feedStatus'
import { REQUEST_STATUS } from '@/constants/statuses'
import { ID_PREFIX, generateId } from '@/utils/id'

import { API_ERROR_CODE, createApiError } from './api/apiError'
import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'
import { creatorProfileService } from './creatorProfileService'
import { notificationService } from './notificationService'
import { requestService } from './requestService'

const feedReplies = createCrudService('feedReplies', { idPrefix: ID_PREFIX.FEED_REPLY })

/** Provider page ceiling (contract §4.1). */
const FOLD_LIMIT = 100

/** Length bounds on one message, enforced here as well as in the composer. */
export const REPLY_BODY_MIN = 20
export const REPLY_BODY_MAX = 1200

/**
 * Every status a feed may be shown under — which is every `REQUEST_STATUS`
 * except `draft`. A draft is private to the buyer who wrote it and must never
 * reach a public surface, so this set (rather than "no status filter") is what
 * an unfiltered feed list asks for.
 */
const PUBLIC_FEED_STATUSES = Object.freeze(
  Object.values(REQUEST_STATUS).filter((status) => status !== REQUEST_STATUS.DRAFT)
)

/**
 * The sorts the feed board offers, and the record field each reads.
 *
 * `latest` sorts on `createdAt` rather than `publishedAt` because that is what
 * the board's "Latest" chip means — when the buyer wrote it. Every seeded feed
 * is published six hours after it was created, so the two orders agree; a draft
 * published months later would differ, and `createdAt` is still the honest
 * answer to "newest".
 */
export const FEED_SORT = Object.freeze({
  LATEST: 'latest',
  MOST_REPLIES: 'mostReplies',
  PRICE_ASC: 'priceAsc',
  PRICE_DESC: 'priceDesc',
})

const SORT_FIELDS = Object.freeze({
  [FEED_SORT.LATEST]: { sort: 'createdAt', order: SORT_ORDER.DESC },
  [FEED_SORT.MOST_REPLIES]: { sort: 'repliesCount', order: SORT_ORDER.DESC },
  [FEED_SORT.PRICE_ASC]: { sort: 'offerPrice', order: SORT_ORDER.ASC },
  [FEED_SORT.PRICE_DESC]: { sort: 'offerPrice', order: SORT_ORDER.DESC },
})

/**
 * The `REQUEST_STATUS` values a `dealStatus` filter resolves to.
 *
 * **This is the whole of the "service-side mapping" the deal statuses need.**
 * `open` and `delivered` are one status each, so they could have been a plain
 * equality filter; `closed` is three (`awarded`, `closed`, `cancelled`) and
 * cannot be. Rather than have two spellings, all three go through the same
 * status-in-set filter — the list adapter emits repeated `status=` parameters,
 * which JSON Server ORs together (contract §4.3), and Laravel resolves as
 * `whereIn('status', …)`. Filtering client-side after the fetch was the other
 * option and is wrong: it would break `total`, and with it pagination.
 *
 * @param {string|string[]} dealStatus one or more `FEED_DEAL_STATUS` values
 * @returns {string[]} the request statuses to query, `[]` when nothing matched
 */
function statusesForDealStatus(dealStatus) {
  const wanted = (Array.isArray(dealStatus) ? dealStatus : [dealStatus]).filter(Boolean)
  const statuses = wanted.flatMap((value) => REQUEST_STATUSES_BY_DEAL_STATUS[value] ?? [])
  return [...new Set(statuses)]
}

/**
 * Turns the storefront's filter vocabulary into record filters.
 *
 * @param {object} [filters]
 * @param {string|string[]} [filters.dealStatus] `open` | `closed` | `delivered`
 * @param {boolean} [filters.openOnly] constrain to feeds still taking replies
 * @returns {object} filters for `requestService.list`
 */
function toRecordFilters({ dealStatus, openOnly, ...rest } = {}) {
  let statuses = dealStatus ? statusesForDealStatus(dealStatus) : [...PUBLIC_FEED_STATUSES]

  if (openOnly) {
    // Intersection, not replacement: "open only" narrows whatever view is
    // active rather than overriding it, which is what makes the switch safe to
    // leave on while the chips change (V2-07 §2).
    const open = REQUEST_STATUSES_BY_DEAL_STATUS[FEED_DEAL_STATUS.OPEN]
    statuses = statuses.filter((status) => open.includes(status))
  }

  return { ...rest, status: statuses }
}

/** Attaches the business behind each feed; a failed join is not a failed list. */
async function withBuyers(result) {
  if (result.items.length === 0) return result

  let buyers = new Map()
  try {
    buyers = await requestService.getBuyerSummaries(result.items.map((feed) => feed.buyerId))
  } catch {
    // The work is the payload; the logo is the garnish (`requestService`).
  }

  return {
    ...result,
    items: result.items.map((feed) => ({
      ...feed,
      buyer: buyers.get(feed.buyerId) ?? null,
      dealStatus: getFeedDealStatus(feed),
    })),
  }
}

/** Trimmed message body, validated against the bounds above. */
function toBody(value) {
  const body = String(value ?? '').trim()
  if (body.length < REPLY_BODY_MIN) {
    throw createApiError(API_ERROR_CODE.VALIDATION_FAILED, 'Your message is too short.', {
      body: `Write at least ${REPLY_BODY_MIN} characters so the buyer has something to answer.`,
    })
  }
  if (body.length > REPLY_BODY_MAX) {
    throw createApiError(API_ERROR_CODE.VALIDATION_FAILED, 'Your message is too long.', {
      body: `Keep it under ${REPLY_BODY_MAX} characters.`,
    })
  }
  return body
}

/**
 * The one place a reply is read by id **and** ownership-checked.
 *
 * @param {string} replyId `frp_…`
 * @param {string} [creatorId] `cpr_…` — when given, anyone else is refused
 * @returns {Promise<object>} the reply
 * @throws {ApiError} `not_found` · `forbidden`
 */
async function loadOwnedReply(replyId, creatorId) {
  const reply = await feedReplies.getById(replyId)
  if (creatorId && reply.creatorId !== creatorId) {
    throw createApiError(
      API_ERROR_CODE.FORBIDDEN,
      'This conversation belongs to another creator.'
    )
  }
  return reply
}

/**
 * Moves a feed's `repliesCount` by `delta`, clamped at zero.
 *
 * MOCK-COUNTER: read-then-write, because JSON Server has no atomic increment
 * (the same shape `proposalService` uses for `proposalsCount`). Two creators
 * replying in the same instant could lose a count. Laravel does this inside the
 * transaction that writes the reply, or from a counter cache.
 *
 * A failed counter update never fails the reply itself: the thread exists and
 * is the thing the creator came for, and the number is recomputable.
 *
 * @param {string} feedId `req_…`
 * @param {number} delta `+1` or `-1`
 * @returns {Promise<void>}
 */
async function bumpRepliesCount(feedId, delta) {
  try {
    const feed = await requestService.getById(feedId)
    const next = Math.max(0, (Number(feed.repliesCount) || 0) + delta)
    await requestService.update(feedId, { repliesCount: next })
  } catch {
    // See above.
  }
}

export const feedService = Object.freeze({
  /**
   * **The feed board** (V2-05, V2-07) — public feeds, newest first, each with
   * the business that posted it and its derived `dealStatus`.
   *
   * Drafts are never returned: the status filter is an explicit set of the five
   * public statuses rather than an absent filter, so a private draft cannot
   * appear even on an unfiltered page.
   *
   * @param {object} [params]
   * @param {number} [params.page=1]
   * @param {number} [params.limit] rows per page, 1–100
   * @param {string} [params.sort='latest'] a `FEED_SORT` token
   * @param {string} [params.search] free text across the feed's fields
   * @param {object} [params.filters]
   * @param {string|string[]} [params.filters.dealStatus] `open` | `closed` | `delivered`
   * @param {boolean} [params.filters.openOnly] narrow to feeds still taking replies
   * @returns {Promise<import('./api/listAdapter').ListResult>} feeds, each with
   *   `buyer` (or `null`) and `dealStatus`
   *
   * **Future endpoint:** `GET /feeds?deal_status=open&sort=latest&include=buyer`.
   */
  async listFeeds({ page, limit, sort = FEED_SORT.LATEST, search, filters } = {}) {
    const ordering = SORT_FIELDS[sort] ?? SORT_FIELDS[FEED_SORT.LATEST]
    const recordFilters = toRecordFilters(filters)

    // A `dealStatus` that resolves to nothing is a filter for nothing, not a
    // filter for everything — an empty status list would be dropped by the list
    // adapter and quietly return the whole board.
    if (recordFilters.status.length === 0) {
      return { items: [], total: 0, page: page ?? 1, limit: limit ?? 0 }
    }

    const result = await requestService.list({
      page,
      limit,
      search,
      ...ordering,
      filters: recordFilters,
    })

    return withBuyers(result)
  },

  /**
   * The newest feeds, for the home page strip (V2-05).
   *
   * Deliberately **not** open-only: the strip is "what has been posted lately",
   * and hiding the ones already awarded would both shrink it below the ten it
   * asks for and hide the delivered work that shows the marketplace finishing
   * what it starts. The card's deal chip says which is which.
   *
   * @param {number} [limit=10]
   * @returns {Promise<object[]>} feeds, newest first, each with `buyer` and
   *   `dealStatus`
   */
  async getLatestFeeds(limit = 10) {
    const { items } = await feedService.listFeeds({ page: 1, limit, sort: FEED_SORT.LATEST })
    return items
  },

  /**
   * **One feed** as the storefront shows it (V2-08) — the feed, its derived
   * deal status, and the business behind it.
   *
   * Readable by anyone; only the *actions* beside it are gated. A draft is
   * refused as `not_found` rather than `forbidden`, because a visitor has no
   * business learning that a private brief exists.
   *
   * @param {string} id `req_…`
   * @returns {Promise<{feed: object, buyer: object|null}>} `buyer` is `null`
   *   when the business could not be read — the feed still renders
   * @throws {ApiError} `not_found`
   *
   * **Future endpoint:** `GET /feeds/:id?include=buyer`.
   */
  async getFeed(id) {
    const { request, buyer } = await requestService.getBoardRequest(id)

    if (request.status === REQUEST_STATUS.DRAFT) {
      throw createApiError(API_ERROR_CODE.NOT_FOUND, 'This feed is not available.')
    }

    return { feed: { ...request, dealStatus: getFeedDealStatus(request) }, buyer }
  },

  /**
   * **How many feeds a business has posted** — the figure on the buyer card of
   * a feed's detail page (V2-08).
   *
   * Asks for one row and reads `total` off the envelope, so the answer costs a
   * single request whatever the business has posted. Counting is all this is
   * for; the rows come back and are thrown away.
   *
   * The same public-status set `listFeeds` uses, so a visitor's count never
   * includes a draft they cannot open.
   *
   * @param {string} buyerId `usr_…` — the account a feed is posted by
   * @returns {Promise<number>} public feeds by this business
   *
   * **Future endpoint:** `GET /feeds?buyer_id=…&per_page=1` → `meta.total`.
   */
  async countFeedsByBuyer(buyerId) {
    if (!buyerId) return 0

    const { total } = await requestService.list({
      page: 1,
      limit: 1,
      filters: { buyerId, status: [...PUBLIC_FEED_STATUSES] },
    })
    return Number(total) || 0
  },

  /* —— replies —————————————————————————————————————————————————————————— */

  /**
   * **This creator's own reply on a feed**, or `null` when they have not
   * written one.
   *
   * PRIVACY: the query carries `creatorId` as a filter, so the provider never
   * returns anyone else's thread — asking for another creator's reply returns
   * nothing rather than returning it. The Laravel API must enforce the same
   * scope server-side; a client-side filter is a convenience, not a boundary.
   *
   * @param {string} feedId `req_…`
   * @param {string} creatorId `cpr_…` — the storefront, not the account
   * @returns {Promise<object|null>} the reply thread, or `null`
   *
   * **Future endpoint:** `GET /feeds/:id/replies/mine`.
   */
  async getMyReply(feedId, creatorId) {
    if (!feedId || !creatorId) return null

    const { items } = await feedReplies.list({
      page: 1,
      limit: 1,
      filters: { feedId, creatorId },
    })
    return items[0] ?? null
  },

  /**
   * Every reply this creator has open, across all feeds — their side of the
   * conversation list.
   *
   * Same privacy rule as {@link getMyReply}: `creatorId` is a filter on the
   * query, never a post-fetch check.
   *
   * @param {string} creatorId `cpr_…`
   * @param {import('./api/listAdapter').ListParams} [params]
   * @returns {Promise<import('./api/listAdapter').ListResult>} most recently
   *   answered first
   */
  listMyReplies(creatorId, params = {}) {
    return feedReplies.list({
      sort: 'updatedAt',
      order: SORT_ORDER.DESC,
      ...params,
      filters: { ...params.filters, creatorId },
    })
  },

  /**
   * **Opens a reply** on a feed: creates the thread with the creator's first
   * message, bumps the feed's counter, and tells the buyer.
   *
   * One reply per creator per feed (contract-shaped rule, enforced here and to
   * be enforced by a unique index server-side): a creator who already has a
   * thread gets `conflict` and should add a message to it instead.
   *
   * Only **open** feeds take new replies — answering a brief the buyer has
   * already awarded would be a message nobody is waiting for.
   *
   * @param {string} feedId `req_…`
   * @param {object} input
   * @param {string} input.creatorId `cpr_…` — the storefront replying
   * @param {string} input.body the creator's opening message
   * @returns {Promise<object>} the created reply, one message long
   * @throws {ApiError} `validation_failed` (missing creator, message bounds) ·
   *   `conflict` (already replied, or the feed is closed) · `not_found`
   *
   * **Future endpoint:** `POST /feeds/:id/replies` → `{ reply }`.
   */
  async createReply(feedId, { creatorId, body } = {}) {
    if (!creatorId) {
      throw createApiError(
        API_ERROR_CODE.VALIDATION_FAILED,
        'A reply needs the storefront it is written from.'
      )
    }
    const message = toBody(body)

    // The feed is read before anything is written, so a closed feed or a bad id
    // fails without leaving a thread behind.
    const feed = await requestService.getById(feedId)
    if (feed.status !== REQUEST_STATUS.OPEN) {
      throw createApiError(
        API_ERROR_CODE.CONFLICT,
        'This feed is no longer taking replies. Reload the page to see where it got to.'
      )
    }

    const existing = await feedService.getMyReply(feedId, creatorId)
    if (existing) {
      throw createApiError(
        API_ERROR_CODE.CONFLICT,
        'You have already replied to this feed. Add to the conversation instead.'
      )
    }

    // The storefront tells us both who the author is as an account and what the
    // buyer should see them called, so it is read once here rather than twice.
    const profile = await creatorProfileService.getById(creatorId)
    const at = new Date().toISOString()

    const reply = await feedReplies.create({
      feedId,
      creatorId,
      buyerId: feed.buyerId,
      messages: [
        {
          id: generateId(ID_PREFIX.FEED_REPLY_MESSAGE),
          authorRole: 'creator',
          authorId: profile.userId,
          body: message,
          at,
        },
      ],
      createdAt: at,
      updatedAt: at,
    })

    await bumpRepliesCount(feedId, 1)

    // Emitting the notification is a separate step from the reply (00 §10), so
    // a suppressed or failed notification never costs the creator their thread.
    try {
      await notificationService.notify({
        userId: feed.buyerId,
        type: NOTIFICATION_TYPE.FEED_REPLY_RECEIVED,
        title: 'New reply on your feed',
        body: `${profile.displayName} replied to “${feed.title}”. Open the feed to read the conversation.`,
        entityType: NOTIFICATION_ENTITY.REQUEST,
        entityId: feedId,
      })
    } catch {
      // See above.
    }

    return reply
  },

  /**
   * Adds a message to an existing thread, from either side.
   *
   * `authorRole` says which side wrote it and `authorId` is the account that
   * did — both are supplied by the caller because this one function serves the
   * creator's composer and (once a buyer-facing thread exists) the buyer's.
   *
   * @param {string} replyId `frp_…`
   * @param {object} input
   * @param {'creator'|'buyer'} input.authorRole who is writing
   * @param {string} input.authorId `usr_…` — the account, not the storefront
   * @param {string} input.body the message
   * @param {object} [options]
   * @param {string} [options.creatorId] `cpr_…` — when given, the thread must
   *   belong to this storefront (the creator composer always passes it)
   * @returns {Promise<object>} the updated reply, with the message appended
   * @throws {ApiError} `validation_failed` · `forbidden` · `not_found`
   *
   * **Future endpoint:** `POST /feed-replies/:id/messages` → `{ reply }`.
   */
  async addReplyMessage(replyId, { authorRole, authorId, body } = {}, { creatorId } = {}) {
    if (authorRole !== 'creator' && authorRole !== 'buyer') {
      throw createApiError(
        API_ERROR_CODE.VALIDATION_FAILED,
        'A message has to come from the creator or the buyer.'
      )
    }
    if (!authorId) {
      throw createApiError(API_ERROR_CODE.VALIDATION_FAILED, 'A message needs an author.')
    }
    const message = toBody(body)

    const reply = await loadOwnedReply(replyId, creatorId)
    const at = new Date().toISOString()

    // MOCK-APPEND: the whole array is sent back, because JSON Server has no way
    // to push onto one. Laravel appends a row to `feed_reply_messages` and
    // never rewrites the thread.
    return feedReplies.update(replyId, {
      messages: [
        ...reply.messages,
        {
          id: generateId(ID_PREFIX.FEED_REPLY_MESSAGE),
          authorRole,
          authorId,
          body: message,
          at,
        },
      ],
      updatedAt: at,
    })
  },

  /**
   * **Deletes this creator's own reply**, thread and all, and decrements the
   * feed's counter.
   *
   * A hard delete, unlike everything else in BetterBlue (contract §1.7, where
   * removal is a status transition): a conversation the creator has withdrawn
   * should leave nothing behind, and there is no downstream record — no order,
   * no payment, no audit trail — that needs it to keep existing. Deleting frees
   * the creator to reply again later, which is the behaviour V2-08 relies on.
   *
   * @param {string} replyId `frp_…`
   * @param {object} options
   * @param {string} options.creatorId `cpr_…` — refused unless they own it
   * @returns {Promise<{id: string, feedId: string}>} what was removed
   * @throws {ApiError} `forbidden` · `not_found`
   *
   * **Future endpoint:** `DELETE /feed-replies/:id` → `204`.
   */
  async deleteMyReply(replyId, { creatorId } = {}) {
    if (!creatorId) {
      throw createApiError(
        API_ERROR_CODE.FORBIDDEN,
        'Only the creator who wrote a reply can delete it.'
      )
    }

    const reply = await loadOwnedReply(replyId, creatorId)

    try {
      await feedReplies.remove(replyId)
    } catch (failure) {
      // MOCK-DELETE: `json-server@0.17.4` removes the record and *then* throws
      // walking `platformSettings` for dependents (it has no ids), so a
      // successful delete answers `500`. The record really is gone, so the read
      // below is what decides — a `404` means it worked. Anything else, and the
      // original failure is the truth. This whole branch disappears with the
      // mock (see `crudFactory.remove`).
      const survived = await feedReplies
        .getById(replyId)
        .then(() => true)
        .catch((error) => error?.code !== API_ERROR_CODE.NOT_FOUND)

      if (survived) throw failure
    }

    await bumpRepliesCount(reply.feedId, -1)

    return { id: replyId, feedId: reply.feedId }
  },

  /**
   * How many creators have replied on each of a set of feeds — used where a
   * list needs live counts rather than the counter on the record.
   *
   * MOCK-AGGREGATE: one page of up to {@link FOLD_LIMIT} threads, folded here,
   * instead of `SELECT feed_id, COUNT(*) … GROUP BY feed_id`.
   *
   * @param {string[]} feedIds `req_…`
   * @returns {Promise<Map<string, number>>} feed id → reply count (present for
   *   every id asked for, zero included)
   */
  async countRepliesByFeed(feedIds = []) {
    const ids = [...new Set(feedIds.filter(Boolean))]
    const counts = new Map(ids.map((id) => [id, 0]))
    if (ids.length === 0) return counts

    const { items } = await feedReplies.list({
      page: 1,
      limit: FOLD_LIMIT,
      filters: { feedId: ids },
    })
    items.forEach((reply) => {
      counts.set(reply.feedId, (counts.get(reply.feedId) ?? 0) + 1)
    })
    return counts
  },
})

export default feedService
