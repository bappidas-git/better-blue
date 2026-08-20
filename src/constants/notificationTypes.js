// Notification types — prompts/00-architecture-and-rules.md §9.
//
// `notificationService.notify({ type, … })` (Prompt 07) only ever emits values
// from `NOTIFICATION_TYPE`. `NOTIFICATION_META` drives the icon and tone shown
// in the bell menu, the notifications center (Prompt 27), and dashboard
// activity feeds (Prompt 14); `category` groups types for the per-category
// preference toggles.

/** Preference categories — one toggle row each in notification settings. */
export const NOTIFICATION_CATEGORY = Object.freeze({
  MARKETPLACE: 'marketplace',
  ORDERS: 'orders',
  PAYMENTS: 'payments',
  DISPUTES: 'disputes',
  MODERATION: 'moderation',
  AFFILIATE: 'affiliate',
  SYSTEM: 'system',
})

export const NOTIFICATION_TYPE = Object.freeze({
  PROPOSAL_RECEIVED: 'proposal_received',
  PROPOSAL_SHORTLISTED: 'proposal_shortlisted',
  PROPOSAL_ACCEPTED: 'proposal_accepted',
  PROPOSAL_DECLINED: 'proposal_declined',
  // Prompt 31 addition: BetterBlue closing a buyer's brief administratively.
  // The proposers already had `proposal_declined`; the **buyer** had nothing —
  // their brief would simply have stopped being open, with the reason visible
  // only to somebody who went looking for it.
  REQUEST_CLOSED: 'request_closed',
  // Storefront V2 addition (prompts-v2/03): a creator opened a reply thread on
  // one of this buyer's feeds. Deliberately **not** `proposal_received` — a
  // reply is a conversation, not a priced offer, and putting the two under one
  // type would tell a buyer they have an offer to review when they do not.
  FEED_REPLY_RECEIVED: 'feed_reply_received',
  ORDER_PAID: 'order_paid',
  DELIVERY_SUBMITTED: 'delivery_submitted',
  REVISION_REQUESTED: 'revision_requested',
  DELIVERY_ACCEPTED: 'delivery_accepted',
  ORDER_COMPLETED: 'order_completed',
  // Prompt 17 addition: the escrow workflow ends an order three ways, and
  // cancellation and refund had no type of their own. Reusing `order_completed`
  // for a cancelled order would have put a green tick on bad news.
  ORDER_CANCELLED: 'order_cancelled',
  PAYMENT_RELEASED: 'payment_released',
  PAYMENT_REFUNDED: 'payment_refunded',
  PAYOUT_REQUESTED: 'payout_requested',
  PAYOUT_PROCESSED: 'payout_processed',
  DISPUTE_OPENED: 'dispute_opened',
  DISPUTE_MESSAGE: 'dispute_message',
  DISPUTE_RESOLVED: 'dispute_resolved',
  MODERATION_APPROVED: 'moderation_approved',
  MODERATION_REJECTED: 'moderation_rejected',
  MODERATION_REVISION: 'moderation_revision',
  ACCOUNT_STATUS_CHANGED: 'account_status_changed',
  AFFILIATE_CONVERSION: 'affiliate_conversion',
  AFFILIATE_PAYOUT: 'affiliate_payout',
  SYSTEM_ANNOUNCEMENT: 'system_announcement',
})

/**
 * Category labels for the preference screen. Descriptions explain what a
 * member stops seeing if they switch the category off.
 */
export const NOTIFICATION_CATEGORY_META = Object.freeze({
  [NOTIFICATION_CATEGORY.MARKETPLACE]: Object.freeze({
    label: 'Requests & proposals',
    description:
      'New proposals on your requests, and decisions on the proposals you send.',
  }),
  [NOTIFICATION_CATEGORY.ORDERS]: Object.freeze({
    label: 'Orders & deliveries',
    description:
      'Order milestones: funding, deliveries, revision requests, and completion.',
  }),
  [NOTIFICATION_CATEGORY.PAYMENTS]: Object.freeze({
    label: 'Payments & payouts',
    description: 'Escrow releases and payouts to your bank account.',
  }),
  [NOTIFICATION_CATEGORY.DISPUTES]: Object.freeze({
    label: 'Disputes',
    description: 'Updates on disputes you are party to, including new messages.',
  }),
  [NOTIFICATION_CATEGORY.MODERATION]: Object.freeze({
    label: 'Content reviews',
    description:
      'Decisions from the Trust & Safety team on content you submitted.',
  }),
  [NOTIFICATION_CATEGORY.AFFILIATE]: Object.freeze({
    label: 'Affiliate program',
    description: 'Referral conversions and affiliate commission payouts.',
  }),
  [NOTIFICATION_CATEGORY.SYSTEM]: Object.freeze({
    label: 'Account & announcements',
    description:
      'Account status changes and important BetterBlue announcements.',
  }),
})

