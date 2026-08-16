// The users directory's vocabulary: its role presets, its filters, its sort
// options, and its URL schema — Prompt 29 §4.2.
//
// Split out of the page for the same reason `orders/utils/creatorOrderFilters.js`
// is: the page renders, this decides what a tab *means*. Both the table and the
// CSV export read the presets from here, so a row and its exported line can
// never disagree about which accounts a tab contains.

import { ACCOUNT_STATUS, STATUS_META } from '@/constants/statuses'
import { ROLES, ROLE_META } from '@/constants/roles'
import { listParam } from '@/hooks/useListParams'

/** Rows per page. Admin density — these are single-line table rows. */
export const USERS_PAGE_SIZE = 20

/**
 * Ceiling on a CSV export. The provider's page limit (contract §4.1); a filtered
 * view above it exports the first page's worth and says so rather than
 * truncating in silence.
 */
export const USERS_EXPORT_LIMIT = 100

/* -------------------------------------------------------------------------- */
/* Role presets                                                               */
/* -------------------------------------------------------------------------- */

/** Tab keys — stable, they appear in shared URLs. */
export const USER_TAB = Object.freeze({
  ALL: 'all',
  BUYERS: 'buyers',
  CREATORS: 'creators',
  TEAM: 'team',
})

/**
 * The four presets. `roles: null` means "no role filter at all" — the All tab
 * is the unfiltered directory, not the union of the other three.
 *
 * `readOnly` marks the tab whose rows carry no actions: team accounts are
 * managed on the Admin team screen (Prompt 36) with its own permission, and the
 * service refuses to act on them regardless of what any screen renders.
 */
export const USER_TABS = Object.freeze([
  Object.freeze({ key: USER_TAB.ALL, label: 'All', roles: null }),
  Object.freeze({ key: USER_TAB.BUYERS, label: 'Buyers', roles: [ROLES.BUYER] }),
  Object.freeze({ key: USER_TAB.CREATORS, label: 'Creators', roles: [ROLES.CREATOR] }),
  Object.freeze({
    key: USER_TAB.TEAM,
    label: 'Team',
    roles: [ROLES.ADMIN, ROLES.SUPER_ADMIN],
    readOnly: true,
  }),
])

const TAB_BY_KEY = new Map(USER_TABS.map((tab) => [tab.key, tab]))

/** The preset behind a tab key, falling back to All for anything unknown. */
export function userTab(key) {
  return TAB_BY_KEY.get(key) ?? TAB_BY_KEY.get(USER_TAB.ALL)
}

/** The `role` filter a tab resolves to — `undefined` on All. */
export function roleFilterForTab(key) {
  const roles = userTab(key).roles
  return roles ? [...roles] : undefined
}

/** Does this tab list accounts nobody can act on from here? */
export function isReadOnlyTab(key) {
  return Boolean(userTab(key).readOnly)
}

/* -------------------------------------------------------------------------- */
/* Filters and sorting                                                        */
/* -------------------------------------------------------------------------- */

/** Every account status, as filter chips — labels from `STATUS_META` (00 §9). */
export const ACCOUNT_STATUS_OPTIONS = Object.freeze(
  Object.values(ACCOUNT_STATUS).map((value) =>
    Object.freeze({ value, label: STATUS_META[value]?.label ?? value })
  )
)

const ACCOUNT_STATUS_VALUES = Object.values(ACCOUNT_STATUS)

/** Sort tokens → the `{ sort, order }` pair the service takes. */
export const USER_SORT = Object.freeze({
  NEWEST: 'newest',
  OLDEST: 'oldest',
  ACTIVE: 'recently_active',
  NAME: 'name',
})

export const USER_SORT_OPTIONS = Object.freeze([
  Object.freeze({ value: USER_SORT.NEWEST, label: 'Newest first' }),
  Object.freeze({ value: USER_SORT.OLDEST, label: 'Oldest first' }),
  Object.freeze({ value: USER_SORT.ACTIVE, label: 'Recently active' }),
  Object.freeze({ value: USER_SORT.NAME, label: 'Name (A–Z)' }),
])

const SORT_QUERY = Object.freeze({
  [USER_SORT.NEWEST]: { sort: 'createdAt', order: 'desc' },
  [USER_SORT.OLDEST]: { sort: 'createdAt', order: 'asc' },
  [USER_SORT.ACTIVE]: { sort: 'lastLoginAt', order: 'desc' },
  [USER_SORT.NAME]: { sort: 'name', order: 'asc' },
})

/** `'name'` → `{ sort: 'name', order: 'asc' }`. */
export function sortQueryFor(token) {
  return SORT_QUERY[token] ?? SORT_QUERY[USER_SORT.NEWEST]
}

/** The table header's sort state → the token that produces it, or `null`. */
export function sortTokenFor(field, direction) {
  const match = Object.entries(SORT_QUERY).find(
    ([, query]) => query.sort === field && query.order === direction
  )
  return match ? match[0] : null
}

/* -------------------------------------------------------------------------- */
/* URL schema                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The directory's query string (00 §12). Declared at module scope so its
 * identity is stable across renders, which is what `useListParams` requires.
 */
export const USER_DIRECTORY_PARAMS = Object.freeze({
  tab: listParam.choice({
    options: USER_TABS.map((tab) => tab.key),
    fallback: USER_TAB.ALL,
  }),
  q: listParam.text(),
  status: listParam.list({ allow: (value) => ACCOUNT_STATUS_VALUES.includes(value), max: 4 }),
  from: listParam.text({ maxLength: 10, group: 'joined' }),
  to: listParam.text({ maxLength: 10, group: 'joined' }),
  sort: listParam.choice({
    options: Object.values(USER_SORT),
    fallback: USER_SORT.NEWEST,
    isFilter: false,
  }),
  page: listParam.number({ fallback: 1, min: 1, integer: true, isFilter: false }),
})

/* -------------------------------------------------------------------------- */
/* Row helpers                                                                */
/* -------------------------------------------------------------------------- */

/** Role label for a chip — never `undefined`, even for a role we stop shipping. */
export function roleLabel(role) {
  return ROLE_META[role]?.label ?? role ?? '—'
}

/** Is this account one the directory offers actions on at all? */
export function isMemberRole(role) {
  return role === ROLES.BUYER || role === ROLES.CREATOR
}
