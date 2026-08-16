// Seed: `payments`, `transactions`, `commissions`, `payouts`
// (Prompt 05 §4.3).
//
// Escrow model (00 §18): the buyer's payment is *held* by BetterBlue from the
// moment the order is funded, and *released* to the creator — minus the
// platform commission — when the delivery is accepted. Each order's chain is
// derived from its status, so the ledger can never contradict the order:
//
//   pending_payment  → a failed attempt plus a retry still processing
//   cancelled        → payment initiated, never funded, no ledger rows
//   in_progress / delivered / revision_requested / disputed
//                    → payment held, one `charge` row
//   completed        → payment released: charge, release, commission
//   completed w/ partial refund
//                    → payment partially refunded: charge, partial_refund,
//                      release of the retained amount, commission on it
//   refunded         → payment refunded in full: charge, refund
//
// `transactions.amount` is signed from the perspective of `userId`: money
// leaving that account is negative, money arriving is positive. A creator's
// `release` row is the gross escrow amount and the matching `commission` row
// subtracts the fee, so the pair nets to `order.creatorEarnings`.

import {
  AFFILIATE_EARNING_STATUS,
  ORDER_STATUS,
  PAYMENT_STATUS,
  PAYOUT_STATUS,
  TRANSACTION_TYPE,
} from '../../src/constants/statuses.js'
import {
  CARD_BRAND,
  CURRENCY,
  PAYMENT_PROVIDER,
  PAYOUT_METHOD_TYPE,
  addHours,
  compact,
  daysAgo,
  maskedAccount,
  round2,
  seqId,
} from '../seed-utils.js'
import { creatorId } from './users.js'
import { creatorDisplayName } from './profiles.js'
import { orders, settledCommissionFor, settlementFor } from './orders.js'
import { affiliateEarnings, affiliateProfiles } from './affiliate.js'

/** Dummy card tails per buyer, so a buyer's payments look like one wallet. */
const CARD_LAST4 = {
  usr_buyer_verde: '4242',
  usr_buyer_nimbus: '5310',
  usr_buyer_atlas: '8801',
  usr_buyer_bloom: '2214',
  usr_buyer_craftware: '7745',
  usr_buyer_urbannest: '6628',
  usr_buyer_pulse: '9037',
  usr_buyer_cocoa: '1156',
}

const payments = []
const transactions = []
const commissions = []
const payouts = []

let paymentSequence = 0
let transactionSequence = 0
let commissionSequence = 0
let payoutSequence = 0

function addPayment(fields) {
  paymentSequence += 1
  const payment = compact({ id: seqId('pay', paymentSequence), ...fields })
  payments.push(payment)
  return payment
}

function addTransaction(fields) {
  transactionSequence += 1
  const transaction = compact({
    id: seqId('txn', transactionSequence),
    ...fields,
    currency: CURRENCY,
    // Filled in by seed-db.js for the accounts that carry a BetterBlue
    // balance (creators and affiliates); buyers pay through and hold none.
    balanceAfter: null,
  })
  transactions.push(transaction)
  return transaction
}

function addCommission({ order, base, amount, createdAt }) {
  commissionSequence += 1
  const commission = {
    id: seqId('com', commissionSequence),
    orderId: order.id,
    rate: order.commissionRate,
    baseAmount: base,
    amount,
    currency: CURRENCY,
    createdAt,
  }
  commissions.push(commission)
  return commission
}

/* -------------------------------------------------------------------------- */
/* Payment + ledger chain per order                                           */
/* -------------------------------------------------------------------------- */

const ESCROW_HELD_STATUSES = new Set([
  ORDER_STATUS.IN_PROGRESS,
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.REVISION_REQUESTED,
  ORDER_STATUS.DISPUTED,
])

