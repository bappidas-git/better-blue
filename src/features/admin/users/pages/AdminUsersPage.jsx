import { useCallback, useMemo, useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import { Link as RouterLink, useNavigate } from 'react-router-dom'

import FilterChipGroup from '@/components/inputs/FilterChipGroup'
import FormDateField from '@/components/inputs/FormDateField'
import SearchInput from '@/components/inputs/SearchInput'
import SortSelect from '@/components/inputs/SortSelect'
import { useToast } from '@/components/feedback/ToastProvider'
import { PERMISSIONS } from '@/constants/permissions'
import { ROLES } from '@/constants/roles'
import { STATUS_META } from '@/constants/statuses'
import { useAuth } from '@/context/AuthContext'
import { AdminPageGuard } from '@/features/admin/shared'
import AccountActionDialogs from '@/features/admin/users/components/AccountActionDialogs'
import UserTable from '@/features/admin/users/components/UserTable'
import {
  ACCOUNT_STATUS_OPTIONS,
  USERS_EXPORT_LIMIT,
  USERS_PAGE_SIZE,
  USER_DIRECTORY_PARAMS,
  USER_SORT_OPTIONS,
  USER_TABS,
  isReadOnlyTab,
  roleFilterForTab,
  roleLabel,
  sortQueryFor,
  sortTokenFor,
} from '@/features/admin/users/utils/userDirectory'
import useApiQuery from '@/hooks/useApiQuery'
import useListParams from '@/hooks/useListParams'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { PermissionGate } from '@/routes/guards'
import { paths } from '@/routes/paths'
import { userService } from '@/services/userService'
import { exportRowsAsCsv } from '@/utils/exportCsv'
import { formatDate, formatDateTime } from '@/utils/formatters'

// The account directory — Prompt 29 §4.2.
//
// The standard list pattern (00 §12): header → role presets → toolbar → table →
// pagination, all of it readable off the URL, so a link to "suspended creators
// who joined in July" is a link somebody can send.
//
// It does **not** use `AdminListPage`: that component's toolbar has one
// chip-group filter and no tabs, and this screen has role presets, a status
// filter, and a joined-date range. That is the case its own header calls out —
// copy the pattern rather than bend the component.
//
// Nothing here decides anything about accounts. Which actions a row offers comes
// from `canAdminManageAccount`, applying a status is `adminSetAccountStatus`,
// and both live in `userService` (§7).

/** Columns in the CSV. Deliberately flatter than the table — no markup. */
const EXPORT_COLUMNS = [
  { key: 'id', label: 'User ID' },
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Role', format: (row) => roleLabel(row.role) },
  {
    key: 'accountStatus',
    label: 'Account status',
    format: (row) => STATUS_META[row.accountStatus]?.label ?? row.accountStatus,
  },
  { key: 'statusReason', label: 'Status reason' },
  {
    key: 'statusChangedAt',
    label: 'Status changed',
    format: (row) => (row.statusChangedAt ? formatDateTime(row.statusChangedAt) : ''),
  },
  { key: 'createdAt', label: 'Joined', format: (row) => formatDate(row.createdAt) },
  {
    key: 'lastLoginAt',
    label: 'Last active',
    format: (row) => (row.lastLoginAt ? formatDateTime(row.lastLoginAt) : 'Never'),
  },
  {
    key: 'totalSpent',
    label: 'Total spent',
    format: (row) => row.profile?.totalSpent ?? '',
  },
  {
    key: 'completedOrders',
    label: 'Orders delivered',
    format: (row) => row.profile?.completedOrders ?? '',
  },
]

export default function AdminUsersPage() {
  const { user: actor } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const { values, setValue, setValues, clearFilters, isFiltered } =
    useListParams(USER_DIRECTORY_PARAMS)
  const { tab, q, status, from, to, sort, page } = values

  const [pendingAction, setPendingAction] = useState(null)
  const [exporting, setExporting] = useState(false)

  // The one object both the table and the export are driven by, so an exported
  // file can never contain a different set of accounts than the screen showed.
  const query = useMemo(
    () => ({
      search: q || undefined,
      role: roleFilterForTab(tab),
      accountStatus: status.length > 0 ? status : undefined,
      joinedFrom: from || undefined,
      joinedTo: to || undefined,
      ...sortQueryFor(sort),
    }),
    [q, tab, status, from, to, sort]
  )

  const { data, isLoading, error, refetch } = useApiQuery(
    () => userService.adminListUsers({ ...query, page, limit: USERS_PAGE_SIZE }),
    [query, page]
  )

  const rows = useMemo(() => data?.items ?? [], [data])
  const readOnly = isReadOnlyTab(tab)

  const openDetail = useCallback(
    (row) => navigate(paths.adminUserDetail(row.id)),
    [navigate]
  )

  const applyStatus = useCallback(
    async ({ status: nextStatus, reason }) => {
      const target = pendingAction
      const updated = await userService.adminSetAccountStatus(target.id, {
        status: nextStatus,
        reason,
        actor,
      })

      toast.success(`${target.name} is now ${STATUS_META[nextStatus]?.label?.toLowerCase() ?? nextStatus}.`, {
        description: 'They have been notified, and the change is in the audit trail.',
      })
      refetch()
      return updated
    },
    [actor, pendingAction, refetch, toast]
  )

  const exportCsv = useCallback(async () => {
    setExporting(true)
    try {
      const all = await userService.adminListUsers({
        ...query,
        page: 1,
        limit: USERS_EXPORT_LIMIT,
      })

      if (all.items.length === 0) {
        toast.info('There is nothing to export in this view.')
        return
      }

      if (!exportRowsAsCsv('betterblue-users', EXPORT_COLUMNS, all.items)) {
        toast.error('We could not build the file. Try again in a moment.')
        return
      }

      toast.success(`Exported ${all.items.length} accounts.`, {
        description:
          all.total > all.items.length
            ? `Your filters match ${all.total} accounts; the export is capped at ${USERS_EXPORT_LIMIT}. Narrow the filters to get the rest.`
            : undefined,
      })
    } catch (failure) {
      toast.error(failure?.message ?? 'We could not export the directory.')
    } finally {
      setExporting(false)
    }
  }, [query, toast])

  const emptyState = isFiltered || q
    ? {
        icon: 'tabler:search-off',
        title: 'No accounts match those filters',
        description: 'Try a shorter search term, a wider date range, or another role tab.',
        primaryAction: { label: 'Clear filters', onClick: () => clearFilters(), variant: 'outlined' },
      }
    : {
        icon: 'solar:users-group-rounded-linear',
        title: 'No accounts here yet',
        description: 'Members appear in this directory the moment they register.',
      }

  return (
    <DashboardPage
      title="Users"
      subtitle="Every buyer, creator, and team member on the platform."
      maxWidth={false}
      actions={
        // Gated as well as the body: `AdminPageGuard` wraps the table, not the
        // page header, so without this an admin refused the screen would still
        // have a working "Export CSV" button for the directory behind it.
        <PermissionGate permission={PERMISSIONS.USERS_MANAGE}>
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
      <AdminPageGuard permission={PERMISSIONS.USERS_MANAGE}>
        <Tabs
          value={tab}
          onChange={(event, next) => setValue('tab', next)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          aria-label="Filter accounts by role"
          sx={{ borderBottom: 1, borderColor: 'divider', mb: { xs: 2, md: 2.5 } }}
        >
          {USER_TABS.map((entry) => (
            <Tab
              key={entry.key}
              value={entry.key}
              label={entry.label}
              sx={{ minHeight: 48, textTransform: 'none', fontWeight: 600 }}
            />
          ))}
        </Tabs>

        <Stack spacing={{ xs: 2, md: 2.5 }}>
          {readOnly ? (
            // Prompt 36. The team tab has always been read-only here (team
            // accounts are managed on their own screen, with their own
            // permission); until now it said so only by having no buttons. The
            // link is gated twice over — `SuperAdminRoute` refuses the
            // destination to anybody else, so offering it to an admin who
            // cannot open it would be a dead end (00 §13).
            <Alert
              severity="info"
              icon={<Icon icon="solar:shield-user-linear" width={22} />}
              action={
                actor?.role === ROLES.SUPER_ADMIN ? (
                  <Button
                    component={RouterLink}
                    to={paths.ADMIN_ADMINS}
                    size="small"
                    endIcon={<Icon icon="tabler:arrow-right" width={16} aria-hidden="true" />}
                  >
                    Admin team
                  </Button>
                ) : null
              }
            >
              Team accounts are listed here but managed on the Admin team screen — permissions,
              suspension, and adding a colleague all live there.
            </Alert>
          ) : null}

          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            spacing={1.5}
            alignItems={{ xs: 'stretch', lg: 'center' }}
          >
            <Box sx={{ flexGrow: 1, minWidth: 0, maxWidth: { lg: 320 } }}>
              <SearchInput
                value={q}
                onChange={(next) => setValue('q', next)}
                placeholder="Search by name or email"
                label="Search accounts by name or email"
              />
            </Box>

            <FilterChipGroup
              label="Account status"
              options={ACCOUNT_STATUS_OPTIONS}
              multiple
              value={status}
              onChange={(next) => setValue('status', next)}
              size="sm"
            />

            <Stack direction="row" spacing={1} sx={{ minWidth: { lg: 320 } }}>
              <FormDateField
                label="Joined from"
                value={from}
                onChange={(next) => setValue('from', next ?? '')}
                maxDate={to || undefined}
              />
              <FormDateField
                label="Joined to"
                value={to}
                onChange={(next) => setValue('to', next ?? '')}
                minDate={from || undefined}
              />
            </Stack>

            <SortSelect
              value={sort}
              onChange={(next) => setValue('sort', next)}
              options={USER_SORT_OPTIONS}
            />
          </Stack>

          <UserTable
            rows={rows}
            // Team rows carry no actions anywhere, but the tab makes it explicit:
            // passing no actor is how the table renders the whole page read-only.
            actor={readOnly ? null : actor}
            loading={isLoading}
            error={error}
            onRetry={refetch}
            emptyState={emptyState}
            sort={{ key: sortQueryFor(sort).sort, direction: sortQueryFor(sort).order }}
            onSortChange={(next) => {
              const token = sortTokenFor(next.key, next.direction)
              if (token) setValue('sort', token)
            }}
            pagination={{
              page,
              pageSize: USERS_PAGE_SIZE,
              total: data?.total ?? 0,
              onPageChange: (next) => setValues({ page: next }),
              itemLabel: 'accounts',
            }}
            onOpen={openDetail}
            onAction={(nextStatus, row) =>
              setPendingAction({ ...row, pendingStatus: nextStatus })
            }
          />
        </Stack>

        <AccountActionDialogs
          status={pendingAction?.pendingStatus ?? null}
          user={pendingAction}
          onConfirm={applyStatus}
          onClose={() => setPendingAction(null)}
        />
      </AdminPageGuard>
    </DashboardPage>
  )
}
