// Seed: `auditLogs` — the immutable record of administrative action
// (Prompt 05 §4.3).
//
// Actions are dot-namespaced `domain.verb` strings and every entry points at a
// real record through `entityType` + `entityId`, so the audit console (Prompt
// 37) can link straight through to whatever was acted on. `meta` carries the
// detail a reviewer needs to understand the entry without opening the target.
//
// This is a log of what admins did, not a log of what happened: buyer and
// creator actions live in their own collections (orders, deliveries, disputes).

import { ROLES } from '../../src/constants/roles.js'
import {
  ACCOUNT_STATUS,
  CONTENT_STATUS,
  DISPUTE_RESOLUTION,
  DISPUTE_STATUS,
  PAYOUT_STATUS,
  REPORT_STATUS,
  TICKET_STATUS,
} from '../../src/constants/statuses.js'
import { REJECTION_REASON_CODE } from '../../src/constants/policy.js'
import { PERMISSIONS } from '../../src/constants/permissions.js'
import { CATEGORY_ID } from '../../src/constants/categoriesFallback.js'
import { ENTITY_TYPE, addDays, addHours, daysAgo, seqId } from '../seed-utils.js'
import { ADMIN_ID, buyerId, creatorId } from './users.js'
import { creatorProfileId } from './profiles.js'
import { portfolioItems } from './portfolio.js'
import { requestId } from './requests.js'
import { orderFor } from './orders.js'
import { disputes } from './disputes.js'
import { payouts } from './finance.js'
import { affiliateEarnings, affiliateProfiles } from './affiliate.js'
import { reports } from './moderation.js'
import { supportTickets } from './support.js'

const itemNamed = (title) => {
  const match = portfolioItems.find((item) => item.title === title)
  if (!match) throw new Error(`Unknown portfolio item: ${title}`)
  return match
}
/** Moderation decisions land twelve hours after the creator submitted. */
const decidedAt = (title) => addHours(itemNamed(title).submittedAt, 12)
/** The restriction that followed a report, nine days after publication. */
const restrictedAt = (title) => addDays(itemNamed(title).publishedAt, 9)
const reportId = (index) => reports[index].id
const ticketId = (index) => supportTickets[index].id
const disputeOn = (key) =>
  disputes.find((dispute) => dispute.orderId === orderFor(key).id).id
const payoutFor = (creatorKey) =>
  payouts.find((payout) => payout.creatorId === creatorId(creatorKey)).id

/** Admin roles, so `actorRole` never has to be restated per entry. */
const ROLE_BY_ACTOR = {
  [ADMIN_ID.SUPER]: ROLES.SUPER_ADMIN,
  [ADMIN_ID.MAYA]: ROLES.ADMIN,
  [ADMIN_ID.DANIEL]: ROLES.ADMIN,
  [ADMIN_ID.PRIYA]: ROLES.ADMIN,
}

