import dayjs from 'dayjs'

import { ORDER_STATUS } from '@/constants/statuses'
import { EMPTY_PLACEHOLDER, formatDate, formatNumber, formatRelativeTime } from '@/utils/formatters'

// The sentences an order is described with in more than one place. The list
// card, the state banner, and the review panel all have to agree about whose
// move it is and how long is left, so they say it from here (00 §8: dates are
// formatted only through `utils/formatters`, and this builds on those).
//
// Everything in this file is a pure function of a record. No fetching, no
// status changes — those are `orderService` and `deliveryService`.

/** Order states where the delivery clock is still running. */
const LIVE_STATUSES = [
  ORDER_STATUS.IN_PROGRESS,
  ORDER_STATUS.REVISION_REQUESTED,
]

/** A due date inside this many days reads as urgent rather than merely upcoming. */
const SOON_DAYS = 2

/**
 * How an order's delivery date should read and feel.
 *
 * Tone is only raised while the clock is actually running: a completed order
 * whose date has passed is history, and painting it red would be alarming about
 * nothing. An order already `delivered` is not late either — the work arrived.
 *
 * @param {object} order an order record
 * @returns {{date: string, relative: string, tone: string, isOverdue: boolean, label: string}}
 */
export function describeDue(order) {
  const value = order?.deliveryDueAt
  const parsed = value ? dayjs(value) : null
  const isLive = LIVE_STATUSES.includes(order?.status)

  if (!parsed?.isValid()) {
    return {
      date: EMPTY_PLACEHOLDER,
      relative: '',
      tone: 'text.secondary',
      isOverdue: false,
      label: 'No delivery date yet',
    }
  }

  const date = formatDate(value)
  const relative = formatRelativeTime(value)
  const isOverdue = isLive && parsed.isBefore(dayjs())
  const isSoon = isLive && !isOverdue && parsed.diff(dayjs(), 'day') <= SOON_DAYS

  return {
    date,
    relative,
    tone: isOverdue ? 'error.main' : isSoon ? 'warning.main' : 'text.secondary',
    isOverdue,
    label: isOverdue ? `Delivery was due ${relative}, on ${date}` : `Delivery due ${relative}, on ${date}`,
  }
}

/**
 * One line saying what is happening and, above all, **whose move it is**.
 *
 * `accent` marks the one state that is waiting on the buyer. It is the only
 * thing on a list of a dozen orders that should pull the eye, so nothing else
 * ever sets it.
 *
 * @param {object} order an order record
 * @returns {{text: string, accent: boolean}}
 */
export function describeProgress(order) {
  switch (order?.status) {
    case ORDER_STATUS.PENDING_PAYMENT:
      return { text: 'Waiting for your payment — the creator cannot start until it is funded.', accent: false }
    case ORDER_STATUS.IN_PROGRESS:
      return { text: 'The creator is working on this. Nothing needs you right now.', accent: false }
    case ORDER_STATUS.DELIVERED:
      return { text: 'Awaiting your review.', accent: true }
    case ORDER_STATUS.REVISION_REQUESTED:
      return { text: 'The creator is making the changes you asked for.', accent: false }
    case ORDER_STATUS.COMPLETED:
      return { text: 'Delivered, accepted, and paid.', accent: false }
    case ORDER_STATUS.DISPUTED:
      return { text: 'With the BetterBlue team while the dispute is resolved.', accent: false }
    case ORDER_STATUS.CANCELLED:
      return { text: 'This engagement was called off.', accent: false }
    case ORDER_STATUS.REFUNDED:
      return { text: 'The escrow was returned to you in full.', accent: false }
    default:
      return { text: '', accent: false }
  }
}

/**
 * The revision allowance, in the two forms the screens need: the numbers, and
 * the sentence a person reads.
 *
 * @param {object} order an order record
 * @returns {{used: number, included: number, remaining: number, isExhausted: boolean, label: string}}
 */
export function describeRevisions(order) {
  const used = Number(order?.revisionsUsed) || 0
  const included = Number(order?.revisionsIncluded) || 0
  const remaining = Math.max(included - used, 0)

  return {
    used,
    included,
    remaining,
    isExhausted: remaining === 0,
    label: `${formatNumber(used)} of ${formatNumber(included)} used`,
  }
}

/**
 * When an unreviewed delivery would be accepted on the buyer's behalf.
 *
 * **Display only.** Auto-acceptance is a scheduled job on the future Laravel
 * backend (contract §7 operation 6); nothing in the mock stack runs on a timer,
 * so this computes the date the job *would* fire and the screens say so plainly
 * rather than implying a countdown that is not running.
 *
 * @param {object} order an order record — read for `deliveredAt`
 * @param {number} [autoAcceptDays] `platformSettings.general.autoAcceptDays`
 * @returns {{at: string, date: string, relative: string}|null} `null` when the
 *   order has not been delivered or the setting has not loaded yet
 */
export function describeAutoAccept(order, autoAcceptDays) {
  const days = Number(autoAcceptDays)
  const delivered = order?.deliveredAt ? dayjs(order.deliveredAt) : null
  if (!Number.isFinite(days) || days <= 0 || !delivered?.isValid()) return null

  const at = delivered.add(days, 'day')
  return { at: at.toISOString(), date: formatDate(at.toISOString()), relative: formatRelativeTime(at.toISOString()) }
}

/**
 * Which of the buyer's order actions apply, given where the order is.
 *
 * The list card, the detail header, and the review panel all read this, so an
 * order can never be offered an action its status forbids — and the services
 * refuse it again on the way to the API regardless (00 §11).
 *
 * @param {object} order an order record
 * @param {object} [context]
 * @param {object|null} [context.review] the review already left on this order
 * @returns {{canPay: boolean, canReview: boolean, canRequestRevision: boolean,
 *   canLeaveReview: boolean}}
 */
export function orderActions(order, { review } = {}) {
  const status = order?.status
  const isDelivered = status === ORDER_STATUS.DELIVERED
  const { isExhausted } = describeRevisions(order)

  return {
    canPay: status === ORDER_STATUS.PENDING_PAYMENT,
    canReview: isDelivered,
    canRequestRevision: isDelivered && !isExhausted,
    canLeaveReview: status === ORDER_STATUS.COMPLETED && !review,
  }
}

/** `2.4 MB` / `47 MB` — deliverable file sizes, which arrive in kilobytes. */
export function formatFileSize(sizeKb) {
  const kb = Number(sizeKb)
  if (!Number.isFinite(kb) || kb <= 0) return EMPTY_PLACEHOLDER
  if (kb < 1024) return `${formatNumber(Math.round(kb))} KB`

  const mb = kb / 1024
  return `${formatNumber(mb, { maximumFractionDigits: mb < 10 ? 1 : 0 })} MB`
}
