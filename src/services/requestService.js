// Buyer briefs — `docs/api-contract.md` §6.7. The demand side of the
// marketplace and the source of the public request board.

import { appConfig } from '@/config/appConfig'
import { REQUEST_STATUS_MACHINE } from '@/constants/stateMachines'
import { BUDGET_TYPE, CONTENT_TYPE, REQUEST_STATUS } from '@/constants/statuses'
import { ID_PREFIX } from '@/utils/id'
import { assertTransition } from '@/utils/stateMachine'

import { API_ERROR_CODE, createApiError } from './api/apiError'
import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'
import { uploadService, UPLOAD_PURPOSE } from './uploadService'

const contentRequests = createCrudService('contentRequests', { idPrefix: ID_PREFIX.REQUEST })

/** Newest published brief first (contract §6.7). */
const DEFAULT_SORT = 'publishedAt'

/** Content types that carry a `videoDurationSec` (contract §6.7). */
const VIDEO_TYPES = [CONTENT_TYPE.VIDEO, CONTENT_TYPE.BUNDLE]

/** True when a brief of this type has to state a clip length. */
export const requiresVideoDuration = (contentType) => VIDEO_TYPES.includes(contentType)

/** A brief's deliverable deadline lands at 17:00 UTC, as the seeded briefs do. */
const DEADLINE_HOUR_UTC = 'T17:00:00.000Z'

/**
 * The wizard collects a calendar day (`YYYY-MM-DD`); the record stores a
 * datetime (00 §8). Anything already carrying a time passes through untouched.
 */
