// The moderation console's vocabulary: its three queues, their filters, their
// sort, and the URL schema behind all of it — Prompt 30 §4.2.
//
// Split out of the pages for the same reason `users/utils/userDirectory.js` is:
// the pages render, this decides what a tab *means*. The queue screen and the
// review screen both read the sort and the filters from here, which is what
// lets "next case" on the detail page walk the queue in the order the reviewer
// was actually looking at.

import { REPORT_REASONS, REPORT_SUBJECT } from '@/constants/reports'
import {
  CONTENT_STATUS,
  MODERATION_SUBJECT,
  REPORT_STATUS,
  STATUS_META,
} from '@/constants/statuses'
import { listParam } from '@/hooks/useListParams'
import { DECIDED_QUEUE_STATUSES, OPEN_QUEUE_STATUSES } from '@/services/moderationService'

/** Cards per page. Media-forward rows, so fewer than a table's twenty. */
export const QUEUE_PAGE_SIZE = 12

/* -------------------------------------------------------------------------- */
/* Tabs                                                                       */
/* -------------------------------------------------------------------------- */

/** Tab keys — stable, they appear in shared URLs. */
export const MODERATION_TAB = Object.freeze({
  PORTFOLIO: 'portfolio',
  DELIVERIES: 'deliveries',
  REPORTS: 'reports',
})

/**
 * The three queues. `subjectType` is what the first two filter
 * `moderationReviews` by; Reports is a different collection entirely, which is
 * why it carries none.
 *
 * `countKey` matches `moderationService.getQueueCounts()`, so a tab and its
 * badge can never disagree about what is being counted.
 */
export const MODERATION_TABS = Object.freeze([
  Object.freeze({
    key: MODERATION_TAB.PORTFOLIO,
    label: 'Portfolio items',
    subjectType: MODERATION_SUBJECT.PORTFOLIO_ITEM,
    countKey: 'portfolioItems',
  }),
  Object.freeze({
    key: MODERATION_TAB.DELIVERIES,
    label: 'Deliverables',
    subjectType: MODERATION_SUBJECT.DELIVERY,
    countKey: 'deliveries',
  }),
  Object.freeze({
    key: MODERATION_TAB.REPORTS,
    label: 'Reports',
    subjectType: null,
    countKey: 'reports',
  }),
])

const TAB_BY_KEY = new Map(MODERATION_TABS.map((tab) => [tab.key, tab]))

/** The tab behind a key, falling back to the portfolio queue. */
export function moderationTab(key) {
  return TAB_BY_KEY.get(key) ?? TAB_BY_KEY.get(MODERATION_TAB.PORTFOLIO)
}

/* -------------------------------------------------------------------------- */
/* Filters and sorting                                                        */
/* -------------------------------------------------------------------------- */

const statusOption = (value) =>
  Object.freeze({ value, label: STATUS_META[value]?.label ?? value })

/**
 * Status chips on the two review queues. The open pair comes first and is what
 * an unfiltered visit selects — a moderation queue is a to-do list, and opening
 * it on "everything ever decided" would bury the four cases that matter.
 */
export const REVIEW_STATUS_OPTIONS = Object.freeze([
  ...OPEN_QUEUE_STATUSES.map(statusOption),
  ...DECIDED_QUEUE_STATUSES.map(statusOption),
])

/** The default selection: the open queue (00 §12 — filters live in the URL). */
export const DEFAULT_REVIEW_STATUSES = Object.freeze([...OPEN_QUEUE_STATUSES])

const REVIEW_STATUS_VALUES = REVIEW_STATUS_OPTIONS.map((option) => option.value)

/** Status chips on the reports queue. */
export const REPORT_STATUS_OPTIONS = Object.freeze(
  Object.values(REPORT_STATUS).map(statusOption)
)

/** Reports open on the two states that still need somebody. */
export const DEFAULT_REPORT_STATUSES = Object.freeze([
  REPORT_STATUS.OPEN,
  REPORT_STATUS.REVIEWED,
])

const REPORT_STATUS_VALUES = Object.values(REPORT_STATUS)

/** Subject-type chips on the reports queue. */
export const REPORT_SUBJECT_OPTIONS = Object.freeze([
  Object.freeze({ value: REPORT_SUBJECT.PORTFOLIO_ITEM, label: 'Portfolio items' }),
  Object.freeze({ value: REPORT_SUBJECT.CREATOR_PROFILE, label: 'Creator profiles' }),
  Object.freeze({ value: REPORT_SUBJECT.REQUEST, label: 'Content requests' }),
])

/** Sort tokens. Oldest first is the default — that is queue discipline (§6). */
export const QUEUE_SORT = Object.freeze({ OLDEST: 'oldest', NEWEST: 'newest' })

