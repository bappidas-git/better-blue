import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import KeyValueList from '@/components/data-display/KeyValueList'
import UserAvatar from '@/components/data-display/UserAvatar'
import SideSheet from '@/components/layout/SideSheet'
import { ROLE_META } from '@/constants/roles'
import AuditMetaView from '@/features/admin/audit/components/AuditMetaView'
import {
  getAuditVisual,
  humanizeAuditAction,
} from '@/features/admin/audit/utils/auditVocabulary'
import { EntityRefChip, getEntityMeta } from '@/features/admin/shared'
import { useLinkProps } from '@/hooks/useLinkProps'
import { paths } from '@/routes/paths'
import { formatDateTime, formatRelativeTime } from '@/utils/formatters'

// One audit entry, in full — Prompt 36 §4.4.
//
// The list answers "what happened"; this answers "and what exactly did it say".
// Three sections in the order an investigator reads them: **who**, **what it was
// about**, and **the detail** — with the raw entry id at the bottom, because
// that is what gets quoted in a ticket.
//
// A sheet rather than a route: an audit entry has no life of its own to link to
// and nothing to do on it, and reading twelve of them should not mean twelve
// back-navigations (00 §12).

/** The actor of a system-written entry — an id with no account behind it. */
const SYSTEM_ACTOR_LABEL = 'System'

/**
 * @param {object} props
 * @param {object|null} props.entry the audit entry, with `actorName` resolved
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {(actorId: string) => void} [props.onFilterByActor] "show everything
 *   this person did" — the one action the sheet offers, because it is the next
 *   question every entry raises
 */
export default function AuditDetailSheet({ entry, open, onClose, onFilterByActor }) {
  const visual = getAuditVisual(entry?.action)
  const actorLinkProps = useLinkProps(entry?.actorId ? paths.adminUserDetail(entry.actorId) : undefined)
  const entityMeta = entry?.entityType ? getEntityMeta(entry.entityType) : null

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title="Audit entry"
      description={entry ? formatDateTime(entry.createdAt) : undefined}
      width={480}
      actions={
        <Button onClick={onClose} variant="outlined" sx={{ minHeight: 44 }}>
          Close
        </Button>
      }
    >
      {!entry ? null : (
        <Stack spacing={3}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <Box
              aria-hidden="true"
              sx={{
                flexShrink: 0,
                width: 44,
                height: 44,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                bgcolor: (theme) => alpha(theme.palette[visual.tone].main, 0.12),
                color: `${visual.tone}.main`,
              }}
            >
              <Icon icon={visual.icon} width={22} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {(entry.actorName ?? SYSTEM_ACTOR_LABEL) + ' '}
                <Box component="span" sx={{ fontWeight: 400 }}>
                  {humanizeAuditAction(entry.action)}
                </Box>
              </Typography>
              <Chip
                label={entry.action}
                size="small"
                variant="outlined"
                sx={{ mt: 0.75, height: 24, fontFamily: 'monospace', fontSize: '0.7rem' }}
              />
            </Box>
          </Stack>

          <Divider />

          <Box>
            <Typography variant="overline" color="text.secondary">
              Who
            </Typography>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1 }}>
              <UserAvatar name={entry.actorName ?? SYSTEM_ACTOR_LABEL} size="md" />
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {entry.actorName ?? SYSTEM_ACTOR_LABEL}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {ROLE_META[entry.actorRole]?.label ?? entry.actorRole ?? 'Unknown role'}
                  {' · '}
                  {formatRelativeTime(entry.createdAt)}
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
              {entry.actorId ? (
                <Button
                  size="small"
                  variant="outlined"
                  {...actorLinkProps}
                  startIcon={<Icon icon="solar:user-linear" width={16} aria-hidden="true" />}
                  sx={{ minHeight: 36 }}
                >
                  Open account
                </Button>
              ) : null}
              {entry.actorId && onFilterByActor ? (
                <Button
                  size="small"
                  variant="text"
                  onClick={() => onFilterByActor(entry.actorId)}
                  startIcon={<Icon icon="solar:filter-linear" width={16} aria-hidden="true" />}
                  sx={{ minHeight: 36 }}
                >
                  Everything they did
                </Button>
              ) : null}
            </Stack>
          </Box>

          <Divider />

          <Box>
            <Typography variant="overline" color="text.secondary">
              What it was about
            </Typography>
            <Box sx={{ mt: 1 }}>
              {entry.entityType ? (
                <Stack spacing={1} alignItems="flex-start">
                  <EntityRefChip
                    type={entry.entityType}
                    id={entry.entityId}
                    showType
                    maxLabelLength={40}
                    size="md"
                  />
                  <Typography variant="caption" color="text.secondary">
                    {entityMeta?.label} · {entry.entityId ?? '—'}
                  </Typography>
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Not about a single record — this action changed something platform-wide.
                </Typography>
              )}
            </Box>
          </Box>

          <Divider />

          <Box>
            <Typography variant="overline" color="text.secondary">
              Detail
            </Typography>
            <Box sx={{ mt: 1 }}>
              <AuditMetaView meta={entry.meta} />
            </Box>
          </Box>

          <Divider />

          <KeyValueList
            dense
            labelWidth={110}
            items={[
              {
                label: 'Recorded',
                value: formatDateTime(entry.createdAt),
              },
              {
                label: 'Entry ID',
                value: (
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {entry.id}
                  </Typography>
                ),
              },
            ]}
          />

          <Typography variant="caption" color="text.secondary">
            Audit entries are append-only: nothing in BetterBlue edits or deletes one, at any
            permission level.
          </Typography>
        </Stack>
      )}
    </SideSheet>
  )
}
