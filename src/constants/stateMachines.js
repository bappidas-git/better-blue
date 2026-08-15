// State machines — prompts/00-architecture-and-rules.md §9.
//
// Every machine is `{ name, transitions }` where `transitions` maps a status
// to the statuses it may move to. Terminal statuses map to an empty array so
// `nextStates` always answers and the completeness of each machine is visible
// at a glance.
//
// Services (never components) enforce these with
// `assertTransition(MACHINE, from, to)` from `src/utils/stateMachine.js`.
// The future Laravel backend re-implements the same maps server-side.

import {
  CONTENT_STATUS,
  DELIVERY_STATUS,
  DISPUTE_STATUS,
  ORDER_STATUS,
  PAYMENT_STATUS,
  PAYOUT_STATUS,
  PROPOSAL_STATUS,
  REQUEST_STATUS,
} from './statuses.js'

const defineMachine = (name, transitions) => {
  Object.values(transitions).forEach(Object.freeze)
  return Object.freeze({ name, transitions: Object.freeze(transitions) })
}

/** Content request lifecycle: drafted → published → awarded → wrapped up. */
export const REQUEST_STATUS_MACHINE = defineMachine('REQUEST_STATUS', {
  [REQUEST_STATUS.DRAFT]: [REQUEST_STATUS.OPEN, REQUEST_STATUS.CANCELLED],
  [REQUEST_STATUS.OPEN]: [
    REQUEST_STATUS.AWARDED,
    REQUEST_STATUS.CLOSED,
    REQUEST_STATUS.CANCELLED,
  ],
  [REQUEST_STATUS.AWARDED]: [REQUEST_STATUS.COMPLETED, REQUEST_STATUS.CANCELLED],
  [REQUEST_STATUS.COMPLETED]: [],
  [REQUEST_STATUS.CANCELLED]: [],
  [REQUEST_STATUS.CLOSED]: [],
})

/** Proposal lifecycle from a creator's submission to the buyer's decision. */
export const PROPOSAL_STATUS_MACHINE = defineMachine('PROPOSAL_STATUS', {
  [PROPOSAL_STATUS.SUBMITTED]: [
    PROPOSAL_STATUS.SHORTLISTED,
    PROPOSAL_STATUS.ACCEPTED,
    PROPOSAL_STATUS.DECLINED,
    PROPOSAL_STATUS.WITHDRAWN,
    PROPOSAL_STATUS.EXPIRED,
  ],
  [PROPOSAL_STATUS.SHORTLISTED]: [
    PROPOSAL_STATUS.ACCEPTED,
    PROPOSAL_STATUS.DECLINED,
    PROPOSAL_STATUS.WITHDRAWN,
    // Prompt 18 addition: shortlisting is a **toggle** on the buyer's proposal
    // board, so a star switched off has to put the offer back in the undecided
    // pool. It is the same record in the same state it was in before the star,
    // which is why the edge is back to `submitted` rather than a new status.
    // 00 §9 fixes the PROPOSAL_STATUS *values*, not this map.
    PROPOSAL_STATUS.SUBMITTED,
  ],
  [PROPOSAL_STATUS.ACCEPTED]: [],
  [PROPOSAL_STATUS.DECLINED]: [],
  [PROPOSAL_STATUS.WITHDRAWN]: [],
  [PROPOSAL_STATUS.EXPIRED]: [],
})

/** Order lifecycle (00 §9) — the backbone of the escrow workflow. */
export const ORDER_STATUS_MACHINE = defineMachine('ORDER_STATUS', {
  [ORDER_STATUS.PENDING_PAYMENT]: [
    ORDER_STATUS.IN_PROGRESS,
    ORDER_STATUS.CANCELLED,
  ],
  [ORDER_STATUS.IN_PROGRESS]: [
    ORDER_STATUS.DELIVERED,
    ORDER_STATUS.DISPUTED,
    ORDER_STATUS.CANCELLED,
  ],
  [ORDER_STATUS.DELIVERED]: [
    ORDER_STATUS.REVISION_REQUESTED,
    ORDER_STATUS.COMPLETED,
    ORDER_STATUS.DISPUTED,
  ],
  [ORDER_STATUS.REVISION_REQUESTED]: [
    ORDER_STATUS.DELIVERED,
    ORDER_STATUS.DISPUTED,
    ORDER_STATUS.CANCELLED,
  ],
  [ORDER_STATUS.DISPUTED]: [
    ORDER_STATUS.COMPLETED,
    ORDER_STATUS.REFUNDED,
    ORDER_STATUS.CANCELLED,
  ],
  [ORDER_STATUS.COMPLETED]: [],
  [ORDER_STATUS.CANCELLED]: [],
  [ORDER_STATUS.REFUNDED]: [],
})

