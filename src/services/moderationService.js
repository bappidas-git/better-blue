// The Trust & Safety review queue — `docs/api-contract.md` §6.20.
//
// One record per piece of content in the review pipeline. `creatorId` points at
// `users.id`; `subjectId` at a `portfolioItems` or `deliveries` record.

import { CONTENT_STATUS } from '@/constants/statuses'
import { ID_PREFIX } from '@/utils/id'

import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'

const moderationReviews = createCrudService('moderationReviews', {
  idPrefix: ID_PREFIX.MODERATION_REVIEW,
  // Moderation cases are stamped `submittedAt`, not `createdAt` (contract §6.20).
  timestampField: 'submittedAt',
})

/** The statuses that make a case "open" — everything not yet decided. */
export const OPEN_QUEUE_STATUSES = Object.freeze([
  CONTENT_STATUS.SUBMITTED,
  CONTENT_STATUS.UNDER_REVIEW,
])

export const moderationService = Object.freeze({
  /**
   * @param {import('./api/listAdapter').ListParams} [params] filters: `status`,
   *   `subjectType`, `subjectId`, `creatorId`, `reviewerId`, `reasonCode`,
   *   `submittedAt_gte`/`submittedAt_lte`; sort: `submittedAt`
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  list: (params = {}) =>
    moderationReviews.list({ sort: 'submittedAt', order: SORT_ORDER.ASC, ...params }),

  /**
   * @param {string} id `mod_…`
   * @returns {Promise<object>} the case
   * @throws {ApiError} `not_found`
   */
  getById: (id) => moderationReviews.getById(id),

  /**
   * The open queue — undecided cases, **oldest first**, which is the order a
   * reviewer works them in (contract §6.20).
   *
   * @param {import('./api/listAdapter').ListParams} [params] any filter above;
   *   pass `filters.status` to narrow to one of the open statuses
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  listQueue(params = {}) {
    return moderationService.list({
      ...params,
      filters: { status: OPEN_QUEUE_STATUSES, ...params.filters },
    })
  },

  /**
   * The case covering one piece of content — the "is this in review?" lookup
   * the portfolio and delivery screens run.
   *
   * @param {string} subjectType `portfolio_item` | `delivery`
   * @param {string} subjectId the reviewed record's id
   * @returns {Promise<object|null>} the most recent case, or `null` when never submitted
   */
  async getBySubject(subjectType, subjectId) {
    if (!subjectType || !subjectId) return null
    const { items } = await moderationReviews.list({
      page: 1,
      limit: 1,
      sort: 'submittedAt',
      order: SORT_ORDER.DESC,
      filters: { subjectType, subjectId },
    })
    return items[0] ?? null
  },

  /**
   * Enqueues content for review — written when a creator submits, never by a
   * reviewer.
   *
   * @param {object} payload the new case
   * @returns {Promise<object>} the created case
   */
  create: (payload) => moderationReviews.create(payload),

  /**
   * Claims a case, or records a decision (admin).
   *
   * MOCK-APPEND: JSON Server cannot append to an array, so a caller changing
   * `history` must read the record, push its entry, and send the **whole**
   * array back — two reviewers acting at once lose one entry (contract §6.20).
   *
   * @param {string} id `mod_…`
   * @param {object} patch changed fields only
   * @returns {Promise<object>} the updated case
   */
  update: (id, patch) => moderationReviews.update(id, patch),

  // —— workflow operations (added by later prompts) ——
  // claimCase / recordDecision — Prompt 30 (admin moderation): sets `status`
  // and `reviewedAt`, appends to `history`, propagates the outcome to the
  // subject, and notifies the creator.
})

export default moderationService
