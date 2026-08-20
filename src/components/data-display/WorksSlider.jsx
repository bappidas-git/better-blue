import { useCallback, useEffect, useRef, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import { imageUrl } from '@/constants/images'

// A creator's published work, scrolled horizontally — Storefront V2.
//
// Written for the home page's Top Creators row (V2-05) and lifted here
// unchanged by V2-09 so the creators page's `CreatorSocialCard` renders the
// same strip rather than a second implementation of it. Nothing about the
// behaviour moved with it: the tile size, the snap, the arrows, the edge fade,
// the focus ring, and the reduced-motion fallback are the V2-05 originals.
//
// The slider is **pure CSS scroll-snap**: `overflow-x: auto` plus snap points,
// swiped natively on a phone and nudged by two buttons on a desktop. The only
// JavaScript is a `scrollBy` per button and a check of where the strip has got
// to, so the buttons can say when there is nothing left in that direction.

/** One work tile: a fixed box that reserves its space before the photo lands. */
const TILE_WIDTH = { xs: 132, sm: 156 }
const TILE_RATIO = '4 / 3'

/** Requested thumbnail size — matches the tile ratio, so nothing is re-scaled. */
const THUMB = { width: 320, height: 240 }

/** How far a click on an arrow travels: most of the strip, then snap. */
const SCROLL_FRACTION = 0.8

/** How wide the fade at a scrollable edge is, in px. */
const EDGE_FADE = 24

/**
 * Slack allowed when deciding whether a strip is at one of its ends. Scroll
 * offsets are fractional and snapping lands on sub-pixel positions, so an exact
 * comparison leaves an arrow enabled with nowhere to go.
 */
const EDGE_TOLERANCE = 2

/**
 * The edge fade, drawn only on the sides that have something behind them — a
 * strip at rest keeps its first tile at full strength, and the fade appears as
 * soon as there is work scrolled past it.
 *
 * A mask reads the **alpha** channel of its gradient, so the opaque stop is a
 * placeholder for "keep this part" and carries no palette meaning — which is
 * why it is a bare `#000` rather than a theme colour (docs/theme-v2.md §11 bans
 * colour literals; this paints nothing).
 *
 * @param {{start: boolean, end: boolean}} edges which sides have more to show
 * @returns {string} a `mask-image` value, or `none` when nothing scrolls
 */
function fadeMask({ start, end }) {
  if (!start && !end) return 'none'

  return [
    'linear-gradient(to right,',
    start ? 'transparent 0,' : '#000 0,',
    `#000 ${EDGE_FADE}px,`,
    `#000 calc(100% - ${EDGE_FADE}px),`,
    end ? 'transparent 100%)' : '#000 100%)',
  ].join(' ')
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

/**
 * A strip that overflows is a named, focusable region, so it takes arrow keys
 * on every breakpoint — including the ones where the buttons are hidden and a
 * keyboard would otherwise have no way to move it at all.
 *
 * @param {object} props
 * @param {object[]} props.items published portfolio items
 * @param {string} props.creatorName whose work this is — used in the labels
 * @param {string} [props.emptyLabel] what an empty storefront says
 */
export default function WorksSlider({
  items,
  creatorName,
  emptyLabel = 'No published work on this storefront yet.',
}) {
  const stripRef = useRef(null)
  const [edges, setEdges] = useState({ start: false, end: false })
  const [ringed, setRinged] = useState(false)

  const list = Array.isArray(items) ? items : []

  // Where the strip has got to, so the arrows can be disabled at the ends and
  // dropped entirely when everything already fits. The updater returns the
  // previous object when nothing changed, so React bails out and a scroll
  // gesture does not re-render the card on every frame.
  const syncEdges = useCallback(() => {
    const strip = stripRef.current
    if (!strip) return

    const remaining = strip.scrollWidth - strip.clientWidth - strip.scrollLeft
    const start = strip.scrollLeft > EDGE_TOLERANCE
    const end = remaining > EDGE_TOLERANCE

    setEdges((previous) =>
      previous.start === start && previous.end === end ? previous : { start, end }
    )
  }, [])

  useEffect(() => {
    const strip = stripRef.current
    if (!strip) return undefined

    syncEdges()
    strip.addEventListener('scroll', syncEdges, { passive: true })
    // A breakpoint change alters how many tiles fit, and with it whether the
    // arrows are needed at all.
    window.addEventListener('resize', syncEdges)

    return () => {
      strip.removeEventListener('scroll', syncEdges)
      window.removeEventListener('resize', syncEdges)
    }
  }, [syncEdges, list.length])

  const scrollStrip = useCallback((direction) => {
    const strip = stripRef.current
    if (!strip) return

    strip.scrollBy({
      left: direction * Math.round(strip.clientWidth * SCROLL_FRACTION),
      // Reduced motion gets the same destination without the travel.
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }, [])

  /**
   * The strip's focus ring is drawn on the wrapper below rather than on the
   * strip itself, because an outline paints *outside* the border box and the
   * edge-fade mask clips everything the strip paints — a ring on the strip is
   * invisible however bright it is. The wrapper is unmasked, so the ring
   * survives; the mirror of `:focus-visible` keeps it off a mouse click.
   */
  const handleStripFocus = (event) => setRinged(event.target.matches(':focus-visible'))

  if (list.length === 0) {
    return (
      <Typography variant="body2" color="text.disabled">
        {emptyLabel}
      </Typography>
    )
  }

  const canScroll = edges.start || edges.end

  const arrowSx = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 2,
    // Desktop affordance only: a phone swipes the strip, and `display: none`
    // keeps the buttons out of the tab order there as well as out of sight.
    display: { xs: 'none', md: 'inline-flex' },
    bgcolor: 'background.elevated',
    border: 1,
    borderColor: 'divider',
    '&:hover': { bgcolor: 'background.paper' },
    '&.Mui-disabled': { opacity: 0.35, bgcolor: 'background.elevated' },
  }

  return (
    <Box
      sx={{
        position: 'relative',
        borderRadius: 'var(--bb-radius-sm)',
        ...(ringed
          ? {
              outline: (theme) => `2px solid ${theme.palette.primary.light}`,
              outlineOffset: 2,
            }
          : null),
      }}
    >
      {canScroll ? (
        <IconButton
          size="small"
          onClick={() => scrollStrip(-1)}
          disabled={!edges.start}
          aria-label={`Show earlier work by ${creatorName}`}
          sx={{ ...arrowSx, left: 0 }}
        >
          <Icon icon="tabler:chevron-left" width={20} />
        </IconButton>
      ) : null}

      <Box
        ref={stripRef}
        component="ul"
        // A scroll container only a mouse or a finger can move is unusable from
        // a keyboard, so a strip with somewhere to go takes a tab stop. One
        // that already fits does not — a dead tab stop is worse than none.
        tabIndex={canScroll ? 0 : -1}
        aria-label={`Published work by ${creatorName}`}
        onFocus={handleStripFocus}
        onBlur={() => setRinged(false)}
        sx={{
          display: 'flex',
          gap: 1,
          listStyle: 'none',
          m: 0,
          p: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollSnapType: 'x mandatory',
          maskImage: fadeMask(edges),
          WebkitMaskImage: fadeMask(edges),
          // The ring lives on the wrapper — see `handleStripFocus`.
          '&:focus-visible': { outline: 'none' },
        }}
      >
        {list.map((item) => (
          <Box
            component="li"
            key={item.id}
            sx={{
              flex: '0 0 auto',
              width: TILE_WIDTH,
              aspectRatio: TILE_RATIO,
              borderRadius: 'var(--bb-radius-sm)',
              overflow: 'hidden',
              bgcolor: 'primary.surface',
              scrollSnapAlign: 'start',
            }}
          >
            <Box
              component="img"
              src={item.thumbnailUrl || imageUrl(item.id, THUMB.width, THUMB.height)}
              alt={item.title}
              loading="lazy"
              decoding="async"
              sx={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </Box>
        ))}
      </Box>

      {canScroll ? (
        <IconButton
          size="small"
          onClick={() => scrollStrip(1)}
          disabled={!edges.end}
          aria-label={`Show more work by ${creatorName}`}
          sx={{ ...arrowSx, right: 0 }}
        >
          <Icon icon="tabler:chevron-right" width={20} />
        </IconButton>
      ) : null}
    </Box>
  )
}

/**
 * The strip's placeholder — the same tiles at the same size, so a card does not
 * reflow when the work lands.
 *
 * A component rather than two exported size tokens: the tile geometry stays
 * private to this module, and both cards that show a loading strip
 * (`TopCreatorsSection`, `CreatorSocialCard`) render the same one.
 *
 * @param {object} props
 * @param {number} [props.count=6] tiles to draw
 * @param {object} [props.sx] MUI system styles on the row
 */
export function WorksSliderSkeleton({ count = 6, sx }) {
  return (
    <Stack direction="row" spacing={1} sx={{ overflow: 'hidden', ...sx }}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton
          key={index}
          variant="rounded"
          sx={{ flex: '0 0 auto', width: TILE_WIDTH, aspectRatio: TILE_RATIO, height: 'auto' }}
        />
      ))}
    </Stack>
  )
}
