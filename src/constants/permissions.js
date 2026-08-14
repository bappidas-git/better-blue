// Admin permissions — prompts/00-architecture-and-rules.md §11.
//
// `super_admin` implicitly holds every permission; `admin` accounts carry a
// `permissions` array of the keys below. Buyers and creators hold none.
//
// IMPORTANT: these checks are UX only. The future Laravel API must enforce
// every one of them independently — a permission-gated button that is merely
// hidden is not access control (00 §11 / §14).

import { ROLES } from './roles.js'

export const PERMISSIONS = Object.freeze({
  USERS_MANAGE: 'users.manage',
  ADMINS_MANAGE: 'admins.manage',
  MODERATION_REVIEW: 'moderation.review',
  CONTENT_MANAGE: 'content.manage',
  REPORTS_MANAGE: 'reports.manage',
  REQUESTS_MANAGE: 'requests.manage',
  ORDERS_MANAGE: 'orders.manage',
  CATEGORIES_MANAGE: 'categories.manage',
  AFFILIATES_MANAGE: 'affiliates.manage',
  PAYMENTS_MANAGE: 'payments.manage',
  SETTLEMENTS_PROCESS: 'settlements.process',
  DISPUTES_RESOLVE: 'disputes.resolve',
  SUPPORT_MANAGE: 'support.manage',
  SETTINGS_MANAGE: 'settings.manage',
  ANNOUNCEMENTS_SEND: 'announcements.send',
  AUDIT_VIEW: 'audit.view',
})

/** Every permission key. */
export const PERMISSION_VALUES = Object.freeze(Object.values(PERMISSIONS))

/**
 * Label + description per key. Both surface verbatim in the permission picker
 * and the roles matrix (Prompt 36), so descriptions state what the holder can
 * actually do.
 */
export const PERMISSION_META = Object.freeze({
  [PERMISSIONS.USERS_MANAGE]: Object.freeze({
    label: 'Manage users',
    description:
      'View buyer and creator accounts, verify creators, and suspend, reactivate, or blacklist accounts.',
  }),
  [PERMISSIONS.ADMINS_MANAGE]: Object.freeze({
    label: 'Manage admin team',
    description:
      'Create admin accounts, edit their permissions, and suspend team members. Held by super admins.',
  }),
  [PERMISSIONS.MODERATION_REVIEW]: Object.freeze({
    label: 'Review content',
    description:
      'Work the moderation queue: approve, request changes, reject, or restrict submitted content.',
  }),
  [PERMISSIONS.CONTENT_MANAGE]: Object.freeze({
    label: 'Manage published content',
    description:
      'Act on content that is already live — restrict, unrestrict, or archive portfolio items and deliverables.',
  }),
  [PERMISSIONS.REPORTS_MANAGE]: Object.freeze({
    label: 'Handle reports',
    description:
      'Triage member reports about content, profiles, or requests, and record the outcome.',
  }),
  [PERMISSIONS.REQUESTS_MANAGE]: Object.freeze({
    label: 'Manage content requests',
    description:
      'Oversee the request board — review briefs, close or cancel requests that breach the rules.',
  }),
  [PERMISSIONS.ORDERS_MANAGE]: Object.freeze({
    label: 'Manage orders',
    description:
      'Inspect any order, its deliveries and revisions, and intervene when an engagement stalls.',
  }),
  [PERMISSIONS.CATEGORIES_MANAGE]: Object.freeze({
    label: 'Manage categories',
    description:
      'Add, rename, reorder, and deactivate the marketplace categories creators and buyers choose from.',
  }),
  [PERMISSIONS.AFFILIATES_MANAGE]: Object.freeze({
    label: 'Manage affiliate program',
    description:
      'Review affiliate accounts, referrals, and earnings, and approve or void affiliate commissions.',
  }),
  [PERMISSIONS.PAYMENTS_MANAGE]: Object.freeze({
    label: 'Manage payments',
    description:
      'View payments, escrow balances, transactions, and commissions, and issue refunds where warranted.',
  }),
  [PERMISSIONS.SETTLEMENTS_PROCESS]: Object.freeze({
    label: 'Process settlements',
    description:
      'Approve, process, or reject creator payout requests and mark settlements as paid.',
  }),
  [PERMISSIONS.DISPUTES_RESOLVE]: Object.freeze({
    label: 'Resolve disputes',
    description:
      'Take ownership of disputes, request information from either party, and issue binding resolutions.',
  }),
  [PERMISSIONS.SUPPORT_MANAGE]: Object.freeze({
    label: 'Manage support',
    description:
      'Read and reply to support tickets and close them once the member has an answer.',
  }),
  [PERMISSIONS.SETTINGS_MANAGE]: Object.freeze({
    label: 'Manage platform settings',
    description:
      'Change commission rates, payout minimums, moderation rules, and feature flags.',
  }),
  [PERMISSIONS.ANNOUNCEMENTS_SEND]: Object.freeze({
    label: 'Send announcements',
    description:
      'Publish platform announcements to buyers, creators, or everyone on BetterBlue.',
  }),
  [PERMISSIONS.AUDIT_VIEW]: Object.freeze({
    label: 'View audit log',
    description:
      'Browse the immutable record of administrative actions taken across the platform.',
  }),
})

