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

import { hasAnyPermission, hasPermission, PERMISSIONS } from '@/constants/permissions'
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
  /** Deliveries waiting on the buyer's review (Prompt 20). */
  BUYER_ORDERS_AWAITING_REVIEW: 'buyer.ordersAwaitingReview',
  /** Portfolio items rejected or sent back for changes (Prompt 22). */
  CREATOR_PORTFOLIO_ATTENTION: 'creator.portfolioAttention',
  /** Proposals a buyer has shortlisted and not yet decided on (Prompt 23). */
  CREATOR_PROPOSALS_SHORTLISTED: 'creator.proposalsShortlisted',
  /** Orders whose next move is the creator's — deliver, or answer a revision (Prompt 24). */
  CREATOR_ORDERS_AWAITING_DELIVERY: 'creator.ordersAwaitingDelivery',
  /**
   * Disputes waiting on this member's response (Prompt 26). One key for both
   * roles: the count is role-aware at the source — a buyer's is
   * `awaiting_buyer`, a creator's `awaiting_creator` — and only one of the two
   * navs is ever on screen.
   */
  DISPUTES_AWAITING_RESPONSE: 'disputes.awaitingResponse',
  /**
   * Unread notifications (Prompt 27). One key for every role — the count comes
   * from `useNotifications`, which is already per-member, and the layout fills
   * it once for whichever nav is on screen.
   */
  NOTIFICATIONS_UNREAD: 'notifications.unread',
})

/* -------------------------------------------------------------------------- */
/* Buyer                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Prompts append: affiliate (34). Requests, Orders, Payments, and Disputes
 * belong between Overview and Profile — the account entries stay last.
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
    // Prompt 20. Between Requests and Payments, which is the order the work
    // actually happens in: brief → engagement → money. The badge counts
    // deliveries waiting on a review — the one state where the marketplace is
    // waiting on the buyer and escrow is standing still.
    key: 'orders',
    label: 'Orders',
    icon: 'solar:box-linear',
    path: paths.BUYER_ORDERS,
    badgeKey: BADGE_KEY.BUYER_ORDERS_AWAITING_REVIEW,
  }),
  Object.freeze({
    // Prompt 19. Sits after Requests and Orders, before the account entries.
    key: 'payments',
    label: 'Payments',
    icon: 'solar:wallet-money-linear',
    path: paths.BUYER_PAYMENTS,
  }),
  Object.freeze({
    // Prompt 26. After Payments and before the account entries: a dispute is
    // about an order and its money, so it belongs at the end of that run. The
    // badge counts only the cases waiting on *this buyer* — a dispute our team
    // is quietly working through is not a task, and a permanent number here
    // would read as one.
    key: 'disputes',
    label: 'Disputes',
    icon: 'solar:shield-warning-linear',
    path: paths.BUYER_DISPUTES,
    badgeKey: BADGE_KEY.DISPUTES_AWAITING_RESPONSE,
  }),
  Object.freeze({
    // Prompt 27. The last of the work entries and the first of the account
    // ones — a feed of everything that happened is closer to "your account"
    // than to any one workflow, and the bell in the top bar is the fast path
    // anyway. The badge is the same unread count the bell carries.
    key: NAV_KEY.NOTIFICATIONS,
    label: 'Notifications',
    icon: 'solar:bell-linear',
    path: paths.BUYER_NOTIFICATIONS,
    badgeKey: BADGE_KEY.NOTIFICATIONS_UNREAD,
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

/**
 * Every entry this role needs is registered. Anything a later prompt adds
 * belongs **between** Overview and Profile — the account entries stay last, the
 * same order the buyer's nav keeps.
 */
