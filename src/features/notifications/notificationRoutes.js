// Where a notification takes you — the one place a `NOTIFICATION_TYPE` becomes
// a URL (Prompt 27 §4.1).
//
// Three tables, no branching:
//
//   1. TYPE_TARGET   type → an abstract destination ("the order", "the money")
//   2. *_TARGETS     role → how that role reaches each destination
//   3. ADMIN_PENDING admin screens later prompts still have to build
//
// Splitting type from role is what stops this file turning into a nest of
// `if (role === …)`. "Payment released" means the same event to both parties and
// a different screen to each: the buyer reads it on their receipts, the creator
// on their earnings. The type says *money*; the role table says *which*.
//
// Rules a caller can rely on:
//   - an unknown or unmapped type resolves to the role's dashboard home;
//   - a destination that role does not have (a buyer has no portfolio) falls
//     back the same way, so a link is never dead;
//   - nothing here throws — a bell item must always be clickable.

import { env } from '@/config/env'
import { NOTIFICATION_ENTITY, NOTIFICATION_TYPE } from '@/constants/notificationTypes'
import { ROLES } from '@/constants/roles'
import { EARNINGS_TAB } from '@/features/earnings/earningsFilters'
import { paths } from '@/routes/paths'

/* -------------------------------------------------------------------------- */
/* 1. Type → destination                                                      */
/* -------------------------------------------------------------------------- */

/** The abstract destinations a notification can point at. */
const TARGET = Object.freeze({
  /** The brief, and the proposals on it. */
  REQUEST: 'request',
  /** The engagement — deliverables, revisions, timeline. */
  ORDER: 'order',
  /** The dispute thread. */
  DISPUTE: 'dispute',
  /** Wherever this role's money is listed: receipts, or earnings. */
  MONEY: 'money',
  /** Withdrawals specifically. */
  PAYOUTS: 'payouts',
  /** Submitted content and what the reviewers said about it. */
  CONTENT: 'content',
  /** The referral programme. */
  AFFILIATE: 'affiliate',
  /** The account itself — status, sign-in, preferences. */
  ACCOUNT: 'account',
  /** Nothing in particular: the dashboard home. */
  OVERVIEW: 'overview',
})

/**
 * Every `NOTIFICATION_TYPE`, mapped. The dev-only check at the bottom of this
 * file fails loudly if a later prompt adds a type and forgets this table.
 *
 * A few are worth stating out loud:
 *
 * - `proposal_accepted` points at the **order**, not the request: accepting is
 *   what creates the order, and the creator's next move is on it.
 * - `payment_released` and `payment_refunded` carry `entityType: 'order'` but
 *   point at the money — the question they raise is "where is it", and the order
 *   is one click from either ledger.
 * - `account_status_changed` is the one type whose destination differs in kind
 *   by role: the member reads it on their own settings, an admin on the account
 *   they acted on.
 */
const TYPE_TARGET = Object.freeze({
  [NOTIFICATION_TYPE.PROPOSAL_RECEIVED]: TARGET.REQUEST,
  [NOTIFICATION_TYPE.PROPOSAL_SHORTLISTED]: TARGET.REQUEST,
  [NOTIFICATION_TYPE.PROPOSAL_ACCEPTED]: TARGET.ORDER,
  [NOTIFICATION_TYPE.PROPOSAL_DECLINED]: TARGET.REQUEST,
  [NOTIFICATION_TYPE.ORDER_PAID]: TARGET.ORDER,
  [NOTIFICATION_TYPE.DELIVERY_SUBMITTED]: TARGET.ORDER,
  [NOTIFICATION_TYPE.REVISION_REQUESTED]: TARGET.ORDER,
  [NOTIFICATION_TYPE.DELIVERY_ACCEPTED]: TARGET.ORDER,
  [NOTIFICATION_TYPE.ORDER_COMPLETED]: TARGET.ORDER,
  [NOTIFICATION_TYPE.ORDER_CANCELLED]: TARGET.ORDER,
  [NOTIFICATION_TYPE.PAYMENT_RELEASED]: TARGET.MONEY,
  [NOTIFICATION_TYPE.PAYMENT_REFUNDED]: TARGET.MONEY,
  [NOTIFICATION_TYPE.PAYOUT_REQUESTED]: TARGET.PAYOUTS,
  [NOTIFICATION_TYPE.PAYOUT_PROCESSED]: TARGET.PAYOUTS,
  [NOTIFICATION_TYPE.DISPUTE_OPENED]: TARGET.DISPUTE,
  [NOTIFICATION_TYPE.DISPUTE_MESSAGE]: TARGET.DISPUTE,
  [NOTIFICATION_TYPE.DISPUTE_RESOLVED]: TARGET.DISPUTE,
  [NOTIFICATION_TYPE.MODERATION_APPROVED]: TARGET.CONTENT,
  [NOTIFICATION_TYPE.MODERATION_REJECTED]: TARGET.CONTENT,
  [NOTIFICATION_TYPE.MODERATION_REVISION]: TARGET.CONTENT,
  [NOTIFICATION_TYPE.ACCOUNT_STATUS_CHANGED]: TARGET.ACCOUNT,
  [NOTIFICATION_TYPE.AFFILIATE_CONVERSION]: TARGET.AFFILIATE,
  [NOTIFICATION_TYPE.AFFILIATE_PAYOUT]: TARGET.AFFILIATE,
  [NOTIFICATION_TYPE.SYSTEM_ANNOUNCEMENT]: TARGET.OVERVIEW,
})