/**
 * Grouping for permission pickers and the roles matrix (Prompt 36).
 * Every key appears in exactly one group.
 */
export const PERMISSION_GROUPS = Object.freeze([
  Object.freeze({
    id: 'users',
    label: 'Users',
    description: 'Buyer, creator, and admin accounts.',
    permissions: Object.freeze([PERMISSIONS.USERS_MANAGE]),
  }),
  Object.freeze({
    id: 'content',
    label: 'Content',
    description: 'Moderation queue, published content, and member reports.',
    permissions: Object.freeze([
      PERMISSIONS.MODERATION_REVIEW,
      PERMISSIONS.CONTENT_MANAGE,
      PERMISSIONS.REPORTS_MANAGE,
    ]),
  }),
  Object.freeze({
    id: 'marketplace',
    label: 'Marketplace',
    description: 'Requests, orders, categories, and the affiliate program.',
    permissions: Object.freeze([
      PERMISSIONS.REQUESTS_MANAGE,
      PERMISSIONS.ORDERS_MANAGE,
      PERMISSIONS.CATEGORIES_MANAGE,
      PERMISSIONS.AFFILIATES_MANAGE,
    ]),
  }),
  Object.freeze({
    id: 'finance',
    label: 'Finance',
    description: 'Escrow payments, commissions, and creator settlements.',
    permissions: Object.freeze([
      PERMISSIONS.PAYMENTS_MANAGE,
      PERMISSIONS.SETTLEMENTS_PROCESS,
    ]),
  }),
  Object.freeze({
    id: 'disputes_support',
    label: 'Disputes & Support',
    description: 'Dispute resolution and member support.',
    permissions: Object.freeze([
      PERMISSIONS.DISPUTES_RESOLVE,
      PERMISSIONS.SUPPORT_MANAGE,
    ]),
  }),
  Object.freeze({
    id: 'platform',
    label: 'Platform',
    description: 'Configuration, the admin team, announcements, and audit.',
    permissions: Object.freeze([
      PERMISSIONS.SETTINGS_MANAGE,
      PERMISSIONS.ADMINS_MANAGE,
      PERMISSIONS.ANNOUNCEMENTS_SEND,
      PERMISSIONS.AUDIT_VIEW,
    ]),
  }),
])

/**
 * Starting point for a new admin: day-to-day marketplace operations, with
 * finance, platform configuration, and team management withheld until a super
 * admin grants them explicitly.
 */
export const DEFAULT_ADMIN_PERMISSIONS = Object.freeze([
  PERMISSIONS.USERS_MANAGE,
  PERMISSIONS.MODERATION_REVIEW,
  PERMISSIONS.CONTENT_MANAGE,
  PERMISSIONS.REPORTS_MANAGE,
  PERMISSIONS.REQUESTS_MANAGE,
  PERMISSIONS.ORDERS_MANAGE,
  PERMISSIONS.DISPUTES_RESOLVE,
  PERMISSIONS.SUPPORT_MANAGE,
])

/**
 * Does `user` hold `permission`?
 * super_admin → always true · admin → checks `user.permissions` · others → false.
 */
export function hasPermission(user, permission) {
  if (!user || !permission) return false
  if (user.role === ROLES.SUPER_ADMIN) return true
  if (user.role !== ROLES.ADMIN) return false
  return Array.isArray(user.permissions) && user.permissions.includes(permission)
}

/** Does `user` hold at least one of `permissions`? Used for nav filtering. */
export function hasAnyPermission(user, permissions = []) {
  if (!Array.isArray(permissions) || permissions.length === 0) return false
  return permissions.some((permission) => hasPermission(user, permission))
}
