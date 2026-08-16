import { ROLES } from '@/constants/roles'
import { DISPUTE_CATEGORY, DISPUTE_STATUS, getStatusMeta } from '@/constants/statuses'
import { listParam } from '@/hooks/useListParams'
import { paths } from '@/routes/paths'
import { awaitingRoleFor, SETTLED_DISPUTE_STATUSES } from '@/services/disputeService'

// The sentences and the groupings a dispute is described with, in one place.
//
// The list, the card, the banner, and the composer all have to agree about
// whose move it is and whether the thread is still open, so they say it from
// here. Everything below is a pure function of a record — no fetching, no
// status changes (those are `disputeService`).
//
// The whole disputes feature is **one module serving two dashboards** (§7): the
// only thing that varies between the buyer's and the creator's copy of a screen
// is the role, and it is threaded through as an argument rather than duplicated
// into two feature folders.

/* -------------------------------------------------------------------------- */
/* Role-parameterised routing                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The disputes routes for a role — the mechanism that lets one page component
 * mount at `/buyer/disputes` and `/creator/disputes` (00 §2.6: never a URL
 * literal).
 *
 * @param {string} role a `ROLES` value
 * @returns {{list: string, detail: (disputeId: string) => string, orders: string,
 *   orderDetail: (orderId: string) => string}}
 */
export function disputeRoutesFor(role) {
  if (role === ROLES.CREATOR) {
    return {
      list: paths.CREATOR_DISPUTES,
      detail: paths.creatorDisputeDetail,
      orders: paths.CREATOR_ORDERS,
      orderDetail: paths.creatorOrderDetail,
    }
  }
  return {
    list: paths.BUYER_DISPUTES,
    detail: paths.buyerDisputeDetail,
    orders: paths.BUYER_ORDERS,
    orderDetail: paths.buyerOrderDetail,
  }
}

/* -------------------------------------------------------------------------- */
/* Tabs                                                                       */
/* -------------------------------------------------------------------------- */

/** The three groupings a party thinks in: live, decided, and filed away. */
export const DISPUTE_TAB = Object.freeze({
  OPEN: 'open',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
})

export const DISPUTE_TABS = Object.freeze([
  { key: DISPUTE_TAB.OPEN, label: 'Open' },
  { key: DISPUTE_TAB.RESOLVED, label: 'Resolved' },
  { key: DISPUTE_TAB.CLOSED, label: 'Closed' },
])

/**
 * The statuses behind a tab. "Open" is every live status rather than the
 * `open` status alone — a member does not distinguish "being triaged" from
 * "waiting on me" when choosing a tab; they distinguish "still going" from
 * "over".
 */
const STATUSES_BY_TAB = Object.freeze({
  [DISPUTE_TAB.OPEN]: Object.freeze([
    DISPUTE_STATUS.OPEN,
    DISPUTE_STATUS.UNDER_REVIEW,
    DISPUTE_STATUS.AWAITING_BUYER,
    DISPUTE_STATUS.AWAITING_CREATOR,
    DISPUTE_STATUS.ESCALATED,
  ]),
  [DISPUTE_TAB.RESOLVED]: Object.freeze([DISPUTE_STATUS.RESOLVED]),
  [DISPUTE_TAB.CLOSED]: Object.freeze([DISPUTE_STATUS.CLOSED]),
})

/** The `status` filter a tab sends to the service — an array is OR'd (contract §4.1). */
export function statusFilterForTab(tab) {
  return STATUSES_BY_TAB[tab] ?? STATUSES_BY_TAB[DISPUTE_TAB.OPEN]
}

/** URL-owned list state for the disputes list (00 §12). */
export const DISPUTE_LIST_PARAMS = Object.freeze({
  tab: listParam.choice({ options: Object.values(DISPUTE_TAB), fallback: DISPUTE_TAB.OPEN }),
  q: listParam.text(),
  page: listParam.number({ fallback: 1, min: 1, max: 999, integer: true, isFilter: false }),
})

/* -------------------------------------------------------------------------- */
/* Reading a case                                                             */
/* -------------------------------------------------------------------------- */

/** Is the thread still taking messages? */
export function isSettled(dispute) {
  return SETTLED_DISPUTE_STATUSES.includes(dispute?.status)
}

/** Is this case waiting on the person reading it? */
export function isAwaitingViewer(dispute, role) {
  const awaiting = awaitingRoleFor(dispute?.status)
  return awaiting !== null && awaiting === role
}

