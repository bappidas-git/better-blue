// The marketplace-operations console's vocabulary: what each screen filters by,
// what it sorts by, and what its query string looks like — Prompt 31.
//
// Split out of the pages for the reason `users/utils/userDirectory.js` is: the
// page renders, this decides what a filter *means*. Both the table and the CSV
// export read from here, so a row on screen and its exported line can never
// disagree about which records a view contains.
//
// One file for four screens because they share the shape — a status filter, a
// date range, a search box, and a sort — and splitting that into four modules
// would repeat the date-boundary helper four times to prove they are separate.

import { ANNOUNCEMENT_AUDIENCE } from '@/services/notificationService'
import {
  ORDER_STATUS,
  PAYMENT_STATUS,
  REQUEST_STATUS,
  STATUS_META,
  TICKET_STATUS,
} from '@/constants/statuses'
import { listParam } from '@/hooks/useListParams'
import { EMPTY_PLACEHOLDER } from '@/utils/formatters'

/** Rows per page across the console. Admin density — single-line table rows. */
export const OPERATIONS_PAGE_SIZE = 20

/**
 * Ceiling on a CSV export: the provider's page limit (contract §4.1). A filtered
 * view above it exports one page's worth and **says so** rather than truncating
 * in silence (§13).
 */
export const OPERATIONS_EXPORT_LIMIT = 100

/**
 * Widens a date-only value (`YYYY-MM-DD`) to the instant it means, so a range
 * picked in a date field can be compared with an ISO timestamp. Getting this
 * wrong silently drops a day off either end of every filtered view.
 *
 * @param {string} [value] date-only or ISO
 * @param {'start'|'end'} edge which end of the day
 * @returns {string|undefined} an ISO timestamp, or `undefined` for no bound
 */
