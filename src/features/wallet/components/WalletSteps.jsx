import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import FadeInView from '@/components/motion/FadeInView'

import { WALLET_STEPS } from '../content/wallet'

// "How the wallet works" — the four steps, as glass panes.
//
// An ordered list, because the order is the content: on desktop the four cards
// read left to right, and below `lg` they stack in the same sequence. The
// "Step n" label is the same treatment `EscrowExplainer` gives its stages on
// How It Works and Pricing, so the two explainers read as one family.
//
// Glass rather than `Card` (docs/theme-v2.md §6): these sit under the hero's
// AmbientGlow, which is the pairing that makes glass read as glass. The cards
// are not interactive, so they do not lift and carry no glow of their own (§5 —
// one glow per viewport at rest).

/** Seconds between consecutive card reveals. */
const STEP_DELAY = 0.06

export default function WalletSteps() {
  return (
    <Box
      component="ol"
      sx={{
        listStyle: 'none',
        m: 0,
        p: 0,
        display: 'grid',
        gap: { xs: 2, md: 2.5 },
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr)',
          sm: 'repeat(2, minmax(0, 1fr))',
          lg: 'repeat(4, minmax(0, 1fr))',
        },
      }}
    >
      {WALLET_STEPS.map((step, index) => (
        <FadeInView
          key={step.key}
          component="li"
          delay={index * STEP_DELAY}
          sx={{ display: 'flex', minWidth: 0 }}
        >
          <Box className="bb-glass" sx={{ p: { xs: 2.5, md: 3 }, width: '100%', minWidth: 0 }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                  aria-hidden="true"
                  sx={{
                    width: 44,
                    height: 44,
                    flexShrink: 0,
                    borderRadius: 2,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: 'primary.surface',
                    color: 'primary.main',
                  }}
                >
                  <Icon icon={step.icon} width={22} />
                </Box>

                <Typography variant="overline" component="p" color="text.secondary">
                  {`Step ${index + 1}`}
                </Typography>
              </Stack>

              <Typography variant="subtitle1" component="h3">
                {step.title}
              </Typography>

              <Typography variant="body2" color="text.secondary">
                {step.description}
              </Typography>
            </Stack>
          </Box>
        </FadeInView>
      ))}
    </Box>
  )
}
