// Creator offers on a brief — `docs/api-contract.md` §6.8.
//
// Proposals are never public: only the buyer who posted the brief and the
// creator who sent the offer may read one. `creatorId` points at `users.id`.
//
// CYCLE: this module and `requestService` import each other — a brief's
// closure declines its offers, and submitting an offer bumps the brief's
// `proposalsCount`. Both directions are used **only inside function bodies**,
// never at module scope, so ES module live bindings resolve either evaluation
// order. Keep it that way: a top-level `requestService.…` here would read
// `undefined` when this module happens to be evaluated first.

import { appConfig } from '@/config/appConfig'
import { NOTIFICATION_TYPE } from '@/constants/notificationTypes'
import { PROPOSAL_STATUS_MACHINE } from '@/constants/stateMachines'
import { ACCOUNT_STATUS, PROPOSAL_STATUS, REQUEST_STATUS } from '@/constants/statuses'
import { ID_PREFIX } from '@/utils/id'
import { toAmount } from '@/utils/money'
import { assertTransition } from '@/utils/stateMachine'

import { API_ERROR_CODE, createApiError } from './api/apiError'
import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'
import { buyerProfileService } from './buyerProfileService'
import { creatorProfileService } from './creatorProfileService'
import { notificationService } from './notificationService'
import { portfolioService } from './portfolioService'
import { requestService } from './requestService'
import { userService } from './userService'

const proposals = createCrudService('proposals', { idPrefix: ID_PREFIX.PROPOSAL })

/** Newest offer first (contract §6.8). */
const DEFAULT_SORT = 'createdAt'

/**
 * Provider page ceiling (contract §4.1). A brief collects a handful of offers,
 * never a hundred, so one page is the whole set — which is what lets the
 * buyer's board sort by creator rating without a second round trip.
 */
const REVIEW_LIMIT = 100

/** Offers the buyer has not decided on — the ones a decision may still move. */
const UNDECIDED_STATUSES = Object.freeze([
  PROPOSAL_STATUS.SUBMITTED,
  PROPOSAL_STATUS.SHORTLISTED,
])

const nowIso = () => new Date().toISOString()

/** `conflict` is the contract's code for "not in the right state" (§3.2). */
function transitionTo(from, to, message) {
  try {
    return assertTransition(PROPOSAL_STATUS_MACHINE, from, to)
  } catch (failure) {
    throw createApiError(
      API_ERROR_CODE.CONFLICT,
      message,
      { from, to, transition: failure.message },
      409
    )
  }
}

/** A bell item must never fail a decision that has already been written. */
async function notifyQuietly(notification) {
  try {
    return await notificationService.notify(notification)
  } catch {
    return null
  }
}

/**
 * The creator summary a proposal card renders: the account (name, avatar) and
 * the storefront (rating, completed orders, response time) in one object.
 *
 * MOCK-JOIN: `_embed`/`_expand` are banned (00 §10), so the two collections are
 * fetched by id in one request each and stitched here. Laravel serialises the
 * same object from `GET /proposals?requestId=…&include=creator`.
 */
async function loadCreators(creatorUserIds) {
  const ids = [...new Set(creatorUserIds.filter(Boolean))]
  if (ids.length === 0) return new Map()

  const [accounts, storefronts] = await Promise.all([
    userService.listByIds(ids),
    creatorProfileService.list({ page: 1, limit: REVIEW_LIMIT, filters: { userId: ids } }),
  ])

  const profileByUserId = new Map(
    storefronts.items.map((profile) => [profile.userId, profile])
  )

  return new Map(
    accounts.map((account) => {
      const profile = profileByUserId.get(account.id)
      return [
        account.id,
        {
          userId: account.id,
          name: account.name,
          avatarUrl: account.avatarUrl,
          // `null` when the account has no storefront yet — the card falls back
          // to the account alone rather than linking nowhere.
          profileId: profile?.id ?? null,
          tagline: profile?.tagline ?? null,
          location: profile?.location ?? null,
          ratingAvg: profile?.ratingAvg ?? null,
          ratingCount: profile?.ratingCount ?? 0,
          completedOrders: profile?.completedOrders ?? 0,
          responseTimeHours: profile?.responseTimeHours ?? null,
          verified: Boolean(profile?.verified),
        },
      ]
    })
  )
}

