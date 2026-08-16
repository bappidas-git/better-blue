// Seed: `affiliateProfiles`, `affiliateReferrals`, `affiliateEarnings`
// (Prompt 05 §4.3).
//
// Three enrolled members: the demo creator (active, with earnings across
// every state), a creator whose one referral never converted inside the
// attribution window, and a buyer whose affiliate account was suspended, which
// voided the commission it had accrued.
//
// A referral converts when the referred account's first qualifying order
// completes inside `affiliate.attributionDays`. Commission is a share of the
// platform commission BetterBlue actually earned on the order — never a share
// of the creator's earnings — so a refund reduces it automatically.

import {
  AFFILIATE_EARNING_STATUS,
  AFFILIATE_PROFILE_STATUS,
  REFERRAL_STATUS,
} from '../../src/constants/statuses.js'
import { CURRENCY, compact, daysAgo, round2, seqId } from '../seed-utils.js'
import { AFFILIATE_CODE, USER_CREATED_AT, buyerId, creatorId } from './users.js'
import { orderFor, settledCommissionFor } from './orders.js'
import { AFFILIATE_COMMISSION_RATE } from './settings.js'

const AFFILIATE_SOURCE = [
  {
    id: 'aff_001',
    userId: creatorId('ava'),
    code: AFFILIATE_CODE.AVA,
    status: AFFILIATE_PROFILE_STATUS.ACTIVE,
    clicks: 214,
    enrolledDaysAgo: 112,
    referrals: [
      {
        id: 'ref_001',
        referredUserId: buyerId('craftware'),
        status: REFERRAL_STATUS.CONVERTED,
        // First qualifying order, plus every order that followed.
        convertedRequestKey: 'h06',
        earnings: [
          { requestKey: 'h06', status: AFFILIATE_EARNING_STATUS.PAID },
          { requestKey: 'h13', status: AFFILIATE_EARNING_STATUS.APPROVED },
          { requestKey: 'h21', status: AFFILIATE_EARNING_STATUS.PENDING },
        ],
      },
      {
        id: 'ref_002',
        referredUserId: creatorId('ethan'),
        // Signed up through the link and is still inside the window, but has
        // not completed a first order yet.
        status: REFERRAL_STATUS.PENDING,
        earnings: [],
      },
      {
        // Prompt 34 §9 — the **convertible** referral. A referred *buyer*,
        // signed up twelve days ago (inside the 30-day attribution window), with
        // exactly one order: `delivered`, waiting on their review. Accepting it
        // releases the payment, which fires the AFFILIATE-HOOK, which converts
        // this row and accrues commission — the whole pipeline, live, on a
        // freshly seeded database.
        //
        // It is a buyer rather than a creator because commission comes out of
        // the platform commission on a *purchase*: `ref_002` above can never
        // convert, and a fixture that cannot convert cannot demonstrate the
        // thing this program is for.
        id: 'ref_005',
        referredUserId: buyerId('fernwood'),
        status: REFERRAL_STATUS.PENDING,
        earnings: [],
      },
    ],
  },
  {
    id: 'aff_002',
    userId: creatorId('isla'),
    code: AFFILIATE_CODE.ISLA,
    status: AFFILIATE_PROFILE_STATUS.ACTIVE,
    clicks: 96,
    enrolledDaysAgo: 108,
    referrals: [
      {
        id: 'ref_003',
        referredUserId: buyerId('cocoa'),
        // Signed up, but their first order landed well after the 30-day
        // attribution window closed.
        status: REFERRAL_STATUS.EXPIRED,
        earnings: [],
      },
    ],
  },
  {
    id: 'aff_003',
    userId: buyerId('nimbus'),
    code: AFFILIATE_CODE.NIMBUS,
    // Suspended after the referral traffic failed a quality review; the
    // commission it had accrued was voided rather than paid out.
    status: AFFILIATE_PROFILE_STATUS.SUSPENDED,
    clicks: 48,
    enrolledDaysAgo: 100,
    referrals: [
      {
        id: 'ref_004',
        referredUserId: creatorId('mateo'),
        status: REFERRAL_STATUS.CONVERTED,
        convertedRequestKey: 'completed_atlas_villa',
        earnings: [
          {
            requestKey: 'completed_atlas_villa',
            status: AFFILIATE_EARNING_STATUS.VOID,
          },
        ],
      },
    ],
  },
]

/* -------------------------------------------------------------------------- */
/* Assembly                                                                   */
/* -------------------------------------------------------------------------- */

const affiliateProfiles = []
const affiliateReferrals = []
const affiliateEarnings = []

let earningSequence = 0

AFFILIATE_SOURCE.forEach((source) => {
  affiliateProfiles.push({
    id: source.id,
    userId: source.userId,
    code: source.code,
    status: source.status,
    clicks: source.clicks,
    signups: source.referrals.length,
    conversions: source.referrals.filter(
      (referral) => referral.status === REFERRAL_STATUS.CONVERTED
    ).length,
    // Recomputed by seed-db.js from the earnings below.
    pendingEarnings: 0,
    approvedEarnings: 0,
    paidEarnings: 0,
    enrolledAt: daysAgo(source.enrolledDaysAgo, 12, 0),
  })

  source.referrals.forEach((referral) => {
    const convertedOrder = referral.convertedRequestKey
      ? orderFor(referral.convertedRequestKey)
      : null

    affiliateReferrals.push(
      compact({
        id: referral.id,
        affiliateId: source.id,
        referredUserId: referral.referredUserId,
        status: referral.status,
        convertedOrderId: convertedOrder?.id,
        // The referral is recorded the moment the referred account signs up.
        createdAt: USER_CREATED_AT[referral.referredUserId],
        convertedAt: convertedOrder?.completedAt ?? null,
      })
    )

    referral.earnings.forEach((earning) => {
      const order = orderFor(earning.requestKey)
      const amount = round2(
        settledCommissionFor(order).amount * AFFILIATE_COMMISSION_RATE
      )
      earningSequence += 1
      const createdAt = order.completedAt

      affiliateEarnings.push(
        compact({
          id: seqId('aer', earningSequence),
          affiliateId: source.id,
          referralId: referral.id,
          orderId: order.id,
          amount,
          currency: CURRENCY,
          status: earning.status,
          createdAt,
          approvedAt:
            earning.status === AFFILIATE_EARNING_STATUS.APPROVED ||
            earning.status === AFFILIATE_EARNING_STATUS.PAID
              ? addBusinessDelay(createdAt, 3)
              : null,
          paidAt:
            earning.status === AFFILIATE_EARNING_STATUS.PAID
              ? addBusinessDelay(createdAt, 12)
              : null,
        })
      )
    })
  })
})

/** Small helper: `days` after an ISO timestamp, kept local to this module. */
function addBusinessDelay(iso, days) {
  return new Date(Date.parse(iso) + days * 24 * 60 * 60 * 1000).toISOString()
}

export { affiliateProfiles, affiliateReferrals, affiliateEarnings }
