// Seed: `moderationReviews` + `reports` — the Trust & Safety content queue
// (Prompt 05 §4.3).
//
// A moderation review is opened for every portfolio item that is not a private
// draft and has not been retired by its owner, plus the most recent published
// items (so the "recently decided" tab has history) and two deliverables that
// were pulled out of auto-approval for a closer look.
//
// `status` mirrors where the content actually sits, and `history[]` records
// how it got there — the same shape the moderation console (Prompt 30) appends
// to when a reviewer acts. Reviews of content that is still waiting carry no
// `reviewerId` and no `reviewedAt`, which is exactly what the queue filters on.

import { CONTENT_STATUS, REPORT_STATUS } from '../../src/constants/statuses.js'
import { REJECTION_REASON_CODE } from '../../src/constants/policy.js'
import {
  MODERATION_SUBJECT,
  REPORT_REASON,
  REPORT_SUBJECT,
  addDays,
  addHours,
  compact,
  daysAgo,
  seqId,
} from '../seed-utils.js'
import { ADMIN_ID } from './users.js'
import { USER_BY_CREATOR_PROFILE, creatorProfileId } from './profiles.js'
import { portfolioItems, rejectionReasonCodeById } from './portfolio.js'
import { deliveriesFor, orderFor } from './orders.js'
import { requestId } from './requests.js'

/* -------------------------------------------------------------------------- */
/* Reviewer notes                                                             */
/* -------------------------------------------------------------------------- */

/** Decision notes by outcome — written the way a reviewer would record them. */
const DECISION_NOTES = {
  [CONTENT_STATUS.APPROVED]:
    'Commercial brand content, rights and metadata in order. Approved for publication.',
  [CONTENT_STATUS.REJECTED]:
    'Does not meet the Content Policy on rights and licensing. The creator has been sent the reason and can re-submit once it is resolved.',
  [CONTENT_STATUS.REVISION_REQUIRED]:
    'Close, but the submission needs changes before it can be published. Details sent to the creator.',
  [CONTENT_STATUS.RESTRICTED]:
    'Removed from public view following an upheld member report. The creator has been notified and can appeal through support.',
}

/**
 * Fallback reason codes by outcome. An item that states its own reason
 * (`rejectionReasonCodeById`) wins over these, so the code on the case and the
 * copy the creator reads always describe the same decision.
 */
const REASON_BY_STATUS = {
  [CONTENT_STATUS.REJECTED]: REJECTION_REASON_CODE.IP_VIOLATION,
  [CONTENT_STATUS.REVISION_REQUIRED]: REJECTION_REASON_CODE.LOW_PRODUCTION_QUALITY,
  // Restricted after an upheld member report about a licensed backdrop — the
  // contract requires a code on this outcome too (§6.20).
  [CONTENT_STATUS.RESTRICTED]: REJECTION_REASON_CODE.IP_VIOLATION,
}

/** Reviewers rotate so the queue is not owned by one admin. */
const REVIEWERS = [ADMIN_ID.PRIYA, ADMIN_ID.MAYA]

/* -------------------------------------------------------------------------- */
/* Which content is in the queue                                              */
/* -------------------------------------------------------------------------- */

/** Item states that always carry an open or recently closed review. */
const REVIEWABLE_ITEM_STATUSES = new Set([
  CONTENT_STATUS.SUBMITTED,
  CONTENT_STATUS.UNDER_REVIEW,
  CONTENT_STATUS.REJECTED,
  CONTENT_STATUS.REVISION_REQUIRED,
  CONTENT_STATUS.RESTRICTED,
])

const queuedItems = portfolioItems.filter((item) =>
  REVIEWABLE_ITEM_STATUSES.has(item.status)
)

// Recently published work, newest first — decided, and useful history in the
// console. `submittedAt` is never null for a published item.
const recentlyPublished = portfolioItems
  .filter((item) => item.status === CONTENT_STATUS.PUBLISHED)
  .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
  .slice(0, 8)

/* -------------------------------------------------------------------------- */
/* Assembly                                                                   */
/* -------------------------------------------------------------------------- */

const moderationReviews = []
let reviewSequence = 0

/**
 * Builds the review record and the transition history behind it.
 * `outcome` is the moderation state the content ended in; `submittedAt` is
 * when the creator sent it for review.
 */
