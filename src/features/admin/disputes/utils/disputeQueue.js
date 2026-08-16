// The dispute console's vocabulary: what each tab means, what its filters can
// take, and how all of it is spelled in the URL (00 §12) — Prompt 33 §4.2.
//
// Split out of the pages for the reason `moderation/utils/moderationQueue.js`
// and `finance/utils/financeFilters.js` are: the pages render, this decides
// what a tab *is*. The queue screen and the workspace both read from it, so a
// row in a list and the case it opens can never disagree about which bucket it
// belongs in.
//
// Everything about *what an admin may do to a case* lives in `disputeService`
// (`canResolveDispute` and friends), read off `DISPUTE_STATUS_MACHINE`. This
// module never duplicates that judgement — it only groups and sorts.

import { DISPUTE_STATUS } from '@/constants/statuses'
import { ROLES } from '@/constants/roles'
import { DISPUTE_CATEGORY_OPTIONS } from '@/features/disputes/utils/disputeDisplay'
import { listParam } from '@/hooks/useListParams'
import { SORT_ORDER } from '@/services/api/listAdapter'
import {
  ACTIVE_DISPUTE_STATUSES,
  SETTLED_DISPUTE_STATUSES,
} from '@/services/disputeService'

/** Cases per page. Rich rows, and a queue nobody can see the bottom of is a bad queue. */
export const DISPUTE_QUEUE_PAGE_SIZE = 20

/**
 * Age thresholds for a case's `AgeBadge`, in days.
 *
 * Tighter than the escrow monitor's and looser than the moderation queue's,
 * which is the right middle: money is frozen and two people are waiting, but a
 * decision worth making is worth a couple of days of reading.
 */
export const DISPUTE_SLA = Object.freeze({ warnAfterDays: 3, errorAfterDays: 7 })

/* -------------------------------------------------------------------------- */
/* Tabs                                                                       */
/* -------------------------------------------------------------------------- */

/** Tab keys — stable, they appear in shared URLs. */
export const DISPUTE_QUEUE_TAB = Object.freeze({
  UNASSIGNED: 'unassigned',
  MINE: 'mine',
  AWAITING: 'awaiting',
  ESCALATED: 'escalated',
  SETTLED: 'settled',
})

/**
 * The five ways a reviewer thinks about the queue, in the order they think
 * about them: what nobody has picked up, what is mine, what is out with a
 * party, what needs somebody senior, and what is finished.
 *
 * `countKey` matches a field of `disputeService.getQueueCounts`, so the badge
 * and the list behind a tab are two views of one filter rather than two
 * definitions of one word.
 */
export const DISPUTE_QUEUE_TABS = Object.freeze([
  Object.freeze({
    key: DISPUTE_QUEUE_TAB.UNASSIGNED,
    label: 'Unassigned',
    countKey: 'unassigned',
  }),
  Object.freeze({ key: DISPUTE_QUEUE_TAB.MINE, label: 'Mine', countKey: 'mine' }),
  Object.freeze({
    key: DISPUTE_QUEUE_TAB.AWAITING,
    label: 'Awaiting parties',
    countKey: 'awaiting',
  }),
  Object.freeze({ key: DISPUTE_QUEUE_TAB.ESCALATED, label: 'Escalated', countKey: 'escalated' }),
  Object.freeze({ key: DISPUTE_QUEUE_TAB.SETTLED, label: 'Resolved & closed', countKey: 'settled' }),
])

const TAB_KEYS = DISPUTE_QUEUE_TABS.map((tab) => tab.key)

/** An assignee id nothing can match — see {@link filtersForTab}. */
const NOBODY = '__nobody__'

/** A tab entry by key, falling back to the first tab for anything unknown. */
export function disputeQueueTab(key) {
  return DISPUTE_QUEUE_TABS.find((tab) => tab.key === key) ?? DISPUTE_QUEUE_TABS[0]
}

/**
 * The service filters behind a tab.
 *
 * "Unassigned" is the `open` status rather than a null-assignee query on
 * purpose: `open` **is** the untriaged state (`assign` moves a case out of it),
 * and JSON Server has no reliable "field is empty" filter — a seeded case with
 * the key absent and a created one with it explicitly `null` would answer
 * differently (contract §4.3).
 *
 * @param {string} tab a `DISPUTE_QUEUE_TAB` value
 * @param {string} [adminId] the signed-in reviewer, for the "Mine" tab
 * @returns {object} filters for `disputeService.adminListQueue`
 */