export function dayBoundary(value, edge) {
  if (!value) return undefined
  const raw = String(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  return edge === 'end' ? `${raw}T23:59:59.999Z` : `${raw}T00:00:00.000Z`
}

/** `{ value, label }` chips for a set of status values (labels from 00 §9). */
function statusOptions(values) {
  return Object.freeze(
    values.map((value) => Object.freeze({ value, label: STATUS_META[value]?.label ?? value }))
  )
}

/* -------------------------------------------------------------------------- */
/* Requests (§4.1)                                                            */
/* -------------------------------------------------------------------------- */

export const REQUEST_STATUS_VALUES = Object.values(REQUEST_STATUS)
export const REQUEST_STATUS_OPTIONS = statusOptions(REQUEST_STATUS_VALUES)

export const REQUEST_SORT = Object.freeze({
  NEWEST: 'newest',
  OLDEST: 'oldest',
  PROPOSALS: 'proposals',
  DEADLINE: 'deadline',
})

export const REQUEST_SORT_OPTIONS = Object.freeze([
  Object.freeze({ value: REQUEST_SORT.NEWEST, label: 'Newest first' }),
  Object.freeze({ value: REQUEST_SORT.OLDEST, label: 'Oldest first' }),
  Object.freeze({ value: REQUEST_SORT.PROPOSALS, label: 'Most proposals' }),
  Object.freeze({ value: REQUEST_SORT.DEADLINE, label: 'Deadline soonest' }),
])

const REQUEST_SORT_QUERY = Object.freeze({
  [REQUEST_SORT.NEWEST]: { sort: 'createdAt', order: 'desc' },
  [REQUEST_SORT.OLDEST]: { sort: 'createdAt', order: 'asc' },
  [REQUEST_SORT.PROPOSALS]: { sort: 'proposalsCount', order: 'desc' },
  [REQUEST_SORT.DEADLINE]: { sort: 'deadline', order: 'asc' },
})

/** `'proposals'` → `{ sort: 'proposalsCount', order: 'desc' }`. */
export function requestSortQuery(token) {
  return REQUEST_SORT_QUERY[token] ?? REQUEST_SORT_QUERY[REQUEST_SORT.NEWEST]
}

/** The table header's sort state → the token that produces it, or `null`. */
export function requestSortToken(field, direction) {
  const match = Object.entries(REQUEST_SORT_QUERY).find(
    ([, query]) => query.sort === field && query.order === direction
  )
  return match ? match[0] : null
}

/** The request board's query string (00 §12). Module scope — identity matters. */
export const REQUEST_OVERSIGHT_PARAMS = Object.freeze({
  q: listParam.text(),
  status: listParam.list({
    allow: (value) => REQUEST_STATUS_VALUES.includes(value),
    max: REQUEST_STATUS_VALUES.length,
  }),
  category: listParam.list({ max: 12 }),
  from: listParam.text({ maxLength: 10, group: 'created' }),
  to: listParam.text({ maxLength: 10, group: 'created' }),
  sort: listParam.choice({
    options: Object.values(REQUEST_SORT),
    fallback: REQUEST_SORT.NEWEST,
    isFilter: false,
  }),
  page: listParam.number({ fallback: 1, min: 1, integer: true, isFilter: false }),
})

/* -------------------------------------------------------------------------- */
/* Orders (§4.2)                                                              */
/* -------------------------------------------------------------------------- */

export const ORDER_STATUS_VALUES = Object.values(ORDER_STATUS)
export const ORDER_STATUS_OPTIONS = statusOptions(ORDER_STATUS_VALUES)

export const PAYMENT_STATUS_VALUES = Object.values(PAYMENT_STATUS)
export const PAYMENT_STATUS_OPTIONS = statusOptions(PAYMENT_STATUS_VALUES)

export const ORDER_SORT = Object.freeze({
  NEWEST: 'newest',
  OLDEST: 'oldest',
  DUE: 'due',
  VALUE: 'value',
})

export const ORDER_SORT_OPTIONS = Object.freeze([
  Object.freeze({ value: ORDER_SORT.NEWEST, label: 'Newest first' }),
  Object.freeze({ value: ORDER_SORT.OLDEST, label: 'Oldest first' }),
  Object.freeze({ value: ORDER_SORT.DUE, label: 'Due soonest' }),
  Object.freeze({ value: ORDER_SORT.VALUE, label: 'Highest value' }),
])

const ORDER_SORT_QUERY = Object.freeze({
  [ORDER_SORT.NEWEST]: { sort: 'createdAt', order: 'desc' },
  [ORDER_SORT.OLDEST]: { sort: 'createdAt', order: 'asc' },
  [ORDER_SORT.DUE]: { sort: 'deliveryDueAt', order: 'asc' },
  [ORDER_SORT.VALUE]: { sort: 'price', order: 'desc' },
})

/** `'due'` → `{ sort: 'deliveryDueAt', order: 'asc' }`. */
export function orderSortQuery(token) {
  return ORDER_SORT_QUERY[token] ?? ORDER_SORT_QUERY[ORDER_SORT.NEWEST]
}

/** The table header's sort state → the token that produces it, or `null`. */
export function orderSortToken(field, direction) {
  const match = Object.entries(ORDER_SORT_QUERY).find(
    ([, query]) => query.sort === field && query.order === direction
  )
  return match ? match[0] : null
}

export const ORDER_OVERSIGHT_PARAMS = Object.freeze({
  q: listParam.text(),
  status: listParam.list({
    allow: (value) => ORDER_STATUS_VALUES.includes(value),
    max: ORDER_STATUS_VALUES.length,
  }),
  payment: listParam.list({
    allow: (value) => PAYMENT_STATUS_VALUES.includes(value),
    max: PAYMENT_STATUS_VALUES.length,
  }),
  category: listParam.list({ max: 12 }),
  from: listParam.text({ maxLength: 10, group: 'created' }),
  to: listParam.text({ maxLength: 10, group: 'created' }),
  sort: listParam.choice({
    options: Object.values(ORDER_SORT),
    fallback: ORDER_SORT.NEWEST,
    isFilter: false,
  }),
  page: listParam.number({ fallback: 1, min: 1, integer: true, isFilter: false }),
})

/** SLA thresholds for the overdue badge, shared with the overview (Prompt 28). */
export const ORDER_DUE_SLA = Object.freeze({ warnAfterDays: 2, errorAfterDays: 5 })

/** Order states whose delivery date can still be missed. */
const LIVE_DELIVERY_STATUSES = [ORDER_STATUS.IN_PROGRESS, ORDER_STATUS.REVISION_REQUESTED]

/** Is this order past its delivery date with the work still outstanding? */
export function isOrderOverdue(order, now = new Date()) {
  if (!order?.deliveryDueAt) return false
  if (!LIVE_DELIVERY_STATUSES.includes(order.status)) return false
  return new Date(order.deliveryDueAt).getTime() < new Date(now).getTime()
}

/**
 * `ord_012` read as a human reads it in a queue. The full id stays in the
 * `EntityRefChip` tooltip, which is what somebody quotes in a ticket.
 */
export function shortId(id) {
  if (!id) return EMPTY_PLACEHOLDER
  const tail = String(id).split('_').pop()
  return `#${tail}`
}

/* -------------------------------------------------------------------------- */
/* Support (§4.3)                                                             */
/* -------------------------------------------------------------------------- */

export const TICKET_STATUS_VALUES = Object.values(TICKET_STATUS)
export const TICKET_STATUS_OPTIONS = statusOptions(TICKET_STATUS_VALUES)

export const TICKET_SORT = Object.freeze({
  NEWEST: 'newest',
  OLDEST: 'oldest',
})

export const TICKET_SORT_OPTIONS = Object.freeze([
  Object.freeze({ value: TICKET_SORT.NEWEST, label: 'Newest first' }),
  Object.freeze({ value: TICKET_SORT.OLDEST, label: 'Oldest first' }),
])

/** `'oldest'` → `{ sort: 'createdAt', order: 'asc' }`. */
export function ticketSortQuery(token) {
  return token === TICKET_SORT.OLDEST
    ? { sort: 'createdAt', order: 'asc' }
    : { sort: 'createdAt', order: 'desc' }
}

export const SUPPORT_QUEUE_PARAMS = Object.freeze({
  q: listParam.text(),
  status: listParam.list({
    allow: (value) => TICKET_STATUS_VALUES.includes(value),
    max: TICKET_STATUS_VALUES.length,
  }),
  from: listParam.text({ maxLength: 10, group: 'created' }),
  to: listParam.text({ maxLength: 10, group: 'created' }),
  sort: listParam.choice({
    options: Object.values(TICKET_SORT),
    fallback: TICKET_SORT.NEWEST,
    isFilter: false,
  }),
  ticket: listParam.text({ maxLength: 32, isFilter: false }),
  page: listParam.number({ fallback: 1, min: 1, integer: true, isFilter: false }),
})

/** How long a ticket may sit before the queue badge turns amber, then red. */
export const TICKET_SLA = Object.freeze({ warnAfterDays: 2, errorAfterDays: 5 })

/* -------------------------------------------------------------------------- */
/* Announcements (§4.4)                                                       */
/* -------------------------------------------------------------------------- */

/** The three audiences, with the sentence that says who each one really is. */
export const AUDIENCE_OPTIONS = Object.freeze([
  Object.freeze({
    value: ANNOUNCEMENT_AUDIENCE.ALL,
    label: 'All members',
    description: 'Every active buyer and creator. The admin team is not included.',
  }),
  Object.freeze({
    value: ANNOUNCEMENT_AUDIENCE.BUYERS,
    label: 'Buyers',
    description: 'Every active business account.',
  }),
  Object.freeze({
    value: ANNOUNCEMENT_AUDIENCE.CREATORS,
    label: 'Creators',
    description: 'Every active creator account.',
  }),
])

const AUDIENCE_LABELS = new Map(AUDIENCE_OPTIONS.map((option) => [option.value, option.label]))

/**
 * An audience's label, tolerant of the seeded audit entry's singular spelling
 * (`buyer`, `creator`) — the history reads records written before this screen
 * existed, and an unrecognised value is shown as itself rather than dropped.
 */
export function audienceLabel(value) {
  if (!value) return EMPTY_PLACEHOLDER
  const plural = String(value).endsWith('s') ? String(value) : `${value}s`
  return AUDIENCE_LABELS.get(value) ?? AUDIENCE_LABELS.get(plural) ?? String(value)
}
