// Domain enums + status metadata — prompts/00-architecture-and-rules.md §9.
//
// These string values are the contract between the app, the mock database
// (server/db.json) and the future Laravel backend. Never write status
// literals in components or services — import from here (00 §2.5).
//
// `STATUS_META` is a single flat map keyed by status *value*, so `StatusChip`
// (Prompt 04) can render any domain value without knowing its enum. Several
// values are shared across enums (`open`, `submitted`, `completed`, …), so
// labels and descriptions are written to read correctly in every context a
// value appears in. Where a screen needs context-specific wording, pass a
// bespoke `metaMap` to `StatusChip` instead of overloading this map.

/** Chip tones understood by `StatusChip` (Prompt 04). */
export const STATUS_TONES = Object.freeze([
  'neutral',
  'info',
  'warning',
  'success',
  'error',
  'brand',
])

/* -------------------------------------------------------------------------- */
/* Enums                                                                      */
/* -------------------------------------------------------------------------- */

/** Accounts are never deleted — suspension and blacklisting are statuses. */
export const ACCOUNT_STATUS = Object.freeze({
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  BLACKLISTED: 'blacklisted',
  DEACTIVATED: 'deactivated',
})

export const REQUEST_STATUS = Object.freeze({
  DRAFT: 'draft',
  OPEN: 'open',
  AWARDED: 'awarded',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  CLOSED: 'closed',
})

export const PROPOSAL_STATUS = Object.freeze({
  SUBMITTED: 'submitted',
  SHORTLISTED: 'shortlisted',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  WITHDRAWN: 'withdrawn',
  EXPIRED: 'expired',
})

export const ORDER_STATUS = Object.freeze({
  PENDING_PAYMENT: 'pending_payment',
  IN_PROGRESS: 'in_progress',
  DELIVERED: 'delivered',
  REVISION_REQUESTED: 'revision_requested',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DISPUTED: 'disputed',
  REFUNDED: 'refunded',
})

export const PAYMENT_STATUS = Object.freeze({
  INITIATED: 'initiated',
  PROCESSING: 'processing',
  HELD: 'held',
  RELEASED: 'released',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
  FAILED: 'failed',
})

export const TRANSACTION_TYPE = Object.freeze({
  CHARGE: 'charge',
  RELEASE: 'release',
  REFUND: 'refund',
  PARTIAL_REFUND: 'partial_refund',
  COMMISSION: 'commission',
  PAYOUT: 'payout',
  AFFILIATE_COMMISSION: 'affiliate_commission',
})

/** One record per delivered version — a revision creates the next version. */
export const DELIVERY_STATUS = Object.freeze({
  SUBMITTED: 'submitted',
  REVISION_REQUESTED: 'revision_requested',
  ACCEPTED: 'accepted',
})

/** Moderation lifecycle for portfolio items and deliverables. */
export const CONTENT_STATUS = Object.freeze({
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  REVISION_REQUIRED: 'revision_required',
  PUBLISHED: 'published',
  RESTRICTED: 'restricted',
  ARCHIVED: 'archived',
})

export const DISPUTE_STATUS = Object.freeze({
  OPEN: 'open',
  UNDER_REVIEW: 'under_review',
  AWAITING_BUYER: 'awaiting_buyer',
  AWAITING_CREATOR: 'awaiting_creator',
  ESCALATED: 'escalated',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
})

export const DISPUTE_RESOLUTION = Object.freeze({
  RELEASE_PAYMENT: 'release_payment',
  FULL_REFUND: 'full_refund',
  PARTIAL_REFUND: 'partial_refund',
})

export const DISPUTE_CATEGORY = Object.freeze({
  QUALITY_ISSUE: 'quality_issue',
  NON_DELIVERY: 'non_delivery',
  SCOPE_MISMATCH: 'scope_mismatch',
  LATE_DELIVERY: 'late_delivery',
  PAYMENT_ISSUE: 'payment_issue',
  POLICY_CONCERN: 'policy_concern',
  OTHER: 'other',
})