export function filtersForTab(tab, adminId) {
  switch (tab) {
    case DISPUTE_QUEUE_TAB.MINE:
      // Without a reviewer there is nobody for a case to belong to, and the
      // sentinel matches no id — an empty "Mine" tab. Dropping the filter
      // instead would quietly show everybody's cases under a personal heading.
      return { assignedAdminId: adminId || NOBODY, status: [...ACTIVE_DISPUTE_STATUSES] }
    case DISPUTE_QUEUE_TAB.AWAITING:
      return { status: [DISPUTE_STATUS.AWAITING_BUYER, DISPUTE_STATUS.AWAITING_CREATOR] }
    case DISPUTE_QUEUE_TAB.ESCALATED:
      return { status: DISPUTE_STATUS.ESCALATED }
    case DISPUTE_QUEUE_TAB.SETTLED:
      return { status: [...SETTLED_DISPUTE_STATUSES] }
    case DISPUTE_QUEUE_TAB.UNASSIGNED:
    default:
      return { status: DISPUTE_STATUS.OPEN }
  }
}

/* -------------------------------------------------------------------------- */
/* Sorting                                                                    */
/* -------------------------------------------------------------------------- */

export const DISPUTE_SORT = Object.freeze({
  OLDEST: 'oldest',
  NEWEST: 'newest',
  ACTIVITY: 'activity',
})

export const DISPUTE_SORT_OPTIONS = Object.freeze([
  Object.freeze({ value: DISPUTE_SORT.OLDEST, label: 'Oldest first' }),
  Object.freeze({ value: DISPUTE_SORT.NEWEST, label: 'Newest first' }),
  Object.freeze({ value: DISPUTE_SORT.ACTIVITY, label: 'Recent activity' }),
])

const SORT_QUERY = Object.freeze({
  [DISPUTE_SORT.OLDEST]: { sort: 'createdAt', order: SORT_ORDER.ASC },
  [DISPUTE_SORT.NEWEST]: { sort: 'createdAt', order: SORT_ORDER.DESC },
  [DISPUTE_SORT.ACTIVITY]: { sort: 'updatedAt', order: SORT_ORDER.DESC },
})

/**
 * `'oldest'` → `{ sort: 'createdAt', order: 'asc' }`.
 *
 * Oldest-first is the default across the whole admin console and it matters
 * most here: the case somebody has been waiting on longest is the case to open,
 * and a newest-first queue quietly buries it.
 */
export function disputeSortQuery(token) {
  return SORT_QUERY[token] ?? SORT_QUERY[DISPUTE_SORT.OLDEST]
}

/* -------------------------------------------------------------------------- */
/* URL state                                                                  */
/* -------------------------------------------------------------------------- */

const CATEGORY_VALUES = DISPUTE_CATEGORY_OPTIONS.map((option) => option.value)

/** The category chips, straight from `DISPUTE_CATEGORY` (00 §9). */
export const DISPUTE_CATEGORY_FILTER_OPTIONS = Object.freeze(
  DISPUTE_CATEGORY_OPTIONS.map((option) =>
    Object.freeze({ value: option.value, label: option.label })
  )
)

/** URL schema for `/admin/disputes`. Module scope — `useListParams` needs stable identity. */
export const DISPUTE_QUEUE_PARAMS = Object.freeze({
  tab: listParam.choice({ options: TAB_KEYS, fallback: DISPUTE_QUEUE_TAB.UNASSIGNED }),
  q: listParam.text(),
  category: listParam.list({
    allow: (value) => CATEGORY_VALUES.includes(value),
    max: CATEGORY_VALUES.length,
  }),
  from: listParam.text({ maxLength: 10, group: 'raised' }),
  to: listParam.text({ maxLength: 10, group: 'raised' }),
  sort: listParam.choice({
    options: Object.values(DISPUTE_SORT),
    fallback: DISPUTE_SORT.OLDEST,
    isFilter: false,
  }),
  page: listParam.number({ fallback: 1, min: 1, integer: true, isFilter: false }),
})

/* -------------------------------------------------------------------------- */
/* Reading a queue row                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Which party a case is parked on, as a label — `null` when it is ours.
 *
 * @param {object} dispute
 * @returns {string|null}
 */
export function awaitingPartyLabel(dispute) {
  if (dispute?.status === DISPUTE_STATUS.AWAITING_BUYER) return 'Waiting on the buyer'
  if (dispute?.status === DISPUTE_STATUS.AWAITING_CREATOR) return 'Waiting on the creator'
  return null
}

/** The party-role label for one side of a case, for the avatar pair's tooltips. */
export function sideLabel(side) {
  return side === ROLES.CREATOR ? 'Creator' : 'Buyer'
}
