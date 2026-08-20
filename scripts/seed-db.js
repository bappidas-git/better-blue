#!/usr/bin/env node
// BetterBlue mock database generator — `npm run seed` (Prompt 05).
//
// Assembles every collection from `scripts/seed-data/*`, computes the derived
// aggregates, validates referential integrity, enum membership, money math and
// chronology, then writes pretty-printed `server/db.json`.
//
// The run is fully deterministic: no `Date.now()`, no `Math.random()`, and
// every timestamp derives from `SEED_ANCHOR` in `scripts/seed-utils.js`. Two
// consecutive runs produce byte-identical output, so `server/db.json` can be
// committed and diffed like any other source file.
//
// Any integrity failure prints an actionable message and exits non-zero —
// db.json is never written from a dataset that does not hold together.
//
// Usage: node scripts/seed-db.js [--check]
//   --check  validate and report without writing the file

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { ROLES, ROLE_VALUES } from '../src/constants/roles.js'
import { PERMISSION_VALUES } from '../src/constants/permissions.js'
import { NOTIFICATION_TYPE } from '../src/constants/notificationTypes.js'
import { REJECTION_REASON_CODE } from '../src/constants/policy.js'
import { getCreatorLevel } from '../src/constants/creatorLevels.js'
import { getFeedDealStatus } from '../src/constants/feedStatus.js'
import {
  ACCOUNT_STATUS,
  AFFILIATE_EARNING_STATUS,
  AFFILIATE_PROFILE_STATUS,
  CONTENT_STATUS,
  CONTENT_TYPE,
  DELIVERY_STATUS,
  DISPUTE_CATEGORY,
  DISPUTE_RESOLUTION,
  DISPUTE_STATUS,
  ORDER_STATUS,
  PAYMENT_STATUS,
  PAYOUT_STATUS,
  PROPOSAL_STATUS,
  REFERRAL_STATUS,
  REPORT_STATUS,
  REQUEST_STATUS,
  TICKET_STATUS,
  TRANSACTION_TYPE,
  USAGE_RIGHTS,
} from '../src/constants/statuses.js'

import {
  BUDGET_TYPE,
  ENTITY_TYPE,
  MEDIA_TYPE,
  MODERATION_SUBJECT,
  ORIENTATION,
  REPORT_REASON,
  REPORT_SUBJECT,
  SEED_ANCHOR,
  SEED_WINDOW_DAYS,
  VISIBILITY,
  ms,
  round2,
} from './seed-utils.js'

import { users } from './seed-data/users.js'
import { CREATOR_CARRIED_OVER, buyerProfiles, creatorProfiles } from './seed-data/profiles.js'
import { categories } from './seed-data/categories.js'
import { portfolioItems } from './seed-data/portfolio.js'
import { contentRequests } from './seed-data/requests.js'
import { feedReplies } from './seed-data/feedReplies.js'
import { proposals } from './seed-data/proposals.js'
import { deliveries, orders, revisions } from './seed-data/orders.js'
import { commissions, payments, payouts, transactions } from './seed-data/finance.js'
import { disputeMessages, disputes } from './seed-data/disputes.js'
import { reviews } from './seed-data/reviews.js'
import { notifications } from './seed-data/notifications.js'
import { moderationReviews, reports } from './seed-data/moderation.js'
import { supportTickets } from './seed-data/support.js'
import {
  affiliateEarnings,
  affiliateProfiles,
  affiliateReferrals,
} from './seed-data/affiliate.js'
import { auditLogs } from './seed-data/audit.js'
import { platformSettings } from './seed-data/settings.js'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = resolve(SCRIPT_DIR, '..', 'server', 'db.json')
const CHECK_ONLY = process.argv.includes('--check')

const ANCHOR_MS = ms(SEED_ANCHOR)
const WINDOW_START_MS = ANCHOR_MS - (SEED_WINDOW_DAYS + 4) * 24 * 60 * 60 * 1000

/* ========================================================================== */
/* Collections                                                                */
/* ========================================================================== */

// Order matters only for readability of db.json — JSON Server serves each key
// as its own route (00 §8). `platformSettings` is an object, not an array, so
// it is served as a singular route.
const db = {
  users,
  buyerProfiles,
  creatorProfiles,
  portfolioItems,
  categories,
  contentRequests,
  feedReplies,
  proposals,
  orders,
  deliveries,
  revisions,
  payments,
  transactions,
  commissions,
  payouts,
  disputes,
  disputeMessages,
  reviews,
  notifications,
  moderationReviews,
  reports,
  supportTickets,
  affiliateProfiles,
  affiliateReferrals,
  affiliateEarnings,
  auditLogs,
  platformSettings,
}

/* ========================================================================== */
/* Derived aggregates                                                         */
/* ========================================================================== */

const failures = []
const fail = (message) => failures.push(message)

const byId = (collection) => new Map(collection.map((row) => [row.id, row]))
const userById = byId(users)
const orderById = byId(orders)

/** Every user id that can hold a BetterBlue balance (creators + affiliates). */
const BALANCE_HOLDERS = new Set([
  ...users.filter((user) => user.role === ROLES.CREATOR).map((user) => user.id),
  ...affiliateProfiles.map((profile) => profile.userId),
])

/**
 * Transaction types that move a BetterBlue balance. A buyer's `charge` and
 * `refund` rows settle against their card, not against a balance held on the
 * platform, so they never contribute to `balanceAfter`.
 */
const BALANCE_TYPES = new Set([
  TRANSACTION_TYPE.RELEASE,
  TRANSACTION_TYPE.COMMISSION,
  TRANSACTION_TYPE.PAYOUT,
  TRANSACTION_TYPE.AFFILIATE_COMMISSION,
])

function computeAggregates() {
  // --- Requests: proposal count + the offer that won ------------------------
  contentRequests.forEach((request) => {
    const own = proposals.filter((proposal) => proposal.requestId === request.id)
    request.proposalsCount = own.length
    const accepted = own.find(
      (proposal) => proposal.status === PROPOSAL_STATUS.ACCEPTED
    )
    request.awardedProposalId = accepted ? accepted.id : null
  })

  // --- Feeds: how many creators have opened a reply thread (V2) -------------
  const repliesByFeed = feedReplies.reduce(
    (counts, reply) => counts.set(reply.feedId, (counts.get(reply.feedId) ?? 0) + 1),
    new Map()
  )
  contentRequests.forEach((request) => {
    request.repliesCount = repliesByFeed.get(request.id) ?? 0
  })

  // --- Creators: rating, completed orders, and the V2 storefront figures ----
  creatorProfiles.forEach((profile) => {
    const creatorReviews = reviews.filter(
      (review) => review.creatorId === profile.userId
    )
    const total = creatorReviews.reduce((sum, review) => sum + review.rating, 0)
    profile.ratingCount = creatorReviews.length
    profile.ratingAvg = creatorReviews.length
      ? Math.round((total / creatorReviews.length) * 10) / 10
      : 0
    profile.completedOrders = orders.filter(
      (order) =>
        order.creatorId === profile.userId &&
        order.status === ORDER_STATUS.COMPLETED
    ).length

    // Storefront V2 (prompts-v2/03). Each figure is what this database
    // actually contains **plus** the record the creator carried over when they
    // joined (`CREATOR_CARRIED_OVER`, which explains why the padding exists) —
    // never a number invented in place of one.
    const carried = CREATOR_CARRIED_OVER[profile.id] ?? {
      deliveries: 0,
      earned: 0,
      images: 0,
      videos: 0,
    }

    // Lifetime earnings the way `paymentService.getEarningsSummary` computes
    // them: every release, net of the commission taken off it.
    const ledgerEarned = transactions
      .filter(
        (transaction) =>
          transaction.userId === profile.userId &&
          (transaction.type === TRANSACTION_TYPE.RELEASE ||
            transaction.type === TRANSACTION_TYPE.COMMISSION)
      )
      .reduce((sum, transaction) => sum + transaction.amount, 0)

    const published = portfolioItems.filter(
      (item) => item.creatorId === profile.id && item.status === CONTENT_STATUS.PUBLISHED
    )
    const publishedOf = (mediaType) =>
      published.filter((item) => item.mediaType === mediaType).length

    profile.deliveriesCount = profile.completedOrders + carried.deliveries
    profile.totalEarned = round2(ledgerEarned + carried.earned)
    profile.contributionCounts = {
      images: publishedOf(MEDIA_TYPE.IMAGE) + carried.images,
      videos: publishedOf(MEDIA_TYPE.VIDEO) + carried.videos,
    }
    // The single source of the rule, shared with the app (00 §5): the seed
    // never hard-codes a level.
    profile.level = getCreatorLevel(profile)
  })

  // --- Buyers: lifetime spend, net of refunds -------------------------------
  const SPENT_STATUSES = new Set([
    PAYMENT_STATUS.HELD,
    PAYMENT_STATUS.RELEASED,
    PAYMENT_STATUS.PARTIALLY_REFUNDED,
  ])
  buyerProfiles.forEach((profile) => {
    profile.totalSpent = round2(
      payments
        .filter(
          (payment) =>
            payment.buyerId === profile.userId && SPENT_STATUSES.has(payment.status)
        )
        .reduce(
          (sum, payment) => sum + payment.amount - (payment.refundedAmount ?? 0),
          0
        )
    )
  })

  // --- Ledger: running balance for accounts that hold one -------------------
  const balances = new Map()
  transactions.forEach((transaction) => {
    if (!BALANCE_HOLDERS.has(transaction.userId) || !BALANCE_TYPES.has(transaction.type)) {
      transaction.balanceAfter = null
      return
    }
    const next = round2((balances.get(transaction.userId) ?? 0) + transaction.amount)
    balances.set(transaction.userId, next)
    transaction.balanceAfter = next
  })

  // --- Affiliates: earnings by state ----------------------------------------
  affiliateProfiles.forEach((profile) => {
    const own = affiliateEarnings.filter(
      (earning) => earning.affiliateId === profile.id
    )
    const sumOf = (status) =>
      round2(
        own
          .filter((earning) => earning.status === status)
          .reduce((sum, earning) => sum + earning.amount, 0)
      )
    profile.pendingEarnings = sumOf(AFFILIATE_EARNING_STATUS.PENDING)
    profile.approvedEarnings = sumOf(AFFILIATE_EARNING_STATUS.APPROVED)
    profile.paidEarnings = sumOf(AFFILIATE_EARNING_STATUS.PAID)
  })

  return { balances }
}