export const QUEUE_SORT_OPTIONS = Object.freeze([
  Object.freeze({ value: QUEUE_SORT.OLDEST, label: 'Oldest first' }),
  Object.freeze({ value: QUEUE_SORT.NEWEST, label: 'Newest first' }),
])

/** `'oldest'` → `'asc'`, which is what the services take. */
export function orderFor(token) {
  return token === QUEUE_SORT.NEWEST ? 'desc' : 'asc'
}

/* -------------------------------------------------------------------------- */
/* SLA                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * `AgeBadge` thresholds derived from `platformSettings.moderation.reviewSlaDays`.
 *
 * A case turns amber the day it breaches the SLA and red at twice it, so the
 * badge means the same thing as the number an admin can change in settings
 * (Prompt 35) rather than a constant somebody has to keep in step with it.
 *
 * @param {number} [reviewSlaDays=2] the configured turnaround
 * @returns {{warnAfterDays: number, errorAfterDays: number}}
 */
export function slaThresholds(reviewSlaDays = 2) {
  const days = Number(reviewSlaDays) > 0 ? Math.floor(Number(reviewSlaDays)) : 2
  return { warnAfterDays: days, errorAfterDays: days * 2 }
}

/* -------------------------------------------------------------------------- */
/* URL schema                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The console's query string (00 §12). One schema for all three tabs: the
 * status chips mean different things per tab, so `status` is validated against
 * the union and each tab narrows it — a chip left over from another tab simply
 * matches nothing rather than breaking the parse.
 *
 * Declared at module scope so its identity is stable across renders, which is
 * what `useListParams` requires.
 */
export const MODERATION_PARAMS = Object.freeze({
  tab: listParam.choice({
    options: MODERATION_TABS.map((tab) => tab.key),
    fallback: MODERATION_TAB.PORTFOLIO,
    isFilter: false,
  }),
  q: listParam.text(),
  status: listParam.list({
    allow: (value) =>
      REVIEW_STATUS_VALUES.includes(value) || REPORT_STATUS_VALUES.includes(value),
    max: 8,
  }),
  category: listParam.text({ maxLength: 40 }),
  subject: listParam.text({ maxLength: 40 }),
  from: listParam.text({ maxLength: 10, group: 'submitted' }),
  to: listParam.text({ maxLength: 10, group: 'submitted' }),
  sort: listParam.choice({
    options: Object.values(QUEUE_SORT),
    fallback: QUEUE_SORT.OLDEST,
    isFilter: false,
  }),
  page: listParam.number({ fallback: 1, min: 1, integer: true, isFilter: false }),
})

/**
 * The same schema, opening on Reports.
 *
 * `/admin/reports` is its own nav entry and its own permission (`reports.manage`)
 * but the same screen — a reporter's queue that could not see the review queues
 * beside it would make an admin open two tabs to work one problem. The only
 * difference is which tab an unparameterised visit lands on.
 */
export const REPORTS_PARAMS = Object.freeze({
  ...MODERATION_PARAMS,
  tab: listParam.choice({
    options: MODERATION_TABS.map((tab) => tab.key),
    fallback: MODERATION_TAB.REPORTS,
    isFilter: false,
  }),
})

/**
 * The statuses actually sent to the service for a tab.
 *
 * An empty selection means "the open queue", not "everything": that is what the
 * chips render as selected on a fresh visit, and the service call has to agree
 * with what the reviewer can see.
 */
export function statusesFor(tabKey, selected = []) {
  const allowed =
    tabKey === MODERATION_TAB.REPORTS ? REPORT_STATUS_VALUES : REVIEW_STATUS_VALUES
  const kept = selected.filter((value) => allowed.includes(value))
  if (kept.length > 0) return kept
  return tabKey === MODERATION_TAB.REPORTS
    ? [...DEFAULT_REPORT_STATUSES]
    : [...DEFAULT_REVIEW_STATUSES]
}

/* -------------------------------------------------------------------------- */
/* Row helpers                                                                */
/* -------------------------------------------------------------------------- */

/** Is this case still waiting on somebody? Drives the claim/decide affordances. */
export function isOpenCase(review) {
  return OPEN_QUEUE_STATUSES.includes(review?.status)
}

/** Has a reviewer taken it? */
export function isClaimed(review) {
  return review?.status === CONTENT_STATUS.UNDER_REVIEW && Boolean(review?.reviewerId)
}

/** Can this case be restricted — decided, approved, and therefore live? */
export function isRestrictable(review) {
  return (
    review?.status === CONTENT_STATUS.APPROVED || review?.status === CONTENT_STATUS.PUBLISHED
  )
}

/** How a report reason reads in the queue — re-exported so pages import one module. */
export { getReportReasonLabel, getReportSubjectMeta } from '@/constants/reports'

/** Every report reason, for the filter row and the detail sheet. */
export const REPORT_REASON_OPTIONS = Object.freeze(
  REPORT_REASONS.map((reason) => Object.freeze({ value: reason.value, label: reason.label }))
)
