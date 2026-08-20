import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import PageHeader from '@/components/layout/PageHeader'
import AmbientGlow from '@/components/motion/AmbientGlow'
import useDocumentTitle from '@/hooks/useDocumentTitle'

// TEMP: replaced in V2-10.
//
// The Wallet is the sixth item in the storefront nav (V2-02) and the screen
// behind it is not built yet, so this placeholder holds the route open — a nav
// item that 404s is worse than one that says "not yet". Nothing here reads or
// writes anything: no service call, no state, no balance.
//
// It is a `.bb-glass` pane over an `AmbientGlow`, which is the one pairing that
// makes glass read as glass (docs/theme-v2.md §6 — glass needs something behind
// it to blur). One glow, on an otherwise empty page, is within the one-per-
// viewport budget of §5.

export default function WalletPage() {
  useDocumentTitle('Wallet')

  return (
    <Container maxWidth="md" sx={{ px: { xs: 2, md: 4 }, py: { xs: 4, md: 6 } }}>
      <PageHeader
        title="Wallet"
        subtitle="Your BetterBlue balance, top-ups, and payment history — all in one place."
      />

      <Box sx={{ position: 'relative', overflow: 'hidden', borderRadius: 4, py: { xs: 4, md: 8 } }}>
        <AmbientGlow placement="center" intensity="subtle" />

        <Box
          className="bb-glass"
          sx={{
            position: 'relative',
            p: { xs: 3, md: 5 },
            maxWidth: 520,
            mx: 'auto',
            textAlign: 'center',
          }}
        >
          <Stack spacing={1.5} alignItems="center">
            <Box
              aria-hidden="true"
              sx={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'primary.surface',
                color: 'primary.main',
              }}
            >
              <Icon icon="solar:wallet-money-linear" width={28} />
            </Box>

            <Typography variant="h5" component="h2">
              Wallet — coming in this release series
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: '46ch' }}>
              We are building it now. Until then, funded orders, escrow, and released earnings
              all live in your dashboard exactly as they do today.
            </Typography>
          </Stack>
        </Box>
      </Box>
    </Container>
  )
}