function addModerationReview({
  subjectType,
  subjectId,
  creatorUserId,
  outcome,
  submittedAt,
  reviewerIndex,
  decidedAt,
  publishedAt,
  reasonCode,
  notes,
}) {
  reviewSequence += 1
  const reviewerId = REVIEWERS[reviewerIndex % REVIEWERS.length]
  const pickedUpAt = addHours(submittedAt, 6)
  const isWaiting = outcome === CONTENT_STATUS.SUBMITTED
  const isOpen = isWaiting || outcome === CONTENT_STATUS.UNDER_REVIEW

  const history = [
    {
      at: submittedAt,
      byId: creatorUserId,
      fromStatus: CONTENT_STATUS.DRAFT,
      toStatus: CONTENT_STATUS.SUBMITTED,
      note: 'Submitted for review by the creator.',
    },
  ]

  if (!isWaiting) {
    history.push({
      at: pickedUpAt,
      byId: reviewerId,
      fromStatus: CONTENT_STATUS.SUBMITTED,
      toStatus: CONTENT_STATUS.UNDER_REVIEW,
      note: 'Picked up from the review queue.',
    })
  }

  // A restricted item was approved and published first, then acted on after a
  // member report — the history has to show all three steps.
  const decisionStatus =
    outcome === CONTENT_STATUS.RESTRICTED ? CONTENT_STATUS.APPROVED : outcome

  // The item's own copy, when it has any, is what the creator was actually
  // sent — so it is the note on the decision rather than the generic line.
  const decisionNote =
    (decisionStatus === outcome ? notes : undefined) ?? DECISION_NOTES[decisionStatus]

  if (!isOpen) {
    history.push({
      at: decidedAt,
      byId: reviewerId,
      fromStatus: CONTENT_STATUS.UNDER_REVIEW,
      toStatus: decisionStatus,
      note: decisionNote,
    })
  }

  if (outcome === CONTENT_STATUS.RESTRICTED) {
    history.push(
      {
        at: publishedAt,
        byId: creatorUserId,
        fromStatus: CONTENT_STATUS.APPROVED,
        toStatus: CONTENT_STATUS.PUBLISHED,
        note: 'Published to the public profile.',
      },
      {
        at: addDays(publishedAt, 9),
        byId: reviewerId,
        fromStatus: CONTENT_STATUS.PUBLISHED,
        toStatus: CONTENT_STATUS.RESTRICTED,
        note: DECISION_NOTES[CONTENT_STATUS.RESTRICTED],
      }
    )
  }

  moderationReviews.push(
    compact({
      id: seqId('mod', reviewSequence),
      subjectType,
      subjectId,
      creatorId: creatorUserId,
      status: outcome,
      reviewerId: isWaiting ? undefined : reviewerId,
      // `notes` summarises where the case stands *now*, which is the note on
      // its last step — for a restricted item that is the restriction, not the
      // approval that preceded it.
      notes: isOpen ? undefined : history[history.length - 1].note,
      reasonCode: reasonCode ?? REASON_BY_STATUS[outcome],
      history,
      submittedAt,
      reviewedAt: isOpen ? null : history[history.length - 1].at,
    })
  )
}

queuedItems.forEach((item, index) => {
  addModerationReview({
    subjectType: MODERATION_SUBJECT.PORTFOLIO_ITEM,
    subjectId: item.id,
    creatorUserId: USER_BY_CREATOR_PROFILE[item.creatorId],
    outcome: item.status,
    submittedAt: item.submittedAt,
    reviewerIndex: index,
    decidedAt: addHours(item.submittedAt, 12),
    publishedAt: item.publishedAt,
    reasonCode: rejectionReasonCodeById[item.id],
    notes: item.rejectionReason,
  })
})

recentlyPublished.forEach((item, index) => {
  addModerationReview({
    subjectType: MODERATION_SUBJECT.PORTFOLIO_ITEM,
    subjectId: item.id,
    creatorUserId: USER_BY_CREATOR_PROFILE[item.creatorId],
    outcome: CONTENT_STATUS.APPROVED,
    submittedAt: item.submittedAt,
    reviewerIndex: index + 1,
    decidedAt: addHours(item.submittedAt, 12),
  })
})

/* Deliverables pulled out of auto-approval --------------------------------- */