const { balances } = computeAggregates()

/** Unread notification counts — reported here, derived by the app at runtime. */
const unreadByUser = notifications.reduce((counts, notification) => {
  if (!notification.read) {
    counts.set(notification.userId, (counts.get(notification.userId) ?? 0) + 1)
  }
  return counts
}, new Map())

/* ========================================================================== */
/* Validation: shape and identifiers                                          */
/* ========================================================================== */

/** Expected id prefix per collection (00 §8). */
const ID_PREFIXES = {
  users: 'usr',
  buyerProfiles: 'bpr',
  creatorProfiles: 'cpr',
  portfolioItems: 'pfi',
  categories: 'cat',
  contentRequests: 'req',
  feedReplies: 'frp',
  proposals: 'prp',
  orders: 'ord',
  deliveries: 'dlv',
  revisions: 'rev',
  payments: 'pay',
  transactions: 'txn',
  commissions: 'com',
  payouts: 'pyo',
  disputes: 'dsp',
  disputeMessages: 'dmsg',
  reviews: 'rvw',
  notifications: 'ntf',
  moderationReviews: 'mod',
  reports: 'rpt',
  supportTickets: 'tkt',
  affiliateProfiles: 'aff',
  affiliateReferrals: 'ref',
  affiliateEarnings: 'aer',
  auditLogs: 'aud',
}

function validateIdentifiers() {
  Object.entries(ID_PREFIXES).forEach(([name, prefix]) => {
    const rows = db[name]
    if (!Array.isArray(rows)) {
      fail(`collection "${name}" is missing or is not an array`)
      return
    }
    if (rows.length === 0) fail(`collection "${name}" is empty`)

    const seen = new Set()
    rows.forEach((row, index) => {
      if (typeof row.id !== 'string' || row.id.length === 0) {
        fail(`${name}[${index}] has no id`)
        return
      }
      if (!row.id.startsWith(`${prefix}_`)) {
        fail(`${name}: id "${row.id}" should start with "${prefix}_" (00 §8)`)
      }
      if (seen.has(row.id)) fail(`${name}: duplicate id "${row.id}"`)
      seen.add(row.id)
    })
  })

  if (Array.isArray(db.platformSettings) || typeof db.platformSettings !== 'object') {
    fail('platformSettings must be a singleton object, not an array')
  }
}

/* ========================================================================== */
/* Validation: foreign keys                                                   */
/* ========================================================================== */

const FOREIGN_KEYS = [
  ['buyerProfiles', 'userId', 'users'],
  ['creatorProfiles', 'userId', 'users'],
  ['portfolioItems', 'creatorId', 'creatorProfiles'],
  ['portfolioItems', 'categoryId', 'categories'],
  ['contentRequests', 'buyerId', 'users'],
  ['contentRequests', 'categoryId', 'categories'],
  ['contentRequests', 'awardedProposalId', 'proposals', { optional: true }],
  // Storefront V2 — a reply belongs to a feed, a storefront, and the account
  // that posted the feed. `creatorId` points at `creatorProfiles`, not `users`,
  // like `portfolioItems.creatorId` (see docs/data-model.md §3).
  ['feedReplies', 'feedId', 'contentRequests'],
  ['feedReplies', 'creatorId', 'creatorProfiles'],
  ['feedReplies', 'buyerId', 'users'],
  ['proposals', 'requestId', 'contentRequests'],
  ['proposals', 'creatorId', 'users'],
  ['proposals', 'sampleItemIds', 'portfolioItems', { many: true }],
  ['orders', 'requestId', 'contentRequests'],
  ['orders', 'proposalId', 'proposals'],
  ['orders', 'buyerId', 'users'],
  ['orders', 'creatorId', 'users'],
  ['orders', 'categoryId', 'categories'],
  ['deliveries', 'orderId', 'orders'],
  ['deliveries', 'revisionId', 'revisions', { optional: true }],
  ['revisions', 'orderId', 'orders'],
  ['revisions', 'deliveryId', 'deliveries'],
  ['revisions', 'requestedById', 'users'],
  ['payments', 'orderId', 'orders'],
  ['payments', 'buyerId', 'users'],
  ['transactions', 'orderId', 'orders', { optional: true }],
  ['transactions', 'paymentId', 'payments', { optional: true }],
  ['transactions', 'payoutId', 'payouts', { optional: true }],
  ['transactions', 'userId', 'users'],
  ['commissions', 'orderId', 'orders'],
  ['payouts', 'creatorId', 'users'],
  ['disputes', 'orderId', 'orders'],
  ['disputes', 'raisedById', 'users'],
  ['disputes', 'againstId', 'users'],
  ['disputes', 'assignedAdminId', 'users', { optional: true }],
  ['disputeMessages', 'disputeId', 'disputes'],
  ['disputeMessages', 'authorId', 'users'],
  ['reviews', 'orderId', 'orders'],
  ['reviews', 'requestId', 'contentRequests'],
  ['reviews', 'buyerId', 'users'],
  ['reviews', 'creatorId', 'users'],
  ['notifications', 'userId', 'users'],
  ['moderationReviews', 'creatorId', 'users'],
  ['moderationReviews', 'reviewerId', 'users', { optional: true }],
  ['reports', 'reporterId', 'users', { optional: true }],
  ['reports', 'handledById', 'users', { optional: true }],
  ['supportTickets', 'userId', 'users', { optional: true }],
  ['affiliateProfiles', 'userId', 'users'],
  ['affiliateReferrals', 'affiliateId', 'affiliateProfiles'],
  ['affiliateReferrals', 'referredUserId', 'users'],
  ['affiliateReferrals', 'convertedOrderId', 'orders', { optional: true }],
  ['affiliateEarnings', 'affiliateId', 'affiliateProfiles'],
  ['affiliateEarnings', 'referralId', 'affiliateReferrals'],
  ['affiliateEarnings', 'orderId', 'orders'],
  ['auditLogs', 'actorId', 'users'],
]

