// This module exports no components at all — it is pure nav data plus the
// helpers that resolve it — but `react-refresh` treats every `.jsx` file as a
// component module. The `.jsx` extension is fixed by the architecture spec, so
// the rule is switched off here rather than the filename changed.
/* eslint-disable react-refresh/only-export-components */

// Dashboard navigation — the data behind the sidebar, the mobile bottom bar,
// and the "More" sheet (00 §12). `layouts/dashboard/*` renders whatever it
// finds here and contains no per-role conditionals of its own.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ APPEND-ONLY. Never rebuild these arrays.                                 ║
// ║                                                                          ║
// ║ Every prompt that builds a dashboard screen appends its entry to the     ║
// ║ role's array (and, for admin, into the right group) with a **stable**    ║
// ║ `key`. Keys are referenced by `MORE_NAV_KEYS`, by the account menu, and  ║
// ║ by later badge wiring, so renaming one silently changes behaviour        ║
// ║ elsewhere. Order in the array is the order on screen: put a new entry    ║
// ║ where it belongs rather than at the end.                                 ║
// ║                                                                          ║
// ║ Only register a key once its route actually renders a page — a nav item  ║
// ║ pointing at an unbuilt path lands on the dashboard 404.                  ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//
// Entry shapes
// ------------
//   item   { key, label, icon, path, exact?, roles?, permission?, badgeKey? }
//   group  { key, group: 'Marketplace', items: [ …items ] }   // admin only
//
//   key         stable identifier, unique within the role
//   label       what the member reads — sentence case, one or two words
//   icon        Iconify name (`solar:*` / `tabler:*`, 00 §3). Unknown or
//               missing icons fall back to `NAV_FALLBACK_ICON`.
//   path        a constant from ./paths.js — never a URL literal (00 §2.6)
//   exact       match this path only, not its children. Set on role homes:
//               without it `/buyer` would stay highlighted on `/buyer/orders`.
//   roles       admin granularity — restrict an entry to e.g. super admins.
//               Omit on buyer/creator entries; the role already picked the array.
//   permission  a `PERMISSIONS` key (or an array — any one is enough). Filtered
//               through `hasPermission`, so a limited admin sees a shorter nav.
//   badgeKey    key into the `badges` map the layout passes down, e.g.
//               `'proposals.pending'`. Later prompts supply the counts; an
//               unknown key simply renders no badge.
//
// SECURITY: hiding a nav entry is not access control (00 §11). The route guard
// and, above all, the API must enforce the same rule.

import { hasAnyPermission, hasPermission } from '@/constants/permissions'
import { ROLES } from '@/constants/roles'

import { paths } from './paths'

/** Rendered when an entry's `icon` is missing or unknown (§13). */
export const NAV_FALLBACK_ICON = 'solar:widget-2-linear'

/** Hard ceiling on the mobile bar — four destinations plus "More" (00 §12). */
export const BOTTOM_NAV_SLOTS = 5

/**
 * Keys the layout looks up by name rather than by position: the account menu
 * and the notification bell link to these entries *if the role has registered
 * them*, and render nothing (or a "coming soon" tooltip) until then. That is
 * how Prompts 15/21/27 light those affordances up without touching the layout.
 */
export const NAV_KEY = Object.freeze({
  OVERVIEW: 'overview',
  PROFILE: 'profile',
  SETTINGS: 'settings',
  NOTIFICATIONS: 'notifications',
})

/**
 * Keys into the `badges` map `DashboardLayout` passes down, so an entry and the
 * query that feeds it agree on the spelling. Each prompt that adds a badge adds
 * its key here and fills it in the layout; an unknown key renders no badge, so
 * the two halves can land in either order.
 */
export const BADGE_KEY = Object.freeze({
  /** Proposals waiting on the buyer's decision (Prompt 18). */
  BUYER_PROPOSALS_AWAITING: 'buyer.proposalsAwaiting',
})

/* -------------------------------------------------------------------------- */
/* Buyer                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Prompts append: orders (20), payments (19), disputes (26), affiliate (34),
 * notifications (27). Requests and Orders belong between Overview and Profile
 * when they land — the account entries stay last.
 */
