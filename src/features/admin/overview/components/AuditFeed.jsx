import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import EmptyState from '@/components/feedback/EmptyState'
import ListSkeleton from '@/components/feedback/skeletons/ListSkeleton'
import {
  getAuditVisual,
  humanizeAuditAction,
} from '@/features/admin/audit/utils/auditVocabulary'
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
//
// Prompt 36 moved the icon/tone table and the past-tense rule this file used to
// carry into `features/admin/audit/utils/auditVocabulary.js`, so this card and
// the full audit explorer read every entry the same way.

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