/** Polymorphic `entityType` / `subjectType` values → the collection they name. */
const ENTITY_COLLECTION = {
  [ENTITY_TYPE.USER]: 'users',
  [ENTITY_TYPE.CREATOR_PROFILE]: 'creatorProfiles',
  [ENTITY_TYPE.PORTFOLIO_ITEM]: 'portfolioItems',
  [ENTITY_TYPE.CATEGORY]: 'categories',
  [ENTITY_TYPE.REQUEST]: 'contentRequests',
  [ENTITY_TYPE.PROPOSAL]: 'proposals',
  [ENTITY_TYPE.ORDER]: 'orders',
  [ENTITY_TYPE.DELIVERY]: 'deliveries',
  [ENTITY_TYPE.REVISION]: 'revisions',
  [ENTITY_TYPE.PAYMENT]: 'payments',
  [ENTITY_TYPE.PAYOUT]: 'payouts',
  [ENTITY_TYPE.DISPUTE]: 'disputes',
  [ENTITY_TYPE.REVIEW]: 'reviews',
  [ENTITY_TYPE.MODERATION_REVIEW]: 'moderationReviews',
  [ENTITY_TYPE.REPORT]: 'reports',
  [ENTITY_TYPE.SUPPORT_TICKET]: 'supportTickets',
  [ENTITY_TYPE.AFFILIATE_PROFILE]: 'affiliateProfiles',
  [ENTITY_TYPE.AFFILIATE_EARNING]: 'affiliateEarnings',
}

const indexes = new Map(
  Object.keys(ID_PREFIXES).map((name) => [name, new Set(db[name].map((row) => row.id))])
)

const exists = (collection, id) => indexes.get(collection)?.has(id) ?? false

function validateForeignKeys() {
  FOREIGN_KEYS.forEach(([name, field, target, options = {}]) => {
    db[name].forEach((row) => {
      const value = row[field]
      if (options.many) {
        if (!Array.isArray(value)) {
          fail(`${name}.${field} on ${row.id} should be an array`)
          return
        }
        value.forEach((id) => {
          if (!exists(target, id)) {
            fail(`${name}.${field} on ${row.id} → "${id}" not found in ${target}`)
          }
        })
        return
      }
      if (value === undefined || value === null) {
        if (!options.optional) {
          fail(`${name}.${field} on ${row.id} is required but missing`)
        }
        return
      }
      if (!exists(target, value)) {
        fail(`${name}.${field} on ${row.id} → "${value}" not found in ${target}`)
      }
    })
  })

  // Polymorphic references.
  const checkEntity = (label, id, type, entityId) => {
    if (type === ENTITY_TYPE.PLATFORM_SETTINGS) {
      if (entityId !== 'platformSettings') {
        fail(`${label} ${id} → platform settings reference must be "platformSettings"`)
      }
      return
    }
    const collection = ENTITY_COLLECTION[type]
    if (!collection) {
      fail(`${label} ${id} → unknown entityType "${type}"`)
      return
    }
    if (!exists(collection, entityId)) {
      fail(`${label} ${id} → "${entityId}" not found in ${collection}`)
    }
  }

  notifications.forEach((notification) => {
    if (notification.entityType === undefined) return
    checkEntity('notifications', notification.id, notification.entityType, notification.entityId)
  })
  auditLogs.forEach((entry) => {
    checkEntity('auditLogs', entry.id, entry.entityType, entry.entityId)
  })
  moderationReviews.forEach((review) => {
    const collection =
      review.subjectType === MODERATION_SUBJECT.PORTFOLIO_ITEM
        ? 'portfolioItems'
        : 'deliveries'
    if (!exists(collection, review.subjectId)) {
      fail(`moderationReviews ${review.id} → "${review.subjectId}" not found in ${collection}`)
    }
  })
  const REPORT_COLLECTION = {
    [REPORT_SUBJECT.PORTFOLIO_ITEM]: 'portfolioItems',
    [REPORT_SUBJECT.CREATOR_PROFILE]: 'creatorProfiles',
    [REPORT_SUBJECT.REQUEST]: 'contentRequests',
  }
  reports.forEach((report) => {
    const collection = REPORT_COLLECTION[report.subjectType]
    if (!exists(collection, report.subjectId)) {
      fail(`reports ${report.id} → "${report.subjectId}" not found in ${collection}`)
    }
  })

  // Nested author references.
  moderationReviews.forEach((review) => {
    review.history.forEach((entry, index) => {
      if (!exists('users', entry.byId)) {
        fail(`moderationReviews ${review.id} history[${index}].byId → "${entry.byId}" not found in users`)
      }
    })
  })
  supportTickets.forEach((ticket) => {
    ticket.replies.forEach((reply, index) => {
      if (!exists('users', reply.byId)) {
        fail(`supportTickets ${ticket.id} replies[${index}].byId → "${reply.byId}" not found in users`)
      }
    })
  })
  disputes.forEach((dispute) => {
    if (dispute.resolution && !exists('users', dispute.resolution.resolvedById)) {
      fail(`disputes ${dispute.id} resolution.resolvedById → not found in users`)
    }
  })
}

/* ========================================================================== */
/* Validation: enums                                                          */
/* ========================================================================== */

const ENUM_FIELDS = [
  ['users', 'role', ROLE_VALUES],
  ['users', 'accountStatus', Object.values(ACCOUNT_STATUS)],
  ['portfolioItems', 'status', Object.values(CONTENT_STATUS)],
  ['portfolioItems', 'contentType', Object.values(CONTENT_TYPE)],
  ['portfolioItems', 'visibility', Object.values(VISIBILITY)],
  ['portfolioItems', 'mediaType', Object.values(MEDIA_TYPE)],
  ['contentRequests', 'status', Object.values(REQUEST_STATUS)],
  ['contentRequests', 'contentType', Object.values(CONTENT_TYPE)],
  ['contentRequests', 'orientation', Object.values(ORIENTATION)],
  ['contentRequests', 'usageRights', Object.values(USAGE_RIGHTS)],
  ['contentRequests', 'budgetType', Object.values(BUDGET_TYPE)],
  ['proposals', 'status', Object.values(PROPOSAL_STATUS)],
  ['orders', 'status', Object.values(ORDER_STATUS)],
  ['orders', 'contentType', Object.values(CONTENT_TYPE)],
  ['deliveries', 'status', Object.values(DELIVERY_STATUS)],
  ['payments', 'status', Object.values(PAYMENT_STATUS)],
  ['transactions', 'type', Object.values(TRANSACTION_TYPE)],
  ['payouts', 'status', Object.values(PAYOUT_STATUS)],
  ['disputes', 'status', Object.values(DISPUTE_STATUS)],
  ['disputes', 'category', Object.values(DISPUTE_CATEGORY)],
  ['disputeMessages', 'authorRole', ROLE_VALUES],
  ['notifications', 'type', Object.values(NOTIFICATION_TYPE)],
  ['moderationReviews', 'status', Object.values(CONTENT_STATUS)],
  ['moderationReviews', 'subjectType', Object.values(MODERATION_SUBJECT)],
  ['reports', 'status', Object.values(REPORT_STATUS)],
  ['reports', 'subjectType', Object.values(REPORT_SUBJECT)],
  ['reports', 'reason', Object.values(REPORT_REASON)],
  ['supportTickets', 'status', Object.values(TICKET_STATUS)],
  ['affiliateProfiles', 'status', Object.values(AFFILIATE_PROFILE_STATUS)],
  ['affiliateReferrals', 'status', Object.values(REFERRAL_STATUS)],
  ['affiliateEarnings', 'status', Object.values(AFFILIATE_EARNING_STATUS)],
  ['auditLogs', 'actorRole', ROLE_VALUES],
]

/**
 * Enum fields a **draft** content request is allowed not to have answered yet.
 * A half-written brief leaves them absent (`compact` drops `undefined`), which
 * is what the request list reads to tell the buyer what is still missing before
 * it can be published. Every other status must carry all of them — see
 * `validateDraftCompleteness` below, which is what keeps this from becoming a
 * hole in the check.
 */
const DRAFT_OPTIONAL_FIELDS = ['contentType', 'usageRights', 'orientation', 'budgetType']

