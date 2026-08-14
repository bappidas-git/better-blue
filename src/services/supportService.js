// The support inbox — `docs/api-contract.md` §6.22. Reachable by signed-out
// visitors, so `name` and `email` live on the ticket itself.

import { TICKET_STATUS } from '@/constants/statuses'
import { ID_PREFIX } from '@/utils/id'

import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'

const supportTickets = createCrudService('supportTickets', { idPrefix: ID_PREFIX.SUPPORT_TICKET })

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

  // —— workflow operations (added by later prompts) ——
  // replyToTicket / closeTicket — Prompt 34 (admin operations), each writing a
  // `ticket.reply` / `ticket.close` audit entry.
})

export default supportService
