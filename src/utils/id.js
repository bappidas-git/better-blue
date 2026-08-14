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