export const buyerNav = Object.freeze([
  Object.freeze({
    key: NAV_KEY.OVERVIEW,
    label: 'Overview',
    icon: 'solar:widget-5-linear',
    path: paths.BUYER,
    exact: true,
  }),
  Object.freeze({
    // Prompt 18 re-pointed this from the wizard to the list it belongs to, as
    // Prompt 16's note here asked. The key is unchanged, so nothing that
    // references it had to move. `/buyer/requests/new` is a child of this path,
    // so writing a brief keeps "Requests" highlighted.
    key: 'requests',
    label: 'Requests',
    icon: 'solar:clipboard-list-linear',
    path: paths.BUYER_REQUESTS,
    badgeKey: BADGE_KEY.BUYER_PROPOSALS_AWAITING,
  }),
  Object.freeze({
    key: NAV_KEY.PROFILE,
    label: 'Profile',
    icon: 'solar:buildings-3-linear',
    path: paths.BUYER_PROFILE,
  }),
  Object.freeze({
    key: NAV_KEY.SETTINGS,
    label: 'Settings',
    icon: 'solar:settings-linear',
    path: paths.BUYER_SETTINGS,
    // No badge: settings never nags.
  }),
])

/* -------------------------------------------------------------------------- */
/* Creator                                                                    */
/* -------------------------------------------------------------------------- */

/** Prompts append: browse (23), proposals (23), orders (24), portfolio (22), earnings (25), disputes (26), profile + settings (21), notifications (27). */
export const creatorNav = Object.freeze([
  Object.freeze({
    key: NAV_KEY.OVERVIEW,
    label: 'Overview',
    icon: 'solar:widget-5-linear',
    path: paths.CREATOR,
    exact: true,
  }),
])

/* -------------------------------------------------------------------------- */
/* Admin console                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Admin is the grouped variant: Overview sits on its own at the top and every
 * later section lands inside a group, e.g.
 *
 *   Object.freeze({
 *     key: 'marketplace',
 *     group: 'Marketplace',
 *     items: Object.freeze([
 *       Object.freeze({
 *         key: 'requests',
 *         label: 'Requests',
 *         icon: 'solar:clipboard-list-linear',
 *         path: paths.ADMIN_REQUESTS,
 *         permission: PERMISSIONS.REQUESTS_MANAGE,
 *       }),
 *     ]),
 *   })
 *
 * Groups whose items are all filtered out disappear with their heading, so a
 * Trust & Safety admin never sees an empty "Finance" section.
 *
 * Prompts append: users (29), moderation/reports (30), marketplace ops (31),
 * finance (32), disputes (33), affiliates (34), platform settings (35),
 * admin team + audit (36).
 */
export const adminNav = Object.freeze([
  Object.freeze({
    key: NAV_KEY.OVERVIEW,
    label: 'Overview',
    icon: 'solar:widget-5-linear',
    path: paths.ADMIN,
    exact: true,
  }),
])

/* -------------------------------------------------------------------------- */
/* Role resolution                                                            */
/* -------------------------------------------------------------------------- */

/** Role → nav. Admin and super admin share one array; `roles`/`permission` separate them. */
export const NAV_BY_ROLE = Object.freeze({
  [ROLES.BUYER]: buyerNav,
  [ROLES.CREATOR]: creatorNav,
  [ROLES.ADMIN]: adminNav,
  [ROLES.SUPER_ADMIN]: adminNav,
})

/**
 * Which keys collapse into the mobile "More" sheet, per role.
 *
 * The bottom bar shows at most {@link BOTTOM_NAV_SLOTS} slots: the first four
 * destinations a member actually needs on a phone, then "More". Everything
 * listed here is pushed into the sheet regardless of its position, so a role
 * can keep a sensible sidebar order while still promoting the right four
 * thumb-reachable destinations. Append the low-frequency keys — profile,
 * settings, affiliate, audit — as their entries arrive.
 */
