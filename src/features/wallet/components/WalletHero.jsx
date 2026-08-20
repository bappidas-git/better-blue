import { useId } from 'react'

import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import AmbientGlow from '@/components/motion/AmbientGlow'
import FadeInView from '@/components/motion/FadeInView'

import {
  WALLET_EYEBROW,
  WALLET_INTRO,
  WALLET_TITLE_ACCENT,
  WALLET_TITLE_LEAD,
} from '../content/wallet'

// The Wallet page's opening block — eyebrow, headline, one paragraph.
//
// The page's only `AmbientGlow` (docs/theme-v2.md §5: one glow per viewport at
// rest, and never behind body copy). It is placed on the hero because that is
// the one band here with no paragraph running through the middle of it, and
// because the glass step cards below need something behind them to blur — the
// glow's falloff reaches them as the page scrolls.
//
// The headline's second sentence takes `.bb-gradient-text`, which is display-only
// (§7) and reduced-motion safe on its own: under `prefers-reduced-motion` the
// utility pins its background position and renders as a static brand gradient.

export default function WalletHero() {
  const headingId = useId()

  return (
    <Box
      component="section"
      aria-labelledby={headingId}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        pt: { xs: 5, md: 9 },
        pb: { xs: 5, md: 8 },
      }}
    >
      <AmbientGlow placement="hero" intensity="medium" />

      <Container maxWidth="lg" sx={{ position: 'relative', px: { xs: 2, md: 4 } }}>
        <FadeInView>
          <Stack spacing={{ xs: 2, md: 2.5 }} sx={{ maxWidth: '60ch' }}>
            <Typography variant="overline" component="p" sx={{ color: 'primary.light' }}>
              {WALLET_EYEBROW}
            </Typography>

            <Typography id={headingId} variant="h1" component="h1">
              {WALLET_TITLE_LEAD}{' '}
              <Box component="span" className="bb-gradient-text">
                {WALLET_TITLE_ACCENT}
              </Box>
            </Typography>

            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '62ch' }}>
              {WALLET_INTRO}
            </Typography>
          </Stack>
        </FadeInView>
      </Container>
    </Box>
  )
}
