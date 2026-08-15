import { REQUEST_STATUS } from '@/constants/statuses'
import { discoveryParam } from '@/features/discovery/hooks/useDiscoveryParams'

// The vocabulary of the buyer's request list: which tab means which statuses,
// which sort token means which query, and how all of that is spelled in the URL
// (00 §12 — "filters sync to URL query params").
//
// Kept out of the page because three separate things read it: the tab strip,
// the query the list runs, and the empty state each tab shows when it has
// nothing. A tab added here needs no change anywhere else.

/* -------------------------------------------------------------------------- */
/* Tabs                                                                       */
/* -------------------------------------------------------------------------- */

export const REQUEST_TAB = Object.freeze({
  ALL: 'all',
  DRAFTS: 'drafts',
  OPEN: 'open',
  AWARDED: 'awarded',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
})

/**
 * The tab strip, in order.
 *
 * `statuses` is `null` on "All" — an absent filter, not a filter for every
 * value, so the query stays a plain `?buyerId=`. The last tab folds the two
 * ways a brief ends without an order into one destination, because a buyer
 * looking for "the one I called off" does not first ask themselves whether they
 * closed it or cancelled it.
 */
export const REQUEST_TABS = Object.freeze([
  Object.freeze({ key: REQUEST_TAB.ALL, label: 'All', statuses: null }),
  Object.freeze({
    key: REQUEST_TAB.DRAFTS,
    label: 'Drafts',
    statuses: Object.freeze([REQUEST_STATUS.DRAFT]),
  }),
  Object.freeze({
    key: REQUEST_TAB.OPEN,
    label: 'Open',
    statuses: Object.freeze([REQUEST_STATUS.OPEN]),
  }),
  Object.freeze({
    key: REQUEST_TAB.AWARDED,
    label: 'Awarded',
    statuses: Object.freeze([REQUEST_STATUS.AWARDED]),
  }),
  Object.freeze({
    key: REQUEST_TAB.COMPLETED,
    label: 'Completed',
    statuses: Object.freeze([REQUEST_STATUS.COMPLETED]),
  }),
  Object.freeze({
    key: REQUEST_TAB.ARCHIVED,
    label: 'Closed',
    statuses: Object.freeze([REQUEST_STATUS.CANCELLED, REQUEST_STATUS.CLOSED]),
  }),
])

const TAB_KEYS = Object.freeze(REQUEST_TABS.map((tab) => tab.key))

/** The tab definition for a key, falling back to "All" for anything unknown. */
export function tabByKey(key) {
  return REQUEST_TABS.find((tab) => tab.key === key) ?? REQUEST_TABS[0]
}

/** The `status` filter a tab sends, or `undefined` for "All". */
export function statusFilterForTab(key) {
  const statuses = tabByKey(key).statuses
  if (!statuses) return undefined
  // A single-status tab sends a scalar so the query string stays readable;
  // several are OR'd by the adapter (contract §4.1).
  return statuses.length === 1 ? statuses[0] : [...statuses]
}

/**
 * A tab's badge count, summed from `requestService.countsByStatus`.
 *
 * @param {string} key a `REQUEST_TAB` value
 * @param {{total: number, byStatus: Object<string, number>}} [counts]
 * @returns {number|undefined} `undefined` while the counts are still loading —
 *   a tab reading "0" before anything has been counted is a small lie
 */
export function countForTab(key, counts) {
  if (!counts) return undefined
  const { statuses } = tabByKey(key)
  if (!statuses) return counts.total
  return statuses.reduce((sum, status) => sum + (counts.byStatus?.[status] ?? 0), 0)
}

/* -------------------------------------------------------------------------- */
/* Sorting                                                                    */
/* -------------------------------------------------------------------------- */

export const REQUEST_SORT = Object.freeze({
  NEWEST: 'newest',
  DEADLINE: 'deadline',
  PROPOSALS: 'proposals',
})

/** Sort token → the `{ sort, order }` pair the service takes (00 §10). */
const SORT_QUERY = Object.freeze({
  [REQUEST_SORT.NEWEST]: Object.freeze({ sort: 'createdAt', order: 'desc' }),
  // Soonest first — a deadline list is a list of what is most urgent.
  [REQUEST_SORT.DEADLINE]: Object.freeze({ sort: 'deadline', order: 'asc' }),
  [REQUEST_SORT.PROPOSALS]: Object.freeze({ sort: 'proposalsCount', order: 'desc' }),
})

export const REQUEST_SORT_OPTIONS = Object.freeze([
  Object.freeze({ value: REQUEST_SORT.NEWEST, label: 'Newest first' }),
  Object.freeze({ value: REQUEST_SORT.DEADLINE, label: 'Deadline' }),
  Object.freeze({ value: REQUEST_SORT.PROPOSALS, label: 'Most proposals' }),
])

/** `{ sort, order }` for a sort token, falling back to newest-first. */
export function sortQueryFor(token) {
  return SORT_QUERY[token] ?? SORT_QUERY[REQUEST_SORT.NEWEST]
}

/* -------------------------------------------------------------------------- */
/* URL schema                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Query keys for `/buyer/requests`, in the shape `useDiscoveryParams` takes
 * (Prompt 11 built that hook to be lifted like this). Module scope, so its
 * identity is stable across renders.
 */
export const BUYER_REQUEST_PARAMS = Object.freeze({
  tab: discoveryParam.choice({ options: TAB_KEYS, fallback: REQUEST_TAB.ALL }),
  q: discoveryParam.text(),
  sort: discoveryParam.choice({
    options: Object.values(REQUEST_SORT),
    fallback: REQUEST_SORT.NEWEST,
    isFilter: false,
  }),
  page: discoveryParam.number({ fallback: 1, min: 1, max: 999, integer: true, isFilter: false }),
})

/** A link straight to one tab of the list, e.g. from the dashboard's stat tiles. */
export const requestsTabQuery = (tab) =>
  tab && tab !== REQUEST_TAB.ALL ? `?tab=${encodeURIComponent(tab)}` : ''
