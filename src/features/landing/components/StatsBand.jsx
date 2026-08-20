import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import AnimatedNumber from '@/components/motion/AnimatedNumber'
import useApiQuery from '@/hooks/useApiQuery'
import { landingService } from '@/services'
import { formatNumber } from '@/utils/formatters'

import LandingSection from './LandingSection'

// Three counts, computed from the API by `landingService.getStats` (contract
// §7.13). Nothing here is a marketing figure: the numbers are whatever the
// marketplace currently holds. V2-04 dropped the fourth, "Categories covered",
// along with the rest of the taxonomy's presence in the storefront.

/**
 * Below this many readable counts the band is dropped instead of shown: one
 * lonely number under "in numbers" reads as a broken section, not a stat.
 */
const MIN_STATS = 2

const STATS = [
  { key: 'creators', label: 'Creator storefronts' },
  { key: 'completedOrders', label: 'Orders completed' },
  { key: 'contentRequests', label: 'Briefs posted' },
]

function StatTile({ label, value, isLoading }) {
  return (
    <Stack
      spacing={0.5}
      data-landing-reveal
      sx={{ textAlign: { xs: 'left', md: 'center' }, minWidth: 0 }}
    >
      <Typography variant="h2" component="p" sx={{ color: 'primary.light' }}>
        {isLoading ? (
          <Skeleton variant="text" width="4ch" sx={{ display: 'inline-block' }} />
        ) : (
          <AnimatedNumber value={value} format={formatNumber} />
        )}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  )
}

export default function StatsBand() {
  // `getStats` resolves with `null` for any count it could not read and never
  // rejects, so there is no error branch here — a missing number simply drops
  // its tile, and a completely unreachable API drops the whole band.
  const { data, isLoading } = useApiQuery(() => landingService.getStats(), [])

  const stats = STATS.filter(({ key }) => isLoading || typeof data?.[key] === 'number')

  if (stats.length < MIN_STATS) return null

  return (
    <LandingSection tone="tint" title="The marketplace, in numbers">
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: `repeat(${stats.length}, 1fr)` },
          gap: { xs: 4, md: 3 },
        }}
      >
        {stats.map((stat) => (
          <StatTile
            key={stat.key}
            label={stat.label}
            value={data?.[stat.key] ?? 0}
            isLoading={isLoading}
          />
        ))}
      </Box>
    </LandingSection>
  )
}
