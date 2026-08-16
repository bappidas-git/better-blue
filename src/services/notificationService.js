// The in-app bell feed — `docs/api-contract.md` §6.19.
//
// `notify(…)` is the cross-cutting emit helper every workflow calls (00 §10).
// Nothing else writes a notification, so the preference check and the record
// shape live in exactly one place.

import {
  NOTIFICATION_META,
  NOTIFICATION_TYPE,
  allowsInAppCategory,
  isMandatoryNotification,
} from '@/constants/notificationTypes'
import { hasPermission } from '@/constants/permissions'
import { ADMIN_ROLES, ROLES } from '@/constants/roles'
import { ACCOUNT_STATUS } from '@/constants/statuses'
import { ID_PREFIX } from '@/utils/id'

import { API_ERROR_CODE, createApiError } from './api/apiError'
import { auditService } from './auditService'
import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'
import { userService } from './userService'

const notifications = createCrudService('notifications', { idPrefix: ID_PREFIX.NOTIFICATION })

/** Cap on one "mark all as read" pass — see the note on `markAllRead`. */
const MARK_ALL_LIMIT = 100

/** Ceiling on one `notifyAdmins` fan-out — the team is small, the cap is a guard. */
const ADMIN_FANOUT_LIMIT = 50

/* -------------------------------------------------------------------------- */
/* Announcements (Prompt 31)                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Who a platform announcement goes to (contract §7.1 operation 12).
 *
 * `all` is every active **member**, not every account: the admin team is who
 * *sends* announcements, and a console full of "we have changed the commission
 * rate" addressed to the people who changed it is noise. An admin who also
 * wants the message reads it on this screen's history. Documented rather than
 * assumed, because "all" is exactly the word somebody will read as "everyone".
 */
export const ANNOUNCEMENT_AUDIENCE = Object.freeze({
  ALL: 'all',
  BUYERS: 'buyers',
  CREATORS: 'creators',
})

/** Audience → the roles it resolves to. The one place that mapping lives. */
const AUDIENCE_ROLES = Object.freeze({
  [ANNOUNCEMENT_AUDIENCE.ALL]: Object.freeze([ROLES.BUYER, ROLES.CREATOR]),
  [ANNOUNCEMENT_AUDIENCE.BUYERS]: Object.freeze([ROLES.BUYER]),
  [ANNOUNCEMENT_AUDIENCE.CREATORS]: Object.freeze([ROLES.CREATOR]),
})

/** Length bounds on the composer, enforced here as well as in the form (§13). */
export const ANNOUNCEMENT_TITLE_MIN = 8
export const ANNOUNCEMENT_TITLE_MAX = 80
export const ANNOUNCEMENT_BODY_MIN = 20
export const ANNOUNCEMENT_BODY_MAX = 500

/** Rows per page while walking the audience — the provider's ceiling (§4.1). */
const AUDIENCE_PAGE_SIZE = 100

/**
 * Hard stop on one broadcast. Well above the seeded marketplace and far below
 * the point where a browser tab doing this becomes defensible — see the note on
 * {@link notificationService.broadcastAnnouncement}.
 */
const BROADCAST_LIMIT = 1000

/** The `list` filter behind an audience: active accounts in its roles. */
function audienceFilters(audience) {
  const roles = AUDIENCE_ROLES[audience]
  if (!roles) {
    throw createApiError(
      API_ERROR_CODE.VALIDATION_FAILED,
      'Choose who this announcement is for.',
      { audience: 'Pick an audience.' }
    )
  }
  return { role: [...roles], accountStatus: ACCOUNT_STATUS.ACTIVE }
}

/** Trimmed text, length-checked, or an `ApiError` naming the field. */
function announcementText(value, { field, label, min, max }) {
  const trimmed = String(value ?? '').trim()
  if (trimmed.length < min || trimmed.length > max) {
    throw createApiError(
      API_ERROR_CODE.VALIDATION_FAILED,
      `The announcement ${field} needs to be between ${min} and ${max} characters.`,
      { [field]: `${label} must be ${min}–${max} characters.` }
    )
  }
  return trimmed
}

/**
 * Reads `users.notificationPrefs[category].inApp` for a type (contract §6.19).
 *
 * Fails **open**: if the account cannot be read, the notification is still
 * emitted. A duplicate bell item is a much smaller problem than a member never
 * hearing that their order was delivered.
 *
 * Prompt 27: two types are exempt outright —
 * {@link isMandatoryNotification} — and `allowsInAppCategory` treats their
 * whole category as locked, so this never has to fetch the account for a
 * suspension notice or a platform announcement.
 */
