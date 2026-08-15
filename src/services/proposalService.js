// Creator offers on a brief — `docs/api-contract.md` §6.8.
//
// Proposals are never public: only the buyer who posted the brief and the
// creator who sent the offer may read one. `creatorId` points at `users.id`.

import { NOTIFICATION_TYPE } from '@/constants/notificationTypes'
import { PROPOSAL_STATUS_MACHINE } from '@/constants/stateMachines'
import { PROPOSAL_STATUS } from '@/constants/statuses'
import { ID_PREFIX } from '@/utils/id'
import { assertTransition } from '@/utils/stateMachine'

import { API_ERROR_CODE, createApiError } from './api/apiError'
import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'
import { creatorProfileService } from './creatorProfileService'
import { notificationService } from './notificationService'
import { portfolioService } from './portfolioService'
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

  // —— workflow operations (added by later prompts) ——
  // submitProposal / withdrawProposal — Prompt 23 (creator proposal flow).
  // `submitProposal` also bumps the brief's `proposalsCount` and notifies the
  // buyer. **Accepting** is `orderService.acceptProposal` (contract §7).
})

/** Proposal statuses a buyer has not decided on yet — re-exported for features. */
export { UNDECIDED_STATUSES as UNDECIDED_PROPOSAL_STATUSES }

export default proposalService
