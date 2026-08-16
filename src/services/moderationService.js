// The Trust & Safety review queue — `docs/api-contract.md` §6.20.
//
// One record per piece of content in the review pipeline. `creatorId` points at
// `users.id`; `subjectId` at a `portfolioItems` or `deliveries` record.
//
// Prompt 22 wrote the creator's half of the lifecycle (`portfolioService
// .submitForReview` opens the case). Prompt 30 adds the reviewer's half:
// {@link moderationService.claimForReview} and {@link moderationService.decide},
// which is the **only** place a decision propagates to the content it is about
// (contract §7, operations 26 and 27).
//
// CYCLE: `portfolioService` and `deliveryService` import this module to open a
// case, and this module reads their collections back through local CRUD handles
// rather than importing them — a mutual import for two reads would be a cycle
// for nothing (the same call `portfolioService` makes for `creatorProfiles`).
// The two genuine imports below are the cross-cutting emits every workflow makes
// (00 §10); they dereference inside function bodies only.

import { AUDIT_ACTION } from '@/constants/auditActions'
import { NOTIFICATION_ENTITY, NOTIFICATION_TYPE } from '@/constants/notificationTypes'
import { getRejectionReason } from '@/constants/policy'
import { ROLES } from '@/constants/roles'
import { CONTENT_STATUS_MACHINE } from '@/constants/stateMachines'
import { CONTENT_STATUS, MODERATION_SUBJECT } from '@/constants/statuses'
import { ID_PREFIX } from '@/utils/id'
import { assertTransition } from '@/utils/stateMachine'

import { API_ERROR_CODE, createApiError } from './api/apiError'
import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'
import { auditService } from './auditService'
import { notificationService } from './notificationService'
// CYCLE: `reportService.actionReport` opens a case through this module, and the
// tab counts here read its queue — the two halves of one console. Both
// dereference inside function bodies only, like `orderService`/`deliveryService`.
import { reportService } from './reportService'
import { settingsService } from './settingsService'

const moderationReviews = createCrudService('moderationReviews', {
  idPrefix: ID_PREFIX.MODERATION_REVIEW,
  // Moderation cases are stamped `submittedAt`, not `createdAt` (contract §6.20).
  timestampField: 'submittedAt',
})

/**
 * MOCK-JOIN: JSON Server has no `include`, so the console reads the subject, the
 * creator, and (for a delivery) its order as separate batched lists. These are
 * read-only handles — every *write* to a subject goes through the side-effect
 * helpers below, so the lifecycle stays in one place (00 §9).
 */
const portfolioItems = createCrudService('portfolioItems', {
  idPrefix: ID_PREFIX.PORTFOLIO_ITEM,
})
const deliveries = createCrudService('deliveries', {
  idPrefix: ID_PREFIX.DELIVERY,
  timestampField: 'submittedAt',
})
const users = createCrudService('users', { idPrefix: ID_PREFIX.USER })
const creatorProfiles = createCrudService('creatorProfiles', {
  idPrefix: ID_PREFIX.CREATOR_PROFILE,
})
const orders = createCrudService('orders', { idPrefix: ID_PREFIX.ORDER })

/** The statuses that mean "open" — everything not yet decided. */
export const OPEN_QUEUE_STATUSES = Object.freeze([
  CONTENT_STATUS.SUBMITTED,
  CONTENT_STATUS.UNDER_REVIEW,
])

/** The statuses a decided case can carry — the history side of the queue. */
export const DECIDED_QUEUE_STATUSES = Object.freeze([
  CONTENT_STATUS.APPROVED,
  CONTENT_STATUS.REJECTED,
  CONTENT_STATUS.REVISION_REQUIRED,
  CONTENT_STATUS.RESTRICTED,
])

/** What a reviewer can decide. The console's four buttons, one value each. */
export const MODERATION_DECISION = Object.freeze({
  APPROVE: 'approve',
  REJECT: 'reject',
  REQUEST_CHANGES: 'request_changes',
  RESTRICT: 'restrict',
})

/** Shortest reviewer note worth sending to a creator (Prompt 30 §4.3). */
export const MODERATION_NOTES_MIN = 20

/** Cap, matching the contract's `moderationReviews.notes` column. */
export const MODERATION_NOTES_MAX = 500