orders.forEach((order) => {
  const base = {
    orderId: order.id,
    buyerId: order.buyerId,
    amount: order.price,
    currency: CURRENCY,
    provider: PAYMENT_PROVIDER,
    method: { brand: CARD_BRAND, last4: CARD_LAST4[order.buyerId] },
    createdAt: order.createdAt,
  }

  // --- Never funded ---------------------------------------------------------
  if (order.status === ORDER_STATUS.PENDING_PAYMENT) {
    addPayment({
      ...base,
      status: PAYMENT_STATUS.FAILED,
      heldAt: null,
      releasedAt: null,
      refundedAt: null,
      failureReason:
        'The card was declined by the issuing bank. No funds were taken.',
    })
    addPayment({
      ...base,
      status: PAYMENT_STATUS.PROCESSING,
      heldAt: null,
      releasedAt: null,
      refundedAt: null,
      createdAt: addHours(order.createdAt, 2),
    })
    return
  }

  if (order.status === ORDER_STATUS.CANCELLED) {
    addPayment({
      ...base,
      status: PAYMENT_STATUS.INITIATED,
      heldAt: null,
      releasedAt: null,
      refundedAt: null,
    })
    return
  }

  // --- Funded: every remaining status starts with a charge into escrow ------
  const heldAt = order.activatedAt
  const settlement = settlementFor(order.id)
  const isRefunded = order.status === ORDER_STATUS.REFUNDED
  const isPartiallyRefunded =
    !isRefunded && settlement?.refundedAmount !== undefined
  const isReleased = order.status === ORDER_STATUS.COMPLETED

  const refundedAt = isRefunded ? order.cancelledAt : null
  const settledAt = isReleased ? order.completedAt : null

  let status = PAYMENT_STATUS.HELD
  if (isRefunded) status = PAYMENT_STATUS.REFUNDED
  else if (isPartiallyRefunded) status = PAYMENT_STATUS.PARTIALLY_REFUNDED
  else if (isReleased) status = PAYMENT_STATUS.RELEASED

  const payment = addPayment({
    ...base,
    status,
    heldAt,
    releasedAt: settledAt,
    refundedAt: isPartiallyRefunded ? settledAt : refundedAt,
    refundedAmount: isRefunded
      ? order.price
      : isPartiallyRefunded
        ? settlement.refundedAmount
        : undefined,
  })

  addTransaction({
    type: TRANSACTION_TYPE.CHARGE,
    orderId: order.id,
    paymentId: payment.id,
    userId: order.buyerId,
    amount: round2(-order.price),
    description: `Escrow charge for “${order.title}”`,
    createdAt: heldAt,
  })

  if (ESCROW_HELD_STATUSES.has(order.status)) return

  if (isRefunded) {
    addTransaction({
      type: TRANSACTION_TYPE.REFUND,
      orderId: order.id,
      paymentId: payment.id,
      userId: order.buyerId,
      amount: order.price,
      description: `Full refund for “${order.title}” after a dispute resolution`,
      createdAt: refundedAt,
    })
    return
  }

  // --- Completed: settle the escrow ----------------------------------------
  const { base: commissionBase, amount: commissionAmount } =
    settledCommissionFor(order)

  if (isPartiallyRefunded) {
    addTransaction({
      type: TRANSACTION_TYPE.PARTIAL_REFUND,
      orderId: order.id,
      paymentId: payment.id,
      userId: order.buyerId,
      amount: settlement.refundedAmount,
      description: `Partial refund for “${order.title}” after a dispute resolution`,
      createdAt: settledAt,
    })
  }

  addTransaction({
    type: TRANSACTION_TYPE.RELEASE,
    orderId: order.id,
    paymentId: payment.id,
    userId: order.creatorId,
    amount: commissionBase,
    description: `Escrow released for “${order.title}”`,
    createdAt: settledAt,
  })

  addCommission({
    order,
    base: commissionBase,
    amount: commissionAmount,
    createdAt: settledAt,
  })

  addTransaction({
    type: TRANSACTION_TYPE.COMMISSION,
    orderId: order.id,
    paymentId: payment.id,
    userId: order.creatorId,
    amount: round2(-commissionAmount),
    description: `BetterBlue commission (${Math.round(order.commissionRate * 100)}%) on “${order.title}”`,
    createdAt: settledAt,
  })
})

/* -------------------------------------------------------------------------- */
/* Creator payouts                                                            */
/* -------------------------------------------------------------------------- */

