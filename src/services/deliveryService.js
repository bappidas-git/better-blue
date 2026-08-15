// Delivered versions — `docs/api-contract.md` §6.10.
//
// One record per delivered **version**: asking for changes closes that version
// at `revision_requested`, and the creator's next submission is a new record.

import { NOTIFICATION_TYPE } from '@/constants/notificationTypes'
import { DELIVERY_STATUS_MACHINE, ORDER_STATUS_MACHINE } from '@/constants/stateMachines'
import {
  CONTENT_STATUS,
  DELIVERY_STATUS,
  MODERATION_SUBJECT,
  ORDER_STATUS,
} from '@/constants/statuses'
import { ID_PREFIX } from '@/utils/id'
import { assertTransition } from '@/utils/stateMachine'

import { API_ERROR_CODE, createApiError } from './api/apiError'
import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'
import { moderationService } from './moderationService'
import { notificationService } from './notificationService'
import { revisionService } from './revisionService'
import { settingsService, SETTINGS_FALLBACK } from './settingsService'
import { uploadService, UPLOAD_PURPOSE, MAX_FILES_PER_UPLOAD } from './uploadService'
// CYCLE: `orderService` imports this module for its delivery reads, and
// `acceptDelivery` calls back into it to complete the order — the two halves of
// one intention that genuinely live in different files (contract §7 operation
// 6). Neither module touches the other at evaluation time; both dereference
// only inside function bodies, which is what makes the cycle harmless. Laravel
// collapses the pair into one controller and it disappears.
import { orderService } from './orderService'

const deliveries = createCrudService('deliveries', {
  idPrefix: ID_PREFIX.DELIVERY,
  // Deliveries are stamped `submittedAt`, not `createdAt` (contract §6.10).
  timestampField: 'submittedAt',
})

/** Latest version first (contract §6.10). */
const DEFAULT_SORT = 'version'

/** Order states a creator may hand work over from (contract §7 operation 5). */
const DELIVERABLE_ORDER_STATUSES = [ORDER_STATUS.IN_PROGRESS, ORDER_STATUS.REVISION_REQUESTED]

/** Shortest note worth sending with a delivery, matching the composer (Prompt 24 §4.4). */
export const DELIVERY_MESSAGE_MIN = 20

/** Cap, matching the contract's `deliveries.message` column. */
export const DELIVERY_MESSAGE_MAX = 600

const nowIso = () => new Date().toISOString()

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

/** A bell item must never fail a delivery that has already been accepted. */
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
 * Turns whatever the caller passed as `files` into contract file objects.
 *
 * Both shapes are accepted deliberately. The contract's sequence uploads inside
 * this operation (§7 operation 5 step 1), which is what a caller with a plain
 * `File[]` gets; the composer instead uploads file by file so it can show
 * per-file progress and retry one failure without losing the rest (Prompt 24
 * §13), and hands the finished records straight through.
 */
async function resolveFiles(files) {
  const list = Array.from(files ?? []).filter(Boolean)

  if (list.length === 0) {
    throw createApiError(API_ERROR_CODE.VALIDATION_FAILED, 'Attach the work you are delivering.', {
      files: 'Attach at least one file.',
    })
  }
  if (list.length > MAX_FILES_PER_UPLOAD) {
    throw createApiError(API_ERROR_CODE.VALIDATION_FAILED, 'Too many files at once.', {
      files: `Attach up to ${MAX_FILES_PER_UPLOAD} files in one version.`,
    })
  }
  if (list.every(isUploadedFile)) return list

  return uploadService.uploadFiles(list, { purpose: UPLOAD_PURPOSE.DELIVERY })
}

/** Validates the note that travels with a version (§13). */
function assertMessage(message) {
  const text = String(message ?? '').trim()

  if (text.length < DELIVERY_MESSAGE_MIN) {
    throw createApiError(
      API_ERROR_CODE.VALIDATION_FAILED,
      'Tell the buyer what you are handing over.',
      { message: `Use at least ${DELIVERY_MESSAGE_MIN} characters.` }
    )
  }
  if (text.length > DELIVERY_MESSAGE_MAX) {
    throw createApiError(API_ERROR_CODE.VALIDATION_FAILED, 'That note is too long.', {
      message: `Keep it under ${DELIVERY_MESSAGE_MAX} characters.`,
    })
  }

  return text
}

