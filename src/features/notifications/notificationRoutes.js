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
  // An admin took a brief down (`requestService.closeRequest`). It is addressed
  // to the buyer who wrote it, carries `entityType: 'request'`, and the thing
  // they will want is the brief itself and the reason on it.
  [NOTIFICATION_TYPE.REQUEST_CLOSED]: TARGET.REQUEST,
  // Storefront V2: a creator replied on one of this buyer's feeds. It carries
  // `entityType: 'request'` and the feed's `req_…`, so it lands the buyer on
  // that brief. **Honest limitation:** the thread itself has no buyer-facing
  // screen yet — V2-08 builds the creator's side of it, and reading replies as
  // the buyer is future work. The brief is the nearest true destination, and it
  // is never a dead link.
  [NOTIFICATION_TYPE.FEED_REPLY_RECEIVED]: TARGET.REQUEST,
  // Storefront V2 (V2-09): a buyer messaged this creator from `/creators`. It
  // carries no `entityType`/`entityId` at all, because there is nothing to
  // point at — **the creator-side inbox is future work**, and the message lives
  // in `directMessages` with this notification as the only surface that
  // mentions it. The dashboard home is the honest destination until that screen
  // exists; it is never a dead link.
  [NOTIFICATION_TYPE.DIRECT_MESSAGE_RECEIVED]: TARGET.OVERVIEW,
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
  // Prompt 34 mounted `/buyer/affiliate`. The screen gates itself on the
  // `affiliateProgram` flag; with the flag off it renders its own "not
  // available" state, which is a truer answer than the dashboard home.
  [TARGET.AFFILIATE]: () => paths.BUYER_AFFILIATE,
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
  // Prompt 34 shipped referrals as a *buyer* programme — `affiliateService`
  // only converts referred sign-ups whose role is `buyer`, and the only nav
  // entry is `buyerNav`'s. There is no creator screen to point at, so an
  // affiliate notification that reached a creator falls back to home.
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
/* 3. Admin screens that do not exist yet — none left                         */
/* -------------------------------------------------------------------------- */

// `ADMIN_TARGETS` was written against the finished console, so while it was
// being assembled over eight prompts an `ADMIN_PENDING` list held the paths
// `routes/adminRoutes.jsx` had not mounted yet, and resolution bounced those to
// the admin home rather than the `/admin/*` catch-all's 404.
//
// Prompt 36 mounted the last of them. Every path `ADMIN_TARGETS` can return is
// now a live route — verified against `adminRoutes.jsx` in the Prompt 37
// hardening pass — so the list and its guard are gone, and an admin
// notification about a request, an order, or the referral programme lands on
// that screen instead of on the dashboard home.

/* -------------------------------------------------------------------------- */
/* Resolution                                                                 */
/* -------------------------------------------------------------------------- */

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
