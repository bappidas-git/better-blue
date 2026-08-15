import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import FadeInView from '@/components/motion/FadeInView'

// The social-proof strip under the hero. Text-only wordmarks, no logo files:
// these are the same fictional businesses the seed data uses (00 §1 — every
// name in the product is business-safe and invented), so the marketing copy and
// the demo marketplace describe one consistent world.

const BRANDS = [
  'Verde Kitchen',
  'Nimbus Fitness',
  'Atlas Travel Co',
  'Bloom Beauty',
  'Craftware Tools',
  'UrbanNest Interiors',
]

export default function TrustBand() {
  return (
    <Box
      component="section"
      aria-label="Businesses using BetterBlue"
      sx={{ py: { xs: 5, md: 7 }, borderBottom: 1, borderColor: 'divider' }}
    >
      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 } }}>
        <FadeInView>
          <Stack spacing={3} alignItems="center">
            <Typography variant="overline" component="p" color="text.secondary">
              Trusted by growing brands
            </Typography>

            <Stack
              component="ul"
              direction="row"
              flexWrap="wrap"
              justifyContent="center"
              rowGap={2}
              columnGap={{ xs: 3, md: 6 }}
              sx={{ listStyle: 'none', m: 0, p: 0 }}
            >
              {BRANDS.map((brand) => (
                <Typography
                  component="li"
                  key={brand}
                  sx={{
                    fontFamily: (theme) => theme.typography.h5.fontFamily,
                    fontWeight: 700,
                    fontSize: { xs: '1rem', md: '1.125rem' },
                    color: 'text.secondary',
                    letterSpacing: '-0.01em',
                    opacity: 0.85,
                  }}
                >
                  {brand}
                </Typography>
              ))}
            </Stack>
          </Stack>
        </FadeInView>
      </Container>
    </Box>
  )
}
