// What a buyer reads when a payment does not go through.
//
// `paymentService.initiateOrderPayment` throws rather than returns on a decline,
// because the target contract answers `402 payment_failed` with
// `details.reason` carrying the provider's code (`docs/payments.md` §9). This
// module is the single place that turns one of those codes into a sentence —
// feature-local by requirement (Prompt 19 §7), so the provider's vocabulary
// never leaks into a component and swapping processors is still one folder.
//
// Every entry answers three questions in the order a person asks them: what
// happened, was I charged, and what do I do now.

import { API_ERROR_CODE } from '@/services/api/apiError'
import { PAYMENT_FAILURE_CODE } from '@/services/paymentService'

/** What the primary button on the failure card should do. */
export const FAILURE_ACTION = Object.freeze({
  /** Back to the form with the card cleared — the usual case. */
  RETRY: 'retry',
  /** The order moved on; there is nothing to pay. Send them to the order. */
  VIEW_ORDER: 'view_order',
})

const CARD_TITLES = Object.freeze({
  [PAYMENT_FAILURE_CODE.CARD_DECLINED]: 'Your card was declined',
  [PAYMENT_FAILURE_CODE.INSUFFICIENT_FUNDS]: 'Not enough funds on that card',
  [PAYMENT_FAILURE_CODE.INVALID_CARD]: 'That card number was not accepted',
})

/**
 * Provider decline codes → copy. The wording says plainly that no money moved,
 * because the first thing anyone wonders after a failed payment is whether they
 * have been charged anyway.
 */
const DECLINE_COPY = Object.freeze({
  [PAYMENT_FAILURE_CODE.CARD_DECLINED]: {
    title: CARD_TITLES[PAYMENT_FAILURE_CODE.CARD_DECLINED],
    message:
      'The issuing bank turned the payment down and no money was taken. Banks rarely say why — ' +
      'trying another card is usually quicker than asking them.',
    hint: 'Your order is untouched and still waiting for payment.',
    action: FAILURE_ACTION.RETRY,
  },
  [PAYMENT_FAILURE_CODE.INSUFFICIENT_FUNDS]: {
    title: CARD_TITLES[PAYMENT_FAILURE_CODE.INSUFFICIENT_FUNDS],
    message:
      'The bank declined the payment for insufficient funds. Nothing was taken from the account.',
    hint: 'Top the card up or use another one — the order is held for you either way.',
    action: FAILURE_ACTION.RETRY,
  },
  [PAYMENT_FAILURE_CODE.INVALID_CARD]: {
    title: CARD_TITLES[PAYMENT_FAILURE_CODE.INVALID_CARD],
    message: 'The card details were rejected before any charge was made. Check the digits and the expiry date.',
    hint: 'Nothing was taken.',
    action: FAILURE_ACTION.RETRY,
  },
})

/** The fallback: a decline we have no specific sentence for. */
const GENERIC_DECLINE = Object.freeze({
  title: 'The payment did not go through',
  message: 'The card was not charged. Try again, or use a different card.',
  hint: 'Your order is untouched and still waiting for payment.',
  action: FAILURE_ACTION.RETRY,
})

/**
 * The order is no longer payable — someone paid it in another tab, or it was
 * cancelled while this page sat open.
 */
const ALREADY_SETTLED = Object.freeze({
  title: 'This order has already moved on',
  message:
    'It is no longer waiting for payment — it may have been paid in another tab, or cancelled. ' +
    'Nothing was charged just now.',
  hint: 'Open the order to see where it got to.',
  action: FAILURE_ACTION.VIEW_ORDER,
})

/**
 * MOCK-CAVEAT (Prompt 19 §13): the composite payment sequence has no
 * transaction around it (`docs/payments.md` §9), so a connection that drops
 * mid-charge can leave the browser genuinely unable to say whether the money
 * moved. The honest answer is the only safe one — never invite a blind retry.
 */
const UNCONFIRMED = Object.freeze({
  title: 'We could not confirm your payment',
  message:
    'The connection dropped while the payment was being settled, so we cannot tell you here ' +
    'whether it went through. Check your orders before trying again — paying twice is worse ' +
    'than paying late.',
  hint: 'If the order shows as in progress, it is funded and there is nothing left to do.',
  action: FAILURE_ACTION.VIEW_ORDER,
})

/**
 * Copy for whatever came back from `initiateOrderPayment`.
 *
 * @param {object} error an `ApiError` (or anything thrown)
 * @returns {{title: string, message: string, hint?: string, action: string}}
 */
export function failureCopyFor(error) {
  if (error?.code === API_ERROR_CODE.PAYMENT_FAILED) {
    return DECLINE_COPY[error?.details?.reason] ?? GENERIC_DECLINE
  }

  if (error?.code === API_ERROR_CODE.CONFLICT) return ALREADY_SETTLED

  // `server_error` from this operation specifically means "the money moved but
  // the rest of the sequence did not", and a network failure means we never
  // heard back at all. Both are the same thing to a buyer: do not retry blind.
  if (
    error?.code === API_ERROR_CODE.NETWORK_ERROR ||
    error?.code === API_ERROR_CODE.SERVER_ERROR
  ) {
    return UNCONFIRMED
  }

  return GENERIC_DECLINE
}

export default failureCopyFor
