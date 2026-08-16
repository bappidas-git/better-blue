// Trust & Safety casework — `docs/api-contract.md` §6.16, §6.17.
//
// The file has two halves. The party-facing one (Prompt 26) opens a case and
// carries the conversation on it. The admin one below it (Prompt 33) works the
// case: triage, information requests, escalation, and the binding decision that
// ends it.
//
// **No money is written here.** `resolve` decides *what* should happen and then
// asks `paymentService` — through `releasePayment` and `refundPayment` — to make
// it happen, exactly as an accepted delivery or a cancellation would
// (`docs/payments.md` §4). There is deliberately no second implementation of a
// release in this module: a dispute resolved in the creator's favour and a buyer
// accepting a delivery must settle identically, including the commission record.

import { AUDIT_ACTION } from '@/constants/auditActions'
import { NOTIFICATION_TYPE } from '@/constants/notificationTypes'
import { PERMISSIONS } from '@/constants/permissions'
import { isAdminRole, ROLES } from '@/constants/roles'
import { DISPUTE_STATUS_MACHINE, ORDER_STATUS_MACHINE } from '@/constants/stateMachines'
import {
  DISPUTE_CATEGORY,
  DISPUTE_RESOLUTION,
  DISPUTE_STATUS,
  ORDER_STATUS,
  PAYMENT_STATUS,
} from '@/constants/statuses'
import { REFUND_CONTEXT } from '@/constants/transactionTemplates'
import { formatCurrency } from '@/utils/formatters'
import { ID_PREFIX } from '@/utils/id'
import { assertTransition, canTransition } from '@/utils/stateMachine'

import { API_ERROR_CODE, createApiError } from './api/apiError'
import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'
import { auditService } from './auditService'
import { notificationService } from './notificationService'
import { uploadService, UPLOAD_PURPOSE } from './uploadService'
// CYCLE: `orderService` imports this module for the dispute rows on an order's
// timeline, and `createDispute` calls back into it to freeze the order. The same
// harmless shape `deliveryService` has: neither module touches the other at
// evaluation time, and both dereference only inside function bodies. Laravel
// collapses the pair into one controller and it disappears.
import { orderService } from './orderService'
// CYCLE (Prompt 33): `paymentService` imports this module for the dispute flag
// on the escrow monitor, and `resolve` calls back into it to move the money.
// Same shape, same reason — dereferenced only inside function bodies, and
// imported rather than reimplemented because a second release path is precisely
// what this product must not grow.
import { paymentService } from './paymentService'
// CYCLE (Prompt 33): `userService` imports this module to count a member's open
// cases, and the admin queue reads below call back for the names and avatars
// behind one. Imported rather than reached for directly because `listByIds`
// strips credentials before anything renders.
import { userService } from './userService'

const disputes = createCrudService('disputes', { idPrefix: ID_PREFIX.DISPUTE })
const disputeMessages = createCrudService('disputeMessages', {
  idPrefix: ID_PREFIX.DISPUTE_MESSAGE,
})

/** Newest-first comparison on an ISO timestamp field. */
const byCreatedAtDesc = (a, b) =>
  String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))

const nowIso = () => new Date().toISOString()

/**
 * Order states a dispute may be opened from.
 *
 * **Follows `ORDER_STATUS_MACHINE` exactly** (00 §9): the machine has no
 * `completed → disputed` edge, so a finished order cannot be disputed however
 * recently it completed. Prompt 26 floated a "completed within 14 days" window;
 * it is deliberately not implemented, because the machine is authoritative and
 * widening it here would let the UI offer an action `assertTransition` refuses.
 * A buyer who finds a problem after accepting reaches Trust & Safety through
 * support (§6.22) instead.
 */
export const DISPUTABLE_ORDER_STATUSES = Object.freeze([
  ORDER_STATUS.IN_PROGRESS,
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.REVISION_REQUESTED,
])

/** Statuses where a case is still live — the "one open dispute per order" rule. */
export const ACTIVE_DISPUTE_STATUSES = Object.freeze([
  DISPUTE_STATUS.OPEN,
  DISPUTE_STATUS.UNDER_REVIEW,
  DISPUTE_STATUS.AWAITING_BUYER,
  DISPUTE_STATUS.AWAITING_CREATOR,
  DISPUTE_STATUS.ESCALATED,
])

/** Statuses where the thread is closed to new messages. */
export const SETTLED_DISPUTE_STATUSES = Object.freeze([
  DISPUTE_STATUS.RESOLVED,
  DISPUTE_STATUS.CLOSED,
])

/**
 * Statuses a decision can be issued from — **read off
 * `DISPUTE_STATUS_MACHINE`**, not listed by hand, so the action bar and
 * `assertTransition` can never disagree about where Resolve belongs
 * (Prompt 33 §5: "unresolvable states hide Resolve").
 *
 * `open` is deliberately absent: an untriaged case is one nobody has read, and
 * the machine says so. Assigning it is the first move.
 */
export const RESOLVABLE_DISPUTE_STATUSES = Object.freeze(
  Object.values(DISPUTE_STATUS).filter((status) =>
    canTransition(DISPUTE_STATUS_MACHINE, status, DISPUTE_STATUS.RESOLVED)
  )
)

/**
 * The reasoning behind a decision, which both parties read on their own screens
 * (Prompt 26's `ResolutionCard`). Long enough to be an explanation rather than
 * a verdict, short enough to stay readable.
 */
export const RESOLUTION_NOTE_MIN = 30
export const RESOLUTION_NOTE_MAX = 1000

/** The two parties an information request can be aimed at. */
export const INFO_REQUEST_ROLES = Object.freeze([ROLES.BUYER, ROLES.CREATOR])

/**
 * Ceiling on the batched joins behind the admin queue and workspace — the
 * provider's page ceiling (contract §4.1), comfortably above any seeded case
 * and gone the moment Laravel answers these with one query each.
 */
const QUEUE_JOIN_LIMIT = 100

/**
 * How an audit entry on a case reads on the workspace timeline.
 *
 * The trail stores `action` + `meta`; the sentences live here for the same
 * reason ledger descriptions live in `constants/transactionTemplates.js` —
 * writing them at each call site is how one action ends up with three
 * spellings. `internal` marks the rows a party would never see; the timeline is
 * admin-only, and the marker is what says so on screen.
 */
const DISPUTE_EVENT_STYLE = Object.freeze({
  [AUDIT_ACTION.DISPUTE_OPEN]: Object.freeze({
    icon: 'solar:shield-warning-linear',
    tone: 'warning',
    title: ({ category }) => `Dispute opened${category ? ` — ${String(category).replace(/_/g, ' ')}` : ''}`,
    description: () => '',
  }),
  [AUDIT_ACTION.DISPUTE_ASSIGN]: Object.freeze({
    icon: 'solar:user-check-linear',
    tone: 'info',
    title: ({ previousAdminId }) => (previousAdminId ? 'Reassigned' : 'Picked up for review'),
    description: () => '',
  }),
  [AUDIT_ACTION.DISPUTE_REQUEST_INFO]: Object.freeze({
    icon: 'solar:chat-round-dots-linear',
    tone: 'warning',
    title: ({ from }) => `Information requested from the ${from ?? 'other party'}`,
    description: () => '',
  }),
  [AUDIT_ACTION.DISPUTE_ESCALATE]: Object.freeze({
    icon: 'solar:double-alt-arrow-up-linear',
    tone: 'error',
    internal: true,
    title: () => 'Escalated to a senior reviewer',
    description: ({ note }) => note ?? '',
  }),
  [AUDIT_ACTION.DISPUTE_RESOLVE]: Object.freeze({
    icon: 'solar:shield-check-linear',
    tone: 'success',
    title: ({ outcome }) => `Decided — ${String(outcome ?? '').replace(/_/g, ' ') || 'resolved'}`,
    description: ({ note }) => note ?? '',
  }),
  [AUDIT_ACTION.DISPUTE_CLOSE]: Object.freeze({
    icon: 'solar:archive-linear',
    tone: 'neutral',
    title: () => 'Case closed',
    description: () => '',
  }),
  default: Object.freeze({
    icon: 'solar:history-linear',
    tone: 'neutral',
    title: ({ action }) => String(action ?? 'Activity').replace(/[._]/g, ' '),
    description: () => '',
  }),
})

/** The opening statement's rules, mirrored by the dialog so it can say them first. */
export const DISPUTE_DESCRIPTION_MIN = 60
export const DISPUTE_DESCRIPTION_MAX = 2000

/** Evidence cap on the opening statement (contract §5.1, `dispute_evidence`). */
export const MAX_EVIDENCE_FILES = 5