/**
 * Opens the delivery's moderation case (contract §7 operation 5 step 6).
 *
 * Every delivered version gets a record, and the platform's policy decides what
 * state it starts in: with `autoApproveDeliveries` on — the seeded default —
 * the case opens already `approved` with a system note saying why, so Trust &
 * Safety spot-checks a decided record rather than working a queue of everything
 * the marketplace produces. Turn the flag off and the same record opens at
 * `submitted`, which is exactly what `moderationService.listQueue` reads.
 *
 * Best effort on purpose: a delivery that reached the buyer must not be undone
 * because the review row failed to write.
 */
async function openModerationCase({ delivery, order, at }) {
  let autoApprove = SETTINGS_FALLBACK.moderation.autoApproveDeliveries
  try {
    const settings = await settingsService.getSettings()
    const configured = settings?.moderation?.autoApproveDeliveries
    if (configured !== undefined) autoApprove = Boolean(configured)
  } catch {
    // The bundled default stands in — see `SETTINGS_FALLBACK`.
  }

  const status = autoApprove ? CONTENT_STATUS.APPROVED : CONTENT_STATUS.SUBMITTED

  try {
    return await moderationService.create({
      subjectType: MODERATION_SUBJECT.DELIVERY,
      subjectId: delivery.id,
      creatorId: order.creatorId,
      status,
      history: [
        {
          at,
          byId: order.creatorId,
          fromStatus: CONTENT_STATUS.DRAFT,
          toStatus: CONTENT_STATUS.SUBMITTED,
          note: `Version ${delivery.version} submitted on order ${order.id}.`,
        },
        ...(autoApprove
          ? [
              {
                at,
                byId: null,
                fromStatus: CONTENT_STATUS.SUBMITTED,
                toStatus: CONTENT_STATUS.APPROVED,
                note: 'Auto-approved under the platform delivery policy. Open to spot review.',
              },
            ]
          : []),
      ],
      submittedAt: at,
      reviewedAt: autoApprove ? at : null,
    })
  } catch {
    return null
  }
}

