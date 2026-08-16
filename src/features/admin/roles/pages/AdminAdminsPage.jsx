import { useCallback, useMemo, useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Link from '@mui/material/Link'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { visuallyHidden } from '@mui/utils'
import { Link as RouterLink } from 'react-router-dom'

import StatusChip from '@/components/data-display/StatusChip'
import UserAvatar from '@/components/data-display/UserAvatar'
import { useConfirm } from '@/components/feedback/ConfirmDialogProvider'
import { useToast } from '@/components/feedback/ToastProvider'
import DataTable from '@/components/table/DataTable'
import { PERMISSIONS } from '@/constants/permissions'
import { ROLES, ROLE_META } from '@/constants/roles'
import { ACCOUNT_STATUS } from '@/constants/statuses'
import { useAuth } from '@/context/AuthContext'
import CreateAdminDialog from '@/features/admin/roles/components/CreateAdminDialog'
import EditPermissionsDialog from '@/features/admin/roles/components/EditPermissionsDialog'
import PermissionSummary from '@/features/admin/roles/components/PermissionSummary'
import TempPasswordDialog from '@/features/admin/roles/components/TempPasswordDialog'
import { AdminPageGuard } from '@/features/admin/shared'
import useApiQuery from '@/hooks/useApiQuery'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { paths } from '@/routes/paths'
import {
  adminTeamService,
  canManageAdmin,
  TEAM_REASON_MIN_LENGTH,
} from '@/services/adminTeamService'
import { EMPTY_PLACEHOLDER, formatNumber, formatRelativeTime } from '@/utils/formatters'

// `/admin/admins` — the admin team (Prompt 36 §4.2).
//
// The console's only screen that changes what other people can do, which is why
// it is the strictest one: super admins only at the route (`SuperAdminRoute`),
// `admins.manage` at the page, and — the part that matters — **every rule
// re-checked in `adminTeamService` before it writes**. What this screen hides is
// a convenience for the reader, never the protection (00 §11).
//
// The two figures beside each account answer the question a team lead actually
// opens this for: is this account still in use? "Last active" and "actions this
// month" together say whether somebody has left without telling anybody — which
// is the moment to suspend, not delete: their audit trail is why we keep the
// record forever.

/** Rows read as cards below md; this is the desktop density. */
const AVATAR_SIZE = 'md'

export default function AdminAdminsPage() {
  const { user: actor } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [created, setCreated] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const { data, isLoading, error, refetch } = useApiQuery(() => adminTeamService.listAdmins(), [])

  const rows = useMemo(() => data?.items ?? [], [data])

  /* -- create -------------------------------------------------------------- */

  const createAdmin = useCallback(
    async (values) => {
      try {
        const result = await adminTeamService.createAdmin({ ...values, actor })
        setCreateOpen(false)
        // The password is in this result and nowhere else — hand it straight to
        // the dialog that shows it once (see `TempPasswordDialog`).
        setCreated(result)
        refetch()
      } catch (failure) {
        toast.error(failure?.message ?? 'We could not create that admin.')
        // Rethrown so the dialog stays open with everything typed still in it,
        // and a duplicate address lands under its own field.
        throw failure
      }
    },
    [actor, refetch, toast]
  )

  /* -- permissions --------------------------------------------------------- */

  const savePermissions = useCallback(
    async (permissions) => {
      const target = editing
      try {
        await adminTeamService.updateAdminPermissions(target.id, { permissions, actor })
        toast.success(`${target.name}’s permissions saved.`, {
          description:
            'It takes effect the next time they sign in or their session revalidates, and the change is in the audit trail.',
        })
        setEditing(null)
        refetch()
      } catch (failure) {
        toast.error(failure?.message ?? 'We could not save those permissions.')
      }
    },
    [actor, editing, refetch, toast]
  )

  /* -- suspend / reactivate ------------------------------------------------ */

  const setStatus = useCallback(
    async (member, status) => {
      const suspending = status === ACCOUNT_STATUS.SUSPENDED

      const result = await confirm({
        title: suspending ? `Suspend ${member.name}?` : `Reinstate ${member.name}?`,
        message: suspending
          ? `They lose access to the admin console — immediately at sign-in, and on their next session revalidation if they are signed in now. Everything they have done stays exactly as it is: their name on every decision, their permissions ready for the day they come back. Accounts are never deleted.`
          : `They can sign in to the console again with the permissions they had before. Nothing about their previous access was removed while they were suspended.`,
        confirmLabel: suspending ? 'Suspend access' : 'Reinstate access',
        tone: suspending ? 'danger' : 'primary',
        requireReason: suspending,
        allowReason: !suspending,
        reasonLabel: 'Reason',
        reasonHelperText: suspending
          ? `At least ${TEAM_REASON_MIN_LENGTH} characters. They read this, and so does the next super admin who opens the account.`
          : 'Optional note, recorded on the audit entry.',
      })
      if (!result) return

      setBusyId(member.id)
      try {
        await adminTeamService.setAdminStatus(member.id, {
          status,
          reason: result.reason,
          actor,
        })
        toast.success(
          suspending ? `${member.name} has been suspended.` : `${member.name} is active again.`,
          { description: 'They have been notified, and the change is in the audit trail.' }
        )
        refetch()
      } catch (failure) {
        toast.error(failure?.message ?? 'We could not change that account.')
      } finally {
        setBusyId(null)
      }
    },
    [actor, confirm, refetch, toast]
  )

  /* -- cells --------------------------------------------------------------- */

  const personCell = (member) => (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
      <UserAvatar name={member.name} src={member.avatarUrl} size={AVATAR_SIZE} />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {member.name}
          {member.id === actor?.id ? (
            <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>
              {' '}
              · you
            </Box>
          ) : null}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
          {member.email}
        </Typography>
      </Box>
    </Stack>
  )

  const roleCell = (member) => (
    <Chip
      icon={
        <Icon
          icon={
            member.role === ROLES.SUPER_ADMIN
              ? 'solar:crown-linear'
              : 'solar:shield-user-linear'
          }
          width={14}
          aria-hidden="true"
        />
      }
      label={ROLE_META[member.role]?.label ?? member.role}
      size="small"
      color={member.role === ROLES.SUPER_ADMIN ? 'primary' : 'default'}
      variant={member.role === ROLES.SUPER_ADMIN ? 'filled' : 'outlined'}
      sx={{ height: 26, fontWeight: 600 }}
    />
  )

  const permissionsCell = (member) => (
    <PermissionSummary
      permissions={member.permissions}
      all={member.role === ROLES.SUPER_ADMIN}
      name={member.name}
    />
  )

  const activityCell = (member) => (
    <Box>
      <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
        {member.lastActiveAt ? formatRelativeTime(member.lastActiveAt) : 'Never signed in'}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
        {/* `null` is "we could not count", not "none" — different sentences. */}
        {member.actionsThisMonth === null || member.actionsThisMonth === undefined
          ? `${EMPTY_PLACEHOLDER} actions this month`
          : `${formatNumber(member.actionsThisMonth)} action${
              member.actionsThisMonth === 1 ? '' : 's'
            } this month`}
      </Typography>
    </Box>
  )

  const actionsCell = (member) => {
    const { allowed, reason } = canManageAdmin(member, actor)
    if (!allowed) {
      return (
        <Tooltip title={reason ?? ''}>
          <Box component="span" sx={{ color: 'text.disabled', display: 'inline-flex', p: 1 }}>
            <Icon icon="solar:lock-keyhole-minimalistic-linear" width={18} aria-hidden="true" />
            <Box component="span" sx={visuallyHidden}>
              {reason}
            </Box>
          </Box>
        </Tooltip>
      )
    }

    const suspended = member.accountStatus === ACCOUNT_STATUS.SUSPENDED

    return (
      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
        <Tooltip title="Edit permissions">
          <span>
            <IconButton
              size="small"
              onClick={() => setEditing(member)}
              disabled={busyId === member.id}
              aria-label={`Edit ${member.name}’s permissions`}
              sx={{ width: 44, height: 44 }}
            >
              <Icon icon="solar:key-square-linear" width={18} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={suspended ? 'Reinstate access' : 'Suspend access'}>
          <span>
            <IconButton
              size="small"
              color={suspended ? 'success' : 'warning'}
              onClick={() =>
                setStatus(member, suspended ? ACCOUNT_STATUS.ACTIVE : ACCOUNT_STATUS.SUSPENDED)
              }
              disabled={busyId === member.id}
              aria-label={
                suspended ? `Reinstate ${member.name}` : `Suspend ${member.name}`
              }
              sx={{ width: 44, height: 44 }}
            >
              <Icon
                icon={suspended ? 'solar:user-check-linear' : 'solar:user-block-linear'}
                width={18}
              />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    )
  }

  const columns = [
    { key: 'name', label: 'Admin', render: personCell },
    { key: 'role', label: 'Role', width: 150, render: roleCell },
    { key: 'accountStatus', label: 'Status', width: 130, render: (row) => <StatusChip status={row.accountStatus} /> },
    { key: 'permissions', label: 'Permissions', width: 180, render: permissionsCell },
    { key: 'lastActiveAt', label: 'Activity', width: 200, render: activityCell },
    { key: 'actions', label: '', align: 'right', width: 120, render: actionsCell },
  ]

  const renderMobileCard = (member) => (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="flex-start">
        <Box sx={{ minWidth: 0 }}>{personCell(member)}</Box>
        <StatusChip status={member.accountStatus} />
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap' }} useFlexGap>
        {roleCell(member)}
        {permissionsCell(member)}
      </Stack>

      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="space-between"
        sx={{ mt: 1.5 }}
      >
        {activityCell(member)}
        {actionsCell(member)}
      </Stack>
    </Card>
  )

  return (
    <DashboardPage
      title="Admin team"
      subtitle="Who works in the console, and exactly what each of them can do."
      maxWidth={false}
      actions={
        <Button
          onClick={() => setCreateOpen(true)}
          variant="gradient"
          startIcon={<Icon icon="tabler:plus" width={18} aria-hidden="true" />}
        >
          Add admin
        </Button>
      }
    >
      <AdminPageGuard permission={PERMISSIONS.ADMINS_MANAGE}>
        <Stack spacing={{ xs: 2, md: 2.5 }}>
          <Alert severity="info" icon={<Icon icon="solar:info-circle-linear" width={22} />}>
            Roles are fixed — every account here is an Admin or the Super Admin. Granularity comes
            from permissions, which you can change at any time from this screen. You cannot edit or
            suspend your own account, and the super admin is managed outside the console so the
            platform can never lock itself out. See the{' '}
            <Link component={RouterLink} to={paths.ADMIN_ROLES} underline="hover">
              roles and permissions matrix
            </Link>{' '}
            for what each permission grants.
          </Alert>

          <DataTable
            columns={columns}
            rows={rows}
            loading={isLoading}
            error={error}
            onRetry={refetch}
            ariaLabel="Admin team"
            emptyState={{
              icon: 'solar:shield-user-linear',
              title: 'No admin accounts yet',
              description: 'Add the first team member to start delegating console work.',
              primaryAction: { label: 'Add admin', onClick: () => setCreateOpen(true) },
            }}
            renderMobileCard={renderMobileCard}
          />
        </Stack>

        <CreateAdminDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onSubmit={createAdmin}
        />

        <TempPasswordDialog
          open={Boolean(created)}
          onClose={() => setCreated(null)}
          admin={created?.user}
          tempPassword={created?.tempPassword}
        />

        <EditPermissionsDialog
          open={Boolean(editing)}
          onClose={() => setEditing(null)}
          admin={editing}
          onSubmit={savePermissions}
        />
      </AdminPageGuard>
    </DashboardPage>
  )
}