/**
 * Everything that differs between the four decisions, in one table: where the
 * case lands, what the creator is told, and what the audit trail records.
 *
 * `requiresReasonCode` follows contract §6.20 — a negative outcome always
 * records *why*, because the creator reads it and so does the next reviewer.
 * `notifies` is the one notification type each decision emits; there is no
 * `moderation_restricted` type in `constants/notificationTypes.js` (00 §9 —
 * that list is Prompt 03's), so a restriction reuses `moderation_rejected`,
 * whose tone and category are right, and carries its own title.
 */
export const MODERATION_DECISION_META = Object.freeze({
  [MODERATION_DECISION.APPROVE]: Object.freeze({
    status: CONTENT_STATUS.APPROVED,
    label: 'Approve',
    auditAction: AUDIT_ACTION.MODERATION_APPROVE,
    notifies: NOTIFICATION_TYPE.MODERATION_APPROVED,
    requiresReasonCode: false,
    requiresNotes: false,
  }),
  [MODERATION_DECISION.REQUEST_CHANGES]: Object.freeze({
    status: CONTENT_STATUS.REVISION_REQUIRED,
    label: 'Request changes',
    auditAction: AUDIT_ACTION.MODERATION_REQUEST_CHANGES,
    notifies: NOTIFICATION_TYPE.MODERATION_REVISION,
    requiresReasonCode: false,
    requiresNotes: true,
  }),
  [MODERATION_DECISION.REJECT]: Object.freeze({
    status: CONTENT_STATUS.REJECTED,
    label: 'Reject',
    auditAction: AUDIT_ACTION.MODERATION_REJECT,
    notifies: NOTIFICATION_TYPE.MODERATION_REJECTED,
    requiresReasonCode: true,
    requiresNotes: true,
  }),
  [MODERATION_DECISION.RESTRICT]: Object.freeze({
    status: CONTENT_STATUS.RESTRICTED,
    label: 'Restrict',
    auditAction: AUDIT_ACTION.MODERATION_RESTRICT,
    notifies: NOTIFICATION_TYPE.MODERATION_REJECTED,
    requiresReasonCode: true,
    requiresNotes: true,
  }),
})

/**
 * How many cases one board read holds. The queue is a working set, not an
 * archive: a marketplace with more than this waiting has a staffing problem,
 * not a pagination problem. The adapter caps a page at 100 either way
 * (contract §4.1).
 */
const BOARD_LIMIT = 100

/** Cases read when computing a creator's prior record — see `getCreatorStats`. */
const STATS_LIMIT = 100

const nowIso = () => new Date().toISOString()

/** `conflict` is the contract's code for "not in the right state" (§3.2). */
const invalidState = (message, details) =>
  createApiError(API_ERROR_CODE.CONFLICT, message, details, 409)

const invalidInput = (message, details) =>
  createApiError(API_ERROR_CODE.VALIDATION_FAILED, message, details, 422)

/** Runs a status change through the machine, reporting a rejection as `409`. */
function transitionTo(from, to, message) {
  try {
    return assertTransition(CONTENT_STATUS_MACHINE, from, to)
  } catch (failure) {
    throw invalidState(message, { from, to, transition: failure.message })
  }
}

/** Walks a chain of transitions, asserting every hop. Returns the last state. */
function transitionThrough(from, path, message) {
  return path.reduce((current, next) => transitionTo(current, next, message), from)
}

/** Trims a reviewer note to something worth storing, or `null`. */
function normalizeNotes(notes) {
  const text = String(notes ?? '').trim()
  return text ? text.slice(0, MODERATION_NOTES_MAX) : null
}

/** Neither an emit nor an audit line may undo a decision that happened. */
async function quietly(work) {
  try {
    return await work()
  } catch {
    return null
  }
}

/* -------------------------------------------------------------------------- */
/* Subject side-effects                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Reads the content a case is about. Fails **soft** for the board (a case whose
 * subject was archived out from under it should still render as a row rather
 * than break the queue) — `decide` re-reads it and does not.
 */
async function readSubject(review) {
  if (!review?.subjectId) return null
  const collection =
    review.subjectType === MODERATION_SUBJECT.DELIVERY ? deliveries : portfolioItems
  return collection.getById(review.subjectId)
}

/**
 * **Applies a decision to a portfolio item.**
 *
 * Approval is two hops, not one: `approved` is the reviewer's verdict and
 * `published` is what it does — the machine spells both out (00 §9), and
 * running them in sequence is what keeps this function honest about the state
 * it is skipping through. An item still sitting at `submitted` (its case was
 * claimed but the mirror write failed, or a case pre-dates the mirror) picks up
 * the `under_review` hop first rather than being refused.
 */
