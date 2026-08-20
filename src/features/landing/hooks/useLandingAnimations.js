import { useLayoutEffect, useRef } from 'react'

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import { distances, durations } from '@/theme/motionTokens'

// The landing page's GSAP layer — 00 §7: GSAP (+ScrollTrigger) is for marketing
// surfaces only, and never shares an element with Framer Motion.
//
// Everything lives in this one hook so the page components stay declarative and
// there is a single place to audit motion. Three rules it enforces:
//
// 1. **Nothing is hidden in CSS.** Hidden states are applied here, at runtime,
//    with `from()`/`set()`. If this hook never runs — reduced motion, a JS
//    failure, a crawler — the page renders complete and readable (00 §7, §13).
// 2. **Reduced motion is a hard gate.** `gsap.matchMedia` registers the
//    animations only under `(prefers-reduced-motion: no-preference)` and reverts
//    them the moment the setting changes, mid-session included.
// 3. **Transform and opacity only**, so a scroll never triggers layout.
//
// Elements opt in through data attributes rather than selector coupling:
//   [data-landing-hero-copy]   staggered rise in the hero intro timeline
//   [data-landing-hero-card]   floating cards: intro rise, then scroll parallax
//   [data-landing-reveal]      batched scroll reveal, once (featured, audience…)
//   [data-landing-connector]   the how-it-works rail, drawn left to right

gsap.registerPlugin(ScrollTrigger)

/**
 * GSAP's closest built-in to the locked easing token `[0.22, 1, 0.36, 1]`
 * ("ease-out-expo-like", 00 §7). A cubic-bezier array is Framer's spelling;
 * matching it exactly in GSAP would mean the CustomEase plugin for a curve the
 * eye cannot tell apart.
 */
const EASE = 'expo.out'

const seconds = (ms) => ms / 1000

/** How far each floating hero card drifts on scroll, as a % of its own height. */
const PARALLAX_DEPTH = [-14, -7, -18, -10]

const REDUCED_MOTION_OFF = '(prefers-reduced-motion: no-preference)'

/**
 * Wires the landing page's GSAP scenes to whatever the returned ref is attached
 * to. Runs once on mount and reverts everything — tweens, ScrollTriggers, and
 * the inline styles they wrote — when the page unmounts.
 *
 * The scenes come in two waves, because the hero's cards do not exist at mount:
 * they are featured creators fetched from the API (V2-04 §3). The page scenes
 * bind on mount; the card scenes bind when `heroCardsReady` flips, which the
 * hero raises from a layout effect so the cards are still unpainted when their
 * hidden "from" state is written.
 *
 * @param {object} [options]
 * @param {boolean} [options.heroCardsReady=false] the hero's creator cards are
 *   in the DOM
 * @returns {React.MutableRefObject<HTMLElement|null>} ref for the page root
 *
 * @example
 * const rootRef = useLandingAnimations({ heroCardsReady })
 * return <Box ref={rootRef}>…</Box>
 */
export function useLandingAnimations({ heroCardsReady = false } = {}) {
  const rootRef = useRef(null)

  // Layout effect, not effect: the hidden "from" states must be written before
  // the browser paints, or the hero flashes at full opacity and then rewinds.
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return undefined

    const query = (selector) => Array.from(root.querySelectorAll(selector))

    const mm = gsap.matchMedia()

    mm.add(REDUCED_MOTION_OFF, () => {
      /* Hero intro — the copy column rises, line by line */
      const copy = query('[data-landing-hero-copy]')

      if (copy.length) {
        gsap.from(copy, {
          y: distances.lg,
          opacity: 0,
          stagger: 0.08,
          ease: EASE,
          duration: seconds(durations.hero),
        })
      }

      /* Scroll reveals — one batch for every opted-in block on the page */
      const reveals = query('[data-landing-reveal]')

      if (reveals.length) {
        gsap.set(reveals, { opacity: 0, y: distances.lg })

        const play = (batch) =>
          gsap.to(batch, {
            opacity: 1,
            y: 0,
            duration: seconds(durations.slow),
            ease: EASE,
            stagger: 0.08,
            overwrite: true,
          })

        ScrollTrigger.batch(reveals, {
          start: 'top 88%',
          once: true,
          onEnter: play,
          // Covers a restored scroll position that puts a block above the
          // viewport: without it those blocks would stay at opacity 0.
          onEnterBack: play,
        })
      }

      /* How it works — the rail draws in behind the four steps (desktop only) */
      query('[data-landing-connector]').forEach((line) => {
        gsap.from(line, {
          scaleX: 0,
          transformOrigin: 'left center',
          ease: EASE,
          duration: seconds(durations.hero),
          scrollTrigger: { trigger: line, start: 'top 85%', once: true },
        })
      })

      // Positions are measured at creation; one frame later the fonts and the
      // first images have settled, so re-measure before the visitor scrolls.
      const refresh = requestAnimationFrame(() => ScrollTrigger.refresh())

      return () => cancelAnimationFrame(refresh)
    })

    return () => mm.revert()
  }, [])

  // The hero's floating cards, once they have data. Their own matchMedia
  // instance rather than the one above: this wave binds on a later commit, and
  // an already-reverted context cannot take new tweens.
  useLayoutEffect(() => {
    if (!heroCardsReady) return undefined

    const root = rootRef.current
    if (!root) return undefined

    const cards = Array.from(root.querySelectorAll('[data-landing-hero-card]'))
    if (cards.length === 0) return undefined

    const mm = gsap.matchMedia()

    mm.add(REDUCED_MOTION_OFF, () => {
      /* Intro — the composition settles in behind the copy */
      gsap.from(cards, {
        y: 56,
        opacity: 0,
        scale: 0.94,
        stagger: 0.09,
        ease: EASE,
        duration: seconds(durations.hero),
      })

      /* Parallax — a gentle drift, scrubbed to the scroll position */
      cards.forEach((card, index) => {
        gsap.to(card, {
          yPercent: PARALLAX_DEPTH[index % PARALLAX_DEPTH.length],
          ease: 'none',
          scrollTrigger: {
            trigger: card.closest('[data-landing-hero-stage]') ?? card,
            start: 'top top',
            end: 'bottom top',
            scrub: 0.6,
          },
        })
      })

      // The cards just replaced skeletons of the same size, but the photographs
      // are still arriving: re-measure once the frame has settled.
      const refresh = requestAnimationFrame(() => ScrollTrigger.refresh())

      return () => cancelAnimationFrame(refresh)
    })

    return () => mm.revert()
  }, [heroCardsReady])

  return rootRef
}

export default useLandingAnimations
