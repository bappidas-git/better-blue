// Buyer briefs — `docs/api-contract.md` §6.7. The demand side of the
// marketplace and the source of the public request board.
//
// CYCLE: this module, `proposalService`, and `orderService` all import each
// other — closing a brief declines its offers, submitting an offer bumps the
// brief's counter, and the board's buyer card counts that business's completed
// orders. Every one of those references sits **inside a function body**, never
// at module scope, so ES module live bindings resolve any evaluation order.
// Keep it that way when extending these three.

import { appConfig } from '@/config/appConfig'
import { AUDIT_ACTION } from '@/constants/auditActions'
import { NOTIFICATION_TYPE } from '@/constants/notificationTypes'
import { REQUEST_STATUS_MACHINE } from '@/constants/stateMachines'
import {
  BUDGET_TYPE,
  CONTENT_TYPE,
  PROPOSAL_STATUS,
  REQUEST_STATUS,
} from '@/constants/statuses'
import { ID_PREFIX } from '@/utils/id'
import { toAmount } from '@/utils/money'
import { assertTransition } from '@/utils/stateMachine'

import { API_ERROR_CODE, createApiError } from './api/apiError'
import { auditService } from './auditService'
import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'
import { buyerProfileService } from './buyerProfileService'
import { notificationService } from './notificationService'
import { orderService } from './orderService'
import { proposalService } from './proposalService'
import { uploadService, UPLOAD_PURPOSE } from './uploadService'
import { userService } from './userService'

const contentRequests = createCrudService('contentRequests', { idPrefix: ID_PREFIX.REQUEST })

/** Newest published brief first (contract §6.7). */
const DEFAULT_SORT = 'publishedAt'

/** Provider page ceiling (contract §4.1) — bounds the client-side folds below. */
const FOLD_LIMIT = 100

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
const money = (value) => toAmount(value)

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

/**
 * Everything a brief must carry before creators may see it, in the order the
 * wizard asks for it. This is the *record-level* mirror of the wizard's
 * validators (Prompt 16 `useRequestWizard`): the wizard guards the form, this
 * guards the row — a draft saved half-finished at step two, then published
 * months later from the request list, never gets past here incomplete.
 *
 * Labels are the copy the buyer reads in the "still missing" list (§13).
 */
const PUBLISH_REQUIREMENTS = Object.freeze([
  Object.freeze({ field: 'title', label: 'Title' }),
  Object.freeze({ field: 'categoryId', label: 'Category' }),
  Object.freeze({ field: 'contentType', label: 'Content type' }),
  Object.freeze({ field: 'description', label: 'Description' }),
  Object.freeze({ field: 'quantity', label: 'How many deliverables' }),
  Object.freeze({
    field: 'videoDurationSec',
    label: 'Clip length',
    // Only briefs that involve video carry one (contract §6.7).
    when: (request) => requiresVideoDuration(request.contentType),
  }),
  Object.freeze({ field: 'orientation', label: 'Framing' }),
  Object.freeze({ field: 'usageRights', label: 'Usage rights' }),
  Object.freeze({ field: 'budgetMin', label: 'Budget' }),
  Object.freeze({
    field: 'budgetMax',
    label: 'Top of your budget range',
    when: (request) => request.budgetType === BUDGET_TYPE.RANGE,
  }),
  Object.freeze({ field: 'deadline', label: 'Deadline' }),
])

/** An answered field: `0`, `''`, `null`, and `undefined` all count as unanswered. */
const isAnswered = (value) => value !== null && value !== undefined && value !== '' && value !== 0

/**
 * Which parts of a draft are still blank — `[]` when it is ready to publish.
 *
 * Exported so the request list can name the gaps *before* opening a confirm
 * dialog, and so `publishDraft` and that dialog can never disagree about what
 * "complete" means.
 *
 * @param {object} request a brief record
 * @returns {string[]} human labels of the missing fields, in wizard order
 */
