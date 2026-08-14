import { Suspense } from 'react'

import Box from '@mui/material/Box'
import { AnimatePresence } from 'framer-motion'
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom'

import AppLoader from '@/app/AppLoader'
import PageTransition from '@/components/motion/PageTransition'
import PublicFooter from '@/components/navigation/PublicFooter'
import PublicTopNav from '@/components/navigation/PublicTopNav'

// The shell every signed-out page mounts into: skip link, top nav, animated
// content area, footer. Presentation only — no data, no business logic (00 §16.9).
//
// `<Suspense>` sits inside the shell rather than around it so a lazily-loaded
// page swaps under a nav and footer that never unmount, and `<ScrollRestoration>`
// gives back/forward their scroll position while sending every new navigation
// to the top of the page.

const MAIN_ID = 'main'

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
        // Off-screen but still focusable — a `display: none` skip link is no
        // skip link at all.
        transform: 'translateY(calc(-100% - 16px))',
        '&:focus': { transform: 'translateY(0)' },
      }}
    >
      Skip to main content
    </Box>
  )
}

export default function PublicLayout() {
  const { pathname } = useLocation()

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <SkipToContentLink />
      <PublicTopNav />

      <Box component="main" id={MAIN_ID} tabIndex={-1} sx={{ flexGrow: 1, outline: 'none' }}>
        <Suspense fallback={<AppLoader />}>
          <AnimatePresence mode="wait">
            <PageTransition key={pathname}>
              <Outlet />
            </PageTransition>
          </AnimatePresence>
        </Suspense>
      </Box>

      <PublicFooter />
      <ScrollRestoration />
    </Box>
  )
}