/* -------------------------------------------------------------------------- */
/* 2. Role → route                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Reads `entityId` only when the notification actually points at that kind of
 * record. A `payment_released` row carries an order id; a `system_announcement`
 * carries nothing at all. Checking the type keeps a mismatched pair — an id of
 * the wrong kind — from being spliced into a URL that then 404s.
 */
const idOf = (notification, entityType) =>
  notification?.entityType === entityType ? notification.entityId : null

/** `null` means "this role has no such screen" — the caller falls back to home. */
const BUYER_TARGETS = Object.freeze({
  [TARGET.REQUEST]: (notification) => {
    const requestId = idOf(notification, NOTIFICATION_ENTITY.REQUEST)
    // The buyer's request detail opens on its Proposals tab (Prompt 18), which
    // is exactly what "you have a new proposal" is about — no tab param needed.
    return requestId ? paths.buyerRequestDetail(requestId) : paths.BUYER_REQUESTS
  },
  [TARGET.ORDER]: (notification) => {
    const orderId = idOf(notification, NOTIFICATION_ENTITY.ORDER)
    return orderId ? paths.buyerOrderDetail(orderId) : paths.BUYER_ORDERS
  },
  [TARGET.DISPUTE]: (notification) => {
    const disputeId = idOf(notification, NOTIFICATION_ENTITY.DISPUTE)
    return disputeId ? paths.buyerDisputeDetail(disputeId) : paths.BUYER_DISPUTES
  },
  [TARGET.MONEY]: () => paths.BUYER_PAYMENTS,
  // A buyer never withdraws anything. Their receipts are the nearest true
  // answer to a payment notification that arrived on the wrong role.
  [TARGET.PAYOUTS]: () => paths.BUYER_PAYMENTS,
  [TARGET.CONTENT]: () => null,
  // Prompt 34 mounts `/buyer/affiliate`; until then this falls back to home.
  [TARGET.AFFILIATE]: () => null,
  [TARGET.ACCOUNT]: () => paths.BUYER_SETTINGS,
  [TARGET.OVERVIEW]: () => paths.BUYER,
})

const CREATOR_TARGETS = Object.freeze({
  // Deliberately drops the request id. A creator's side of a brief is their
  // *proposal* on it — which is what shortlisting and declining change — and
  // that lives on the proposal manager. The brief is one click further on.
  [TARGET.REQUEST]: () => paths.CREATOR_PROPOSALS,
  [TARGET.ORDER]: (notification) => {
    const orderId = idOf(notification, NOTIFICATION_ENTITY.ORDER)
    return orderId ? paths.creatorOrderDetail(orderId) : paths.CREATOR_ORDERS
  },
  [TARGET.DISPUTE]: (notification) => {
    const disputeId = idOf(notification, NOTIFICATION_ENTITY.DISPUTE)
    return disputeId ? paths.creatorDisputeDetail(disputeId) : paths.CREATOR_DISPUTES
  },
  [TARGET.MONEY]: () => paths.CREATOR_EARNINGS,
  [TARGET.PAYOUTS]: () => paths.creatorEarningsTab(EARNINGS_TAB.PAYOUTS),
  [TARGET.CONTENT]: () => paths.CREATOR_PORTFOLIO,
  // Prompt 34 builds the creator affiliate screen.
  [TARGET.AFFILIATE]: () => null,
  [TARGET.ACCOUNT]: () => paths.CREATOR_SETTINGS,
  [TARGET.OVERVIEW]: () => paths.CREATOR,
})

const ADMIN_TARGETS = Object.freeze({
  [TARGET.REQUEST]: () => paths.ADMIN_REQUESTS,
  [TARGET.ORDER]: (notification) => {
    const orderId = idOf(notification, NOTIFICATION_ENTITY.ORDER)
    return orderId ? paths.adminOrderDetail(orderId) : paths.ADMIN_ORDERS
  },
  [TARGET.DISPUTE]: (notification) => {
    const disputeId = idOf(notification, NOTIFICATION_ENTITY.DISPUTE)
    return disputeId ? paths.adminDisputeDetail(disputeId) : paths.ADMIN_DISPUTES
  },
  [TARGET.MONEY]: () => paths.ADMIN_PAYMENTS,
  [TARGET.PAYOUTS]: () => paths.ADMIN_SETTLEMENTS,
  [TARGET.CONTENT]: (notification) => {
    const caseId = idOf(notification, NOTIFICATION_ENTITY.MODERATION_REVIEW)
    return caseId ? paths.adminModerationDetail(caseId) : paths.ADMIN_MODERATION
  },
  [TARGET.AFFILIATE]: () => paths.ADMIN_AFFILIATES,
  // An admin reading "account suspended" wants the account, not their own
  // preferences — the one destination that differs in kind rather than in URL.
  [TARGET.ACCOUNT]: (notification) => {
    const userId = idOf(notification, NOTIFICATION_ENTITY.USER)
    return userId ? paths.adminUserDetail(userId) : paths.ADMIN_USERS
  },
  [TARGET.OVERVIEW]: () => paths.ADMIN,
})