/** Escrow payment lifecycle. Refund outcomes are terminal for the payment. */
export const PAYMENT_STATUS_MACHINE = defineMachine('PAYMENT_STATUS', {
  [PAYMENT_STATUS.INITIATED]: [PAYMENT_STATUS.PROCESSING, PAYMENT_STATUS.FAILED],
  [PAYMENT_STATUS.PROCESSING]: [PAYMENT_STATUS.HELD, PAYMENT_STATUS.FAILED],
  [PAYMENT_STATUS.HELD]: [
    PAYMENT_STATUS.RELEASED,
    PAYMENT_STATUS.REFUNDED,
    PAYMENT_STATUS.PARTIALLY_REFUNDED,
  ],
  [PAYMENT_STATUS.RELEASED]: [],
  [PAYMENT_STATUS.REFUNDED]: [],
  [PAYMENT_STATUS.PARTIALLY_REFUNDED]: [],
  [PAYMENT_STATUS.FAILED]: [],
})

/**
 * Delivery lifecycle. Each delivery record is one *version* of the work:
 * asking for changes closes that version at `revision_requested`, and the
 * creator's next submission creates a new delivery record — so there is no
 * `revision_requested → submitted` edge here (documented decision).
 */
export const DELIVERY_STATUS_MACHINE = defineMachine('DELIVERY_STATUS', {
  [DELIVERY_STATUS.SUBMITTED]: [
    DELIVERY_STATUS.REVISION_REQUESTED,
    DELIVERY_STATUS.ACCEPTED,
  ],
  [DELIVERY_STATUS.REVISION_REQUESTED]: [],
  [DELIVERY_STATUS.ACCEPTED]: [],
})

/** Moderation lifecycle for portfolio items and deliverables. */
export const CONTENT_STATUS_MACHINE = defineMachine('CONTENT_STATUS', {
  [CONTENT_STATUS.DRAFT]: [CONTENT_STATUS.SUBMITTED],
  [CONTENT_STATUS.SUBMITTED]: [CONTENT_STATUS.UNDER_REVIEW],
  [CONTENT_STATUS.UNDER_REVIEW]: [
    CONTENT_STATUS.APPROVED,
    CONTENT_STATUS.REJECTED,
    CONTENT_STATUS.REVISION_REQUIRED,
  ],
  [CONTENT_STATUS.APPROVED]: [CONTENT_STATUS.PUBLISHED],
  [CONTENT_STATUS.REJECTED]: [CONTENT_STATUS.SUBMITTED],
  [CONTENT_STATUS.REVISION_REQUIRED]: [CONTENT_STATUS.SUBMITTED],
  [CONTENT_STATUS.PUBLISHED]: [CONTENT_STATUS.RESTRICTED, CONTENT_STATUS.ARCHIVED],
  [CONTENT_STATUS.RESTRICTED]: [CONTENT_STATUS.PUBLISHED, CONTENT_STATUS.ARCHIVED],
  [CONTENT_STATUS.ARCHIVED]: [],
})

/** Dispute lifecycle handled by the Trust & Safety team. */
export const DISPUTE_STATUS_MACHINE = defineMachine('DISPUTE_STATUS', {
  [DISPUTE_STATUS.OPEN]: [DISPUTE_STATUS.UNDER_REVIEW],
  [DISPUTE_STATUS.UNDER_REVIEW]: [
    DISPUTE_STATUS.AWAITING_BUYER,
    DISPUTE_STATUS.AWAITING_CREATOR,
    DISPUTE_STATUS.ESCALATED,
    DISPUTE_STATUS.RESOLVED,
  ],
  [DISPUTE_STATUS.AWAITING_BUYER]: [
    DISPUTE_STATUS.UNDER_REVIEW,
    DISPUTE_STATUS.RESOLVED,
  ],
  [DISPUTE_STATUS.AWAITING_CREATOR]: [
    DISPUTE_STATUS.UNDER_REVIEW,
    DISPUTE_STATUS.RESOLVED,
  ],
  [DISPUTE_STATUS.ESCALATED]: [DISPUTE_STATUS.RESOLVED],
  [DISPUTE_STATUS.RESOLVED]: [DISPUTE_STATUS.CLOSED],
  [DISPUTE_STATUS.CLOSED]: [],
})

/** Creator payout lifecycle handled by finance admins. */
export const PAYOUT_STATUS_MACHINE = defineMachine('PAYOUT_STATUS', {
  [PAYOUT_STATUS.REQUESTED]: [PAYOUT_STATUS.PROCESSING, PAYOUT_STATUS.REJECTED],
  [PAYOUT_STATUS.PROCESSING]: [PAYOUT_STATUS.PAID],
  [PAYOUT_STATUS.PAID]: [],
  [PAYOUT_STATUS.REJECTED]: [],
})

/** Every machine, keyed by name — handy for dev tooling and admin timelines. */
export const STATE_MACHINES = Object.freeze({
  REQUEST_STATUS: REQUEST_STATUS_MACHINE,
  PROPOSAL_STATUS: PROPOSAL_STATUS_MACHINE,
  ORDER_STATUS: ORDER_STATUS_MACHINE,
  PAYMENT_STATUS: PAYMENT_STATUS_MACHINE,
  DELIVERY_STATUS: DELIVERY_STATUS_MACHINE,
  CONTENT_STATUS: CONTENT_STATUS_MACHINE,
  DISPUTE_STATUS: DISPUTE_STATUS_MACHINE,
  PAYOUT_STATUS: PAYOUT_STATUS_MACHINE,
})
