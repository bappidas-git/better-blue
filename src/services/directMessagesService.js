// Buyer → creator messages from the public creators page — Storefront V2
// (`prompts-v2/09` §4).
//
// **The smallest collection in BetterBlue, and deliberately so.** A message is
// one row: who sent it, which storefront it went to, what it said, and when.
// There is no thread, no status, no read flag, and nothing downstream depends
// on one — a buyer opening a conversation with a creator is not a proposal, not
// an order, and not a feed reply.
//
// **Honest limitation:** there is no creator-side inbox yet. A sent message
// lands in `directMessages` and raises a `direct_message_received` notification
// on the creator's bell; reading it back is future work, and this module
// already exposes the two reads that screen will need
// (`listForCreator`, `listFromBuyer`) so it does not have to invent them.
//
// PRIVACY: both reads filter by owner in the *query*, so the provider never
// returns somebody else's correspondence. As with every ownership check in this
// prototype that is **UX only** (00 §11) — the Laravel API must scope the same
// queries to the signed-in account.

import { NOTIFICATION_TYPE } from '@/constants/notificationTypes'
import { ID_PREFIX } from '@/utils/id'

import { API_ERROR_CODE, createApiError } from './api/apiError'
import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'
import { creatorProfileService } from './creatorProfileService'
import { notificationService } from './notificationService'

const directMessages = createCrudService('directMessages', {
  idPrefix: ID_PREFIX.DIRECT_MESSAGE,
})

/**
 * Length bounds on one message, enforced here as well as in the dialog.
 *
 * The floor is what stops "hi" reaching a creator's bell; the ceiling is a
 * first contact, not a brief — a buyer with more to say has the feed board for
 * it. `SendMessageDialog` imports both, so the counter and the rejection agree
 * by construction.
 */
export const DIRECT_MESSAGE_MIN = 20
export const DIRECT_MESSAGE_MAX = 600

/** Trimmed message text, length-checked, or an `ApiError` naming the field. */
function toBody(value) {
  const body = String(value ?? '').trim()

  if (body.length < DIRECT_MESSAGE_MIN) {
    throw createApiError(
      API_ERROR_CODE.VALIDATION_FAILED,
      `A message needs at least ${DIRECT_MESSAGE_MIN} characters.`,
      { body: `Write at least ${DIRECT_MESSAGE_MIN} characters so the creator can answer it.` }
    )
  }
  if (body.length > DIRECT_MESSAGE_MAX) {
    throw createApiError(
      API_ERROR_CODE.VALIDATION_FAILED,
      `A message has to stay under ${DIRECT_MESSAGE_MAX} characters.`,
      { body: `Keep it under ${DIRECT_MESSAGE_MAX} characters.` }
    )
  }

  return body
}

export const directMessagesService = Object.freeze({
  /**
   * **Opens a conversation with a creator** — the Send message dialog on
   * `/creators` (V2-09 §4).
   *
   * The storefront is read before anything is written, so a bad id fails
   * without leaving a message behind, and so the notification can address the
   * creator by the name on their storefront.
   *
   * @param {string} creatorId `cpr_…` — **the storefront**, not the account
   * @param {object} input
   * @param {string} input.buyerId `usr_…` — the buyer writing
   * @param {string} input.body the message
   * @returns {Promise<object>} the created `directMessages` record
   * @throws {ApiError} `validation_failed` · `not_found` (no such storefront)
   *
   * **Future endpoint:** `POST /creators/:creatorId/messages` → `{ message }`,
   * authorised against the signed-in buyer (00 §11).
   */
  async sendMessage(creatorId, { buyerId, body } = {}) {
    if (!creatorId) {
      throw createApiError(
        API_ERROR_CODE.VALIDATION_FAILED,
        'A message needs the storefront it is addressed to.'
      )
    }
    if (!buyerId) {
      throw createApiError(API_ERROR_CODE.VALIDATION_FAILED, 'A message needs a sender.')
    }
    const message = toBody(body)

    const profile = await creatorProfileService.getById(creatorId)

    const record = await directMessages.create({
      buyerId,
      creatorId,
      body: message,
      createdAt: new Date().toISOString(),
    })

    // Emitting the notification is a separate step from the message (00 §10),
    // so a suppressed or failed notification never costs the buyer their send.
    //
    // It carries **no `entityType`/`entityId`**: there is no creator-side inbox
    // to deep-link into yet, and pointing the bell at a screen that does not
    // exist would be worse than pointing it at the dashboard
    // (`features/notifications/notificationRoutes.js`).
    try {
      await notificationService.notify({
        userId: profile.userId,
        type: NOTIFICATION_TYPE.DIRECT_MESSAGE_RECEIVED,
        title: 'A buyer has messaged you',
        body: 'A business has sent you a message about commissioning content. Replies open once your inbox is available.',
      })
    } catch {
      // See above.
    }

    return record
  },

  /**
   * Everything sent to one storefront, newest first — the read the creator
   * inbox will make when it is built.
   *
   * @param {string} creatorId `cpr_…`
   * @param {object} [params] `page`, `limit`
   * @returns {Promise<import('./api/listAdapter').ListResult>} empty when the
   *   storefront is unknown
   */
  async listForCreator(creatorId, { page = 1, limit = 20 } = {}) {
    if (!creatorId) return { items: [], total: 0, page, limit }
    return directMessages.list({
      page,
      limit,
      sort: 'createdAt',
      order: SORT_ORDER.DESC,
      filters: { creatorId },
    })
  },

  /**
   * Everything one buyer has sent, newest first.
   *
   * @param {string} buyerId `usr_…`
   * @param {object} [params] `page`, `limit`
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  async listFromBuyer(buyerId, { page = 1, limit = 20 } = {}) {
    if (!buyerId) return { items: [], total: 0, page, limit }
    return directMessages.list({
      page,
      limit,
      sort: 'createdAt',
      order: SORT_ORDER.DESC,
      filters: { buyerId },
    })
  },
})

export default directMessagesService
