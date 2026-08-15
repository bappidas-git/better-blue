// The prototype's payment processor — 00 §15, Prompt 17 §4.1.
//
// MOCK-PAYMENT: no money moves and no request leaves the browser. This module
// simulates a card processor deterministically: the same card number always
// produces the same outcome, after a fixed processing delay, so a demo can be
// rehearsed and the workflow smoke test can assert on it.
//
// **Nothing outside `services/payments/` imports this file** — `paymentService`
// reaches it through `getPaymentProvider()` and everything above the services
// layer only ever sees a payment record. That boundary is the whole point of
// Requirement 13: swapping in a real processor is a new module next to this one
// plus one settings value (`docs/payments.md` → "Swapping in a real provider").

import { round2 } from '@/utils/money'

/**
 * Processing latency, in milliseconds. Long enough that the checkout screen's
 * pending state is a real state a reviewer can see, short enough that the smoke
 * test stays quick.
 */
export const DUMMY_PROCESSING_MS = 1200

/** Provider key this module answers to, stored on `payments.provider`. */
export const DUMMY_PROVIDER_KEY = 'dummy'

/**
 * Why a charge failed. These are the provider's own codes; `paymentService`
 * copies them onto `ApiError.details.reason` so the UI can explain the decline
 * without knowing which processor produced it (contract §6.12: `402`
 * `payment_failed` with `details.reason`).
 */
export const PAYMENT_FAILURE_CODE = Object.freeze({
  CARD_DECLINED: 'card_declined',
  INSUFFICIENT_FUNDS: 'insufficient_funds',
  INVALID_CARD: 'invalid_card',
})

/** One plain sentence per failure code, stored on `payments.failureReason`. */
export const PAYMENT_FAILURE_MESSAGE = Object.freeze({
  [PAYMENT_FAILURE_CODE.CARD_DECLINED]:
    'The card was declined by the issuing bank. No funds were taken.',
  [PAYMENT_FAILURE_CODE.INSUFFICIENT_FUNDS]:
    'The card was declined for insufficient funds. No funds were taken.',
  [PAYMENT_FAILURE_CODE.INVALID_CARD]:
    'That card number is not valid. Check the digits and try again.',
})

/**
 * The test cards, exported for the checkout screen's dev panel and the design
 * gallery (Prompt 17 §6). Business-safe demo data — these are the standard
 * non-routable test numbers, not anybody's card.
 *
 * The rules behind them, in the order they are applied to the digits:
 *
 * | Card ends in | Outcome |
 * |---|---|
 * | `0002` | declined — `card_declined` |
 * | `9995` | declined — `insufficient_funds` |
 * | anything else, 16 digits, passes Luhn | succeeds |
 * | anything else | declined — `invalid_card` |
 */
export const DUMMY_TEST_CARDS = Object.freeze([
  Object.freeze({
    number: '4242 4242 4242 4242',
    brand: 'visa',
    last4: '4242',
    label: 'Successful payment',
    description: 'Funds the order and moves the escrow to held.',
    outcome: 'succeeded',
    failureCode: null,
  }),
  Object.freeze({
    number: '4000 0000 0000 0002',
    brand: 'visa',
    last4: '0002',
    label: 'Declined by the bank',
    description: 'The order stays pending_payment and the buyer can retry.',
    outcome: 'failed',
    failureCode: PAYMENT_FAILURE_CODE.CARD_DECLINED,
  }),
  Object.freeze({
    number: '4000 0000 0000 9995',
    brand: 'visa',
    last4: '9995',
    label: 'Insufficient funds',
    description: 'A decline with a reason worth showing differently in the UI.',
    outcome: 'failed',
    failureCode: PAYMENT_FAILURE_CODE.INSUFFICIENT_FUNDS,
  }),
])

/** Digits only — the UI is free to send `4242 4242-4242 4242`. */
const digitsOf = (value) => String(value ?? '').replace(/\D/g, '')

/** Standard Luhn checksum, the same first-pass check a real processor runs. */
function passesLuhn(digits) {
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

  return digits.length > 0 && sum % 10 === 0
}

/**
 * The outcome for a card, by the table on {@link DUMMY_TEST_CARDS}.
 *
 * Falls back to the masked `last4` when no full number was supplied, so a
 * retry built from a stored payment method still behaves predictably.
 */