// Prompt 25 §9: the **demo creator** needs a payout history worth reading, not
// a single row — three of the four `PAYOUT_STATUS` values including a rejection
// with its reason, so the settlement list on `/creator/earnings` demonstrates
// every chip and the explained-rejection treatment on the account a reviewer
// signs into. `requested` is deliberately left out of the seed: it is the state
// the withdraw flow *creates*, and a demo that produces a new chip is worth
// more than one that arrives pre-populated.
//
// Every amount is checked by `seed-db.js` against what that creator had earned
// by its `requestedAt`, and a pending payout (`requested`/`processing`) is
// reserved out of `available` by `getEarningsSummary` — so Ava's processing
// request is also what makes the "already requested" line on the Available tile
// real rather than hypothetical.
const PAYOUT_SOURCE = [
  {
    creator: 'ava',
    amount: 500,
    last4: '4821',
    status: PAYOUT_STATUS.REJECTED,
    requestedDaysAgo: 40,
    processedDaysAgo: 38,
    rejectedReason:
      'The account name on file did not match the bank record, so the transfer was returned. The balance is untouched — update the payout method on your profile and request it again.',
  },
  {
    creator: 'ava',
    amount: 1200,
    last4: '4821',
    status: PAYOUT_STATUS.PAID,
    requestedDaysAgo: 24,
    processedDaysAgo: 21,
  },
  {
    creator: 'ava',
    amount: 600,
    last4: '4821',
    status: PAYOUT_STATUS.PROCESSING,
    requestedDaysAgo: 5,
    processedDaysAgo: 3,
  },
  {
    creator: 'chloe',
    amount: 400,
    last4: '8890',
    status: PAYOUT_STATUS.REJECTED,
    requestedDaysAgo: 26,
    processedDaysAgo: 24,
    rejectedReason:
      'Payouts are on hold while the account is under Trust & Safety review. The balance stays available and the request can be made again once the review closes.',
  },
  {
    creator: 'liam',
    amount: 1500,
    last4: '7310',
    status: PAYOUT_STATUS.PROCESSING,
    requestedDaysAgo: 6,
    processedDaysAgo: 4,
  },
  {
    creator: 'isla',
    amount: 900,
    last4: '2287',
    status: PAYOUT_STATUS.REQUESTED,
    requestedDaysAgo: 2,
  },

  /* --- Appended by Prompt 32 (admin settlements) ------------------------- */
  //
  // The finance console's queue needs a queue. One `requested` row demonstrates
  // a chip; four demonstrate the thing the screen is actually for — an
  // oldest-first list with an age spread across the `AgeBadge` thresholds
  // (3 days amber, 7 days red), and enough checkboxes for batch approval to be
  // something a reviewer can try rather than read about.
  //
  // Amounts are all comfortably inside what each creator had earned by the day
  // they asked: `seed-db.js` checks exactly that, and a `requested` payout
  // writes no ledger row, so none of these moves a balance.
  {
    creator: 'yuki',
    amount: 700,
    last4: '5194',
    status: PAYOUT_STATUS.REQUESTED,
    requestedDaysAgo: 9,
  },
  {
    creator: 'noah',
    amount: 550,
    last4: '3372',
    status: PAYOUT_STATUS.REQUESTED,
    requestedDaysAgo: 6,
  },
  {
    creator: 'zoe',
    amount: 800,
    last4: '6045',
    status: PAYOUT_STATUS.REQUESTED,
    requestedDaysAgo: 4,
  },
  // One settlement paid *this* calendar month, so the queue's "Paid this
  // month" card has something to say on a freshly seeded database. The only
  // existing `paid` payout is three weeks old and lands in the previous month.
  {
    creator: 'amara',
    amount: 900,
    last4: '4416',
    status: PAYOUT_STATUS.PAID,
    requestedDaysAgo: 12,
    processedDaysAgo: 9,
  },
]

PAYOUT_SOURCE.forEach((source) => {
  payoutSequence += 1
  const beneficiary = creatorId(source.creator)
  const processedAt =
    source.processedDaysAgo === undefined
      ? null
      : daysAgo(source.processedDaysAgo, 11, 0)

  const payout = compact({
    id: seqId('pyo', payoutSequence),
    creatorId: beneficiary,
    amount: source.amount,
    currency: CURRENCY,
    method: {
      type: PAYOUT_METHOD_TYPE,
      accountName: creatorDisplayName(source.creator),
      accountMasked: maskedAccount(source.last4),
    },
    status: source.status,
    requestedAt: daysAgo(source.requestedDaysAgo, 9, 40),
    processedAt,
    rejectedReason: source.rejectedReason,
  })
  payouts.push(payout)

  // Only a completed payout moves money out of the BetterBlue balance.
  if (source.status === PAYOUT_STATUS.PAID) {
    addTransaction({
      type: TRANSACTION_TYPE.PAYOUT,
      payoutId: payout.id,
      userId: beneficiary,
      amount: round2(-source.amount),
      description: `Payout to bank account ${maskedAccount(source.last4)}`,
      createdAt: processedAt,
    })
  }
})

/* -------------------------------------------------------------------------- */
/* Affiliate commission payouts                                               */
/* -------------------------------------------------------------------------- */

affiliateEarnings
  .filter((earning) => earning.status === AFFILIATE_EARNING_STATUS.PAID)
  .forEach((earning) => {
    const profile = affiliateProfiles.find(
      (candidate) => candidate.id === earning.affiliateId
    )
    addTransaction({
      type: TRANSACTION_TYPE.AFFILIATE_COMMISSION,
      orderId: earning.orderId,
      userId: profile.userId,
      amount: earning.amount,
      description: `Affiliate commission for referral code ${profile.code}`,
      createdAt: earning.paidAt,
    })
  })

// Chronological order keeps the ledger readable in db.json and lets
// seed-db.js accumulate balances in a single pass. Ids are assigned after the
// sort so `txn_001` really is the oldest row.
transactions.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
transactions.forEach((transaction, index) => {
  transaction.id = seqId('txn', index + 1)
})

export { payments, transactions, commissions, payouts }
