import { useEffect, useState } from 'react'

import { Icon } from '@iconify/react'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Container from '@mui/material/Container'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import useScrollTrigger from '@mui/material/useScrollTrigger'
import { motion } from 'framer-motion'
import { NavLink, Link as RouterLink, useLocation } from 'react-router-dom'

import Logo from '@/components/brand/Logo'
import UserAvatar from '@/components/data-display/UserAvatar'
import { listItem, staggerContainer } from '@/components/motion/motionPresets'
import { appConfig } from '@/config/appConfig'
import { ROLE_META } from '@/constants/roles'
import { useAuth } from '@/context/AuthContext'
import { paths } from '@/routes/paths'
import { cssEasing, durations } from '@/theme/motionTokens'
import { brandGradient } from '@/theme/palette'

// The signed-out top navigation: sticky, 64px on desktop and 56px on mobile,
// flat until the page scrolls past 8px and then lifted by one elevation step.
// Below `lg` the links collapse into a full-height drawer — MUI's Drawer brings
// the focus trap, Escape handling, and focus return with it, and Framer only
// staggers the links inside so the panel feels native rather than animated.
//
// The bar collapses at `lg`, not `md`: V2-02's six items plus the wordmark and
// both auth CTAs need about 1100px to sit on one line, and at 900px they wrap
// into a two-line bar. The drawer carries exactly the same six links, so
// nothing is lost between 900px and 1200px — it is one tap away instead.

// The storefront menu (V2-02), in this order on desktop and in the drawer.
//
// `end` marks the one link that must match exactly: every path starts with
// `/`, so Home would otherwise be "active" on every page. Every other link
// matches its subtree, which is what makes `/feeds/req_…` highlight Feeds.
//
// Feeds is listed unconditionally. Before V2 it was hidden while
// `features.publicRequestBoard` was off; the flag still governs what the page
// *shows* (`BoardUnavailable`), but the nav is now a fixed six items — a link
// to a page that explains itself beats a menu that changes shape.
const NAV_LINKS = [
  { key: 'home', label: 'Home', to: paths.HOME, end: true },
  { key: 'feeds', label: 'Feeds', to: paths.FEEDS },
  { key: 'creators', label: 'Creators', to: paths.CREATORS },
  { key: 'how-it-works', label: 'How It Works', to: paths.HOW_IT_WORKS },
  { key: 'pricing', label: 'Pricing', to: paths.PRICING },
  { key: 'wallet', label: 'Wallet', to: paths.WALLET },
]

const MENU_ID = 'public-nav-menu'
const ACCOUNT_MENU_ID = 'public-nav-account-menu'

const accountMenuItemSx = { minHeight: 44 }

/** Role chip + name + address — the header of both account surfaces below. */
function AccountSummary({ user }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
      <UserAvatar name={user.name} src={user.avatarUrl} size="md" />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle2" noWrap>
          {user.name}
        </Typography>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.25 }}>
          <Chip
            size="small"
            label={ROLE_META[user.role]?.label ?? user.role}
            sx={{
              height: 20,
              fontSize: '0.6875rem',
              fontWeight: 600,
              bgcolor: 'primary.surface',
              color: 'primary.light',
            }}
          />
          <Typography variant="caption" color="text.secondary" noWrap>
            {user.email}
          </Typography>
        </Stack>
      </Box>
    </Stack>
  )
}

/**
 * The signed-in account area on desktop — avatar button, and a menu with the
 * two things a member wants from the public site: back to their dashboard, or
 * out. MUI's Menu brings the focus trap, arrow-key navigation, Escape, and
 * focus return with it.
 */