function outcomeFor(method) {
  const digits = digitsOf(method?.number) || digitsOf(method?.last4)

  if (digits.endsWith('0002')) return PAYMENT_FAILURE_CODE.CARD_DECLINED
  if (digits.endsWith('9995')) return PAYMENT_FAILURE_CODE.INSUFFICIENT_FUNDS
  if (digits.length === 16 && passesLuhn(digits)) return null
  // A four-digit `last4` from a stored method is trusted rather than rejected:
  // only a full number is checked against Luhn.
  if (digits.length === 4) return null

  return PAYMENT_FAILURE_CODE.INVALID_CARD
}

/** Resolves after `ms`, so the pending state of a charge is a real state. */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

let referenceSequence = 0

/**
 * A provider-side reference. Opaque to BetterBlue and stored on
 * `payments.providerRef` exactly as a real processor's charge id would be.
 */
function nextReference() {
  referenceSequence += 1
  const stamp = Date.now().toString(36)
  return `dummy_ch_${stamp}${String(referenceSequence).padStart(3, '0')}`
}

/**
 * Charges in flight, keyed by reference. A real processor keeps this state; the
 * dummy keeps it in memory, which is why a page reload loses an unconfirmed
 * charge — an accepted prototype limitation, and one the escrow workflow
 * survives because an unconfirmed payment simply stays `processing`.
 */
const charges = new Map()

/**
 * The dummy processor. Implements the `PaymentProvider` interface documented in
 * `./paymentProvider.js`.
 *
 * @type {import('./paymentProvider').PaymentProvider}
 */
export const dummyPaymentProvider = Object.freeze({
  key: DUMMY_PROVIDER_KEY,

  /**
   * Authorises a charge. Always succeeds — like a real processor, the *outcome*
   * of the charge arrives from {@link confirmPayment}, not from this call.
   *
   * @param {object} charge
   * @param {number} charge.amount amount in currency units
   * @param {string} charge.currency ISO 4217 code
   * @param {object} charge.method `{ brand, last4, number? }`; the full number
   *   is used here and **never** returned, stored, or logged (contract §9.4)
   * @returns {Promise<{providerRef: string, status: 'processing'}>}
   */
  async createPayment({ amount, currency, method } = {}) {
    const providerRef = nextReference()

    charges.set(providerRef, {
      amount: round2(amount),
      currency,
      failureCode: outcomeFor(method),
      refunded: 0,
    })

    return { providerRef, status: 'processing' }
  },

  /**
   * Settles the charge after {@link DUMMY_PROCESSING_MS}.
   *
   * @param {string} providerRef from {@link createPayment}
   * @returns {Promise<{status: 'succeeded'|'failed', failureCode?: string,
   *   failureReason?: string}>}
   */
  async confirmPayment(providerRef) {
    await wait(DUMMY_PROCESSING_MS)

    const charge = charges.get(providerRef)
    if (!charge) {
      // Unknown reference — treated as a decline rather than an exception, so
      // the workflow always ends with a payment record in a settled state.
      return {
        status: 'failed',
        failureCode: PAYMENT_FAILURE_CODE.INVALID_CARD,
        failureReason: PAYMENT_FAILURE_MESSAGE[PAYMENT_FAILURE_CODE.INVALID_CARD],
      }
    }

    if (charge.failureCode) {
      charges.delete(providerRef)
      return {
        status: 'failed',
        failureCode: charge.failureCode,
        failureReason: PAYMENT_FAILURE_MESSAGE[charge.failureCode],
      }
    }

    charge.status = 'succeeded'
    return { status: 'succeeded' }
  },

  /**
   * Returns money to the card. Partial refunds are allowed up to the charged
   * amount; the dummy tracks how much has already gone back.
   *
   * @param {string} providerRef the charge to refund
   * @param {number} [amount] defaults to the whole remaining amount
   * @returns {Promise<{status: 'refunded', amount: number}>}
   */
  async refund(providerRef, amount) {
    const charge = charges.get(providerRef)
    // A refund against a charge this process did not create still succeeds:
    // the record of record is the payment row, and refusing here would strand
    // an order whose page was reloaded between funding and refunding.
    const requested = round2(amount ?? charge?.amount ?? 0)

    if (charge) charge.refunded = round2(charge.refunded + requested)

    return { status: 'refunded', amount: requested }
  },
})

export default dummyPaymentProvider