function toDeadlineIso(value) {
  if (!value) return null
  const raw = String(value)
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}${DEADLINE_HOUR_UTC}` : raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

/** Trimmed string, or `''` — free-text fields are never `null` on a record. */
const text = (value) => String(value ?? '').trim()

/**
 * A finite amount rounded to cents, or `null` when there is nothing to store.
 * An unanswered budget on a half-finished draft is `null`, never `0` — `$0` is
 * a claim about the brief, and `Number('')` would quietly make it.
 */
function money(value) {
  if (value === '' || value === null || value === undefined) return null
  const amount = Number(value)
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : null
}

/**
 * Every field of a brief, in data-model order, built from the wizard's values.
 *
 * This is the one place that knows the record's shape, so a draft saved at step
 * two and a brief published at step four can never disagree about it
 * (`docs/data-model.md` → `contentRequests`).
 *
 * @param {object} input wizard values (see `createRequest`)
 * @param {string[]} referenceUrls URLs of the already-uploaded reference images
 * @returns {object} the record body, minus `id`/`createdAt` (the CRUD layer's)
 */
function toRequestRecord(input, referenceUrls) {
  const contentType = input.contentType || null
  const budgetType = input.budgetType || BUDGET_TYPE.FIXED
  const budgetMin = money(input.budgetMin)
  // A fixed price is stored as a range of one, so every consumer can read
  // `budgetMin`/`budgetMax` without branching (contract §6.7).
  const budgetMax = budgetType === BUDGET_TYPE.RANGE ? money(input.budgetMax) : budgetMin

  const record = {
    buyerId: input.buyerId,
    title: text(input.title),
    description: text(input.description),
    categoryId: input.categoryId || null,
    contentType,
    quantity: Number(input.quantity) || 1,
    orientation: input.orientation || null,
    usageRights: input.usageRights || null,
    brandGuidelines: text(input.brandGuidelines),
    dos: text(input.dos),
    donts: text(input.donts),
    referenceUrls,
    budgetType,
    budgetMin,
    budgetMax,
    currency: input.currency ?? appConfig.defaultCurrency,
    deadline: toDeadlineIso(input.deadline),
  }

  // Video length exists only where the contract says it does: a brief switched
  // from a bundle back to photos must not keep a stale duration.
  if (requiresVideoDuration(contentType) && input.videoDurationSec) {
    record.videoDurationSec = Number(input.videoDurationSec)
  }

  // Prompt 16 addition, documented in `docs/data-model.md` and contract §6.7:
  // the creator a buyer arrived from (`/buyer/requests/new?creator=cpr_…`).
  // A hint for Prompt 23's proposal board, never an award — the brief still
  // goes to the whole marketplace.
  if (input.invitedCreatorId) record.invitedCreatorId = input.invitedCreatorId

  return record
}

/** Uploads the newly picked reference images and returns every URL to store. */
async function collectReferenceUrls({ referenceFiles, referenceUrls }) {
  const kept = Array.isArray(referenceUrls) ? referenceUrls.filter(Boolean) : []
  const files = Array.isArray(referenceFiles) ? referenceFiles.filter(Boolean) : []
  if (files.length === 0) return kept

  // Uploading is a separate step from the record it belongs to (contract §5.1),
  // so a failed upload leaves the brief untouched and can simply be retried.
  const uploaded = await uploadService.uploadFiles(files, {
    purpose: UPLOAD_PURPOSE.REQUEST_REFERENCE,
  })

  // `referenceUrls` is `string[]` in the data model, so only the URL is kept —
  // the rest of the file object (id, size, thumbnail) has nowhere to live.
  return [...kept, ...uploaded.map((file) => file.url)]
}

export const requestService = Object.freeze({
  /**
   * @param {import('./api/listAdapter').ListParams} [params] filters:
   *   `buyerId`, `status`, `categoryId`, `contentType`, `usageRights`,
   *   `budgetMin_gte`/`budgetMax_lte`, `deadline_gte`/`deadline_lte`;
   *   sorts: `publishedAt`, `createdAt`, `deadline`, `budgetMax`, `proposalsCount`
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  list: (params = {}) =>
    contentRequests.list({ sort: DEFAULT_SORT, order: SORT_ORDER.DESC, ...params }),

  /**
   * @param {string} id `req_…`
   * @returns {Promise<object>} the brief
   * @throws {ApiError} `not_found`
   */
  getById: (id) => contentRequests.getById(id),

  /**
   * The public request board — open briefs only.
   *
   * @param {import('./api/listAdapter').ListParams} [params] any filter above
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  listOpen(params = {}) {
    return requestService.list({
      ...params,
      filters: { ...params.filters, status: REQUEST_STATUS.OPEN },
    })
  },

  /**
   * "My requests" — every brief a buyer owns, drafts included.
   *
   * @param {string} buyerId `usr_…`
   * @param {import('./api/listAdapter').ListParams} [params] any filter above
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  listByBuyer(buyerId, params = {}) {
    return requestService.list({
      sort: 'createdAt',
      order: SORT_ORDER.DESC,
      ...params,
      filters: { ...params.filters, buyerId },
    })
  },

  /**
   * Creates a brief. Starts as `draft`; publishing is a `PATCH` to
   * `{ status: 'open', publishedAt }`.
   *
   * @param {object} payload the new brief
   * @returns {Promise<object>} the created brief
   */
  create: (payload) => contentRequests.create(payload),

  /**
   * Edits, publishes, or cancels a brief. `proposalsCount` and
   * `awardedProposalId` are derived and never sent by a feature — awarding
   * happens inside `orderService.acceptProposal` (contract §7).
   *
   * @param {string} id `req_…`
   * @param {object} patch changed fields only
   * @returns {Promise<object>} the updated brief
   */
  update: (id, patch) => contentRequests.update(id, patch),

  /**
   * Publishes a brief from the request wizard (Prompt 16).
   *
   * Does the whole job in one call — uploads the reference images, shapes the
   * record, and either creates it live or promotes the draft it was written in
   * — so the wizard never has to know what a published brief looks like.
   *
   * @param {object} input wizard values: `buyerId`, `title`, `description`,
   *   `categoryId`, `contentType`, `quantity`, `videoDurationSec`,
   *   `orientation`, `usageRights`, `brandGuidelines`, `dos`, `donts`,
   *   `referenceFiles` (`File[]`), `referenceUrls` (already uploaded),
   *   `budgetType`, `budgetMin`, `budgetMax`, `deadline`, `invitedCreatorId`
   * @param {object} [options]
   * @param {string} [options.draftId] publish this draft instead of creating a
   *   new record, so saving a draft never leaves a duplicate behind
   * @returns {Promise<object>} the published brief, `status: 'open'`
   * @throws {ApiError} `validation_failed` on a rejected reference image;
   *   `conflict` when `draftId` names a brief that is no longer a draft
   */
  async createRequest(input, { draftId } = {}) {
    const referenceUrls = await collectReferenceUrls(input)
    const record = toRequestRecord(input, referenceUrls)

    const published = {
      ...record,
      status: REQUEST_STATUS.OPEN,
      publishedAt: new Date().toISOString(),
    }

    if (draftId) {
      const draft = await contentRequests.getById(draftId)
      // Publishing is a status transition like any other (00 §9) — a draft that
      // was cancelled in another tab must not quietly come back to life.
      // `assertTransition` throws a plain Error, so it is mapped onto the
      // `ApiError` every caller above the services layer expects (Prompt 07).
      try {
        assertTransition(REQUEST_STATUS_MACHINE, draft.status, REQUEST_STATUS.OPEN)
      } catch (failure) {
        throw createApiError(
          API_ERROR_CODE.CONFLICT,
          'This draft can no longer be published. Reload the page to see where it got to.',
          { status: failure.message }
        )
      }

      return contentRequests.update(draftId, published)
    }

    // Derived and read-only from here on: nothing but `proposalService` and
    // `orderService` may move these (contract §6.7).
    return contentRequests.create({ ...published, proposalsCount: 0, awardedProposalId: null })
  },

  /**
   * Saves the wizard's current state as a private `draft` (Prompt 16).
   *
   * Called both by the explicit "Save as draft" button and by the wizard's
   * autosave, so it is deliberately tolerant: half-finished values are stored
   * as they stand, and only a title is really needed to make the draft findable
   * again. Reference images upload here too, so a resumed draft still has them.
   *
   * @param {object} input the same values as {@link createRequest}
   * @param {object} [options]
   * @param {string} [options.draftId] update this draft rather than starting one
   * @returns {Promise<object>} the saved draft, `status: 'draft'`
   * @throws {ApiError} `validation_failed` when the brief has no title yet
   */
  async saveDraft(input, { draftId } = {}) {
    if (!text(input?.title)) {
      throw createApiError(API_ERROR_CODE.VALIDATION_FAILED, 'A draft needs a title.', {
        title: 'Give your request a title before saving it as a draft.',
      })
    }

    const referenceUrls = await collectReferenceUrls(input)
    const record = toRequestRecord(input, referenceUrls)

    if (draftId) return contentRequests.update(draftId, record)

    return contentRequests.create({
      ...record,
      status: REQUEST_STATUS.DRAFT,
      publishedAt: null,
      proposalsCount: 0,
      awardedProposalId: null,
    })
  },

  /**
   * Loads a draft back into the wizard (`/buyer/requests/new?draft=req_…`).
   *
   * Refuses anything that is not this buyer's unpublished draft: a published
   * brief is edited from its own screen (Prompt 18), not by reopening the
   * wizard on top of it.
   *
   * SECURITY: the ownership check here is UX only (00 §11). The Laravel API
   * must scope the read to the signed-in buyer as well.
   *
   * @param {string} id `req_…`
   * @param {object} [options]
   * @param {string} [options.buyerId] reject drafts belonging to someone else
   * @returns {Promise<object>} the draft
   * @throws {ApiError} `not_found` · `forbidden` · `conflict` (already published)
   */
  async getDraft(id, { buyerId } = {}) {
    const request = await contentRequests.getById(id)

    if (buyerId && request.buyerId !== buyerId) {
      throw createApiError(API_ERROR_CODE.FORBIDDEN, 'This draft belongs to another account.')
    }
    if (request.status !== REQUEST_STATUS.DRAFT) {
      throw createApiError(
        API_ERROR_CODE.CONFLICT,
        'This request has already been published, so it cannot be reopened as a draft.'
      )
    }

    return request
  },

  // —— workflow operations (added by later prompts) ——
  // cancelRequest / closeRequest — Prompt 18 (request management),
  // enforcing REQUEST_STATUS_MACHINE via `utils/stateMachine#assertTransition`.
})

export default requestService