/** Every sample item referenced by a page of offers, in one request. */
async function loadSamples(sampleItemIds) {
  const ids = [...new Set(sampleItemIds.filter(Boolean))]
  if (ids.length === 0) return new Map()

  const { items } = await portfolioService.list({
    page: 1,
    limit: REVIEW_LIMIT,
    filters: { id: ids },
  })
  return new Map(items.map((item) => [item.id, item]))
}

/* -------------------------------------------------------------------------- */
/* Submission rules                                                           */
/* -------------------------------------------------------------------------- */

// The offer's field rules live here rather than in the dialog, so the form, the
// service, and (eventually) the Laravel validator all quote one set of numbers
// (00 §16.9 — no business logic in presentation components).

/** Cover message bounds, in characters (Prompt 23 §13). */
export const COVER_MESSAGE_LENGTH = Object.freeze({ min: 60, max: 1200 })

/** How many published samples one offer may carry. */
export const MAX_SAMPLE_ITEMS = 3

/** Delivery windows a creator may promise, in days. */
export const DELIVERY_DAY_OPTIONS = Object.freeze([3, 5, 7, 10, 14, 21])

/** Revision rounds an offer may include. */
export const REVISION_OPTIONS = Object.freeze([1, 2, 3])

/** `validation_failed` with the contract's per-field `details` shape (§3.3). */
function invalidField(field, message) {
  return createApiError(API_ERROR_CODE.VALIDATION_FAILED, message, { [field]: message }, 422)
}

/**
 * Every field rule an offer has to satisfy, applied to the values the dialog
 * collected. Returns the record body; throws `validation_failed` naming the
 * first field that fails.
 */
function toProposalRecord({
  requestId,
  creatorId,
  coverMessage,
  price,
  deliveryDays,
  revisionsIncluded,
  sampleItemIds,
  currency,
}) {
  const message = String(coverMessage ?? '').trim()
  if (message.length < COVER_MESSAGE_LENGTH.min) {
    throw invalidField(
      'coverMessage',
      `Say a little more about how you would approach this — at least ${COVER_MESSAGE_LENGTH.min} characters.`
    )
  }

  const amount = toAmount(price)
  if (amount === null || amount <= 0) {
    throw invalidField('price', 'Enter the price you would charge for this brief.')
  }

  const days = Number(deliveryDays)
  if (!DELIVERY_DAY_OPTIONS.includes(days)) {
    throw invalidField('deliveryDays', 'Choose how long delivery would take.')
  }

  const revisions = Number(revisionsIncluded)
  if (!REVISION_OPTIONS.includes(revisions)) {
    throw invalidField('revisionsIncluded', 'Choose how many revision rounds are included.')
  }

  const samples = [...new Set((sampleItemIds ?? []).filter(Boolean))]
  if (samples.length > MAX_SAMPLE_ITEMS) {
    throw invalidField('sampleItemIds', `Pick up to ${MAX_SAMPLE_ITEMS} samples.`)
  }

  return {
    requestId,
    creatorId,
    coverMessage: message.slice(0, COVER_MESSAGE_LENGTH.max),
    price: amount,
    currency: currency ?? appConfig.defaultCurrency,
    deliveryDays: days,
    revisionsIncluded: revisions,
    sampleItemIds: samples,
  }
}

/** Refuses a brief that is no longer taking offers. */
function assertRequestOpen(request) {
  if (request?.status === REQUEST_STATUS.OPEN) return request

  throw createApiError(
    API_ERROR_CODE.CONFLICT,
    'This request is no longer open for proposals. Reload the board to see what is still live.',
    { status: request?.status ?? null },
    409
  )
}

