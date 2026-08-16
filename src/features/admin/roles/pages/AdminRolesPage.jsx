import { useCallback, useMemo, useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'

import { useToast } from '@/components/feedback/ToastProvider'
import FilterChipGroup from '@/components/inputs/FilterChipGroup'
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  PERMISSION_META,
  PERMISSION_VALUES,
} from '@/constants/permissions'
import { ROLES, ROLE_META, ROLE_VALUES } from '@/constants/roles'
import PermissionMatrix from '@/features/admin/roles/components/PermissionMatrix'
import { AdminPageGuard } from '@/features/admin/shared'
import useApiQuery from '@/hooks/useApiQuery'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { paths } from '@/routes/paths'
import { adminTeamService } from '@/services/adminTeamService'
import { exportRowsAsCsv } from '@/utils/exportCsv'

// `/admin/roles` — roles and permissions, documented (Prompt 36 §4.3).
//
// **Read-only, deliberately.** The four roles are fixed for the product's
// lifetime (00 §9) and a permission is granted to a person rather than to a
// role, so there is nothing on this screen to change — and pretending otherwise
// with a disabled editor would be worse than saying so plainly. What it is for:
//
//   - the four role cards, so "what is a Creator allowed to be" has an answer
//     that is not somebody's memory of a Slack thread;
//   - the matrix, which is the same table `hasPermission` implements — Admin
//     configurable, Super Admin always, and nobody else anything;
//   - the comparison, which is the fastest way to answer "why can Priya see the
//     moderation queue and Daniel cannot".
//
// Print-worthy on purpose: it is the page somebody exports into an access-review
// pack once a quarter, which is what the CSV button is for.

/** Up to three columns compare comfortably; past that the matrix stops fitting. */
const MAX_COMPARED = 3

/** Icon per role card — the same vocabulary the team table uses. */
const ROLE_ICON = Object.freeze({
  [ROLES.BUYER]: 'solar:buildings-3-linear',
  [ROLES.CREATOR]: 'solar:user-id-linear',
  [ROLES.ADMIN]: 'solar:shield-user-linear',
  [ROLES.SUPER_ADMIN]: 'solar:crown-linear',
})

/** What each role's console access amounts to, in one line under the description. */
const ROLE_ACCESS = Object.freeze({
  [ROLES.BUYER]: 'No console access. Permissions do not apply.',
  [ROLES.CREATOR]: 'No console access. Permissions do not apply.',
  [ROLES.ADMIN]: 'Console access limited to the permissions granted per account.',
  [ROLES.SUPER_ADMIN]: 'Every permission, implicitly — including any added later.',
})