async function acceptsInApp(userId, type) {
  if (isMandatoryNotification(type)) return true

  const category = NOTIFICATION_META[type]?.category
  if (!category) return true

  try {
    const user = await userService.getById(userId)
    return allowsInAppCategory(user?.notificationPrefs, category)
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
   * Puts one back in the unread pile — the "Mark as unread" half of the row
   * menu (Prompt 27 §4.3), for something read on the way past and meant to be
   * dealt with later.
   *
   * @param {string} id `ntf_…`
   * @returns {Promise<object>} the updated notification
   */
  markUnread: (id) => notifications.update(id, { read: false }),

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
   * Suppression happens **here, at emit time**, not at read time: a category
   * somebody has switched off produces no record at all, so it cannot show up
   * later if they switch it back on. That is the honest reading of "do not
   * notify me about this" — and it is also what the Laravel implementation will
   * do inside the same transaction as the action that triggered it. The two
   * exceptions are listed on `MANDATORY_NOTIFICATION_TYPES`.
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

  /**
   * **Tells the team.** Emits one notification per admin holding `permission`,
   * so a workflow can raise something for Trust & Safety without knowing who is
   * on shift (Prompt 26 §4.1; Prompt 33 reuses it for resolutions).
   *
   * Suspended and deactivated admin accounts are skipped — a queue item
   * addressed to someone who cannot sign in helps nobody.
   *
   * MOCK-FANOUT: JSON Server cannot express "users holding permission X", so
   * this reads the admin accounts and filters them in the browser with
   * `hasPermission`, then writes one row each — **sequentially**, for the same
   * reason `markAllRead` writes sequentially: JSON Server rewrites the whole of
   * `db.json` on every write, and two POSTs in flight at once silently lose
   * one of them. (Written in parallel first, and the super admin's row was the
   * one that vanished.) Laravel replaces the whole thing with
   * `User::permission($permission)->each(...)` inside the same transaction as
   * the action that triggered it, and the loop disappears with it.
   *
   * Best effort by design: it resolves to whatever was written and never
   * rejects, because no workflow should fail because a bell item did not.
   *
   * @param {string} permission a `PERMISSIONS` key, e.g. `disputes.resolve`
   * @param {object} payload everything {@link notify} takes except `userId`
   * @returns {Promise<object[]>} the notifications that were created
   */
  async notifyAdmins(permission, payload = {}) {
    if (!permission) return []

    let admins = []
    try {
      const { items } = await userService.list({
        page: 1,
        limit: ADMIN_FANOUT_LIMIT,
        filters: { role: [...ADMIN_ROLES] },
      })
      admins = items.filter(
        (admin) =>
          admin.accountStatus === ACCOUNT_STATUS.ACTIVE && hasPermission(admin, permission)
      )
    } catch {
      return []
    }

    const written = []
    for (const admin of admins) {
      // eslint-disable-next-line no-await-in-loop -- see MOCK-FANOUT above.
      const notification = await notificationService
        .notify({ ...payload, userId: admin.id })
        .catch(() => null)
      if (notification) written.push(notification)
    }
    return written
  },

  /* —— workflow operations —————————————————————————————————————————————— */

  /**
   * **How many members an audience actually contains** — the number the send
   * confirmation prints before anything is written (Prompt 31 §13).
   *
   * A separate, cheap read on purpose: "send to 243 people" is a decision, and
   * an admin should be told the size of it while they can still change their
   * mind. One row is fetched for its `total`, the same trick `unreadCount` uses.
   *
   * @param {string} audience an {@link ANNOUNCEMENT_AUDIENCE} value
   * @returns {Promise<number>} active members in that audience
   * @throws {ApiError} `validation_failed` on an unknown audience
   */
  async countAudience(audience) {
    const { total } = await userService.list({
      page: 1,
      limit: 1,
      filters: audienceFilters(audience),
    })
    return total
  },

  /**
   * **Sends a platform announcement** (contract §7.1 operation 12).
   *
   * One `system_announcement` per active member in the audience, with no
   * `entityType`/`entityId` — an announcement is about the service, not about a
   * record, and there is nowhere for it to deep-link to. The type is on
   * `MANDATORY_NOTIFICATION_TYPES`, so preferences do not suppress it: a member
   * who has silenced this has silenced the only channel the platform has.
   *
   * MOCK-FANOUT: `GET /users` walked a page at a time, then one `POST` per
   * recipient, **sequentially** — JSON Server rewrites `db.json` on every write
   * and two POSTs in flight lose one of them (the constraint `notifyAdmins` and
   * `markAllRead` work around). With 23 seeded members that is ~24 requests; at
   * 10,000 members it is 10,000 from a browser tab, which is why the Laravel
   * side is one request and a queued job. `BROADCAST_LIMIT` stops a mistake
   * here from becoming a very long afternoon.
   *
   * **Partial failure is reported, not swallowed** (§13): a recipient whose
   * write fails is counted in `failed` and the caller says "Sent 240 of 243".
   * Retrying re-sends to everybody, which is why the copy says so — a duplicate
   * announcement is recoverable and a silent gap is not.
   *
   * @param {object} input
   * @param {string} input.audience an {@link ANNOUNCEMENT_AUDIENCE} value
   * @param {string} input.title 8–80 characters
   * @param {string} input.body 20–500 characters
   * @param {{id: string, role: string}} [input.actor] the sending admin — the
   *   audit entry is skipped without one
   * @param {(progress: {sent: number, failed: number, total: number}) => void} [input.onProgress]
   *   called as the fan-out advances, so a long send has a moving number
   * @returns {Promise<{audience: string, title: string, recipientCount: number,
   *   sent: number, failed: number, audited: boolean}>}
   * @throws {ApiError} `validation_failed` on a bad audience, title, or body
   *
   * **Future endpoint:** `POST /announcements` → `{ sent }` — one request, the
   * fan-out in a queued job, and the audit entry written once inside it.
   */
  async broadcastAnnouncement({ audience, title, body, actor, onProgress } = {}) {
    const filters = audienceFilters(audience)
    const safeTitle = announcementText(title, {
      field: 'title',
      label: 'The title',
      min: ANNOUNCEMENT_TITLE_MIN,
      max: ANNOUNCEMENT_TITLE_MAX,
    })
    const safeBody = announcementText(body, {
      field: 'body',
      label: 'The message',
      min: ANNOUNCEMENT_BODY_MIN,
      max: ANNOUNCEMENT_BODY_MAX,
    })

    // The audience is collected first and in full, so the count the admin
    // confirmed and the count that gets written come from the same read.
    const recipients = []
    for (let page = 1; recipients.length < BROADCAST_LIMIT; page += 1) {
      // eslint-disable-next-line no-await-in-loop -- pages are sequential by nature.
      const { items, total } = await userService.list({
        page,
        limit: AUDIENCE_PAGE_SIZE,
        filters,
      })
      recipients.push(...items.map((member) => member.id))
      if (items.length === 0 || recipients.length >= total) break
    }

    let sent = 0
    let failed = 0
    const total = recipients.length

    for (const userId of recipients) {
      // eslint-disable-next-line no-await-in-loop -- see MOCK-FANOUT above.
      const written = await notificationService
        .notify({
          userId,
          type: NOTIFICATION_TYPE.SYSTEM_ANNOUNCEMENT,
          title: safeTitle,
          body: safeBody,
        })
        .catch(() => null)

      if (written) sent += 1
      else failed += 1
      onProgress?.({ sent, failed, total })
    }

    // The audit entry **is** the announcement history (Prompt 31 §4.4): there is
    // no `announcements` collection, and adding one to store four fields that
    // the trail already has to record would be a second source of truth for the
    // same event. `meta` carries everything the history list renders.
    let audited = false
    if (actor?.id) {
      try {
        await auditService.log({
          actorId: actor.id,
          actorRole: actor.role,
          action: 'announcement.send',
          entityType: 'platform_settings',
          meta: { title: safeTitle, body: safeBody, audience, recipientCount: total, sent, failed },
        })
        audited = true
      } catch {
        // A send that happened must not be undone by a trail entry that did not.
      }
    }

    return { audience, title: safeTitle, recipientCount: total, sent, failed, audited }
  },

  /**
   * **The announcements that have been sent**, newest first — read straight off
   * the audit trail (§4.4).
   *
   * Deliberately not a collection of its own. An announcement is an event, not
   * a record with a life of its own: nothing edits one, nothing deletes one, and
   * the trail already has to hold it. Reading the history from there keeps the
   * two from ever disagreeing, at the cost of a `meta` shape this function has
   * to be tolerant about — the seeded entry spells its fields `subject` and
   * `recipients`, so both spellings are read.
   *
   * @param {object} [params]
   * @param {number} [params.page=1]
   * @param {number} [params.limit=10]
   * @returns {Promise<import('./api/listAdapter').ListResult>} entries carrying
   *   `title`, `body`, `audience`, `recipientCount`, `sentAt`, `actorId`
   */
  async listAnnouncements({ page = 1, limit = 10 } = {}) {
    const result = await auditService.list({
      page,
      limit,
      filters: { action: 'announcement.send' },
    })

    return {
      ...result,
      items: result.items.map((entry) => ({
        id: entry.id,
        actorId: entry.actorId,
        actorRole: entry.actorRole,
        sentAt: entry.createdAt,
        title: entry.meta?.title ?? entry.meta?.subject ?? 'Announcement',
        body: entry.meta?.body ?? null,
        audience: entry.meta?.audience ?? null,
        recipientCount: entry.meta?.recipientCount ?? entry.meta?.recipients ?? null,
        failed: entry.meta?.failed ?? 0,
      })),
    }
  },
})

export default notificationService