/**
 * Refuses a creator who may not send an offer at all: a suspended or
 * blacklisted account, or one that has switched off "accepting new requests".
 *
 * SECURITY: a UX guard (00 §11). Laravel must re-check both against the bearer
 * token's own account rather than the `creatorId` in the body (§9.2).
 */
async function assertCreatorMayPropose(creatorUserId) {
  if (!creatorUserId) {
    throw createApiError(API_ERROR_CODE.UNAUTHORIZED, 'Sign in as a creator to propose.')
  }

  const [account, profile] = await Promise.all([
    userService.getById(creatorUserId),
    creatorProfileService.getByUserId(creatorUserId),
  ])

  if (account?.accountStatus !== ACCOUNT_STATUS.ACTIVE) {
    throw createApiError(
      API_ERROR_CODE.FORBIDDEN,
      'Your account cannot send proposals at the moment. Contact support if you think this is wrong.',
      { accountStatus: account?.accountStatus ?? null }
    )
  }

  // `availability !== false` rather than `=== true`: a storefront created
  // before the flag existed has no value and is treated as available, exactly
  // as `useCreatorAvailability` reads it.
  if (profile && profile.availability === false) {
    throw createApiError(
      API_ERROR_CODE.CONFLICT,
      'You are not accepting new requests, so proposals are paused. Turn availability back on to send this one.',
      { availability: false },
      409
    )
  }

  return profile
}

/**
 * Bumps the brief's offer counter.
 *
 * MOCK-DERIVED: `proposalsCount` is a stored column that only this function and
 * the seed ever write, so keeping it truthful takes a read and a write from the
 * browser — and two creators submitting at the same moment can lose a count.
 * Laravel makes it a counter cache maintained by the same transaction that
 * inserts the proposal (or a plain `COUNT(*)` on read). A failure here is
 * swallowed: a card that says "3 proposals" when there are four is a cosmetic
 * problem, and undoing a proposal that was accepted is not.
 */
async function bumpProposalsCount(request) {
  try {
    await requestService.update(request.id, {
      proposalsCount: (Number(request.proposalsCount) || 0) + 1,
    })
  } catch {
    // See above.
  }
}

/** Loads an offer and refuses it unless `creatorId` sent it. */
async function loadOwnProposal(id, creatorId) {
  const proposal = await proposals.getById(id)
  if (creatorId && proposal.creatorId !== creatorId) {
    throw createApiError(API_ERROR_CODE.FORBIDDEN, 'This proposal belongs to another account.')
  }
  return proposal
}

