// How an audit entry reads on screen — the console's shared vocabulary for the
// trail (contract §6.26).
//
// Prompt 28 wrote the first half of this inside `overview/components/AuditFeed`,
// because the overview card was the only screen rendering audit rows. Prompt 36
// added the explorer, which needs exactly the same three answers — what icon, in
// what tone, and what did this person *do* — so the logic moved here and the
// feed imports it. There is one humanised spelling of `payout.mark_paid` in the
// product, not two that drift.
//
// The action vocabulary is open by design: every prompt adds verbs to
// `constants/auditActions.js`, and nothing here may return `undefined` for one
// it has never seen. Every function below is total.

import { auditNamespace, AUDIT_ACTION } from '@/constants/auditActions'
import { STATUS_META } from '@/constants/statuses'
import { EMPTY_PLACEHOLDER, formatNumber, truncate } from '@/utils/formatters'

/**
 * Icon, tint, and object noun per action *namespace*. Keyed by namespace rather
 * than by full action so a new verb in an existing family (`user.reactivate`,
 * `payout.retry`) inherits a sensible look instead of falling back.
 */
const NAMESPACE_VISUALS = Object.freeze({
  admin: { icon: 'solar:shield-user-linear', tone: 'primary', noun: 'an admin account' },
  user: { icon: 'solar:user-linear', tone: 'primary', noun: 'a member' },
  creator: { icon: 'solar:user-id-linear', tone: 'primary', noun: 'a creator' },
  moderation: { icon: 'tabler:shield-check', tone: 'warning', noun: 'submitted content' },
  content: { icon: 'solar:gallery-linear', tone: 'warning', noun: 'published content' },
  report: { icon: 'solar:flag-linear', tone: 'warning', noun: 'a report' },
  dispute: { icon: 'solar:shield-warning-linear', tone: 'error', noun: 'a dispute' },
  payment: { icon: 'solar:card-linear', tone: 'info', noun: 'a payment' },
  payout: { icon: 'solar:wallet-money-linear', tone: 'success', noun: 'a settlement' },
  affiliate: { icon: 'solar:users-group-rounded-linear', tone: 'success', noun: 'an affiliate' },
  order: { icon: 'solar:box-linear', tone: 'info', noun: 'an order' },
  request: { icon: 'solar:clipboard-list-linear', tone: 'info', noun: 'a request' },
  category: { icon: 'solar:widget-4-linear', tone: 'primary', noun: 'a category' },
  settings: { icon: 'solar:settings-linear', tone: 'primary', noun: 'platform settings' },
  announcement: { icon: 'solar:megaphone-linear', tone: 'primary', noun: 'an announcement' },
  ticket: { icon: 'solar:chat-round-line-linear', tone: 'info', noun: 'a support ticket' },
})

const FALLBACK_VISUAL = Object.freeze({
  icon: 'solar:history-linear',
  tone: 'primary',
  noun: 'a record',
})

/** Icon, palette key, and object noun for an action's namespace — never `undefined`. */
export function getAuditVisual(action) {
  return NAMESPACE_VISUALS[auditNamespace(action)] ?? FALLBACK_VISUAL
}

/**
 * Whole actions the rule below cannot build a readable sentence for. Keyed by
 * the full action and used verbatim — no object is appended.
 */
const ACTION_PHRASES = Object.freeze({
  [AUDIT_ACTION.PAYOUT_MARK_PAID]: 'marked a settlement as paid',
  [AUDIT_ACTION.MODERATION_REQUEST_CHANGES]: 'requested changes on submitted content',
  [AUDIT_ACTION.MODERATION_CLAIM]: 'picked up a review case',
  [AUDIT_ACTION.MODERATION_OPEN]: 'opened a review case',
  [AUDIT_ACTION.DISPUTE_REQUEST_INFO]: 'requested information on a dispute',
  [AUDIT_ACTION.ADMIN_PERMISSIONS_UPDATE]: 'changed an admin’s permissions',
  [AUDIT_ACTION.ADMIN_SUSPEND]: 'suspended an admin account',
  [AUDIT_ACTION.ADMIN_REACTIVATE]: 'reinstated an admin account',
  [AUDIT_ACTION.ORDER_NOTE]: 'left an internal note on an order',
  [AUDIT_ACTION.USER_DEACTIVATE]: 'closed their own account',
})

/**
 * Verbs the mechanical past tense gets wrong. Add to this only when the rule
 * produces something embarrassing; the regular cases (`approve`, `suspend`,
 * `verify`, `process`, …) belong to the rule, because the action vocabulary is
 * open and every later prompt adds to it.
 */
const IRREGULAR_VERBS = Object.freeze({
  send: 'sent',
  reply: 'replied to',
})

/**
 * `report.dismiss` → `dismissed a report`, `admin.permissions.update` →
 * `changed an admin’s permissions`. A vocabulary that is dot-namespaced by
 * design reads badly on screen, so the verb is lifted out of the last segment
 * and past-tensed, and its object is whatever sits between the namespace and the
 * verb — falling back to the namespace's own noun when there is nothing.
 *
 * @param {string} action e.g. `'payout.process'`
 * @returns {string} a past-tense phrase, never empty
 */