/** A reply's rules. Fewer attachments than the opener: this is a conversation. */
export const DISPUTE_MESSAGE_MIN = 2
export const DISPUTE_MESSAGE_MAX = 2000
export const MAX_MESSAGE_ATTACHMENTS = 3

/** Which party a dispute status is waiting on — `null` when it is not waiting on either. */
export function awaitingRoleFor(status) {
  if (status === DISPUTE_STATUS.AWAITING_BUYER) return ROLES.BUYER
  if (status === DISPUTE_STATUS.AWAITING_CREATOR) return ROLES.CREATOR
  return null
}

/** Is this case waiting on `role` right now? Drives the nav badge and the banner. */
export function isAwaitingRole(dispute, role) {
  const awaiting = awaitingRoleFor(dispute?.status)
  return awaiting !== null && awaiting === role
}

/** The status that parks a case on `role` — the inverse of {@link awaitingRoleFor}. */
export function awaitingStatusFor(role) {
  if (role === ROLES.BUYER) return DISPUTE_STATUS.AWAITING_BUYER
  if (role === ROLES.CREATOR) return DISPUTE_STATUS.AWAITING_CREATOR
  return null
}

/* -------------------------------------------------------------------------- */
/* What an admin may do to a case, right now                                  */
/* -------------------------------------------------------------------------- */
//
// Every predicate below answers from `DISPUTE_STATUS_MACHINE` rather than from
// a list of statuses somebody typed twice. The action bar in the admin
// workspace renders from these, so a button is on screen exactly when the
// service behind it would accept the call — the alternative is offering an
// action that fails on click, which is the one thing a decision surface must
// not do (§13).

/** Can this case be picked up or handed to another reviewer? */
export function canAssignDispute(dispute) {
  return Boolean(dispute) && !SETTLED_DISPUTE_STATUSES.includes(dispute.status)
}

/**
 * Can the team ask `role` for something right now?
 *
 * False while the case is already parked on either party: the machine has no
 * `awaiting_buyer → awaiting_creator` edge, and inventing one would let a case
 * be owed by two people at once.
 */
export function canRequestInfo(dispute, role) {
  const target = awaitingStatusFor(role)
  return Boolean(target) && canTransition(DISPUTE_STATUS_MACHINE, dispute?.status, target)
}

/** Can this case go to a senior reviewer? */
export function canEscalateDispute(dispute) {
  return canTransition(DISPUTE_STATUS_MACHINE, dispute?.status, DISPUTE_STATUS.ESCALATED)
}

/**
 * Can a binding decision be issued?
 *
 * Two conditions, and the second is not the machine's: a case must have been
 * **picked up** — assigned, or escalated to somebody senior — before anyone
 * decides it. `resolve` enforces the same pair.
 */
export function canResolveDispute(dispute) {
  if (!RESOLVABLE_DISPUTE_STATUSES.includes(dispute?.status)) return false
  return Boolean(dispute.assignedAdminId) || dispute.status === DISPUTE_STATUS.ESCALATED
}

/** Can this decided case be filed away? */
export function canCloseDispute(dispute) {
  return canTransition(DISPUTE_STATUS_MACHINE, dispute?.status, DISPUTE_STATUS.CLOSED)
}

/**
 * One sentence saying what an outcome did to the money — the same words in the
 * confirmation step, the thread message, and both parties' notifications, so a
 * decision cannot be described three ways.
 *
 * @param {string} outcome a `DISPUTE_RESOLUTION` value
 * @param {object} [money]
 * @param {number} [money.amountRefunded] what went back to the buyer
 * @param {number} [money.creatorEarnings] what reached the creator, after commission
 * @param {string} [money.currency]
 * @returns {string}
 */
export function resolutionSummary(outcome, { amountRefunded, creatorEarnings, currency } = {}) {
  const refunded = formatCurrency(amountRefunded ?? 0, currency)

  switch (outcome) {
    case DISPUTE_RESOLUTION.RELEASE_PAYMENT:
      return 'the payment held on this order has been released to the creator in full, minus the usual commission'
    case DISPUTE_RESOLUTION.FULL_REFUND:
      return `${refunded} has been returned to the buyer in full, and nothing was released to the creator`
    case DISPUTE_RESOLUTION.PARTIAL_REFUND:
      return (
        `${refunded} has been returned to the buyer and the balance released to the creator` +
        (Number.isFinite(Number(creatorEarnings))
          ? ` (${formatCurrency(creatorEarnings, currency)} after commission on what they kept)`
          : '')
      )
    default:
      return 'the order has been settled according to the decision below'
  }
}

/** `conflict` is the contract's code for "not in the right state" (§3.2). */
const invalidState = (message, details) =>
  createApiError(API_ERROR_CODE.CONFLICT, message, details, 409)

/** Runs a status change through its machine, reporting a rejection as `409` (§8.1). */
function transitionTo(machine, from, to, message) {
  try {
    return assertTransition(machine, from, to)
  } catch (failure) {
    throw invalidState(message, { from, to, transition: failure.message })
  }
}

/** A bell item must never fail a dispute that has already been written. */
async function notifyQuietly(notification) {
  try {
    return await notificationService.notify(notification)
  } catch {
    return null
  }
}

/** True for something already shaped like the contract's file object (§5.1). */
const isUploadedFile = (entry) => Boolean(entry && typeof entry === 'object' && entry.url)

/**
 * Turns whatever the caller passed as evidence into contract file objects.
 *
 * Both shapes are accepted for the same reason `deliveryService.resolveFiles`
 * accepts both: the contract's sequence uploads inside the operation, while a
 * composer that wants per-file progress uploads first and hands the records
 * through.
 */
async function resolveEvidence(files, { max, field }) {
  const list = Array.from(files ?? []).filter(Boolean)
  if (list.length === 0) return []

  if (list.length > max) {
    throw createApiError(API_ERROR_CODE.VALIDATION_FAILED, 'Too many files attached.', {
      [field]: `Attach up to ${max} files.`,
    })
  }
  if (list.every(isUploadedFile)) return list

  return uploadService.uploadFiles(list, { purpose: UPLOAD_PURPOSE.DISPUTE_EVIDENCE })
}

/** Validates the opening statement (§13). */
function assertDescription(description) {
  const text = String(description ?? '').trim()

  if (text.length < DISPUTE_DESCRIPTION_MIN) {
    throw createApiError(
      API_ERROR_CODE.VALIDATION_FAILED,
      'Tell us what went wrong.',
      { description: `Use at least ${DISPUTE_DESCRIPTION_MIN} characters.` }
    )
  }
  if (text.length > DISPUTE_DESCRIPTION_MAX) {
    throw createApiError(API_ERROR_CODE.VALIDATION_FAILED, 'That description is too long.', {
      description: `Keep it under ${DISPUTE_DESCRIPTION_MAX} characters.`,
    })
  }

  return text
}

/** Validates a reply (§13). */
function assertBody(body) {
  const text = String(body ?? '').trim()

  if (text.length < DISPUTE_MESSAGE_MIN) {
    throw createApiError(API_ERROR_CODE.VALIDATION_FAILED, 'Write a message before sending.', {
      body: 'A message cannot be empty.',
    })
  }
  if (text.length > DISPUTE_MESSAGE_MAX) {
    throw createApiError(API_ERROR_CODE.VALIDATION_FAILED, 'That message is too long.', {
      body: `Keep it under ${DISPUTE_MESSAGE_MAX} characters.`,
    })
  }

  return text
}

/** Validates the reasoning behind a decision (§13). */
function assertResolutionNote(note) {
  const text = String(note ?? '').trim()

  if (text.length < RESOLUTION_NOTE_MIN) {
    throw createApiError(
      API_ERROR_CODE.VALIDATION_FAILED,
      'Explain the decision before issuing it.',
      { note: `Both parties read this — use at least ${RESOLUTION_NOTE_MIN} characters.` }
    )
  }
  if (text.length > RESOLUTION_NOTE_MAX) {
    throw createApiError(API_ERROR_CODE.VALIDATION_FAILED, 'That explanation is too long.', {
      note: `Keep it under ${RESOLUTION_NOTE_MAX} characters.`,
    })
  }

  return text
}

/**
 * Thrown when a resolution failed **after** the money moved. There is no
 * rollback in the mock stack (contract §7), so the error names the step and
 * what was already written: an escrow released against a case still reading
 * `under_review` is exactly the state somebody has to reconcile by hand, and
 * swallowing the error is how it goes unnoticed.
 */
function inconsistency(step, done, cause) {
  return createApiError(
    API_ERROR_CODE.SERVER_ERROR,
    `The money was moved but ${step} did not complete. ` +
      'Support needs to reconcile this case by hand — nothing was rolled back.',
    { step, completed: done, cause: cause?.message }
  )
}

