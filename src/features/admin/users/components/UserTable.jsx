import { useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { visuallyHidden } from '@mui/utils'

import StatusChip from '@/components/data-display/StatusChip'
import UserAvatar from '@/components/data-display/UserAvatar'
import DataTable from '@/components/table/DataTable'
import { ROLES } from '@/constants/roles'
import { actionsFor } from '@/features/admin/users/utils/accountActions'
import { roleLabel } from '@/features/admin/users/utils/userDirectory'
import { canAdminManageAccount } from '@/services/userService'
import { EMPTY_PLACEHOLDER, formatCurrency, formatDate, formatNumber, formatRelativeTime } from '@/utils/formatters'

// The account directory's table — Prompt 29 §4.2.
//
// One row per account: who they are, what they are, whether they can trade, how
// long they have been here, when we last saw them, and the one number that says
// how much of the marketplace they have touched. Below `md` the same row is a
// card (00 §13); the kebab moves with it, so nothing is desktop-only.
//
// **The kebab is not the authority.** It is hidden for a target the signed-in
// admin may not act on, but `canAdminManageAccount` is the same rule
// `userService.adminSetAccountStatus` re-checks before it writes — this is the
// polite half of a pair, not access control (00 §11).

/** The key stat: what a buyer has committed, what a creator has delivered. */
function keyStat(user) {
  const profile = user.profile

  if (user.role === ROLES.BUYER) {
    if (!profile) return { value: EMPTY_PLACEHOLDER, hint: null }
    return {
      value: formatCurrency(profile.totalSpent ?? 0),
      hint: 'spent',
    }
  }

  if (user.role === ROLES.CREATOR) {
    if (!profile) return { value: EMPTY_PLACEHOLDER, hint: null }
    return {
      value: formatNumber(profile.completedOrders ?? 0),
      hint: (profile.completedOrders ?? 0) === 1 ? 'order delivered' : 'orders delivered',
    }
  }

  return { value: EMPTY_PLACEHOLDER, hint: null }
}

/** Avatar + name + email, the cell every row is read by. */
function IdentityCell({ user }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
      <UserAvatar name={user.name} src={user.avatarUrl} size="sm" />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
          {user.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap component="p">
          {user.email}
        </Typography>
      </Box>
    </Stack>
  )
}

/**
 * The per-row action menu.
 *
 * Its accessible name names the account (§12): a page of twenty identical
 * "More actions" buttons is unusable with a screen reader.
 */
function RowActions({ user, actor, onAction }) {
  const [anchor, setAnchor] = useState(null)
  const available = actionsFor(user, actor)

  if (available.length === 0) {
    // A team row, or the signed-in admin's own row. Says why rather than
    // leaving a blank cell somebody reads as a loading state.
    const { reason } = canAdminManageAccount(user, actor)
    return (
      <Tooltip title={reason ?? ''}>
        <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled', p: 1 }}>
          <Icon icon="solar:lock-keyhole-minimalistic-linear" width={18} aria-hidden="true" />
          <Box component="span" sx={visuallyHidden}>
            {reason}
          </Box>
        </Box>
      </Tooltip>
    )
  }

  const close = () => setAnchor(null)

  return (
    <>
      <IconButton
        size="small"
        aria-label={`Account actions for ${user.name}`}
        aria-haspopup="menu"
        aria-expanded={anchor ? 'true' : undefined}
        onClick={(event) => {
          event.stopPropagation()
          setAnchor(event.currentTarget)
        }}
      >
        <Icon icon="solar:menu-dots-bold" width={18} aria-hidden="true" />
      </IconButton>

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        onClick={(event) => event.stopPropagation()}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        MenuListProps={{ dense: true, 'aria-label': `Account actions for ${user.name}` }}
      >
        {available.map((action) => (
          <MenuItem
            key={action.key}
            onClick={() => {
              close()
              onAction?.(action.key, user)
            }}
            sx={action.danger ? { color: 'error.main' } : undefined}
          >
            <ListItemIcon sx={{ color: 'inherit' }}>
              <Icon icon={action.icon} width={18} aria-hidden="true" />
            </ListItemIcon>
            <ListItemText>{action.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

/**
 * @param {object} props
 * @param {object[]} props.rows a page of accounts, each carrying its `profile`
 * @param {object|null} props.actor the signed-in admin — decides which actions show
 * @param {boolean} [props.loading]
 * @param {object} [props.error]
 * @param {() => void} [props.onRetry]
 * @param {object} [props.emptyState] forwarded to `EmptyState`
 * @param {{key: string, direction: 'asc'|'desc'}} [props.sort]
 * @param {(sort: object) => void} [props.onSortChange]
 * @param {object} [props.pagination] `{ page, pageSize, total, onPageChange }`
 * @param {(user: object) => void} [props.onOpen] row activation — the detail page
 * @param {(status: string, user: object) => void} [props.onAction] a kebab choice
 */
export default function UserTable({
  rows,
  actor,
  loading,
  error,
  onRetry,
  emptyState,
  sort,
  onSortChange,
  pagination,
  onOpen,
  onAction,
}) {
  const columns = [
    {
      key: 'name',
      label: 'Member',
      sortable: true,
      render: (row) => <IdentityCell user={row} />,
    },
    {
      key: 'role',
      label: 'Role',
      width: 120,
      render: (row) => <Chip size="small" variant="outlined" label={roleLabel(row.role)} />,
    },
    {
      key: 'accountStatus',
      label: 'Status',
      width: 140,
      render: (row) => <StatusChip status={row.accountStatus} size="sm" tooltip />,
    },
    {
      key: 'createdAt',
      label: 'Joined',
      sortable: true,
      width: 130,
      render: (row) => formatDate(row.createdAt),
    },
    {
      key: 'lastLoginAt',
      label: 'Last active',
      sortable: true,
      width: 140,
      render: (row) =>
        row.lastLoginAt ? (
          <Tooltip title={formatDate(row.lastLoginAt)}>
            <Box component="span">{formatRelativeTime(row.lastLoginAt)}</Box>
          </Tooltip>
        ) : (
          <Box component="span" sx={{ color: 'text.disabled' }}>
            Never signed in
          </Box>
        ),
    },
    {
      key: 'keyStat',
      label: 'Activity',
      align: 'right',
      width: 150,
      render: (row) => {
        const stat = keyStat(row)
        return (
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {stat.value}
            </Typography>
            {stat.hint ? (
              <Typography variant="caption" color="text.secondary">
                {stat.hint}
              </Typography>
            ) : null}
          </Box>
        )
      },
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      width: 64,
      render: (row) => <RowActions user={row} actor={actor} onAction={onAction} />,
    },
  ]

  const renderMobileCard = (row) => {
    const stat = keyStat(row)
    return (
      <Card variant="outlined">
        <Stack direction="row" alignItems="flex-start">
          <CardActionArea
            onClick={() => onOpen?.(row)}
            sx={{ p: 2, borderRadius: 0, flexGrow: 1, minWidth: 0 }}
          >
            <IdentityCell user={row} />

            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
              <Chip size="small" variant="outlined" label={roleLabel(row.role)} />
              <StatusChip status={row.accountStatus} size="sm" />
            </Stack>

            <Divider sx={{ my: 1.5 }} />

            <Stack direction="row" justifyContent="space-between" spacing={2}>
              <Box>
                <Typography variant="caption" color="text.secondary" component="p">
                  Joined
                </Typography>
                <Typography variant="body2">{formatDate(row.createdAt)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" component="p">
                  Last active
                </Typography>
                <Typography variant="body2">
                  {row.lastLoginAt ? formatRelativeTime(row.lastLoginAt) : 'Never'}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" color="text.secondary" component="p">
                  {stat.hint ?? 'Activity'}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {stat.value}
                </Typography>
              </Box>
            </Stack>
          </CardActionArea>

          <Box sx={{ p: 1 }}>
            <RowActions user={row} actor={actor} onAction={onAction} />
          </Box>
        </Stack>
      </Card>
    )
  }

  return (
    <DataTable
      columns={columns}
      rows={rows}
      loading={loading}
      error={error}
      onRetry={onRetry}
      emptyState={emptyState}
      sort={sort}
      onSortChange={onSortChange}
      pagination={pagination}
      onRowClick={onOpen}
      renderMobileCard={renderMobileCard}
      ariaLabel="User directory"
    />
  )
}
