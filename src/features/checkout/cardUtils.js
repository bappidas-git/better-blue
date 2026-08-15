// Card-entry helpers for the checkout form — formatting, brand detection, and
// the checks that run in the browser before a charge is ever attempted.
//
// Deliberately **feature-local and provider-agnostic** (Prompt 19 §7). Nothing
// here knows which processor will take the card; the form only ever produces
// `{ brand, last4, number }` and hands it to `paymentService`. The provider runs
// its own Luhn check on whatever it is given — this copy exists so a typo is
// caught under the field instead of costing a round trip and a `failed` payment
// record that the buyer then has to make sense of.
//
// SECURITY (00 §14): the full number lives in React state for the duration of
// one submit and is never stored, logged, or sent anywhere but the provider
// call. `paymentService.storableMethod` keeps only `{ brand, last4 }`.

/** Card networks the form recognises. `card` is the honest fallback. */
export const CARD_BRAND = Object.freeze({
  VISA: 'visa',
  MASTERCARD: 'mastercard',
  UNKNOWN: 'card',
})

/**
 * Label and icon per brand. The label is what accessibility technology reads,
 * so an icon that fails to resolve still leaves the network named.
 */
export const CARD_BRAND_META = Object.freeze({
  [CARD_BRAND.VISA]: Object.freeze({ label: 'Visa', icon: 'tabler:brand-visa' }),
  [CARD_BRAND.MASTERCARD]: Object.freeze({
    label: 'Mastercard',
    icon: 'tabler:brand-mastercard',
  }),
  [CARD_BRAND.UNKNOWN]: Object.freeze({ label: 'Card', icon: 'solar:card-linear' }),
})

/** The form accepts 16-digit networks only — every test card is one. */
export const MAX_CARD_DIGITS = 16

/** CVV length range accepted (3 for Visa/Mastercard, 4 for the wider set). */
export const CVV_MIN_LENGTH = 3
export const CVV_MAX_LENGTH = 4

/** Digits only — people paste `4242-4242 4242 4242` and mean well by it. */
export const digitsOf = (value) => String(value ?? '').replace(/\D/g, '')

/**
 * The network a number belongs to, by issuer prefix.
 *
 * Visa starts `4`; Mastercard is `51`–`55` plus the `2221`–`2720` range added
 * in 2017. Anything else is `card` — the form does not refuse it, it simply has
 * nothing more specific to show.
 *
 * @param {string} value the raw or formatted number
 * @returns {string} a `CARD_BRAND` value
 */
export function detectCardBrand(value) {
  const digits = digitsOf(value)
  if (!digits) return CARD_BRAND.UNKNOWN
  if (digits.startsWith('4')) return CARD_BRAND.VISA

  const two = Number(digits.slice(0, 2))
  if (digits.length >= 2 && two >= 51 && two <= 55) return CARD_BRAND.MASTERCARD

  const four = Number(digits.slice(0, 4))
  if (digits.length >= 4 && four >= 2221 && four <= 2720) return CARD_BRAND.MASTERCARD

  return CARD_BRAND.UNKNOWN
}

/** `4242424242424242` → `4242 4242 4242 4242`, capped at {@link MAX_CARD_DIGITS}. */
export function formatCardNumber(value) {
  const digits = digitsOf(value).slice(0, MAX_CARD_DIGITS)
  return digits.replace(/(.{4})/g, '$1 ').trim()
}

/**
 * `1229` → `12/29`, with the slash appearing as soon as the month is complete.
 *
 * A leading `2`–`9` is read as a month and padded (`3` → `03/`), which is what
 * someone typing "March" expects and stops `3` from being read as the start of
 * a nonexistent month `30`.
 */
