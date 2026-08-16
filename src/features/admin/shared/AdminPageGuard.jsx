import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import { PERMISSION_META } from '@/constants/permissions'
import { appConfig } from '@/config/appConfig'
import { PermissionGate } from '@/routes/guards'

// Page-level permission gating for the admin console (00 §11).
//
// `PermissionGate` renders **nothing** when the permission is missing, which is
// right for a button and wrong for a whole screen: an admin who deep-links a
// page they are not cleared for would get a blank workspace with a heading and
// no explanation of why. This wraps the same gate with a fallback that says
// what happened and who to ask — never a blank page, never a dead end (§13).
//
// It is the page-level half of a pair. The nav already hides what an admin
// cannot use (`navConfig`), so reaching this card means a typed URL, a
// bookmark, or a link from a colleague with broader access — all of which are
// ordinary, none of which deserve an error.
//
// SECURITY: this is UX, not access control (00 §11 / §14). The Laravel API must
// reject the same request independently; a screen that merely refuses to draw
// is not a protected resource.

/**
 * The card an admin sees instead of a screen they are not cleared for. Exported
 * so the dev gallery can render the state without a session that lacks the
 * permission, and so a future prompt can reuse it for a panel-level refusal.
 *
 * @param {object} props
 * @param {string|string[]} [props.permission] the key(s) that were required —
 *   named in the copy so the reader knows what to ask for
 * @param {React.ReactNode} [props.title='You do not have access to this area']
 * @param {React.ReactNode} [props.description] override the explanation
 */
export function AdminAccessNotice({ permission, title, description }) {
  const keys = (Array.isArray(permission) ? permission : [permission]).filter(Boolean)
  const names = keys
    .map((key) => PERMISSION_META[key]?.label ?? key)
    .filter(Boolean)

  const requirement =
    names.length === 0
      ? null
      : names.length === 1
        ? `This area needs the “${names[0]}” permission.`
        : `This area needs one of: ${names.map((name) => `“${name}”`).join(', ')}.`

  return (
    <Card>
      <CardContent sx={{ p: { xs: 3, md: 5 } }}>
        <Stack alignItems="center" textAlign="center" spacing={2} sx={{ mx: 'auto', maxWidth: 460 }}>
          <Box
            aria-hidden="true"
            sx={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'primary.surface',
              color: 'primary.main',
            }}
          >
            <Icon icon="solar:lock-keyhole-minimalistic-linear" width={30} />
          </Box>

          <Box>
            <Typography variant="h6" component="h2" gutterBottom>
              {title ?? 'You do not have access to this area'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {description ?? (
                <>
                  {requirement ? `${requirement} ` : ''}
                  Ask a super admin to grant it, or use the sections in your sidebar — everything
                  you can work on is already listed there.
                </>
              )}
            </Typography>
          </Box>

          <Typography variant="caption" color="text.secondary">
            {appConfig.appName} support: {appConfig.supportEmail}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  )
}

/**
 * Wraps an admin screen's body in its permission check.
 *
 * Put it **inside** `DashboardPage`, not around it: the heading, the document
 * title, and the breadcrumbs should still be there — the reader needs to know
 * which page refused them.
 *
 * @param {object} props
 * @param {string|string[]} props.permission a `PERMISSIONS` key, or several —
 *   holding any one is enough (matching `PermissionGate`)
 * @param {React.ReactNode} props.children the screen, rendered when cleared
 * @param {React.ReactNode} [props.fallback] override the refusal card entirely
 *
 * @example
 * export default function AdminUsersPage() {
 *   return (
 *     <DashboardPage title="Users" subtitle="Every account on the platform">
 *       <AdminPageGuard permission={PERMISSIONS.USERS_MANAGE}>
 *         <UsersTable />
 *       </AdminPageGuard>
 *     </DashboardPage>
 *   )
 * }
 */
export default function AdminPageGuard({ permission, children, fallback }) {
  return (
    <PermissionGate
      permission={permission}
      fallback={fallback ?? <AdminAccessNotice permission={permission} />}
    >
      {children}
    </PermissionGate>
  )
}