function validateEnums() {
  ENUM_FIELDS.forEach(([name, field, allowed]) => {
    db[name].forEach((row) => {
      const isUnansweredDraftField =
        name === 'contentRequests' &&
        row.status === REQUEST_STATUS.DRAFT &&
        DRAFT_OPTIONAL_FIELDS.includes(field) &&
        row[field] === undefined

      if (isUnansweredDraftField) return

      if (!allowed.includes(row[field])) {
        fail(
          `${name}.${field} on ${row.id} is "${row[field]}" — expected one of ${allowed.join(' | ')}`
        )
      }
    })
  })

  // The other half of the rule above: only a draft may be incomplete.
  db.contentRequests.forEach((request) => {
    if (request.status === REQUEST_STATUS.DRAFT) return
    DRAFT_OPTIONAL_FIELDS.forEach((field) => {
      if (request[field] === undefined) {
        fail(`contentRequests.${field} is missing on ${request.id}, which is not a draft`)
      }
    })
  })

  moderationReviews.forEach((review) => {
    if (review.reasonCode && !Object.values(REJECTION_REASON_CODE).includes(review.reasonCode)) {
      fail(`moderationReviews ${review.id} reasonCode "${review.reasonCode}" is not a policy code`)
    }
  })
  disputes.forEach((dispute) => {
    if (
      dispute.resolution &&
      !Object.values(DISPUTE_RESOLUTION).includes(dispute.resolution.outcome)
    ) {
      fail(`disputes ${dispute.id} resolution.outcome "${dispute.resolution.outcome}" is not a resolution`)
    }
  })
  users.forEach((user) => {
    const isAdmin = user.role === ROLES.ADMIN || user.role === ROLES.SUPER_ADMIN
    if (!isAdmin && user.permissions !== undefined) {
      fail(`users ${user.id} carries permissions but is not an admin (00 §11)`)
    }
    if (isAdmin) {
      if (!Array.isArray(user.permissions) || user.permissions.length === 0) {
        fail(`users ${user.id} is an admin with no permissions array`)
      } else {
        user.permissions.forEach((permission) => {
          if (!PERMISSION_VALUES.includes(permission)) {
            fail(`users ${user.id} has unknown permission "${permission}"`)
          }
        })
      }
    }
  })
}

/* ========================================================================== */
/* Validation: money                                                          */
/* ========================================================================== */

function validateMoney() {
  orders.forEach((order) => {
    const expectedCommission = round2(order.price * order.commissionRate)
    if (order.commissionAmount !== expectedCommission) {
      fail(
        `orders ${order.id}: commissionAmount ${order.commissionAmount} ≠ round(${order.price} × ${order.commissionRate}) = ${expectedCommission}`
      )
    }
    if (order.creatorEarnings !== round2(order.price - order.commissionAmount)) {
      fail(
        `orders ${order.id}: creatorEarnings ${order.creatorEarnings} ≠ price − commission = ${round2(order.price - order.commissionAmount)}`
      )
    }
    if (order.price <= 0) fail(`orders ${order.id}: price must be positive`)
  })

  // Every order has at least one payment, and the amounts agree.
  orders.forEach((order) => {
    const own = payments.filter((payment) => payment.orderId === order.id)
    if (own.length === 0) {
      fail(`orders ${order.id} has no payment record`)
      return
    }
    own.forEach((payment) => {
      if (payment.amount !== order.price) {
        fail(`payments ${payment.id}: amount ${payment.amount} ≠ order price ${order.price}`)
      }
      if (payment.buyerId !== order.buyerId) {
        fail(`payments ${payment.id}: buyerId does not match its order`)
      }
      if (payment.refundedAmount !== undefined && payment.refundedAmount > payment.amount) {
        fail(`payments ${payment.id}: refundedAmount exceeds the amount charged`)
      }
    })
  })

  // Commissions exist for exactly the orders whose escrow was released.
  const releasedOrders = orders.filter(
    (order) => order.status === ORDER_STATUS.COMPLETED
  )
  if (commissions.length !== releasedOrders.length) {
    fail(
      `commissions: ${commissions.length} rows for ${releasedOrders.length} completed orders — one per released order expected`
    )
  }
  commissions.forEach((commission) => {
    const order = orderById.get(commission.orderId)
    if (!order) return
    if (order.status !== ORDER_STATUS.COMPLETED) {
      fail(`commissions ${commission.id}: order ${order.id} is "${order.status}", not completed`)
    }
    if (commission.rate !== order.commissionRate) {
      fail(`commissions ${commission.id}: rate does not match its order`)
    }
    if (commission.amount !== round2(commission.baseAmount * commission.rate)) {
      fail(
        `commissions ${commission.id}: amount ${commission.amount} ≠ round(${commission.baseAmount} × ${commission.rate})`
      )
    }
    const payment = payments.find((candidate) => candidate.orderId === order.id)
    const refunded = payment?.refundedAmount ?? 0
    if (commission.baseAmount !== round2(order.price - refunded)) {
      fail(
        `commissions ${commission.id}: baseAmount ${commission.baseAmount} ≠ price − refunded = ${round2(order.price - refunded)}`
      )
    }
  })

  // Per-order ledger consistency.
  orders.forEach((order) => {
    const rows = transactions.filter((transaction) => transaction.orderId === order.id)
    const of = (type) => rows.filter((transaction) => transaction.type === type)
    const sum = (list) => round2(list.reduce((total, row) => total + row.amount, 0))

    const charges = of(TRANSACTION_TYPE.CHARGE)
    const funded =
      order.status !== ORDER_STATUS.PENDING_PAYMENT &&
      order.status !== ORDER_STATUS.CANCELLED

    if (funded && charges.length !== 1) {
      fail(`transactions: order ${order.id} is funded but has ${charges.length} charge rows`)
    }
    if (!funded && rows.length > 0) {
      fail(`transactions: order ${order.id} is "${order.status}" but has ${rows.length} ledger rows`)
    }
    if (charges.length === 1 && charges[0].amount !== round2(-order.price)) {
      fail(`transactions ${charges[0].id}: charge should be −${order.price}`)
    }

    if (order.status === ORDER_STATUS.COMPLETED) {
      const release = of(TRANSACTION_TYPE.RELEASE)
      const commission = of(TRANSACTION_TYPE.COMMISSION)
      if (release.length !== 1 || commission.length !== 1) {
        fail(`transactions: completed order ${order.id} needs one release and one commission row`)
        return
      }
      const refunded = sum(of(TRANSACTION_TYPE.PARTIAL_REFUND))
      const creatorNet = round2(release[0].amount + commission[0].amount)
      const expectedNet = round2(
        (order.price - refunded) * (1 - order.commissionRate)
      )
      if (creatorNet !== expectedNet) {
        fail(
          `transactions: order ${order.id} nets ${creatorNet} to the creator, expected ${expectedNet}`
        )
      }
      // Charge + refunds + release + commission net to exactly what BetterBlue
      // retained, expressed as the negative amount deducted from the creator.
      const escrowTotal = round2(
        sum(charges) + refunded + release[0].amount + commission[0].amount
      )
      if (escrowTotal !== commission[0].amount) {
        fail(
          `transactions: order ${order.id} escrow rows net to ${escrowTotal}, expected ${commission[0].amount}`
        )
      }
    }

    if (order.status === ORDER_STATUS.REFUNDED) {
      const refunds = of(TRANSACTION_TYPE.REFUND)
      if (refunds.length !== 1 || refunds[0].amount !== order.price) {
        fail(`transactions: refunded order ${order.id} needs one refund row of ${order.price}`)
      }
      if (of(TRANSACTION_TYPE.RELEASE).length > 0) {
        fail(`transactions: refunded order ${order.id} must not release funds to the creator`)
      }
    }
  })

  // Balances never go negative, and a payout never exceeds the balance.
  const running = new Map()
  transactions.forEach((transaction) => {
    if (!BALANCE_HOLDERS.has(transaction.userId) || !BALANCE_TYPES.has(transaction.type)) return
    const next = round2((running.get(transaction.userId) ?? 0) + transaction.amount)
    if (next < 0) {
      const owner = userById.get(transaction.userId)
      fail(
        `transactions ${transaction.id}: ${owner?.name ?? transaction.userId} would hold a negative balance (${next})`
      )
    }
    running.set(transaction.userId, next)
  })

  payouts.forEach((payout) => {
    if (payout.amount < platformSettings.general.payoutMinAmount) {
      fail(
        `payouts ${payout.id}: ${payout.amount} is below the ${platformSettings.general.payoutMinAmount} minimum`
      )
    }
    const earned = round2(
      transactions
        .filter(
          (transaction) =>
            transaction.userId === payout.creatorId &&
            BALANCE_TYPES.has(transaction.type) &&
            transaction.type !== TRANSACTION_TYPE.PAYOUT &&
            ms(transaction.createdAt) <= ms(payout.requestedAt)
        )
        .reduce((total, transaction) => total + transaction.amount, 0)
    )
    if (payout.amount > earned) {
      fail(
        `payouts ${payout.id}: requests ${payout.amount} but only ${earned} had been earned by then`
      )
    }
  })

  // Affiliate commission is a share of the platform commission on the order.
  affiliateEarnings.forEach((earning) => {
    const commission = commissions.find(
      (candidate) => candidate.orderId === earning.orderId
    )
    if (!commission) {
      fail(`affiliateEarnings ${earning.id}: order ${earning.orderId} earned no commission`)
      return
    }
    const expected = round2(
      commission.amount * platformSettings.affiliate.commissionRate
    )
    if (earning.amount !== expected) {
      fail(
        `affiliateEarnings ${earning.id}: ${earning.amount} ≠ ${platformSettings.affiliate.commissionRate} × commission ${commission.amount} = ${expected}`
      )
    }
  })
}