export function formatExpiry(value) {
  let digits = digitsOf(value).slice(0, 4)

  if (digits.length === 1 && digits >= '2') digits = `0${digits}`
  if (digits.length < 3) return digits

  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

/** CVV is digits only, capped at {@link CVV_MAX_LENGTH}. */
export function formatCvv(value) {
  return digitsOf(value).slice(0, CVV_MAX_LENGTH)
}

/** Standard Luhn checksum — the same first-pass check a real processor runs. */
export function passesLuhn(value) {
  const digits = digitsOf(value)
  if (!digits) return false

  let sum = 0
  let double = false

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index])
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }

  return sum % 10 === 0
}

/** The masked tail stored on the payment record (contract §9.4). */
export const lastFourOf = (value) => digitsOf(value).slice(-4)

/**
 * `{ month, year }` from an `MM/YY` string, or `null` when it is not one yet.
 * The two-digit year is read as `20YY`, which is the only reading a card
 * expiry has ever had.
 */
export function parseExpiry(value) {
  const digits = digitsOf(value)
  if (digits.length !== 4) return null

  const month = Number(digits.slice(0, 2))
  if (!Number.isInteger(month) || month < 1 || month > 12) return null

  return { month, year: 2000 + Number(digits.slice(2)) }
}

/**
 * Is this expiry still in the future? A card is good through the **last day**
 * of its printed month, so December 2026 is valid all through December 2026.
 *
 * @param {string} value an `MM/YY` string
 * @param {Date} [now] injectable for tests
 */
export function expiryIsFuture(value, now = new Date()) {
  const parsed = parseExpiry(value)
  if (!parsed) return false
  // Day 0 of the following month is the last day of this one.
  return new Date(parsed.year, parsed.month, 1).getTime() > now.getTime()
}

/* -------------------------------------------------------------------------- */
/* Field rules — the `(value) => message | undefined` shape `useForm` expects   */
/* -------------------------------------------------------------------------- */

/** Card number: present, complete, and passing the checksum. */
export const cardNumberRule =
  () =>
  (value) => {
    const digits = digitsOf(value)
    if (!digits) return 'Enter the card number.'
    if (digits.length < MAX_CARD_DIGITS) return 'A card number has 16 digits.'
    if (!passesLuhn(digits)) return 'Check the card number — those digits do not add up.'
    return undefined
  }

/** Expiry: present, a real month, and not already past. */
export const expiryRule =
  () =>
  (value) => {
    const digits = digitsOf(value)
    if (!digits) return 'Enter the expiry date.'
    if (digits.length < 4) return 'Use the MM/YY format, for example 04/29.'
    if (!parseExpiry(value)) return 'That is not a valid month.'
    if (!expiryIsFuture(value)) return 'That card has expired.'
    return undefined
  }

/** Security code: 3 or 4 digits, depending on the network. */
export const cvvRule =
  () =>
  (value) => {
    const digits = digitsOf(value)
    if (!digits) return 'Enter the security code.'
    if (digits.length < CVV_MIN_LENGTH) {
      return `The security code is ${CVV_MIN_LENGTH} or ${CVV_MAX_LENGTH} digits.`
    }
    return undefined
  }

/**
 * Where the caret belongs in `formatted` once `digitsBefore` digits have been
 * typed ahead of it.
 *
 * Formatting a field on every keystroke moves the caret to the end unless
 * something puts it back, which makes correcting a digit in the middle of a
 * card number impossible (§12 — "formatting preserves caret sanely"). Counting
 * *digits* rather than characters means the inserted spaces and slash never
 * shift the answer.
 *
 * @param {string} formatted the value after formatting
 * @param {number} digitsBefore digits to the left of the caret before formatting
 * @returns {number} caret index into `formatted`
 */
export function caretIndexForDigits(formatted, digitsBefore) {
  if (digitsBefore <= 0) return 0

  let seen = 0
  for (let index = 0; index < formatted.length; index += 1) {
    if (/\d/.test(formatted[index])) {
      seen += 1
      if (seen === digitsBefore) return index + 1
    }
  }
  return formatted.length
}