/**
 * `{ label, icon, tone, category }` per type. Icons are Iconify names from the
 * professional `solar` set (00 §3); tones match `STATUS_TONES`.
 */
export const NOTIFICATION_META = Object.freeze({
  [NOTIFICATION_TYPE.PROPOSAL_RECEIVED]: Object.freeze({
    label: 'Proposal received',
    icon: 'solar:document-add-linear',
    tone: 'info',
    category: NOTIFICATION_CATEGORY.MARKETPLACE,
  }),
  [NOTIFICATION_TYPE.PROPOSAL_SHORTLISTED]: Object.freeze({
    label: 'Proposal shortlisted',
    icon: 'solar:star-linear',
    tone: 'brand',
    category: NOTIFICATION_CATEGORY.MARKETPLACE,
  }),
  [NOTIFICATION_TYPE.PROPOSAL_ACCEPTED]: Object.freeze({
    label: 'Proposal accepted',
    icon: 'solar:check-circle-linear',
    tone: 'success',
    category: NOTIFICATION_CATEGORY.MARKETPLACE,
  }),
  [NOTIFICATION_TYPE.FEED_REPLY_RECEIVED]: Object.freeze({
    label: 'New reply on your feed',
    icon: 'solar:chat-round-line-linear',
    tone: 'info',
    category: NOTIFICATION_CATEGORY.MARKETPLACE,
  }),
  [NOTIFICATION_TYPE.PROPOSAL_DECLINED]: Object.freeze({
    label: 'Proposal declined',
    icon: 'solar:close-circle-linear',
    tone: 'neutral',
    category: NOTIFICATION_CATEGORY.MARKETPLACE,
  }),
  [NOTIFICATION_TYPE.REQUEST_CLOSED]: Object.freeze({
    label: 'Request closed',
    icon: 'solar:clipboard-remove-linear',
    tone: 'warning',
    category: NOTIFICATION_CATEGORY.MARKETPLACE,
  }),
  [NOTIFICATION_TYPE.ORDER_PAID]: Object.freeze({
    label: 'Order funded',
    icon: 'solar:card-linear',
    tone: 'success',
    category: NOTIFICATION_CATEGORY.ORDERS,
  }),
  [NOTIFICATION_TYPE.DELIVERY_SUBMITTED]: Object.freeze({
    label: 'Delivery submitted',
    icon: 'solar:box-linear',
    tone: 'info',
    category: NOTIFICATION_CATEGORY.ORDERS,
  }),
  [NOTIFICATION_TYPE.REVISION_REQUESTED]: Object.freeze({
    label: 'Revision requested',
    icon: 'solar:restart-linear',
    tone: 'warning',
    category: NOTIFICATION_CATEGORY.ORDERS,
  }),
  [NOTIFICATION_TYPE.DELIVERY_ACCEPTED]: Object.freeze({
    label: 'Delivery accepted',
    icon: 'solar:check-circle-linear',
    tone: 'success',
    category: NOTIFICATION_CATEGORY.ORDERS,
  }),
  [NOTIFICATION_TYPE.ORDER_COMPLETED]: Object.freeze({
    label: 'Order completed',
    icon: 'solar:verified-check-linear',
    tone: 'success',
    category: NOTIFICATION_CATEGORY.ORDERS,
  }),
  [NOTIFICATION_TYPE.ORDER_CANCELLED]: Object.freeze({
    label: 'Order cancelled',
    icon: 'solar:close-circle-linear',
    tone: 'neutral',
    category: NOTIFICATION_CATEGORY.ORDERS,
  }),
  [NOTIFICATION_TYPE.PAYMENT_RELEASED]: Object.freeze({
    label: 'Payment released',
    icon: 'solar:wallet-money-linear',
    tone: 'success',
    category: NOTIFICATION_CATEGORY.PAYMENTS,
  }),
  [NOTIFICATION_TYPE.PAYMENT_REFUNDED]: Object.freeze({
    label: 'Payment refunded',
    icon: 'solar:card-recive-linear',
    tone: 'info',
    category: NOTIFICATION_CATEGORY.PAYMENTS,
  }),
  [NOTIFICATION_TYPE.PAYOUT_REQUESTED]: Object.freeze({
    label: 'Payout requested',
    icon: 'solar:hand-money-linear',
    tone: 'info',
    category: NOTIFICATION_CATEGORY.PAYMENTS,
  }),
  [NOTIFICATION_TYPE.PAYOUT_PROCESSED]: Object.freeze({
    label: 'Payout processed',
    icon: 'solar:banknote-2-linear',
    tone: 'success',
    category: NOTIFICATION_CATEGORY.PAYMENTS,
  }),
  [NOTIFICATION_TYPE.DISPUTE_OPENED]: Object.freeze({
    label: 'Dispute opened',
    icon: 'solar:danger-triangle-linear',
    tone: 'error',
    category: NOTIFICATION_CATEGORY.DISPUTES,
  }),
  [NOTIFICATION_TYPE.DISPUTE_MESSAGE]: Object.freeze({
    label: 'New dispute message',
    icon: 'solar:chat-round-dots-linear',
    tone: 'info',
    category: NOTIFICATION_CATEGORY.DISPUTES,
  }),
  [NOTIFICATION_TYPE.DISPUTE_RESOLVED]: Object.freeze({
    label: 'Dispute resolved',
    icon: 'solar:shield-check-linear',
    tone: 'success',
    category: NOTIFICATION_CATEGORY.DISPUTES,
  }),
  [NOTIFICATION_TYPE.MODERATION_APPROVED]: Object.freeze({
    label: 'Content approved',
    icon: 'solar:shield-check-linear',
    tone: 'success',
    category: NOTIFICATION_CATEGORY.MODERATION,
  }),
  [NOTIFICATION_TYPE.MODERATION_REJECTED]: Object.freeze({
    label: 'Content rejected',
    icon: 'solar:shield-warning-linear',
    tone: 'error',
    category: NOTIFICATION_CATEGORY.MODERATION,
  }),
  [NOTIFICATION_TYPE.MODERATION_REVISION]: Object.freeze({
    label: 'Changes requested',
    icon: 'solar:pen-new-square-linear',
    tone: 'warning',
    category: NOTIFICATION_CATEGORY.MODERATION,
  }),
  [NOTIFICATION_TYPE.ACCOUNT_STATUS_CHANGED]: Object.freeze({
    label: 'Account status updated',
    icon: 'solar:user-circle-linear',
    tone: 'warning',
    category: NOTIFICATION_CATEGORY.SYSTEM,
  }),
  [NOTIFICATION_TYPE.AFFILIATE_CONVERSION]: Object.freeze({
    label: 'Referral converted',
    icon: 'solar:users-group-two-rounded-linear',
    tone: 'brand',
    category: NOTIFICATION_CATEGORY.AFFILIATE,
  }),
  [NOTIFICATION_TYPE.AFFILIATE_PAYOUT]: Object.freeze({
    label: 'Affiliate payout',
    icon: 'solar:hand-money-linear',
    tone: 'success',
    category: NOTIFICATION_CATEGORY.AFFILIATE,
  }),
  [NOTIFICATION_TYPE.SYSTEM_ANNOUNCEMENT]: Object.freeze({
    label: 'Announcement',
    icon: 'solar:megaphone-linear',
    tone: 'info',
    category: NOTIFICATION_CATEGORY.SYSTEM,
  }),
})