// Deliveries normally auto-approve (platformSettings.moderation
// .autoApproveDeliveries), so only flagged ones reach the queue.
//
// Prompt 30 widened this from two to five so the console's Deliverables tab has
// a queue to work rather than a single row: three undecided cases across both
// open statuses, plus the decided pair that gives the tab some history.
const flaggedDeliveries = [
  {
    requestKey: 'awarded_craftware_demo',
    outcome: CONTENT_STATUS.UNDER_REVIEW,
  },
  {
    requestKey: 'completed_bloom_campaign',
    outcome: CONTENT_STATUS.APPROVED,
  },
  {
    requestKey: 'awarded_bloom_texture',
    outcome: CONTENT_STATUS.SUBMITTED,
  },
  {
    requestKey: 'awarded_atlas_hotel',
    outcome: CONTENT_STATUS.SUBMITTED,
  },
  {
    requestKey: 'awarded_verde_supper',
    outcome: CONTENT_STATUS.UNDER_REVIEW,
  },
]

flaggedDeliveries.forEach((flagged, index) => {
  const order = orderFor(flagged.requestKey)
  const orderDeliveries = deliveriesFor(order.id)
  const delivery = orderDeliveries[orderDeliveries.length - 1]
  addModerationReview({
    subjectType: MODERATION_SUBJECT.DELIVERY,
    subjectId: delivery.id,
    creatorUserId: order.creatorId,
    outcome: flagged.outcome,
    submittedAt: delivery.submittedAt,
    reviewerIndex: index,
    decidedAt: addHours(delivery.submittedAt, 20),
  })
})

/* -------------------------------------------------------------------------- */
/* Member reports                                                             */
/* -------------------------------------------------------------------------- */

const restrictedItem = portfolioItems.find(
  (item) => item.status === CONTENT_STATUS.RESTRICTED
)
const flaggedSubmission = portfolioItems.find(
  (item) =>
    item.status === CONTENT_STATUS.SUBMITTED &&
    item.creatorId === creatorProfileId('mateo')
)

const REPORT_SOURCE = [
  {
    reporterId: 'usr_buyer_pulse',
    subjectType: REPORT_SUBJECT.PORTFOLIO_ITEM,
    subjectId: flaggedSubmission.id,
    reason: REPORT_REASON.INTELLECTUAL_PROPERTY,
    details:
      'Two shots in this submission look like they come from a production company showreel we licensed last year. Worth checking who holds the rights before it goes live.',
    status: REPORT_STATUS.OPEN,
    createdDaysAgo: 3,
  },
  {
    reporterId: 'usr_creator_zoe',
    subjectType: REPORT_SUBJECT.CREATOR_PROFILE,
    subjectId: creatorProfileId('chloe'),
    reason: REPORT_REASON.INTELLECTUAL_PROPERTY,
    details:
      'A backdrop in several portfolio images looks like licensed stock being used commercially. Flagging so the licence can be checked rather than assuming anything.',
    status: REPORT_STATUS.REVIEWED,
    handledById: ADMIN_ID.PRIYA,
    createdDaysAgo: 34,
  },
  {
    reporterId: 'usr_buyer_bloom',
    subjectType: REPORT_SUBJECT.PORTFOLIO_ITEM,
    subjectId: restrictedItem.id,
    reason: REPORT_REASON.INTELLECTUAL_PROPERTY,
    details:
      'This gift set image appears in a competitor campaign from last season. It may have been delivered under an exclusive licence.',
    status: REPORT_STATUS.ACTIONED,
    handledById: ADMIN_ID.PRIYA,
    createdDaysAgo: 44,
  },
  {
    reporterId: undefined,
    subjectType: REPORT_SUBJECT.REQUEST,
    subjectId: requestId('open_nimbus_class'),
    reason: REPORT_REASON.MISLEADING_CLAIMS,
    details:
      'The brief mentions a membership offer without any terms attached. Reporting so someone can confirm the campaign copy is compliant.',
    status: REPORT_STATUS.DISMISSED,
    handledById: ADMIN_ID.MAYA,
    createdDaysAgo: 5,
  },
]

const reports = REPORT_SOURCE.map((source, index) =>
  compact({
    id: seqId('rpt', index + 1),
    reporterId: source.reporterId,
    subjectType: source.subjectType,
    subjectId: source.subjectId,
    reason: source.reason,
    details: source.details,
    status: source.status,
    handledById: source.handledById,
    createdAt: daysAgo(source.createdDaysAgo, 14, 10),
  })
)

export { moderationReviews, reports }
