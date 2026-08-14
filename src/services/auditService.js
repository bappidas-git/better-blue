// The administrative audit trail — `docs/api-contract.md` §6.26.
//
// Append-only: there is no update and no delete, for anyone, at any permission
// level. `log(…)` is the cross-cutting write every admin and sensitive action
// calls (00 §10); buyer and creator activity is not duplicated here.

import { ID_PREFIX } from '@/utils/id'

import { API_ERROR_CODE, createApiError } from './api/apiError'
import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'

const auditLogs = createCrudService('auditLogs', { idPrefix: ID_PREFIX.AUDIT_LOG })

export const auditService = Object.freeze({
  /**
   * Browses the trail (admin `audit.view`).
   *
   * @param {import('./api/listAdapter').ListParams} [params] filters: `actorId`,
   *   `action`, `entityType`, `entityId`, `createdAt_gte`/`createdAt_lte`;
   *   sort: `createdAt`
   * @returns {Promise<import('./api/listAdapter').ListResult>} newest first
   */
  list: (params = {}) => auditLogs.list({ sort: 'createdAt', order: SORT_ORDER.DESC, ...params }),

  /**
   * @param {string} id `aud_…`
   * @returns {Promise<object>} the entry
   * @throws {ApiError} `not_found`
   */
  getById: (id) => auditLogs.getById(id),

  /**
   * **Writes one audit entry.** Called by every admin and sensitive action.
   *
   * `action` is dot-namespaced `domain.verb` from the vocabulary in contract
   * §6.26 — extend it, never rename an existing verb. `actorRole` is
   * denormalised so the entry survives a later role change.
   *
   * @param {object} entry
   * @param {string} entry.actorId who acted, `usr_…`
   * @param {string} entry.actorRole their role at the time
   * @param {string} entry.action e.g. `'user.suspend'`, `'payment.refund'`
   * @param {string} [entry.entityType] what was acted on, e.g. `'user'`
   * @param {string} [entry.entityId] that record's id
   * @param {object} [entry.meta] detail behind the action, e.g. `{ fromStatus, toStatus, reason }`
   * @returns {Promise<object>} the created entry
   * @throws {ApiError} `validation_failed` when `actorId` or `action` is missing
   */
  log({ actorId, actorRole, action, entityType, entityId, meta } = {}) {
    if (!actorId || !action) {
      throw createApiError(
        API_ERROR_CODE.VALIDATION_FAILED,
        'An audit entry needs an actor and an action.',
        {
          actorId: actorId ? undefined : 'Actor is required.',
          action: action ? undefined : 'Action is required.',
        }
      )
    }

    return auditLogs.create({
      actorId,
      actorRole,
      action,
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
      meta: meta ?? {},
    })
  },
})

export default auditService