/* ========================================================================== */
/* Validation: chronology                                                     */
/* ========================================================================== */

/** Date fields that are allowed to sit in the future (a target, not an event). */
const FUTURE_ALLOWED = new Set(['deadline', 'deliveryDueAt'])

const DATE_KEY = /(At|at)$|^deadline$|^createdAt$/

function walkDates(value, path, visit) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkDates(item, `${path}[${index}]`, visit))
    return
  }
  if (value === null || typeof value !== 'object') return
  Object.entries(value).forEach(([key, entry]) => {
    if (typeof entry === 'string' && DATE_KEY.test(key) && !Number.isNaN(Date.parse(entry))) {
      visit(key, entry, `${path}.${key}`)
      return
    }
    walkDates(entry, `${path}.${key}`, visit)
  })
}

function validateChronology() {
  // Every timestamp inside the seed window, and nothing in the future unless
  // the field is a target date.
  Object.keys(ID_PREFIXES).forEach((name) => {
    db[name].forEach((row) => {
      walkDates(row, `${name} ${row.id}`, (key, value, path) => {
        const stamp = ms(value)
        if (stamp < WINDOW_START_MS) {
          fail(`${path} is ${value}, older than the ${SEED_WINDOW_DAYS}-day seed window`)
        }
        if (stamp > ANCHOR_MS && !FUTURE_ALLOWED.has(key)) {
          fail(`${path} is ${value}, which is in the future relative to the seed anchor`)
        }
      })
    })
  })

  const before = (label, earlier, later) => {
    if (!earlier || !later) return
    if (ms(earlier) > ms(later)) fail(`${label}: ${earlier} should not be after ${later}`)
  }

  // Accounts exist before anything they touch.
  const createdAtOf = (id) => userById.get(id)?.createdAt
  contentRequests.forEach((request) =>
    before(`contentRequests ${request.id} predates its buyer`, createdAtOf(request.buyerId), request.createdAt)
  )
  proposals.forEach((proposal) =>
    before(`proposals ${proposal.id} predates its creator`, createdAtOf(proposal.creatorId), proposal.createdAt)
  )
  orders.forEach((order) => {
    before(`orders ${order.id} predates its buyer`, createdAtOf(order.buyerId), order.createdAt)
    before(`orders ${order.id} predates its creator`, createdAtOf(order.creatorId), order.createdAt)
  })
  const profileCreatedAt = new Map(
    creatorProfiles.map((profile) => [profile.id, profile.createdAt])
  )
  portfolioItems.forEach((item) =>
    before(
      `portfolioItems ${item.id} predates its creator profile`,
      profileCreatedAt.get(item.creatorId),
      item.createdAt
    )
  )

  // Request → proposal → order → delivery → completion.
  const requestById = byId(contentRequests)
  const proposalById = byId(proposals)
  proposals.forEach((proposal) => {
    const request = requestById.get(proposal.requestId)
    before(`proposals ${proposal.id} predates its request`, request?.publishedAt, proposal.createdAt)
    before(`proposals ${proposal.id} responded before it was sent`, proposal.createdAt, proposal.respondedAt)
  })

  orders.forEach((order) => {
    const proposal = proposalById.get(order.proposalId)
    before(`orders ${order.id} predates its accepted proposal`, proposal?.createdAt, order.createdAt)
    before(`orders ${order.id} activated before creation`, order.createdAt, order.activatedAt)
    before(`orders ${order.id} delivered before activation`, order.activatedAt, order.deliveredAt)
    before(`orders ${order.id} completed before delivery`, order.deliveredAt, order.completedAt)
    before(`orders ${order.id} completed before creation`, order.createdAt, order.completedAt)
    before(`orders ${order.id} cancelled before creation`, order.createdAt, order.cancelledAt)

    if (order.revisionsUsed > order.revisionsIncluded) {
      fail(`orders ${order.id}: ${order.revisionsUsed} revisions used, ${order.revisionsIncluded} included`)
    }
    const own = revisions.filter((revision) => revision.orderId === order.id)
    if (own.length !== order.revisionsUsed) {
      fail(`orders ${order.id}: revisionsUsed ${order.revisionsUsed} ≠ ${own.length} revision records`)
    }
  })

  deliveries.forEach((delivery) => {
    const order = orderById.get(delivery.orderId)
    before(`deliveries ${delivery.id} predates its order`, order?.activatedAt, delivery.submittedAt)
    before(`deliveries ${delivery.id} answered before submission`, delivery.submittedAt, delivery.respondedAt)
    if (delivery.files.length === 0) fail(`deliveries ${delivery.id} has no files`)
  })

  revisions.forEach((revision) => {
    const delivery = deliveries.find((candidate) => candidate.id === revision.deliveryId)
    before(`revisions ${revision.id} predates its delivery`, delivery?.submittedAt, revision.createdAt)
    before(`revisions ${revision.id} resolved before it was raised`, revision.createdAt, revision.resolvedAt)
  })

  payments.forEach((payment) => {
    const order = orderById.get(payment.orderId)
    before(`payments ${payment.id} predates its order`, order?.createdAt, payment.createdAt)
    before(`payments ${payment.id} held before creation`, payment.createdAt, payment.heldAt)
    before(`payments ${payment.id} released before it was held`, payment.heldAt, payment.releasedAt)
    before(`payments ${payment.id} refunded before it was held`, payment.heldAt, payment.refundedAt)
  })

  disputes.forEach((dispute) => {
    const order = orderById.get(dispute.orderId)
    before(`disputes ${dispute.id} predates its order`, order?.createdAt, dispute.createdAt)
    before(`disputes ${dispute.id} updated before it opened`, dispute.createdAt, dispute.updatedAt)
    if (dispute.resolution) {
      before(
        `disputes ${dispute.id} resolved before it opened`,
        dispute.createdAt,
        dispute.resolution.resolvedAt
      )
    }
  })
  disputeMessages.forEach((message) => {
    const dispute = disputes.find((candidate) => candidate.id === message.disputeId)
    before(`disputeMessages ${message.id} predates its dispute`, dispute?.createdAt, message.createdAt)
  })

  reviews.forEach((review) => {
    const order = orderById.get(review.orderId)
    if (order?.status !== ORDER_STATUS.COMPLETED) {
      fail(`reviews ${review.id}: order ${review.orderId} is not completed`)
    }
    if (order && (review.buyerId !== order.buyerId || review.creatorId !== order.creatorId)) {
      fail(`reviews ${review.id}: buyer/creator do not match the order`)
    }
    if (order && review.requestId !== order.requestId) {
      fail(`reviews ${review.id}: requestId does not match the order`)
    }
    if (review.rating < 1 || review.rating > 5 || !Number.isInteger(review.rating)) {
      fail(`reviews ${review.id}: rating ${review.rating} must be an integer from 1 to 5`)
    }
    before(`reviews ${review.id} predates completion`, order?.completedAt, review.createdAt)
  })

  moderationReviews.forEach((review) => {
    before(`moderationReviews ${review.id} decided before submission`, review.submittedAt, review.reviewedAt)
    review.history.forEach((entry, index) => {
      before(
        `moderationReviews ${review.id} history[${index}] predates submission`,
        review.submittedAt,
        entry.at
      )
    })
  })

  supportTickets.forEach((ticket) => {
    ticket.replies.forEach((reply, index) => {
      before(`supportTickets ${ticket.id} replies[${index}] predates the ticket`, ticket.createdAt, reply.at)
    })
  })

  payouts.forEach((payout) => {
    before(`payouts ${payout.id} processed before it was requested`, payout.requestedAt, payout.processedAt)
  })

  affiliateReferrals.forEach((referral) => {
    before(`affiliateReferrals ${referral.id} converted before signup`, referral.createdAt, referral.convertedAt)
  })
  affiliateEarnings.forEach((earning) => {
    before(`affiliateEarnings ${earning.id} approved before it accrued`, earning.createdAt, earning.approvedAt)
    before(`affiliateEarnings ${earning.id} paid before approval`, earning.approvedAt, earning.paidAt)
  })

  // Notifications and audit entries never predate what they point at.
  const entityCreatedAt = (type, id) => {
    const collection = ENTITY_COLLECTION[type]
    if (!collection) return null
    return db[collection].find((row) => row.id === id)?.createdAt ?? null
  }
  notifications.forEach((notification) => {
    if (!notification.entityType) return
    before(
      `notifications ${notification.id} predates the ${notification.entityType} it links to`,
      entityCreatedAt(notification.entityType, notification.entityId),
      notification.createdAt
    )
  })
  auditLogs.forEach((entry) => {
    before(
      `auditLogs ${entry.id} predates the ${entry.entityType} it acted on`,
      entityCreatedAt(entry.entityType, entry.entityId),
      entry.createdAt
    )
  })
}