export const creatorNav = Object.freeze([
  Object.freeze({
    key: NAV_KEY.OVERVIEW,
    label: 'Overview',
    icon: 'solar:widget-5-linear',
    path: paths.CREATOR,
    exact: true,
  }),
  Object.freeze({
    // Prompt 23. First after Overview because finding work is the reason a
    // creator opens the dashboard at all — the mirror of "Requests" sitting at
    // the top of the buyer's nav.
    key: 'browse',
    label: 'Browse requests',
    icon: 'solar:magnifer-linear',
    path: paths.CREATOR_BROWSE,
  }),
  Object.freeze({
    // Prompt 23. Straight after Browse: propose, then watch. The badge counts
    // the offers a buyer has *starred* — the one proposal state where something
    // good is happening and the creator should look.
    key: 'proposals',
    label: 'My proposals',
    icon: 'solar:document-add-linear',
    path: paths.CREATOR_PROPOSALS,
    badgeKey: BADGE_KEY.CREATOR_PROPOSALS_SHORTLISTED,
  }),
  Object.freeze({
    // Prompt 24. Straight after Proposals, which is the order the work happens
    // in: find the brief, win it, deliver it. The badge counts the orders whose
    // next move is the creator's — in progress or sent back for changes — which
    // is exactly the Active tab it links to, so the two can never disagree.
    key: 'orders',
    label: 'Orders',
    icon: 'solar:box-linear',
    path: paths.CREATOR_ORDERS,
    badgeKey: BADGE_KEY.CREATOR_ORDERS_AWAITING_DELIVERY,
  }),
  Object.freeze({
    // Prompt 25. Straight after Orders, which is where the money comes from —
    // the creator's mirror of "Payments" sitting after Orders in the buyer's
    // nav. **No badge, deliberately:** a balance is not a task, and a permanent
    // number beside "Earnings" would read as something needing attention every
    // single visit.
    key: 'earnings',
    label: 'Earnings',
    icon: 'solar:wallet-money-linear',
    path: paths.CREATOR_EARNINGS,
  }),
  Object.freeze({
    // Prompt 22. Above Profile because a storefront without sample work is the
    // thing most likely to be costing this creator briefs. The badge counts the
    // items a reviewer has handed back — the only portfolio state where the
    // marketplace is waiting on the creator rather than the other way round.
    key: 'portfolio',
    label: 'Portfolio',
    icon: 'solar:gallery-linear',
    path: paths.CREATOR_PORTFOLIO,
    badgeKey: BADGE_KEY.CREATOR_PORTFOLIO_ATTENTION,
  }),
  Object.freeze({
    // Prompt 26. The mirror of the buyer's entry, in the same place relative to
    // the account items: after the work and the money, before Profile. Same
    // badge key — the count behind it is role-aware.
    key: 'disputes',
    label: 'Disputes',
    icon: 'solar:shield-warning-linear',
    path: paths.CREATOR_DISPUTES,
    badgeKey: BADGE_KEY.DISPUTES_AWAITING_RESPONSE,
  }),
  Object.freeze({
    // Prompt 27. Same position as the buyer's, for the same reason.
    key: NAV_KEY.NOTIFICATIONS,
    label: 'Notifications',
    icon: 'solar:bell-linear',
    path: paths.CREATOR_NOTIFICATIONS,
    badgeKey: BADGE_KEY.NOTIFICATIONS_UNREAD,
  }),
  Object.freeze({
    // Prompt 21. "Profile" here means the public storefront, not the account —
    // the thing buyers read. The account lives under Settings.
    key: NAV_KEY.PROFILE,
    label: 'Profile',
    icon: 'solar:user-id-linear',
    path: paths.CREATOR_PROFILE,
  }),
  Object.freeze({
    key: NAV_KEY.SETTINGS,
    label: 'Settings',
    icon: 'solar:settings-linear',
    path: paths.CREATOR_SETTINGS,
    // No badge: settings never nags.
  }),
])