async function applyToPortfolioItem(item, { decision, notes, at }) {
  if (decision === MODERATION_DECISION.RESTRICT) {
    const status = transitionTo(
      item.status,
      CONTENT_STATUS.RESTRICTED,
      'Only published work can be restricted.'
    )
    return portfolioItems.update(item.id, { status, updatedAt: at })
  }

  const opening =
    item.status === CONTENT_STATUS.SUBMITTED ? [CONTENT_STATUS.UNDER_REVIEW] : []
  const message = 'This item is not in a state that decision can be applied to.'

  if (decision === MODERATION_DECISION.APPROVE) {
    const status = transitionThrough(
      item.status,
      [...opening, CONTENT_STATUS.APPROVED, CONTENT_STATUS.PUBLISHED],
      message
    )
    return portfolioItems.update(item.id, {
      status,
      // Re-published work keeps its original publication date: the item has
      // been live before, and back-dating a re-review would reorder a
      // storefront that nobody re-arranged.
      publishedAt: item.publishedAt ?? at,
      // The rejection copy belonged to a submission that is no longer current.
      rejectionReason: null,
      updatedAt: at,
    })
  }

  const target = MODERATION_DECISION_META[decision].status
  const status = transitionThrough(item.status, [...opening, target], message)
  return portfolioItems.update(item.id, {
    status,
    // What the creator reads on the card in their portfolio manager (Prompt 22).
    rejectionReason: notes,
    updatedAt: at,
  })
}

/**
 * **Applies a decision to a delivered version.**
 *
 * Deliverables are deliberately *record-only*: `deliveries.status` belongs to
 * the buyer's review (`submitted → revision_requested → accepted`, contract
 * §6.10) and a content review must never move it — a buyer who has been sent
 * work does not lose it because Trust & Safety is still reading. The decision
 * lives on the moderation case, and the order flow carries on regardless.
 *
 * **Restriction policy** — the one write this makes: each file on the version
 * is flagged `restricted: true`. A restricted deliverable stays available to the
 * buyer who paid for it and to the order it belongs to; the flag is what keeps
 * it out of any *reuse* surface — showcases, marketing, and the portfolio path a
 * creator can take a delivery down later. Kept deliberately simple in v1 and
 * documented in `docs/data-model.md`; a future prompt can act on the flag
 * without changing this decision.
 */
async function applyToDelivery(delivery, { decision, at }) {
  if (decision !== MODERATION_DECISION.RESTRICT) return delivery

  const files = (delivery.files ?? []).map((file) => ({ ...file, restricted: true }))
  return deliveries.update(delivery.id, { files, restrictedAt: at })
}

/** Routes a decision to the right subject writer. */
function applyToSubject(subject, review, payload) {
  if (!subject) return Promise.resolve(null)
  return review.subjectType === MODERATION_SUBJECT.DELIVERY
    ? applyToDelivery(subject, payload)
    : applyToPortfolioItem(subject, payload)
}

/* -------------------------------------------------------------------------- */
/* Creator-facing copy                                                        */
/* -------------------------------------------------------------------------- */

/**
 * A reason code's meaning: the canonical constants first (Prompt 03 owns them),
 * then any custom addition a super admin has configured (Prompt 35).
 *
 * Constants stay canonical — settings can only *add* — so a code stored on an
 * old case always resolves to what it meant when it was written.
 */
async function resolveReason(reasonCode) {
  if (!reasonCode) return undefined
  const canonical = getRejectionReason(reasonCode)
  if (canonical) return canonical

  try {
    const reasons = await settingsService.getRejectionReasons()
    return reasons.find((reason) => reason.code === reasonCode)
  } catch {
    return undefined
  }
}

/** What the creator's notification says, per decision. */
function decisionNotification({ decision, subjectTitle, reason, notes, isDelivery }) {
  const subject = subjectTitle ? `“${subjectTitle}”` : 'Your submission'
  const because = reason ? ` Reason: ${reason.label}.` : ''
  const note = notes ? ` ${notes}` : ''

  switch (decision) {
    case MODERATION_DECISION.APPROVE:
      return {
        title: isDelivery ? 'Deliverable cleared review' : 'Content approved',
        body: isDelivery
          ? `${subject} passed content review. Nothing more is needed from you.${note}`
          : `${subject} has been approved and is now live on your public profile.${note}`,
      }
    case MODERATION_DECISION.REQUEST_CHANGES:
      return {
        title: 'Changes requested',
        body: `${subject} needs changes before it can be approved.${because}${note} Update it and send it back for review.`,
      }
    case MODERATION_DECISION.REJECT:
      return {
        title: 'Submission not approved',
        body: `${subject} was not approved.${because}${note} You can make changes and re-submit.`,
      }
    case MODERATION_DECISION.RESTRICT:
      return {
        title: 'Content restricted',
        body: `${subject} has been restricted and is no longer publicly visible.${because}${note} Contact support if you would like this reviewed again.`,
      }
    default:
      return { title: 'Content review updated', body: note.trim() }
  }
}

