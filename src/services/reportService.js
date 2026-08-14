// Member reports about content, profiles, or requests — `docs/api-contract.md`
// §6.21. `POST /reports` is public: a signed-out visitor must be able to report
// content, which is why `reporterId` is optional.

import { REPORT_STATUS } from '@/constants/statuses'
import { ID_PREFIX } from '@/utils/id'

import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'

const reports = createCrudService('reports', { idPrefix: ID_PREFIX.REPORT })

export const reportService = Object.freeze({
  /**
   * @param {import('./api/listAdapter').ListParams} [params] filters: `status`,
   *   `subjectType`, `subjectId`, `reason`, `handledById`,
   *   `createdAt_gte`/`createdAt_lte`; sort: `createdAt`
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  list: (params = {}) => reports.list({ sort: 'createdAt', order: SORT_ORDER.DESC, ...params }),

  /**
   * @param {string} id `rpt_…`
   * @returns {Promise<object>} the report
   * @throws {ApiError} `not_found`
   */
  getById: (id) => reports.getById(id),

  /**
   * The open report queue (admin).
   *
   * @param {import('./api/listAdapter').ListParams} [params] any filter above;
   *   pass `filters.status` to see handled reports instead
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  listQueue(params = {}) {
    return reportService.list({
      ...params,
      filters: { status: REPORT_STATUS.OPEN, ...params.filters },
    })
  },

  /**
   * Files a report. `subjectId` resolves against a different collection per
   * `subjectType` — and for `creator_profile` it is a `cpr_…`, not a `usr_…`
   * (contract §6.21).
   *
   * @param {object} payload
   * @param {string} payload.subjectType `portfolio_item` | `creator_profile` | `request`
   * @param {string} payload.subjectId the reported record's id
   * @param {string} payload.reason `prohibited_content` | `intellectual_property`
   *   | `misleading_claims` | `spam` | `other` (contract §6.21 — these have no
   *   `src/constants/` enum yet; Prompt 22 adds one)
   * @param {string} [payload.details] what the reporter wants us to look at
   * @param {string} [payload.reporterId] omitted entirely for anonymous reports
   * @returns {Promise<object>} the created report
   */
  create: (payload) => reports.create({ status: REPORT_STATUS.OPEN, ...payload }),

  /**
   * Records the outcome (admin): `reviewed`, `actioned`, or `dismissed`, plus
   * `handledById`.
   *
   * @param {string} id `rpt_…`
   * @param {object} patch changed fields only
   * @returns {Promise<object>} the updated report
   */
  update: (id, patch) => reports.update(id, patch),

  // —— workflow operations (added by later prompts) ——
  // actionReport / dismissReport — Prompt 30 (admin moderation): also restricts
  // the subject and writes a `report.action` / `report.dismiss` audit entry.
})

export default reportService