/* -------------------------------------------------------------------------- */
/* Admin console                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Admin is the grouped variant: Overview sits on its own at the top and every
 * later section lands inside a group. Groups whose items are all filtered out
 * disappear **with their heading**, so a Trust & Safety admin never sees an
 * empty "Finance" section — and a group whose items are all still commented out
 * renders nothing at all, which is why the whole skeleton can land at once.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║ Prompt 28 laid out the full console: every group in its final order, with ║
 * ║ every destination written out and **commented until its screen exists**.  ║
 * ║ The prompt that builds a screen uncomments its entry — nothing else — and ║
 * ║ adds `import { PERMISSIONS } from '@/constants/permissions'` at the top   ║
 * ║ of this file if it is not there yet — Prompt 29 added it, so it is there. ║
 * ║                                                                          ║
 * ║ Enabled now: Overview, Requests and Orders (Prompt 31), Disputes (33),    ║
 * ║ Users (29), Moderation and Reports (30), Payments, Settlements and        ║
 * ║ Commissions (32), Announcements and Support (31), and Notifications       ║
 * ║ (Prompt 27's shared page, at `paths.ADMIN_NOTIFICATIONS`).                 ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Order is deliberate — it follows what an admin does with their day: check the
 * state of things, work the marketplace, then people, then safety, then money,
 * then talk to members. Platform sits last and is super-admin only; Affiliates
 * is its own group rather than a Marketplace entry because it is a distinct
 * programme with a permission of its own.
 */
