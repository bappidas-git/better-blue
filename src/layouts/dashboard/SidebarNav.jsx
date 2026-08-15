import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { NavLink, Link as RouterLink } from 'react-router-dom'

import Logo from '@/components/brand/Logo'
import UserAvatar from '@/components/data-display/UserAvatar'
import { appConfig } from '@/config/appConfig'
import { ROLE_META } from '@/constants/roles'
import { NAV_FALLBACK_ICON, isNavGroup } from '@/routes/navConfig'
import { paths } from '@/routes/paths'
import { cssEasing, durations } from '@/theme/motionTokens'

// The desktop sidebar (≥ md): brand, the role's nav, and the account footer.
// Presentation only — it renders the entries `DashboardLayout` hands it and
// knows nothing about roles, permissions, or data (00 §16.9).
//
// Collapsed it becomes a 72px icon rail: labels drop out, every destination
// keeps a tooltip, and the state persists in `bb.navCollapsed` so a member's
// choice survives a reload.

/** Expanded width (00 §12 dashboard spec). */
export const SIDEBAR_WIDTH = 264
/** Collapsed icon-rail width. */
export const SIDEBAR_RAIL_WIDTH = 72

const widthTransition = `width ${durations.base}ms ${cssEasing}`

/** Soft primary-tint pill for the destination currently on screen. */
const navItemSx = (collapsed) => ({
  minHeight: 44,
  borderRadius: 2,
  px: collapsed ? 0 : 1.5,
  justifyContent: collapsed ? 'center' : 'flex-start',
  color: 'text.secondary',
  fontWeight: 600,
  '&:hover': { backgroundColor: 'action.hover', color: 'text.primary' },
  '&.active': {
    backgroundColor: 'primary.surface',
    color: 'primary.dark',
    '& .MuiListItemIcon-root': { color: 'primary.main' },
    '&:hover': { backgroundColor: 'primary.lighter' },
  },
})

/** `badges[item.badgeKey]` — a count, or nothing at all. */
function NavBadge({ count, collapsed }) {
  if (!count) return null

  if (collapsed) {
    return (
      <Box
        aria-hidden="true"
        sx={{
          position: 'absolute',
          top: 6,
          right: 12,
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: 'error.main',
        }}
      />
    )
  }

  return (
    <Chip
      size="small"
      label={count > 99 ? '99+' : count}
      color="primary"
      sx={{ height: 20, fontSize: '0.6875rem', ml: 1 }}
    />
  )
}

function NavItem({ item, collapsed, badge }) {
  return (
    <ListItem disablePadding sx={{ mb: 0.25 }}>
      {/* An empty title disables the tooltip, so it only ever appears on the rail. */}
      <Tooltip title={collapsed ? item.label : ''} placement="right">
        <ListItemButton
          component={NavLink}
          to={item.path}
          end={Boolean(item.exact)}
          sx={{ ...navItemSx(collapsed), position: 'relative' }}
        >
          <ListItemIcon
            sx={{
              minWidth: collapsed ? 0 : 36,
              justifyContent: 'center',
              color: 'inherit',
            }}
          >
            <Icon icon={item.icon || NAV_FALLBACK_ICON} width={22} aria-hidden="true" />
          </ListItemIcon>

          {collapsed ? null : (
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{ fontSize: '0.9375rem', fontWeight: 'inherit' }}
            />
          )}

          <NavBadge count={badge} collapsed={collapsed} />
        </ListItemButton>
      </Tooltip>
    </ListItem>
  )
}

/**
 * Footer row that shares the nav pill's geometry — View site, Log out.
 * A plain `Link`, not a `NavLink`: `to="/"` would match every dashboard URL and
 * leave "View BetterBlue" permanently wearing the active pill.
 */
function FooterAction({ icon, label, collapsed, onClick, to }) {
  return (
    <Tooltip title={collapsed ? label : ''} placement="right">
      <ListItemButton
        onClick={onClick}
        {...(to ? { component: RouterLink, to } : {})}
        sx={navItemSx(collapsed)}
      >
        <ListItemIcon
          sx={{ minWidth: collapsed ? 0 : 36, justifyContent: 'center', color: 'inherit' }}
        >
          <Icon icon={icon} width={20} aria-hidden="true" />
        </ListItemIcon>
        {collapsed ? null : (
          <ListItemText
            primary={label}
            primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 'inherit' }}
          />
        )}
      </ListItemButton>
    </Tooltip>
  )
}