/** The line the case's history carries for a decision. */
function decisionHistoryNote({ decision, reason, notes }) {
  const prefix = MODERATION_DECISION_META[decision]?.label ?? 'Decision'
  return [`${prefix}${reason ? ` — ${reason.label}` : ''}.`, notes].filter(Boolean).join(' ')
}

/* -------------------------------------------------------------------------- */
/* Batched reads for the console                                              */
/* -------------------------------------------------------------------------- */

/** Unique, defined ids from a list of records, capped at one page. */
const idsFrom = (records, key) =>
  Array.from(new Set(records.map((record) => record[key]).filter(Boolean))).slice(0, BOARD_LIMIT)

/**
 * MOCK-JOIN: one batched `?id=…&id=…` read per collection, reduced to a lookup.
 * Fails soft — a board that cannot resolve a title still lists its cases with
 * the id, which is more use than an error page (§13).
 */
async function readByIds(collection, ids) {
  if (ids.length === 0) return {}
  try {
    const { items } = await collection.list({ page: 1, limit: BOARD_LIMIT, filters: { id: ids } })
    return Object.fromEntries(items.map((item) => [item.id, item]))
  } catch {
    return {}
  }
}

/** Text a queue search matches against — the title and the creator's name. */
const searchHaystack = (entry) =>
  [entry.subjectTitle, entry.creator?.name, entry.creator?.email, entry.subjectId]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

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

  /* —— workflow operations (Prompt 30) ——————————————————————————————— */

  /**
   * **Takes a case off the queue.** `submitted → under_review`, stamped with
   * the reviewer so the rest of the team can see it is being worked.
   *
   * The portfolio item is mirrored to `under_review` in the same call, which is
   * what makes the creator's manager say "with our team" rather than "waiting"
   * (Prompt 22). Deliveries are not mirrored — see {@link applyToDelivery}.
   *
   * **Mock sequence** (`PATCH /moderationReviews/:id` in the contract):
   * 1. `GET /moderationReviews/:id` — guard the transition
   * 2. `PATCH /moderationReviews/:id` → `{ status, reviewerId, history }`
   * 3. `PATCH /portfolioItems/:id` → `{ status: 'under_review' }` (best effort)
   *
   * @param {string} reviewId `mod_…`
   * @param {object} options
   * @param {object} options.actor the signed-in reviewer (`id`, `role`)
   * @returns {Promise<object>} the claimed case
   * @throws {ApiError} `validation_failed` (no actor) · `not_found` ·
   *   `conflict` when somebody else already claimed or decided it
   *
   * **Future endpoint:** a conditional update — `WHERE reviewer_id IS NULL` —
   * so two reviewers cannot claim the same case (contract §6.20).
   */
  async claimForReview(reviewId, { actor } = {}) {
    if (!actor?.id) {
      throw invalidInput('We could not tell who is claiming this case.', {
        actor: 'A signed-in reviewer is required.',
      })
    }

    const review = await moderationReviews.getById(reviewId)
    const status = transitionTo(
      review.status,
      CONTENT_STATUS.UNDER_REVIEW,
      review.reviewerId
        ? 'Another reviewer is already working this case.'
        : 'This case has already been decided.'
    )

    const at = nowIso()
    const claimed = await moderationReviews.update(reviewId, {
      status,
      reviewerId: actor.id,
      history: [
        ...(review.history ?? []),
        {
          at,
          byId: actor.id,
          fromStatus: review.status,
          toStatus: status,
          note: 'Picked up from the review queue.',
        },
      ],
    })

    // Best effort: a claimed case whose item still reads `submitted` is a
    // cosmetic mismatch on the creator's screen; a claim that failed because of
    // it would send the reviewer back to a queue they have already started.
    if (review.subjectType === MODERATION_SUBJECT.PORTFOLIO_ITEM) {
      await quietly(async () => {
        const item = await portfolioItems.getById(review.subjectId)
        if (item.status !== CONTENT_STATUS.SUBMITTED) return null
        return portfolioItems.update(item.id, { status, updatedAt: at })
      })
    }

    // Prompt 36's coverage sweep found this one missing. Taking a case out of
    // the shared queue moves content into `under_review` and puts one reviewer's
    // name on the decision that follows — which is exactly the kind of thing the
    // trail exists to answer ("who was working this, and since when?"), and the
    // mirror of `dispute.assign`, which has been audited since Prompt 33.
    await quietly(() =>
      auditService.log({
        actorId: actor.id,
        actorRole: actor.role ?? ROLES.ADMIN,
        action: AUDIT_ACTION.MODERATION_CLAIM,
        entityType: 'moderation_review',
        entityId: reviewId,
        meta: {
          fromStatus: review.status,
          toStatus: status,
          subjectType: review.subjectType,
          subjectId: review.subjectId,
        },
      })
    )

    return claimed
  },

  /**
   * **Records a decision** — the operation the whole console exists for
   * (contract §7, operation 27).
   *
   * It does five things, in this order, and the order is the point: the case is
   * written first because it is the record of the decision, the content second
   * because that is what members see, and the emit and the audit line last
   * because neither may cost a decision that has already been made.
   *
   * 1. guard the transition on the case
   * 2. `PATCH /moderationReviews/:id` — status, reviewer, notes, reason, history
   * 3. propagate to the subject ({@link applyToPortfolioItem} / {@link applyToDelivery})
   * 4. notify the creator (`moderation_approved|rejected|revision`)
   * 5. `POST /auditLogs` — `moderation.<decision>`
   *
   * @param {string} reviewId `mod_…`
   * @param {object} payload
   * @param {string} payload.decision a {@link MODERATION_DECISION} value
   * @param {string} [payload.notes] what the creator is told; required for
   *   every decision except `approve` ({@link MODERATION_NOTES_MIN}–{@link MODERATION_NOTES_MAX})
   * @param {string} [payload.reasonCode] a `REJECTION_REASON_CODE`; required for
   *   `reject` and `restrict`
   * @param {object} payload.actor the signed-in reviewer (`id`, `role`)
   * @returns {Promise<{review: object, subject: object|null}>}
   * @throws {ApiError} `validation_failed` (unknown decision, missing reason or
   *   notes) · `not_found` · `conflict` (the case moved under the reviewer, or
   *   the content is not in a state the decision can apply to)
   *
   * **Future endpoint:** `POST /moderationReviews/:id/decision` — one
   * transaction covering all five steps.
   */
  async decide(reviewId, { decision, notes, reasonCode, actor } = {}) {
    const meta = MODERATION_DECISION_META[decision]
    if (!meta) {
      throw invalidInput('That is not a decision we recognise.', {
        decision: `Choose one of: ${Object.values(MODERATION_DECISION).join(', ')}.`,
      })
    }
    if (!actor?.id) {
      throw invalidInput('We could not tell who is recording this decision.', {
        actor: 'A signed-in reviewer is required.',
      })
    }

    const note = normalizeNotes(notes)
    if (meta.requiresNotes && (!note || note.length < MODERATION_NOTES_MIN)) {
      throw invalidInput('Write the creator a note explaining this decision.', {
        notes: [
          `At least ${MODERATION_NOTES_MIN} characters — the creator reads this, and so does the next reviewer.`,
        ],
      })
    }
    // Resolved once and threaded through the notification, the history note,
    // and the validation below — so a super admin's custom addition (Prompt 35)
    // is accepted and *named* everywhere a built-in code would be.
    const reason = await resolveReason(reasonCode)
    if (meta.requiresReasonCode && !reason) {
      throw invalidInput('Pick the reason behind this decision.', {
        reasonCode: ['Choose the Content Policy reason that applies.'],
      })
    }

    const review = await moderationReviews.getById(reviewId)
    const subject = await readSubject(review)
    const at = nowIso()

    // The case follows the same machine as the content it is about. A
    // restriction is the one decision taken on *live* content rather than on a
    // submission, so it is guarded against the subject's status (published →
    // restricted) rather than against the case's, which still carries the
    // approval that put it there.
    if (decision === MODERATION_DECISION.RESTRICT) {
      if (review.status !== CONTENT_STATUS.APPROVED && review.status !== CONTENT_STATUS.PUBLISHED) {
        throw invalidState('Only content that has been approved can be restricted.', {
          status: review.status,
        })
      }
    } else {
      transitionTo(
        review.status,
        meta.status,
        review.reviewedAt
          ? 'This case has already been decided. Refresh to see where it stands.'
          : 'Claim this case before recording a decision.'
      )
    }

    const updated = await moderationReviews.update(reviewId, {
      status: meta.status,
      reviewerId: actor.id,
      notes: note,
      reasonCode: reasonCode ?? null,
      reviewedAt: at,
      history: [
        ...(review.history ?? []),
        {
          at,
          byId: actor.id,
          fromStatus: review.status,
          toStatus: meta.status,
          note: decisionHistoryNote({ decision, reason, notes: note }),
        },
      ],
    })

    // The subject write is *not* best-effort: a case that says "approved" over
    // an item nobody can see is the one inconsistency a reviewer cannot detect
    // from the console. It throws, and the toast tells them to try again.
    const nextSubject = await applyToSubject(subject, review, { decision, notes: note, at })

    const isDelivery = review.subjectType === MODERATION_SUBJECT.DELIVERY
    const copy = decisionNotification({
      decision,
      subjectTitle: subject?.title ?? (isDelivery ? `version ${subject?.version ?? ''}`.trim() : null),
      reason,
      notes: note,
      isDelivery,
    })

    await quietly(() =>
      notificationService.notify({
        userId: review.creatorId,
        type: meta.notifies,
        title: copy.title,
        body: copy.body,
        entityType: NOTIFICATION_ENTITY.MODERATION_REVIEW,
        entityId: reviewId,
      })
    )

    await quietly(() =>
      auditService.log({
        actorId: actor.id,
        actorRole: actor.role ?? ROLES.ADMIN,
        action: meta.auditAction,
        entityType: 'moderation_review',
        entityId: reviewId,
        meta: {
          decision,
          fromStatus: review.status,
          toStatus: meta.status,
          subjectType: review.subjectType,
          subjectId: review.subjectId,
          ...(reasonCode ? { reasonCode } : {}),
          ...(note ? { reason: note } : {}),
        },
      })
    )

    return { review: updated, subject: nextSubject ?? subject }
  },

  /**
   * **The case for a piece of content, opening one if there is none.**
   *
   * How a report becomes a review: somebody flags a portfolio item, an admin
   * decides it is worth looking at, and the queue needs a case to put it in.
   * An open case is reused rather than duplicated — two rows for one item is
   * how a queue starts lying about its size.
   *
   * @param {object} payload
   * @param {string} payload.subjectType a `MODERATION_SUBJECT` value
   * @param {string} payload.subjectId the content's id
   * @param {string} [payload.creatorId] `usr_…` — who submitted it; resolved
   *   from the item's storefront when omitted
   * @param {object} payload.actor the signed-in admin
   * @param {string} [payload.note] why the case was opened
   * @returns {Promise<{review: object, created: boolean}>}
   * @throws {ApiError} `validation_failed` · `not_found`
   *
   * **Future endpoint:** `POST /moderationReviews` with the subject in the body,
   * authorised on `moderation.review`.
   */
  async ensureReviewForSubject({ subjectType, subjectId, creatorId, actor, note } = {}) {
    if (!subjectType || !subjectId) {
      throw invalidInput('We could not tell what should be reviewed.', {
        subjectId: 'A portfolio item or delivery is required.',
      })
    }

    const existing = await moderationService.getBySubject(subjectType, subjectId)
    if (existing && OPEN_QUEUE_STATUSES.includes(existing.status)) {
      return { review: existing, created: false }
    }

    // MOCK-JOIN: `moderationReviews.creatorId` is a **user** id while a
    // portfolio item is keyed by `cpr_…` (`docs/data-model.md` §3), so the owner
    // is resolved through the storefront when the caller cannot supply it.
    let creatorUserId = creatorId ?? existing?.creatorId ?? null
    if (!creatorUserId && subjectType === MODERATION_SUBJECT.PORTFOLIO_ITEM) {
      creatorUserId = await quietly(async () => {
        const item = await portfolioItems.getById(subjectId)
        const profile = await creatorProfiles.getById(item.creatorId)
        return profile?.userId ?? null
      })
    }

    const at = nowIso()
    const review = await moderationReviews.create({
      subjectType,
      subjectId,
      creatorId: creatorUserId,
      status: CONTENT_STATUS.SUBMITTED,
      history: [
        {
          at,
          byId: actor?.id ?? null,
          fromStatus: existing?.status ?? CONTENT_STATUS.PUBLISHED,
          toStatus: CONTENT_STATUS.SUBMITTED,
          note: note ?? 'Opened for review by Trust & Safety following a member report.',
        },
      ],
      submittedAt: at,
      reviewedAt: null,
    })

    // Prompt 36's coverage sweep: opening a case pulls published content back
    // into review, and until now only the *report* that triggered it was
    // recorded. The report's own `report.action` entry says a report was acted
    // on; this one says what that action created, and it is what makes the case
    // traceable when it was opened from somewhere other than a report.
    if (actor?.id) {
      await quietly(() =>
        auditService.log({
          actorId: actor.id,
          actorRole: actor.role ?? ROLES.ADMIN,
          action: AUDIT_ACTION.MODERATION_OPEN,
          entityType: 'moderation_review',
          entityId: review.id,
          meta: {
            subjectType,
            subjectId,
            ...(creatorUserId ? { creatorId: creatorUserId } : {}),
            ...(note ? { reason: note } : {}),
          },
        })
      )
    }

    return { review, created: true }
  },

  /**
   * The three numbers on the console's tabs.
   *
   * Each is one row fetched purely for its `X-Total-Count`, and each fails soft
   * to `null` — a badge that cannot be counted should be absent, never `0`,
   * which would read as "nothing waiting" (§13).
   *
   * @returns {Promise<{portfolioItems: number|null, deliveries: number|null,
   *   reports: number|null}>}
   */
  async getQueueCounts() {
    const countOpen = (subjectType) =>
      quietly(async () => {
        const { total } = await moderationService.listQueue({
          page: 1,
          limit: 1,
          filters: { subjectType },
        })
        return total
      })

    const countReports = quietly(async () => {
      const { total } = await reportService.listQueue({ page: 1, limit: 1 })
      return total
    })

    const [portfolio, delivery, reports] = await Promise.all([
      countOpen(MODERATION_SUBJECT.PORTFOLIO_ITEM),
      countOpen(MODERATION_SUBJECT.DELIVERY),
      countReports,
    ])

    return { portfolioItems: portfolio, deliveries: delivery, reports }
  },

  /**
   * **The queue, ready to render.** Cases plus the content they are about and
   * the creator who submitted it, filtered and paged.
   *
   * MOCK-SEARCH + MOCK-FILTER: JSON Server cannot search across a join, so the
   * title/creator search and the category filter are applied **after** the
   * batched reads, over one board's worth of cases ({@link BOARD_LIMIT}) —
   * which is why paging happens here rather than on the wire. `total` is
   * therefore the true count for the filters in effect, not a page's worth.
   *
   * > **Laravel** — `GET /admin/moderation?search=…&categoryId=…` with the
   * > joins server-side; this collapses to one request and the slicing goes.
   *
   * @param {object} [params]
   * @param {string} [params.subjectType] `portfolio_item` | `delivery`
   * @param {string[]} [params.statuses] `CONTENT_STATUS` values (OR)
   * @param {string} [params.categoryId] portfolio items only
   * @param {string} [params.search] title, creator name, or id
   * @param {string} [params.from] ISO date — submitted on or after
   * @param {string} [params.to] ISO date — submitted on or before
   * @param {'asc'|'desc'} [params.order='asc'] oldest first by default
   * @param {number} [params.page=1]
   * @param {number} [params.limit=12]
   * @returns {Promise<{items: object[], total: number, page: number, limit: number}>}
   *   each item is the case with `subject`, `creator`, `subjectTitle`,
   *   `thumbnailUrl`, `categoryId`, and `contentType` attached
   */
  async listReviewBoard({
    subjectType,
    statuses,
    categoryId,
    search,
    from,
    to,
    order = SORT_ORDER.ASC,
    page = 1,
    limit = 12,
  } = {}) {
    const { items: reviews } = await moderationService.list({
      page: 1,
      limit: BOARD_LIMIT,
      sort: 'submittedAt',
      order,
      filters: {
        subjectType,
        status: statuses?.length ? statuses : undefined,
        submittedAt_gte: from || undefined,
        submittedAt_lte: to || undefined,
      },
    })

    const portfolioIds = idsFrom(
      reviews.filter((review) => review.subjectType === MODERATION_SUBJECT.PORTFOLIO_ITEM),
      'subjectId'
    )
    const deliveryIds = idsFrom(
      reviews.filter((review) => review.subjectType === MODERATION_SUBJECT.DELIVERY),
      'subjectId'
    )

    const [itemsById, deliveriesById, creatorsById] = await Promise.all([
      readByIds(portfolioItems, portfolioIds),
      readByIds(deliveries, deliveryIds),
      readByIds(users, idsFrom(reviews, 'creatorId')),
    ])

    const enriched = reviews.map((review) => {
      const isDelivery = review.subjectType === MODERATION_SUBJECT.DELIVERY
      const subject = isDelivery
        ? deliveriesById[review.subjectId]
        : itemsById[review.subjectId]

      return {
        ...review,
        subject: subject ?? null,
        creator: creatorsById[review.creatorId] ?? null,
        subjectTitle: isDelivery
          ? `Delivery version ${subject?.version ?? '—'}`
          : (subject?.title ?? review.subjectId),
        thumbnailUrl: isDelivery
          ? (subject?.files?.[0]?.thumbnailUrl ?? null)
          : (subject?.thumbnailUrl ?? null),
        categoryId: isDelivery ? null : (subject?.categoryId ?? null),
        contentType: isDelivery ? null : (subject?.contentType ?? null),
        fileCount: isDelivery ? (subject?.files?.length ?? 0) : 1,
      }
    })

    const term = String(search ?? '').trim().toLowerCase()
    const filtered = enriched.filter((entry) => {
      if (categoryId && entry.categoryId !== categoryId) return false
      if (term && !searchHaystack(entry).includes(term)) return false
      return true
    })

    const safeLimit = Math.max(1, limit)
    const safePage = Math.max(1, page)
    const start = (safePage - 1) * safeLimit

    return {
      items: filtered.slice(start, start + safeLimit),
      total: filtered.length,
      page: safePage,
      limit: safeLimit,
    }
  },

  /**
   * **Everything the review screen paints, in one call.**
   *
   * The case, the content, the creator and their storefront, the order behind a
   * delivery, and the creator's prior record with us. Every join except the
   * case itself fails soft: a reviewer looking at a submission should not lose
   * the preview because a storefront read timed out (§13).
   *
   * @param {string} reviewId `mod_…`
   * @returns {Promise<{review: object, subject: object|null, creator: object|null,
   *   creatorProfile: object|null, order: object|null, stats: object}>}
   * @throws {ApiError} `not_found` when there is no such case
   */
  async getReviewBundle(reviewId) {
    const review = await moderationReviews.getById(reviewId)

    const [subject, creator, stats] = await Promise.all([
      quietly(() => readSubject(review)),
      quietly(() => users.getById(review.creatorId)),
      moderationService.getCreatorStats(review.creatorId),
    ])

    const [creatorProfile, order] = await Promise.all([
      quietly(async () => {
        const { items } = await creatorProfiles.list({
          page: 1,
          limit: 1,
          filters: { userId: review.creatorId },
        })
        return items[0] ?? null
      }),
      review.subjectType === MODERATION_SUBJECT.DELIVERY && subject?.orderId
        ? quietly(() => orders.getById(subject.orderId))
        : Promise.resolve(null),
    ])

    return { review, subject, creator, creatorProfile, order, stats }
  },

  /**
   * A creator's record with Trust & Safety: how much of what they have sent us
   * was approved, and how much was not.
   *
   * Context, not a verdict — a reviewer reads it the way they would read the
   * rest of the case, and the copy on the panel says so. Counted over one page
   * of cases ({@link STATS_LIMIT}); `truncated` is `true` when there were more,
   * so the screen can say "of the last 100" rather than overstate.
   *
   * @param {string} creatorUserId `usr_…`
   * @returns {Promise<{total: number, approved: number, rejected: number,
   *   changesRequested: number, restricted: number, open: number, truncated: boolean}>}
   */
  async getCreatorStats(creatorUserId) {
    const empty = {
      total: 0,
      approved: 0,
      rejected: 0,
      changesRequested: 0,
      restricted: 0,
      open: 0,
      truncated: false,
    }
    if (!creatorUserId) return empty

    const result = await quietly(() =>
      moderationReviews.list({
        page: 1,
        limit: STATS_LIMIT,
        sort: 'submittedAt',
        order: SORT_ORDER.DESC,
        filters: { creatorId: creatorUserId },
      })
    )
    if (!result) return empty

    const counts = { ...empty, total: result.total, truncated: result.total > result.items.length }
    result.items.forEach((review) => {
      if (review.status === CONTENT_STATUS.APPROVED) counts.approved += 1
      else if (review.status === CONTENT_STATUS.REJECTED) counts.rejected += 1
      else if (review.status === CONTENT_STATUS.REVISION_REQUIRED) counts.changesRequested += 1
      else if (review.status === CONTENT_STATUS.RESTRICTED) counts.restricted += 1
      else counts.open += 1
    })
    return counts
  },
})

export default moderationService
