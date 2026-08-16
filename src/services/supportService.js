// The support inbox — `docs/api-contract.md` §6.22. Reachable by signed-out
// visitors, so `name` and `email` live on the ticket itself.

import { ADMIN_ROLES } from '@/constants/roles'
import { TICKET_STATUS } from '@/constants/statuses'
import { ID_PREFIX } from '@/utils/id'

import { API_ERROR_CODE, createApiError } from './api/apiError'
import { auditService } from './auditService'
import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'
import { userService } from './userService'

const supportTickets = createCrudService('supportTickets', { idPrefix: ID_PREFIX.SUPPORT_TICKET })

/** Provider page ceiling (contract §4.1) — bounds the requester join. */
const FOLD_LIMIT = 100

/** Length ceiling on one reply, enforced here as well as in the composer. */
export const TICKET_REPLY_MAX = 2000

/** Tickets still on somebody's desk — the inbox's default view. */
export const OPEN_TICKET_STATUSES = Object.freeze([TICKET_STATUS.OPEN, TICKET_STATUS.PENDING])

/**
 * Which status changes the console offers, and what each one is called in the
 * trail. Unlike orders and requests, tickets have **no state machine** (00 §9
 * defines none): a conversation genuinely can go back and forth, and reopening
 * a ticket somebody closed too early is an ordinary support action rather than
 * an invented transition. What is guarded is the *set* of statuses — anything
 * outside `TICKET_STATUS` is refused.
 *
 * `ticket.reply` and `ticket.close` are the seeded audit verbs (contract
 * §6.26); `ticket.resolve` and `ticket.reopen` extend that vocabulary rather
 * than renaming any of it.
 */
export const TICKET_ACTION = Object.freeze({
  [TICKET_STATUS.RESOLVED]: Object.freeze({ action: 'ticket.resolve', label: 'Resolved' }),
  [TICKET_STATUS.CLOSED]: Object.freeze({ action: 'ticket.close', label: 'Closed' }),
  [TICKET_STATUS.OPEN]: Object.freeze({ action: 'ticket.reopen', label: 'Reopened' }),
  [TICKET_STATUS.PENDING]: Object.freeze({ action: 'ticket.reply', label: 'Awaiting the member' }),
})

/** A reply, in the shape the seeded tickets already store. */
function toReply({ byId, body, at }) {
  return { byId, body, at }
}