/** The other party's id, from the perspective of `viewerId`. */
export function counterpartId(dispute, viewerId) {
  if (!dispute) return null
  return dispute.raisedById === viewerId ? dispute.againstId : dispute.raisedById
}

/** Did the person reading this raise it? */
export function isRaisedByViewer(dispute, viewerId) {
  return Boolean(dispute && viewerId && dispute.raisedById === viewerId)
}

/** The category's human label, safe for an unknown value. */
export function categoryLabel(category) {
  return getStatusMeta(category).label
}

/** `{ value, label, description }` per category — the options in the raise dialog. */
export const DISPUTE_CATEGORY_OPTIONS = Object.freeze(
  Object.values(DISPUTE_CATEGORY).map((value) => {
    const meta = getStatusMeta(value)
    return Object.freeze({ value, label: meta.label, description: meta.description })
  })
)

/**
 * One line saying where a case is, written for the party reading it and in the
 * calm, procedural register the whole feature keeps (§6): what is happening,
 * and what — if anything — is theirs to do. Never alarming, never blaming.
 *
 * `accent` marks the one state that is waiting on this reader. It is the only
 * thing in a list of cases that should pull the eye, so nothing else sets it.
 *
 * @param {object} dispute a dispute record
 * @param {string} role the reader's `ROLES` value
 * @returns {{text: string, accent: boolean, severity: string, title: string, icon: string}}
 */
export function describeDisputeState(dispute, role) {
  const awaitsViewer = isAwaitingViewer(dispute, role)

  switch (dispute?.status) {
    case DISPUTE_STATUS.OPEN:
      return {
        severity: 'info',
        icon: 'solar:inbox-line-linear',
        title: 'Received — waiting to be picked up',
        text: 'Our team has this and will read the thread before doing anything. You can add more detail at any time.',
        accent: false,
      }
    case DISPUTE_STATUS.UNDER_REVIEW:
      return {
        severity: 'info',
        icon: 'solar:document-text-linear',
        title: 'Our team is reviewing',
        text: 'A reviewer is working through the order, the delivery, and everything said here. We will come back to you if we need anything.',
        accent: false,
      }
    case DISPUTE_STATUS.AWAITING_BUYER:
      return {
        severity: awaitsViewer ? 'warning' : 'info',
        icon: 'solar:chat-round-dots-linear',
        title: awaitsViewer ? 'Awaiting your response' : 'Waiting on the buyer',
        text: awaitsViewer
          ? 'Our team has asked you for something. Reply below and the review picks straight back up.'
          : 'Our team has asked the buyer for more information. Nothing is needed from you right now.',
        accent: awaitsViewer,
      }
    case DISPUTE_STATUS.AWAITING_CREATOR:
      return {
        severity: awaitsViewer ? 'warning' : 'info',
        icon: 'solar:chat-round-dots-linear',
        title: awaitsViewer ? 'Awaiting your response' : 'Waiting on the creator',
        text: awaitsViewer
          ? 'Our team has asked you for something. Reply below and the review picks straight back up.'
          : 'Our team has asked the creator for more information. Nothing is needed from you right now.',
        accent: awaitsViewer,
      }
    case DISPUTE_STATUS.ESCALATED:
      return {
        severity: 'info',
        icon: 'solar:shield-user-linear',
        title: 'With a senior reviewer',
        text: 'This case has been passed to a senior reviewer for a final decision. It usually takes a little longer, and you will be told the outcome here.',
        accent: false,
      }
    case DISPUTE_STATUS.RESOLVED:
      return {
        severity: 'success',
        icon: 'solar:shield-check-linear',
        title: 'Decided',
        text: 'A decision has been issued and applied to the order. The outcome and the reasoning are below.',
        accent: false,
      }
    case DISPUTE_STATUS.CLOSED:
      return {
        severity: 'info',
        icon: 'solar:archive-linear',
        title: 'Closed',
        text: 'This case is finished and kept here for your records. Nothing further is outstanding.',
        accent: false,
      }
    default:
      return { severity: 'info', icon: 'solar:shield-linear', title: '', text: '', accent: false }
  }
}

/** How an author is labelled in the thread — the team is never a person here. */
export function authorRoleLabel(authorRole) {
  if (authorRole === ROLES.ADMIN || authorRole === ROLES.SUPER_ADMIN) return 'BetterBlue Support'
  if (authorRole === ROLES.CREATOR) return 'Creator'
  return 'Buyer'
}