const AUDIT_SOURCE = [
  /* --- Platform setup ----------------------------------------------------- */
  {
    actor: ADMIN_ID.SUPER,
    action: 'admin.create',
    entityType: ENTITY_TYPE.USER,
    entityId: ADMIN_ID.MAYA,
    meta: { name: 'Maya Chen', role: ROLES.ADMIN, permissionCount: 10 },
    daysAgo: 117,
  },
  {
    actor: ADMIN_ID.SUPER,
    action: 'admin.create',
    entityType: ENTITY_TYPE.USER,
    entityId: ADMIN_ID.DANIEL,
    meta: { name: 'Daniel Okafor', role: ROLES.ADMIN, permissionCount: 5 },
    daysAgo: 116,
  },
  {
    actor: ADMIN_ID.SUPER,
    action: 'admin.create',
    entityType: ENTITY_TYPE.USER,
    entityId: ADMIN_ID.PRIYA,
    meta: { name: 'Priya Raman', role: ROLES.ADMIN, permissionCount: 4 },
    daysAgo: 115,
  },
  {
    actor: ADMIN_ID.SUPER,
    action: 'settings.update',
    entityType: ENTITY_TYPE.PLATFORM_SETTINGS,
    entityId: 'platformSettings',
    meta: { section: 'commission', field: 'defaultRate', from: 0.25, to: 0.2 },
    daysAgo: 96,
  },
  {
    actor: ADMIN_ID.MAYA,
    action: 'category.update',
    entityType: ENTITY_TYPE.CATEGORY,
    entityId: CATEGORY_ID.EVENTS_ENTERTAINMENT,
    meta: { field: 'sortOrder', from: 14, to: 12 },
    daysAgo: 88,
  },

  /* --- Creator verification ---------------------------------------------- */
  {
    actor: ADMIN_ID.MAYA,
    action: 'user.verify',
    entityType: ENTITY_TYPE.USER,
    entityId: creatorId('ava'),
    meta: { verified: true, evidence: 'business registration and portfolio review' },
    daysAgo: 110,
  },
  {
    actor: ADMIN_ID.MAYA,
    action: 'user.verify',
    entityType: ENTITY_TYPE.USER,
    entityId: creatorId('liam'),
    meta: { verified: true, evidence: 'business registration and portfolio review' },
    daysAgo: 109,
  },
  {
    actor: ADMIN_ID.MAYA,
    action: 'user.verify',
    entityType: ENTITY_TYPE.USER,
    entityId: creatorId('zoe'),
    meta: { verified: true, evidence: 'business registration and portfolio review' },
    daysAgo: 108,
  },
  {
    actor: ADMIN_ID.MAYA,
    action: 'user.verify',
    entityType: ENTITY_TYPE.USER,
    entityId: creatorId('isla'),
    meta: { verified: true, evidence: 'business registration and portfolio review' },
    daysAgo: 104,
  },
  {
    actor: ADMIN_ID.MAYA,
    action: 'creator.feature',
    entityType: ENTITY_TYPE.CREATOR_PROFILE,
    entityId: creatorProfileId('ava'),
    meta: { featured: true, reason: 'consistently high ratings across food and product work' },
    daysAgo: 64,
  },
  {
    actor: ADMIN_ID.MAYA,
    action: 'creator.feature',
    entityType: ENTITY_TYPE.CREATOR_PROFILE,
    entityId: creatorProfileId('zoe'),
    meta: { featured: true, reason: 'strong beauty and fashion campaign portfolio' },
    daysAgo: 63,
  },

  /* --- Moderation decisions ---------------------------------------------- */
  {
    actor: ADMIN_ID.PRIYA,
    action: 'moderation.approve',
    entityType: ENTITY_TYPE.PORTFOLIO_ITEM,
    entityId: itemNamed('Studio campaign film for a sustainable denim drop').id,
    meta: { fromStatus: CONTENT_STATUS.UNDER_REVIEW, toStatus: CONTENT_STATUS.APPROVED },
    at: decidedAt('Studio campaign film for a sustainable denim drop'),
  },
  {
    actor: ADMIN_ID.PRIYA,
    action: 'moderation.approve',
    entityType: ENTITY_TYPE.PORTFOLIO_ITEM,
    entityId: itemNamed('Loft apartment walkthrough film').id,
    meta: { fromStatus: CONTENT_STATUS.UNDER_REVIEW, toStatus: CONTENT_STATUS.APPROVED },
    at: decidedAt('Loft apartment walkthrough film'),
  },
  {
    actor: ADMIN_ID.PRIYA,
    action: 'moderation.approve',
    entityType: ENTITY_TYPE.PORTFOLIO_ITEM,
    entityId: itemNamed('Tailoring atelier process film').id,
    meta: { fromStatus: CONTENT_STATUS.UNDER_REVIEW, toStatus: CONTENT_STATUS.APPROVED },
    at: decidedAt('Tailoring atelier process film'),
  },
  {
    actor: ADMIN_ID.PRIYA,
    action: 'moderation.request_changes',
    entityType: ENTITY_TYPE.PORTFOLIO_ITEM,
    entityId: itemNamed('Resistance band range demonstration set').id,
    meta: {
      toStatus: CONTENT_STATUS.REVISION_REQUIRED,
      reasonCode: REJECTION_REASON_CODE.LOW_PRODUCTION_QUALITY,
    },
    at: decidedAt('Resistance band range demonstration set'),
  },
  {
    actor: ADMIN_ID.PRIYA,
    action: 'moderation.request_changes',
    entityType: ENTITY_TYPE.PORTFOLIO_ITEM,
    entityId: itemNamed('Lakeside venue tour film').id,
    meta: {
      toStatus: CONTENT_STATUS.REVISION_REQUIRED,
      reasonCode: REJECTION_REASON_CODE.LOW_PRODUCTION_QUALITY,
    },
    at: decidedAt('Lakeside venue tour film'),
  },
  {
    actor: ADMIN_ID.PRIYA,
    action: 'moderation.reject',
    entityType: ENTITY_TYPE.PORTFOLIO_ITEM,
    entityId: itemNamed('Facial oil dropper macro set').id,
    meta: {
      toStatus: CONTENT_STATUS.REJECTED,
      reasonCode: REJECTION_REASON_CODE.IP_VIOLATION,
    },
    at: decidedAt('Facial oil dropper macro set'),
  },
  {
    actor: ADMIN_ID.PRIYA,
    action: 'moderation.reject',
    entityType: ENTITY_TYPE.PORTFOLIO_ITEM,
    entityId: itemNamed('New-build show home series').id,
    meta: {
      toStatus: CONTENT_STATUS.REJECTED,
      reasonCode: REJECTION_REASON_CODE.METADATA_INCOMPLETE,
    },
    at: decidedAt('New-build show home series'),
  },
  {
    actor: ADMIN_ID.PRIYA,
    action: 'content.restrict',
    entityType: ENTITY_TYPE.PORTFOLIO_ITEM,
    entityId: itemNamed('Bath and body gift set stills').id,
    meta: {
      fromStatus: CONTENT_STATUS.PUBLISHED,
      toStatus: CONTENT_STATUS.RESTRICTED,
      reportId: reportId(2),
    },
    at: restrictedAt('Bath and body gift set stills'),
  },

  /* --- Member reports ----------------------------------------------------- */
  {
    actor: ADMIN_ID.PRIYA,
    action: 'report.action',
    entityType: ENTITY_TYPE.REPORT,
    entityId: reportId(2),
    meta: { status: REPORT_STATUS.ACTIONED, outcome: 'content restricted pending licence evidence' },
    at: restrictedAt('Bath and body gift set stills'),
  },
  {
    actor: ADMIN_ID.PRIYA,
    action: 'report.review',
    entityType: ENTITY_TYPE.REPORT,
    entityId: reportId(1),
    meta: { status: REPORT_STATUS.REVIEWED, outcome: 'referred to the account review already in progress' },
    daysAgo: 32,
  },
  {
    actor: ADMIN_ID.MAYA,
    action: 'report.dismiss',
    entityType: ENTITY_TYPE.REPORT,
    entityId: reportId(3),
    meta: { status: REPORT_STATUS.DISMISSED, outcome: 'campaign copy checked and compliant' },
    daysAgo: 4,
  },

  /* --- Account actions ---------------------------------------------------- */
  {
    actor: ADMIN_ID.MAYA,
    action: 'user.suspend',
    entityType: ENTITY_TYPE.USER,
    entityId: creatorId('chloe'),
    meta: {
      fromStatus: ACCOUNT_STATUS.ACTIVE,
      toStatus: ACCOUNT_STATUS.SUSPENDED,
      reason: 'Licensing review following an upheld report and an unresolved non-delivery dispute.',
    },
    daysAgo: 29,
  },
  {
    actor: ADMIN_ID.SUPER,
    action: 'admin.permissions.update',
    entityType: ENTITY_TYPE.USER,
    entityId: ADMIN_ID.MAYA,
    meta: { added: [PERMISSIONS.AUDIT_VIEW, PERMISSIONS.CATEGORIES_MANAGE], removed: [] },
    daysAgo: 58,
  },
  {
    actor: ADMIN_ID.SUPER,
    action: 'admin.permissions.update',
    entityType: ENTITY_TYPE.USER,
    entityId: ADMIN_ID.DANIEL,
    meta: { added: [PERMISSIONS.AFFILIATES_MANAGE], removed: [] },
    daysAgo: 45,
  },

  /* --- Disputes ------------------------------------------------------------ */
  {
    actor: ADMIN_ID.MAYA,
    action: 'dispute.assign',
    entityType: ENTITY_TYPE.DISPUTE,
    entityId: disputeOn('cancelled_bloom_serum'),
    meta: { assignedTo: ADMIN_ID.MAYA, toStatus: DISPUTE_STATUS.UNDER_REVIEW },
    daysAgo: 39,
  },
  {
    actor: ADMIN_ID.MAYA,
    action: 'dispute.resolve',
    entityType: ENTITY_TYPE.DISPUTE,
    entityId: disputeOn('cancelled_bloom_serum'),
    meta: { outcome: DISPUTE_RESOLUTION.FULL_REFUND, amountRefunded: 610 },
    daysAgo: 33,
  },
  {
    actor: ADMIN_ID.DANIEL,
    action: 'payment.refund',
    entityType: ENTITY_TYPE.ORDER,
    entityId: orderFor('cancelled_bloom_serum').id,
    meta: { amount: 610, reason: 'dispute resolution: full refund' },
    daysAgo: 33,
  },
  {
    actor: ADMIN_ID.MAYA,
    action: 'dispute.assign',
    entityType: ENTITY_TYPE.DISPUTE,
    entityId: disputeOn('completed_atlas_villa'),
    meta: { assignedTo: ADMIN_ID.MAYA, toStatus: DISPUTE_STATUS.UNDER_REVIEW },
    daysAgo: 25,
  },
  {
    actor: ADMIN_ID.MAYA,
    action: 'dispute.resolve',
    entityType: ENTITY_TYPE.DISPUTE,
    entityId: disputeOn('completed_atlas_villa'),
    meta: { outcome: DISPUTE_RESOLUTION.PARTIAL_REFUND, amountRefunded: 205 },
    daysAgo: 18,
  },
  {
    actor: ADMIN_ID.DANIEL,
    action: 'payment.refund',
    entityType: ENTITY_TYPE.ORDER,
    entityId: orderFor('completed_atlas_villa').id,
    meta: { amount: 205, reason: 'dispute resolution: partial refund' },
    daysAgo: 18,
  },
  {
    actor: ADMIN_ID.PRIYA,
    action: 'dispute.assign',
    entityType: ENTITY_TYPE.DISPUTE,
    entityId: disputeOn('completed_urbannest_loft'),
    meta: { assignedTo: ADMIN_ID.PRIYA, toStatus: DISPUTE_STATUS.UNDER_REVIEW },
    daysAgo: 20,
  },
  {
    actor: ADMIN_ID.PRIYA,
    action: 'dispute.resolve',
    entityType: ENTITY_TYPE.DISPUTE,
    entityId: disputeOn('completed_urbannest_loft'),
    meta: { outcome: DISPUTE_RESOLUTION.RELEASE_PAYMENT, amountRefunded: 0 },
    daysAgo: 14,
  },
  {
    actor: ADMIN_ID.PRIYA,
    action: 'dispute.close',
    entityType: ENTITY_TYPE.DISPUTE,
    entityId: disputeOn('completed_urbannest_loft'),
    meta: { fromStatus: DISPUTE_STATUS.RESOLVED, toStatus: DISPUTE_STATUS.CLOSED },
    daysAgo: 12,
  },
  {
    actor: ADMIN_ID.MAYA,
    action: 'dispute.assign',
    entityType: ENTITY_TYPE.DISPUTE,
    entityId: disputeOn('awarded_craftware_demo'),
    meta: { assignedTo: ADMIN_ID.MAYA, toStatus: DISPUTE_STATUS.UNDER_REVIEW },
    daysAgo: 17,
  },

  /* --- Marketplace operations --------------------------------------------- */
  {
    actor: ADMIN_ID.MAYA,
    action: 'order.cancel',
    entityType: ENTITY_TYPE.ORDER,
    entityId: orderFor('cancelled_atlas_winter').id,
    meta: { reason: 'Buyer postponed the event; the order was never funded.' },
    daysAgo: 21,
  },
  {
    actor: ADMIN_ID.MAYA,
    action: 'request.close',
    entityType: ENTITY_TYPE.REQUEST,
    entityId: requestId('closed_cocoa_easter'),
    meta: { reason: 'Closed at the buyer’s request after the range sold out.' },
    daysAgo: 40,
  },

  /* --- Finance ------------------------------------------------------------- */
  {
    actor: ADMIN_ID.DANIEL,
    action: 'payout.process',
    entityType: ENTITY_TYPE.PAYOUT,
    entityId: payoutFor('ava'),
    meta: { amount: 1200, fromStatus: PAYOUT_STATUS.REQUESTED, toStatus: PAYOUT_STATUS.PROCESSING },
    daysAgo: 23,
  },
  {
    actor: ADMIN_ID.DANIEL,
    action: 'payout.mark_paid',
    entityType: ENTITY_TYPE.PAYOUT,
    entityId: payoutFor('ava'),
    meta: { amount: 1200, toStatus: PAYOUT_STATUS.PAID },
    daysAgo: 21,
  },
  {
    actor: ADMIN_ID.DANIEL,
    action: 'payout.reject',
    entityType: ENTITY_TYPE.PAYOUT,
    entityId: payoutFor('chloe'),
    meta: { amount: 400, toStatus: PAYOUT_STATUS.REJECTED, reason: 'account under review' },
    daysAgo: 24,
  },
  {
    actor: ADMIN_ID.DANIEL,
    action: 'payout.process',
    entityType: ENTITY_TYPE.PAYOUT,
    entityId: payoutFor('liam'),
    meta: { amount: 1500, fromStatus: PAYOUT_STATUS.REQUESTED, toStatus: PAYOUT_STATUS.PROCESSING },
    daysAgo: 4,
  },

  /* --- Affiliate programme -------------------------------------------------- */
  {
    actor: ADMIN_ID.DANIEL,
    action: 'affiliate.earning.approve',
    entityType: ENTITY_TYPE.AFFILIATE_EARNING,
    entityId: affiliateEarnings[1].id,
    meta: { amount: affiliateEarnings[1].amount, code: 'AVA-STUDIO' },
    daysAgo: 52,
  },
  {
    actor: ADMIN_ID.DANIEL,
    action: 'affiliate.suspend',
    entityType: ENTITY_TYPE.AFFILIATE_PROFILE,
    entityId: affiliateProfiles[2].id,
    meta: {
      code: 'NIMBUS-PARTNER',
      reason: 'Referral traffic failed the quality review; accrued commission voided.',
    },
    daysAgo: 15,
  },
  {
    actor: ADMIN_ID.DANIEL,
    action: 'affiliate.earning.void',
    entityType: ENTITY_TYPE.AFFILIATE_EARNING,
    entityId: affiliateEarnings[3].id,
    meta: { amount: affiliateEarnings[3].amount, reason: 'affiliate account suspended' },
    daysAgo: 15,
  },

  /* --- Support -------------------------------------------------------------- */
  {
    actor: ADMIN_ID.PRIYA,
    action: 'ticket.reply',
    entityType: ENTITY_TYPE.SUPPORT_TICKET,
    entityId: ticketId(2),
    meta: { status: TICKET_STATUS.RESOLVED },
    daysAgo: 9,
  },
  {
    actor: ADMIN_ID.MAYA,
    action: 'ticket.reply',
    entityType: ENTITY_TYPE.SUPPORT_TICKET,
    entityId: ticketId(1),
    meta: { status: TICKET_STATUS.PENDING },
    daysAgo: 10,
  },
  {
    actor: ADMIN_ID.MAYA,
    action: 'ticket.close',
    entityType: ENTITY_TYPE.SUPPORT_TICKET,
    entityId: ticketId(3),
    meta: { status: TICKET_STATUS.CLOSED, reason: 'consolidated into the account review' },
    daysAgo: 21,
  },

  /* --- Communications ------------------------------------------------------- */
  {
    actor: ADMIN_ID.SUPER,
    action: 'settings.update',
    entityType: ENTITY_TYPE.PLATFORM_SETTINGS,
    entityId: 'platformSettings',
    meta: { section: 'moderation', field: 'reviewSlaDays', from: 3, to: 2 },
    daysAgo: 12,
  },
  {
    actor: ADMIN_ID.MAYA,
    action: 'announcement.send',
    entityType: ENTITY_TYPE.USER,
    entityId: buyerId('verde'),
    meta: { audience: ROLES.BUYER, subject: 'Escrow protection now covers revisions', recipients: 8 },
    daysAgo: 9,
  },
]

export const auditLogs = AUDIT_SOURCE.map((source, index) => ({
  id: seqId('aud', index + 1),
  actorId: source.actor,
  actorRole: ROLE_BY_ACTOR[source.actor],
  action: source.action,
  entityType: source.entityType,
  entityId: source.entityId,
  meta: source.meta,
  createdAt: source.at ?? daysAgo(source.daysAgo, 15, 45),
}))
