import { useState } from 'react'

import { Icon } from '@iconify/react'
import AppBar from '@mui/material/AppBar'
import Badge from '@mui/material/Badge'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Toolbar from '@mui/material/Toolbar'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

import Logo from '@/components/brand/Logo'
import UserAvatar from '@/components/data-display/UserAvatar'
import { appConfig } from '@/config/appConfig'
import { ROLE_META } from '@/constants/roles'
import { paths } from '@/routes/paths'

import { useDashboardPageTitle } from './DashboardPageContext'

// The dashboard header on both breakpoints: where you are on the left, the
// bell and the account menu on the right. Below `md` it is the *only* chrome at
// the top — the brand mark comes back, because the sidebar that normally
// carries it is not rendered.
//
// Presentation only. The unread count is fetched once by `DashboardLayout` and
// passed down (00 §16.9 — layout components hold no business logic).

const ACCOUNT_MENU_ID = 'dashboard-account-menu'
const accountMenuItemSx = { minHeight: 44 }

/**
 * The bell. Prompt 27 replaces the click behaviour with the notifications
 * dropdown; until the notifications screen is registered in `navConfig`, the
 * button is inert and says so, but it still carries the live badge.
 */
function NotificationBell({ unreadCount, notificationsPath }) {
  const hasUnread = unreadCount > 0
  const label = hasUnread
    ? `Notifications — ${unreadCount} unread`
    : 'Notifications — none unread'

  return (
    <Tooltip title={notificationsPath ? 'Notifications' : 'Notifications — coming soon'}>
      <IconButton
        aria-label={label}
        sx={{ width: 44, height: 44 }}
        {...(notificationsPath ? { component: RouterLink, to: notificationsPath } : {})}
      >
        <Badge
          badgeContent={unreadCount}
          max={99}
          color="error"
          overlap="circular"
          sx={{ '& .MuiBadge-badge': { fontSize: '0.625rem', height: 16, minWidth: 16 } }}
        >
          <Icon icon="solar:bell-linear" width={22} aria-hidden="true" />
        </Badge>
      </IconButton>
    </Tooltip>
  )
}

function AccountMenu({ user, profilePath, settingsPath, onLogout }) {
  const [anchorEl, setAnchorEl] = useState(null)
  const open = Boolean(anchorEl)
  const close = () => setAnchorEl(null)

  // Profile and Settings appear the moment Prompts 15/21 register their nav
  // entries — the menu is derived from `navConfig`, never from a hardcoded list
  // that could point at a screen nobody has built.
  const links = [
    profilePath && { key: 'profile', label: 'Profile', icon: 'tabler:user', to: profilePath },
    settingsPath && { key: 'settings', label: 'Settings', icon: 'tabler:settings', to: settingsPath },
    {
      key: 'site',
      label: `View ${appConfig.appName}`,
      icon: 'tabler:external-link',
      to: paths.HOME,
    },
  ].filter(Boolean)

  return (
    <>
      <IconButton
        onClick={(event) => setAnchorEl(event.currentTarget)}
        aria-label={`Account menu for ${user?.name ?? 'your account'}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? ACCOUNT_MENU_ID : undefined}
        sx={{ width: 44, height: 44 }}
      >
        <UserAvatar name={user?.name} src={user?.avatarUrl} size="sm" />
      </IconButton>

      <Menu
        id={ACCOUNT_MENU_ID}
        anchorEl={anchorEl}
        open={open}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 248, mt: 1 } } }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle2" noWrap>
            {user?.name}
          </Typography>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5 }}>
            <Chip
              size="small"
              label={ROLE_META[user?.role]?.label ?? user?.role}
              sx={{
                height: 20,
                fontSize: '0.6875rem',
                bgcolor: 'primary.surface',
                color: 'primary.dark',
              }}
            />
            <Typography variant="caption" color="text.secondary" noWrap>
              {user?.email}
            </Typography>
          </Stack>
        </Box>

        <Divider />

        {links.map((link) => (
          <MenuItem
            key={link.key}
            component={RouterLink}
            to={link.to}
            onClick={close}
            sx={accountMenuItemSx}
          >
            <ListItemIcon>
              <Icon icon={link.icon} width={20} />
            </ListItemIcon>
            {link.label}
          </MenuItem>
        ))}

        <Divider />

        <MenuItem
          onClick={() => {
            close()
            onLogout()
          }}
          sx={accountMenuItemSx}
        >
          <ListItemIcon>
            <Icon icon="tabler:logout" width={20} />
          </ListItemIcon>
          Log out
        </MenuItem>
      </Menu>
    </>
  )
}

/**
 * @param {object} props
 * @param {object} props.user the signed-in member
 * @param {boolean} props.isDesktop `true` at or above `md` — hides the brand mark
 * @param {number} [props.unreadCount=0] live bell badge count
 * @param {string} [props.notificationsPath] set once the notifications screen exists
 * @param {string} [props.profilePath] set once the role's profile screen exists
 * @param {string} [props.settingsPath] set once the role's settings screen exists
 * @param {() => void} props.onLogout sign-out handler
 */
export default function TopBar({
  user,
  isDesktop,
  unreadCount = 0,
  notificationsPath,
  profilePath,
  settingsPath,
  onLogout,
}) {
  const title = useDashboardPageTitle()

  return (
    <AppBar component="header" position="sticky" sx={{ zIndex: (theme) => theme.zIndex.appBar }}>
      <Toolbar
        sx={{
          gap: 1,
          px: { xs: 2, sm: 3, md: 4 },
          minHeight: { xs: appConfig.topNavHeight.xs, md: appConfig.topNavHeight.md },
        }}
      >
        {isDesktop ? null : <Logo variant="mark" size={28} asLink />}

        <Typography
          variant="subtitle1"
          component="p"
          noWrap
          sx={{ flexGrow: 1, minWidth: 0, fontWeight: 700 }}
        >
          {title}
        </Typography>

        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
          <NotificationBell unreadCount={unreadCount} notificationsPath={notificationsPath} />
          <AccountMenu
            user={user}
            profilePath={profilePath}
            settingsPath={settingsPath}
            onLogout={onLogout}
          />
        </Stack>
      </Toolbar>
    </AppBar>
  )
}