export function missingPublishFields(request) {
  if (!request) return PUBLISH_REQUIREMENTS.map((requirement) => requirement.label)

  return PUBLISH_REQUIREMENTS.filter(
    (requirement) =>
      (!requirement.when || requirement.when(request)) &&
      !isAnswered(request[requirement.field])
  ).map((requirement) => requirement.label)
}

/**
 * Runs a status change through `REQUEST_STATUS_MACHINE` and reports a rejection
 * the way the contract does: `409 conflict` with `details: { from, to }` (§8.1).
 */
function transitionTo(from, to, message) {
  try {
    return assertTransition(REQUEST_STATUS_MACHINE, from, to)
  } catch (failure) {
    throw createApiError(
      API_ERROR_CODE.CONFLICT,
      message,
      { from, to, transition: failure.message },
      409
    )
  }
}

/**
 * Loads a brief and refuses it unless `buyerId` owns it.
 *
 * SECURITY: this is UX only (00 §11) — it keeps one buyer from acting on
 * another's brief by URL, and Laravel must scope every one of these operations
 * to the signed-in buyer independently.
 */
async function loadOwnedRequest(id, buyerId) {
  const request = await contentRequests.getById(id)
  if (buyerId && request.buyerId !== buyerId) {
    throw createApiError(API_ERROR_CODE.FORBIDDEN, 'This request belongs to another account.')
  }
  return request
}

/**
 * The business behind a brief, as the request board is allowed to show it:
 * the trading name, the logo, and how long they have been on BetterBlue.
 *
 * Public information only (Prompt 23 §4.2) — no email, no phone, no spend. The
 * account is read for `name` and `createdAt`; everything else comes from the
 * `buyerProfiles` record, which is the business's own public description.
 *
 * MOCK-JOIN: two requests for a whole page of briefs (accounts by id, profiles
 * by `userId`), because `_embed`/`_expand` are banned (00 §10). Laravel
 * serialises this from `GET /contentRequests?…&include=buyer`.
 *
 * @param {string[]} buyerUserIds `usr_…`
 * @returns {Promise<Map<string, object>>} `usr_…` → the public buyer summary
 */
async function loadBuyers(buyerUserIds) {
  const ids = [...new Set(buyerUserIds.filter(Boolean))]
  if (ids.length === 0) return new Map()

  const [accounts, businesses] = await Promise.all([
    userService.listByIds(ids),
    buyerProfileService.list({ page: 1, limit: FOLD_LIMIT, filters: { userId: ids } }),
  ])

  const businessByUserId = new Map(
    businesses.items.map((business) => [business.userId, business])
  )

  return new Map(
    accounts.map((account) => {
      const business = businessByUserId.get(account.id)
      return [
        account.id,
        {
          userId: account.id,
          // The person's name is the fallback for a business that has not
          // filled its profile in — a card with no name at all is worse.
          name: account.name,
          companyName: business?.companyName ?? null,
          logoUrl: business?.logoUrl ?? null,
          industry: business?.industry ?? null,
          location: business?.location ?? null,
          bio: business?.bio ?? null,
          website: business?.website ?? null,
          memberSince: business?.createdAt ?? account.createdAt ?? null,
        },
      ]
    })
  )
}

/**
 * Ends the offers on a brief that is being closed or cancelled, and tells the
 * creators why.
 *
 * MOCK-ATOMICITY: one `PATCH` and one notification per live offer, sequentially
 * — JSON Server rewrites `db.json` on every write, so parallel writes drop rows
 * (the same constraint `orderService.acceptProposal` works around). A creator
 * whose notification fails still has a correctly declined offer.
 */
