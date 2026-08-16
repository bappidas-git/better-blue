import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'

import Box from '@mui/material/Box'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { AnimatePresence, motion } from 'framer-motion'
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom'

import AppLoader from '@/app/AppLoader'
import { useAuth } from '@/context/AuthContext'
import useApiQuery from '@/hooks/useApiQuery'
import { ROLES } from '@/constants/roles'
import {
  BADGE_KEY,
  NAV_KEY,
  findNavItem,
  flattenNavEntries,
  getMoreNavKeys,
  getNavForUser,
  isNavItemActive,
  splitBottomNav,
} from '@/routes/navConfig'
import useNotifications from '@/hooks/useNotifications'
import { disputeService } from '@/services/disputeService'
import { orderService } from '@/services/orderService'
import { portfolioService } from '@/services/portfolioService'
import { proposalService } from '@/services/proposalService'
import { requestService } from '@/services/requestService'
import { settingsService, SETTINGS_FALLBACK } from '@/services/settingsService'
import { durations, easing } from '@/theme/motionTokens'
import { storage } from '@/utils/storage'

import { DashboardPageProvider } from './DashboardPageContext'
import MobileBottomNav, { BOTTOM_NAV_HEIGHT } from './MobileBottomNav'
import MoreSheet from './MoreSheet'
import SidebarNav from './SidebarNav'
import TopBar from './TopBar'

// The one dashboard shell, shared by buyer, creator, admin, and super admin
// (00 §12). Mounted as a layout route between `RoleRoute` and each area's route
// table, so every dashboard URL renders inside it — including the ones no
// prompt has built yet.
//
//   ≥ md   fixed 264px sidebar (collapsible to a 72px rail) + sticky top bar
//   < md   sticky app bar + fixed bottom bar (≤ 5 slots) + "More" sheet
//
// What it knows: the session, and the unread notification count for the bell.
// Everything else — which destinations exist, which of them this member may
// see, which collapse into "More" — is data from `routes/navConfig.jsx`.

const MAIN_ID = 'dashboard-main'

/** Storage key for the sidebar rail, per the Prompt 14 spec. */
const NAV_COLLAPSED_KEY = 'navCollapsed'

// Snappier than the public page transition: a dashboard is a workspace, and a
// 250ms rise between screens reads as lag once you are clicking through it.
// Opacity only — no transform to shift a table under the pointer.
const contentVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: durations.fast / 1000, ease: easing } },
  exit: { opacity: 0, transition: { duration: durations.fast / 1000, ease: easing } },
}

function SkipToContentLink() {
  return (
    <Box
      component="a"
      href={`#${MAIN_ID}`}
      sx={{
        position: 'fixed',
        top: 8,
        left: 8,
        zIndex: (theme) => theme.zIndex.tooltip + 1,
        px: 2,
        py: 1.25,
        borderRadius: 1.5,
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        fontWeight: 600,
        fontSize: '0.875rem',
        textDecoration: 'none',
        boxShadow: (theme) => theme.customShadows.z2,
        transform: 'translateY(calc(-100% - 16px))',
        '&:focus': { transform: 'translateY(0)' },
      }}
    >
      Skip to main content
    </Box>
  )
}

