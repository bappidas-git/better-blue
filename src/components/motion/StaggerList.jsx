import { Children, isValidElement } from 'react'

import Box from '@mui/material/Box'
import { motion } from 'framer-motion'

import { listItem, staggerContainer } from '@/components/motion/motionPresets'

// Staggered reveal for card grids and list rows — 00 §7. Children are wrapped
// automatically, so callers keep writing plain `items.map(...)` markup and the
// wrapper stays the grid/flex container.

/**
 * @param {object} props
 * @param {React.ReactNode} props.children list items (each is wrapped and staggered)
 * @param {number} [props.stagger=0.06] seconds between consecutive children
 * @param {boolean} [props.inView=false] start when scrolled into view instead of on mount
 * @param {boolean} [props.once=true] with `inView`, animate only the first time
 * @param {object} [props.itemVariants=listItem] variants applied to each child wrapper
 * @param {React.ElementType} [props.component='div'] element rendered by the container
 * @param {object} [props.sx] MUI system styles (put your `display: 'grid'` here)
 *
 * @example
 * <StaggerList sx={{ display: 'grid', gap: 2 }}>
 *   {orders.map((order) => <OrderCard key={order.id} order={order} />)}
 * </StaggerList>
 */
export default function StaggerList({
  children,
  stagger = 0.06,
  inView = false,
  once = true,
  itemVariants = listItem,
  component = 'div',
  sx,
  ...rest
}) {
  const animationProps = inView
    ? { whileInView: 'visible', viewport: { once, margin: '-40px' } }
    : { animate: 'visible' }

  return (
    <Box
      component={motion[component] ?? motion.div}
      variants={staggerContainer(stagger)}
      initial="hidden"
      sx={sx}
      {...animationProps}
      {...rest}
    >
      {/* Each wrapper becomes the grid/flex item — `minWidth: 0` keeps long
          content from blowing out a grid column. `display: contents` is not an
          option here: an element without a box cannot be animated. */}
      {Children.map(children, (child, index) =>
        isValidElement(child) ? (
          <motion.div
            key={child.key ?? index}
            variants={itemVariants}
            style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}
          >
            {child}
          </motion.div>
        ) : (
          child
        )
      )}
    </Box>
  )
}
