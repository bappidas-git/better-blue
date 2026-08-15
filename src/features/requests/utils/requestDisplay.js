import dayjs from 'dayjs'

import { BUDGET_TYPE, REQUEST_STATUS } from '@/constants/statuses'
import { EMPTY_PLACEHOLDER, formatCurrency, formatDate, formatRelativeTime } from '@/utils/formatters'

// Display strings a brief is rendered with in more than one place — the list
// card, the detail header, and the compare dialog all say "budget" and
// "deadline" the same way, so they say it from here (00 §8: money and dates are
// formatted only through `utils/formatters`, and this builds on those).

/**
 * `$600 – $900` for a range, `$820` for a fixed price.
 *
 * A fixed brief stores `budgetMin === budgetMax` (contract §6.7), so the type
 * — not a comparison of the two numbers — decides which form is shown.
 *
 * @param {object} request a brief record
 * @returns {string} the em-dash placeholder while a draft has no budget yet
 */
export function formatBudget(request) {
  const { budgetType, budgetMin, budgetMax, currency } = request ?? {}
  if (budgetMin === null || budgetMin === undefined || budgetMin === '') return EMPTY_PLACEHOLDER

  const min = formatCurrency(budgetMin, currency, { hideDecimals: true })
  if (budgetType !== BUDGET_TYPE.RANGE || budgetMax == null) return min

  return `${min} – ${formatCurrency(budgetMax, currency, { hideDecimals: true })}`
}

/** Statuses where a deadline is still something to act on rather than history. */
const LIVE_STATUSES = [REQUEST_STATUS.DRAFT, REQUEST_STATUS.OPEN, REQUEST_STATUS.AWARDED]

/** A deadline inside this many days reads as urgent rather than merely upcoming. */
const SOON_DAYS = 3

/**
 * How a brief's deadline should read and feel.
 *
 * Tone is only ever raised on a brief that is still live: a completed brief
 * whose deadline has passed is simply history, and painting it red would be
 * alarming about nothing.
 *
 * @param {object} request a brief record
 * @returns {{date: string, relative: string, tone: 'text.secondary'|'warning.main'|'error.main',
 *   isOverdue: boolean, label: string}}
 */
export function describeDeadline(request) {
  const value = request?.deadline
  const parsed = value ? dayjs(value) : null
  const isLive = LIVE_STATUSES.includes(request?.status)

  if (!parsed?.isValid()) {
    return {
      date: EMPTY_PLACEHOLDER,
      relative: '',
      tone: 'text.secondary',
      isOverdue: false,
      label: 'No deadline set',
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
    // What a screen reader hears in one go, rather than a date and a fragment.
    label: isOverdue ? `Deadline passed ${relative}, on ${date}` : `Deadline ${relative}, on ${date}`,
  }
}

/**
 * Which of the five request actions apply, given where a brief is in its life
 * (§5, state-dependent action availability).
 *
 * The kebab menu, the detail page's header buttons, and `useRequestActions` all
 * read this, so a brief can never be offered an action its status forbids —
 * and `requestService` refuses it again on the way to the API regardless.
 *
 * @param {object} request a brief record
 * @returns {{canEdit: boolean, canPublish: boolean, canDiscard: boolean,
 *   canClose: boolean, canCancel: boolean}}
 */
export function requestActions(request) {
  const status = request?.status

  return {
    canEdit: status === REQUEST_STATUS.DRAFT,
    canPublish: status === REQUEST_STATUS.DRAFT,
    canDiscard: status === REQUEST_STATUS.DRAFT,
    canClose: status === REQUEST_STATUS.OPEN,
    canCancel: status === REQUEST_STATUS.OPEN,
  }
}

/** `20 photos`, `3 videos`, `1 bundle` — the deliverable line, pluralised. */
export function formatQuantity(request, contentTypeLabel) {
  const quantity = Number(request?.quantity)
  const noun = String(contentTypeLabel ?? 'deliverable').toLowerCase()
  if (!Number.isFinite(quantity) || quantity < 1) return contentTypeLabel ?? EMPTY_PLACEHOLDER
  return `${quantity} ${quantity === 1 ? noun : `${noun}s`}`
}
