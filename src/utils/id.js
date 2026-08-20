// ID generation — prompts/00-architecture-and-rules.md §8.
//
// MOCK-DATA: JSON Server does not mint domain identifiers, so new records get
// their IDs on the client, inside the services layer only (never in
// components). The Laravel backend will generate IDs server-side and return
// them in the create response; when that swap happens, `generateId` calls
// disappear from the services and this module goes with them.

/** Entity prefixes (00 §8) — the only place a `usr_`-style literal belongs. */
export const ID_PREFIX = Object.freeze({
  USER: 'usr',
  BUYER_PROFILE: 'bpr',
  CREATOR_PROFILE: 'cpr',
  PORTFOLIO_ITEM: 'pfi',
  CATEGORY: 'cat',
  REQUEST: 'req',
  // Storefront V2: the private conversation a creator opens under a feed. A
  // feed *is* a `contentRequests` record, so a reply's `feedId` carries a
  // `req_…` — the collection was never renamed (prompts-v2/03).
  FEED_REPLY: 'frp',
  PROPOSAL: 'prp',
  ORDER: 'ord',
  DELIVERY: 'dlv',
  REVISION: 'rev',
  PAYMENT: 'pay',
  TRANSACTION: 'txn',
  COMMISSION: 'com',
  PAYOUT: 'pyo',
  DISPUTE: 'dsp',
  DISPUTE_MESSAGE: 'dmsg',
  REVIEW: 'rvw',
  NOTIFICATION: 'ntf',
  MODERATION_REVIEW: 'mod',
  REPORT: 'rpt',
  SUPPORT_TICKET: 'tkt',
  AFFILIATE_PROFILE: 'aff',
  AFFILIATE_REFERRAL: 'ref',
  AFFILIATE_EARNING: 'aer',
  AUDIT_LOG: 'aud',
  // Embedded file records — these live inline on `deliveries.files` and
  // `disputes[].evidence` rather than in their own collection (contract §1.4),
  // and are minted by `uploadService`.
  DELIVERY_FILE: 'dfl',
  DISPUTE_EVIDENCE: 'evd',
  // Account imagery — a company logo or an avatar. Stored as a plain URL on
  // `buyerProfiles.logoUrl` / `users.avatarUrl` rather than as a record, so the
  // id only ever labels the upload itself.
  PROFILE_IMAGE: 'pim',
  // Reference imagery a buyer attaches to a content request. Stored as plain
  // URLs on `contentRequests.referenceUrls` rather than as records, so — like
  // `pim_` above — the id only ever labels the upload itself.
  REQUEST_REFERENCE: 'rrf',
  // One message inside a `feedReplies` thread. Embedded on `feedReplies.
  // messages` rather than stored as its own collection (contract §1.4), like
  // `dfl_` and `evd_` above, and minted by `feedService`.
  FEED_REPLY_MESSAGE: 'frm',
})

/**
 * Opaque, sortable-ish identifier: `prefix_` + base-36 timestamp + base-36
 * randomness — e.g. `generateId(ID_PREFIX.ORDER)` → `ord_m1k2j9x4f7q2`.
 * Collisions are effectively impossible at prototype volumes.
 */
export function generateId(prefix) {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 8).padEnd(6, '0')
  const safePrefix = String(prefix ?? 'bb').replace(/[^a-z0-9]/gi, '') || 'bb'
  return `${safePrefix}_${timestamp}${random}`
}