/** Fallback so an unknown type still renders a sensible row. */
const UNKNOWN_NOTIFICATION_META = Object.freeze({
  label: 'Notification',
  icon: 'solar:bell-linear',
  tone: 'neutral',
  category: NOTIFICATION_CATEGORY.SYSTEM,
})

/** Safe accessor for `NOTIFICATION_META`. */
export function getNotificationMeta(type) {
  return NOTIFICATION_META[type] ?? UNKNOWN_NOTIFICATION_META
}

/* -------------------------------------------------------------------------- */
/* Prompt 27 additions — the notification centre                              */
/* -------------------------------------------------------------------------- */

/**
 * Reading order for the preference rows and the filter chips, so the settings
 * screen and the notifications page list the categories the same way rather
 * than in whatever order `Object.values` happens to produce.
 */
export const NOTIFICATION_CATEGORY_ORDER = Object.freeze([
  NOTIFICATION_CATEGORY.MARKETPLACE,
  NOTIFICATION_CATEGORY.ORDERS,
  NOTIFICATION_CATEGORY.PAYMENTS,
  NOTIFICATION_CATEGORY.DISPUTES,
  NOTIFICATION_CATEGORY.MODERATION,
  NOTIFICATION_CATEGORY.AFFILIATE,
  NOTIFICATION_CATEGORY.SYSTEM,
])