export default function AdminRolesPage() {
  const toast = useToast()
  const [compared, setCompared] = useState([])

  const { data: team } = useApiQuery(
    () => adminTeamService.listAdmins().catch(() => ({ items: [] })),
    []
  )

  const teamOptions = useMemo(
    () => (team?.items ?? []).map((member) => ({ value: member.id, label: member.name })),
    [team]
  )

  const comparedAdmins = useMemo(
    () =>
      (team?.items ?? [])
        .filter((member) => compared.includes(member.id))
        .map((member) => ({
          id: member.id,
          name: member.name,
          permissions: member.permissions ?? [],
          isSuperAdmin: member.role === ROLES.SUPER_ADMIN,
        })),
    [compared, team]
  )

  const exportMatrix = useCallback(() => {
    const columns = [
      { key: 'group', label: 'Group' },
      { key: 'permission', label: 'Permission' },
      { key: 'key', label: 'Key' },
      { key: 'description', label: 'What it grants' },
      { key: 'admin', label: 'Admin' },
      { key: 'superAdmin', label: 'Super Admin' },
      ...comparedAdmins.map((admin) => ({ key: admin.id, label: admin.name })),
    ]

    const rows = PERMISSION_GROUPS.flatMap((group) =>
      group.permissions.map((key) => ({
        group: group.label,
        permission: PERMISSION_META[key]?.label ?? key,
        key,
        description: PERMISSION_META[key]?.description ?? '',
        admin: 'Configurable',
        superAdmin: 'Always',
        ...Object.fromEntries(
          comparedAdmins.map((admin) => [
            admin.id,
            admin.isSuperAdmin || admin.permissions.includes(key) ? 'Yes' : 'No',
          ])
        ),
      }))
    )

    if (!exportRowsAsCsv('betterblue-permission-matrix', columns, rows)) {
      toast.error('We could not build the file. Try again in a moment.')
      return
    }
    toast.success(`Exported ${rows.length} permissions.`)
  }, [comparedAdmins, toast])

  return (
    <DashboardPage
      title="Roles & permissions"
      subtitle="What each role is, and exactly what every permission grants."
      maxWidth={false}
      actions={
        <Button
          variant="outlined"
          onClick={exportMatrix}
          startIcon={
            <Icon icon="solar:download-minimalistic-linear" width={18} aria-hidden="true" />
          }
        >
          Export matrix
        </Button>
      }
    >
      <AdminPageGuard permission={PERMISSIONS.ADMINS_MANAGE}>
        <Stack spacing={{ xs: 2.5, md: 3 }}>
          <Alert severity="info" icon={<Icon icon="solar:info-circle-linear" width={22} />}>
            <strong>Roles are fixed and nothing on this page is editable.</strong> BetterBlue has
            four roles and will keep exactly these four. What one admin can do differently from
            another is decided per account — tailor it from{' '}
            <Link component={RouterLink} to={paths.ADMIN_ADMINS} underline="hover">
              Admin management
            </Link>
            .
          </Alert>

          <Box>
            <Typography variant="h6" component="h2" sx={{ fontSize: '1.0625rem', mb: 1.5 }}>
              The four roles
            </Typography>
            <Grid container spacing={2}>
              {ROLE_VALUES.map((role) => {
                const meta = ROLE_META[role]
                const isAdminRole = role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN
                return (
                  <Grid item xs={12} sm={6} lg={3} key={role}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                          <Box
                            aria-hidden="true"
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: 1.5,
                              display: 'grid',
                              placeItems: 'center',
                              bgcolor: (theme) =>
                                alpha(
                                  isAdminRole
                                    ? theme.palette.primary.main
                                    : theme.palette.text.primary,
                                  0.08
                                ),
                              color: isAdminRole ? 'primary.main' : 'text.primary',
                            }}
                          >
                            <Icon icon={ROLE_ICON[role]} width={20} />
                          </Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            {meta.label}
                          </Typography>
                        </Stack>

                        <Typography variant="body2" color="text.secondary">
                          {meta.description}
                        </Typography>

                        <Chip
                          label={ROLE_ACCESS[role]}
                          size="small"
                          variant="outlined"
                          color={isAdminRole ? 'primary' : 'default'}
                          sx={{
                            mt: 1.5,
                            height: 'auto',
                            py: 0.5,
                            '& .MuiChip-label': {
                              whiteSpace: 'normal',
                              fontSize: '0.75rem',
                              lineHeight: 1.4,
                            },
                          }}
                        />
                      </CardContent>
                    </Card>
                  </Grid>
                )
              })}
            </Grid>
          </Box>

          <Box>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1.5}
              alignItems={{ xs: 'flex-start', md: 'flex-end' }}
              justifyContent="space-between"
              sx={{ mb: 1.5 }}
            >
              <Box>
                <Typography variant="h6" component="h2" sx={{ fontSize: '1.0625rem' }}>
                  Permission matrix
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  All {PERMISSION_VALUES.length} permissions, and what holding each one lets
                  somebody do.
                </Typography>
              </Box>

              {/* The width pair is what lets the chip row scroll inside itself
                  instead of stretching the page: the parent stack aligns to
                  `flex-start` on a phone, so this box would otherwise size to
                  its content and push the whole screen sideways with a team of
                  eight (§11). `FilterChipGroup` handles the scrolling once it
                  has a width to work inside. */}
              <Box sx={{ width: { xs: '100%', md: 'auto' }, minWidth: 0, maxWidth: '100%' }}>
                <Typography variant="caption" color="text.secondary" component="p">
                  Compare up to {MAX_COMPARED} team members
                </Typography>
                <FilterChipGroup
                  label={`Compare team members (up to ${MAX_COMPARED})`}
                  options={teamOptions}
                  multiple
                  value={compared}
                  onChange={(next) => setCompared(next.slice(0, MAX_COMPARED))}
                  size="sm"
                />
              </Box>
            </Stack>

            <PermissionMatrix admins={comparedAdmins} />
          </Box>

          <Card variant="outlined" sx={{ bgcolor: 'background.default' }}>
            <CardContent sx={{ p: { xs: 2, md: 2.5 }, '&:last-child': { pb: { xs: 2, md: 2.5 } } }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                How this is enforced
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                The console hides what an admin cannot use and refuses the typed URL as well, but
                neither is access control: both run in the browser. The API is the authority on
                every request, and the permission array on the account is what it checks. A
                permission change takes effect for the person it applies to on their next sign-in or
                session revalidation.
              </Typography>
            </CardContent>
          </Card>
        </Stack>
      </AdminPageGuard>
    </DashboardPage>
  )
}