export const PAYOUT_STATUS = Object.freeze({
  REQUESTED: 'requested',
  PROCESSING: 'processing',
  PAID: 'paid',
  REJECTED: 'rejected',
})

export const AFFILIATE_PROFILE_STATUS = Object.freeze({
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
})

export const REFERRAL_STATUS = Object.freeze({
  PENDING: 'pending',
  CONVERTED: 'converted',
  EXPIRED: 'expired',
})

export const AFFILIATE_EARNING_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  PAID: 'paid',
  VOID: 'void',
})

export const CONTENT_TYPE = Object.freeze({
  PHOTO: 'photo',
  VIDEO: 'video',
  BUNDLE: 'bundle',
})

/**
 * Framing a buyer asks for on a content request.
 *
 * Promoted here by Prompt 16 (the request wizard needs it in the app), which
 * is exactly the path `docs/data-model.md` §3 reserved for it — `scripts/
 * seed-utils.js` now re-exports these two from this module instead of owning
 * its own copy, so the seed and the app can never drift.
 */
export const ORIENTATION = Object.freeze({
  PORTRAIT: 'portrait',
  LANDSCAPE: 'landscape',
  SQUARE: 'square',
  ANY: 'any',
})

/** Budget shape on a content request — `fixed` sets `budgetMin === budgetMax`. */
export const BUDGET_TYPE = Object.freeze({ FIXED: 'fixed', RANGE: 'range' })

/**
 * Who can reach a **published** portfolio item (`portfolioItems.visibility`).
 *
 * Promoted here by Prompt 22 (the portfolio manager lets a creator switch it),
 * which is the path `scripts/seed-utils.js` reserved for exactly this — that
 * module now re-exports these two rather than owning a second copy, so the seed
 * and the app can never drift.
 *
 * `unlisted` is **not** a moderation state: the item stays approved and
 * published, it is simply excluded from every public query — the public
 * profile, the discovery preview strips, and search. A future prompt can add
 * share-by-link without changing the stored value or this enum.
 */
export const VISIBILITY = Object.freeze({ PUBLIC: 'public', UNLISTED: 'unlisted' })

/**
 * What a `moderationReviews` record is about (`subjectType`). Promoted from the
 * seed by Prompt 22 for the same reason as {@link VISIBILITY}: the portfolio
 * manager now writes moderation records, so the app needs the discriminator.
 *
 * Deliberately **not** in `STATUS_ENUMS` — it discriminates a record, it is not
 * a status, and it never renders through `StatusChip`.
 */
export const MODERATION_SUBJECT = Object.freeze({
  PORTFOLIO_ITEM: 'portfolio_item',
  DELIVERY: 'delivery',
})

export const REPORT_STATUS = Object.freeze({
  OPEN: 'open',
  REVIEWED: 'reviewed',
  ACTIONED: 'actioned',
  DISMISSED: 'dismissed',
})

export const TICKET_STATUS = Object.freeze({
  OPEN: 'open',
  PENDING: 'pending',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
})

/** Licence scope a buyer requests for the commissioned content. */
export const USAGE_RIGHTS = Object.freeze({
  ORGANIC_SOCIAL: 'organic_social',
  PAID_ADS: 'paid_ads',
  WEBSITE: 'website',
  FULL_COMMERCIAL: 'full_commercial',
})

/**
 * Registry of every enum above, keyed by its exported name. Powers the
 * dev-time completeness check below and lets the seed script (Prompt 05)
 * validate that persisted values stay inside their enum.
 */
export const STATUS_ENUMS = Object.freeze({
  ACCOUNT_STATUS,
  REQUEST_STATUS,
  PROPOSAL_STATUS,
  ORDER_STATUS,
  PAYMENT_STATUS,
  TRANSACTION_TYPE,
  DELIVERY_STATUS,
  CONTENT_STATUS,
  DISPUTE_STATUS,
  DISPUTE_RESOLUTION,
  DISPUTE_CATEGORY,
  PAYOUT_STATUS,
  AFFILIATE_PROFILE_STATUS,
  REFERRAL_STATUS,
  AFFILIATE_EARNING_STATUS,
  CONTENT_TYPE,
  ORIENTATION,
  BUDGET_TYPE,
  VISIBILITY,
  REPORT_STATUS,
  TICKET_STATUS,
  USAGE_RIGHTS,
})