/* ========================================================================== */
/* Validation: workflow coherence                                             */
/* ========================================================================== */

function validateWorkflow() {
  // Every order status is represented — this dataset exists to demo them all.
  const orderStatuses = new Set(orders.map((order) => order.status))
  Object.values(ORDER_STATUS).forEach((status) => {
    if (!orderStatuses.has(status)) fail(`no seeded order has status "${status}"`)
  })
  const requestStatuses = new Set(contentRequests.map((request) => request.status))
  Object.values(REQUEST_STATUS).forEach((status) => {
    if (!requestStatuses.has(status)) fail(`no seeded request has status "${status}"`)
  })

  // An awarded or completed brief must have exactly one accepted proposal, and
  // a draft must have none at all.
  contentRequests.forEach((request) => {
    const accepted = proposals.filter(
      (proposal) =>
        proposal.requestId === request.id && proposal.status === PROPOSAL_STATUS.ACCEPTED
    )
    if (accepted.length > 1) {
      fail(`contentRequests ${request.id} has ${accepted.length} accepted proposals`)
    }
    if (
      (request.status === REQUEST_STATUS.AWARDED ||
        request.status === REQUEST_STATUS.COMPLETED) &&
      accepted.length !== 1
    ) {
      fail(`contentRequests ${request.id} is "${request.status}" without an accepted proposal`)
    }
    if (request.status === REQUEST_STATUS.DRAFT && request.proposalsCount > 0) {
      fail(`contentRequests ${request.id} is a draft with ${request.proposalsCount} proposals`)
    }
    if (request.status === REQUEST_STATUS.DRAFT && request.publishedAt !== null) {
      fail(`contentRequests ${request.id} is a draft but carries publishedAt`)
    }
    if (request.budgetMin > request.budgetMax) {
      fail(`contentRequests ${request.id}: budgetMin exceeds budgetMax`)
    }
  })

  // Order ↔ request ↔ proposal must agree on who and how much.
  const requestById = byId(contentRequests)
  const proposalById = byId(proposals)
  orders.forEach((order) => {
    const request = requestById.get(order.requestId)
    const proposal = proposalById.get(order.proposalId)
    if (request && request.buyerId !== order.buyerId) {
      fail(`orders ${order.id}: buyer does not match request ${request.id}`)
    }
    if (proposal && proposal.creatorId !== order.creatorId) {
      fail(`orders ${order.id}: creator does not match proposal ${proposal.id}`)
    }
    if (proposal && proposal.requestId !== order.requestId) {
      fail(`orders ${order.id}: proposal belongs to a different request`)
    }
    if (proposal && proposal.price !== order.price) {
      fail(`orders ${order.id}: price ${order.price} ≠ accepted proposal price ${proposal.price}`)
    }
    if (proposal && proposal.status !== PROPOSAL_STATUS.ACCEPTED) {
      fail(`orders ${order.id}: proposal ${proposal.id} is "${proposal.status}", not accepted`)
    }
  })

  // One order per request at most (00 §8: no order items, one order per brief).
  const ordersPerRequest = new Map()
  orders.forEach((order) => {
    ordersPerRequest.set(order.requestId, (ordersPerRequest.get(order.requestId) ?? 0) + 1)
  })
  ordersPerRequest.forEach((count, requestId) => {
    if (count > 1) fail(`contentRequests ${requestId} has ${count} orders — one per brief expected`)
  })

  // Disputed orders carry an open dispute; resolved disputes match the order.
  const OPEN_DISPUTE_STATUSES = new Set([
    DISPUTE_STATUS.OPEN,
    DISPUTE_STATUS.UNDER_REVIEW,
    DISPUTE_STATUS.AWAITING_BUYER,
    DISPUTE_STATUS.AWAITING_CREATOR,
    DISPUTE_STATUS.ESCALATED,
  ])
  orders
    .filter((order) => order.status === ORDER_STATUS.DISPUTED)
    .forEach((order) => {
      const dispute = disputes.find((candidate) => candidate.orderId === order.id)
      if (!dispute) {
        fail(`orders ${order.id} is disputed but has no dispute record`)
      } else if (!OPEN_DISPUTE_STATUSES.has(dispute.status)) {
        fail(`orders ${order.id} is disputed but dispute ${dispute.id} is "${dispute.status}"`)
      }
    })
  disputes.forEach((dispute) => {
    const order = orderById.get(dispute.orderId)
    if (!order) return
    if (dispute.raisedById !== order.buyerId && dispute.raisedById !== order.creatorId) {
      fail(`disputes ${dispute.id}: raisedById is not a party to the order`)
    }
    if (dispute.againstId !== order.buyerId && dispute.againstId !== order.creatorId) {
      fail(`disputes ${dispute.id}: againstId is not a party to the order`)
    }
    if (dispute.raisedById === dispute.againstId) {
      fail(`disputes ${dispute.id}: raised against the member who raised it`)
    }
    const resolved =
      dispute.status === DISPUTE_STATUS.RESOLVED || dispute.status === DISPUTE_STATUS.CLOSED
    if (resolved && !dispute.resolution) {
      fail(`disputes ${dispute.id} is "${dispute.status}" without a resolution`)
    }
    if (!resolved && dispute.resolution) {
      fail(`disputes ${dispute.id} carries a resolution while still "${dispute.status}"`)
    }
    if (dispute.resolution?.outcome === DISPUTE_RESOLUTION.FULL_REFUND) {
      if (order.status !== ORDER_STATUS.REFUNDED) {
        fail(`disputes ${dispute.id}: full refund but order ${order.id} is "${order.status}"`)
      }
      if (dispute.resolution.amountRefunded !== order.price) {
        fail(`disputes ${dispute.id}: full refund amount ≠ order price`)
      }
    }
    if (dispute.resolution?.outcome === DISPUTE_RESOLUTION.PARTIAL_REFUND) {
      const payment = payments.find((candidate) => candidate.orderId === order.id)
      if (dispute.resolution.amountRefunded !== payment?.refundedAmount) {
        fail(`disputes ${dispute.id}: partial refund amount does not match the payment`)
      }
    }
    const thread = disputeMessages.filter((message) => message.disputeId === dispute.id)
    if (thread.length === 0) fail(`disputes ${dispute.id} has no messages`)
    thread.forEach((message) => {
      if (message.internal && message.authorRole === ROLES.BUYER) {
        fail(`disputeMessages ${message.id}: internal notes must not be authored by a buyer`)
      }
    })
  })

  // Payment status has to match where the order actually is.
  const EXPECTED_PAYMENT = {
    [ORDER_STATUS.PENDING_PAYMENT]: [PAYMENT_STATUS.FAILED, PAYMENT_STATUS.PROCESSING, PAYMENT_STATUS.INITIATED],
    [ORDER_STATUS.CANCELLED]: [PAYMENT_STATUS.INITIATED, PAYMENT_STATUS.FAILED],
    [ORDER_STATUS.IN_PROGRESS]: [PAYMENT_STATUS.HELD],
    [ORDER_STATUS.DELIVERED]: [PAYMENT_STATUS.HELD],
    [ORDER_STATUS.REVISION_REQUESTED]: [PAYMENT_STATUS.HELD],
    [ORDER_STATUS.DISPUTED]: [PAYMENT_STATUS.HELD],
    [ORDER_STATUS.COMPLETED]: [PAYMENT_STATUS.RELEASED, PAYMENT_STATUS.PARTIALLY_REFUNDED],
    [ORDER_STATUS.REFUNDED]: [PAYMENT_STATUS.REFUNDED],
  }
  payments.forEach((payment) => {
    const order = orderById.get(payment.orderId)
    if (!order) return
    if (!EXPECTED_PAYMENT[order.status].includes(payment.status)) {
      fail(
        `payments ${payment.id} is "${payment.status}" on an order that is "${order.status}" — expected ${EXPECTED_PAYMENT[order.status].join(' | ')}`
      )
    }
  })

  // Deliverables only exist for orders that reached production.
  deliveries.forEach((delivery) => {
    const order = orderById.get(delivery.orderId)
    if (order && order.status === ORDER_STATUS.PENDING_PAYMENT) {
      fail(`deliveries ${delivery.id}: order ${order.id} was never funded`)
    }
  })
  orders
    .filter((order) => order.status === ORDER_STATUS.DELIVERED)
    .forEach((order) => {
      const own = deliveries.filter((delivery) => delivery.orderId === order.id)
      if (own.length === 0) fail(`orders ${order.id} is delivered but has no delivery record`)
    })

  // Portfolio lifecycle.
  portfolioItems.forEach((item) => {
    const published = item.status === CONTENT_STATUS.PUBLISHED
    if (published && !item.publishedAt) {
      fail(`portfolioItems ${item.id} is published without publishedAt`)
    }
    if (item.status === CONTENT_STATUS.DRAFT && item.submittedAt !== null) {
      fail(`portfolioItems ${item.id} is a draft but carries submittedAt`)
    }
    if (item.status === CONTENT_STATUS.REJECTED && !item.rejectionReason) {
      fail(`portfolioItems ${item.id} is rejected without a reason`)
    }
  })

  // Every account referenced by a profile is the right role.
  buyerProfiles.forEach((profile) => {
    if (userById.get(profile.userId)?.role !== ROLES.BUYER) {
      fail(`buyerProfiles ${profile.id}: userId is not a buyer account`)
    }
  })
  creatorProfiles.forEach((profile) => {
    if (userById.get(profile.userId)?.role !== ROLES.CREATOR) {
      fail(`creatorProfiles ${profile.id}: userId is not a creator account`)
    }
  })
  orders.forEach((order) => {
    if (userById.get(order.buyerId)?.role !== ROLES.BUYER) {
      fail(`orders ${order.id}: buyerId is not a buyer account`)
    }
    if (userById.get(order.creatorId)?.role !== ROLES.CREATOR) {
      fail(`orders ${order.id}: creatorId is not a creator account`)
    }
  })

  // Referral codes on accounts must belong to a real affiliate.
  const codes = new Set(affiliateProfiles.map((profile) => profile.code))
  users.forEach((user) => {
    if (user.referredByCode && !codes.has(user.referredByCode)) {
      fail(`users ${user.id}: referredByCode "${user.referredByCode}" has no affiliate profile`)
    }
  })
  affiliateReferrals.forEach((referral) => {
    const converted = referral.status === REFERRAL_STATUS.CONVERTED
    if (converted && !referral.convertedOrderId) {
      fail(`affiliateReferrals ${referral.id} is converted without a converting order`)
    }
    if (!converted && referral.convertedOrderId) {
      fail(`affiliateReferrals ${referral.id} is "${referral.status}" but names a converting order`)
    }
    if (referral.referredUserId === affiliateProfiles.find((p) => p.id === referral.affiliateId)?.userId) {
      fail(`affiliateReferrals ${referral.id}: an affiliate cannot refer themselves`)
    }
  })

  // Demo accounts must exist and be usable.
  const DEMO_EMAILS = [
    'buyer@betterblue.test',
    'creator@betterblue.test',
    'admin@betterblue.test',
    'super@betterblue.test',
  ]
  DEMO_EMAILS.forEach((email) => {
    const account = users.find((user) => user.email === email)
    if (!account) {
      fail(`demo account ${email} is missing`)
    } else if (account.accountStatus !== ACCOUNT_STATUS.ACTIVE) {
      fail(`demo account ${email} is "${account.accountStatus}" and could not sign in`)
    }
  })
  const emails = new Set()
  users.forEach((user) => {
    if (emails.has(user.email)) fail(`users: duplicate email "${user.email}"`)
    emails.add(user.email)
  })
}

