// Creator sample work — `docs/api-contract.md` §6.5.
//
// `creatorId` here points at `creatorProfiles.id` (`cpr_…`), **not**
// `users.id` — see `docs/data-model.md` §3.
//
// Prompt 22 added the owner half of the moderation lifecycle: create, edit,
// submit for review, archive, and switch visibility. Every status change runs
// through `CONTENT_STATUS_MACHINE` here, and `submitForReview` is the **single**
// place a `moderationReviews` record is written on the creator's behalf (§7) —
// the reviewer's half of the lifecycle belongs to `moderationService`
// (Prompt 30) and is never reached from this module.

import { CONTENT_STATUS_MACHINE } from '@/constants/stateMachines'
import {
  CONTENT_STATUS,
  MODERATION_SUBJECT,
  VISIBILITY,
} from '@/constants/statuses'
import { ID_PREFIX } from '@/utils/id'
import { assertTransition, canTransition } from '@/utils/stateMachine'

import { API_ERROR_CODE, createApiError } from './api/apiError'
import { createCrudService } from './api/crudFactory'
import { arrayContains, SORT_ORDER } from './api/listAdapter'
import { moderationService } from './moderationService'

const portfolioItems = createCrudService('portfolioItems', {
  idPrefix: ID_PREFIX.PORTFOLIO_ITEM,
})

/**
 * MOCK-JOIN: the session carries a `usr_…` while a portfolio item is keyed by
 * `cpr_…`, and JSON Server cannot join (contract §6.5). The storefront is read
 * through a local CRUD handle rather than by importing `creatorProfileService`,
 * because that module already imports **this** one — a mutual import would be a
 * cycle for the sake of one lookup. Laravel resolves the owner from the
 * authenticated user server-side and the lookup disappears.
 */
const creatorProfiles = createCrudService('creatorProfiles', {
  idPrefix: ID_PREFIX.CREATOR_PROFILE,
})

/** Newest published work first (contract §6.5). */
const DEFAULT_SORT = 'publishedAt'

/**
 * The manager loads a creator's whole portfolio in one page: nobody keeps
 * hundreds of samples, and holding the full set is what lets the status chips
 * count without a request each (contract §4.1 caps a page at 100).
 */
const MANAGE_LIMIT = 100

/** Statuses that mean "with Trust & Safety" — nothing for the creator to do. */
export const PORTFOLIO_IN_REVIEW_STATUSES = Object.freeze([
  CONTENT_STATUS.SUBMITTED,
  CONTENT_STATUS.UNDER_REVIEW,
  // Decided, awaiting publication. It reads as "still in review" to the creator
  // because there is nothing for them to do about it either way.
  CONTENT_STATUS.APPROVED,
])

/** Statuses that are waiting on the creator — the nav badge counts these. */
export const PORTFOLIO_ATTENTION_STATUSES = Object.freeze([
  CONTENT_STATUS.REVISION_REQUIRED,
  CONTENT_STATUS.REJECTED,
])

/**
 * Fields `updateItem` refuses to carry. Each one belongs to a named operation
 * below, which is what keeps the lifecycle in a single place (00 §9) — a form
 * cannot publish its own item by putting `status` in the patch body.
 */
const LIFECYCLE_FIELDS = Object.freeze([
  'status',
  'visibility',
  'submittedAt',
  'publishedAt',
])

const nowIso = () => new Date().toISOString()

/** `conflict` is the contract's code for "not in the right state" (§3.2). */
const invalidState = (message, details) =>
  createApiError(API_ERROR_CODE.CONFLICT, message, details, 409)

/** Runs a status change through the machine, reporting a rejection as `409`. */
function transitionTo(from, to, message) {
  try {
    return assertTransition(CONTENT_STATUS_MACHINE, from, to)
  } catch (failure) {
    throw invalidState(message, { from, to, transition: failure.message })
  }
}

/**
 * What the history entry says, by where the submission came from. The wording
 * matches the notes the seed and the moderation console write, so one case's
 * timeline reads consistently however many rounds it went through.
 */
function submissionNote(fromStatus) {
  if (fromStatus === CONTENT_STATUS.PUBLISHED) {
    return 'Re-submitted by the creator after editing a published item.'
  }
  if (
    fromStatus === CONTENT_STATUS.REJECTED ||
    fromStatus === CONTENT_STATUS.REVISION_REQUIRED
  ) {
    return 'Re-submitted by the creator after making changes.'
  }
  return 'Submitted for review by the creator.'
}

/* -------------------------------------------------------------------------- */
/* Derivations the manager screen reads                                       */
/* -------------------------------------------------------------------------- */