export const supportService = Object.freeze({
  /**
   * The inbox (admin) or "my tickets" (member).
   *
   * @param {import('./api/listAdapter').ListParams} [params] filters: `status`,
   *   `userId`, `email`, `createdAt_gte`/`createdAt_lte`; sort: `createdAt`
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  listTickets: (params = {}) =>
    supportTickets.list({ sort: 'createdAt', order: SORT_ORDER.DESC, ...params }),

  /**
   * @param {string} id `tkt_…`
   * @returns {Promise<object>} the ticket
   * @throws {ApiError} `not_found`
   */
  getTicketById: (id) => supportTickets.getById(id),

  /**
   * Contacts support. Public — `userId` is attached only when signed in.
   *
   * @param {object} payload
   * @param {string} payload.name who to reply to
   * @param {string} payload.email where to reply
   * @param {string} payload.subject one line
   * @param {string} payload.body the question
   * @param {string} [payload.userId] `usr_…` when signed in
   * @returns {Promise<object>} the created ticket
   */
  createTicket: (payload) =>
    supportTickets.create({ status: TICKET_STATUS.OPEN, replies: [], ...payload }),

  /**
   * Changes a ticket's status, or attaches a reply (admin).
   *
   * MOCK-APPEND: `replies` is a whole-array read-modify-write `PATCH`, with the
   * same lost-update risk as moderation history (contract §6.22).
   *
   * @param {string} id `tkt_…`
   * @param {object} patch changed fields only
   * @returns {Promise<object>} the updated ticket
   */
  updateTicket: (id, patch) => supportTickets.update(id, patch),

  /* ------------------------------------------------------------------------ */
  /* Admin console (Prompt 31)                                                */
  /* ------------------------------------------------------------------------ */

  /**
   * **The support queue** — tickets with their requester resolved where there
   * is one (Prompt 31 §4.3).
   *
   * A ticket may come from a signed-out visitor, so `requester` is `null` on
   * plenty of rows by design and the ticket's own `name`/`email` are the only
   * contact details. That is not a failed join and the screen must not render it
   * as one.
   *
   * MOCK-JOIN: two requests for a whole page (tickets, then the accounts behind
   * the ones that have a `userId`). Laravel: `?include=user`.
   *
   * @param {object} [params]
   * @param {number} [params.page=1]
   * @param {number} [params.limit=20]
   * @param {string} [params.sort='createdAt']
   * @param {'asc'|'desc'} [params.order='desc']
   * @param {string} [params.search] matches the subject and the message
   * @param {string|string[]} [params.status] one or several `TICKET_STATUS` values
   * @param {string} [params.createdFrom] ISO lower bound on `createdAt`
   * @param {string} [params.createdTo] ISO upper bound on `createdAt`
   * @returns {Promise<import('./api/listAdapter').ListResult>} tickets, each with
   *   `requester` (`null` for a signed-out sender or a failed join)
   *
   * **Future endpoint:** `GET /admin/supportTickets?…&include=user`.
   */
  async adminListTickets({
    page = 1,
    limit = 20,
    sort = 'createdAt',
    order = SORT_ORDER.DESC,
    search,
    status,
    createdFrom,
    createdTo,
  } = {}) {
    const filters = {}
    if (status) filters.status = status
    if (createdFrom) filters.createdAt_gte = createdFrom
    if (createdTo) filters.createdAt_lte = createdTo

    const result = await supportTickets.list({ page, limit, sort, order, search, filters })
    if (result.items.length === 0) return result

    const userIds = result.items.map((ticket) => ticket.userId).filter(Boolean)
    let byId = new Map()
    if (userIds.length > 0) {
      try {
        const accounts = await userService.listByIds(userIds)
        byId = new Map(accounts.map((account) => [account.id, account]))
      } catch {
        // The ticket and its contact details are the payload.
      }
    }

    return {
      ...result,
      items: result.items.map((ticket) => ({
        ...ticket,
        requester: ticket.userId ? (byId.get(ticket.userId) ?? null) : null,
      })),
    }
  },

  /**
   * One ticket with whatever is known about who sent it, and the admins who have
   * replied — so a thread can print names rather than `usr_…` (§4.3).
   *
   * @param {string} id `tkt_…`
   * @returns {Promise<{ticket: object, requester: object|null,
   *   participants: Object<string, object>}>} `participants` is keyed by user id
   *   and covers everyone who appears in the thread
   * @throws {ApiError} `not_found`
   */
  async getTicketContext(id) {
    const ticket = await supportTickets.getById(id)

    const ids = [
      ...new Set([ticket.userId, ...(ticket.replies ?? []).map((reply) => reply.byId)].filter(Boolean)),
    ]

    let participants = {}
    if (ids.length > 0) {
      try {
        const accounts = await userService.listByIds(ids.slice(0, FOLD_LIMIT))
        participants = Object.fromEntries(accounts.map((account) => [account.id, account]))
      } catch {
        // A thread that prints ids instead of names still reads.
      }
    }

    return {
      ticket,
      requester: ticket.userId ? (participants[ticket.userId] ?? null) : null,
      participants,
    }
  },

  /**
   * **Replies to a ticket** (§4.3), appending to the thread and putting the
   * ticket into `pending` — the state that means "answered, waiting on them".
   *
   * ╔══════════════════════════════════════════════════════════════════════╗
   * ║ HONEST LIMITATION (§4.3, documented rather than implied): a reply is  ║
   * ║ an **in-app record only**. There is no email in the mock stack, and   ║
   * ║ the member has no screen that shows their tickets — the contact form  ║
   * ║ is write-only (Prompt 11). So a reply written here is read by the     ║
   * ║ next admin who opens the ticket, and by nobody else.                  ║
   * ║                                                                       ║
   * ║ The console says this to the admin in the composer rather than        ║
   * ║ letting them believe they have answered somebody. Laravel closes the  ║
   * ║ gap on both ends: a queued mailable to `ticket.email`, and a member-  ║
   * ║ facing "my tickets" screen reading the same `replies` array.          ║
   * ╚══════════════════════════════════════════════════════════════════════╝
   *
   * MOCK-APPEND: whole-array read-modify-write, so two admins replying at once
   * can lose one reply (contract §6.22). Laravel: a `ticket_replies` row.
   *
   * @param {string} id `tkt_…`
   * @param {object} options
   * @param {string} options.body the reply — 1…{@link TICKET_REPLY_MAX} characters
   * @param {{id: string, role: string}} options.actor the replying admin
   * @param {string} [options.status='pending'] the state to leave the ticket in
   * @returns {Promise<object>} the updated ticket
   * @throws {ApiError} `validation_failed` on an empty reply or a missing actor ·
   *   `not_found`
   *
   * **Future endpoint:** `POST /admin/supportTickets/:id/replies` → `{ ticket }`.
   */
  async replyToTicket(id, { body, actor, status = TICKET_STATUS.PENDING } = {}) {
    const text = String(body ?? '').trim()
    if (!text || text.length > TICKET_REPLY_MAX) {
      throw createApiError(API_ERROR_CODE.VALIDATION_FAILED, 'Write a reply before sending it.', {
        body: text
          ? `Keep the reply under ${TICKET_REPLY_MAX} characters.`
          : 'A reply cannot be empty.',
      })
    }
    if (!actor?.id) {
      throw createApiError(
        API_ERROR_CODE.VALIDATION_FAILED,
        'A reply has to be attributable to the admin who wrote it.'
      )
    }

    const ticket = await supportTickets.getById(id)
    const replies = [
      ...(ticket.replies ?? []),
      toReply({ byId: actor.id, body: text, at: new Date().toISOString() }),
    ]

    const updated = await supportTickets.update(id, { replies, status })

    try {
      await auditService.log({
        actorId: actor.id,
        actorRole: actor.role ?? ADMIN_ROLES[0],
        action: 'ticket.reply',
        entityType: 'support_ticket',
        entityId: id,
        meta: { status, fromStatus: ticket.status },
      })
    } catch {
      // A reply that is on the ticket must not be undone by a trail entry.
    }

    return updated
  },

  /**
   * **Resolves, closes, or reopens a ticket** (§4.3), optionally with a closing
   * note that is appended to the thread first.
   *
   * @param {string} id `tkt_…`
   * @param {object} options
   * @param {string} options.status a `TICKET_STATUS` value
   * @param {{id: string, role: string}} options.actor the acting admin
   * @param {string} [options.note] appended to the thread before the status moves
   * @returns {Promise<object>} the updated ticket
   * @throws {ApiError} `validation_failed` on an unknown status or missing actor ·
   *   `not_found`
   *
   * **Future endpoint:** `PATCH /admin/supportTickets/:id` → `{ ticket }`.
   */
  async setTicketStatus(id, { status, actor, note } = {}) {
    if (!Object.values(TICKET_STATUS).includes(status)) {
      throw createApiError(API_ERROR_CODE.VALIDATION_FAILED, 'That is not a ticket status.', {
        status: 'Pick one of open, pending, resolved, or closed.',
      })
    }
    if (!actor?.id) {
      throw createApiError(
        API_ERROR_CODE.VALIDATION_FAILED,
        'A status change has to be attributable to the admin who made it.'
      )
    }

    const ticket = await supportTickets.getById(id)
    const text = String(note ?? '').trim().slice(0, TICKET_REPLY_MAX)

    const replies = text
      ? [
          ...(ticket.replies ?? []),
          toReply({ byId: actor.id, body: text, at: new Date().toISOString() }),
        ]
      : (ticket.replies ?? [])

    const updated = await supportTickets.update(id, { replies, status })

    try {
      await auditService.log({
        actorId: actor.id,
        actorRole: actor.role ?? ADMIN_ROLES[0],
        action: TICKET_ACTION[status]?.action ?? 'ticket.reply',
        entityType: 'support_ticket',
        entityId: id,
        meta: { status, fromStatus: ticket.status, ...(text ? { note: text } : {}) },
      })
    } catch {
      // As above.
    }

    return updated
  },
})

export default supportService