/* ========================================================================== */
/* Validation: Storefront V2 feeds, replies, and creator levels               */
/* ========================================================================== */

/** Tag slugs are lowercase kebab-case — a stored value, not a display label. */
const TAG_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** The demo creator's storefront — their thread has to render on day one (§9). */
const DEMO_CREATOR_PROFILE_ID = 'cpr_ava'

function validateFeeds() {
  /* --- contentRequests: the three fields V2 added ------------------------- */
  const repliesByFeed = feedReplies.reduce(
    (counts, reply) => counts.set(reply.feedId, (counts.get(reply.feedId) ?? 0) + 1),
    new Map()
  )
  const dealStatusesSeen = new Set()

  contentRequests.forEach((request) => {
    const tags = request.tags
    if (!Array.isArray(tags) || tags.length < 3 || tags.length > 6) {
      fail(`contentRequests.tags on ${request.id} must hold 3–6 tags (V2-03 §1)`)
    } else {
      if (new Set(tags).size !== tags.length) {
        fail(`contentRequests.tags on ${request.id} repeats a tag`)
      }
      tags.forEach((tag) => {
        if (typeof tag !== 'string' || !TAG_SLUG.test(tag)) {
          fail(`contentRequests.tags on ${request.id}: "${tag}" is not a kebab-case slug`)
        }
      })
    }

    // The offer is derived from the budget, so it can never contradict it.
    const expectedOffer = request.budgetMax ?? request.budgetMin ?? undefined
    if (request.offerPrice !== expectedOffer) {
      fail(
        `contentRequests.offerPrice on ${request.id} is ${request.offerPrice}, ` +
          `but the budget says ${expectedOffer}`
      )
    }
    if (request.offerPrice === undefined && request.status !== REQUEST_STATUS.DRAFT) {
      fail(`contentRequests.offerPrice is absent on ${request.id}, which is not a draft`)
    }

    const expectedReplies = repliesByFeed.get(request.id) ?? 0
    if (request.repliesCount !== expectedReplies) {
      fail(
        `contentRequests.repliesCount on ${request.id} is ${request.repliesCount}, ` +
          `but ${expectedReplies} feedReplies point at it`
      )
    }

    if (request.status !== REQUEST_STATUS.DRAFT) {
      dealStatusesSeen.add(getFeedDealStatus(request))
    }
  })

  // The board is meant to demonstrate all three deal states (V2-03 §1).
  ;['open', 'closed', 'delivered'].forEach((dealStatus) => {
    if (!dealStatusesSeen.has(dealStatus)) {
      fail(`no feed maps to deal status "${dealStatus}" — the V2 board needs all three`)
    }
  })

  /* --- feedReplies: one per creator per feed, two-sided, in order --------- */
  const requestById = byId(contentRequests)
  const creatorProfileById = byId(creatorProfiles)
  const pairs = new Set()
  const messageIds = new Set()
  const demoThreads = feedReplies.filter(
    (reply) => reply.creatorId === DEMO_CREATOR_PROFILE_ID
  ).length

  if (demoThreads < 2) {
    fail(
      `the demo creator (${DEMO_CREATOR_PROFILE_ID}) has ${demoThreads} reply thread(s); ` +
        'at least 2 are needed for the feed detail page to render one'
    )
  }

  feedReplies.forEach((reply) => {
    const pair = `${reply.feedId}::${reply.creatorId}`
    if (pairs.has(pair)) {
      fail(`feedReplies: ${reply.creatorId} has more than one reply on ${reply.feedId}`)
    }
    pairs.add(pair)

    const feed = requestById.get(reply.feedId)
    const profile = creatorProfileById.get(reply.creatorId)
    if (!feed || !profile) return

    if (reply.buyerId !== feed.buyerId) {
      fail(`feedReplies ${reply.id}: buyerId does not match the buyer who posted ${feed.id}`)
    }
    if (feed.status === REQUEST_STATUS.DRAFT) {
      fail(`feedReplies ${reply.id} answers ${feed.id}, which is a private draft`)
    }

    const messages = reply.messages
    if (!Array.isArray(messages) || messages.length < 2 || messages.length > 6) {
      fail(`feedReplies ${reply.id} must carry a 2–6 message conversation`)
      return
    }
    if (messages[0].authorRole !== 'creator') {
      fail(`feedReplies ${reply.id}: a reply is opened by the creator, not the buyer`)
    }
    if (!messages.some((message) => message.authorRole === 'buyer')) {
      fail(`feedReplies ${reply.id}: the conversation is one-sided`)
    }

    messages.forEach((message, index) => {
      if (typeof message.id !== 'string' || !message.id.startsWith('frm_')) {
        fail(`feedReplies ${reply.id}: message ${index} has no "frm_" id`)
      } else if (messageIds.has(message.id)) {
        fail(`feedReplies: duplicate message id "${message.id}"`)
      } else {
        messageIds.add(message.id)
      }

      if (!['creator', 'buyer'].includes(message.authorRole)) {
        fail(`feedReplies ${reply.id}: unknown authorRole "${message.authorRole}"`)
      }
      const expectedAuthor =
        message.authorRole === 'creator' ? profile.userId : feed.buyerId
      if (message.authorId !== expectedAuthor) {
        fail(
          `feedReplies ${reply.id}: message ${message.id} is authored by ` +
            `${message.authorId}, expected ${expectedAuthor}`
        )
      }
      if (typeof message.body !== 'string' || message.body.trim().length < 20) {
        fail(`feedReplies ${reply.id}: message ${message.id} has no real body`)
      }
      if (index > 0 && ms(message.at) < ms(messages[index - 1].at)) {
        fail(`feedReplies ${reply.id}: message ${message.id} is dated before the one above it`)
      }
      if (ms(message.at) > ANCHOR_MS || ms(message.at) < WINDOW_START_MS) {
        fail(`feedReplies ${reply.id}: message ${message.id} falls outside the seed window`)
      }
    })

    if (reply.createdAt !== messages[0].at) {
      fail(`feedReplies ${reply.id}: createdAt does not match its first message`)
    }
    if (reply.updatedAt !== messages[messages.length - 1].at) {
      fail(`feedReplies ${reply.id}: updatedAt does not match its last message`)
    }
    if (feed.publishedAt && ms(reply.createdAt) < ms(feed.publishedAt)) {
      fail(`feedReplies ${reply.id} predates the feed it answers`)
    }
    if (ms(reply.createdAt) < ms(profile.createdAt)) {
      fail(`feedReplies ${reply.id} predates the storefront that wrote it`)
    }
  })

  /* --- creatorProfiles: the V2 storefront figures ------------------------- */
  const levelsSeen = new Set()
  let onlineCount = 0

  creatorProfiles.forEach((profile) => {
    if (typeof profile.isOnline !== 'boolean') {
      fail(`creatorProfiles.isOnline on ${profile.id} must be a boolean`)
    }
    if (profile.isOnline) onlineCount += 1

    if (!Number.isInteger(profile.deliveriesCount) || profile.deliveriesCount < profile.completedOrders) {
      fail(
        `creatorProfiles.deliveriesCount on ${profile.id} (${profile.deliveriesCount}) ` +
          `is below the ${profile.completedOrders} completed orders in this database`
      )
    }

    const ledgerEarned = round2(
      transactions
        .filter(
          (transaction) =>
            transaction.userId === profile.userId &&
            (transaction.type === TRANSACTION_TYPE.RELEASE ||
              transaction.type === TRANSACTION_TYPE.COMMISSION)
        )
        .reduce((sum, transaction) => sum + transaction.amount, 0)
    )
    if (!(profile.totalEarned >= ledgerEarned)) {
      fail(
        `creatorProfiles.totalEarned on ${profile.id} (${profile.totalEarned}) ` +
          `is below the ${ledgerEarned} the ledger already credits them`
      )
    }
    if (round2(profile.totalEarned) !== profile.totalEarned) {
      fail(`creatorProfiles.totalEarned on ${profile.id} is not rounded to cents`)
    }

    const counts = profile.contributionCounts
    if (!counts || !Number.isInteger(counts.images) || !Number.isInteger(counts.videos)) {
      fail(`creatorProfiles.contributionCounts on ${profile.id} needs integer images/videos`)
    } else {
      const publishedOf = (mediaType) =>
        portfolioItems.filter(
          (item) =>
            item.creatorId === profile.id &&
            item.status === CONTENT_STATUS.PUBLISHED &&
            item.mediaType === mediaType
        ).length
      if (counts.images < publishedOf(MEDIA_TYPE.IMAGE)) {
        fail(`creatorProfiles.contributionCounts.images on ${profile.id} is below their portfolio`)
      }
      if (counts.videos < publishedOf(MEDIA_TYPE.VIDEO)) {
        fail(`creatorProfiles.contributionCounts.videos on ${profile.id} is below their portfolio`)
      }
    }

    const expectedLevel = getCreatorLevel(profile)
    if (profile.level !== expectedLevel) {
      fail(
        `creatorProfiles.level on ${profile.id} is ${profile.level}, but the rule in ` +
          `src/constants/creatorLevels.js says ${expectedLevel}`
      )
    }
    levelsSeen.add(profile.level)
  })

  ;[1, 2, 3].forEach((level) => {
    if (!levelsSeen.has(level)) fail(`no creator reaches level ${level} — the badge has nothing to show`)
  })
  if (onlineCount < 3) fail(`only ${onlineCount} creator(s) are online; several should be`)
  const demoProfile = creatorProfileById.get(DEMO_CREATOR_PROFILE_ID)
  if (demoProfile && !demoProfile.isOnline) {
    fail(`the demo creator (${DEMO_CREATOR_PROFILE_ID}) should be online (V2-03 §1)`)
  }
}

