import { useCallback, useEffect, useState } from 'react'

import { Icon } from '@iconify/react'
import Fab from '@mui/material/Fab'
import Zoom from '@mui/material/Zoom'
import useScrollTrigger from '@mui/material/useScrollTrigger'

// The floating way out of a list that has no bottom (V2-07 §1).
//
// Appears after roughly two screens — far enough that it never covers the first
// cards, close enough that it is already there by the time scrolling back by
// hand would be a chore. Computed from the viewport rather than a fixed pixel
// count, so "two screens" means the same thing on a 360px phone and a 27-inch
// display.
//
// It moves focus as well as the page: a keyboard user who activates it and is
// left parked at the bottom of the DOM has been scrolled, not navigated.

/** How many viewport heights of scrolling before the button appears. */
const SCREENS = 2

const viewportThreshold = () =>
  typeof window === 'undefined' ? Number.POSITIVE_INFINITY : window.innerHeight * SCREENS

/**
 * @param {object} props
 * @param {string} [props.targetId] element to focus after scrolling — give it
 *   `tabIndex={-1}` so it can take focus without becoming a tab stop
 * @param {string} [props.label='Back to top'] accessible name and tooltip
 */
export default function BackToTopButton({ targetId, label = 'Back to top' }) {
  const [threshold, setThreshold] = useState(viewportThreshold)

  useEffect(() => {
    const onResize = () => setThreshold(viewportThreshold())
    onResize()
    window.addEventListener('resize', onResize, { passive: true })
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const isVisible = useScrollTrigger({ disableHysteresis: true, threshold })

  const scrollToTop = useCallback(() => {
    // `scroll-behavior` is a CSS property the reduced-motion block cannot reach
    // from here, so the preference is read directly (docs/theme-v2.md §7).
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' })

    const target = targetId ? document.getElementById(targetId) : null
    target?.focus?.({ preventScroll: true })
  }, [targetId])

  return (
    <Zoom in={isVisible} unmountOnExit>
      <Fab
        color="primary"
        size="medium"
        onClick={scrollToTop}
        aria-label={label}
        title={label}
        sx={{
          position: 'fixed',
          right: { xs: 16, md: 32 },
          bottom: { xs: 'max(16px, env(safe-area-inset-bottom))', md: 32 },
          zIndex: (theme) => theme.zIndex.fab,
          // Depth, not a halo: the open deal chips already carry the one glow a
          // viewport is allowed at rest (docs/theme-v2.md §5).
          boxShadow: (theme) => theme.customShadows.z2,
        }}
      >
        <Icon icon="tabler:arrow-up" width={22} aria-hidden="true" />
      </Fab>
    </Zoom>
  )
}
