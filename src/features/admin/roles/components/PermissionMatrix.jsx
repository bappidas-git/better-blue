import { Fragment } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { visuallyHidden } from '@mui/utils'

import { PERMISSION_GROUPS, PERMISSION_META } from '@/constants/permissions'

// The permission matrix — Prompt 36 §4.3.
//
// Documentation, not a control: nothing here is editable, because a permission
// is granted to a *person* (Admin management) rather than to a role. What this
// answers is the question that comes before that one — "what does
// `disputes.resolve` actually let somebody do, and who has it?"
//
// Not `DataTable`: that component renders cards below md, and a matrix turned
// into cards is a list of sixteen headings with ticks under them, which is
// worse than scrolling. This scrolls horizontally with a **sticky first
// column**, so the permission you are reading across stays on screen (§11).
//
// Marked up as a real table with `scope="col"` / `scope="row"` and a caption, so
// a screen reader announces "Resolve disputes, Admin, granted" rather than
// reading a wall of ticks (§12). The tick is never the only signal — every cell
// carries visually-hidden text.

/** One cell: granted, not granted, or configurable per admin. */
function MatrixCell({ state, label }) {
  const visual = {
    yes: { icon: 'tabler:check', color: 'success.main' },
    no: { icon: 'tabler:minus', color: 'text.disabled' },
    optional: { icon: 'tabler:adjustments-horizontal', color: 'primary.main' },
  }[state]

  return (
    <TableCell align="center">
      <Box sx={{ color: visual.color, display: 'inline-flex', alignItems: 'center' }}>
        <Icon icon={visual.icon} width={18} aria-hidden="true" />
        <Box component="span" sx={visuallyHidden}>
          {label}
        </Box>
      </Box>
    </TableCell>
  )
}

/**
 * @param {object} props
 * @param {Array<{id: string, name: string, permissions: string[], isSuperAdmin?: boolean}>}
 *   [props.admins] up to three team members to compare, appended as columns
 */
export default function PermissionMatrix({ admins = [] }) {
  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      {/* `position: relative` is load-bearing, not decoration: the first column
          is `position: sticky`, and without a positioned scroll container around
          it the sticky cells' overflow is measured against the document — which
          makes the **page** scroll sideways at 360px instead of the table
          (§11). The legend sits outside this container so it stays put while
          the matrix scrolls. */}
      <TableContainer sx={{ position: 'relative', overflowX: 'auto' }}>
        <Table size="small" aria-label="Permissions by role">
          <Box component="caption" sx={visuallyHidden}>
            Every BetterBlue permission, showing which are available to the Admin role, which the
            Super Admin holds, and which of them the selected team members have been granted.
          </Box>

          <TableHead>
            <TableRow>
              <TableCell
                component="th"
                scope="col"
                sx={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 3,
                  bgcolor: 'background.paper',
                  minWidth: { xs: 200, md: 320 },
                }}
              >
                Permission
              </TableCell>
              <TableCell component="th" scope="col" align="center" sx={{ minWidth: 110 }}>
                Admin
              </TableCell>
              <TableCell component="th" scope="col" align="center" sx={{ minWidth: 120 }}>
                Super Admin
              </TableCell>
              {admins.map((admin) => (
                <TableCell
                  key={admin.id}
                  component="th"
                  scope="col"
                  align="center"
                  sx={{ minWidth: 140 }}
                >
                  {admin.name}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {PERMISSION_GROUPS.map((group) => (
              <Fragment key={group.id}>
                <TableRow sx={{ bgcolor: 'background.default' }}>
                  <TableCell
                    component="th"
                    scope="colgroup"
                    colSpan={3 + admins.length}
                    sx={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 2,
                      bgcolor: 'background.default',
                      py: 1,
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: '0.04em' }}>
                      {group.label.toUpperCase()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      {group.description}
                    </Typography>
                  </TableCell>
                </TableRow>

                {group.permissions.map((key) => {
                  const meta = PERMISSION_META[key]
                  return (
                    <TableRow key={key} hover>
                      <TableCell
                        component="th"
                        scope="row"
                        sx={{
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                          bgcolor: 'background.paper',
                          verticalAlign: 'top',
                        }}
                      >
                        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {meta?.label ?? key}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.disabled"
                            sx={{ fontFamily: 'monospace' }}
                          >
                            {key}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {meta?.description}
                          </Typography>
                        </Stack>
                      </TableCell>

                      {/* Every permission is grantable to an admin — which is the
                          point of the model: the role is fixed, the grant is not. */}
                      <MatrixCell state="optional" label="Configurable per admin" />
                      <MatrixCell state="yes" label="Always granted" />

                      {admins.map((admin) => {
                        const held = admin.isSuperAdmin || admin.permissions?.includes(key)
                        return (
                          <MatrixCell
                            key={admin.id}
                            state={held ? 'yes' : 'no'}
                            label={held ? `${admin.name} has this` : `${admin.name} does not have this`}
                          />
                        )
                      })}
                    </TableRow>
                  )
                })}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Stack
        direction="row"
        spacing={2}
        sx={{ px: 2, py: 1.5, borderTop: 1, borderColor: 'divider', flexWrap: 'wrap' }}
        useFlexGap
      >
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'primary.main' }}>
          <Icon icon="tabler:adjustments-horizontal" width={16} aria-hidden="true" />
          <Typography variant="caption" color="text.secondary">
            Configurable per admin
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'success.main' }}>
          <Icon icon="tabler:check" width={16} aria-hidden="true" />
          <Typography variant="caption" color="text.secondary">
            Granted
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'text.disabled' }}>
          <Icon icon="tabler:minus" width={16} aria-hidden="true" />
          <Typography variant="caption" color="text.secondary">
            Not granted
          </Typography>
        </Stack>
      </Stack>
    </Paper>
  )
}
