import { useEffect, useRef } from 'react'

import Box from '@mui/material/Box'
import { useReducedMotion, useSpring } from 'framer-motion'

import { formatNumber } from '@/utils/formatters'

// Spring count-up for dashboard stats — 00 §7. The animation writes straight
// to the DOM node's text content instead of re-rendering on every frame, so a
// grid of StatCards stays cheap. Under `prefers-reduced-motion` the final value
// is rendered immediately with no animation at all.

/**
 * @param {object} props
 * @param {number} props.value target number
 * @param {(value: number) => string} [props.format=formatNumber] formatter applied to
 *   every intermediate value — pass `formatCurrency`/`formatPercent` from `@/utils/formatters`
 * @param {number} [props.from=0] value the count-up starts at
 * @param {React.ElementType} [props.component='span'] element rendered
 * @param {object} [props.sx] MUI system styles
 *
 * @example
 * <AnimatedNumber value={12480} format={(n) => formatCurrency(n)} />
 */
export default function AnimatedNumber({
  value = 0,
  format = formatNumber,
  from = 0,
  component = 'span',
  sx,
  ...rest
}) {
  const prefersReducedMotion = useReducedMotion()
  const nodeRef = useRef(null)

  // Read through refs so a fresh inline `format` prop never restarts the spring.
  const formatRef = useRef(format)
  formatRef.current = format

  const spring = useSpring(from, {
    stiffness: 120,
    damping: 24,
    mass: 0.7,
    restDelta: 0.5,
  })

  useEffect(() => {
    if (prefersReducedMotion) return undefined
    return spring.on('change', (latest) => {
      if (nodeRef.current) nodeRef.current.textContent = formatRef.current(latest)
    })
  }, [prefersReducedMotion, spring])

  useEffect(() => {
    if (prefersReducedMotion) return
    spring.set(Number(value) || 0)
  }, [prefersReducedMotion, spring, value])

  // React only touches the text node when this rendered string changes, so the
  // imperative updates above survive unrelated re-renders of the parent.
  const staticText = format(prefersReducedMotion ? Number(value) || 0 : from)

  return (
    <Box component={component} ref={nodeRef} sx={sx} {...rest}>
      {staticText}
    </Box>
  )
}
