// Money arithmetic — prompts/00-architecture-and-rules.md §8, Prompt 17 §7.
//
// Money is stored as decimal numbers with a `currency` field (00 §8), which
// means every computed amount has to be pinned back to cents before it is
// written: `0.1 + 0.2` is `0.30000000000000004`, and a ledger that drifts by a
// thousandth of a cent is a ledger nobody can reconcile.
//
// **Every money calculation in the app goes through this module.** Formatting
// for display stays in `utils/formatters.js#formatCurrency`; this file only
// does arithmetic.
//
// Rounding is **half away from zero at two decimals** — what PHP's `round($x, 2)`
// and MySQL's `ROUND(x, 2)` do, so the numbers this file computes today are the
// numbers the Laravel backend will compute later (`docs/api-contract.md` §1.6).
//
// `scripts/seed-utils.js#round2` is the seed's own copy: the seed runs in plain
// Node and cannot resolve the `@/` alias, so it cannot import this module. The
// two agree on every amount either one produces — the seed only ever rounds
// non-negative bases and negates the result afterwards — and they must keep
// agreeing, or seeded money and computed money will disagree.

/**
 * Whole cents for an amount, rounded half away from zero. The `EPSILON` nudge
 * (applied in the amount's own direction) rescues the values that land a hair
 * below the .5 boundary in binary — `1.005 * 100` is `100.49999999999999`,
 * which would otherwise round *down* to `$1.00`.
 *
 * @param {number|string} value an amount in currency units
 * @returns {number} the amount in cents, or `0` for a non-finite input
 *
 * @example
 * toCents(1.005) // 101
 */
export function toCents(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return 0
  return Math.round((amount + Number.EPSILON * Math.sign(amount)) * 100)
}

/**
 * Currency units for a whole-cent amount — the inverse of {@link toCents}.
 *
 * @param {number} cents whole cents
 * @returns {number} the amount in currency units
 *
 * @example
 * fromCents(101) // 1.01
 */
export function fromCents(cents) {
  const amount = Number(cents)
  return Number.isFinite(amount) ? Math.round(amount) / 100 : 0
}

/**
 * An amount snapped to cents. The workhorse: anything multiplied, summed, or
 * subtracted passes through here before it is stored or compared.
 *
 * @param {number|string} value an amount in currency units
 * @returns {number} the amount rounded half away from zero to 2 decimals
 *
 * @example
 * round2(940 * 0.2) // 188
 */
export function round2(value) {
  return fromCents(toCents(value))
}

/**
 * A percentage of an amount, rounded to cents — the commission calculation
 * (`amount = round(baseAmount × rate, 2)`, contract §6.14).
 *
 * @param {number} amount the base amount
 * @param {number} rate a decimal fraction, e.g. `0.2` for 20%
 * @returns {number} the share, rounded to 2 decimals
 *
 * @example
 * applyRate(615, 0.2) // 123
 */
export function applyRate(amount, rate) {
  const percentage = Number(rate)
  if (!Number.isFinite(percentage)) return 0
  return round2(Number(amount) * percentage)
}

/**
 * Adds amounts in cent space, so a long ledger fold cannot accumulate binary
 * error one row at a time.
 *
 * @param {Array<number|string>} values amounts in currency units
 * @returns {number} the total, exact to the cent
 *
 * @example
 * sumMoney([0.1, 0.2]) // 0.3
 */
export function sumMoney(values) {
  const list = Array.isArray(values) ? values : []
  return fromCents(list.reduce((total, value) => total + toCents(value), 0))
}

/**
 * Subtracts in cent space — `a − b`, exact to the cent.
 *
 * @param {number|string} a
 * @param {number|string} b
 * @returns {number}
 */
export function subtractMoney(a, b) {
  return fromCents(toCents(a) - toCents(b))
}

/**
 * True when two amounts are the same to the cent. Comparing money with `===`
 * is how a released payment ends up a hundredth of a cent short of its escrow.
 *
 * @param {number|string} a
 * @param {number|string} b
 * @returns {boolean}
 */
export function isSameAmount(a, b) {
  return toCents(a) === toCents(b)
}

/**
 * A finite, non-negative amount snapped to cents, or `null` when there is
 * nothing usable to store. Used to validate amounts that arrive from a form or
 * a URL before any of the maths above runs on them.
 *
 * @param {unknown} value
 * @returns {number|null}
 */
export function toAmount(value) {
  if (value === '' || value === null || value === undefined) return null
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) return null
  return round2(amount)
}