/**
 * @param {object} props
 * @param {Array} props.entries permission-filtered items and groups from `navConfig`
 * @param {boolean} props.collapsed render the 72px icon rail
 * @param {() => void} props.onToggleCollapse flips the rail
 * @param {object} props.user the signed-in member (name, avatar, role)
 * @param {() => void} props.onLogout sign-out handler
 * @param {Record<string, number>} [props.badges] counts keyed by `item.badgeKey`
 */
export default function SidebarNav({
  entries = [],
  collapsed = false,
  onToggleCollapse,
  user,
  onLogout,
  badges = {},
}) {
  const width = collapsed ? SIDEBAR_RAIL_WIDTH : SIDEBAR_WIDTH
  const roleLabel = ROLE_META[user?.role]?.label ?? user?.role

  return (
    <Drawer
      variant="permanent"
      sx={{
        width,
        flexShrink: 0,
        transition: widthTransition,
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        '& .MuiDrawer-paper': {
          width,
          boxSizing: 'border-box',
          bgcolor: 'background.paper',
          borderRight: 1,
          borderColor: 'divider',
          overflowX: 'hidden',
          transition: widthTransition,
          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        },
      }}
    >
      <Stack sx={{ height: '100%' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            minHeight: appConfig.topNavHeight.md,
            px: collapsed ? 0 : 2.5,
            borderBottom: 1,
            borderColor: 'divider',
            flexShrink: 0,
          }}
        >
          <Logo variant={collapsed ? 'mark' : 'full'} size={collapsed ? 32 : 30} asLink />
        </Box>

        <Box
          component="nav"
          aria-label="Dashboard"
          sx={{ flexGrow: 1, overflowY: 'auto', overflowX: 'hidden', px: 1.5, py: 2 }}
        >
          <List disablePadding>
            {entries.map((entry) =>
              isNavGroup(entry) ? (
                <Box component="li" key={entry.key} sx={{ listStyle: 'none', mt: 2, '&:first-of-type': { mt: 0 } }}>
                  {collapsed ? (
                    <Divider sx={{ my: 1.5 }} />
                  ) : (
                    <Typography
                      variant="overline"
                      component="p"
                      color="text.secondary"
                      sx={{ px: 1.5, mb: 0.5 }}
                    >
                      {entry.group}
                    </Typography>
                  )}
                  <List disablePadding>
                    {entry.items.map((item) => (
                      <NavItem
                        key={item.key}
                        item={item}
                        collapsed={collapsed}
                        badge={badges[item.badgeKey]}
                      />
                    ))}
                  </List>
                </Box>
              ) : (
                <NavItem
                  key={entry.key}
                  item={entry}
                  collapsed={collapsed}
                  badge={badges[entry.badgeKey]}
                />
              )
            )}
          </List>
        </Box>

        <Box sx={{ flexShrink: 0, px: 1.5, pt: 1, pb: 1.5, borderTop: 1, borderColor: 'divider' }}>
          <Tooltip title={collapsed ? 'Expand navigation' : ''} placement="right">
            <ListItemButton
              onClick={onToggleCollapse}
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
              sx={navItemSx(collapsed)}
            >
              <ListItemIcon
                sx={{ minWidth: collapsed ? 0 : 36, justifyContent: 'center', color: 'inherit' }}
              >
                <Icon
                  icon={collapsed ? 'tabler:layout-sidebar-left-expand' : 'tabler:layout-sidebar-left-collapse'}
                  width={20}
                  aria-hidden="true"
                />
              </ListItemIcon>
              {collapsed ? null : (
                <ListItemText
                  primary="Collapse"
                  primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 'inherit' }}
                />
              )}
            </ListItemButton>
          </Tooltip>

          <Divider sx={{ my: 1 }} />

          {collapsed ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
              <UserAvatar name={user?.name} src={user?.avatarUrl} size="sm" tooltip />
            </Box>
          ) : (
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 1.5, py: 1.25, minWidth: 0 }}>
              <UserAvatar name={user?.name} src={user?.avatarUrl} size="sm" />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" noWrap>
                  {user?.name}
                </Typography>
                <Chip
                  size="small"
                  label={roleLabel}
                  sx={{
                    height: 18,
                    mt: 0.25,
                    fontSize: '0.625rem',
                    bgcolor: 'primary.surface',
                    color: 'primary.dark',
                  }}
                />
              </Box>
            </Stack>
          )}

          <List disablePadding>
            <FooterAction
              icon="tabler:external-link"
              label={`View ${appConfig.appName}`}
              collapsed={collapsed}
              to={paths.HOME}
            />
            <FooterAction
              icon="tabler:logout"
              label="Log out"
              collapsed={collapsed}
              onClick={onLogout}
            />
          </List>
        </Box>
      </Stack>
    </Drawer>
  )
}