/**
 * May the owner still edit this item? Editing is blocked exactly while the
 * item is with a reviewer — changing a submission under someone's eyes is how
 * a queue stops meaning anything — and once it has been archived.
 *
 * @param {object|null} item a `portfolioItems` record
 * @returns {boolean}
 */
export function canEditPortfolioItem(item) {
  if (!item?.status) return false
  return (
    !PORTFOLIO_IN_REVIEW_STATUSES.includes(item.status) &&
    item.status !== CONTENT_STATUS.ARCHIVED &&
    item.status !== CONTENT_STATUS.RESTRICTED
  )
}

/**
 * Is `submitted` reachable from where this item sits? Read straight off the
 * machine so the menu can never offer an action the service would refuse.
 *
 * @param {object|null} item a `portfolioItems` record
 * @returns {boolean}
 */
export function canSubmitPortfolioItem(item) {
  return canTransition(CONTENT_STATUS_MACHINE, item?.status, CONTENT_STATUS.SUBMITTED)
}

/**
 * Is `archived` reachable from where this item sits? Archiving is **final** —
 * `archived` is a terminal state, so there is no restore in v1 (documented in
 * `docs/data-model.md`).
 *
 * @param {object|null} item a `portfolioItems` record
 * @returns {boolean}
 */
export function canArchivePortfolioItem(item) {
  return canTransition(CONTENT_STATUS_MACHINE, item?.status, CONTENT_STATUS.ARCHIVED)
}

/**
 * Visibility is a published-item control: an unpublished item is already
 * invisible, so offering the switch would say something untrue.
 *
 * @param {object|null} item a `portfolioItems` record
 * @returns {boolean}
 */
export function canSetPortfolioVisibility(item) {
  return item?.status === CONTENT_STATUS.PUBLISHED
}

/**
 * Counts behind the status summary chips and the nav badge.
 *
 * A pure derivation over a loaded page — no request — so the chips recount the
 * moment an action changes something, and every status lands in exactly one
 * bucket (nothing a creator owns can become unreachable through the filters).
 *
 * @param {object[]} [items] the creator's portfolio items
 * @returns {{total: number, published: number, inReview: number,
 *   needsChanges: number, rejected: number, drafts: number, archived: number,
 *   restricted: number, attention: number}}
 */
export function summarizePortfolioStatuses(items = []) {
  const counts = {
    total: items.length,
    published: 0,
    inReview: 0,
    needsChanges: 0,
    rejected: 0,
    drafts: 0,
    archived: 0,
    restricted: 0,
    attention: 0,
  }

  items.forEach((item) => {
    if (PORTFOLIO_IN_REVIEW_STATUSES.includes(item.status)) counts.inReview += 1
    else if (item.status === CONTENT_STATUS.PUBLISHED) counts.published += 1
    else if (item.status === CONTENT_STATUS.REVISION_REQUIRED) counts.needsChanges += 1
    else if (item.status === CONTENT_STATUS.REJECTED) counts.rejected += 1
    else if (item.status === CONTENT_STATUS.DRAFT) counts.drafts += 1
    else if (item.status === CONTENT_STATUS.ARCHIVED) counts.archived += 1
    else if (item.status === CONTENT_STATUS.RESTRICTED) counts.restricted += 1
  })

  counts.attention = counts.needsChanges + counts.rejected
  return counts
}