function AccountMenu({ user, onLogout }) {
  const [anchorEl, setAnchorEl] = useState(null)
  const open = Boolean(anchorEl)

  return (
    <>
      <IconButton
        onClick={(event) => setAnchorEl(event.currentTarget)}
        aria-label={`Account menu for ${user.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? ACCOUNT_MENU_ID : undefined}
        sx={{ width: 44, height: 44 }}
      >
        <UserAvatar name={user.name} src={user.avatarUrl} size="sm" />
      </IconButton>

      <Menu
        id={ACCOUNT_MENU_ID}
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 260, mt: 1 } } }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <AccountSummary user={user} />
        </Box>

        <Divider />

        {/* MUI's own menu density drops below the 44px touch target this
            product holds itself to (00 §13), and the avatar is reachable on a
            phone, so the floor is set explicitly. */}
        <MenuItem
          component={RouterLink}
          to={paths.roleHome(user.role)}
          onClick={() => setAnchorEl(null)}
          sx={accountMenuItemSx}
        >
          <ListItemIcon>
            <Icon icon="tabler:layout-dashboard" width={20} />
          </ListItemIcon>
          Go to dashboard
        </MenuItem>

        <MenuItem
          onClick={() => {
            setAnchorEl(null)
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

// `NavLink` sets aria-current="page" and an `active` class on the matching link
// on its own — the styles below just make that state visible. The accent is the
// V2 brand gradient (docs/theme-v2.md §4): a 2px underline on desktop, a rail
// down the left edge in the drawer. Both are `::after`/`::before` decoration,
// so nothing moves and no layout shifts between states.
const desktopLinkSx = {
  position: 'relative',
  px: 1.75,
  color: 'text.secondary',
  '&:hover': { color: 'text.primary' },
  '&.active': {
    color: 'primary.light',
    backgroundColor: 'primary.surface',
    '&::after': {
      content: '""',
      position: 'absolute',
      left: 10,
      right: 10,
      bottom: 4,
      height: 2,
      borderRadius: 1,
      background: brandGradient,
    },
  },
}

const drawerLinkSx = {
  position: 'relative',
  justifyContent: 'flex-start',
  minHeight: 48,
  px: 2,
  color: 'text.primary',
  fontSize: '1rem',
  '&.active': {
    color: 'primary.light',
    backgroundColor: 'primary.surface',
    '&::before': {
      content: '""',
      position: 'absolute',
      left: 0,
      top: 8,
      bottom: 8,
      width: 3,
      borderRadius: 4,
      background: brandGradient,
    },
  },
}

export default function PublicTopNav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()
  const elevated = useScrollTrigger({ disableHysteresis: true, threshold: 8 })
  // `AuthContext` reads the stored session synchronously on first render, so
  // the signed-in nav is correct immediately — a returning member never sees
  // "Log in" flash before their avatar (Prompt 09).
  const { user, isAuthenticated, logout } = useAuth()

  // Navigating from inside the drawer should leave it behind.
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  return (
    <AppBar
      component="header"
      position="sticky"
      sx={{
        boxShadow: (theme) => (elevated ? theme.customShadows.z1 : 'none'),
        transition: `box-shadow ${durations.fast}ms ${cssEasing}`,
      }}
    >
      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 } }}>
        <Toolbar
          disableGutters
          sx={{
            gap: 1,
            minHeight: {
              xs: appConfig.topNavHeight.xs,
              md: appConfig.topNavHeight.md,
            },
          }}
        >
          <Logo asLink size={28} />

          <Box
            component="nav"
            aria-label="Primary"
            sx={{ display: { xs: 'none', lg: 'flex' }, alignItems: 'center', ml: 2, gap: 0.5 }}
          >
            {NAV_LINKS.map((link) => (
              <Button
                key={link.key}
                component={NavLink}
                to={link.to}
                end={link.end}
                sx={desktopLinkSx}
              >
                {link.label}
              </Button>
            ))}
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* AUTH SLOT — the account menu once signed in, the two CTAs before
              then. The avatar stays visible below `md` too: it is the only way
              to reach a dashboard from a phone without opening the drawer. */}
          {isAuthenticated ? (
            <AccountMenu user={user} onLogout={logout} />
          ) : (
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ display: { xs: 'none', lg: 'flex' } }}
            >
              <Button component={NavLink} to={paths.LOGIN} sx={{ color: 'text.primary' }}>
                Log in
              </Button>
              <Button component={NavLink} to={paths.REGISTER} variant="gradient">
                Join BetterBlue
              </Button>
            </Stack>
          )}

          <IconButton
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation menu"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? MENU_ID : undefined}
            sx={{ display: { lg: 'none' }, width: 44, height: 44 }}
          >
            <Icon icon="tabler:menu-2" width={24} />
          </IconButton>
        </Toolbar>
      </Container>

      <Drawer
        id={MENU_ID}
        anchor="right"
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        transitionDuration={durations.base}
        PaperProps={{ sx: { width: { xs: '100%', sm: 400 }, maxWidth: '100%' } }}
      >
        <Stack sx={{ height: '100%' }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{
              px: 2,
              minHeight: appConfig.topNavHeight.xs,
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Logo variant="mark" size={28} />
            <IconButton
              onClick={() => setMenuOpen(false)}
              aria-label="Close navigation menu"
              sx={{ width: 44, height: 44 }}
            >
              <Icon icon="tabler:x" width={22} />
            </IconButton>
          </Stack>

          <Box
            component="nav"
            aria-label="Primary"
            sx={{ flexGrow: 1, overflowY: 'auto', px: 1, py: 2 }}
          >
            <Box
              component={motion.ul}
              variants={staggerContainer(0.05)}
              initial="hidden"
              animate="visible"
              sx={{ listStyle: 'none', m: 0, p: 0 }}
            >
              {NAV_LINKS.map((link) => (
                <Box component={motion.li} key={link.key} variants={listItem}>
                  <Button
                    component={NavLink}
                    to={link.to}
                    end={link.end}
                    fullWidth
                    sx={drawerLinkSx}
                  >
                    {link.label}
                  </Button>
                </Box>
              ))}
            </Box>
          </Box>

          <Divider />

          {/* AUTH SLOT (mobile) — the same two states as the desktop slot,
              laid out as full-width targets for a thumb. */}
          <Stack
            spacing={1}
            sx={{
              p: 2,
              pb: 'max(16px, env(safe-area-inset-bottom))',
            }}
          >
            {isAuthenticated ? (
              <>
                <Box sx={{ pb: 1 }}>
                  <AccountSummary user={user} />
                </Box>
                <Button
                  component={NavLink}
                  to={paths.roleHome(user.role)}
                  variant="gradient"
                  size="large"
                  startIcon={<Icon icon="tabler:layout-dashboard" width={20} />}
                >
                  Go to dashboard
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => {
                    setMenuOpen(false)
                    logout()
                  }}
                  startIcon={<Icon icon="tabler:logout" width={20} />}
                >
                  Log out
                </Button>
              </>
            ) : (
              <>
                <Button component={NavLink} to={paths.REGISTER} variant="gradient" size="large">
                  Join BetterBlue
                </Button>
                <Button component={NavLink} to={paths.LOGIN} variant="outlined" size="large">
                  Log in
                </Button>
              </>
            )}
          </Stack>
        </Stack>
      </Drawer>
    </AppBar>
  )
}
