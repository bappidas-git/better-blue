// The route registry — every URL in BetterBlue, declared once.
//
// 00 §2.6: routes are only referenced through this module. Nothing else in
// `src/` may contain a URL literal, which keeps a rename to one place and makes
// the rule grep-verifiable. The whole product is declared up front (grouped by
// the prompt that builds the pages) so later prompts only append elements to
// the route tables in `src/routes/*Routes.jsx` — the router shape never has to
// change to make room for a screen.
//
// Naming rules:
// - `SCREAMING_SNAKE` values are concrete, navigable paths — link straight to them.
// - `*_PATTERN` values carry `:params` and exist for `<Route path>` matching only.
//   Never put one in a `to=`; call its camelCase builder instead.
// - camelCase members are those builders: `paths.creatorProfile('cpr_ava')`.

import { ROLES } from '@/constants/roles'

/** Substitutes `:param` placeholders in a route pattern with encoded values. */
function fill(pattern, values) {
  return pattern.replace(/:([A-Za-z0-9_]+)/g, (token, key) =>
    values[key] == null ? token : encodeURIComponent(String(values[key]))
  )
}

export const paths = Object.freeze({
  /* Public — marketing, discovery, and the signed-out shell ---------------- */
  /* Prompt 08 (shell) · 10 (landing) · 11 (discovery) · 12 (static pages) */
  HOME: '/',
  CREATORS: '/creators',
  CREATOR_PROFILE_PATTERN: '/creators/:creatorId',
  REQUESTS: '/requests',
  REQUEST_DETAIL_PATTERN: '/requests/:requestId',
  HOW_IT_WORKS: '/how-it-works',
  CONTENT_POLICY: '/content-policy',
  PRICING: '/pricing',
  FAQ: '/faq',
  ABOUT: '/about',
  CONTACT: '/contact',
  TERMS: '/terms',
  PRIVACY: '/privacy',
  /** Affiliate landing link — Prompt 32 stores the code and redirects home. */
  REFERRAL_PATTERN: '/r/:code',

  /* Auth — rendered inside AuthLayout, behind GuestRoute (Prompt 09) ------- */
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',

  /* Buyer dashboard (Prompts 14–23, 30, 32) ------------------------------- */
  BUYER: '/buyer',
  BUYER_REQUESTS: '/buyer/requests',
  BUYER_REQUEST_NEW: '/buyer/requests/new',
  BUYER_REQUEST_DETAIL_PATTERN: '/buyer/requests/:requestId',
  BUYER_CHECKOUT_PATTERN: '/buyer/checkout/:orderId',
  BUYER_ORDERS: '/buyer/orders',
  BUYER_ORDER_DETAIL_PATTERN: '/buyer/orders/:orderId',
  BUYER_PAYMENTS: '/buyer/payments',
  BUYER_DISPUTES: '/buyer/disputes',
  BUYER_DISPUTE_DETAIL_PATTERN: '/buyer/disputes/:disputeId',
  BUYER_AFFILIATE: '/buyer/affiliate',
  BUYER_NOTIFICATIONS: '/buyer/notifications',
  BUYER_PROFILE: '/buyer/profile',
  BUYER_SETTINGS: '/buyer/settings',
  /**
   * Splat that keeps the **whole** `/buyer` subtree behind the guards (00 §11),
   * including URLs no prompt has built yet: a signed-out visitor deep-linking
   * one is sent to sign in and returned to it, rather than shown a public 404
   * that loses where they were going. React Router ranks static paths above a
   * splat, so every real route above wins over this one.
   */
  BUYER_CATCH_ALL: '/buyer/*',

  /* Creator dashboard (Prompts 14–23, 30) --------------------------------- */
  CREATOR: '/creator',
  CREATOR_BROWSE: '/creator/browse',
  CREATOR_PROPOSALS: '/creator/proposals',
  CREATOR_ORDERS: '/creator/orders',
  CREATOR_ORDER_DETAIL_PATTERN: '/creator/orders/:orderId',
  CREATOR_PORTFOLIO: '/creator/portfolio',
  CREATOR_EARNINGS: '/creator/earnings',
  CREATOR_DISPUTES: '/creator/disputes',
  CREATOR_DISPUTE_DETAIL_PATTERN: '/creator/disputes/:disputeId',
  CREATOR_NOTIFICATIONS: '/creator/notifications',
  CREATOR_PROFILE: '/creator/profile',
  CREATOR_SETTINGS: '/creator/settings',
  /** Guarded splat for the creator subtree — see `BUYER_CATCH_ALL`. */
  CREATOR_CATCH_ALL: '/creator/*',

  /* Admin console (Prompts 24–31, 33–35) ---------------------------------- */
  ADMIN: '/admin',
  ADMIN_USERS: '/admin/users',
  ADMIN_USER_DETAIL_PATTERN: '/admin/users/:userId',
  ADMIN_MODERATION: '/admin/moderation',
  ADMIN_MODERATION_DETAIL_PATTERN: '/admin/moderation/:moderationId',
  ADMIN_REQUESTS: '/admin/requests',
  ADMIN_ORDERS: '/admin/orders',
  ADMIN_ORDER_DETAIL_PATTERN: '/admin/orders/:orderId',
  ADMIN_PAYMENTS: '/admin/payments',
  ADMIN_SETTLEMENTS: '/admin/settlements',
  ADMIN_COMMISSIONS: '/admin/commissions',
  ADMIN_DISPUTES: '/admin/disputes',
  ADMIN_DISPUTE_DETAIL_PATTERN: '/admin/disputes/:disputeId',
  ADMIN_REPORTS: '/admin/reports',
  ADMIN_SUPPORT: '/admin/support',
  ADMIN_ANNOUNCEMENTS: '/admin/announcements',
  ADMIN_AFFILIATES: '/admin/affiliates',
  ADMIN_ADMINS: '/admin/admins',
  ADMIN_ROLES: '/admin/roles',
  ADMIN_SETTINGS: '/admin/settings',
  ADMIN_CATEGORIES: '/admin/categories',
  ADMIN_AUDIT: '/admin/audit',
  ADMIN_NOTIFICATIONS: '/admin/notifications',
  /** Guarded splat for the admin subtree — see `BUYER_CATCH_ALL`. */
  ADMIN_CATCH_ALL: '/admin/*',

  /* Dev-only (Prompt 08) — mounted behind env.enableDevPages + DEV build --- */
  DEV_DESIGN: '/dev/design',

  /** Splat used by the 404 route. Matches whatever the router could not. */
  CATCH_ALL: '*',

  /* Builders — the only sanctioned way to link to a `*_PATTERN` route ------ */

  /**
   * Where a role lands after signing in (00 §9). Used by the guards and the
   * post-login redirect in Prompt 09.
   */
  roleHome: (role) => ROLE_HOME[role] ?? paths.HOME,

  /** Public creator profile, e.g. `/creators/cpr_ava_martinez`. */
  creatorProfile: (creatorId) => fill(paths.CREATOR_PROFILE_PATTERN, { creatorId }),
  /** Public content-request detail, e.g. `/requests/req_verde_reels`. */
  requestDetail: (requestId) => fill(paths.REQUEST_DETAIL_PATTERN, { requestId }),
  /** Affiliate referral landing, e.g. `/r/NORA25`. */
  referral: (code) => fill(paths.REFERRAL_PATTERN, { code }),

  buyerRequestDetail: (requestId) => fill(paths.BUYER_REQUEST_DETAIL_PATTERN, { requestId }),
  buyerCheckout: (orderId) => fill(paths.BUYER_CHECKOUT_PATTERN, { orderId }),
  buyerOrderDetail: (orderId) => fill(paths.BUYER_ORDER_DETAIL_PATTERN, { orderId }),
  buyerDisputeDetail: (disputeId) => fill(paths.BUYER_DISPUTE_DETAIL_PATTERN, { disputeId }),

  creatorOrderDetail: (orderId) => fill(paths.CREATOR_ORDER_DETAIL_PATTERN, { orderId }),
  creatorDisputeDetail: (disputeId) => fill(paths.CREATOR_DISPUTE_DETAIL_PATTERN, { disputeId }),

  adminUserDetail: (userId) => fill(paths.ADMIN_USER_DETAIL_PATTERN, { userId }),
  adminModerationDetail: (moderationId) =>
    fill(paths.ADMIN_MODERATION_DETAIL_PATTERN, { moderationId }),
  adminOrderDetail: (orderId) => fill(paths.ADMIN_ORDER_DETAIL_PATTERN, { orderId }),
  adminDisputeDetail: (disputeId) => fill(paths.ADMIN_DISPUTE_DETAIL_PATTERN, { disputeId }),
})

/** Role → dashboard root, resolved lazily by `paths.roleHome`. */
const ROLE_HOME = Object.freeze({
  [ROLES.BUYER]: paths.BUYER,
  [ROLES.CREATOR]: paths.CREATOR,
  [ROLES.ADMIN]: paths.ADMIN,
  [ROLES.SUPER_ADMIN]: paths.ADMIN,
})

export default paths
