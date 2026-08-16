// Trust & Safety casework — `docs/api-contract.md` §6.16, §6.17.
//
// The two workflow operations at the bottom of this file are the party-facing
// half of a dispute: opening one, and talking on the thread. Resolving one —
// releasing, refunding, closing — is Prompt 33 and belongs to admins.

import { NOTIFICATION_TYPE } from '@/constants/notificationTypes'
import { PERMISSIONS } from '@/constants/permissions'
import { isAdminRole, ROLES } from '@/constants/roles'
import { DISPUTE_STATUS_MACHINE, ORDER_STATUS_MACHINE } from '@/constants/stateMachines'
import { DISPUTE_CATEGORY, DISPUTE_STATUS, ORDER_STATUS } from '@/constants/statuses'
import { ID_PREFIX } from '@/utils/id'
import { assertTransition } from '@/utils/stateMachine'

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

/** The other side of a case, from the perspective of `actorId`. */
function counterpartOf(dispute, actorId) {
  return dispute.raisedById === actorId ? dispute.againstId : dispute.raisedById
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
        action: 'dispute.open',
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

  // —— workflow operations (added by later prompts) ——
  // resolveDispute — Prompt 33 (admin disputes), contract §7 operation 8:
  // release, full refund, or partial refund plus the audit entry.
})

export default disputeService