async function endLiveProposals(request, { reason, closing, byAdmin = false }) {
  const live = await proposalService.listUndecided(request.id)
  if (live.length === 0) return 0

  const verb = closing ? 'closed' : 'cancelled'
  // Prompt 31: the same cascade, told honestly about who did it. A creator
  // reading "the buyer closed this" about a brief BetterBlue took down would
  // aim their next question at the wrong person.
  const body = byAdmin
    ? `BetterBlue has ${verb} “${request.title}”, so your proposal will not be taken forward.` +
      (reason ? ` Reason: ${reason}` : '') +
      ' Nothing about this reflects on your proposal or your account.'
    : `The buyer has ${verb} “${request.title}” without awarding it, so your proposal ` +
      'will not be taken forward.' +
      (reason ? ` They said: “${reason}”` : ' Thanks for taking the time to propose.')
  const respondedAt = new Date().toISOString()

  for (const offer of live) {
    // eslint-disable-next-line no-await-in-loop -- see MOCK-ATOMICITY above.
    await proposalService.update(offer.id, {
      status: PROPOSAL_STATUS.DECLINED,
      respondedAt,
    })

    try {
      // eslint-disable-next-line no-await-in-loop -- as above.
      await notificationService.notify({
        userId: offer.creatorId,
        type: NOTIFICATION_TYPE.PROPOSAL_DECLINED,
        title: closing ? 'Request closed' : 'Request cancelled',
        body,
        entityType: 'request',
        entityId: request.id,
      })
    } catch {
      // An unsent bell item must not undo a decline that already happened.
    }
  }

  return live.length
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

  /* —— workflow operations —————————————————————————————————————————————— */

  /**
   * "My requests", with the one number the list page cannot read off a brief:
   * how many offers on it the buyer has not looked at yet (Prompt 18 §4.1).
   *
   * MOCK-JOIN: `proposalsCount` is stored on the brief, but "new" means
   * `submitted` — an offer nobody has starred or declined — which only the
   * proposals collection knows. That is one extra request for the whole page,
   * scoped to the ids on it, rather than one per card. Laravel returns
   * `newProposalsCount` from the same query that lists the briefs.
   *
   * A failure of that second request is swallowed: an accent badge is never
   * worth failing a list for, so the briefs render with `newProposalsCount: 0`.
   *
   * @param {string} buyerId `usr_…`
   * @param {import('./api/listAdapter').ListParams} [params] page, sort, search,
   *   and any filter `list` accepts — `status` is the tab
   * @returns {Promise<import('./api/listAdapter').ListResult>} briefs, each with
   *   `newProposalsCount`
   */
  async listForBuyer(buyerId, params = {}) {
    const result = await requestService.listByBuyer(buyerId, params)

    // Only live briefs can gain offers; a draft or a finished brief never does,
    // so they are left out of the lookup rather than queried for nothing.
    const liveIds = result.items
      .filter((request) => request.status === REQUEST_STATUS.OPEN)
      .map((request) => request.id)

    let newByRequest = new Map()
    if (liveIds.length > 0) {
      try {
        const { items } = await proposalService.list({
          page: 1,
          limit: FOLD_LIMIT,
          filters: { requestId: liveIds, status: PROPOSAL_STATUS.SUBMITTED },
        })
        newByRequest = items.reduce(
          (counts, proposal) =>
            counts.set(proposal.requestId, (counts.get(proposal.requestId) ?? 0) + 1),
          new Map()
        )
      } catch {
        // See above — the badge is an accent, not the payload.
      }
    }

    return {
      ...result,
      items: result.items.map((request) => ({
        ...request,
        newProposalsCount: newByRequest.get(request.id) ?? 0,
      })),
    }
  },

  /**
   * How many briefs a buyer has in each status — the tab counts (§5).
   *
   * MOCK-AGGREGATE: one page of up to {@link FOLD_LIMIT} briefs, folded here,
   * instead of the six `SELECT COUNT(*) … GROUP BY status` a server would run.
   * A buyer past that ceiling gets counts for their newest 100 briefs; `total`
   * stays exact either way, and `capped` says which case you are in. Laravel:
   * `GET /buyer/requests/counts`.
   *
   * @param {string} buyerId `usr_…`
   * @returns {Promise<{total: number, capped: boolean, byStatus: Object<string, number>}>}
   *   `byStatus` carries an entry for **every** `REQUEST_STATUS`, zero included
   */
  async countsByStatus(buyerId) {
    const byStatus = Object.fromEntries(
      Object.values(REQUEST_STATUS).map((status) => [status, 0])
    )

    if (!buyerId) return { total: 0, capped: false, byStatus }

    const { items, total } = await requestService.listByBuyer(buyerId, {
      page: 1,
      limit: FOLD_LIMIT,
    })

    items.forEach((request) => {
      if (byStatus[request.status] !== undefined) byStatus[request.status] += 1
    })

    return { total, capped: total > items.length, byStatus }
  },

  /**
   * The nav badge: offers waiting on this buyer's decision (§6).
   *
   * APPROXIMATION (documented per §6): the badge is specified as "open requests
   * with new proposals" and this counts the **proposals** instead — a buyer with
   * three new offers on one brief sees `3`, not `1`. It is one request rather
   * than one per brief, it is never zero when something is genuinely waiting,
   * and it reads the same way the overview's "Proposals to review" tile does,
   * which is the number a buyer has already seen on the dashboard.
   *
   * @param {string} buyerId `usr_…`
   * @returns {Promise<number>} `0` when nothing is waiting, or on any failure
   */
  async countProposalsAwaitingDecision(buyerId) {
    if (!buyerId) return 0

    const open = await requestService.listByBuyer(buyerId, {
      page: 1,
      limit: FOLD_LIMIT,
      filters: { status: REQUEST_STATUS.OPEN },
    })

    const openIds = open.items.map((request) => request.id)
    if (openIds.length === 0) return 0

    const { total } = await proposalService.list({
      page: 1,
      limit: 1,
      filters: { requestId: openIds, status: PROPOSAL_STATUS.SUBMITTED },
    })
    return total
  },

  /**
   * **The request board** — every open brief, with the business behind it
   * (Prompt 23 §4.2).
   *
   * One function for both surfaces: the public board at `/requests` and the
   * creator's in-dashboard browse view render the same cards from the same
   * call, differing only in the chrome around them and in the filters they
   * default to.
   *
   * A failed buyer join is **not** a failed board: the briefs render with
   * `buyer: null` and the card falls back to the brief alone. The work is the
   * payload; the logo is the garnish.
   *
   * @param {import('./api/listAdapter').ListParams} [params] page, limit, sort,
   *   `search`, and any filter `list` accepts — `status` is forced to `open`
   * @returns {Promise<import('./api/listAdapter').ListResult>} open briefs, each
   *   with `buyer` (see `loadBuyers`)
   *
   * **Future endpoint:** `GET /contentRequests?status=open&include=buyer`.
   */
  async listBoard(params = {}) {
    const result = await requestService.listOpen(params)
    if (result.items.length === 0) return result

    let buyers = new Map()
    try {
      buyers = await loadBuyers(result.items.map((request) => request.buyerId))
    } catch {
      // See above.
    }

    return {
      ...result,
      items: result.items.map((request) => ({
        ...request,
        buyer: buyers.get(request.buyerId) ?? null,
      })),
    }
  },

  /**
   * The businesses behind a set of accounts, as any creator-facing surface is
   * allowed to show them — trading name, logo, industry, location.
   *
   * The same join `listBoard` runs, exposed because the creator's order list and
   * order workspace need exactly it: an order carries `buyerId` and nothing
   * about who that is (Prompt 24 §4.3). Sharing the helper rather than writing a
   * second one is also what keeps "public information only" a single decision —
   * no email, no phone, no spend, in one place.
   *
   * @param {string[]} buyerUserIds `usr_…`
   * @returns {Promise<Map<string, object>>} `usr_…` → the public buyer summary
   */
  getBuyerSummaries: (buyerUserIds = []) => loadBuyers(buyerUserIds),

  /**
   * **One brief as the board shows it** (§4.3) — the brief itself, the business
   * that posted it, and the one figure that says whether they finish what they
   * start.
   *
   * Deliberately readable by anyone: a signed-out visitor sees the same brief a
   * creator does, and only the *actions* beside it are gated (§4.3). Nothing
   * private crosses this boundary — see `loadBuyers`.
   *
   * MOCK-JOIN: up to four requests (brief, then account + profile + completed
   * order count). Laravel: `GET /contentRequests/:id?include=buyer`, with the
   * count served from a counter cache.
   *
   * @param {string} id `req_…`
   * @returns {Promise<{request: object, buyer: object|null}>} `buyer` is `null`
   *   when the business could not be read — the brief still renders
   * @throws {ApiError} `not_found` when there is no such brief
   */
  async getBoardRequest(id) {
    const request = await contentRequests.getById(id)

    let buyer = null
    try {
      const [buyers, completedOrders] = await Promise.all([
        loadBuyers([request.buyerId]),
        orderService.countCompletedForBuyer(request.buyerId),
      ])
      const summary = buyers.get(request.buyerId)
      if (summary) buyer = { ...summary, completedOrders }
    } catch {
      // The brief is what the creator came for.
    }

    return { request, buyer }
  },

  /**
   * **Publishes a saved draft** from the request list (§4.1).
   *
   * The wizard's own publish path is `createRequest`, which shapes a record out
   * of form values. This one publishes a record that already exists and was
   * never finished — so completeness is checked here, against the row, and the
   * gaps come back named so the buyer is told *what* to go and fill in rather
   * than just "invalid".
   *
   * @param {string} id `req_…`
   * @param {object} [options]
   * @param {string} [options.buyerId] the acting buyer — rejected unless they own it
   * @returns {Promise<object>} the published brief, `status: 'open'`
   * @throws {ApiError} `validation_failed` with `details.missing` (labels) when
   *   the draft is incomplete · `conflict` when it is no longer a draft ·
   *   `forbidden` · `not_found`
   *
   * **Future endpoint:** `POST /contentRequests/:id/publish` → `{ request }`.
   */
  async publishDraft(id, { buyerId } = {}) {
    const request = await loadOwnedRequest(id, buyerId)

    const status = transitionTo(
      request.status,
      REQUEST_STATUS.OPEN,
      'This request can no longer be published. Reload the page to see where it got to.'
    )

    const missing = missingPublishFields(request)
    if (missing.length > 0) {
      throw createApiError(
        API_ERROR_CODE.VALIDATION_FAILED,
        'This draft is not finished yet, so creators cannot see it.',
        { missing }
      )
    }

    return contentRequests.update(id, { status, publishedAt: new Date().toISOString() })
  },

  /**
   * **Closes a live brief** without awarding it (§4.1).
   *
   * The buyer no longer needs the work, or none of the offers fit. Every offer
   * still waiting is declined and its creator told, because a creator holding
   * capacity for a brief that is over should not have to guess.
   *
   * `closedAt` and `closureReason` are written here and are **absent** on every
   * seeded brief — a Prompt 18 addition, documented in `docs/data-model.md` §5.
   *
   * @param {string} id `req_…`
   * @param {object} [options]
   * @param {string} [options.buyerId] the acting buyer — rejected unless they own it
   * @param {string} [options.reason] optional, passed on to the proposers
   * @returns {Promise<{request: object, declinedProposals: number}>}
   * @throws {ApiError} `conflict` when the brief is not open · `forbidden` · `not_found`
   *
   * **Future endpoint:** `POST /contentRequests/:id/close` → `{ request }`, with
   * the fold over the offers done in one transaction.
   */
  async closeRequest(id, { buyerId, reason } = {}) {
    const request = await loadOwnedRequest(id, buyerId)

    const status = transitionTo(
      request.status,
      REQUEST_STATUS.CLOSED,
      'This request is no longer open, so it cannot be closed.'
    )

    const declinedProposals = await endLiveProposals(request, { reason, closing: true })

    const closed = await contentRequests.update(id, {
      status,
      closedAt: new Date().toISOString(),
      closureReason: reason ?? null,
    })

    return { request: closed, declinedProposals }
  },

  /**
   * **Cancels a brief** (§4.1) — a draft the buyer is done with, or a live brief
   * the business has pulled.
   *
   * Deliberately **not** available on an awarded brief: an award has an order
   * and an escrowed payment behind it, and unpicking those is
   * `orderService.cancelOrder`'s job (Prompt 17), not a list-page menu item.
   * `REQUEST_STATUS_MACHINE` allows `awarded → cancelled` because that is the
   * edge Prompt 17 travels once the order is gone; this entry point refuses it
   * so the two can never disagree about which came first.
   *
   * @param {string} id `req_…`
   * @param {object} [options]
   * @param {string} [options.buyerId] the acting buyer — rejected unless they own it
   * @param {string} [options.reason] required by the UI, passed on to the proposers
   * @returns {Promise<{request: object, declinedProposals: number}>}
   * @throws {ApiError} `conflict` when the brief is awarded or already finished ·
   *   `forbidden` · `not_found`
   *
   * **Future endpoint:** `POST /contentRequests/:id/cancel` → `{ request }`.
   */
  async cancelRequest(id, { buyerId, reason } = {}) {
    const request = await loadOwnedRequest(id, buyerId)

    if (request.status === REQUEST_STATUS.AWARDED) {
      throw createApiError(
        API_ERROR_CODE.CONFLICT,
        'This request has been awarded, so it can only be ended by cancelling the order it created.',
        { from: request.status, to: REQUEST_STATUS.CANCELLED },
        409
      )
    }

    const status = transitionTo(
      request.status,
      REQUEST_STATUS.CANCELLED,
      'This request can no longer be cancelled.'
    )

    const declinedProposals =
      request.status === REQUEST_STATUS.OPEN
        ? await endLiveProposals(request, { reason, closing: false })
        : 0

    const cancelled = await contentRequests.update(id, {
      status,
      cancelledAt: new Date().toISOString(),
      closureReason: reason ?? null,
    })

    return { request: cancelled, declinedProposals }
  },

  /* ------------------------------------------------------------------------ */
  /* Admin console (Prompt 31)                                                */
  /* ------------------------------------------------------------------------ */

  /**
   * **The platform-wide request board** — every brief, whoever posted it, with
   * the business behind it resolved (Prompt 31 §4.1).
   *
   * The buyer's own list is `listForBuyer` and the public board is `listBoard`;
   * this is the third view, and it is the only one with no status floor: an
   * admin looking for a brief that was cancelled last week needs to be able to
   * find it. `listBoard`'s buyer join is reused rather than rewritten, so
   * "public information only" stays one decision.
   *
   * @param {object} [params]
   * @param {number} [params.page=1]
   * @param {number} [params.limit=20]
   * @param {string} [params.sort='createdAt'] `createdAt` | `publishedAt` |
   *   `deadline` | `budgetMax` | `proposalsCount`
   * @param {'asc'|'desc'} [params.order='desc']
   * @param {string} [params.search] matches the title and description
   * @param {string|string[]} [params.status] one or several `REQUEST_STATUS` values
   * @param {string|string[]} [params.categoryId] `cat_…`
   * @param {string} [params.createdFrom] ISO lower bound on `createdAt`
   * @param {string} [params.createdTo] ISO upper bound on `createdAt`
   * @returns {Promise<import('./api/listAdapter').ListResult>} briefs, each with
   *   `buyer` (`null` when the join failed — the row still renders)
   *
   * **Future endpoint:** `GET /admin/contentRequests?…&include=buyer`.
   */
  async adminListRequests({
    page = 1,
    limit = 20,
    sort = 'createdAt',
    order = SORT_ORDER.DESC,
    search,
    status,
    categoryId,
    createdFrom,
    createdTo,
  } = {}) {
    const filters = {}
    if (status) filters.status = status
    if (categoryId) filters.categoryId = categoryId
    if (createdFrom) filters.createdAt_gte = createdFrom
    if (createdTo) filters.createdAt_lte = createdTo

    const result = await contentRequests.list({ page, limit, sort, order, search, filters })
    if (result.items.length === 0) return result

    let buyers = new Map()
    try {
      buyers = await loadBuyers(result.items.map((request) => request.buyerId))
    } catch {
      // The briefs are the payload; the trading name is the garnish.
    }

    return {
      ...result,
      items: result.items.map((request) => ({
        ...request,
        buyer: buyers.get(request.buyerId) ?? null,
      })),
    }
  },

  /**
   * **Closes a live brief administratively** (Prompt 31 §4.1) — a policy or
   * housekeeping closure by BetterBlue rather than by the business that posted
   * it.
   *
   * Deliberately a sibling of {@link closeRequest} rather than a flag on it:
   * the cascade is the same, but *who did it* changes the copy every proposer
   * reads, adds a notification the buyer would otherwise not get, and adds an
   * audit entry — and none of those belong behind an `if (isAdmin)` inside a
   * buyer-facing function.
   *
   * **`open` only, and there is no reopen.** `REQUEST_STATUS_MACHINE` makes
   * `closed` terminal (00 §9), so the console offers no "reopen": a business
   * that still wants the work posts the brief again, which is also the honest
   * record — the creators who proposed the first time were told it was over.
   *
   * @param {string} id `req_…`
   * @param {object} options
   * @param {string} options.reason required — read by the buyer and by every
   *   proposer, and recorded on the brief and in the trail
   * @param {{id: string, role: string}} [options.actor] the acting admin
   * @returns {Promise<{request: object, declinedProposals: number}>}
   * @throws {ApiError} `validation_failed` without a reason · `conflict` when
   *   the brief is not open · `not_found`
   *
   * **Future endpoint:** `POST /admin/contentRequests/:id/close` → `{ request }`.
   */
  async adminCloseRequest(id, { reason, actor } = {}) {
    const trimmedReason = text(reason)
    if (!trimmedReason) {
      throw createApiError(
        API_ERROR_CODE.VALIDATION_FAILED,
        'An administrative closure needs a reason.',
        { reason: 'Say why this request is being closed.' }
      )
    }

    const request = await contentRequests.getById(id)
    const status = transitionTo(
      request.status,
      REQUEST_STATUS.CLOSED,
      'This request is no longer open, so it cannot be closed.'
    )

    const declinedProposals = await endLiveProposals(request, {
      reason: trimmedReason,
      closing: true,
      byAdmin: true,
    })

    const closed = await contentRequests.update(id, {
      status,
      closedAt: new Date().toISOString(),
      closureReason: trimmedReason,
    })

    // The buyer hears about their own brief being taken down. This is the one
    // party `closeRequest` never notifies, because there they are the one who
    // clicked; here they are not.
    try {
      await notificationService.notify({
        userId: request.buyerId,
        type: NOTIFICATION_TYPE.REQUEST_CLOSED,
        title: 'Your request was closed by BetterBlue',
        body:
          `“${request.title}” has been closed and is no longer visible to creators. ` +
          `Reason: ${trimmedReason}`,
        entityType: 'request',
        entityId: request.id,
      })
    } catch {
      // A brief that is already closed must not be un-closed by a bell item.
    }

    if (actor?.id) {
      try {
        await auditService.log({
          actorId: actor.id,
          actorRole: actor.role,
          action: AUDIT_ACTION.REQUEST_CLOSE,
          entityType: 'request',
          entityId: request.id,
          meta: {
            fromStatus: request.status,
            reason: trimmedReason,
            declinedProposals,
            buyerId: request.buyerId,
          },
        })
      } catch {
        // As above — an unwritten trail entry must not undo a closure.
      }
    }

    return { request: closed, declinedProposals }
  },
})

export default requestService