export const proposalService = Object.freeze({
  /**
   * @param {import('./api/listAdapter').ListParams} [params] filters:
   *   `requestId`, `creatorId`, `status`, `price_gte`/`price_lte`;
   *   sorts: `createdAt`, `price`, `deliveryDays`
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  list: (params = {}) => proposals.list({ sort: DEFAULT_SORT, order: SORT_ORDER.DESC, ...params }),

  /**
   * @param {string} id `prp_…`
   * @returns {Promise<object>} the offer
   * @throws {ApiError} `not_found`
   */
  getById: (id) => proposals.getById(id),

  /**
   * Every offer on one brief — the buyer's comparison view.
   *
   * @param {string} requestId `req_…`
   * @param {import('./api/listAdapter').ListParams} [params] any filter above
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  listByRequest(requestId, params = {}) {
    return proposalService.list({
      ...params,
      filters: { ...params.filters, requestId },
    })
  },

  /**
   * "My proposals" — every offer a creator has sent.
   *
   * @param {string} creatorId `usr_…`
   * @param {import('./api/listAdapter').ListParams} [params] any filter above
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  listByCreator(creatorId, params = {}) {
    return proposalService.list({
      ...params,
      filters: { ...params.filters, creatorId },
    })
  },

  /**
   * Guards the "one proposal per creator per request" rule (contract §6.8)
   * before the submit form opens.
   *
   * MOCK-GUARD: this is a read-before-write check, so two submissions racing
   * each other can both pass it. Laravel makes it a
   * `UNIQUE (request_id, creator_id)` constraint.
   *
   * @param {string} requestId `req_…`
   * @param {string} creatorId `usr_…`
   * @returns {Promise<boolean>} `true` when an offer already exists
   */
  async hasCreatorProposed(requestId, creatorId) {
    if (!requestId || !creatorId) return false
    const { total } = await proposals.list({
      page: 1,
      limit: 1,
      filters: { requestId, creatorId },
    })
    return total > 0
  },

  /**
   * The offer this creator already sent on this brief, if any — what the board
   * needs to turn "Propose" into "Proposal submitted" *and* link to it
   * (Prompt 23 §4.3).
   *
   * The read-only companion to {@link hasCreatorProposed}: that one answers the
   * guard's yes/no question in one row, this one hands the screen the record.
   *
   * @param {string} requestId `req_…`
   * @param {string} creatorId `usr_…`
   * @returns {Promise<object|null>} the offer, or `null` when there is none
   */
  async getCreatorProposalFor(requestId, creatorId) {
    if (!requestId || !creatorId) return null
    const { items } = await proposals.list({
      page: 1,
      limit: 1,
      filters: { requestId, creatorId },
    })
    return items[0] ?? null
  },

  /**
   * Submits an offer. `sampleItemIds` must reference published portfolio items
   * belonging to the proposing creator.
   *
   * @param {object} payload the new offer
   * @returns {Promise<object>} the created offer
   */
  create: (payload) => proposals.create(payload),

  /**
   * Withdraws (creator), shortlists, or declines (buyer) an offer.
   * **Accepting is not a `PATCH`** — it creates an order, so it goes through
   * `orderService.acceptProposal` (contract §7).
   *
   * @param {string} id `prp_…`
   * @param {object} patch changed fields only
   * @returns {Promise<object>} the updated offer
   */
  update: (id, patch) => proposals.update(id, patch),

  /* —— workflow operations —————————————————————————————————————————————— */

  /**
   * **Every offer on one brief, ready to be compared** (Prompt 18).
   *
   * A brief's offers are a handful, and the buyer's board sorts them by price,
   * delivery, *and creator rating* — a column that lives on another collection.
   * So the whole set is fetched once and joined here, and the board sorts and
   * filters the result in memory rather than re-querying per control.
   *
   * MOCK-JOIN + MOCK-SORT: three requests (offers, then creators and samples in
   * parallel) instead of the one Laravel will serve from
   * `GET /proposals?requestId=…&include=creator,samples`, which will also sort
   * on the joined columns server-side. Bounded by {@link REVIEW_LIMIT}; a brief
   * that ever exceeds it needs the server-side version anyway.
   *
   * @param {string} requestId `req_…`
   * @returns {Promise<import('./api/listAdapter').ListResult>} offers, oldest
   *   first, each with `creator` (see `loadCreators`) and `samples`
   *   (`portfolioItems`, only the ones that still exist)
   */
  async listForRequestReview(requestId) {
    const result = await proposalService.listByRequest(requestId, {
      page: 1,
      limit: REVIEW_LIMIT,
      sort: DEFAULT_SORT,
      order: SORT_ORDER.ASC,
    })

    if (result.items.length === 0) return result

    const [creators, samples] = await Promise.all([
      loadCreators(result.items.map((proposal) => proposal.creatorId)),
      loadSamples(result.items.flatMap((proposal) => proposal.sampleItemIds ?? [])),
    ])

    return {
      ...result,
      items: result.items.map((proposal) => ({
        ...proposal,
        creator: creators.get(proposal.creatorId) ?? null,
        samples: (proposal.sampleItemIds ?? [])
          .map((id) => samples.get(id))
          .filter(Boolean),
      })),
    }
  },

  /**
   * **Stars or un-stars an offer** while the buyer compares (contract §6.8).
   *
   * Shortlisting is the one reversible decision on this screen, so it is a
   * toggle in both directions: `submitted → shortlisted` and back again. Going
   * back also clears `respondedAt`, because the data model reads that field as
   * "when the buyer decided" and an un-starred offer is undecided again.
   *
   * Only the creator being shortlisted is notified — un-starring is silent, as
   * telling someone they *stopped* being a favourite helps nobody.
   *
   * SECURITY: shortlisting is a buyer action; the frontend simply never offers
   * it elsewhere. Laravel must scope it to the brief's owner (00 §11).
   *
   * @param {string} id `prp_…`
   * @param {object} [options]
   * @param {boolean} [options.shortlisted=true] `false` returns it to `submitted`
   * @returns {Promise<object>} the updated offer
   * @throws {ApiError} `conflict` when the offer has already been decided
   *
   * **Future endpoint:** `POST /proposals/:id/shortlist` · `DELETE` to undo.
   */
  async shortlistProposal(id, { shortlisted = true } = {}) {
    const proposal = await proposals.getById(id)
    const target = shortlisted ? PROPOSAL_STATUS.SHORTLISTED : PROPOSAL_STATUS.SUBMITTED

    if (proposal.status === target) return proposal

    const updated = await proposals.update(id, {
      status: transitionTo(
        proposal.status,
        target,
        shortlisted
          ? 'This proposal can no longer be shortlisted.'
          : 'This proposal can no longer be moved back to undecided.'
      ),
      respondedAt: shortlisted ? nowIso() : null,
    })

    if (shortlisted) {
      await notifyQuietly({
        userId: proposal.creatorId,
        type: NOTIFICATION_TYPE.PROPOSAL_SHORTLISTED,
        title: 'Your proposal was shortlisted',
        body: 'The buyer has marked your proposal as a strong candidate while they compare. No action is needed from you yet.',
        entityType: 'request',
        entityId: proposal.requestId,
      })
    }

    return updated
  },

  /**
   * **Declines an offer** the buyer is not going to take (contract §6.8).
   *
   * Terminal and one-way: the creator is told, and there is no path back to
   * `submitted` in `PROPOSAL_STATUS_MACHINE`. The reason is optional and, when
   * given, is passed on verbatim — a declined creator learning *why* is the
   * whole reason the field exists.
   *
   * @param {string} id `prp_…`
   * @param {object} [options]
   * @param {string} [options.reason] shown to the creator in their notification
   * @returns {Promise<object>} the declined offer
   * @throws {ApiError} `conflict` when the offer has already been decided
   *
   * **Future endpoint:** `POST /proposals/:id/decline` → `{ proposal }`.
   */
  async declineProposal(id, { reason } = {}) {
    const proposal = await proposals.getById(id)

    const declined = await proposals.update(id, {
      status: transitionTo(
        proposal.status,
        PROPOSAL_STATUS.DECLINED,
        'This proposal can no longer be declined.'
      ),
      respondedAt: nowIso(),
    })

    await notifyQuietly({
      userId: proposal.creatorId,
      type: NOTIFICATION_TYPE.PROPOSAL_DECLINED,
      title: 'Proposal not selected',
      body:
        'The buyer has decided not to go ahead with your proposal on this request.' +
        (reason ? ` They said: “${reason}”` : ' Thanks for taking the time to propose.'),
      entityType: 'request',
      entityId: proposal.requestId,
    })

    return declined
  },

  /**
   * Every offer on a brief that the buyer still has to decide on.
   *
   * @param {string} requestId `req_…`
   * @returns {Promise<object[]>} `submitted` and `shortlisted` offers
   */
  async listUndecided(requestId) {
    const { items } = await proposalService.listByRequest(requestId, {
      page: 1,
      limit: REVIEW_LIMIT,
      filters: { status: [...UNDECIDED_STATUSES] },
    })
    return items
  },

  /**
   * **Sends an offer on a brief** (Prompt 23 §4.4, contract §7 operation 20).
   *
   * One intention, three records: the offer is written, the brief's counter
   * moves, and the buyer is told. The guards run **before** anything is
   * written, in the order that fails cheapest first — a closed brief and a
   * duplicate are both far more likely than a suspended account.
   *
   * MOCK-GUARD: the duplicate check is a read-before-write, so two submissions
   * racing each other can both pass it (see `hasCreatorProposed`). Laravel makes
   * it `UNIQUE (request_id, creator_id)`.
   *
   * @param {object} input the dialog's values
   * @param {string} input.requestId `req_…`
   * @param {string} input.creatorId `usr_…` — the signed-in creator
   * @param {string} input.coverMessage 60–1200 characters
   * @param {number|string} input.price the creator's quote, > 0
   * @param {number} input.deliveryDays one of {@link DELIVERY_DAY_OPTIONS}
   * @param {number} input.revisionsIncluded one of {@link REVISION_OPTIONS}
   * @param {string[]} [input.sampleItemIds] up to {@link MAX_SAMPLE_ITEMS}
   *   published `pfi_…` items belonging to this creator
   * @returns {Promise<object>} the created `submitted` offer
   * @throws {ApiError} `validation_failed` (422) naming the field · `conflict`
   *   (409) when the brief is not open, a proposal already exists, or
   *   availability is off · `forbidden` when the account is not active
   *
   * **Future endpoint:** `POST /proposals` → `201` with the offer. The server
   * reads `creatorId` from the bearer token (§9.2), maintains `proposalsCount`
   * in the same transaction, and dispatches the notification from a listener.
   */
  async submitProposal(input) {
    const request = await requestService.getById(input.requestId)
    assertRequestOpen(request)

    if (await proposalService.hasCreatorProposed(request.id, input.creatorId)) {
      throw createApiError(
        API_ERROR_CODE.CONFLICT,
        'You have already sent a proposal on this request.',
        { requestId: request.id },
        409
      )
    }

    await assertCreatorMayPropose(input.creatorId)

    const record = toProposalRecord({ ...input, currency: request.currency })

    const proposal = await proposals.create({
      ...record,
      status: PROPOSAL_STATUS.SUBMITTED,
      respondedAt: null,
    })

    await bumpProposalsCount(request)

    await notifyQuietly({
      userId: request.buyerId,
      type: NOTIFICATION_TYPE.PROPOSAL_RECEIVED,
      title: 'New proposal received',
      body: `A creator has sent a proposal on “${request.title}”. Compare it against the others whenever you are ready.`,
      entityType: 'request',
      entityId: request.id,
    })

    return proposal
  },

  /**
   * **Edits an offer the buyer has not acted on yet** (§4.6).
   *
   * Only a `submitted` offer may change. Once it is shortlisted the buyer is
   * comparing against the numbers they were shown, and once it is decided there
   * is nothing left to edit — so both are refused here rather than only hidden
   * in the UI. Editing does **not** re-notify: the buyer already has the brief
   * on their board and a bell item per price tweak is noise.
   *
   * @param {string} id `prp_…`
   * @param {object} patch `coverMessage` · `price` · `deliveryDays` ·
   *   `revisionsIncluded` · `sampleItemIds` — same rules as submission
   * @param {object} [options]
   * @param {string} [options.creatorId] the acting creator — rejected unless they sent it
   * @returns {Promise<object>} the updated offer
   * @throws {ApiError} `validation_failed` · `conflict` (already decided) ·
   *   `forbidden` · `not_found`
   *
   * **Future endpoint:** `PATCH /proposals/:id`, scoped to the owning creator.
   */
  async editProposal(id, patch, { creatorId } = {}) {
    const proposal = await loadOwnProposal(id, creatorId)

    if (proposal.status !== PROPOSAL_STATUS.SUBMITTED) {
      throw createApiError(
        API_ERROR_CODE.CONFLICT,
        'This proposal can no longer be edited — the buyer has already responded to it.',
        { status: proposal.status },
        409
      )
    }

    const record = toProposalRecord({
      requestId: proposal.requestId,
      creatorId: proposal.creatorId,
      currency: proposal.currency,
      coverMessage: patch.coverMessage ?? proposal.coverMessage,
      price: patch.price ?? proposal.price,
      deliveryDays: patch.deliveryDays ?? proposal.deliveryDays,
      revisionsIncluded: patch.revisionsIncluded ?? proposal.revisionsIncluded,
      sampleItemIds: patch.sampleItemIds ?? proposal.sampleItemIds,
    })

    // `requestId` and `creatorId` are re-derived above only so the rules can
    // run against a whole record; neither is ever rewritten.
    const { requestId, creatorId: owner, ...changes } = record
    void requestId
    void owner

    return proposals.update(id, changes)
  },

  /**
   * **Withdraws an offer** (§4.6) — the creator is no longer available, or has
   * thought better of the price.
   *
   * Terminal, and **final for that brief**: `PROPOSAL_STATUS_MACHINE` has no
   * path back from `withdrawn`, and the one-proposal-per-creator-per-request
   * rule (contract §6.8, `UNIQUE (request_id, creator_id)` under Laravel) counts
   * the withdrawn row — so a creator cannot answer the same brief twice. The
   * confirm dialog says so before the button is pressed.
   *
   * The buyer is told, because an offer disappearing from their board without
   * explanation is worse than one that says why.
   *
   * `proposalsCount` is deliberately **not** decremented: the brief did receive
   * that many proposals, and the buyer's board reads live statuses rather than
   * the counter.
   *
   * @param {string} id `prp_…`
   * @param {object} [options]
   * @param {string} [options.creatorId] the acting creator — rejected unless they sent it
   * @returns {Promise<object>} the withdrawn offer
   * @throws {ApiError} `conflict` when the buyer has already decided ·
   *   `forbidden` · `not_found`
   *
   * **Future endpoint:** `POST /proposals/:id/withdraw` → `{ proposal }`.
   */
  async withdrawProposal(id, { creatorId } = {}) {
    const proposal = await loadOwnProposal(id, creatorId)

    const withdrawn = await proposals.update(id, {
      status: transitionTo(
        proposal.status,
        PROPOSAL_STATUS.WITHDRAWN,
        'This proposal can no longer be withdrawn — the buyer has already responded to it.'
      ),
      respondedAt: nowIso(),
    })

    // Best effort, and one extra read: the buyer's notification is worth naming
    // the brief, and the offer only carries its id.
    try {
      const request = await requestService.getById(proposal.requestId)
      await notifyQuietly({
        userId: request.buyerId,
        type: NOTIFICATION_TYPE.PROPOSAL_DECLINED,
        title: 'A proposal was withdrawn',
        body: `A creator has withdrawn their proposal on “${request.title}”. The rest of your proposals are unaffected.`,
        entityType: 'request',
        entityId: proposal.requestId,
      })
    } catch {
      // A bell item must never undo a withdrawal that already happened.
    }

    return withdrawn
  },

  /**
   * **"My proposals"**, each joined to the brief it answers and the business
   * behind it (§4.6).
   *
   * MOCK-JOIN: three requests — the offers, then the briefs by id and the
   * business profiles for whoever posted them, in parallel. `_embed`/`_expand`
   * are banned (00 §10) and a proposal card is unreadable without the brief's
   * title, so the join happens here. Laravel:
   * `GET /proposals?creatorId=…&include=request.buyer`.
   *
   * A failed join is **not** a failed list: the offers render with `request` and
   * `buyer` as `null` and the card falls back to what it has.
   *
   * @param {string} creatorId `usr_…`
   * @param {import('./api/listAdapter').ListParams} [params] page, sort, and any
   *   filter `list` accepts — `status` is the tab
   * @returns {Promise<import('./api/listAdapter').ListResult>} offers, each with
   *   `request` (the brief) and `buyer` (`{ userId, name, companyName, logoUrl }`)
   */
  async listForCreator(creatorId, params = {}) {
    const result = await proposalService.listByCreator(creatorId, params)
    if (result.items.length === 0) return result

    let requestById = new Map()
    let buyerByUserId = new Map()

    try {
      const requestIds = [...new Set(result.items.map((proposal) => proposal.requestId))]
      const { items: requests } = await requestService.list({
        page: 1,
        limit: REVIEW_LIMIT,
        filters: { id: requestIds },
      })
      requestById = new Map(requests.map((request) => [request.id, request]))

      const buyerIds = [...new Set(requests.map((request) => request.buyerId).filter(Boolean))]
      if (buyerIds.length > 0) {
        const [accounts, businesses] = await Promise.all([
          userService.listByIds(buyerIds),
          buyerProfileService.list({
            page: 1,
            limit: REVIEW_LIMIT,
            filters: { userId: buyerIds },
          }),
        ])
        const businessByUserId = new Map(
          businesses.items.map((business) => [business.userId, business])
        )
        buyerByUserId = new Map(
          accounts.map((account) => [
            account.id,
            {
              userId: account.id,
              name: account.name,
              companyName: businessByUserId.get(account.id)?.companyName ?? null,
              logoUrl: businessByUserId.get(account.id)?.logoUrl ?? null,
            },
          ])
        )
      }
    } catch {
      // See above — the offers are the payload, the brief is the garnish.
    }

    return {
      ...result,
      items: result.items.map((proposal) => {
        const request = requestById.get(proposal.requestId) ?? null
        return {
          ...proposal,
          request,
          buyer: request ? (buyerByUserId.get(request.buyerId) ?? null) : null,
        }
      }),
    }
  },

  /**
   * How many offers a creator has in each status — the tab counts (§4.6) and
   * the nav badge.
   *
   * MOCK-AGGREGATE: one page of up to {@link REVIEW_LIMIT} offers, folded here,
   * instead of `SELECT status, COUNT(*) … GROUP BY status`. `total` stays exact
   * either way, and `capped` says whether the counts are.
   *
   * @param {string} creatorId `usr_…`
   * @returns {Promise<{total: number, capped: boolean, byStatus: Object<string, number>}>}
   *   `byStatus` carries an entry for **every** `PROPOSAL_STATUS`, zero included
   */
  async countsByStatus(creatorId) {
    const byStatus = Object.fromEntries(
      Object.values(PROPOSAL_STATUS).map((status) => [status, 0])
    )

    if (!creatorId) return { total: 0, capped: false, byStatus }

    const { items, total } = await proposalService.listByCreator(creatorId, {
      page: 1,
      limit: REVIEW_LIMIT,
    })

    items.forEach((proposal) => {
      if (byStatus[proposal.status] !== undefined) byStatus[proposal.status] += 1
    })

    return { total, capped: total > items.length, byStatus }
  },

  /**
   * The nav badge: offers a buyer has starred and not yet decided on — the one
   * proposal state where something good is happening and the creator should
   * look (§4.7).
   *
   * @param {string} creatorId `usr_…`
   * @returns {Promise<number>} `0` when nothing is shortlisted
   */
  async countShortlisted(creatorId) {
    if (!creatorId) return 0
    const { total } = await proposals.list({
      page: 1,
      limit: 1,
      filters: { creatorId, status: PROPOSAL_STATUS.SHORTLISTED },
    })
    return total
  },
})

/** Proposal statuses a buyer has not decided on yet — re-exported for features. */
export { UNDECIDED_STATUSES as UNDECIDED_PROPOSAL_STATUSES }

export default proposalService
