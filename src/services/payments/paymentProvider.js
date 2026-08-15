// The payment provider boundary — 00 §15, Prompt 17 §4.1.
//
// BetterBlue's business layer must never know which processor is behind a
// payment (Requirement 13). Everything above `paymentService` deals in payment
// *records*: a `held` payment is a held payment whether the money sits with the
// dummy processor, Stripe, or a bank rail.
//
// This file is the contract that makes that true — three methods, documented
// below — plus the factory that picks an implementation. Adding a real provider
// is: write a module next to `dummyPaymentProvider.js` that implements the
// interface, register it in `PROVIDERS`, and set `paymentProvider` in
// `platformSettings`. Nothing else in the codebase changes; the full checklist
// is in `docs/payments.md`.

import { settingsService } from '../settingsService'

import { DUMMY_PROVIDER_KEY, dummyPaymentProvider } from './dummyPaymentProvider'

/**
 * Provider keys. The value of `platformSettings.paymentProvider` is one of
 * these; anything else falls back to `dummy` with a dev warning.
 */
export const PAYMENT_PROVIDER_KEY = Object.freeze({
  DUMMY: DUMMY_PROVIDER_KEY,
  // FUTURE(payments): the real processor lands here, e.g.
  // STRIPE: 'stripe',
})

/**
 * @typedef {object} ProviderCharge
 * @property {number} amount amount in currency units
 * @property {string} currency ISO 4217 code
 * @property {object} method `{ brand, last4, number? }` — the full number is
 *   passed to the provider and never stored or logged (contract §9.4)
 */

/**
 * @typedef {object} ProviderChargeResult
 * @property {string} providerRef the processor's own charge id, stored on
 *   `payments.providerRef` and used for every later call about this charge
 * @property {'processing'} status a charge is never settled synchronously
 */

/**
 * @typedef {object} ProviderConfirmation
 * @property {'succeeded'|'failed'} status the settled outcome
 * @property {string} [failureCode] a `PAYMENT_FAILURE_CODE` value when failed
 * @property {string} [failureReason] one plain sentence, safe to display
 */

/**
 * @typedef {object} ProviderRefundResult
 * @property {'refunded'} status
 * @property {number} amount what actually went back, in currency units
 */

/**
 * **The interface every payment provider implements.**
 *
 * A provider never throws for a business outcome: a decline is
 * `{ status: 'failed', failureCode }`, not an exception. Exceptions are for
 * transport and configuration failures only, which lets `paymentService` treat
 * "the bank said no" and "the network is down" as the different things they
 * are.
 *
 * @typedef {object} PaymentProvider
 * @property {string} key the `PAYMENT_PROVIDER_KEY` value, stored on
 *   `payments.provider`
 * @property {(charge: ProviderCharge) => Promise<ProviderChargeResult>} createPayment
 *   authorises a charge and returns its reference
 * @property {(providerRef: string) => Promise<ProviderConfirmation>} confirmPayment
 *   settles the charge — success moves the money into escrow
 * @property {(providerRef: string, amount?: number) => Promise<ProviderRefundResult>} refund
 *   returns money to the payer; omitting `amount` refunds the whole charge
 */

/** Every implementation, by key. */
const PROVIDERS = Object.freeze({
  [PAYMENT_PROVIDER_KEY.DUMMY]: dummyPaymentProvider,
  // FUTURE(payments): [PAYMENT_PROVIDER_KEY.STRIPE]: stripePaymentProvider,
  //
  // The real provider cannot be a pure browser module: a live secret key must
  // never reach the client (00 §14). It talks to the Laravel backend, which
  // talks to the processor — so the module registered here becomes a thin
  // client for `POST /orders/:id/pay` and the interface above stays as it is.
})

let warnedUnknownProvider = false

/** Resolves the configured key, defaulting to `dummy`. */
function resolveKey(key) {
  if (PROVIDERS[key]) return key

  if (key && !warnedUnknownProvider) {
    warnedUnknownProvider = true
    console.warn(
      `[payments] Unknown paymentProvider "${key}" in platformSettings — ` +
        `falling back to "${PAYMENT_PROVIDER_KEY.DUMMY}". ` +
        `Valid values: ${Object.keys(PROVIDERS).join(', ')}.`
    )
  }
  return PAYMENT_PROVIDER_KEY.DUMMY
}

/**
 * **The factory.** Returns the provider named by
 * `platformSettings.paymentProvider`, or the dummy processor when the key is
 * absent (which it is in the seeded settings) or unrecognised.
 *
 * Settings are cached by `settingsService`, so this is a local lookup on all
 * but the first call. A settings read that fails does not fail a payment: the
 * dummy provider is the documented default.
 *
 * @param {object} [options]
 * @param {string} [options.key] force a provider, bypassing settings — for the
 *   dev gallery and the workflow smoke test only
 * @returns {Promise<PaymentProvider>}
 */
export async function getPaymentProvider({ key } = {}) {
  if (key) return PROVIDERS[resolveKey(key)]

  let configured
  try {
    configured = (await settingsService.getSettings())?.paymentProvider
  } catch {
    configured = undefined
  }

  return PROVIDERS[resolveKey(configured)]
}

export default getPaymentProvider