const TARGETS_BY_ROLE = Object.freeze({
  [ROLES.BUYER]: BUYER_TARGETS,
  [ROLES.CREATOR]: CREATOR_TARGETS,
  [ROLES.ADMIN]: ADMIN_TARGETS,
  [ROLES.SUPER_ADMIN]: ADMIN_TARGETS,
})

/* -------------------------------------------------------------------------- */
/* 3. Admin screens that do not exist yet                                     */
/* -------------------------------------------------------------------------- */

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║ DELETE YOUR LINE when you mount the screen.                              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * `ADMIN_TARGETS` above is written against the finished console, because a map
 * is easier to read whole than assembled over eight prompts. These are the
 * entries `routes/adminRoutes.jsx` has not mounted yet: a notification aimed at
 * one resolves to the admin home instead of the dashboard 404 that the
 * `/admin/*` catch-all would otherwise render.
 *
 * Detail routes are covered by their list path — `/admin/users/usr_1` is
 * pending while `/admin/users` is.
 */
const ADMIN_PENDING = Object.freeze([
  // Prompt 29 mounted `/admin/users` and `/admin/users/:userId`, so its line is
  // gone — an admin notification about an account now lands on the account.
  paths.ADMIN_MODERATION, // Prompt 30
  paths.ADMIN_REQUESTS, // Prompt 31
  paths.ADMIN_ORDERS, // Prompt 31
  paths.ADMIN_PAYMENTS, // Prompt 32
  paths.ADMIN_SETTLEMENTS, // Prompt 32
  paths.ADMIN_DISPUTES, // Prompt 33
  paths.ADMIN_AFFILIATES, // Prompt 34
])

const isPendingAdminPath = (path) =>
  ADMIN_PENDING.some((pending) => path === pending || path.startsWith(`${pending}/`))

/* -------------------------------------------------------------------------- */
/* Resolution                                                                 */
/* -------------------------------------------------------------------------- */

const isAdminRole = (role) => role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN

/** Reported once per unmapped type per session, rather than on every render. */
const warned = new Set()

function warnOnce(key, message) {
  if (!env.isDev || warned.has(key)) return
  warned.add(key)
  console.warn(`[notificationRoutes] ${message}`)
}

/**
 * **Where clicking this notification should go.**
 *
 * @param {object} notification a `notifications` record — `type`, and usually
 *   `entityType` + `entityId`
 * @param {string} role the reader's `ROLES` value (the *reader's*, not the
 *   emitter's: the same dispute row sends a buyer and an admin to different
 *   screens)
 * @returns {string} an in-app path, always. Falls back to the role's dashboard
 *   home for unknown types, missing ids, and destinations the role does not
 *   have.
 *
 * @example
 * navigate(getNotificationPath(notification, user.role))
 */
export function getNotificationPath(notification, role) {
  const targets = TARGETS_BY_ROLE[role] ?? BUYER_TARGETS
  const home = targets[TARGET.OVERVIEW]()

  const type = notification?.type
  const target = TYPE_TARGET[type]

  if (!target) {
    warnOnce(
      `type:${type}`,
      `No destination for notification type "${type}". Add it to TYPE_TARGET — ` +
        'it is currently landing members on their dashboard home.'
    )
    return home
  }

  const path = targets[target]?.(notification) ?? null
  if (!path) return home
  if (isAdminRole(role) && isPendingAdminPath(path)) return home

  return path
}

/**
 * Does this notification lead anywhere more specific than the dashboard home?
 * Used to decide whether a row renders as a link or as plain text.
 */
export function hasNotificationDestination(notification, role) {
  const targets = TARGETS_BY_ROLE[role] ?? BUYER_TARGETS
  return getNotificationPath(notification, role) !== targets[TARGET.OVERVIEW]()
}

/**
 * Dev-only completeness check (§4.1). Runs once at import: a type added to
 * `constants/notificationTypes.js` without a destination here says so in the
 * console the first time the notification centre loads, rather than silently
 * dropping members on their dashboard home months later.
 */
if (env.isDev) {
  const unmapped = Object.values(NOTIFICATION_TYPE).filter((type) => !TYPE_TARGET[type])
  if (unmapped.length > 0) {
    console.warn(
      `[notificationRoutes] ${unmapped.length} notification type(s) have no destination: ` +
        `${unmapped.join(', ')}. Add them to TYPE_TARGET.`
    )
  }
}

export default getNotificationPath