/* -------------------------------------------------------------------------- */
/* Status metadata                                                            */
/* -------------------------------------------------------------------------- */

/**
 * `{ label, tone, description }` for every value in every enum above.
 * Comments mark where a value is shared by several enums — each entry is
 * defined exactly once.
 */
export const STATUS_META = Object.freeze({
  /* Accounts (ACCOUNT_STATUS, AFFILIATE_PROFILE_STATUS) */
  active: {
    label: 'Active',
    tone: 'success',
    description: 'In good standing with full access to BetterBlue.',
  },
  suspended: {
    label: 'Suspended',
    tone: 'warning',
    description:
      'Access is temporarily restricted while our Trust & Safety team completes a review.',
  },
  blacklisted: {
    label: 'Blacklisted',
    tone: 'error',
    description:
      'Permanently blocked from the marketplace following a serious policy breach.',
  },
  deactivated: {
    label: 'Deactivated',
    tone: 'neutral',
    description:
      'Closed by the account holder. Records are retained for order and payment history.',
  },

  /* Content requests (REQUEST_STATUS) — `draft` is shared with CONTENT_STATUS */
  draft: {
    label: 'Draft',
    tone: 'neutral',
    description: 'Saved privately and not published yet.',
  },
  open: {
    label: 'Open',
    tone: 'info',
    description: 'Live and awaiting responses — no decision has been made yet.',
  },
  awarded: {
    label: 'Awarded',
    tone: 'brand',
    description: 'A proposal has been accepted and the work is under way.',
  },
  completed: {
    label: 'Completed',
    tone: 'success',
    description: 'Delivered, accepted, and finished successfully.',
  },
  cancelled: {
    label: 'Cancelled',
    tone: 'neutral',
    description: 'Ended before completion. No further action is expected.',
  },
  closed: {
    label: 'Closed',
    tone: 'neutral',
    description: 'Closed out — no further activity is expected.',
  },

  /* Proposals (PROPOSAL_STATUS) — `submitted`/`accepted` shared with
     DELIVERY_STATUS and CONTENT_STATUS; `expired` with REFERRAL_STATUS */
  submitted: {
    label: 'Submitted',
    tone: 'info',
    description: 'Sent successfully and waiting on a response.',
  },
  shortlisted: {
    label: 'Shortlisted',
    tone: 'brand',
    description:
      'Marked as a strong candidate while the buyer compares proposals.',
  },
  accepted: {
    label: 'Accepted',
    tone: 'success',
    description: 'Reviewed and accepted by the buyer.',
  },
  declined: {
    label: 'Declined',
    tone: 'neutral',
    description: 'Not selected — the buyer went in a different direction.',
  },
  withdrawn: {
    label: 'Withdrawn',
    tone: 'neutral',
    description: 'Pulled back by the creator before a decision was made.',
  },
  expired: {
    label: 'Expired',
    tone: 'neutral',
    description: 'The response window closed before a decision was made.',
  },

  /* Orders (ORDER_STATUS) — `revision_requested` shared with DELIVERY_STATUS,
     `refunded` with PAYMENT_STATUS */
  pending_payment: {
    label: 'Pending Payment',
    tone: 'warning',
    description: 'Waiting for the buyer to fund the order before work begins.',
  },
  in_progress: {
    label: 'In Progress',
    tone: 'info',
    description:
      'Payment is held in escrow and the creator is producing the content.',
  },
  delivered: {
    label: 'Delivered',
    tone: 'info',
    description:
      'The deliverables have been submitted and are awaiting the buyer’s review.',
  },
  revision_requested: {
    label: 'Revision Requested',
    tone: 'warning',
    description:
      'The buyer asked for changes; the creator is updating the deliverables.',
  },
  disputed: {
    label: 'Disputed',
    tone: 'error',
    description:
      'A dispute is open. Payment stays in escrow until the case is resolved.',
  },
  refunded: {
    label: 'Refunded',
    tone: 'warning',
    description: 'The full amount has been returned to the buyer.',
  },

  /* Payments (PAYMENT_STATUS) — `processing` shared with PAYOUT_STATUS */
  initiated: {
    label: 'Initiated',
    tone: 'info',
    description: 'The payment has been created and is queued for processing.',
  },
  processing: {
    label: 'Processing',
    tone: 'info',
    description: 'Being processed by the payment provider.',
  },
  held: {
    label: 'Payment Held',
    tone: 'info',
    description:
      'Funds are secured in escrow and released once the delivery is accepted.',
  },
  released: {
    label: 'Released',
    tone: 'success',
    description:
      'Escrowed funds were released to the creator, minus the platform commission.',
  },
  partially_refunded: {
    label: 'Partially Refunded',
    tone: 'warning',
    description: 'Part of the payment has been returned to the buyer.',
  },
  failed: {
    label: 'Failed',
    tone: 'error',
    description:
      'The payment could not be completed. The buyer can try another method.',
  },

  /* Transactions (TRANSACTION_TYPE) — `partial_refund` shared with
     DISPUTE_RESOLUTION */
  charge: {
    label: 'Charge',
    tone: 'info',
    description: 'A buyer payment collected into escrow.',
  },
  release: {
    label: 'Release',
    tone: 'success',
    description: 'Escrowed funds moved to the creator’s balance.',
  },
  refund: {
    label: 'Refund',
    tone: 'warning',
    description: 'A full return of funds to the buyer.',
  },
  partial_refund: {
    label: 'Partial Refund',
    tone: 'warning',
    description: 'A portion of the order amount returned to the buyer.',
  },
  commission: {
    label: 'Commission',
    tone: 'brand',
    description: 'The BetterBlue platform fee charged on a completed order.',
  },
  payout: {
    label: 'Payout',
    tone: 'success',
    description:
      'A transfer of a creator’s available balance to their bank account.',
  },
  affiliate_commission: {
    label: 'Affiliate Commission',
    tone: 'brand',
    description: 'A referral commission earned through the affiliate program.',
  },

  /* Content moderation (CONTENT_STATUS) — `under_review` shared with
     DISPUTE_STATUS, `approved` with AFFILIATE_EARNING_STATUS,
     `rejected` with PAYOUT_STATUS */
  under_review: {
    label: 'Under Review',
    tone: 'info',
    description: 'A BetterBlue reviewer is working through the details.',
  },
  approved: {
    label: 'Approved',
    tone: 'success',
    description: 'Reviewed and cleared — no further changes are needed.',
  },
  rejected: {
    label: 'Rejected',
    tone: 'error',
    description:
      'Declined for not meeting the Content Policy or the agreed requirements.',
  },
  revision_required: {
    label: 'Revision Required',
    tone: 'warning',
    description: 'Changes are needed before this content can be approved.',
  },
  published: {
    label: 'Published',
    tone: 'brand',
    description: 'Live on the public profile and discoverable in search.',
  },
  restricted: {
    label: 'Restricted',
    tone: 'warning',
    description: 'Hidden from public view following a Content Policy decision.',
  },
  archived: {
    label: 'Archived',
    tone: 'neutral',
    description: 'Retired by its owner and no longer shown publicly.',
  },

  /* Disputes (DISPUTE_STATUS) — `resolved` shared with TICKET_STATUS */
  awaiting_buyer: {
    label: 'Awaiting Buyer',
    tone: 'warning',
    description: 'Waiting for the buyer to respond with information or evidence.',
  },
  awaiting_creator: {
    label: 'Awaiting Creator',
    tone: 'warning',
    description:
      'Waiting for the creator to respond with information or evidence.',
  },
  escalated: {
    label: 'Escalated',
    tone: 'error',
    description: 'Referred to a senior reviewer for a final decision.',
  },
  resolved: {
    label: 'Resolved',
    tone: 'success',
    description: 'A decision has been issued and applied.',
  },

  /* Dispute resolutions (DISPUTE_RESOLUTION) */
  release_payment: {
    label: 'Release Payment',
    tone: 'success',
    description: 'Escrowed funds were released to the creator in full.',
  },
  full_refund: {
    label: 'Full Refund',
    tone: 'warning',
    description: 'The full order amount was returned to the buyer.',
  },

  /* Dispute categories (DISPUTE_CATEGORY) */
  quality_issue: {
    label: 'Quality Issue',
    tone: 'warning',
    description: 'The delivered content falls short of the agreed quality bar.',
  },
  non_delivery: {
    label: 'Non-Delivery',
    tone: 'error',
    description: 'The deliverables were never submitted.',
  },
  scope_mismatch: {
    label: 'Scope Mismatch',
    tone: 'warning',
    description: 'The delivery does not match the brief that was agreed.',
  },
  late_delivery: {
    label: 'Late Delivery',
    tone: 'warning',
    description: 'The deliverables arrived after the agreed deadline.',
  },
  payment_issue: {
    label: 'Payment Issue',
    tone: 'error',
    description: 'A problem with the charge, release, or refund of funds.',
  },
  policy_concern: {
    label: 'Policy Concern',
    tone: 'error',
    description: 'A possible breach of the BetterBlue Content Policy.',
  },
  other: {
    label: 'Other',
    tone: 'neutral',
    description: 'A concern that does not fit the categories above.',
  },

  /* Payouts (PAYOUT_STATUS) — `paid` shared with AFFILIATE_EARNING_STATUS */
  requested: {
    label: 'Requested',
    tone: 'info',
    description: 'Requested by the creator and queued for review.',
  },
  paid: {
    label: 'Paid',
    tone: 'success',
    description: 'Funds have been transferred and the record is settled.',
  },

  /* Affiliate program (REFERRAL_STATUS, AFFILIATE_EARNING_STATUS) —
     `pending` shared with TICKET_STATUS */
  pending: {
    label: 'Pending',
    tone: 'info',
    description: 'Recorded and waiting on the next step before it is finalized.',
  },
  converted: {
    label: 'Converted',
    tone: 'success',
    description: 'The referred account completed a qualifying order.',
  },
  void: {
    label: 'Void',
    tone: 'neutral',
    description:
      'Cancelled and excluded from earnings, usually after a refund or cancellation.',
  },

  /* Content types (CONTENT_TYPE) */
  photo: {
    label: 'Photo',
    tone: 'info',
    description: 'Still photography deliverables.',
  },
  video: {
    label: 'Video',
    tone: 'brand',
    description: 'Video deliverables, including short-form social clips.',
  },
  bundle: {
    label: 'Photo + Video Bundle',
    tone: 'neutral',
    description: 'A combined package of photo and video deliverables.',
  },

  /* Orientation (ORIENTATION) */
  portrait: {
    label: 'Portrait',
    tone: 'neutral',
    description: 'Vertical framing, 9:16 — built for stories, reels, and shorts.',
  },
  landscape: {
    label: 'Landscape',
    tone: 'neutral',
    description: 'Horizontal framing, 16:9 — built for websites, YouTube, and display ads.',
  },
  square: {
    label: 'Square',
    tone: 'neutral',
    description: 'Square framing, 1:1 — built for feed posts and product grids.',
  },
  any: {
    label: 'Any',
    tone: 'neutral',
    description: 'No preference — the creator picks the framing that suits the content.',
  },

  /* Budget shape (BUDGET_TYPE) */
  fixed: {
    label: 'Fixed price',
    tone: 'neutral',
    description: 'One amount you are prepared to pay for the whole brief.',
  },
  range: {
    label: 'Budget range',
    tone: 'neutral',
    description: 'A window creators price into, from your minimum to your maximum.',
  },

  /* Portfolio visibility (VISIBILITY) */
  public: {
    label: 'Public',
    tone: 'success',
    description:
      'Shown on your public profile and in discovery once it has been published.',
  },
  unlisted: {
    label: 'Unlisted',
    tone: 'neutral',
    description:
      'Published, but kept off your public profile and out of discovery.',
  },

  /* Reports (REPORT_STATUS) */
  reviewed: {
    label: 'Reviewed',
    tone: 'info',
    description: 'A moderator has reviewed the report and is deciding next steps.',
  },
  actioned: {
    label: 'Actioned',
    tone: 'success',
    description: 'Reviewed, and action was taken on the content or account.',
  },
  dismissed: {
    label: 'Dismissed',
    tone: 'neutral',
    description: 'Reviewed and closed — no policy violation was found.',
  },

  /* Usage rights (USAGE_RIGHTS) */
  organic_social: {
    label: 'Organic Social',
    tone: 'info',
    description:
      'Use on the brand’s own social channels, without paid promotion.',
  },
  paid_ads: {
    label: 'Paid Ads',
    tone: 'brand',
    description:
      'Use in paid advertising, including boosted posts and sponsored placements.',
  },
  website: {
    label: 'Website',
    tone: 'info',
    description: 'Use on the brand’s website, landing pages, and online store.',
  },
  full_commercial: {
    label: 'Full Commercial',
    tone: 'brand',
    description:
      'Broad commercial use across owned, paid, and partner channels.',
  },
})