export const portfolioService = Object.freeze({
  /**
   * @param {import('./api/listAdapter').ListParams} [params] filters:
   *   `creatorId`, `categoryId`, `contentType`, `status`, `visibility`, `tag`;
   *   sorts: `publishedAt`, `createdAt`, `title`
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  list({ filters, ...params } = {}) {
    const { tag, ...rest } = filters ?? {}
    return portfolioItems.list({
      sort: DEFAULT_SORT,
      order: SORT_ORDER.DESC,
      ...params,
      // `tags` is an array on the record — membership, not equality.
      filters: tag ? { ...rest, tags: arrayContains(tag) } : rest,
    })
  },

  /**
   * @param {string} id `pfi_…`
   * @returns {Promise<object>} the item
   * @throws {ApiError} `not_found`
   */
  getById: (id) => portfolioItems.getById(id),

  /**
   * A creator's own grid — every status by default, which is what the owner and
   * the moderation queue need.
   *
   * @param {string} creatorId `cpr_…`
   * @param {object} [options]
   * @param {string|string[]} [options.statuses] `CONTENT_STATUS` values (OR)
   * @param {import('./api/listAdapter').ListParams} [options.params] paging and sorting
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  listByCreator(creatorId, { statuses, ...params } = {}) {
    return portfolioService.list({
      sort: DEFAULT_SORT,
      order: SORT_ORDER.DESC,
      ...params,
      filters: { ...params.filters, creatorId, status: statuses },
    })
  },

  /**
   * The public portfolio — published **and** publicly visible items only.
   *
   * Both halves matter. `status: published` keeps drafts, submissions,
   * rejections, restricted work, and archived work off the profile; `visibility:
   * public` keeps *unlisted* work off it too. An unlisted item is fully
   * approved and published — its owner simply does not want it in the shop
   * window — so it is filtered here rather than anywhere upstream, which is what
   * makes this one function the single leak-proof boundary for the public
   * profile (Prompt 13), the discovery preview strips (Prompt 12), and anything
   * else that reaches for a creator's live work.
   *
   * @param {string} creatorId `cpr_…`
   * @param {import('./api/listAdapter').ListParams} [params] paging and sorting
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  listPublished(creatorId, params = {}) {
    return portfolioService.listByCreator(creatorId, {
      ...params,
      statuses: CONTENT_STATUS.PUBLISHED,
      filters: { ...params.filters, visibility: VISIBILITY.PUBLIC },
    })
  },

  /**
   * Adds sample work. Starts as `draft`; `mediaUrl`/`thumbnailUrl` come from
   * `uploadService` (contract §5).
   *
   * @param {object} payload the new item
   * @returns {Promise<object>} the created item
   */
  create: (payload) => portfolioItems.create(payload),

  /**
   * Edits, submits for review, or archives an item. Moderator-only statuses
   * (`approved`, `published`, `restricted`) move through `moderationService`.
   *
   * @param {string} id `pfi_…`
   * @param {object} patch changed fields only
   * @returns {Promise<object>} the updated item
   */
  update: (id, patch) => portfolioItems.update(id, patch),

  /* —— workflow operations (Prompt 22) ——————————————————————————————— */

  /**
   * Adds a portfolio item as a **private draft** — nothing is submitted and
   * nothing is public until {@link submitForReview} is called (contract §6.5).
   *
   * @param {string} creatorId `cpr_…` — the storefront that owns the work
   * @param {object} payload `{ title, description, categoryId, contentType,
   *   tags, mediaUrl, thumbnailUrl, mediaType, brandCredit }`
   * @returns {Promise<object>} the created item, `status: 'draft'`
   * @throws {ApiError} `validation_failed` when `creatorId` is missing
   *
   * **Future endpoint:** `POST /portfolioItems`, `creatorId` taken from the
   * authenticated creator rather than the body (00 §11).
   */
  createItem(creatorId, payload = {}) {
    if (!creatorId) {
      throw createApiError(
        API_ERROR_CODE.VALIDATION_FAILED,
        'We could not tell which storefront this belongs to.',
        { creatorId: 'A creator profile is required.' }
      )
    }

    const at = nowIso()
    return portfolioItems.create({
      ...payload,
      creatorId,
      // The creator never picks these: a new item is a draft, visible to
      // nobody, and dated by the server on migration day.
      status: CONTENT_STATUS.DRAFT,
      visibility: payload.visibility ?? VISIBILITY.PUBLIC,
      submittedAt: null,
      publishedAt: null,
      createdAt: at,
      updatedAt: at,
    })
  },

  /**
   * Edits an item's details. Deliberately **cannot** move `status`,
   * `visibility`, or the submission timestamps — those have named operations,
   * which is what keeps the lifecycle in one place (00 §9).
   *
   * @param {string} id `pfi_…`
   * @param {object} patch changed detail fields only
   * @returns {Promise<object>} the updated item
   *
   * **Future endpoint:** `PATCH /portfolioItems/:id`, authorised against the
   * owner of the item.
   */
  updateItem(id, patch = {}) {
    const details = { ...patch }
    LIFECYCLE_FIELDS.forEach((field) => delete details[field])
    return portfolioItems.update(id, { ...details, updatedAt: nowIso() })
  },

  /**
   * Sends an item into the Trust & Safety queue — the one operation that writes
   * on both sides of the lifecycle (contract §7, operation 19).
   *
   * Legal from `draft`, `rejected`, `revision_required` and — under the
   * **edit-republish policy** — `published`: editing live work re-opens a
   * review and the item leaves the public profile until a reviewer approves it
   * again (`CONTENT_STATUS_MACHINE`, `docs/data-model.md` moderation notes).
   *
   * A creator submitting their own work notifies nobody: they are the one who
   * pressed the button, and the reviewer's queue is a screen, not a bell.
   *
   * **Mock sequence** (`POST /portfolioItems/:id/submit` does not exist):
   * 1. `GET /portfolioItems/:id` — guard the transition
   * 2. `GET /moderationReviews?subjectId=…` — has this been reviewed before?
   * 3. `POST /moderationReviews` **or** `PATCH /moderationReviews/:id` —
   *    re-open the case, clearing the last decision and appending to `history`
   * 4. `PATCH /portfolioItems/:id` → `{ status: 'submitted', submittedAt }`
   *
   * Step 4 is deliberately **last**: a failure writing the case leaves the item
   * exactly where it was, so a creator retries a submission rather than
   * discovering their draft went missing into a queue that never received it.
   *
   * MOCK-APPEND: JSON Server cannot append to an array, so the existing
   * `history` is read and re-sent whole (contract §6.20).
   *
   * @param {string} itemId `pfi_…`
   * @param {object} options
   * @param {string} options.creatorUserId `usr_…` — the signed-in creator.
   *   `moderationReviews.creatorId` is a **user** id while the item is keyed by
   *   `cpr_…` (`docs/data-model.md` §3), and the caller already holds the
   *   session, so it is passed in rather than looked up.
   * @param {string} [options.note] history note override
   * @returns {Promise<{item: object, review: object}>} the submitted item and
   *   its open moderation case
   * @throws {ApiError} `validation_failed` (no `creatorUserId`) · `not_found` ·
   *   `conflict` (illegal transition, e.g. an item already in review)
   *
   * **Future endpoint:** `POST /portfolioItems/:id/submit` — one transaction
   * that guards the transition, upserts the case, and returns both records.
   */
  async submitForReview(itemId, { creatorUserId, note } = {}) {
    if (!creatorUserId) {
      throw createApiError(
        API_ERROR_CODE.VALIDATION_FAILED,
        'We could not tell who is submitting this item.',
        { creatorUserId: 'A signed-in creator is required.' }
      )
    }

    const item = await portfolioItems.getById(itemId)
    const status = transitionTo(
      item.status,
      CONTENT_STATUS.SUBMITTED,
      'This item cannot be sent for review from its current status.'
    )

    const at = nowIso()
    const entry = {
      at,
      byId: creatorUserId,
      fromStatus: item.status,
      toStatus: status,
      note: note ?? submissionNote(item.status),
    }

    const existing = await moderationService.getBySubject(
      MODERATION_SUBJECT.PORTFOLIO_ITEM,
      itemId
    )

    // Re-opening a decided case clears the decision it carried: the reason and
    // the notes described the *previous* submission, and leaving them behind is
    // how a creator ends up reading a rejection for work they already fixed.
    const review = existing
      ? await moderationService.update(existing.id, {
          status,
          reviewerId: null,
          notes: null,
          reasonCode: null,
          reviewedAt: null,
          submittedAt: at,
          history: [...(existing.history ?? []), entry],
        })
      : await moderationService.create({
          subjectType: MODERATION_SUBJECT.PORTFOLIO_ITEM,
          subjectId: itemId,
          creatorId: creatorUserId,
          status,
          history: [entry],
          submittedAt: at,
          reviewedAt: null,
        })

    const submitted = await portfolioItems.update(itemId, {
      status,
      submittedAt: at,
      updatedAt: at,
      // The old rejection copy belongs to the submission that was rejected.
      rejectionReason: null,
    })

    return { item: submitted, review }
  },

  /**
   * Retires an item. Legal from `draft`, `rejected`, `published`, and
   * `restricted`; `archived` is **terminal**, so this cannot be undone (v1
   * decision, documented in `docs/data-model.md`).
   *
   * The moderation case, if there is one, is left exactly as the reviewer
   * decided it — an archived item's history is still the record of what was
   * reviewed and why.
   *
   * @param {string} itemId `pfi_…`
   * @returns {Promise<object>} the archived item
   * @throws {ApiError} `not_found` · `conflict` (illegal transition — an item
   *   in review cannot be archived out from under the reviewer)
   *
   * **Future endpoint:** `PATCH /portfolioItems/:id` → `{ status: 'archived' }`,
   * authorised against the owner (contract §6.5).
   */
  async archiveItem(itemId) {
    const item = await portfolioItems.getById(itemId)
    const status = transitionTo(
      item.status,
      CONTENT_STATUS.ARCHIVED,
      'This item cannot be archived from its current status.'
    )

    return portfolioItems.update(itemId, { status, updatedAt: nowIso() })
  },

  /**
   * Switches a published item between the shop window and unlisted.
   *
   * `unlisted` means published-but-not-shown: the item keeps its approval and
   * its place in the manager, and {@link listPublished} filters it out of every
   * public surface. It is not a moderation state and it does not re-open a
   * review. A share-by-link affordance can be built on top of it later without
   * changing the stored value.
   *
   * @param {string} itemId `pfi_…`
   * @param {string} visibility a `VISIBILITY` value
   * @returns {Promise<object>} the updated item
   * @throws {ApiError} `validation_failed` (unknown value) · `not_found` ·
   *   `conflict` (the item is not published)
   *
   * **Future endpoint:** `PATCH /portfolioItems/:id` → `{ visibility }`.
   */
  async setVisibility(itemId, visibility) {
    if (!Object.values(VISIBILITY).includes(visibility)) {
      throw createApiError(
        API_ERROR_CODE.VALIDATION_FAILED,
        'That is not a visibility we recognise.',
        { visibility: `Choose one of ${Object.values(VISIBILITY).join(', ')}.` }
      )
    }

    const item = await portfolioItems.getById(itemId)
    if (item.status !== CONTENT_STATUS.PUBLISHED) {
      throw invalidState('Only published work can be shown or hidden.', {
        status: item.status,
      })
    }

    return portfolioItems.update(itemId, { visibility, updatedAt: nowIso() })
  },

  /**
   * Everything the portfolio manager paints in one read: the creator's whole
   * portfolio, the moderation case behind each item, and the status counts.
   *
   * MOCK-JOIN: JSON Server has no `include`, so the cases are fetched as one
   * batched list keyed by the creator and reduced here rather than one request
   * per rejected card (contract §6.20). The moderation half **fails soft** — a
   * queue that is unreachable costs the rejection banners their detail, which is
   * not a reason to leave a creator staring at an error instead of their work.
   *
   * > **Laravel** — `GET /portfolioItems?creatorId=…&include=moderationReview`,
   * > and this collapses to one request with the case embedded per item.
   *
   * @param {string} creatorId `cpr_…`
   * @param {object} [options]
   * @param {string} [options.creatorUserId] `usr_…`, for the moderation lookup;
   *   omit it and the items come back with no cases attached
   * @returns {Promise<{items: object[], total: number,
   *   reviewsByItemId: Object<string, object>, counts: object}>} newest first
   */
  async listManagedByCreator(creatorId, { creatorUserId } = {}) {
    // Newest first by *creation*: a draft has no `publishedAt`, and the default
    // ordering would sort the unpublished half of the grid arbitrarily.
    const itemsPromise = portfolioService.listByCreator(creatorId, {
      page: 1,
      limit: MANAGE_LIMIT,
      sort: 'createdAt',
      order: SORT_ORDER.DESC,
    })

    const reviewsPromise = creatorUserId
      ? moderationService
          .list({
            page: 1,
            limit: MANAGE_LIMIT,
            sort: 'submittedAt',
            order: SORT_ORDER.DESC,
            filters: {
              creatorId: creatorUserId,
              subjectType: MODERATION_SUBJECT.PORTFOLIO_ITEM,
            },
          })
          .then((result) => result.items)
          .catch(() => [])
      : Promise.resolve([])

    const [{ items, total }, reviews] = await Promise.all([itemsPromise, reviewsPromise])

    // Newest case per item — the list is already newest first, so the first one
    // seen for a subject is the one that describes where it stands now.
    const reviewsByItemId = {}
    reviews.forEach((review) => {
      if (!reviewsByItemId[review.subjectId]) reviewsByItemId[review.subjectId] = review
    })

    return { items, total, reviewsByItemId, counts: summarizePortfolioStatuses(items) }
  },

  /**
   * How many items are waiting on the creator — the Portfolio nav badge.
   *
   * Takes a **user** id because that is what the dashboard shell holds; the
   * storefront behind it is resolved here (see `creatorProfiles` above).
   * Returns `0` rather than throwing when the account has no storefront yet.
   *
   * @param {string} creatorUserId `usr_…`
   * @returns {Promise<number>} rejected + changes-requested items
   */
  async countNeedingAttention(creatorUserId) {
    if (!creatorUserId) return 0

    const { items: profiles } = await creatorProfiles.list({
      page: 1,
      limit: 1,
      filters: { userId: creatorUserId },
    })
    const creatorId = profiles[0]?.id
    if (!creatorId) return 0

    // `limit: 1` — only `X-Total-Count` is wanted, not the records.
    const { total } = await portfolioService.listByCreator(creatorId, {
      page: 1,
      limit: 1,
      statuses: PORTFOLIO_ATTENTION_STATUSES,
    })
    return total
  },
})

export default portfolioService
