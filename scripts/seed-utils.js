// Shared helpers for the deterministic seed (Prompt 05).
//
// Everything the seed produces must be reproducible byte-for-byte, so this
// module deliberately contains **no** `Date.now()` and **no** `Math.random()`.
// Every timestamp is derived from `SEED_ANCHOR`, and every "random-looking"
// choice is an index into a fixed list.
//
// Bumping `SEED_ANCHOR` re-ages the whole dataset (all dates are relative to
// it) and is the only intended way to refresh the data window.

/** Fixed "now" for the generated dataset. All timestamps are relative to it. */
export const SEED_ANCHOR = '2026-08-14T09:00:00.000Z'

const SEED_ANCHOR_MS = Date.parse(SEED_ANCHOR)
const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

/** Records must not be older than this (00 §9 / Prompt 05 §9). */
export const SEED_WINDOW_DAYS = 120

/** Single currency for the prototype (00 §8). */
export const CURRENCY = 'USD'

/* -------------------------------------------------------------------------- */
/* Dates                                                                      */
/* -------------------------------------------------------------------------- */

/** ISO timestamp `days` before the anchor, pinned to a UTC hour/minute. */
export function daysAgo(days, hour = 9, minute = 0) {
  const date = new Date(SEED_ANCHOR_MS - Math.round(days * DAY_MS))
  date.setUTCHours(hour, minute, 0, 0)
  return date.toISOString()
}

/** ISO timestamp `hours` after `iso`. */
export function addHours(iso, hours) {
  return new Date(Date.parse(iso) + Math.round(hours * HOUR_MS)).toISOString()
}

/** ISO timestamp `days` after `iso`. */
export function addDays(iso, days) {
  return new Date(Date.parse(iso) + Math.round(days * DAY_MS)).toISOString()
}

/** Whole days between two ISO timestamps (`b - a`), rounded down. */
export function daysBetween(a, b) {
  return Math.floor((Date.parse(b) - Date.parse(a)) / DAY_MS)
}

/** Milliseconds since epoch — used by validators for ordering assertions. */
export function ms(iso) {
  return Date.parse(iso)
}

/* -------------------------------------------------------------------------- */
/* Money                                                                      */
/* -------------------------------------------------------------------------- */

/** Currency-safe rounding to 2 decimals (00 §8: decimal money fields). */
export function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

/** Platform commission on an amount, rounded to cents. */
export function commissionOf(amount, rate) {
  return round2(amount * rate)
}

/* -------------------------------------------------------------------------- */
/* Identifiers                                                                */
/* -------------------------------------------------------------------------- */

/** `seqId('ord', 7)` → `ord_007` (00 §8 prefixes, zero-padded for stable sort). */
export function seqId(prefix, index, width = 3) {
  return `${prefix}_${String(index).padStart(width, '0')}`
}

/** Deterministic pick from a fixed list — replaces randomness in factories. */
export function pick(list, index) {
  return list[((index % list.length) + list.length) % list.length]
}

/* -------------------------------------------------------------------------- */
/* Seed-local enum-likes                                                      */
/* -------------------------------------------------------------------------- */

// These string sets are not (yet) part of `src/constants` and Prompt 05 must
// not change that folder (§17), so the seed owns them. They are documented in
// docs/data-model.md; a later prompt that needs them in the app should promote
// them into `src/constants` and re-point these imports.
//
// ORIENTATION and BUDGET_TYPE took exactly that path in Prompt 16 (the request
// wizard needs both in the app). They are re-exported below rather than
// re-declared, so the seed keeps its single import surface and there is only
// ever one definition of either set.

/** Stored file kind on portfolio items and delivery files. */
export const MEDIA_TYPE = Object.freeze({ IMAGE: 'image', VIDEO: 'video' })

// VISIBILITY and MODERATION_SUBJECT took the same path in Prompt 22 (the
// portfolio manager switches visibility and writes moderation records), so all
// four of these are re-exported rather than declared.
export {
  BUDGET_TYPE,
  MODERATION_SUBJECT,
  ORIENTATION,
  VISIBILITY,
} from '../src/constants/statuses.js'

// REPORT_SUBJECT and REPORT_REASON took the same path in Prompt 30 (the report
// dialog offers the reasons and the admin queue prints them), so they are
// re-exported from `src/constants/reports.js` rather than declared here.
export { REPORT_REASON, REPORT_SUBJECT } from '../src/constants/reports.js'

/** Dummy payment provider + card metadata (00 §15: payments are mocked). */
export const PAYMENT_PROVIDER = 'dummy'
export const CARD_BRAND = 'visa'

/** Payout rail summary stored on creator profiles and payouts. */
export const PAYOUT_METHOD_TYPE = 'bank'

/**
 * Entity types referenced by notifications, audit logs, and reports. Values
 * map 1:1 onto collections in `seed-db.js`, which is how the integrity
 * validator resolves polymorphic `entityId` references.
 */
export const ENTITY_TYPE = Object.freeze({
  USER: 'user',
  CREATOR_PROFILE: 'creator_profile',
  PORTFOLIO_ITEM: 'portfolio_item',
  CATEGORY: 'category',
  REQUEST: 'request',
  PROPOSAL: 'proposal',
  ORDER: 'order',
  DELIVERY: 'delivery',
  REVISION: 'revision',
  PAYMENT: 'payment',
  PAYOUT: 'payout',
  DISPUTE: 'dispute',
  REVIEW: 'review',
  MODERATION_REVIEW: 'moderation_review',
  REPORT: 'report',
  SUPPORT_TICKET: 'support_ticket',
  AFFILIATE_PROFILE: 'affiliate_profile',
  AFFILIATE_EARNING: 'affiliate_earning',
  PLATFORM_SETTINGS: 'platform_settings',
})

/* -------------------------------------------------------------------------- */
/* Misc                                                                       */
/* -------------------------------------------------------------------------- */

/** Masked bank tail shown in payout summaries — never a real account number. */
export function maskedAccount(last4) {
  return `**** ${last4}`
}

/** Drops keys whose value is `undefined`, so optional fields stay absent. */
export function compact(record) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined)
  )
}
