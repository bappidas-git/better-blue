import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import dayjs from 'dayjs'

import { formatDateTime } from '@/utils/formatters'

// How long something has been waiting, tinted by how much that matters.
//
// The admin console's queues are ordered oldest-first, which tells a reviewer
// *what* to pick up but not *how bad it is*. This badge is the second half of
// that: a compact age with an SLA tone, so a wall of grey chips grows an amber
// one before it grows a red one.
//
// Deliberately not a `StatusChip`: an age is not a domain status, has no
// `STATUS_META` entry, and must never be mistaken for one (00 §9).

/** Age → chip colour. Thresholds are per-queue; these are the defaults. */
const TONE_COLORS = {
  neutral: 'default',
  warning: 'warning',
  error: 'error',
}

/**
 * Whole days between `from` and `to`, floored — "23 hours old" is still day 0,
 * which is what somebody reading a queue means by "today".
 */
function daysSince(from, to) {
  const start = dayjs(from)
  if (!start.isValid()) return null
  return Math.max(0, dayjs(to).diff(start, 'day'))
}

/** `0` → `today`, `1` → `1d`, `12` → `12d`. */
function compactAge(days) {
  return days === 0 ? 'today' : `${days}d`
}

/** The sentence a screen reader hears, and the tooltip a pointer reveals. */
function longAge(days, { overdue, noun }) {
  if (overdue) {
    return days === 0 ? `${noun} due today` : `${noun} ${days} ${days === 1 ? 'day' : 'days'} overdue`
  }
  if (days === 0) return `${noun} today`
  return `${noun} ${days} ${days === 1 ? 'day' : 'days'} ago`
}

/**
 * @param {object} props
 * @param {string} props.date ISO timestamp the age is measured from — when the
 *   case was raised, when the item was submitted, when delivery was due
 * @param {number} [props.warnAfterDays=3] days above which the badge turns amber
 * @param {number} [props.errorAfterDays=7] days above which it turns red
 * @param {boolean} [props.overdue=false] the date is a *deadline* rather than a
 *   start — changes the wording to "3 days overdue" and nothing else
 * @param {string} [props.noun='Waiting since'] how the long form opens, e.g.
 *   `'Submitted'`, `'Due'`
 * @param {Date|string} [props.now] injectable clock — the dev gallery uses it to
 *   show every tone at once
 * @param {'sm'|'md'} [props.size='sm'] chip size; admin queues use `sm`
 * @param {object} [props.sx] MUI system styles
 */
export default function AgeBadge({
  date,
  warnAfterDays = 3,
  errorAfterDays = 7,
  overdue = false,
  noun = 'Waiting since',
  now,
  size = 'sm',
  sx,
  ...rest
}) {
  const days = daysSince(date, now)
  if (days === null) return null

  const tone = days >= errorAfterDays ? 'error' : days >= warnAfterDays ? 'warning' : 'neutral'
  const long = longAge(days, { overdue, noun })

  return (
    <Tooltip title={`${long} · ${formatDateTime(date)}`}>
      <Chip
        // The compact label is for the eye; the accessible name is the sentence,
        // because "12d" read aloud is not information (§12).
        label={compactAge(days)}
        aria-label={long}
        color={TONE_COLORS[tone]}
        size={size === 'sm' ? 'small' : 'medium'}
        sx={{ fontWeight: 600, fontSize: '0.6875rem', ...sx }}
        {...rest}
      />
    </Tooltip>
  )
}
