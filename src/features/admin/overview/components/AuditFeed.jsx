import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import EmptyState from '@/components/feedback/EmptyState'
import ListSkeleton from '@/components/feedback/skeletons/ListSkeleton'
import { EntityRefChip } from '@/features/admin/shared'
import { formatRelativeTime } from '@/utils/formatters'

// What the team has been doing — the newest entries in the audit trail
// (contract §6.26), rendered in the same rhythm as `ActivityFeed`.
//
// Not `ActivityFeed` itself: that component renders *notification*-shaped rows
// and takes its icon and tone from `NOTIFICATION_META`, which has no entry for
// `payout.process` and should not grow one. An audit entry is a different
// record — actor, action, entity, time — so it gets a feed of the same shape
// and a vocabulary of its own.
//
// SECURITY: the trail is append-only and is never edited or deleted from any
// screen, at any permission level (00 §14, contract §6.26).

/**
 * Icon and tint per action *domain* — the part before the first dot. Keyed by
 * domain rather than by full action so a new verb in an existing domain
 * (`user.reactivate`, `payout.retry`) inherits a sensible look instead of
 * falling back, and `getAuditVisual` never returns undefined.
 */
const DOMAIN_VISUALS = Object.freeze({
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

/** Icon, palette key, and object noun for an action's domain — never `undefined`. */
function getAuditVisual(action) {
  return DOMAIN_VISUALS[String(action ?? '').split('.')[0]] ?? FALLBACK_VISUAL
}

/**
 * Whole actions the rule below cannot build a readable sentence for. Keyed by
 * the full action and used verbatim — no object is appended.
 */
const ACTION_PHRASES = Object.freeze({
  'payout.mark_paid': 'marked a settlement as paid',
  'moderation.request_changes': 'requested changes on submitted content',
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
 * `updated permissions`. A vocabulary that is dot-namespaced by design
 * (contract §6.26) reads badly on screen, so the verb is lifted out of the last
 * segment and past-tensed, and its object is whatever sits between the domain
 * and the verb — falling back to the domain's own noun when there is nothing.
 */
function humanizeAuditAction(action) {
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

function AuditRow({ entry, isLast }) {
  const visual = getAuditVisual(entry.action)

  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="flex-start"
      sx={{ py: 1.5, borderBottom: isLast ? 0 : 1, borderColor: 'divider' }}
    >
      <Box
        aria-hidden="true"
        sx={{
          flexShrink: 0,
          width: 32,
          height: 32,
          borderRadius: 1.5,
          display: 'grid',
          placeItems: 'center',
          bgcolor: (theme) => alpha(theme.palette[visual.tone].main, 0.12),
          color: `${visual.tone}.main`,
        }}
      >
        <Icon icon={visual.icon} width={17} />
      </Box>

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="baseline">
          <Typography variant="body2" sx={{ flexGrow: 1, minWidth: 0 }}>
            <Box component="span" sx={{ fontWeight: 600 }}>
              {entry.actorName ?? 'A team member'}
            </Box>{' '}
            {humanizeAuditAction(entry.action)}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ flexShrink: 0 }}>
            {formatRelativeTime(entry.createdAt)}
          </Typography>
        </Stack>

        {entry.entityType ? (
          <Box sx={{ mt: 0.75 }}>
            <EntityRefChip type={entry.entityType} id={entry.entityId} showType />
          </Box>
        ) : null}
      </Box>
    </Stack>
  )
}

/**
 * @param {object} props
 * @param {Array<object>} [props.items] audit entries from
 *   `adminService.getRecentAuditActivity`, newest first
 * @param {boolean} [props.loading=false]
 */
export default function AuditFeed({ items = [], loading = false }) {
  if (loading) return <ListSkeleton rows={5} label="Loading recent admin activity" />

  if (items.length === 0) {
    return (
      <EmptyState
        dense
        icon="solar:history-linear"
        title="No admin activity yet"
        description="Suspensions, moderation decisions, refunds, and settlements are recorded here as they happen."
        sx={{ py: 3 }}
      />
    )
  }

  return (
    <Box>
      {items.map((entry, index) => (
        <AuditRow key={entry.id} entry={entry} isLast={index === items.length - 1} />
      ))}
    </Box>
  )
}
