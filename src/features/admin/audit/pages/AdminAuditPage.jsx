import { useCallback, useMemo, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import UserAvatar from '@/components/data-display/UserAvatar'
import { useToast } from '@/components/feedback/ToastProvider'
import DataTable from '@/components/table/DataTable'
import { PERMISSIONS } from '@/constants/permissions'
import { ROLE_META } from '@/constants/roles'
import AuditDetailSheet from '@/features/admin/audit/components/AuditDetailSheet'
import AuditFilters from '@/features/admin/audit/components/AuditFilters'
import {
  AUDIT_EXPORT_COLUMNS,
  AUDIT_EXPORT_LIMIT,
  AUDIT_PAGE_SIZE,
  AUDIT_PARAMS,
  auditQueryFrom,
} from '@/features/admin/audit/utils/auditFilters'
import {
  getAuditVisual,
  humanizeAuditAction,
  summarizeAuditMeta,
} from '@/features/admin/audit/utils/auditVocabulary'
import { AdminPageGuard, EntityRefChip } from '@/features/admin/shared'
import useApiQuery from '@/hooks/useApiQuery'
import useListParams from '@/hooks/useListParams'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { PermissionGate } from '@/routes/guards'
import { adminService } from '@/services/adminService'
import { adminTeamService } from '@/services/adminTeamService'
import { exportRowsAsCsv } from '@/utils/exportCsv'
import { formatDateTime, formatRelativeTime } from '@/utils/formatters'

// `/admin/audit-logs` — the audit explorer (Prompt 36 §4.4).
//
// Every admin action since Prompt 29 has been writing to `auditLogs`; this is
// the screen that makes the trail answerable. It is built for one job —
// **investigating** — which is why it looks denser than the rest of the console:
// fifty rows a page, filters that narrow rather than browse, and every entity a
// link back to the screen that owns it.
//
// Three rules it keeps:
//
//   1. **Never raw JSON in the list.** Each row gets a sentence built from its
//      `meta` (`summarizeAuditMeta`); the full object is one tap away in the
//      sheet (§12). A list of `{"fromStatus":"open"…}` is not readable, and an
//      investigator reads hundreds of these.
//   2. **Never a crash on an odd shape.** `meta` is schemaless by design, so
//      every renderer here is total — see `AuditMetaView` (§13).
//   3. **Read-only, at every permission level.** There is no edit affordance and
//      no delete, because there is no such endpoint: the trail is append-only
//      (contract §6.26) and `auditService` has no write path but `log`.

/** A system-written entry — no account behind the actor id. */
const SYSTEM_ACTOR = 'System'

export default function AdminAuditPage() {
  const toast = useToast()

  const { values, setValue, setValues, clearFilters, isFiltered } = useListParams(AUDIT_PARAMS)
  const { page } = values

  const [selected, setSelected] = useState(null)
  const [exporting, setExporting] = useState(false)

  // The one object the table and the export are both driven by, so an exported
  // file can never hold a different set of entries than the screen showed.
  const query = useMemo(() => auditQueryFrom(values), [values])

  const { data, isLoading, error, refetch } = useApiQuery(
    () => adminService.listAuditEntries({ ...query, page, limit: AUDIT_PAGE_SIZE }),
    [query, page]
  )

  // The actor filter's options. Loaded once and allowed to fail quietly: a
  // filter that cannot be populated should leave the select empty, not take the
  // trail down with it.
  const { data: team } = useApiQuery(
    () => adminTeamService.listAdmins().catch(() => ({ items: [] })),
    []
  )

  const actorOptions = useMemo(
    () =>
      (team?.items ?? []).map((member) => ({
        value: member.id,
        label: `${member.name} · ${ROLE_META[member.role]?.label ?? member.role}`,
      })),
    [team]
  )

  const rows = useMemo(() => data?.items ?? [], [data])

  const filterByActor = useCallback(
    (actorId) => {
      setValue('actor', actorId)
      setSelected(null)
    },
    [setValue]
  )

  const exportCsv = useCallback(async () => {
    setExporting(true)
    try {
      const all = await adminService.listAuditEntries({
        ...query,
        page: 1,
        limit: AUDIT_EXPORT_LIMIT,
      })

      if (all.items.length === 0) {
        toast.info('There is nothing to export in this view.')
        return
      }

      if (!exportRowsAsCsv('betterblue-audit-log', AUDIT_EXPORT_COLUMNS, all.items)) {
        toast.error('We could not build the file. Try again in a moment.')
        return
      }

      toast.success(`Exported ${all.items.length} entries.`, {
        description:
          all.total > all.items.length
            ? `Your filters match ${all.total} entries; the export is capped at ${AUDIT_EXPORT_LIMIT}. Narrow the date range to get the rest.`
            : undefined,
      })
    } catch (failure) {
      toast.error(failure?.message ?? 'We could not export the trail.')
    } finally {
      setExporting(false)
    }
  }, [query, toast])

  /* -- cells --------------------------------------------------------------- */

  const timeCell = (entry) => (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
        {formatRelativeTime(entry.createdAt)}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
        {formatDateTime(entry.createdAt)}
      </Typography>
    </Box>
  )

  const actorCell = (entry) => (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
      <UserAvatar name={entry.actorName ?? SYSTEM_ACTOR} size="xs" />
      <Box sx={{ minWidth: 0 }}>
        {entry.actorName ? (
          <EntityRefChip type="user" id={entry.actorId} label={entry.actorName} />
        ) : (
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {SYSTEM_ACTOR}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary" component="p">
          {ROLE_META[entry.actorRole]?.label ?? entry.actorRole ?? 'Automated'}
        </Typography>
      </Box>
    </Stack>
  )

  const actionCell = (entry) => {
    const visual = getAuditVisual(entry.action)
    return (
      <Chip
        icon={<Icon icon={visual.icon} width={15} aria-hidden="true" />}
        label={entry.action}
        size="small"
        variant="outlined"
        sx={{
          height: 26,
          fontFamily: 'monospace',
          fontSize: '0.7rem',
          borderColor: (theme) => alpha(theme.palette[visual.tone].main, 0.4),
          color: `${visual.tone}.dark`,
          '& .MuiChip-icon': { color: `${visual.tone}.main`, ml: 0.75 },
        }}
      />
    )
  }

  const entityCell = (entry) =>
    entry.entityType ? (
      <EntityRefChip type={entry.entityType} id={entry.entityId} showType maxLabelLength={22} />
    ) : (
      <Typography variant="caption" color="text.disabled">
        Platform-wide
      </Typography>
    )

  const summaryCell = (entry) => {
    const summary = summarizeAuditMeta(entry)
    return (
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2">{humanizeAuditAction(entry.action)}</Typography>
        {summary ? (
          <Typography variant="caption" color="text.secondary" component="p">
            {summary}
          </Typography>
        ) : null}
      </Box>
    )
  }

  const columns = [
    { key: 'createdAt', label: 'When', width: 170, render: timeCell },
    { key: 'actorId', label: 'Actor', width: 200, render: actorCell },
    { key: 'action', label: 'Action', width: 210, render: actionCell },
    { key: 'entityId', label: 'Entity', width: 200, render: entityCell },
    { key: 'meta', label: 'Summary', render: summaryCell },
  ]

  const renderMobileCard = (entry) => (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="flex-start">
        {actionCell(entry)}
        <Typography variant="caption" color="text.secondary" noWrap>
          {formatRelativeTime(entry.createdAt)}
        </Typography>
      </Stack>

      <Box sx={{ mt: 1.5 }}>{summaryCell(entry)}</Box>

      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="space-between"
        sx={{ mt: 1.5, flexWrap: 'wrap' }}
        useFlexGap
      >
        {actorCell(entry)}
        {entityCell(entry)}
      </Stack>
    </Card>
  )

  const emptyState = isFiltered
    ? {
        icon: 'tabler:search-off',
        title: 'No entries match those filters',
        description:
          'Try a wider date range, another action area, or clear the entity ID — an entry is only recorded when an admin actually did something.',
        primaryAction: { label: 'Clear filters', onClick: () => clearFilters(), variant: 'outlined' },
      }
    : {
        icon: 'solar:history-linear',
        title: 'Nothing recorded yet',
        description:
          'Suspensions, moderation decisions, refunds, settlements, and configuration changes appear here as they happen.',
      }

  return (
    <DashboardPage
      title="Audit log"
      subtitle="Every administrative action on BetterBlue, in the order it happened."
      maxWidth={false}
      actions={
        <PermissionGate permission={PERMISSIONS.AUDIT_VIEW}>
          <Button
            variant="outlined"
            onClick={exportCsv}
            disabled={exporting || isLoading}
            startIcon={
              <Icon icon="solar:download-minimalistic-linear" width={18} aria-hidden="true" />
            }
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        </PermissionGate>
      }
    >
      <AdminPageGuard permission={PERMISSIONS.AUDIT_VIEW}>
        <Stack spacing={{ xs: 2, md: 2.5 }}>
          <AuditFilters
            values={values}
            onChange={setValue}
            onClear={clearFilters}
            isFiltered={isFiltered}
            actorOptions={actorOptions}
            actorsLoading={!team}
          />

          <DataTable
            columns={columns}
            rows={rows}
            loading={isLoading}
            error={error}
            onRetry={refetch}
            emptyState={emptyState}
            onRowClick={setSelected}
            renderMobileCard={renderMobileCard}
            ariaLabel="Audit log entries"
            pagination={{
              page,
              pageSize: AUDIT_PAGE_SIZE,
              total: data?.total ?? 0,
              onPageChange: (next) => setValues({ page: next }),
              itemLabel: 'entries',
            }}
          />

          <Card variant="outlined" sx={{ bgcolor: 'background.default' }}>
            <CardContent sx={{ p: { xs: 2, md: 2.5 }, '&:last-child': { pb: { xs: 2, md: 2.5 } } }}>
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Box aria-hidden="true" sx={{ color: 'text.secondary', mt: 0.25 }}>
                  <Icon icon="solar:shield-check-linear" width={20} />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Retention and immutability
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Entries are written once and never edited or deleted — there is no update path
                    in the product, at any permission level. This prototype keeps the whole trail
                    indefinitely; the production API applies a retention policy (entries archived
                    monthly, kept for the statutory period, then purged in bulk by a scheduled job
                    rather than by anybody using this screen).
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Stack>

        <AuditDetailSheet
          entry={selected}
          open={Boolean(selected)}
          onClose={() => setSelected(null)}
          onFilterByActor={filterByActor}
        />
      </AdminPageGuard>
    </DashboardPage>
  )
}
