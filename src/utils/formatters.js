// Display formatters — prompts/00-architecture-and-rules.md §8.
//
// Money is stored as decimal numbers with a `currency` field and dates as ISO
// 8601 strings; both are formatted *only* here so the product reads
// consistently everywhere. Locale is pinned to `en-US` so output is
// deterministic regardless of the visitor's browser settings.

import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime.js'

dayjs.extend(relativeTime)

const LOCALE = 'en-US'

/** Shown wherever a value is missing — em dash keeps tables aligned. */
export const EMPTY_PLACEHOLDER = '—'

export const DATE_FORMAT = 'MMM D, YYYY'
export const DATE_TIME_FORMAT = 'MMM D, YYYY · h:mm A'

const isFiniteNumber = (value) =>
  value !== null && value !== '' && Number.isFinite(Number(value))

/**
 * `formatCurrency(1250)` → `$1,250.00`.
 * @param {number} amount
 * @param {string} [currency='USD'] ISO 4217 code
 * @param {{ compact?: boolean, hideDecimals?: boolean }} [options]
 *   `compact` → `$1.3K` (chart axes, dense stats); `hideDecimals` → `$1,250`.
 */
export function formatCurrency(amount, currency = 'USD', options = {}) {
  if (!isFiniteNumber(amount)) return EMPTY_PLACEHOLDER
  const { compact = false, hideDecimals = false } = options
  const fractionDigits = compact || hideDecimals ? 0 : 2

  try {
    return new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency: currency || 'USD',
      notation: compact ? 'compact' : 'standard',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: compact ? 1 : fractionDigits,
    }).format(Number(amount))
  } catch {
    // Unknown currency code — fall back to a plain number plus the code.
    return `${formatNumber(amount)} ${currency}`
  }
}

/** `formatNumber(1250)` → `1,250`. */
export function formatNumber(value, options = {}) {
  if (!isFiniteNumber(value)) return EMPTY_PLACEHOLDER
  return new Intl.NumberFormat(LOCALE, options).format(Number(value))
}

/** `formatNumberCompact(12500)` → `12.5K`. */
export function formatNumberCompact(value) {
  if (!isFiniteNumber(value)) return EMPTY_PLACEHOLDER
  return new Intl.NumberFormat(LOCALE, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(value))
}

/**
 * `formatPercent(0.2)` → `20%`. Takes a 0–1 fraction, matching how rates are
 * stored (`platformSettings.commission.defaultRate = 0.2`).
 */
export function formatPercent(fraction, options = {}) {
  if (!isFiniteNumber(fraction)) return EMPTY_PLACEHOLDER
  const { maximumFractionDigits = 1, minimumFractionDigits = 0 } = options
  return new Intl.NumberFormat(LOCALE, {
    style: 'percent',
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(Number(fraction))
}

/** `formatDate('2026-03-04T10:00:00Z')` → `Mar 4, 2026`. */
export function formatDate(value, format = DATE_FORMAT) {
  const date = dayjs(value)
  return value && date.isValid() ? date.format(format) : EMPTY_PLACEHOLDER
}

/** `formatDateTime(iso)` → `Mar 4, 2026 · 10:00 AM`. */
export function formatDateTime(value, format = DATE_TIME_FORMAT) {
  return formatDate(value, format)
}

/** `formatRelativeTime(iso)` → `3 hours ago` / `in 2 days`. */
export function formatRelativeTime(value) {
  const date = dayjs(value)
  return value && date.isValid() ? date.fromNow() : EMPTY_PLACEHOLDER
}

/** Trims to `maxLength` on a word boundary and appends an ellipsis. */
export function truncate(text, maxLength = 120, suffix = '…') {
  const value = String(text ?? '')
  if (value.length <= maxLength) return value

  const clipped = value.slice(0, maxLength)
  const trimmed = clipped.trimEnd()

  // The cut already landed on a word boundary — keep every whole word.
  if (trimmed.length < clipped.length || /\s/.test(value.charAt(maxLength))) {
    return `${trimmed}${suffix}`
  }

  const lastSpace = trimmed.lastIndexOf(' ')
  const body = lastSpace > maxLength * 0.6 ? trimmed.slice(0, lastSpace) : trimmed
  return `${body.trimEnd()}${suffix}`
}