/** Fallback meta for unknown values, so the UI never renders an empty chip. */
const UNKNOWN_STATUS_META = Object.freeze({
  label: 'Unknown',
  tone: 'neutral',
  description: 'This status is not recognized by the current app version.',
})

/**
 * Safe accessor for `STATUS_META`. Returns a titled fallback (rather than
 * `undefined`) so a stale or future status value can still render.
 */
export function getStatusMeta(status, metaMap = STATUS_META) {
  return (
    metaMap[status] ??
    (status
      ? { ...UNKNOWN_STATUS_META, label: humanizeStatus(status) }
      : UNKNOWN_STATUS_META)
  )
}

/** `revision_requested` → `Revision Requested` (last-resort label builder). */
export function humanizeStatus(status) {
  return String(status)
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/* -------------------------------------------------------------------------- */
/* Dev-time completeness check                                                */
/* -------------------------------------------------------------------------- */

// Runs once at import in development only (00 §16.11 / Prompt 03 §5) and warns
// when an enum value has no `STATUS_META` entry, carries an unknown tone, or
// when meta exists for a value no enum declares. Production builds evaluate
// `import.meta.env.DEV` to `false`, so this never ships. `import.meta.env` is
// undefined under plain Node (the Prompt 05 seed script imports this module),
// hence the optional chain.
if (import.meta.env?.DEV) {
  const declared = new Set()
  const missing = []
  const badTone = []

  Object.entries(STATUS_ENUMS).forEach(([enumName, values]) => {
    Object.values(values).forEach((value) => {
      declared.add(value)
      const meta = STATUS_META[value]
      if (!meta) {
        missing.push(`${enumName}.${value}`)
      } else if (!STATUS_TONES.includes(meta.tone)) {
        badTone.push(`${enumName}.${value} → "${meta.tone}"`)
      }
    })
  })

  const orphaned = Object.keys(STATUS_META).filter((key) => !declared.has(key))

  if (missing.length) {
    console.warn(
      `[constants/statuses] STATUS_META is missing ${missing.length} value(s): ${missing.join(', ')}`
    )
  }
  if (badTone.length) {
    console.warn(
      `[constants/statuses] Unknown tone(s) — expected one of ${STATUS_TONES.join('|')}: ${badTone.join(', ')}`
    )
  }
  if (orphaned.length) {
    console.warn(
      `[constants/statuses] STATUS_META has ${orphaned.length} entry(ies) with no matching enum value: ${orphaned.join(', ')}`
    )
  }
}
