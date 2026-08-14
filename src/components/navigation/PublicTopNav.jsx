import { useEffect, useState } from 'react'

import { Icon } from '@iconify/react'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Toolbar from '@mui/material/Toolbar'
import useScrollTrigger from '@mui/material/useScrollTrigger'
import { motion } from 'framer-motion'
import { NavLink, useLocation } from 'react-router-dom'

import Logo from '@/components/brand/Logo'
import { listItem, staggerContainer } from '@/components/motion/motionPresets'
import { appConfig } from '@/config/appConfig'
import { paths } from '@/routes/paths'
import { cssEasing, durations } from '@/theme/motionTokens'

// The signed-out top navigation: sticky, 64px on desktop and 56px on mobile,
// flat until the page scrolls past 8px and then lifted by one elevation step.
// Below `md` the links collapse into a full-height drawer — MUI's Drawer brings
// the focus trap, Escape handling, and focus return with it, and Framer only
// staggers the links inside so the panel feels native rather than animated.

const NAV_LINKS = [
  { key: 'creators', label: 'Find Creators', to: paths.CREATORS },
  { key: 'requests', label: 'Browse Requests', to: paths.REQUESTS },
  { key: 'how-it-works', label: 'How It Works', to: paths.HOW_IT_WORKS },
  { key: 'pricing', label: 'Pricing', to: paths.PRICING },
]

const MENU_ID = 'public-nav-menu'

// `NavLink` sets aria-current="page" and an `active` class on the matching link
// on its own — the styles below just make that state visible.
const desktopLinkSx = {
  px: 1.75,
  color: 'text.secondary',
  '&:hover': { color: 'text.primary' },
  '&.active': { color: 'primary.dark', backgroundColor: 'primary.surface' },
}

const drawerLinkSx = {
  justifyContent: 'flex-start',
  minHeight: 48,
  px: 2,
  color: 'text.primary',
  fontSize: '1rem',
  '&.active': { color: 'primary.dark', backgroundColor: 'primary.surface' },
}

export default function PublicTopNav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()
  const elevated = useScrollTrigger({ disableHysteresis: true, threshold: 8 })

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
            sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', ml: 2, gap: 0.5 }}
          >
            {NAV_LINKS.map((link) => (
              <Button key={link.key} component={NavLink} to={link.to} sx={desktopLinkSx}>
                {link.label}
              </Button>
            ))}
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* AUTH SLOT — Prompt 09 swaps these two buttons for the signed-in
              account area (avatar menu, dashboard link, log out) once
              AuthContext exists, and keeps them as the signed-out fallback. */}
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ display: { xs: 'none', md: 'flex' } }}
          >
            <Button component={NavLink} to={paths.LOGIN} sx={{ color: 'text.primary' }}>
              Log in
            </Button>
            <Button component={NavLink} to={paths.REGISTER} variant="gradient">
              Join BetterBlue
            </Button>
          </Stack>

          <IconButton
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation menu"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? MENU_ID : undefined}
            sx={{ display: { md: 'none' }, width: 44, height: 44 }}
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
                  <Button component={NavLink} to={link.to} fullWidth sx={drawerLinkSx}>
                    {link.label}
                  </Button>
                </Box>
              ))}
            </Box>
          </Box>

          <Divider />

          {/* AUTH SLOT (mobile) — same swap as the desktop pair in Prompt 09. */}
          <Stack
            spacing={1}
            sx={{
              p: 2,
              pb: 'max(16px, env(safe-area-inset-bottom))',
            }}
          >
            <Button component={NavLink} to={paths.REGISTER} variant="gradient" size="large">
              Join BetterBlue
            </Button>
            <Button component={NavLink} to={paths.LOGIN} variant="outlined" size="large">
              Log in
            </Button>
          </Stack>
        </Stack>
      </Drawer>
    </AppBar>
  )
}