export function humanizeAuditAction(action) {
  if (ACTION_PHRASES[action]) return ACTION_PHRASES[action]

  const segments = String(action ?? '').split('.').filter(Boolean)
  if (segments.length === 0) return 'acted'

  const raw = segments[segments.length - 1]
  const middle = segments.slice(1, -1).join(' ').replace(/_/g, ' ')

  // "process" → "processed", "approve" → "approved", "verify" → "verified".
  const verb = raw.replace(/_/g, ' ')
  const past =
    IRREGULAR_VERBS[raw] ??
    (/e$/.test(verb)
      ? `${verb}d`
      : /[^aeiou]y$/.test(verb)
        ? `${verb.slice(0, -1)}ied`
        : `${verb}ed`)

  return `${past} ${middle || getAuditVisual(action).noun}`
}

/** `snake_case` → `Snake case`, for a meta key or an enum token with no label. */
export function humanizeToken(value) {
  const text = String(value ?? '').replace(/[_.]/g, ' ').trim()
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : EMPTY_PLACEHOLDER
}

/** `fromStatus` → `From status`. camelCase and snake_case both read properly. */
export function humanizeMetaKey(key) {
  const spaced = String(key ?? '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_.]/g, ' ')
    .trim()
    .toLowerCase()
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : EMPTY_PLACEHOLDER
}

/** A status token as its `STATUS_META` label, or humanised if it is not one. */
export function statusLabel(value) {
  return STATUS_META[value]?.label ?? humanizeToken(value)
}

/** Is this something we can print on one line as-is? */
const isScalar = (value) =>
  value === null ||
  ['string', 'number', 'boolean', 'undefined'].includes(typeof value)

/**
 * Meta keys that are plumbing rather than detail — already shown as their own
 * column, or too long to belong in a one-line summary.
 */
const SUMMARY_SKIP_KEYS = new Set(['permissions', 'from', 'to', 'changes', 'usage'])

/**
 * **One readable line per entry**, built from whatever `meta` happens to hold.
 *
 * The list is the place an investigator scans, so a row must never print raw
 * JSON at it (§12) — and must never crash on a shape no prompt anticipated
 * (§13). Every branch below is defensive: an unexpected object, a `null`, an
 * array of objects, and a missing `meta` all produce a sentence or nothing.
 *
 * @param {object} [entry] an audit entry
 * @returns {string} a summary, or `''` when there is genuinely nothing to say
 */
export function summarizeAuditMeta(entry) {
  const meta = entry?.meta
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return ''

  const parts = []

  if (meta.fromStatus || meta.toStatus) {
    parts.push(
      meta.fromStatus && meta.toStatus
        ? `${statusLabel(meta.fromStatus)} → ${statusLabel(meta.toStatus)}`
        : statusLabel(meta.toStatus ?? meta.fromStatus)
    )
  }

  const added = Array.isArray(meta.added) ? meta.added.length : 0
  const removed = Array.isArray(meta.removed) ? meta.removed.length : 0
  if (added > 0) parts.push(`${added} granted`)
  if (removed > 0) parts.push(`${removed} revoked`)

  if (Array.isArray(meta.changes) && meta.changes.length > 0) {
    parts.push(`${meta.changes.length} field${meta.changes.length === 1 ? '' : 's'} changed`)
  }

  if (typeof meta.amount === 'number') parts.push(`${formatNumber(meta.amount)}`)
  if (typeof meta.amountRefunded === 'number') {
    parts.push(`${formatNumber(meta.amountRefunded)} refunded`)
  }
  if (typeof meta.recipients === 'number') parts.push(`${formatNumber(meta.recipients)} recipients`)
  if (typeof meta.permissionCount === 'number') {
    parts.push(`${meta.permissionCount} permission${meta.permissionCount === 1 ? '' : 's'}`)
  }

  if (typeof meta.outcome === 'string') parts.push(humanizeToken(meta.outcome))
  if (typeof meta.reasonCode === 'string') parts.push(humanizeToken(meta.reasonCode))

  const note = [meta.reason, meta.note, meta.outcomeNote].find(
    (value) => typeof value === 'string' && value.trim()
  )
  if (note) parts.push(`“${truncate(note.trim(), 90)}”`)

  if (parts.length === 0) {
    // Nothing recognised: fall back to the first couple of printable pairs, so
    // an entry written by a future prompt still says something.
    Object.entries(meta)
      .filter(([key, value]) => !SUMMARY_SKIP_KEYS.has(key) && isScalar(value) && value !== null && value !== '')
      .slice(0, 2)
      .forEach(([key, value]) => {
        const printed = typeof value === 'boolean' ? (value ? 'yes' : 'no') : String(value)
        parts.push(`${humanizeMetaKey(key)}: ${truncate(printed, 40)}`)
      })
  }

  return parts.join(' · ')
}
