import Box from '@mui/material/Box'

import StatCard from '@/components/data-display/StatCard'

// The row of metrics that opens most dashboard overviews. Two columns on a
// phone, two on a tablet, four from `md` up — so four stats read as one band on
// desktop and a tidy 2×2 block on a phone, never a single column of tiles.
//
// A grid rather than a `<Grid>` container: the tiles are uniform, so the
// template does the work and every card stretches to the tallest in its row.

/**
 * @param {object} props
 * @param {Array<object>} props.items one object of `StatCard` props per tile — each
 *   needs a `key` (or an `id`), everything else is forwarded verbatim
 * @param {boolean} [props.loading=false] render skeleton tiles instead
 * @param {number} [props.skeletonCount=4] how many skeletons while loading
 * @param {object} [props.sx] MUI system styles
 */
export default function StatCardGrid({
  items = [],
  loading = false,
  skeletonCount = 4,
  sx,
  ...rest
}) {
  const tiles = loading
    ? Array.from({ length: skeletonCount }, (unused, index) => ({ key: `skeleton-${index}` }))
    : items

  return (
    <Box
      sx={{
        display: 'grid',
        gap: { xs: 2, md: 3 },
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',
          sm: 'repeat(2, minmax(0, 1fr))',
          md: 'repeat(4, minmax(0, 1fr))',
        },
        ...sx,
      }}
      {...rest}
    >
      {tiles.map(({ key, id, ...stat }, index) => (
        <StatCard key={key ?? id ?? index} loading={loading} {...stat} />
      ))}
    </Box>
  )
}
