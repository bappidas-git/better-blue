// Creator sample work — `docs/api-contract.md` §6.5.
//
// `creatorId` here points at `creatorProfiles.id` (`cpr_…`), **not**
// `users.id` — see `docs/data-model.md` §3.

import { CONTENT_STATUS } from '@/constants/statuses'
import { ID_PREFIX } from '@/utils/id'

import { createCrudService } from './api/crudFactory'
import { arrayContains, SORT_ORDER } from './api/listAdapter'

const portfolioItems = createCrudService('portfolioItems', {
  idPrefix: ID_PREFIX.PORTFOLIO_ITEM,
})

/** Newest published work first (contract §6.5). */
const DEFAULT_SORT = 'publishedAt'

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
   * The public portfolio — published items only.
   *
   * @param {string} creatorId `cpr_…`
   * @param {import('./api/listAdapter').ListParams} [params] paging and sorting
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  listPublished(creatorId, params = {}) {
    return portfolioService.listByCreator(creatorId, {
      ...params,
      statuses: CONTENT_STATUS.PUBLISHED,
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

  // —— workflow operations (added by later prompts) ——
  // submitForReview / archiveItem — Prompt 20 (portfolio), enqueueing a
  // `moderationReviews` record and enforcing CONTENT_STATUS_MACHINE.
})

export default portfolioService
