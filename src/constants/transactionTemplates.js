// Ledger description copy — Prompt 17 §4.4.
//
// **One money movement = exactly one `transactions` row** (the ledger invariant
// in `docs/payments.md`), and every one of those rows carries a human-readable
// `description` that a creator reads on their earnings statement and an admin
// reads in finance reporting. Writing that sentence at each call site is how a
// ledger ends up with four spellings of "commission", so the wording lives here
// and `paymentService` only picks a type and passes the context.
//
// The strings match `scripts/seed-data/finance.js` exactly, so a transaction
// written by the app today is indistinguishable from a seeded one. Change a
// template here and the seed's copy has to move with it.
//
// Laravel: these become translation keys and the rows are rendered from
// `type` + a small `meta` payload, rather than storing prose. Until then the
// prose is stored, because JSON Server has nowhere to render from.

import { TRANSACTION_TYPE } from './statuses.js'

/** Wraps a title in the curly quotes the seeded descriptions use. */
const quoted = (title) => `“${String(title ?? 'this order').trim()}”`

/** `0.2` → `20` — the rate as whole percent, for commission copy. */
const percent = (rate) => Math.round(Number(rate ?? 0) * 100)

/**
 * The short clause explaining *why* money went back to a buyer. Kept as a
 * closed set so refund rows read consistently however the refund was reached.
 */
export const REFUND_CONTEXT = Object.freeze({
  DISPUTE: 'after a dispute resolution',
  CANCELLATION: 'after the order was cancelled',
})

/** Appends a refund context clause when there is one. */
const withContext = (sentence, context) =>
  context ? `${sentence} ${context}` : sentence

/**
 * One template per `TRANSACTION_TYPE`. Each takes the context it needs and
 * returns the finished sentence.
 *
 * @type {Object<string, (context: object) => string>}
 */
export const TRANSACTION_TEMPLATE = Object.freeze({
  /** Buyer → escrow, when an order is funded. */
  [TRANSACTION_TYPE.CHARGE]: ({ title }) => `Escrow charge for ${quoted(title)}`,

  /** Escrow → creator, gross of commission. */
  [TRANSACTION_TYPE.RELEASE]: ({ title }) => `Escrow released for ${quoted(title)}`,

  /** The platform fee, taken out of the creator's released amount. */
  [TRANSACTION_TYPE.COMMISSION]: ({ title, rate }) =>
    `BetterBlue commission (${percent(rate)}%) on ${quoted(title)}`,

  /** Escrow → buyer, the whole amount. */
  [TRANSACTION_TYPE.REFUND]: ({ title, context }) =>
    withContext(`Full refund for ${quoted(title)}`, context),

  /** Escrow → buyer, part of the amount; the rest still settles. */
  [TRANSACTION_TYPE.PARTIAL_REFUND]: ({ title, context }) =>
    withContext(`Partial refund for ${quoted(title)}`, context),

  /** Balance → the creator's bank account, when a payout is marked paid. */
  [TRANSACTION_TYPE.PAYOUT]: ({ accountMasked }) =>
    `Payout to bank account ${accountMasked ?? '****'}`,

  /** A referrer's share of the platform commission (Prompt 34). */
  [TRANSACTION_TYPE.AFFILIATE_COMMISSION]: ({ code }) =>
    `Affiliate commission for referral code ${code}`,
})

/**
 * The description for a ledger row.
 *
 * @param {string} type a `TRANSACTION_TYPE` value
 * @param {object} [context] `title` (order), `rate` (commission), `context`
 *   (a `REFUND_CONTEXT` clause), `accountMasked` (payout), `code` (affiliate)
 * @returns {string} one sentence, safe to display
 *
 * @example
 * transactionDescription(TRANSACTION_TYPE.COMMISSION, { title, rate: 0.2 })
 * // 'BetterBlue commission (20%) on “15 lifestyle photos…”'
 */
export function transactionDescription(type, context = {}) {
  const template = TRANSACTION_TEMPLATE[type]
  // An unknown type is a programming error, not a user-facing one: the row
  // still gets a description rather than `undefined` in the statement.
  return template ? template(context) : `Ledger entry for ${quoted(context.title)}`
}
