// Seed: `platformSettings` — the configuration singleton (Prompt 05 §4.3).
//
// Stored as a JSON Server *singular route*: the value is an object rather than
// an array, so `GET /platformSettings` returns the record itself and
// `PATCH /platformSettings` updates it. In MySQL this becomes a key-value
// settings table rather than one wide row (see docs/data-model.md).
//
// These values are the source of truth for the seeded money math: the order
// factory reads `commission.defaultRate`, the affiliate factory reads
// `affiliate.commissionRate`, and the integrity validator re-derives every
// commission from them.

import { REJECTION_REASON_CODE } from '../../src/constants/policy.js'
import { CURRENCY, daysAgo } from '../seed-utils.js'
import { ADMIN_ID } from './users.js'

/** Platform commission applied to an order unless its category overrides it. */
export const DEFAULT_COMMISSION_RATE = 0.2

/** Share of the platform commission paid to a referring affiliate. */
export const AFFILIATE_COMMISSION_RATE = 0.1

/** Days a delivered order waits before it auto-accepts. */
export const AUTO_ACCEPT_DAYS = 5

/** Minimum balance a creator must hold before requesting a payout. */
export const PAYOUT_MIN_AMOUNT = 50

export const platformSettings = {
  general: {
    platformName: 'BetterBlue',
    supportEmail: 'support@betterblue.test',
    currency: CURRENCY,
    autoAcceptDays: AUTO_ACCEPT_DAYS,
    payoutMinAmount: PAYOUT_MIN_AMOUNT,
  },
  commission: {
    defaultRate: DEFAULT_COMMISSION_RATE,
    // Per-category overrides, e.g. { cat_technology_saas: 0.18 }. Empty until
    // an admin sets one, so every seeded order uses the default rate.
    categoryOverrides: {},
  },
  affiliate: {
    enabled: true,
    commissionRate: AFFILIATE_COMMISSION_RATE,
    attributionDays: 30,
    payoutMinAmount: 25,
  },
  moderation: {
    autoApproveDeliveries: true,
    reviewSlaDays: 2,
    rejectionReasons: Object.values(REJECTION_REASON_CODE),
  },
  features: {
    affiliateProgram: true,
    publicRequestBoard: true,
    reviews: true,
    disputes: true,
  },
  // Not in the Prompt 05 field list, but the `settings.update` audit entries
  // need something to point at — documented in docs/data-model.md.
  updatedAt: daysAgo(12, 9, 45),
  updatedById: ADMIN_ID.SUPER,
}

/** Commission rate for a category, honouring any override. */
export function commissionRateFor(categoryId) {
  return platformSettings.commission.categoryOverrides[categoryId] ?? DEFAULT_COMMISSION_RATE
}
