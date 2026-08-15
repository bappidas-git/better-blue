import { ORDER_STATUS } from '@/constants/statuses'
import { discoveryParam } from '@/features/discovery/hooks/useDiscoveryParams'

// The vocabulary of the buyer's order list: which tab means which statuses,
// which sort token means which query, and how all of that is spelled in the URL
// (00 §12 — "filters sync to URL query params").
//
// Kept out of the page for the same reason the request list keeps its own
// (Prompt 18): the tab strip, the query behind the list, and the empty state
// each tab shows all need the same answer, and a tab added here needs no change
// anywhere else.

/* -------------------------------------------------------------------------- */
/* Tabs                                                                       */
/* -------------------------------------------------------------------------- */

export const ORDER_TAB = Object.freeze({
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CLOSED: 'closed',
  DISPUTED: 'disputed',
})

/**
 * The tab strip, in order.
 *
 * "Active" deliberately folds four statuses into one destination: from a
 * buyer's chair, an order that is waiting for payment, being worked on, waiting
 * on their review, or back with the creator is all the same thing — in flight.
 * The card says which of the four it is, and the progress line says whose move
 * it is.
 *
 * "Closed" folds cancelled and refunded together, because a buyer looking for
 * "the one that fell through" does not first ask themselves whether the money
 * came back.
 */
export const ORDER_TABS = Object.freeze([
  Object.freeze({
    key: ORDER_TAB.ACTIVE,
    label: 'Active',
    statuses: Object.freeze([
      ORDER_STATUS.PENDING_PAYMENT,
      ORDER_STATUS.IN_PROGRESS,
      ORDER_STATUS.DELIVERED,
      ORDER_STATUS.REVISION_REQUESTED,
    ]),
  }),
  Object.freeze({
    key: ORDER_TAB.COMPLETED,
    label: 'Completed',
    statuses: Object.freeze([ORDER_STATUS.COMPLETED]),
  }),
  Object.freeze({
    key: ORDER_TAB.CLOSED,
    label: 'Cancelled',
    statuses: Object.freeze([ORDER_STATUS.CANCELLED, ORDER_STATUS.REFUNDED]),
  }),
  Object.freeze({
    key: ORDER_TAB.DISPUTED,
    label: 'Disputed',
    statuses: Object.freeze([ORDER_STATUS.DISPUTED]),
  }),
])

const TAB_KEYS = Object.freeze(ORDER_TABS.map((tab) => tab.key))

/** The tab definition for a key, falling back to "Active" for anything unknown. */
export function tabByKey(key) {
  return ORDER_TABS.find((tab) => tab.key === key) ?? ORDER_TABS[0]
}

/**
 * The `status` filter a tab sends.
 *
 * The frozen array is returned **as-is** rather than copied: the result goes
 * straight into a `useApiQuery` dependency array, and a fresh array on every
 * render is a refetch on every render. Frozen at module scope, so handing the
 * same reference to every caller is safe.
 */
export function statusFilterForTab(key) {
  const { statuses } = tabByKey(key)
  if (!statuses) return undefined
  // A single-status tab sends a scalar so the query string stays readable;
  // several are OR'd by the adapter (contract §4.1).
  return statuses.length === 1 ? statuses[0] : statuses
}

/**
 * A tab's badge count, summed from `orderService.countsByStatus`.
 *
 * @param {string} key an `ORDER_TAB` value
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

export const ORDER_SORT = Object.freeze({
  NEWEST: 'newest',
  DUE: 'due',
  PRICE: 'price',
})

/** Sort token → the `{ sort, order }` pair the service takes (00 §10). */
const SORT_QUERY = Object.freeze({
  [ORDER_SORT.NEWEST]: Object.freeze({ sort: 'createdAt', order: 'desc' }),
  // Soonest first — a due-date list is a list of what is most urgent.
  [ORDER_SORT.DUE]: Object.freeze({ sort: 'deliveryDueAt', order: 'asc' }),
  [ORDER_SORT.PRICE]: Object.freeze({ sort: 'price', order: 'desc' }),
})

export const ORDER_SORT_OPTIONS = Object.freeze([
  Object.freeze({ value: ORDER_SORT.NEWEST, label: 'Newest first' }),
  Object.freeze({ value: ORDER_SORT.DUE, label: 'Due soonest' }),
  Object.freeze({ value: ORDER_SORT.PRICE, label: 'Highest value' }),
])

/** `{ sort, order }` for a sort token, falling back to newest-first. */
export function sortQueryFor(token) {
  return SORT_QUERY[token] ?? SORT_QUERY[ORDER_SORT.NEWEST]
}

/* -------------------------------------------------------------------------- */
/* URL schema                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Query keys for `/buyer/orders`, in the shape `useDiscoveryParams` takes.
 * Module scope, so its identity is stable across renders.
 */
export const BUYER_ORDER_PARAMS = Object.freeze({
  tab: discoveryParam.choice({ options: TAB_KEYS, fallback: ORDER_TAB.ACTIVE }),
  q: discoveryParam.text(),
  sort: discoveryParam.choice({
    options: Object.values(ORDER_SORT),
    fallback: ORDER_SORT.NEWEST,
    isFilter: false,
  }),
  page: discoveryParam.number({ fallback: 1, min: 1, max: 999, integer: true, isFilter: false }),
})

/** A link straight to one tab of the list, e.g. from the dashboard's stat tiles. */
export const ordersTabQuery = (tab) =>
  tab && tab !== ORDER_TAB.ACTIVE ? `?tab=${encodeURIComponent(tab)}` : ''
