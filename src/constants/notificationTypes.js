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
  [NOTIFICATION_TYPE.PROPOSAL_DECLINED]: Object.freeze({
    label: 'Proposal declined',
    icon: 'solar:close-circle-linear',
    tone: 'neutral',
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