/** The other side of a case, from the perspective of `actorId`. */
function counterpartOf(dispute, actorId) {
  return dispute.raisedById === actorId ? dispute.againstId : dispute.raisedById
}

/** Both parties to a case, in a stable order — buyer first is not knowable here. */
const partiesOf = (dispute) => [dispute.raisedById, dispute.againstId].filter(Boolean)

/**
 * Writes one message onto a thread as part of a larger operation.
 *
 * The admin workflows below each post a message *and* move the case, which is
 * one intention rather than two — going through {@link disputeService.postMessage}
 * would fan out its own notifications and re-run guards the caller has already
 * made stricter. The message shape is identical, which is what matters.
 */
function writeThreadMessage({ disputeId, authorId, authorRole, body, internal = false, at }) {
  return disputeMessages.create({
    disputeId,
    authorId,
    authorRole: authorRole ?? ROLES.ADMIN,
    body,
    attachments: [],
    internal: internal === true,
    createdAt: at,
  })
}

/** A best-effort audit line: an unwritten entry must never undo what happened. */
async function auditQuietly(entry) {
  try {
    return await auditService.log(entry)
  } catch {
    return null
  }
}

export const disputeService = Object.freeze({
  /**
   * My disputes, or the case queue (admin).
   *
   * @param {import('./api/listAdapter').ListParams} [params] filters: `orderId`,
   *   `raisedById`, `againstId`, `assignedAdminId`, `status`, `category`,
   *   `createdAt_gte`/`createdAt_lte`; sorts: `createdAt`, `updatedAt`
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  list: (params = {}) => disputes.list({ sort: 'createdAt', order: SORT_ORDER.DESC, ...params }),

  /**
   * @param {string} id `dsp_…`
   * @returns {Promise<object>} the case
   * @throws {ApiError} `not_found`
   */
  getById: (id) => disputes.getById(id),

  /**
   * Every case a member is party to, on either side.
   *
   * MOCK-QUERY: `raisedById` and `againstId` are separate fields and JSON
   * Server has no `OR` across two of them, so this is two requests merged
   * client-side — which also makes the merged `total` approximate. Laravel does
   * it in one `where(raised_by_id, $id)->orWhere(against_id, $id)`.
   *
   * @param {string} userId `usr_…`
   * @param {import('./api/listAdapter').ListParams} [params] any filter above
   * @returns {Promise<import('./api/listAdapter').ListResult>} newest first
   */
  async listByUser(userId, params = {}) {
    const [raised, against] = await Promise.all([
      disputeService.list({ ...params, filters: { ...params.filters, raisedById: userId } }),
      disputeService.list({ ...params, filters: { ...params.filters, againstId: userId } }),
    ])

    const byId = new Map()
    raised.items.concat(against.items).forEach((dispute) => byId.set(dispute.id, dispute))
    const items = Array.from(byId.values()).sort(byCreatedAtDesc)

    return { items, total: items.length, page: raised.page, limit: raised.limit }
  },

  /**
   * The cases one member should see, resolved from their role — the single read
   * behind the shared disputes list on both dashboards (Prompt 26 §4.1).
   *
   * A buyer or a creator gets the cases they are party to; an admin gets the
   * queue. The signature is the same either way, which is what lets one page
   * component serve both dashboards.
   *
   * @param {string} userId `usr_…`
   * @param {object} [options]
   * @param {string} [options.role] the viewer's `ROLES` value
   * @param {import('./api/listAdapter').ListParams} [options.params] any filter above
   * @returns {Promise<import('./api/listAdapter').ListResult>} newest first
   */
  listForUser(userId, { role, ...params } = {}) {
    if (isAdminRole(role)) return disputeService.list(params)
    return disputeService.listByUser(userId, params)
  },

  /**
   * How many of a member's cases are waiting on **them** right now — the nav
   * badge (Prompt 26 §4.6).
   *
   * @param {string} userId `usr_…`
   * @param {string} role the viewer's `ROLES` value — decides which
   *   `awaiting_*` status counts as "yours"
   * @returns {Promise<number>}
   */
  async countAwaitingResponse(userId, role) {
    const status =
      role === ROLES.BUYER
        ? DISPUTE_STATUS.AWAITING_BUYER
        : role === ROLES.CREATOR
          ? DISPUTE_STATUS.AWAITING_CREATOR
          : null
    if (!userId || !status) return 0

    const { total } = await disputeService.listByUser(userId, {
      page: 1,
      limit: 100,
      filters: { status },
    })
    return total
  },

  /**
   * The case thread.
   *
   * **This is not access control.** Filtering `internal` on the client keeps
   * admin notes out of the UI, but JSON Server still puts them on the wire
   * (contract §6.17) — the single most important thing for the Laravel
   * developer to enforce server-side.
   *
   * @param {string} disputeId `dsp_…`
   * @param {object} [options]
   * @param {string} [options.viewerRole] the reader's `ROLES` value — an admin
   *   sees the internal notes, a party never does. Preferred over
   *   `includeInternal`, which predates it.
   * @param {boolean} [options.includeInternal=false] admin view — include internal notes
   * @returns {Promise<import('./api/listAdapter').ListResult>} oldest first
   */
  async listMessages(disputeId, { viewerRole, includeInternal = false, ...params } = {}) {
    const admin = viewerRole === undefined ? includeInternal : isAdminRole(viewerRole)

    const result = await disputeMessages.list({
      sort: 'createdAt',
      order: SORT_ORDER.ASC,
      limit: 100,
      ...params,
      filters: {
        ...params.filters,
        disputeId,
        ...(admin ? {} : { internal: false }),
      },
    })

    if (admin) return result
    // Filtered again defensively before anything renders.
    return { ...result, items: result.items.filter((message) => message.internal !== true) }
  },

  /**
   * The live case on one order, if there is one — what an order surface needs
   * to link a frozen order to the dispute that froze it (Prompt 26 §4.5).
   *
   * Falls back to the newest settled case when nothing is live, so a resolved
   * order still links to the decision that resolved it.
   *
   * @param {string} orderId `ord_…`
   * @returns {Promise<object|null>}
   */
  async findForOrder(orderId) {
    if (!orderId) return null

    const { items } = await disputeService.list({ page: 1, limit: 100, filters: { orderId } })
    return (
      items.find((entry) => ACTIVE_DISPUTE_STATUSES.includes(entry.status)) ?? items[0] ?? null
    )
  },

  /**
   * The newest message on each of several cases, keyed by dispute — what a list
   * of cases needs to say "the last word was theirs" (Prompt 26 §4.2).
   *
   * Internal notes are excluded for a party exactly as they are in
   * {@link disputeService.listMessages}: an admin note must not even show up as
   * "new activity" on a buyer's card.
   *
   * MOCK-JOIN: one request with the ids OR'd (contract §4.1) and the newest kept
   * per dispute, rather than one request per card. Laravel: a `latestOfMany`
   * relation on the dispute.
   *
   * @param {string[]} disputeIds `dsp_…`
   * @param {object} [options]
   * @param {string} [options.viewerRole] the reader's `ROLES` value
   * @returns {Promise<Map<string, object>>} `dsp_…` → its newest visible message
   */
  async latestMessages(disputeIds = [], { viewerRole } = {}) {
    const ids = [...new Set(disputeIds.filter(Boolean))]
    if (ids.length === 0) return new Map()

    const admin = isAdminRole(viewerRole)
    const { items } = await disputeMessages.list({
      page: 1,
      limit: 200,
      sort: 'createdAt',
      order: SORT_ORDER.DESC,
      filters: { disputeId: ids, ...(admin ? {} : { internal: false }) },
    })

    const latest = new Map()
    items
      .filter((message) => admin || message.internal !== true)
      .forEach((message) => {
        // Newest first, so the first one seen for a dispute is the one to keep.
        if (!latest.has(message.disputeId)) latest.set(message.disputeId, message)
      })
    return latest
  },

  /**
   * Posts a message on a case. `internal: true` is admin-only.
   *
   * @param {object} payload the new message
   * @returns {Promise<object>} the created message
   */
  createMessage: (payload) => disputeMessages.create(payload),

  /**
   * Opens a case. Moving the order to `disputed` and notifying everyone is
   * {@link disputeService.createDispute}, not this write.
   *
   * @param {object} payload the new case
   * @returns {Promise<object>} the created case
   */
  create: (payload) => disputes.create(payload),

  /**
   * Assigns, moves status, or closes a case (admin), following
   * `DISPUTE_STATUS_MACHINE`.
   *
   * @param {string} id `dsp_…`
   * @param {object} patch changed fields only
   * @returns {Promise<object>} the updated case
   */
  update: (id, patch) => disputes.update(id, patch),

  /* —— workflow operations —————————————————————————————————————————————— */

  /**
   * **Opens a dispute** — the moment an order stops being a conversation between
   * two people and becomes casework (contract §7 operation 22).
   *
   * The order freezes at `disputed` and the payment stays exactly where it is:
   * `held`. Nothing about the money moves here, by design — releasing or
   * refunding is a decision, and decisions are made by Trust & Safety in
   * `resolveDispute` (Prompt 33). Freezing the order is what makes that decision
   * possible: neither party can accept, deliver, or cancel underneath it.
   *
   * Eligibility follows `ORDER_STATUS_MACHINE` and nothing else — see
   * {@link DISPUTABLE_ORDER_STATUSES} for why a completed order is not on the
   * list. One open case per order: a second one would give two admins the same
   * argument to decide.
   *
   * MOCK-ATOMICITY: uploads plus two writes and a fan-out of notifications, with
   * no transaction around them (contract §7). They run dispute → order → bells,
   * so an interruption leaves a case nobody has been told about rather than a
   * frozen order with no case behind it.
   *
   * SECURITY: the party check is UX only (00 §11). Laravel derives the actor
   * from the session and scopes the operation to orders they are party to.
   *
   * @param {string} orderId `ord_…`
   * @param {object} options
   * @param {string} options.raisedById the acting party, `usr_…`
   * @param {string} options.category a `DISPUTE_CATEGORY` value
   * @param {string} options.description what went wrong, 60–2000 characters
   * @param {(File|object)[]} [options.evidenceFiles] real `File`s to upload, or
   *   file objects already returned by `uploadService` (§5.1) — up to five
   * @returns {Promise<{dispute: object, order: object}>} the case and the frozen order
   * @throws {ApiError} `validation_failed` (short description, unknown category,
   *   too many files, a rejected file type or size) · `forbidden` (not a party) ·
   *   `conflict` (order not disputable, or a case already open) · `not_found`
   *
   * **Future endpoint:** `POST /disputes` → `{ dispute, order }`, one
   * transaction with the actor taken from the bearer token and a partial unique
   * index enforcing one live case per order.
   */
  async createDispute(orderId, { raisedById, category, description, evidenceFiles } = {}) {
    const order = await orderService.getById(orderId)

    const isParty = raisedById === order.buyerId || raisedById === order.creatorId
    if (!isParty) {
      throw createApiError(
        API_ERROR_CODE.FORBIDDEN,
        'Only the buyer or the creator on an order can raise a dispute on it.'
      )
    }
    if (!DISPUTABLE_ORDER_STATUSES.includes(order.status)) {
      throw invalidState(
        'This order is not one a dispute can be raised on. Reload the page to see where it got to.',
        { from: order.status, to: ORDER_STATUS.DISPUTED }
      )
    }
    if (!Object.values(DISPUTE_CATEGORY).includes(category)) {
      throw createApiError(API_ERROR_CODE.VALIDATION_FAILED, 'Choose what this is about.', {
        category: 'Choose a category.',
      })
    }

    // MOCK-GUARD: a read-before-write, so two tabs opening at once can both pass
    // it. Laravel makes it a partial unique index on `(order_id)` where the
    // status is live.
    const { items: existing } = await disputeService.list({
      page: 1,
      limit: 100,
      filters: { orderId },
    })
    if (existing.some((entry) => ACTIVE_DISPUTE_STATUSES.includes(entry.status))) {
      throw invalidState(
        'A dispute is already open on this order. Open it to add anything further.',
        { orderId }
      )
    }

    // Both validations run before anything is uploaded or written, so a rejected
    // description never costs the member a wait on files.
    const statement = assertDescription(description)
    const disputedStatus = transitionTo(
      ORDER_STATUS_MACHINE,
      order.status,
      ORDER_STATUS.DISPUTED,
      'This order can no longer be disputed.'
    )
    const evidence = await resolveEvidence(evidenceFiles, {
      max: MAX_EVIDENCE_FILES,
      field: 'evidence',
    })

    const againstId = raisedById === order.buyerId ? order.creatorId : order.buyerId
    const at = nowIso()

    const dispute = await disputes.create({
      orderId: order.id,
      raisedById,
      againstId,
      category,
      description: statement,
      evidence,
      status: DISPUTE_STATUS.OPEN,
      assignedAdminId: null,
      resolution: null,
      createdAt: at,
      updatedAt: at,
    })

    const frozen = await orderService.update(order.id, { status: disputedStatus })

    await notifyQuietly({
      userId: againstId,
      type: NOTIFICATION_TYPE.DISPUTE_OPENED,
      title: 'A dispute was opened on your order',
      body:
        `“${order.title}” is on hold while our team reviews it. ` +
        'Open the dispute to give your side — your response is part of the decision.',
      entityType: 'dispute',
      entityId: dispute.id,
    })

    // The queue only works if somebody is told there is something in it.
    await notificationService.notifyAdmins(PERMISSIONS.DISPUTES_RESOLVE, {
      type: NOTIFICATION_TYPE.DISPUTE_OPENED,
      title: 'New dispute to triage',
      body: `A ${category.replace(/_/g, ' ')} dispute was opened on “${order.title}”.`,
      entityType: 'dispute',
      entityId: dispute.id,
    })

    // Sensitive action: a frozen order and held money have to be accountable
    // (00 §14). Best effort — the case is the record that matters.
    try {
      await auditService.log({
        actorId: raisedById,
        actorRole: raisedById === order.buyerId ? ROLES.BUYER : ROLES.CREATOR,
        action: AUDIT_ACTION.DISPUTE_OPEN,
        entityType: 'dispute',
        entityId: dispute.id,
        meta: { orderId: order.id, category, fromStatus: order.status, toStatus: disputedStatus },
      })
    } catch {
      // Swallowed: an unlogged dispute is a gap in the trail, an unopened one
      // is a member with nowhere to go.
    }

    return { dispute, order: frozen }
  },

  /**
   * **Posts a message on a case** and moves it along (contract §7 operation 23).
   *
   * The status ping-pong is the whole point: a case parked at `awaiting_buyer`
   * goes back to `under_review` the moment the buyer answers, so the queue sorts
   * itself and neither party has to wonder whether their reply landed. A message
   * from the side that is *not* being waited on changes nothing — answering out
   * of turn is allowed, it just does not clear the other party's ball.
   *
   * A settled case takes no more messages. The composer says so rather than
   * offering a field that fails on submit.
   *
   * SECURITY: `internal` is admin-only and the check here is UX only (00 §11).
   * Laravel must refuse `internal: true` from a non-admin and must never return
   * an internal note to a party (§6.17).
   *
   * @param {string} disputeId `dsp_…`
   * @param {object} options
   * @param {string} options.authorId the writer, `usr_…`
   * @param {string} options.body the message, 2–2000 characters
   * @param {(File|object)[]} [options.attachments] up to three files
   * @param {string} [options.authorRole] the writer's `ROLES` value — defaults to
   *   the side of the case they are on
   * @param {boolean} [options.internal=false] admin-only note, never shown to a party
   * @returns {Promise<{message: object, dispute: object}>} the message and the
   *   case as it now stands
   * @throws {ApiError} `validation_failed` · `forbidden` (not a party, or a
   *   non-admin sending `internal`) · `conflict` (the case is settled) · `not_found`
   *
   * **Future endpoint:** `POST /disputes/:id/messages` → `{ message, dispute }`,
   * one transaction with the author and their role taken from the session.
   */
  async postMessage(disputeId, { authorId, body, attachments, authorRole, internal = false } = {}) {
    const dispute = await disputes.getById(disputeId)

    const isAdmin = isAdminRole(authorRole)
    const isParty = authorId === dispute.raisedById || authorId === dispute.againstId
    if (!isParty && !isAdmin) {
      throw createApiError(
        API_ERROR_CODE.FORBIDDEN,
        'Only the parties to this dispute and the BetterBlue team can post on it.'
      )
    }
    if (internal && !isAdmin) {
      throw createApiError(API_ERROR_CODE.FORBIDDEN, 'Only the BetterBlue team can add an internal note.')
    }
    if (SETTLED_DISPUTE_STATUSES.includes(dispute.status)) {
      throw invalidState(
        'This dispute has been decided, so the thread is closed. Contact support if something is still outstanding.',
        { status: dispute.status }
      )
    }

    const text = assertBody(body)
    const files = await resolveEvidence(attachments, {
      max: MAX_MESSAGE_ATTACHMENTS,
      field: 'attachments',
    })

    const order = await orderService.getById(dispute.orderId).catch(() => null)
    const role =
      authorRole ??
      (order && authorId === order.buyerId
        ? ROLES.BUYER
        : order && authorId === order.creatorId
          ? ROLES.CREATOR
          : ROLES.ADMIN)

    const at = nowIso()

    const message = await disputeMessages.create({
      disputeId: dispute.id,
      authorId,
      authorRole: role,
      body: text,
      attachments: files,
      internal: internal === true,
      createdAt: at,
    })

    // The ball moves back to the team when the side being waited on answers.
    const clears = !isAdmin && isAwaitingRole(dispute, role)
    const nextStatus = clears
      ? transitionTo(
          DISPUTE_STATUS_MACHINE,
          dispute.status,
          DISPUTE_STATUS.UNDER_REVIEW,
          'This dispute has moved on. Reload the page to see where it got to.'
        )
      : dispute.status

    const updated = await disputes.update(dispute.id, {
      ...(clears ? { status: nextStatus } : {}),
      updatedAt: at,
    })

    // An internal note is for the team only — telling a party one was written
    // would leak the fact of it, which is half the content.
    if (!internal) {
      const recipients = new Set()
      if (isAdmin) {
        recipients.add(dispute.raisedById)
        recipients.add(dispute.againstId)
      } else {
        recipients.add(counterpartOf(dispute, authorId))
        if (dispute.assignedAdminId) recipients.add(dispute.assignedAdminId)
      }
      recipients.delete(authorId)

      // Sequential, not parallel: JSON Server rewrites `db.json` on every write
      // and drops one of two concurrent POSTs (see `notifyAdmins`).
      for (const userId of recipients) {
        // eslint-disable-next-line no-await-in-loop -- see above.
        await notifyQuietly({
          userId,
          type: NOTIFICATION_TYPE.DISPUTE_MESSAGE,
          title: 'New message on a dispute',
          body: isAdmin
            ? 'The BetterBlue team replied on a dispute you are part of.'
            : `There is a new message on the dispute for “${order?.title ?? 'an order'}”.`,
          entityType: 'dispute',
          entityId: dispute.id,
        })
      }
    }

    return { message, dispute: updated }
  },

  /* —— admin reads (Prompt 33) ————————————————————————————————————————— */

  /**
   * **A page of the case queue, ready to render** (contract §7 operation 36).
   *
   * A queue row carries things a dispute record does not: the order it froze,
   * the money still held on it, both parties, and whoever picked it up. Four
   * batched reads rather than four per row.
   *
   * MOCK-JOIN: 00 §10 bans `_expand`, so the ids come back from the list and
   * the rest is fetched with them OR'd together (contract §4.1). Every join
   * fails **open** — a row missing its order title is still a row, and an admin
   * who cannot see the queue at all cannot work it.
   *
   * @param {import('./api/listAdapter').ListParams} [params] anything
   *   {@link disputeService.list} takes
   * @returns {Promise<import('./api/listAdapter').ListResult>} items are the
   *   dispute plus `order`, `payment`, `buyer`, `creator`, `assignee`
   *
   * **Future endpoint:** `GET /admin/disputes` — one query with four eager
   * loads, gated on `disputes.resolve`.
   */
  async adminListQueue(params = {}) {
    const page = await disputeService.list(params)
    if (page.items.length === 0) return page

    const orderIds = [...new Set(page.items.map((entry) => entry.orderId).filter(Boolean))]
    const personIds = [
      ...new Set(
        page.items
          .flatMap((entry) => [entry.raisedById, entry.againstId, entry.assignedAdminId])
          .filter(Boolean)
      ),
    ]

    const [orders, people, payments] = await Promise.all([
      orderService.listByIds(orderIds).catch(() => new Map()),
      userService
        .listByIds(personIds)
        .then((accounts) => new Map(accounts.map((account) => [account.id, account])))
        .catch(() => new Map()),
      orderIds.length > 0
        ? paymentService
            .list({ page: 1, limit: QUEUE_JOIN_LIMIT, filters: { orderId: orderIds } })
            .catch(() => ({ items: [] }))
        : { items: [] },
    ])

    // An order can carry more than one payment row — a declined attempt and
    // then the one that settled — so the escrow is read from the `held` row
    // rather than from whichever came back first (`docs/payments.md` §5).
    const heldByOrder = new Map()
    payments.items.forEach((payment) => {
      if (payment.status === PAYMENT_STATUS.HELD) heldByOrder.set(payment.orderId, payment)
    })

    const items = page.items.map((entry) => {
      const order = orders.get(entry.orderId) ?? null
      const raisedBy = people.get(entry.raisedById) ?? null
      const against = people.get(entry.againstId) ?? null

      return {
        ...entry,
        order,
        payment: heldByOrder.get(entry.orderId) ?? null,
        raisedBy,
        against,
        // Buyer and creator come off the *order*, which is the only record that
        // knows which side of the engagement each party is on.
        buyer: order ? (order.buyerId === entry.raisedById ? raisedBy : against) : null,
        creator: order ? (order.creatorId === entry.raisedById ? raisedBy : against) : null,
        assignee: entry.assignedAdminId ? (people.get(entry.assignedAdminId) ?? null) : null,
      }
    })

    return { ...page, items }
  },

  /**
   * **The number beside each queue tab** (contract §7 operation 37).
   *
   * Five count queries, each fetched one row deep and read for its `total` —
   * the trick `notificationService.unreadCount` and `userService`'s aggregates
   * use. A count that fails resolves to `null` rather than `0`, because "no
   * cases" and "we could not count the cases" are different sentences and a
   * tab must not claim the first when it means the second (§13).
   *
   * @param {object} [options]
   * @param {string} [options.adminId] whose "Mine" tab this is — omitted, the
   *   figure comes back `null` rather than counting everybody's
   * @returns {Promise<{unassigned: number|null, mine: number|null,
   *   awaiting: number|null, escalated: number|null, settled: number|null}>}
   *
   * **Future endpoint:** part of `GET /admin/disputes/summary` — one grouped
   * count rather than five.
   */
  async getQueueCounts({ adminId } = {}) {
    const count = (filters) =>
      disputeService
        .list({ page: 1, limit: 1, filters })
        .then((result) => result.total)
        .catch(() => null)

    const [unassigned, mine, awaiting, escalated, settled] = await Promise.all([
      count({ status: DISPUTE_STATUS.OPEN }),
      adminId
        ? count({ assignedAdminId: adminId, status: [...ACTIVE_DISPUTE_STATUSES] })
        : Promise.resolve(null),
      count({ status: [DISPUTE_STATUS.AWAITING_BUYER, DISPUTE_STATUS.AWAITING_CREATOR] }),
      count({ status: DISPUTE_STATUS.ESCALATED }),
      count({ status: [...SETTLED_DISPUTE_STATUSES] }),
    ])

    return { unassigned, mine, awaiting, escalated, settled }
  },

  /**
   * **A case's history**, folded from what actually happened to it: the record's
   * own milestones and the audit entries every admin action on it wrote.
   *
   * There is no `disputeEvents` collection and there should not be one — the
   * trail already exists (`auditLogs`, contract §6.26), and a second copy of it
   * would be a second thing to keep in step. This is the same reasoning behind
   * `orderService.listAdminNotes`.
   *
   * **Admin-only.** Audit entries carry internal notes in their meta, so this
   * never reaches a party surface — Prompt 26's screens read the thread instead.
   *
   * @param {string} disputeId `dsp_…`
   * @param {object} [dispute] the case, when the caller already has it
   * @returns {Promise<object[]>} `TimelineList` items, oldest first
   */
  async getDisputeTimeline(disputeId, dispute) {
    const record = dispute ?? (await disputes.getById(disputeId))

    const { items: entries } = await auditService
      .list({
        page: 1,
        limit: QUEUE_JOIN_LIMIT,
        sort: 'createdAt',
        order: SORT_ORDER.ASC,
        filters: { entityType: 'dispute', entityId: record.id },
      })
      .catch(() => ({ items: [] }))

    const timeline = entries.map((entry) => {
      const style = DISPUTE_EVENT_STYLE[entry.action] ?? DISPUTE_EVENT_STYLE.default
      return {
        id: entry.id,
        at: entry.createdAt,
        actorId: entry.actorId,
        action: entry.action,
        internal: style.internal === true,
        title: style.title(entry.meta ?? {}),
        description: style.description?.(entry.meta ?? {}) ?? '',
        icon: style.icon,
        tone: style.tone,
      }
    })

    // The opening is on the record itself whether or not an audit line survived
    // for it, so a case always has a beginning on screen.
    if (!timeline.some((entry) => entry.action === AUDIT_ACTION.DISPUTE_OPEN)) {
      const opening = DISPUTE_EVENT_STYLE[AUDIT_ACTION.DISPUTE_OPEN]
      timeline.unshift({
        id: `${record.id}-opened`,
        at: record.createdAt,
        actorId: record.raisedById,
        action: AUDIT_ACTION.DISPUTE_OPEN,
        internal: false,
        title: opening.title({ category: record.category }),
        description: '',
        icon: opening.icon,
        tone: opening.tone,
      })
    }

    return timeline.sort((a, b) => String(a.at).localeCompare(String(b.at)))
  },

  /**
   * **Everything the admin workspace shows, in one call** (contract §7
   * operation 38) — the case, the order and its money, both parties with the
   * history that makes them readable, whoever is on it, and the timeline.
   *
   * The shape mirrors `orderService.getAdminOrderContext`: one composite read
   * per admin detail screen, every aggregate its own failure boundary, and no
   * component left holding a query.
   *
   * MOCK-AGGREGATE: up to a dozen reads fanned out client-side, most of them in
   * parallel. Laravel answers the whole thing with one query and four joins.
   *
   * @param {string} disputeId `dsp_…`
   * @returns {Promise<object>} `{ dispute, order, payment, transactions, buyer,
   *   creator, assignee, parties, priorBetweenParties, timeline }`
   * @throws {ApiError} `not_found` — the case itself is the payload
   *
   * **Future endpoint:** `GET /admin/disputes/:id`, gated on `disputes.resolve`.
   */
  async getAdminCaseContext(disputeId) {
    const dispute = await disputes.getById(disputeId)
    const order = await orderService.getById(dispute.orderId).catch(() => null)

    const personIds = [
      dispute.raisedById,
      dispute.againstId,
      dispute.assignedAdminId,
      dispute.resolution?.resolvedById,
    ].filter(Boolean)

    const [people, payment, transactions, timeline, raisedByCases, againstCases] =
      await Promise.all([
        userService
          .listByIds(personIds)
          .then((accounts) => new Map(accounts.map((account) => [account.id, account])))
          .catch(() => new Map()),
        paymentService.getByOrderId(dispute.orderId).catch(() => null),
        paymentService
          .listTransactions({ page: 1, limit: QUEUE_JOIN_LIMIT, filters: { orderId: dispute.orderId } })
          .then((result) => result.items)
          .catch(() => []),
        disputeService.getDisputeTimeline(dispute.id, dispute).catch(() => []),
        disputeService
          .listByUser(dispute.raisedById, { page: 1, limit: QUEUE_JOIN_LIMIT })
          .catch(() => null),
        disputeService
          .listByUser(dispute.againstId, { page: 1, limit: QUEUE_JOIN_LIMIT })
          .catch(() => null),
      ])

    // Cases these two have had **with each other** before this one — the single
    // most useful thing on the rail, and the reason both lists are fetched
    // rather than two counts (§4.3).
    const priorBetweenParties =
      raisedByCases === null
        ? null
        : raisedByCases.items.filter(
            (entry) =>
              entry.id !== dispute.id &&
              (entry.raisedById === dispute.againstId || entry.againstId === dispute.againstId)
          )

    const partyFor = (userId, cases) => {
      if (!userId) return null
      return {
        user: people.get(userId) ?? null,
        // `null` rather than `0` on failure, and rendered as "—": a party with
        // no history and a party whose history did not load are not the same.
        disputeCount: cases === null ? null : cases.total,
        side: order ? (order.buyerId === userId ? ROLES.BUYER : ROLES.CREATOR) : null,
      }
    }

    const raisedBy = partyFor(dispute.raisedById, raisedByCases)
    const against = partyFor(dispute.againstId, againstCases)

    const buyer = order && order.buyerId === dispute.raisedById ? raisedBy : against
    const creator = order && order.creatorId === dispute.raisedById ? raisedBy : against

    const [buyerOrders, creatorOrders] = await Promise.all([
      order
        ? orderService
            .list({ page: 1, limit: 1, filters: { buyerId: order.buyerId } })
            .then((result) => result.total)
            .catch(() => null)
        : null,
      order
        ? orderService
            .list({ page: 1, limit: 1, filters: { creatorId: order.creatorId } })
            .then((result) => result.total)
            .catch(() => null)
        : null,
    ])

    return {
      dispute,
      order,
      payment,
      transactions,
      raisedBy,
      against,
      buyer: buyer ? { ...buyer, ordersCount: buyerOrders } : null,
      creator: creator ? { ...creator, ordersCount: creatorOrders } : null,
      assignee: dispute.assignedAdminId ? (people.get(dispute.assignedAdminId) ?? null) : null,
      resolvedBy: dispute.resolution?.resolvedById
        ? (people.get(dispute.resolution.resolvedById) ?? null)
        : null,
      priorBetweenParties,
      timeline,
    }
  },

  /* —— admin workflow operations (Prompt 33) ——————————————————————————— */

  /**
   * **Picks a case up** (contract §7 operation 39).
   *
   * Triage is one write and one status move: a case somebody owns is a case
   * somebody is reading, which is the whole difference between `open` and
   * `under_review`. Reassignment to another reviewer runs through here too and
   * leaves the status alone — the case was already being read, just by
   * somebody else.
   *
   * SECURITY: the permission check is UX only (00 §11). Laravel scopes this to
   * `disputes.resolve` and takes the actor from the session.
   *
   * @param {string} disputeId `dsp_…`
   * @param {object} options
   * @param {string} options.adminId the reviewer taking it, `usr_…`
   * @param {{id: string, role: string}} [options.actor] who performed the
   *   assignment — defaults to the assignee (picking a case up yourself)
   * @returns {Promise<object>} the updated case
   * @throws {ApiError} `validation_failed` (no assignee) · `conflict` (the case
   *   is already decided) · `not_found`
   *
   * **Future endpoint:** `PATCH /disputes/:id` → the case, one transaction with
   * the audit entry.
   */
  async assign(disputeId, { adminId, actor } = {}) {
    const dispute = await disputes.getById(disputeId)

    if (!adminId) {
      throw createApiError(API_ERROR_CODE.VALIDATION_FAILED, 'Choose who is taking this case.', {
        adminId: 'An assignee is required.',
      })
    }
    if (!canAssignDispute(dispute)) {
      throw invalidState(
        'This dispute has been decided, so it can no longer be assigned. Reload the page to see where it got to.',
        { status: dispute.status }
      )
    }

    // Only an untriaged case moves: reassigning one already under review, or
    // parked on a party, must not quietly clear the ball it is waiting on.
    const opening = dispute.status === DISPUTE_STATUS.OPEN
    const at = nowIso()

    const updated = await disputes.update(dispute.id, {
      assignedAdminId: adminId,
      ...(opening
        ? {
            status: transitionTo(
              DISPUTE_STATUS_MACHINE,
              dispute.status,
              DISPUTE_STATUS.UNDER_REVIEW,
              'This dispute has moved on. Reload the page to see where it got to.'
            ),
          }
        : {}),
      updatedAt: at,
    })

    await auditQuietly({
      actorId: actor?.id ?? adminId,
      actorRole: actor?.role ?? ROLES.ADMIN,
      action: AUDIT_ACTION.DISPUTE_ASSIGN,
      entityType: 'dispute',
      entityId: dispute.id,
      meta: {
        orderId: dispute.orderId,
        assignedAdminId: adminId,
        previousAdminId: dispute.assignedAdminId ?? null,
        fromStatus: dispute.status,
        toStatus: updated.status,
      },
    })

    return updated
  },

  /**
   * **Asks one party for something** (contract §7 operation 40).
   *
   * The message is public, because a request made in private is a request the
   * other side cannot see was made — and in casework that is how a decision
   * stops looking impartial. The status change is what makes it a request
   * rather than a remark: the case parks on that party, their nav badge lights
   * up, and Prompt 26's banner tells them the review is waiting on them. Their
   * reply moves it straight back to `under_review` (operation 23).
   *
   * @param {string} disputeId `dsp_…`
   * @param {object} options
   * @param {string} options.from `ROLES.BUYER` or `ROLES.CREATOR`
   * @param {string} options.message what is being asked, 2–2000 characters
   * @param {{id: string, role: string}} options.actor the reviewer asking
   * @returns {Promise<{dispute: object, message: object}>}
   * @throws {ApiError} `validation_failed` (unknown party, empty message) ·
   *   `conflict` (the case cannot park on that party from where it is) ·
   *   `not_found`
   *
   * **Future endpoint:** `POST /disputes/:id/request-info` →
   * `{ dispute, message }`, one transaction covering the message, the status,
   * and the notification.
   */
  async requestInfo(disputeId, { from, message, actor } = {}) {
    const dispute = await disputes.getById(disputeId)

    if (!INFO_REQUEST_ROLES.includes(from)) {
      throw createApiError(API_ERROR_CODE.VALIDATION_FAILED, 'Choose who to ask.', {
        from: 'Choose the buyer or the creator.',
      })
    }

    const text = assertBody(message)
    const nextStatus = transitionTo(
      DISPUTE_STATUS_MACHINE,
      dispute.status,
      awaitingStatusFor(from),
      'This dispute cannot be put back to a party from where it is. Reload the page to see where it got to.'
    )

    const order = await orderService.getById(dispute.orderId).catch(() => null)
    const recipientId = from === ROLES.BUYER ? order?.buyerId : order?.creatorId
    const at = nowIso()

    const posted = await writeThreadMessage({
      disputeId: dispute.id,
      authorId: actor?.id,
      authorRole: actor?.role,
      body: text,
      at,
    })

    const updated = await disputes.update(dispute.id, { status: nextStatus, updatedAt: at })

    // Only the party being asked. The other side reads the request on the
    // thread, where it belongs — a bell item saying "we asked them something"
    // is noise on a case they cannot act on.
    if (recipientId) {
      await notifyQuietly({
        userId: recipientId,
        type: NOTIFICATION_TYPE.DISPUTE_MESSAGE,
        title: 'Our team needs something from you',
        body:
          `We have asked you for more information on the dispute for “${order?.title ?? 'an order'}”. ` +
          'The review continues as soon as you reply.',
        entityType: 'dispute',
        entityId: dispute.id,
      })
    }

    await auditQuietly({
      actorId: actor?.id,
      actorRole: actor?.role ?? ROLES.ADMIN,
      action: AUDIT_ACTION.DISPUTE_REQUEST_INFO,
      entityType: 'dispute',
      entityId: dispute.id,
      meta: { orderId: dispute.orderId, from, fromStatus: dispute.status, toStatus: nextStatus },
    })

    return { dispute: updated, message: posted }
  },

  /**
   * **Hands a case to a senior reviewer** (contract §7 operation 41).
   *
   * The note is internal, and that is the point: escalation is a conversation
   * between reviewers about a decision neither party should be pre-empting.
   * Both parties still see the status — Prompt 26's banner tells them it is
   * with a senior reviewer and will take a little longer — and neither sees a
   * word of why.
   *
   * @param {string} disputeId `dsp_…`
   * @param {object} options
   * @param {string} options.note why it is being escalated, 2–2000 characters,
   *   admin-only
   * @param {{id: string, role: string}} options.actor the reviewer escalating
   * @returns {Promise<{dispute: object, message: object}>}
   * @throws {ApiError} `validation_failed` · `conflict` (only a case under
   *   review can be escalated) · `not_found`
   *
   * **Future endpoint:** `POST /disputes/:id/escalate` → `{ dispute }`, one
   * transaction covering the note, the status, and the team fan-out.
   */
  async escalate(disputeId, { note, actor } = {}) {
    const dispute = await disputes.getById(disputeId)

    const text = assertBody(note)
    const nextStatus = transitionTo(
      DISPUTE_STATUS_MACHINE,
      dispute.status,
      DISPUTE_STATUS.ESCALATED,
      'This dispute cannot be escalated from where it is. Reload the page to see where it got to.'
    )

    const order = await orderService.getById(dispute.orderId).catch(() => null)
    const at = nowIso()

    const posted = await writeThreadMessage({
      disputeId: dispute.id,
      authorId: actor?.id,
      authorRole: actor?.role,
      body: text,
      internal: true,
      at,
    })

    const updated = await disputes.update(dispute.id, { status: nextStatus, updatedAt: at })

    // The queue only works if somebody is told there is something in it — the
    // same reason `createDispute` tells the team a case exists at all.
    await notificationService.notifyAdmins(PERMISSIONS.DISPUTES_RESOLVE, {
      type: NOTIFICATION_TYPE.DISPUTE_OPENED,
      title: 'A dispute has been escalated',
      body: `A ${String(dispute.category).replace(/_/g, ' ')} dispute on “${
        order?.title ?? 'an order'
      }” needs a senior review.`,
      entityType: 'dispute',
      entityId: dispute.id,
    })

    await auditQuietly({
      actorId: actor?.id,
      actorRole: actor?.role ?? ROLES.ADMIN,
      action: AUDIT_ACTION.DISPUTE_ESCALATE,
      entityType: 'dispute',
      entityId: dispute.id,
      meta: { orderId: dispute.orderId, fromStatus: dispute.status, toStatus: nextStatus, note: text },
    })

    return { dispute: updated, message: posted }
  },

  /**
   * **Issues a binding decision** — the operation the whole console exists for
   * (contract §7 operation 8).
   *
   * Three outcomes, and each one is a *different* ending for the order as well
   * as for the money (00 §9: `disputed → completed | refunded | cancelled`):
   *
   * | Outcome | Money | Order |
   * |---|---|---|
   * | `release_payment` | `releasePayment` — escrow to the creator, less commission | `completed` |
   * | `full_refund` | `refundPayment` for the whole held amount | `refunded` |
   * | `partial_refund` | `refundPayment` for part; the remainder settles in the same call | `completed` |
   *
   * **Why a partial refund completes the order.** It is the one outcome where
   * both sides got something: the buyer keeps deliverables and gets money back,
   * the creator is paid for what they did, and commission is charged only on
   * what they kept (`docs/payments.md` §6). `refunded` would say the engagement
   * never happened, and `cancelled` would say it was called off — neither is
   * true of work that was delivered, kept, and partly paid for.
   *
   * Ordering is the safest available: everything is validated, then the order's
   * own transition is checked **before** a cent moves, then the money moves,
   * then the case is written. A failure after the money moved throws a loud
   * `server_error` naming the step (§13) rather than leaving a settled order
   * behind an undecided case in silence.
   *
   * SECURITY: `disputes.resolve` is checked in the UI only (00 §11). This
   * moves somebody's money — Laravel must enforce the permission, re-derive
   * every amount from its own records (§9.3), and lock the order for the
   * duration.
   *
   * @param {string} disputeId `dsp_…`
   * @param {object} options
   * @param {string} options.outcome a `DISPUTE_RESOLUTION` value
   * @param {number} [options.amountRefunded] required for `partial_refund`,
   *   strictly between zero and the held amount; ignored otherwise
   * @param {string} options.note the reasoning, 30–1000 characters — both
   *   parties read it verbatim
   * @param {{id: string, role: string}} options.actor the deciding reviewer
   * @returns {Promise<{dispute: object, order: object, payment: object|null,
   *   settlement: object}>}
   * @throws {ApiError} `validation_failed` (unknown outcome, short note, a
   *   partial amount outside the escrow) · `conflict` (the case is not one a
   *   decision can be issued on, is untriaged, or the order/payment moved
   *   underneath the screen) · `server_error` when the sequence broke after the
   *   money moved · `not_found`
   *
   * **Future endpoint:** `POST /disputes/:id/resolve` →
   * `{ dispute, order, payment }`, one transaction covering the refund, the
   * release, the commission, the ledger, the case, the audit entry, and both
   * notifications.
   */
  async resolve(disputeId, { outcome, amountRefunded, note, actor } = {}) {
    const dispute = await disputes.getById(disputeId)

    /* -- guards, before anything is written -------------------------------- */

    if (!Object.values(DISPUTE_RESOLUTION).includes(outcome)) {
      throw createApiError(API_ERROR_CODE.VALIDATION_FAILED, 'Choose an outcome.', {
        outcome: 'Choose one of the three outcomes.',
      })
    }
    if (!RESOLVABLE_DISPUTE_STATUSES.includes(dispute.status)) {
      throw invalidState(
        'A decision cannot be issued on this dispute from where it is. Reload the page to see where it got to.',
        { from: dispute.status, to: DISPUTE_STATUS.RESOLVED }
      )
    }
    if (!canResolveDispute(dispute)) {
      throw invalidState(
        'This dispute has not been picked up yet. Assign it to yourself before deciding it.',
        { status: dispute.status, assignedAdminId: dispute.assignedAdminId ?? null }
      )
    }

    const reasoning = assertResolutionNote(note)
    const order = await orderService.getById(dispute.orderId)

    // What the order becomes. Checked here so an impossible ending is refused
    // before the escrow is touched rather than after.
    const orderTarget =
      outcome === DISPUTE_RESOLUTION.FULL_REFUND ? ORDER_STATUS.REFUNDED : ORDER_STATUS.COMPLETED
    const orderStatus = transitionTo(
      ORDER_STATUS_MACHINE,
      order.status,
      orderTarget,
      'This order has already moved on, so this decision can no longer be applied. Reload the page to see where it got to.'
    )

    // The escrow as it stands, priced through the payment layer — the same
    // rate and the same rounding the settlement itself will use (§7).
    const preview = await paymentService.previewSettlement(order.id, {
      refundAll: outcome === DISPUTE_RESOLUTION.FULL_REFUND,
      refundAmount: outcome === DISPUTE_RESOLUTION.PARTIAL_REFUND ? amountRefunded : 0,
    })

    if (preview.payment?.status !== PAYMENT_STATUS.HELD || preview.held <= 0) {
      throw invalidState(
        'There is no payment held on this order, so a decision here would move nothing. Check the order before deciding.',
        { orderId: order.id, expected: PAYMENT_STATUS.HELD, status: preview.payment?.status ?? null }
      )
    }

    const requested = Number(amountRefunded)
    if (outcome === DISPUTE_RESOLUTION.PARTIAL_REFUND) {
      // Strictly inside the escrow: nothing back is a release and everything
      // back is a full refund, and both of those are a different decision with
      // a different ending for the order.
      if (!Number.isFinite(requested) || requested <= 0 || requested >= preview.held) {
        throw createApiError(
          API_ERROR_CODE.VALIDATION_FAILED,
          'That refund amount is not valid for this order.',
          {
            amountRefunded:
              `Enter an amount above ${formatCurrency(0, preview.currency)} and below the ` +
              `${formatCurrency(preview.held, preview.currency)} held on this order. ` +
              'Returning the whole escrow is a full refund.',
          },
          422
        )
      }
    }

    /* -- the money, through the payment layer and nowhere else -------------- */

    const refundReason = 'This was the outcome of the dispute raised on it.'
    let settledOrder = null
    let payment = null

    if (outcome === DISPUTE_RESOLUTION.RELEASE_PAYMENT) {
      // `completeOrder` releases the escrow and ends the order in one call —
      // the same path a buyer accepting a delivery takes (§7.2 operation 6a).
      const completion = await orderService.completeOrder(order.id, {
        release: true,
        reason: 'dispute_resolved',
        actor,
      })
      settledOrder = completion.order
      payment = completion.payment
    } else {
      const isFull = outcome === DISPUTE_RESOLUTION.FULL_REFUND

      payment = await paymentService.refundPayment(order.id, {
        // A full refund sends no amount: the service returns the whole held
        // sum, which cannot drift from a figure computed on a screen.
        ...(isFull ? {} : { amount: preview.refundedAmount }),
        reason: refundReason,
        context: REFUND_CONTEXT.DISPUTE,
        actor,
      })

      try {
        settledOrder = isFull
          ? // `refunded`, not `cancelled`: the engagement happened and the money
            // went back. `cancelledAt` is the order's one "this ended here"
            // timestamp (contract §6.9), so it carries the moment.
            await orderService.update(order.id, { status: orderStatus, cancelledAt: nowIso() })
          : // A partial refund settled the remainder inside `refundPayment`, so
            // the order is completed **without** a second release.
            (
              await orderService.completeOrder(order.id, {
                release: false,
                reason: 'dispute_resolved',
                actor,
              })
            ).order
      } catch (failure) {
        throw inconsistency(
          'the order could not be closed out',
          { paymentId: payment?.id, refundedAmount: payment?.refundedAmount ?? null },
          failure
        )
      }
    }

    /* -- the case, the thread, the bells, the trail ------------------------- */

    const at = nowIso()
    const resolution = {
      outcome,
      // Omitted for a release, exactly as the seeds and contract §6.16 have it:
      // there is no refund to state.
      ...(outcome === DISPUTE_RESOLUTION.RELEASE_PAYMENT
        ? {}
        : { amountRefunded: payment?.refundedAmount ?? preview.refundedAmount }),
      note: reasoning,
      resolvedById: actor?.id ?? null,
      resolvedAt: at,
    }

    let resolved
    try {
      resolved = await disputes.update(dispute.id, {
        status: transitionTo(
          DISPUTE_STATUS_MACHINE,
          dispute.status,
          DISPUTE_STATUS.RESOLVED,
          'This dispute has moved on. Reload the page to see where it got to.'
        ),
        resolution,
        updatedAt: at,
      })
    } catch (failure) {
      throw inconsistency(
        'the decision could not be recorded on the case',
        { orderId: order.id, paymentId: payment?.id, outcome },
        failure
      )
    }

    const summary = resolutionSummary(outcome, {
      amountRefunded: resolution.amountRefunded,
      creatorEarnings: preview.creatorEarnings,
      currency: preview.currency,
    })

    // A real message from the reviewer rather than a synthetic system row: the
    // thread is the record of the case, and the decision is the last thing said
    // on it (§4.4). Both parties see it where they have been reading everything
    // else.
    const message = await writeThreadMessage({
      disputeId: dispute.id,
      authorId: actor?.id,
      authorRole: actor?.role,
      body: `BetterBlue resolved this dispute: ${summary}.\n\n${reasoning}`,
      at,
    }).catch(() => null)

    // Sequential: JSON Server drops one of two concurrent POSTs (see
    // `notifyAdmins`), and a party who is never told is a party who finds out
    // from their bank statement.
    for (const userId of partiesOf(dispute)) {
      // eslint-disable-next-line no-await-in-loop -- see above.
      await notifyQuietly({
        userId,
        type: NOTIFICATION_TYPE.DISPUTE_RESOLVED,
        title: 'Your dispute has been decided',
        body:
          `A decision has been issued on the dispute for “${order.title}”: ${summary}. ` +
          'The full reasoning is on the dispute.',
        entityType: 'dispute',
        entityId: dispute.id,
      })
    }

    await auditQuietly({
      actorId: actor?.id,
      actorRole: actor?.role ?? ROLES.ADMIN,
      action: AUDIT_ACTION.DISPUTE_RESOLVE,
      entityType: 'dispute',
      entityId: dispute.id,
      meta: {
        orderId: order.id,
        paymentId: payment?.id ?? null,
        outcome,
        amountRefunded: resolution.amountRefunded ?? 0,
        heldAmount: preview.held,
        settledAmount: preview.baseAmount,
        commissionRate: preview.rate,
        commissionAmount: preview.commissionAmount,
        creatorEarnings: preview.creatorEarnings,
        currency: preview.currency,
        fromStatus: dispute.status,
        toStatus: DISPUTE_STATUS.RESOLVED,
        orderFromStatus: order.status,
        orderToStatus: orderStatus,
        note: reasoning,
      },
    })

    return {
      dispute: resolved,
      order: settledOrder ?? order,
      payment,
      message,
      settlement: {
        held: preview.held,
        refundedAmount: resolution.amountRefunded ?? 0,
        baseAmount: preview.baseAmount,
        rate: preview.rate,
        commissionAmount: preview.commissionAmount,
        creatorEarnings: preview.creatorEarnings,
        currency: preview.currency,
      },
    }
  },

  /**
   * **Files a decided case away** (contract §7 operation 42).
   *
   * `resolved → closed`, and nothing else: the money moved when the decision
   * was issued, and closing is bookkeeping. It is separate from `resolve`
   * because the two are different facts — "we decided this" and "nobody came
   * back on it" — and collapsing them would file a case away before either
   * party had read the outcome.
   *
   * AUTO-CLOSE-HOOK: the natural extension is a scheduled job closing resolved
   * cases after N days, which is a server-side job and cannot live in a
   * browser. Until then this is the manual door, and Prompt 26's party screens
   * read `closed` exactly as they read `resolved`.
   *
   * @param {string} disputeId `dsp_…`
   * @param {object} [options]
   * @param {{id: string, role: string}} [options.actor] the reviewer closing it
   * @returns {Promise<object>} the closed case
   * @throws {ApiError} `conflict` (only a resolved case can be closed) · `not_found`
   *
   * **Future endpoint:** `PATCH /disputes/:id` → the case.
   */
  async close(disputeId, { actor } = {}) {
    const dispute = await disputes.getById(disputeId)

    const nextStatus = transitionTo(
      DISPUTE_STATUS_MACHINE,
      dispute.status,
      DISPUTE_STATUS.CLOSED,
      'Only a dispute that has been decided can be closed. Reload the page to see where it got to.'
    )

    const at = nowIso()
    const closed = await disputes.update(dispute.id, { status: nextStatus, updatedAt: at })

    await auditQuietly({
      actorId: actor?.id,
      actorRole: actor?.role ?? ROLES.ADMIN,
      action: AUDIT_ACTION.DISPUTE_CLOSE,
      entityType: 'dispute',
      entityId: dispute.id,
      meta: {
        orderId: dispute.orderId,
        outcome: dispute.resolution?.outcome ?? null,
        fromStatus: dispute.status,
        toStatus: nextStatus,
      },
    })

    return closed
  },
})

export default disputeService