/**
 * Deep-link target types carried on `notification.entityType` (contract §6.19).
 *
 * Values match `scripts/seed-utils.js#ENTITY_TYPE` one for one — this is the
 * subset a notification can actually point at, spelled here so the services and
 * `features/notifications/notificationRoutes.js` stop passing string literals
 * around (00 §2.5).
 */
export const NOTIFICATION_ENTITY = Object.freeze({
  USER: 'user',
  PORTFOLIO_ITEM: 'portfolio_item',
  REQUEST: 'request',
  PROPOSAL: 'proposal',
  ORDER: 'order',
  PAYMENT: 'payment',
  PAYOUT: 'payout',
  DISPUTE: 'dispute',
  MODERATION_REVIEW: 'moderation_review',
  AFFILIATE_EARNING: 'affiliate_earning',
  PLATFORM_SETTINGS: 'platform_settings',
})

/**
 * **Types that ignore `users.notificationPrefs`.**
 *
 * `notificationService.notify` skips creation when the recipient has the type's
 * category switched off — except for these two, which are delivered whatever
 * the preferences say:
 *
 * - `system_announcement` — how BetterBlue tells every member about a change to
 *   the service itself. A member who has silenced it has silenced the only
 *   channel the platform has.
 * - `account_status_changed` — a suspension notice with its reason. Somebody who
 *   cannot work out why their account stopped working is a support ticket at
 *   best, and telling them is the fair thing regardless.
 *
 * Both belong to the `system` category, so that category's preference row is
 * rendered locked rather than as a switch that quietly does nothing.
 */
export const MANDATORY_NOTIFICATION_TYPES = Object.freeze([
  NOTIFICATION_TYPE.SYSTEM_ANNOUNCEMENT,
  NOTIFICATION_TYPE.ACCOUNT_STATUS_CHANGED,
])

/** Is this type delivered regardless of the recipient's preferences? */
export function isMandatoryNotification(type) {
  return MANDATORY_NOTIFICATION_TYPES.includes(type)
}

/** Every type filed under `category`, in declaration order. */
export function typesInCategory(category) {
  return Object.values(NOTIFICATION_TYPE).filter(
    (type) => NOTIFICATION_META[type]?.category === category
  )
}

/**
 * Categories whose every type is mandatory — **derived**, not listed, so adding
 * an optional type to `system` unlocks the row on its own.
 */
export const LOCKED_NOTIFICATION_CATEGORIES = Object.freeze(
  NOTIFICATION_CATEGORY_ORDER.filter((category) => {
    const types = typesInCategory(category)
    return types.length > 0 && types.every(isMandatoryNotification)
  })
)

/** Is this category's in-app switch locked on (§4.4)? */
export function isNotificationCategoryLocked(category) {
  return LOCKED_NOTIFICATION_CATEGORIES.includes(category)
}

/**
 * Preferences with every category switched on — the shape `users.notificationPrefs`
 * carries (contract §6.2) and the fallback for an account seeded before a
 * category existed.
 */
export function defaultNotificationPrefs() {
  return Object.fromEntries(
    NOTIFICATION_CATEGORY_ORDER.map((category) => [category, { inApp: true, email: false }])
  )
}

/**
 * Does `prefs` allow an in-app notification of this category?
 *
 * Fails **open**: an account missing the category entirely still hears about it.
 * Only an explicit `inApp: false` silences anything.
 */
export function allowsInAppCategory(prefs, category) {
  if (isNotificationCategoryLocked(category)) return true
  return prefs?.[category]?.inApp !== false
}