export const MORE_NAV_KEYS = Object.freeze({
  // Profile stays on the bar — a buyer visits it while getting set up — and
  // Settings goes into the sheet, which leaves room for Requests and Orders
  // when Prompts 16 and 20 land.
  [ROLES.BUYER]: Object.freeze([NAV_KEY.SETTINGS]),
  [ROLES.CREATOR]: Object.freeze([]),
  [ROLES.ADMIN]: Object.freeze([]),
  [ROLES.SUPER_ADMIN]: Object.freeze([]),
})

/** True when `entry` is a group wrapper rather than a destination. */
export function isNavGroup(entry) {
  return Array.isArray(entry?.items)
}

/**
 * May `user` see this item? Role restriction first, then permission.
 *
 * @param {object} item a nav item
 * @param {object|null} user the signed-in member
 */
export function isNavItemVisible(item, user) {
  if (!item?.path) return false

  if (Array.isArray(item.roles) && item.roles.length > 0 && !item.roles.includes(user?.role)) {
    return false
  }

  if (item.permission) {
    return Array.isArray(item.permission)
      ? hasAnyPermission(user, item.permission)
      : hasPermission(user, item.permission)
  }

  return true
}

/**
 * Drops the entries `user` may not see, and any group left empty by that.
 *
 * @param {Array} entries items and/or groups
 * @param {object|null} user the signed-in member
 * @returns {Array} the same shape, filtered
 */
export function filterNavEntries(entries = [], user) {
  const kept = []

  for (const entry of entries) {
    if (isNavGroup(entry)) {
      const items = entry.items.filter((item) => isNavItemVisible(item, user))
      if (items.length > 0) kept.push({ ...entry, items })
      continue
    }
    if (isNavItemVisible(entry, user)) kept.push(entry)
  }

  return kept
}

/** Groups and items flattened into one ordered list of destinations. */
export function flattenNavEntries(entries = []) {
  return entries.flatMap((entry) => (isNavGroup(entry) ? entry.items : [entry]))
}

/** The nav a member should see: resolved by role, then filtered. */
export function getNavForUser(user) {
  return filterNavEntries(NAV_BY_ROLE[user?.role] ?? [], user)
}

/** Keys deferred to the "More" sheet for a role (`[]` for unknown roles). */
export function getMoreNavKeys(role) {
  return MORE_NAV_KEYS[role] ?? []
}

/** Looks a destination up by key — `undefined` until the prompt that adds it. */
export function findNavItem(entries = [], key) {
  return flattenNavEntries(entries).find((item) => item.key === key)
}

/**
 * Is `item` the destination currently on screen?
 *
 * Deep routes count: `/buyer/orders/ord_1` keeps Orders highlighted. Entries
 * flagged `exact` (the role homes) match their own path only.
 */
export function isNavItemActive(pathname, item) {
  if (!item?.path || !pathname) return false
  if (item.exact) return pathname === item.path
  return pathname === item.path || pathname.startsWith(`${item.path}/`)
}

/**
 * Splits a role's destinations into the mobile bar and the "More" sheet.
 *
 * The bar never exceeds {@link BOTTOM_NAV_SLOTS} tiles: when everything fits
 * and nothing was deferred, all of it stays on the bar and no "More" tile is
 * rendered; otherwise four destinations stay and the rest — deferred keys
 * included — move into the sheet, in their original order.
 *
 * @param {Array} items flattened destinations, already permission-filtered
 * @param {string[]} [moreKeys] keys to push into the sheet regardless of order
 * @returns {{primary: Array, more: Array}}
 */
export function splitBottomNav(items = [], moreKeys = [], maxSlots = BOTTOM_NAV_SLOTS) {
  const deferred = new Set(moreKeys)
  const promoted = items.filter((item) => !deferred.has(item.key))
  const collapsed = items.filter((item) => deferred.has(item.key))

  if (collapsed.length === 0 && promoted.length <= maxSlots) {
    return { primary: promoted, more: [] }
  }

  // One slot belongs to the "More" tile itself.
  const primaryCount = Math.max(maxSlots - 1, 0)
  const overflow = promoted.slice(primaryCount)

  return {
    primary: promoted.slice(0, primaryCount),
    more: items.filter((item) => overflow.includes(item) || deferred.has(item.key)),
  }
}