export const adminNav = Object.freeze([
  Object.freeze({
    key: NAV_KEY.OVERVIEW,
    label: 'Overview',
    icon: 'solar:widget-5-linear',
    path: paths.ADMIN,
    exact: true,
  }),

  Object.freeze({
    key: 'marketplace',
    group: 'Marketplace',
    items: Object.freeze([
      Object.freeze({
        // Prompt 31. An admin without `requests.manage` never sees this entry,
        // and `AdminPageGuard` inside the page refuses the typed URL too.
        key: 'requests',
        label: 'Requests',
        icon: 'solar:clipboard-list-linear',
        path: paths.ADMIN_REQUESTS,
        permission: PERMISSIONS.REQUESTS_MANAGE,
      }),
      Object.freeze({
        // Prompt 31. Straight after Requests, which is the order the work
        // happens in — brief, then engagement. `/admin/orders/:orderId` is a
        // child of this path, so a detail screen keeps "Orders" highlighted.
        key: 'orders',
        label: 'Orders',
        icon: 'solar:box-linear',
        path: paths.ADMIN_ORDERS,
        permission: PERMISSIONS.ORDERS_MANAGE,
      }),
      Object.freeze({
        // Prompt 33 — the admin side of the case queue, not the party-facing
        // screens Prompt 26 built for buyers and creators. Last in the group
        // because a dispute is what happens after a request and an order, and
        // an admin without `disputes.resolve` never sees the entry at all.
        key: 'disputes',
        label: 'Disputes',
        icon: 'solar:shield-warning-linear',
        path: paths.ADMIN_DISPUTES,
        permission: PERMISSIONS.DISPUTES_RESOLVE,
      }),
    ]),
  }),

  Object.freeze({
    key: 'users',
    group: 'Users',
    items: Object.freeze([
      Object.freeze({
        // Prompt 29. An admin without `users.manage` never sees this entry —
        // and `AdminPageGuard` inside the page refuses the typed URL too.
        key: 'users',
        label: 'Users',
        icon: 'solar:users-group-rounded-linear',
        path: paths.ADMIN_USERS,
        permission: PERMISSIONS.USERS_MANAGE,
      }),
    ]),
  }),

  Object.freeze({
    key: 'trust_safety',
    group: 'Trust & Safety',
    items: Object.freeze([
      Object.freeze({
        // Prompt 30. The queue screen; an admin without `moderation.review`
        // never sees it, and `AdminPageGuard` refuses the typed URL too.
        key: 'moderation',
        label: 'Moderation',
        icon: 'tabler:shield-check',
        path: paths.ADMIN_MODERATION,
        permission: PERMISSIONS.MODERATION_REVIEW,
      }),
      Object.freeze({
        // Prompt 30. The same screen opened on its reports tab, with its own
        // permission: triaging reports and reviewing content are different
        // jobs, and an admin can hold either without the other.
        key: 'reports',
        label: 'Reports',
        icon: 'solar:flag-linear',
        path: paths.ADMIN_REPORTS,
        permission: PERMISSIONS.REPORTS_MANAGE,
      }),
    ]),
  }),

  Object.freeze({
    key: 'finance',
    group: 'Finance',
    items: Object.freeze([
      Object.freeze({
        // Prompt 32. Overview, escrow, and the ledger on one screen; an admin
        // without `payments.manage` never sees this entry, and
        // `AdminPageGuard` inside the page refuses the typed URL too.
        key: 'payments',
        label: 'Payments',
        icon: 'solar:card-linear',
        path: paths.ADMIN_PAYMENTS,
        permission: PERMISSIONS.PAYMENTS_MANAGE,
      }),
      Object.freeze({
        // Prompt 32. Its own permission, because reading the money and moving
        // a creator's wages are different jobs.
        key: 'settlements',
        label: 'Settlements',
        icon: 'solar:wallet-money-linear',
        path: paths.ADMIN_SETTLEMENTS,
        permission: PERMISSIONS.SETTLEMENTS_PROCESS,
      }),
      Object.freeze({
        // Prompt 32 — commissions are read-only reporting on the same records,
        // so they ride on `payments.manage` rather than earning a permission.
        key: 'commissions',
        label: 'Commissions',
        icon: 'solar:hand-money-linear',
        path: paths.ADMIN_COMMISSIONS,
        permission: PERMISSIONS.PAYMENTS_MANAGE,
      }),
    ]),
  }),

  Object.freeze({
    key: 'affiliates',
    group: 'Affiliates',
    items: Object.freeze([
      // Prompt 34
      // Object.freeze({
      //   key: 'affiliates',
      //   label: 'Affiliates',
      //   icon: 'solar:users-group-two-rounded-linear',
      //   path: paths.ADMIN_AFFILIATES,
      //   permission: PERMISSIONS.AFFILIATES_MANAGE,
      // }),
    ]),
  }),

  Object.freeze({
    key: 'communication',
    group: 'Communication',
    items: Object.freeze([
      Object.freeze({
        // Prompt 31. Above Support because announcing is the rarer, heavier
        // action of the two and belongs at the top of the group rather than
        // buried under a queue somebody opens every day.
        key: 'announcements',
        label: 'Announcements',
        icon: 'solar:megaphone-linear',
        path: paths.ADMIN_ANNOUNCEMENTS,
        permission: PERMISSIONS.ANNOUNCEMENTS_SEND,
      }),
      Object.freeze({
        // Prompt 31. No badge: the count that would belong here is "open
        // tickets", and Prompt 28's badge map has no key for it. Adding one
        // means a query on every console page load, which is Prompt 36's call
        // to make once the console's badge story is settled.
        key: 'support',
        label: 'Support',
        icon: 'solar:chat-round-line-linear',
        path: paths.ADMIN_SUPPORT,
        permission: PERMISSIONS.SUPPORT_MANAGE,
      }),
      Object.freeze({
        // Prompt 28, using Prompt 27's shared notification centre — the same
        // page the buyer and creator navs point at, which reads the signed-in
        // role for its category chips. No permission: a member's own feed is
        // theirs whatever their console access.
        key: NAV_KEY.NOTIFICATIONS,
        label: 'Notifications',
        icon: 'solar:bell-linear',
        path: paths.ADMIN_NOTIFICATIONS,
        badgeKey: BADGE_KEY.NOTIFICATIONS_UNREAD,
      }),
    ]),
  }),

  Object.freeze({
    key: 'platform',
    group: 'Platform',
    // Every entry below also carries `roles: [ROLES.SUPER_ADMIN]`. The group
    // wrapper cannot gate on its own — `filterNavEntries` reads `roles` per
    // item — so the restriction is written where it is enforced, and an admin
    // granted `settings.manage` by mistake still would not see the section.
    items: Object.freeze([
      // Prompt 35
      // Object.freeze({
      //   key: 'settings',
      //   label: 'Settings',
      //   icon: 'solar:settings-linear',
      //   path: paths.ADMIN_SETTINGS,
      //   roles: [ROLES.SUPER_ADMIN],
      //   permission: PERMISSIONS.SETTINGS_MANAGE,
      // }),
      // Prompt 35
      // Object.freeze({
      //   key: 'categories',
      //   label: 'Categories',
      //   icon: 'solar:widget-4-linear',
      //   path: paths.ADMIN_CATEGORIES,
      //   roles: [ROLES.SUPER_ADMIN],
      //   permission: PERMISSIONS.CATEGORIES_MANAGE,
      // }),
      // Prompt 36
      // Object.freeze({
      //   key: 'admins',
      //   label: 'Admin team',
      //   icon: 'solar:shield-user-linear',
      //   path: paths.ADMIN_ADMINS,
      //   roles: [ROLES.SUPER_ADMIN],
      //   permission: PERMISSIONS.ADMINS_MANAGE,
      // }),
      // Prompt 36
      // Object.freeze({
      //   key: 'roles',
      //   label: 'Roles',
      //   icon: 'solar:key-square-linear',
      //   path: paths.ADMIN_ROLES,
      //   roles: [ROLES.SUPER_ADMIN],
      //   permission: PERMISSIONS.ADMINS_MANAGE,
      // }),
      // Prompt 36
      // Object.freeze({
      //   key: 'audit',
      //   label: 'Audit log',
      //   icon: 'solar:history-linear',
      //   path: paths.ADMIN_AUDIT,
      //   roles: [ROLES.SUPER_ADMIN],
      //   permission: PERMISSIONS.AUDIT_VIEW,
      // }),
    ]),
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
  // Settings is the only key explicitly deferred; with Orders added in
  // Prompt 20 the buyer's four thumb-reachable destinations are Overview,
  // Requests, Orders, and Payments, and `splitBottomNav` pushes Profile into
  // the sheet alongside Settings by overflow rather than by name. Prompt 26's
  // Disputes overflows the same way — and should: a dispute is read once every
  // few days at most, and its badge still shows inside the sheet. Prompt 27's
  // Notifications overflows too, and should: the bell sits in the top bar on
  // every mobile screen, so a second tile for the same feed would spend a thumb
  // slot on something already one tap away.
  [ROLES.BUYER]: Object.freeze([NAV_KEY.SETTINGS]),
  // Prompt 23 is the one Prompt 21's note anticipated: Browse and Proposals
  // take the creator to six destinations, so the two account entries move into
  // the sheet by name. Prompt 24's Orders entry makes seven, and it earns a
  // thumb slot ahead of Portfolio — an order has a deadline and a storefront
  // does not — so `splitBottomNav` overflows Portfolio into the sheet by
  // position. Prompt 25's Earnings makes eight and overflows the same way: a
  // balance is checked, not worked on, and it is one tap into the More sheet.
  // Prompt 26's Disputes overflows for the same reason, and so does Prompt 27's
  // Notifications — the top-bar bell already covers it on a phone. The bar reads
  // Overview · Browse · Proposals · Orders, with More holding Earnings,
  // Disputes, Portfolio, Notifications, Profile, and Settings.
  [ROLES.CREATOR]: Object.freeze([NAV_KEY.PROFILE, NAV_KEY.SETTINGS]),
  // Prompt 28 left this empty and Prompt 31 keeps it that way. The console now
  // has nine live destinations, so `splitBottomNav` overflows by position:
  // Overview, Requests, Orders, and Users take the four thumb slots, and
  // Moderation, Reports, Announcements, Support, and Notifications go into the
  // sheet. That is the right split without naming anything — the heavier
  // screens all sit below Users in the sidebar already, and which four a given
  // admin ends up with correctly depends on their permissions. Prompts 32–36
  // should add a key here only if their screen is one an admin would open on a
  // phone *less* often than whatever it would otherwise push out.
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
