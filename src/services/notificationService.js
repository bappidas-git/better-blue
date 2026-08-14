// The in-app bell feed — `docs/api-contract.md` §6.19.
//
// `notify(…)` is the cross-cutting emit helper every workflow calls (00 §10).
// Nothing else writes a notification, so the preference check and the record
// shape live in exactly one place.

import { NOTIFICATION_META } from '@/constants/notificationTypes'
import { ID_PREFIX } from '@/utils/id'

import { API_ERROR_CODE, createApiError } from './api/apiError'
import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'
import { userService } from './userService'

const notifications = createCrudService('notifications', { idPrefix: ID_PREFIX.NOTIFICATION })

/** Cap on one "mark all as read" pass — see the note on `markAllRead`. */
const MARK_ALL_LIMIT = 100

/**
 * Reads `users.notificationPrefs[category].inApp` for a type (contract §6.19).
 *
 * Fails **open**: if the account cannot be read, the notification is still
 * emitted. A duplicate bell item is a much smaller problem than a member never
 * hearing that their order was delivered.
 */
async function acceptsInApp(userId, type) {
  const category = NOTIFICATION_META[type]?.category
  if (!category) return true

  try {
    const user = await userService.getById(userId)
    return user?.notificationPrefs?.[category]?.inApp !== false
  } catch {
    return true
  }
}

export const notificationService = Object.freeze({
  /**
   * @param {import('./api/listAdapter').ListParams} [params] filters: `read`,
   *   `type`, `entityType`, `createdAt_gte`/`createdAt_lte`; sort: `createdAt`
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  list: (params = {}) =>
    notifications.list({ sort: 'createdAt', order: SORT_ORDER.DESC, ...params }),

  /**
   * A member's feed. A member may only ever read their own notifications
   * (contract §6.19) — the frontend simply never asks for anyone else's.
   *
   * @param {string} userId `usr_…`
   * @param {import('./api/listAdapter').ListParams} [params] any filter above
   * @returns {Promise<import('./api/listAdapter').ListResult>} newest first
   */
  listByUser(userId, params = {}) {
    return notificationService.list({ ...params, filters: { ...params.filters, userId } })
  },

  /**
   * The bell badge. Derived rather than stored, so it cannot drift from the
   * feed (contract §6.19): one row is fetched purely for its `total`.
   *
   * @param {string} userId `usr_…`
   * @returns {Promise<number>} unread notifications for that member
   */
  async unreadCount(userId) {
    if (!userId) return 0
    const { total } = await notifications.list({
      page: 1,
      limit: 1,
      filters: { userId, read: false },
    })
    return total
  },

  /**
   * Marks one notification as read.
   *
   * @param {string} id `ntf_…`
   * @returns {Promise<object>} the updated notification
   */
  markRead: (id) => notifications.update(id, { read: true }),

  /**
   * Marks a member's whole feed as read.
   *
   * MOCK-BULK: there is no bulk endpoint, so this is one `PATCH` per unread
   * row, sequentially (JSON Server rewrites `db.json` on every write). It is
   * visibly slow at 17 unread and capped at {@link MARK_ALL_LIMIT} rows per
   * call. Laravel replaces the whole loop with a single `UPDATE … WHERE
   * user_id = ? AND read = 0` (contract §6.19).
   *
   * @param {string} userId `usr_…`
   * @returns {Promise<{updated: number, remaining: number}>} how many were
   *   marked, and how many were left for a follow-up call
   */
  async markAllRead(userId) {
    if (!userId) return { updated: 0, remaining: 0 }

    const { items, total } = await notifications.list({
      page: 1,
      limit: MARK_ALL_LIMIT,
      filters: { userId, read: false },
    })

    let updated = 0
    for (const notification of items) {
      // eslint-disable-next-line no-await-in-loop -- see MOCK-BULK above.
      await notifications.update(notification.id, { read: true })
      updated += 1
    }

    return { updated, remaining: Math.max(total - updated, 0) }
  },

  /**
   * **The emit helper every workflow calls.** Writes one notification, after
   * checking the member's per-category preference.
   *
   * @param {object} notification
   * @param {string} notification.userId recipient, `usr_…`
   * @param {string} notification.type a `NOTIFICATION_TYPE` value
   * @param {string} notification.title one short line
   * @param {string} notification.body one or two sentences
   * @param {string} [notification.entityType] deep-link target type, e.g. `'order'`
   * @param {string} [notification.entityId] deep-link target id
   * @returns {Promise<object|null>} the created notification, or `null` when
   *   the member has that category switched off
   * @throws {ApiError} `validation_failed` when `userId` or `type` is missing
   */
  async notify({ userId, type, title, body, entityType, entityId } = {}) {
    if (!userId || !type) {
      throw createApiError(
        API_ERROR_CODE.VALIDATION_FAILED,
        'A notification needs a recipient and a type.',
        { userId: userId ? undefined : 'Recipient is required.', type: type ? undefined : 'Type is required.' }
      )
    }

    if (!(await acceptsInApp(userId, type))) return null

    return notifications.create({
      userId,
      type,
      title,
      body,
      // Both are omitted for a general announcement, which has nowhere to
      // navigate (contract §6.19).
      ...(entityType && entityId ? { entityType, entityId } : {}),
      read: false,
    })
  },

  // —— workflow operations (added by later prompts) ——
  // broadcastAnnouncement — Prompt 34 (admin operations), contract §7
  // operation 12: one `system_announcement` per member in the audience.
})

export default notificationService
