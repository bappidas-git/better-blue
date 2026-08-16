// Member reports about content, profiles, or requests — `docs/api-contract.md`
// §6.21. `POST /reports` is public: a signed-out visitor must be able to report
// content, which is why `reporterId` is optional.
//
// Prompt 30 added both ends of the pipeline: {@link reportService.fileReport}
// (what the public report dialog calls) and the triage operations the admin
// reports queue calls — dismiss, or action, where actioning a portfolio item
// opens the moderation case it belongs in (contract §7, operation 28).

import { REPORT_REASONS, REPORT_SUBJECT, REPORT_DETAILS_MAX } from '@/constants/reports'
import { ROLES } from '@/constants/roles'
import { MODERATION_SUBJECT, REPORT_STATUS } from '@/constants/statuses'
import { ID_PREFIX } from '@/utils/id'

import { API_ERROR_CODE, createApiError } from './api/apiError'
import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'
import { auditService } from './auditService'
// CYCLE: see the note in `moderationService` — the two are one console.
import { moderationService } from './moderationService'

const reports = createCrudService('reports', { idPrefix: ID_PREFIX.REPORT })

/**
 * MOCK-JOIN: the queue prints what a report is *about*, and JSON Server has no
 * `include`. Read-only handles, one batched read per subject collection.
 */
const portfolioItems = createCrudService('portfolioItems', {
  idPrefix: ID_PREFIX.PORTFOLIO_ITEM,
})
const creatorProfiles = createCrudService('creatorProfiles', {
  idPrefix: ID_PREFIX.CREATOR_PROFILE,
})
const contentRequests = createCrudService('contentRequests', { idPrefix: ID_PREFIX.REQUEST })
const users = createCrudService('users', { idPrefix: ID_PREFIX.USER })

/** Statuses a report can still be triaged from — everything not yet closed. */
export const OPEN_REPORT_STATUSES = Object.freeze([
  REPORT_STATUS.OPEN,
  REPORT_STATUS.REVIEWED,
])

/** Outcomes an admin can record (contract §6.21). */
export const REPORT_RESOLUTIONS = Object.freeze([
  REPORT_STATUS.REVIEWED,
  REPORT_STATUS.ACTIONED,
  REPORT_STATUS.DISMISSED,
])

/** Cap on one board read — see the note on `listReportBoard`. */
const BOARD_LIMIT = 100

/** Longest note an admin can leave on a resolution. */
export const REPORT_NOTE_MAX = 500

const REASON_VALUES = REPORT_REASONS.map((reason) => reason.value)

const nowIso = () => new Date().toISOString()

const invalidInput = (message, details) =>
  createApiError(API_ERROR_CODE.VALIDATION_FAILED, message, details, 422)

/** Neither an audit line nor a join may cost a resolution that happened. */
async function quietly(work) {
  try {
    return await work()
  } catch {
    return null
  }
}

/** Which collection a `subjectType` resolves against (contract §6.21). */
const SUBJECT_COLLECTION = {
  [REPORT_SUBJECT.PORTFOLIO_ITEM]: portfolioItems,
  [REPORT_SUBJECT.CREATOR_PROFILE]: creatorProfiles,
  [REPORT_SUBJECT.REQUEST]: contentRequests,
}

/** How a subject record titles itself, per type. */
function titleOf(subjectType, record) {
  if (!record) return null
  if (subjectType === REPORT_SUBJECT.CREATOR_PROFILE) return record.displayName ?? record.id
  return record.title ?? record.id
}