export const deliveryService = Object.freeze({
  /**
   * @param {import('./api/listAdapter').ListParams} [params] filters: `orderId`,
   *   `status`; sorts: `version`, `submittedAt`
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  list: (params = {}) => deliveries.list({ sort: DEFAULT_SORT, order: SORT_ORDER.DESC, ...params }),

  /**
   * @param {string} id `dlv_…`
   * @returns {Promise<object>} the version
   * @throws {ApiError} `not_found`
   */
  getById: (id) => deliveries.getById(id),

  /**
   * Every version on one order, newest first — the delivery timeline.
   *
   * @param {string} orderId `ord_…`
   * @param {import('./api/listAdapter').ListParams} [params] any filter above
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  listByOrder(orderId, params = {}) {
    return deliveryService.list({
      ...params,
      filters: { ...params.filters, orderId },
    })
  },

  /**
   * Records a delivered version. `files` come from `uploadService` and are
   * stored inline (contract §5, §6.10).
   *
   * @param {object} payload the new version
   * @returns {Promise<object>} the created version
   */
  create: (payload) => deliveries.create(payload),

  /**
   * @param {string} id `dlv_…`
   * @param {object} patch changed fields only
   * @returns {Promise<object>} the updated version
   */
  update: (id, patch) => deliveries.update(id, patch),

  /* —— workflow operations —————————————————————————————————————————————— */

  /**
   * **Hands a version over to the buyer** — the creator's half of the order loop
   * (contract §7 operation 5).
   *
   * A delivery is a *version*, never an edit: answering a revision produces a
   * new record at `version = prior + 1` and the earlier one keeps whatever the
   * buyer did to it (00 §9). That is why the version number is computed from
   * what is already on the order rather than stored anywhere — and why, when the
   * submission answers a change request, `revisionId` links the two and the
   * revision is stamped `resolvedAt`: the buyer's notes and the work that
   * answered them stay attached to each other in both directions.
   *
   * Every version also enters the Trust & Safety pipeline. Whether it opens
   * decided or queued is `platformSettings.moderation.autoApproveDeliveries`
   * (contract §7 operation 5, `docs/data-model.md` §5 `platformSettings`);
   * either way there is a record, so a delivery is never content nobody can
   * account for.
   *
   * MOCK-ATOMICITY: uploads plus five writes with no transaction around them
   * (contract §7). They run delivery → order → revision → moderation → bell, so
   * an interruption leaves work that is recorded but not yet announced rather
   * than an order marked delivered with nothing behind it.
   *
   * SECURITY: the ownership check is UX only (00 §11). Laravel derives the
   * creator from the session and scopes the operation to their own orders.
   *
   * @param {string} orderId `ord_…`
   * @param {object} options
   * @param {string} options.message what is being handed over, 20–600 characters
   * @param {(File|object)[]} options.files real `File`s to upload, or file
   *   objects already returned by `uploadService` (§5.1)
   * @param {string} [options.revisionId] `rev_…` when this answers a change request
   * @param {string} [options.actorId] the acting creator — rejected unless they
   *   are the order's creator
   * @returns {Promise<{delivery: object, order: object, revision: object|null,
   *   moderationReview: object|null}>} everything the workspace redraws from
   * @throws {ApiError} `validation_failed` (empty note, no files, too many
   *   files, a rejected file type or size) · `forbidden` · `conflict` when the
   *   order is not one a creator can deliver on · `not_found`
   *
   * **Future endpoint:** `POST /orders/:id/deliveries` → `{ delivery, order }`,
   * one transaction with the version computed server-side and
   * `UNIQUE (order_id, version)` making two v2s impossible.
   */
  async submitDelivery(orderId, { message, files, revisionId, actorId } = {}) {
    const order = await orderService.getById(orderId)

    if (actorId && order.creatorId !== actorId) {
      throw createApiError(API_ERROR_CODE.FORBIDDEN, 'This order belongs to another creator.')
    }
    if (!DELIVERABLE_ORDER_STATUSES.includes(order.status)) {
      throw invalidState(
        'This order is not open for delivery. Reload the page to see where it got to.',
        { from: order.status, to: ORDER_STATUS.DELIVERED }
      )
    }

    // Both validations run before anything is uploaded or written, so a rejected
    // note never costs the creator a wait on files.
    const note = assertMessage(message)
    const deliveredStatus = transitionTo(
      ORDER_STATUS_MACHINE,
      order.status,
      ORDER_STATUS.DELIVERED,
      'This order can no longer be delivered on.'
    )
    const uploaded = await resolveFiles(files)

    // MOCK-VERSIONING: computed in the browser from the versions already on the
    // order (contract §7 operation 5 step 2). Two tabs submitting at once would
    // both read the same number; Laravel's unique constraint refuses the second.
    const { items: existing } = await deliveryService.listByOrder(orderId, { page: 1, limit: 100 })
    const version = existing.reduce((highest, entry) => Math.max(highest, Number(entry.version) || 0), 0) + 1

    const submittedAt = nowIso()

    const delivery = await deliveries.create({
      orderId: order.id,
      version,
      message: note,
      files: uploaded,
      status: DELIVERY_STATUS.SUBMITTED,
      revisionId: revisionId ?? null,
      submittedAt,
      respondedAt: null,
    })

    const updatedOrder = await orderService.update(order.id, {
      status: deliveredStatus,
      deliveredAt: submittedAt,
    })

    // Best effort: the answer is the record that matters, and a revision left
    // open is visible and fixable where a lost version is not.
    let revision = null
    if (revisionId) {
      try {
        revision = await revisionService.update(revisionId, { resolvedAt: submittedAt })
      } catch {
        revision = null
      }
    }

    const moderationReview = await openModerationCase({ delivery, order, at: submittedAt })

    await notifyQuietly({
      userId: order.buyerId,
      type: NOTIFICATION_TYPE.DELIVERY_SUBMITTED,
      title: version === 1 ? 'Delivery submitted' : `Version ${version} submitted`,
      body:
        `Version ${version} of “${order.title}” is ready for your review. ` +
        'Your payment stays in escrow until you accept it.',
      entityType: 'order',
      entityId: order.id,
    })

    return { delivery, order: updatedOrder, revision, moderationReview }
  },

  /**
   * **Accepts a delivered version** — the click that completes an order and pays
   * a creator (contract §7 operation 6).
   *
   * Irreversible by design, and the reason the screen in front of it asks twice:
   * accepting is the buyer saying the work is what they asked for, which is
   * precisely what releases money BetterBlue is holding on their behalf. There
   * is no un-accept; a problem found afterwards is a dispute.
   *
   * The version closes at `accepted`, then `orderService.completeOrder` releases
   * the escrow and closes the order. That order matters: a version marked
   * accepted with the money still held is recoverable — support releases it —
   * whereas money released against a version nobody accepted is not.
   *
   * SECURITY: the ownership check is UX only (00 §11). Laravel scopes the
   * operation to the signed-in buyer as well.
   *
   * @param {string} deliveryId `dlv_…`
   * @param {object} [options]
   * @param {string} [options.actorId] the acting buyer — rejected unless they
   *   own the order
   * @returns {Promise<{delivery: object, order: object, payment: object|null,
   *   creatorEarnings: number|null}>} everything the success screen renders
   * @throws {ApiError} `conflict` when the version has already been responded to
   *   or the order has moved on · `forbidden` · `not_found`
   *
   * **Future endpoint:** `POST /deliveries/:id/accept` →
   * `{ delivery, order, payment }`, all of it in one transaction.
   *
   * Auto-acceptance after `platformSettings.general.autoAcceptDays` is a
   * **scheduled job** server-side (contract §7). The mock era only *shows* the
   * date it would fall on — nothing here runs on a timer.
   */
  async acceptDelivery(deliveryId, { actorId } = {}) {
    const delivery = await deliveries.getById(deliveryId)
    const order = await orderService.getById(delivery.orderId)

    if (actorId && order.buyerId !== actorId) {
      throw createApiError(API_ERROR_CODE.FORBIDDEN, 'This order belongs to another account.')
    }
    if (delivery.status !== DELIVERY_STATUS.SUBMITTED) {
      throw createApiError(
        API_ERROR_CODE.CONFLICT,
        'This delivery has already been responded to. Reload the page to see where it got to.',
        { from: delivery.status, to: DELIVERY_STATUS.ACCEPTED },
        409
      )
    }
    if (order.status !== ORDER_STATUS.DELIVERED) {
      throw createApiError(
        API_ERROR_CODE.CONFLICT,
        'This order is not waiting on your review. Reload the page to see where it got to.',
        { from: order.status, to: ORDER_STATUS.COMPLETED },
        409
      )
    }

    let acceptedStatus
    try {
      acceptedStatus = assertTransition(
        DELIVERY_STATUS_MACHINE,
        delivery.status,
        DELIVERY_STATUS.ACCEPTED
      )
    } catch (failure) {
      throw createApiError(
        API_ERROR_CODE.CONFLICT,
        'This delivery can no longer be accepted.',
        { from: delivery.status, to: DELIVERY_STATUS.ACCEPTED, transition: failure.message },
        409
      )
    }

    const accepted = await deliveries.update(delivery.id, {
      status: acceptedStatus,
      respondedAt: nowIso(),
    })

    const completion = await orderService.completeOrder(order.id, {
      actor: actorId ? { id: actorId } : undefined,
    })

    await notifyQuietly({
      userId: order.creatorId,
      type: NOTIFICATION_TYPE.DELIVERY_ACCEPTED,
      title: 'Delivery accepted',
      body:
        `The buyer accepted version ${delivery.version} of “${order.title}”. ` +
        'The escrow has been released to you.',
      entityType: 'order',
      entityId: order.id,
    })

    return {
      delivery: accepted,
      order: completion.order,
      payment: completion.payment,
      creatorEarnings: completion.creatorEarnings,
    }
  },
})

export default deliveryService