/* ========================================================================== */
/* Validation: content policy                                                 */
/* ========================================================================== */

// Everything seeded here is commercial marketplace copy (00 §1). This sweep is
// a backstop against a careless edit, not a moderation engine.
const PROHIBITED_TERMS =
  /\b(nude|nudity|naked|porn|pornographic|pornography|erotic|erotica|escort|fetish|lingerie|camgirl|onlyfans|hookup|xxx|sexual|sexually)\b/i

function validateContentPolicy() {
  const scan = (value, path) => {
    if (typeof value === 'string') {
      const match = value.match(PROHIBITED_TERMS)
      if (match) fail(`content policy: "${match[0]}" appears at ${path} (00 §1)`)
      return
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => scan(item, `${path}[${index}]`))
      return
    }
    if (value && typeof value === 'object') {
      Object.entries(value).forEach(([key, entry]) => scan(entry, `${path}.${key}`))
    }
  }
  Object.entries(db).forEach(([name, collection]) => scan(collection, name))
}

/* ========================================================================== */
/* Run                                                                        */
/* ========================================================================== */

validateIdentifiers()
if (failures.length === 0) {
  // The remaining checks index by id, so only run them once the ids are sound.
  validateForeignKeys()
  validateEnums()
  validateMoney()
  validateChronology()
  validateWorkflow()
  validateFeeds()
  validateContentPolicy()
}

if (failures.length > 0) {
  console.error(`\n✖ Seed integrity check failed with ${failures.length} problem(s):\n`)
  failures.forEach((message, index) => {
    console.error(`  ${String(index + 1).padStart(3, ' ')}. ${message}`)
  })
  console.error(
    '\nserver/db.json was not written. Fix the seed modules in scripts/seed-data/ and run `npm run seed` again.\n'
  )
  process.exit(1)
}

const json = `${JSON.stringify(db, null, 2)}\n`

if (!CHECK_ONLY) {
  writeFileSync(OUTPUT_PATH, json, 'utf8')
}

/* --- Summary ------------------------------------------------------------- */

const rows = Object.entries(db).map(([name, collection]) => [
  name,
  Array.isArray(collection) ? collection.length : 1,
])
const width = Math.max(...rows.map(([name]) => name.length))
const totalUnread = [...unreadByUser.values()].reduce((sum, count) => sum + count, 0)

console.log(`\nBetterBlue seed — anchor ${SEED_ANCHOR}`)
console.log(CHECK_ONLY ? '(check only — no file written)\n' : `wrote ${OUTPUT_PATH}\n`)
rows.forEach(([name, count]) => {
  console.log(`  ${name.padEnd(width)}  ${String(count).padStart(4)}`)
})
console.log(`\n  ${'size'.padEnd(width)}  ${(json.length / 1024).toFixed(0)} KB`)
console.log(
  `  ${'unread'.padEnd(width)}  ${totalUnread} notifications across ${unreadByUser.size} members`
)
console.log(
  `  ${'balances'.padEnd(width)}  ${[...balances.values()].filter((value) => value > 0).length} creators hold a positive balance`
)
console.log('\n✔ Integrity checks passed.\n')