async function readByIds(collection, ids) {
  if (!collection || ids.length === 0) return {}
  try {
    const { items } = await collection.list({ page: 1, limit: BOARD_LIMIT, filters: { id: ids } })
    return Object.fromEntries(items.map((item) => [item.id, item]))
  } catch {
    return {}
  }
}

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
   * @param {string} payload.subjectType a `REPORT_SUBJECT` value
   * @param {string} payload.subjectId the reported record's id
   * @param {string} payload.reason a `REPORT_REASON` value
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

  /* —— workflow operations (Prompt 30) ——————————————————————————————— */

  /**
   * **Files a report from a public surface** — the creator profile's overflow
   * menu and the portfolio viewer (Prompt 30 §4.5).
   *
   * Anonymous by design: `reporterId` is omitted entirely for a signed-out
   * visitor rather than stored as `null`, because "reported by nobody" and
   * "reported by an account we did not record" are different claims.
   *
   * Nothing is notified. A report is not an accusation the subject gets to
   * answer — it is a queue item for Trust & Safety, and telling a creator they
   * have been reported before anyone has looked is how a review turns into an
   * argument.
   *
   * @param {object} payload
   * @param {string} payload.subjectType a `REPORT_SUBJECT` value
   * @param {string} payload.subjectId the reported record's id
   * @param {string} payload.reason a `REPORT_REASON` value
   * @param {string} [payload.details] up to {@link REPORT_DETAILS_MAX} characters
   * @param {string} [payload.reporterId] `usr_…` when somebody is signed in
   * @returns {Promise<object>} the created report
   * @throws {ApiError} `validation_failed` on an unknown subject type or reason
   *
   * **Future endpoint:** `POST /reports`, unauthenticated, rate-limited
   * server-side (the client-side guard in `ReportDialog` is a courtesy, not a
   * control — 00 §11).
   */
  fileReport({ subjectType, subjectId, reason, details, reporterId } = {}) {
    if (!Object.values(REPORT_SUBJECT).includes(subjectType) || !subjectId) {
      throw invalidInput('We could not tell what is being reported.', {
        subjectId: 'A portfolio item, creator profile, or content request is required.',
      })
    }
    if (!REASON_VALUES.includes(reason)) {
      throw invalidInput('Choose a reason for this report.', {
        reason: ['Pick the option that best describes your concern.'],
      })
    }

    const note = String(details ?? '').trim().slice(0, REPORT_DETAILS_MAX)

    return reports.create({
      subjectType,
      subjectId,
      reason,
      ...(note ? { details: note } : {}),
      ...(reporterId ? { reporterId } : {}),
      status: REPORT_STATUS.OPEN,
      createdAt: nowIso(),
    })
  },

  /**
   * **Records a triage outcome.** The primitive behind
   * {@link reportService.dismissReport} and {@link reportService.actionReport};
   * call those instead unless you genuinely mean "reviewed, decision pending".
   *
   * @param {string} reportId `rpt_…`
   * @param {object} payload
   * @param {string} payload.status one of {@link REPORT_RESOLUTIONS}
   * @param {string} [payload.note] what the admin concluded — stored, not sent
   * @param {object} payload.actor the signed-in admin (`id`, `role`)
   * @returns {Promise<object>} the updated report
   * @throws {ApiError} `validation_failed` · `not_found` · `conflict` when the
   *   report has already been closed
   *
   * **Future endpoint:** `PATCH /reports/:id`, authorised on `reports.manage`.
   */
  async resolveReport(reportId, { status, note, actor } = {}) {
    if (!REPORT_RESOLUTIONS.includes(status)) {
      throw invalidInput('That is not an outcome we record on a report.', {
        status: `Choose one of: ${REPORT_RESOLUTIONS.join(', ')}.`,
      })
    }
    if (!actor?.id) {
      throw invalidInput('We could not tell who is handling this report.', {
        actor: 'A signed-in admin is required.',
      })
    }

    const report = await reports.getById(reportId)
    if (!OPEN_REPORT_STATUSES.includes(report.status)) {
      throw createApiError(
        API_ERROR_CODE.CONFLICT,
        'This report has already been closed. Refresh to see the outcome.',
        { status: report.status },
        409
      )
    }

    const text = String(note ?? '').trim().slice(0, REPORT_NOTE_MAX)
    const updated = await reports.update(reportId, {
      status,
      handledById: actor.id,
      handledAt: nowIso(),
      ...(text ? { resolutionNote: text } : {}),
    })

    await quietly(() =>
      auditService.log({
        actorId: actor.id,
        actorRole: actor.role ?? ROLES.ADMIN,
        action: status === REPORT_STATUS.DISMISSED ? 'report.dismiss' : 'report.action',
        entityType: 'report',
        entityId: reportId,
        meta: {
          fromStatus: report.status,
          toStatus: status,
          subjectType: report.subjectType,
          subjectId: report.subjectId,
          reason: text || report.reason,
        },
      })
    )

    return updated
  },

  /**
   * **Closes a report with no action taken** — reviewed, and no breach found.
   *
   * @param {string} reportId `rpt_…`
   * @param {object} payload
   * @param {string} [payload.note] optional, but worth writing: the next report
   *   about the same content is read alongside this one
   * @param {object} payload.actor the signed-in admin
   * @returns {Promise<object>} the dismissed report
   */
  dismissReport(reportId, { note, actor } = {}) {
    return reportService.resolveReport(reportId, {
      status: REPORT_STATUS.DISMISSED,
      note,
      actor,
    })
  },

  /**
   * **Acts on a report.** Marks it `actioned` and, for a reported portfolio
   * item, puts the content in front of a reviewer: the case it already has, or
   * a new one opened for the purpose ({@link moderationService.ensureReviewForSubject}).
   *
   * Reported *profiles* and *requests* are not queued here — a profile is
   * handled on the account (Prompt 29's suspension path) and a brief on the
   * request board (Prompt 31). The report closes either way, and the screen
   * links the admin to the right place.
   *
   * **Mock sequence:**
   * 1. `GET /reports/:id` — guard, and read the subject
   * 2. `GET /moderationReviews?subjectId=…` — is it already in the queue?
   * 3. `POST /moderationReviews` when it is not
   * 4. `PATCH /reports/:id` → `{ status: 'actioned', handledById, handledAt }`
   * 5. `POST /auditLogs` → `report.action`
   *
   * @param {string} reportId `rpt_…`
   * @param {object} payload
   * @param {string} [payload.note] what was done, and why
   * @param {object} payload.actor the signed-in admin
   * @returns {Promise<{report: object, review: object|null, created: boolean}>}
   * @throws {ApiError} `not_found` · `conflict` (already closed)
   *
   * **Future endpoint:** `POST /reports/:id/action` — one transaction covering
   * the case upsert and the report update.
   */
  async actionReport(reportId, { note, actor } = {}) {
    const report = await reports.getById(reportId)

    let review = null
    let created = false

    if (report.subjectType === REPORT_SUBJECT.PORTFOLIO_ITEM) {
      const opened = await moderationService.ensureReviewForSubject({
        subjectType: MODERATION_SUBJECT.PORTFOLIO_ITEM,
        subjectId: report.subjectId,
        actor,
        note: note
          ? `Opened for review following a member report. ${note}`
          : 'Opened for review following a member report.',
      })
      review = opened.review
      created = opened.created
    }

    const updated = await reportService.resolveReport(reportId, {
      status: REPORT_STATUS.ACTIONED,
      note,
      actor,
    })

    return { report: updated, review, created }
  },

  /**
   * **The reports tab, ready to render** — reports with the reporter and the
   * content they are about attached.
   *
   * MOCK-JOIN + MOCK-SEARCH: same shape as
   * {@link moderationService.listReviewBoard}, and the same reason — the search
   * spans a join JSON Server cannot express, so one board's worth of reports is
   * read, enriched, filtered, and paged here. `total` is the true count for the
   * filters in effect.
   *
   * @param {object} [params]
   * @param {string[]} [params.statuses] `REPORT_STATUS` values (OR)
   * @param {string} [params.subjectType] a `REPORT_SUBJECT` value
   * @param {string} [params.search] reporter, subject title, reason, or id
   * @param {string} [params.from] ISO date — filed on or after
   * @param {string} [params.to] ISO date — filed on or before
   * @param {'asc'|'desc'} [params.order='asc'] oldest first, like the queue
   * @param {number} [params.page=1]
   * @param {number} [params.limit=12]
   * @returns {Promise<{items: object[], total: number, page: number, limit: number}>}
   *   each item carries `reporter`, `subject`, and `subjectTitle`
   */
  async listReportBoard({
    statuses,
    subjectType,
    search,
    from,
    to,
    order = SORT_ORDER.ASC,
    page = 1,
    limit = 12,
  } = {}) {
    const { items: rows } = await reportService.list({
      page: 1,
      limit: BOARD_LIMIT,
      sort: 'createdAt',
      order,
      filters: {
        subjectType,
        status: statuses?.length ? statuses : undefined,
        createdAt_gte: from || undefined,
        createdAt_lte: to || undefined,
      },
    })

    const idsFor = (type) =>
      Array.from(
        new Set(
          rows
            .filter((row) => row.subjectType === type)
            .map((row) => row.subjectId)
            .filter(Boolean)
        )
      ).slice(0, BOARD_LIMIT)

    const reporterIds = Array.from(
      new Set(rows.map((row) => row.reporterId).filter(Boolean))
    ).slice(0, BOARD_LIMIT)

    const [itemsById, profilesById, requestsById, reportersById] = await Promise.all([
      readByIds(portfolioItems, idsFor(REPORT_SUBJECT.PORTFOLIO_ITEM)),
      readByIds(creatorProfiles, idsFor(REPORT_SUBJECT.CREATOR_PROFILE)),
      readByIds(contentRequests, idsFor(REPORT_SUBJECT.REQUEST)),
      readByIds(users, reporterIds),
    ])

    const lookupFor = {
      [REPORT_SUBJECT.PORTFOLIO_ITEM]: itemsById,
      [REPORT_SUBJECT.CREATOR_PROFILE]: profilesById,
      [REPORT_SUBJECT.REQUEST]: requestsById,
    }

    const enriched = rows.map((row) => {
      const subject = lookupFor[row.subjectType]?.[row.subjectId] ?? null
      return {
        ...row,
        subject,
        subjectTitle: titleOf(row.subjectType, subject) ?? row.subjectId,
        reporter: row.reporterId ? (reportersById[row.reporterId] ?? null) : null,
      }
    })

    const term = String(search ?? '').trim().toLowerCase()
    const filtered = term
      ? enriched.filter((entry) =>
          [entry.subjectTitle, entry.reporter?.name, entry.reason, entry.id, entry.details]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(term)
        )
      : enriched

    const safeLimit = Math.max(1, limit)
    const safePage = Math.max(1, page)
    const start = (safePage - 1) * safeLimit

    return {
      items: filtered.slice(start, start + safeLimit),
      total: filtered.length,
      page: safePage,
      limit: safeLimit,
    }
  },

  /**
   * One report with everything the detail sheet shows: the reporter, the
   * content, and — for a reported profile or portfolio item — the account
   * behind it, so the sheet can link to Prompt 29's screen.
   *
   * Every join fails soft; the report itself does not.
   *
   * @param {string} reportId `rpt_…`
   * @returns {Promise<{report: object, reporter: object|null, subject: object|null,
   *   subjectTitle: string, owner: object|null, review: object|null}>}
   * @throws {ApiError} `not_found`
   */
  async getReportContext(reportId) {
    const report = await reports.getById(reportId)

    const [reporter, subject] = await Promise.all([
      report.reporterId ? quietly(() => users.getById(report.reporterId)) : Promise.resolve(null),
      quietly(() => SUBJECT_COLLECTION[report.subjectType]?.getById(report.subjectId) ?? null),
    ])

    // The owner is the account an admin would act on: a reported profile *is*
    // an account, and a reported item belongs to one through its storefront.
    const ownerProfileId =
      report.subjectType === REPORT_SUBJECT.CREATOR_PROFILE
        ? report.subjectId
        : (subject?.creatorId ?? null)

    const [owner, review] = await Promise.all([
      ownerProfileId
        ? quietly(async () => {
            const profile =
              report.subjectType === REPORT_SUBJECT.CREATOR_PROFILE
                ? subject
                : await creatorProfiles.getById(ownerProfileId)
            return profile?.userId ? users.getById(profile.userId) : null
          })
        : Promise.resolve(null),
      report.subjectType === REPORT_SUBJECT.PORTFOLIO_ITEM
        ? quietly(() =>
            moderationService.getBySubject(
              MODERATION_SUBJECT.PORTFOLIO_ITEM,
              report.subjectId
            )
          )
        : Promise.resolve(null),
    ])

    return {
      report,
      reporter,
      subject,
      subjectTitle: titleOf(report.subjectType, subject) ?? report.subjectId,
      owner,
      review,
    }
  },
})

export default reportService
