import { ORDER_STATUS } from '@/constants/statuses'
import { discoveryParam } from '@/features/discovery/hooks/useDiscoveryParams'

// The vocabulary of the creator's order list — the mirror of
// `buyerOrderFilters`, and separate from it because the two sides do not group
// an order the same way.
//
// A buyer folds "waiting on my payment", "being worked on", "waiting on my
// review", and "back with the creator" into one Active tab, because from their
// chair all four are simply in flight. A creator's day is the opposite: what
// they still have to *make* is one list, and what they have already handed over
// is another, because those are two entirely different feelings about the same
// order. Hence a Delivered tab of its own.

/* -------------------------------------------------------------------------- */
/* Tabs                                                                       */
/* -------------------------------------------------------------------------- */

export const CREATOR_ORDER_TAB = Object.freeze({
  ACTIVE: 'active',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  CLOSED: 'closed',
  DISPUTED: 'disputed',
})

/**
 * The tab strip, in order.
 *
 * `pending_payment` sits in **Active** alongside the two states a creator can
 * act on. Prompt 24 §4.3 names only those two, but an awarded order the buyer
 * has not funded yet is still the creator's live work — it has a due date and it
 * is what they are waiting on — and a tab strip that shows it nowhere would hide
 * an engagement from the person who won it. The card says which of the three it
 * is and whose move it is.
 *
 * "Closed" folds cancelled and refunded, for the same reason the buyer's list
 * does: someone looking for the one that fell through is not first asking
 * themselves where the money went.
 */
export const CREATOR_ORDER_TABS = Object.freeze([
  Object.freeze({
    key: CREATOR_ORDER_TAB.ACTIVE,
    label: 'Active',
    statuses: Object.freeze([
      ORDER_STATUS.PENDING_PAYMENT,
      ORDER_STATUS.IN_PROGRESS,
      ORDER_STATUS.REVISION_REQUESTED,
    ]),
  }),
  Object.freeze({
    key: CREATOR_ORDER_TAB.DELIVERED,
    label: 'Delivered',
    statuses: Object.freeze([ORDER_STATUS.DELIVERED]),
  }),
  Object.freeze({
    key: CREATOR_ORDER_TAB.COMPLETED,
    label: 'Completed',
    statuses: Object.freeze([ORDER_STATUS.COMPLETED]),
  }),
  Object.freeze({
    key: CREATOR_ORDER_TAB.CLOSED,
    label: 'Cancelled',
    statuses: Object.freeze([ORDER_STATUS.CANCELLED, ORDER_STATUS.REFUNDED]),
  }),
  Object.freeze({
    key: CREATOR_ORDER_TAB.DISPUTED,
    label: 'Disputed',
    statuses: Object.freeze([ORDER_STATUS.DISPUTED]),
  }),
])

const TAB_KEYS = Object.freeze(CREATOR_ORDER_TABS.map((tab) => tab.key))

/** The tab definition for a key, falling back to "Active" for anything unknown. */
export function creatorTabByKey(key) {
  return CREATOR_ORDER_TABS.find((tab) => tab.key === key) ?? CREATOR_ORDER_TABS[0]
}

/**
 * The `status` filter a tab sends.
 *
 * The frozen array is returned **as-is** rather than copied: it goes straight
 * into a `useApiQuery` dependency array, and a fresh array every render is a
 * refetch every render.
 */
export function creatorStatusFilterForTab(key) {
  const { statuses } = creatorTabByKey(key)
  if (!statuses) return undefined
  return statuses.length === 1 ? statuses[0] : statuses
}

/**
 * A tab's badge count, summed from `orderService.countsByCreatorStatus`.
 *
 * @returns {number|undefined} `undefined` while the counts load — a tab reading
 *   "0" before anything has been counted is a small lie
 */
export function creatorCountForTab(key, counts) {
  if (!counts) return undefined
  const { statuses } = creatorTabByKey(key)
  if (!statuses) return counts.total
  return statuses.reduce((sum, status) => sum + (counts.byStatus?.[status] ?? 0), 0)
}

/* -------------------------------------------------------------------------- */
/* Sorting                                                                    */
/* -------------------------------------------------------------------------- */

export const CREATOR_ORDER_SORT = Object.freeze({
  NEWEST: 'newest',
  DUE: 'due',
  EARNINGS: 'earnings',
})

/** Sort token → the `{ sort, order }` pair the service takes (00 §10). */
const SORT_QUERY = Object.freeze({
  [CREATOR_ORDER_SORT.NEWEST]: Object.freeze({ sort: 'createdAt', order: 'desc' }),
  // Soonest first — a due-date list is a list of what is most urgent.
  [CREATOR_ORDER_SORT.DUE]: Object.freeze({ sort: 'deliveryDueAt', order: 'asc' }),
  // The creator's money question is take-home, not order value, so this sorts
  // on the snapshot the earnings card prints rather than on `price`.
  [CREATOR_ORDER_SORT.EARNINGS]: Object.freeze({ sort: 'creatorEarnings', order: 'desc' }),
})

export const CREATOR_ORDER_SORT_OPTIONS = Object.freeze([
  Object.freeze({ value: CREATOR_ORDER_SORT.DUE, label: 'Due soonest' }),
  Object.freeze({ value: CREATOR_ORDER_SORT.NEWEST, label: 'Newest first' }),
  Object.freeze({ value: CREATOR_ORDER_SORT.EARNINGS, label: 'Highest earnings' }),
])

/** `{ sort, order }` for a sort token, falling back to due-soonest. */
export function creatorSortQueryFor(token) {
  return SORT_QUERY[token] ?? SORT_QUERY[CREATOR_ORDER_SORT.DUE]
}

/* -------------------------------------------------------------------------- */
/* URL schema                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Query keys for `/creator/orders`, in the shape `useDiscoveryParams` takes.
 * Module scope, so its identity is stable across renders.
 */
export const CREATOR_ORDER_PARAMS = Object.freeze({
  tab: discoveryParam.choice({ options: TAB_KEYS, fallback: CREATOR_ORDER_TAB.ACTIVE }),
  q: discoveryParam.text(),
  sort: discoveryParam.choice({
    options: Object.values(CREATOR_ORDER_SORT),
    fallback: CREATOR_ORDER_SORT.DUE,
    isFilter: false,
  }),
  page: discoveryParam.number({ fallback: 1, min: 1, max: 999, integer: true, isFilter: false }),
})

/** A link straight to one tab of the list, e.g. from the dashboard's stat tiles. */
export const creatorOrdersTabQuery = (tab) =>
  tab && tab !== CREATOR_ORDER_TAB.ACTIVE ? `?tab=${encodeURIComponent(tab)}` : ''