export default function DashboardLayout() {
  const theme = useTheme()
  const { pathname } = useLocation()
  const { user, logout } = useAuth()

  // `noSsr` resolves the query synchronously on first render, so a phone never
  // paints the desktop sidebar for a frame before swapping to the bottom bar.
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })

  const [collapsed, setCollapsed] = useState(() => storage.get(NAV_COLLAPSED_KEY, false) === true)
  const [moreOpen, setMoreOpen] = useState(false)

  const toggleCollapsed = useCallback(() => {
    setCollapsed((previous) => {
      const next = !previous
      storage.set(NAV_COLLAPSED_KEY, next)
      return next
    })
  }, [])

  // Navigating from inside the sheet should leave it behind — and so should
  // rotating a phone into the desktop breakpoint.
  useEffect(() => {
    setMoreOpen(false)
  }, [pathname, isDesktop])

  // Prompt 34: a nav entry can be gated on a platform feature flag, so the
  // shell needs the flags. `settingsService` caches them for a minute and every
  // dashboard screen reads the same cache, so this is one request per session
  // rather than one per navigation — and it never blocks the nav, which falls
  // back to the bundled defaults until the settings land (`isNavItemVisible`).
  const { data: settings } = useApiQuery(
    () => settingsService.getSettings().catch(() => SETTINGS_FALLBACK),
    []
  )
  const features = settings?.features

  const entries = useMemo(() => getNavForUser(user, features), [features, user])
  const items = useMemo(() => flattenNavEntries(entries), [entries])
  const { primary, more } = useMemo(
    () => splitBottomNav(items, getMoreNavKeys(user?.role)),
    [items, user?.role]
  )
  const moreActive = useMemo(
    () => more.some((item) => isNavItemActive(pathname, item)),
    [more, pathname]
  )

  // Resolved from the nav rather than hardcoded, so the bell and the account
  // menu light up exactly when Prompts 15/21/27 register those screens.
  const notificationsPath = findNavItem(entries, NAV_KEY.NOTIFICATIONS)?.path
  const profilePath = findNavItem(entries, NAV_KEY.PROFILE)?.path
  const settingsPath = findNavItem(entries, NAV_KEY.SETTINGS)?.path

  // Prompt 27: the unread count now comes from the shared `useNotifications`
  // cache rather than a query of its own, so the nav badge, the bell in the top
  // bar, and the notifications page all read one number refreshed by one poll.
  // Failures are swallowed inside the hook (§13 — an unread count is never worth
  // blocking a dashboard for).
  const { unreadCount } = useNotifications()

  // Nav badges, keyed by `item.badgeKey`. Each prompt adds its own query here
  // and its key to `BADGE_KEY`; like the bell, a failure is swallowed rather
  // than allowed to block the shell (Prompt 14 §5).
  const isBuyer = user?.role === ROLES.BUYER
  const { data: proposalsAwaiting } = useApiQuery(
    () => requestService.countProposalsAwaitingDecision(user?.id),
    [user?.id, pathname],
    { enabled: Boolean(user?.id) && isBuyer }
  )

  const { data: ordersAwaitingReview } = useApiQuery(
    () => orderService.countAwaitingReview(user?.id),
    [user?.id, pathname],
    { enabled: Boolean(user?.id) && isBuyer }
  )

  // Prompt 22: portfolio items a reviewer rejected or handed back for changes.
  const isCreator = user?.role === ROLES.CREATOR
  const { data: portfolioAttention } = useApiQuery(
    () => portfolioService.countNeedingAttention(user?.id),
    [user?.id, pathname],
    { enabled: Boolean(user?.id) && isCreator }
  )

  // Prompt 23: proposals a buyer has shortlisted and not yet decided on.
  const { data: proposalsShortlisted } = useApiQuery(
    () => proposalService.countShortlisted(user?.id),
    [user?.id, pathname],
    { enabled: Boolean(user?.id) && isCreator }
  )

  // Prompt 24: orders whose next move is the creator's — waiting to be
  // delivered, or sent back for changes.
  const { data: ordersAwaitingDelivery } = useApiQuery(
    () => orderService.countAwaitingDelivery(user?.id),
    [user?.id, pathname],
    { enabled: Boolean(user?.id) && isCreator }
  )

  // Prompt 26: disputes waiting on this member's response. One query for both
  // roles — `countAwaitingResponse` picks `awaiting_buyer` or `awaiting_creator`
  // from the role it is given, so the two navs share a badge key.
  const { data: disputesAwaiting } = useApiQuery(
    () => disputeService.countAwaitingResponse(user?.id, user?.role),
    [user?.id, user?.role, pathname],
    { enabled: Boolean(user?.id) && (isBuyer || isCreator) }
  )

  const badges = useMemo(
    () => ({
      [BADGE_KEY.BUYER_PROPOSALS_AWAITING]: proposalsAwaiting ?? 0,
      [BADGE_KEY.BUYER_ORDERS_AWAITING_REVIEW]: ordersAwaitingReview ?? 0,
      [BADGE_KEY.CREATOR_PORTFOLIO_ATTENTION]: portfolioAttention ?? 0,
      [BADGE_KEY.CREATOR_PROPOSALS_SHORTLISTED]: proposalsShortlisted ?? 0,
      [BADGE_KEY.CREATOR_ORDERS_AWAITING_DELIVERY]: ordersAwaitingDelivery ?? 0,
      [BADGE_KEY.DISPUTES_AWAITING_RESPONSE]: disputesAwaiting ?? 0,
      [BADGE_KEY.NOTIFICATIONS_UNREAD]: unreadCount,
    }),
    [
      disputesAwaiting,
      unreadCount,
      ordersAwaitingDelivery,
      ordersAwaitingReview,
      portfolioAttention,
      proposalsAwaiting,
      proposalsShortlisted,
    ]
  )

  return (
    <DashboardPageProvider>
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
        <SkipToContentLink />

        {isDesktop ? (
          <SidebarNav
            entries={entries}
            collapsed={collapsed}
            onToggleCollapse={toggleCollapsed}
            user={user}
            onLogout={logout}
            badges={badges}
          />
        ) : null}

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            minWidth: 0,
            minHeight: '100vh',
          }}
        >
          <TopBar
            user={user}
            isDesktop={isDesktop}
            notificationsPath={notificationsPath}
            profilePath={profilePath}
            settingsPath={settingsPath}
            onLogout={logout}
          />

          <Box
            component="main"
            id={MAIN_ID}
            tabIndex={-1}
            sx={{
              flexGrow: 1,
              outline: 'none',
              // Clears the fixed bottom bar — its height, its hairline top
              // border, and the home indicator underneath it.
              pb: isDesktop
                ? 0
                : `calc(${BOTTOM_NAV_HEIGHT + 1}px + env(safe-area-inset-bottom))`,
            }}
          >
            <Suspense fallback={<AppLoader />}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={pathname}
                  variants={contentVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  <Outlet />
                </motion.div>
              </AnimatePresence>
            </Suspense>
          </Box>

          {isDesktop ? null : (
            <MobileBottomNav
              items={primary}
              moreItems={more}
              moreActive={moreActive}
              moreOpen={moreOpen}
              onMoreClick={() => setMoreOpen(true)}
              badges={badges}
            />
          )}
        </Box>

        {isDesktop ? null : (
          <MoreSheet
            open={moreOpen}
            onClose={() => setMoreOpen(false)}
            items={more}
            badges={badges}
          />
        )}

        <ScrollRestoration />
      </Box>
    </DashboardPageProvider>
  )
}
