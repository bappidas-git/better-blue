import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import StaggerList from '@/components/motion/StaggerList'

import { WALLET_BENEFITS } from '../content/wallet'

// "Why a wallet" — the three-card trio, in the same shape the Pricing page uses
// for its principles: an icon tile, a heading, two lines. Reusing the shape
// rather than inventing a third card style is the point (00 §16.4).
//
// Static cards, so no hover lift and no glow: the theme lifts a card only when
// it owns a `CardActionArea`, and none of these are links.

export default function WalletBenefits() {
  return (
    <StaggerList
      inView
      sx={{
        display: 'grid',
        gap: { xs: 2, md: 3 },
        gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
      }}
    >
      {WALLET_BENEFITS.map((benefit) => (
        <Card key={benefit.key} sx={{ height: '100%' }}>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Stack spacing={1.5}>
              <Box
                aria-hidden="true"
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 2,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: 'primary.surface',
                  color: 'primary.main',
                }}
              >
                <Icon icon={benefit.icon} width={22} />
              </Box>

              <Typography variant="h6" component="h3">
                {benefit.title}
              </Typography>

              <Typography variant="body2" color="text.secondary">
                {benefit.description}
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </StaggerList>
  )
}
