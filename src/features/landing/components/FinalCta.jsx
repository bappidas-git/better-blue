import { useId } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'

import FadeInView from '@/components/motion/FadeInView'
import { brandGradient } from '@/theme/palette'

import useLandingCtas from '../hooks/useLandingCtas'

// The closing band — the one full-colour panel on the page (00 §6: the gradient
// is an accent, never a whole-surface wash).
//
// The gradient is laid over the ink surface at 60% rather than used neat: white
// on the pink end of the raw token is ~3.3:1, which fails AA for anything but
// large text, while the same gradient over ink clears 7:1 across the whole
// panel. Same token, same look, readable copy (00 §13).

const GRADIENT_OPACITY = 0.6

export default function FinalCta() {
  const headingId = useId()
  const { primary, secondary } = useLandingCtas()

  return (
    <Box component="section" aria-labelledby={headingId} sx={{ py: { xs: 8, md: 12 } }}>
      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 } }}>
        <FadeInView>
          <Box
            sx={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: { xs: 3, md: 4 },
              bgcolor: 'text.primary',
              color: 'common.white',
              px: { xs: 3, md: 8 },
              py: { xs: 6, md: 9 },
            }}
          >
            <Box
              aria-hidden="true"
              sx={{
                position: 'absolute',
                inset: 0,
                backgroundImage: brandGradient,
                opacity: GRADIENT_OPACITY,
              }}
            />

            <Stack
              spacing={2.5}
              alignItems="center"
              textAlign="center"
              sx={{ position: 'relative' }}
            >
              <Typography variant="overline" component="p" sx={{ opacity: 0.9 }}>
                Ready when you are
              </Typography>

              <Typography
                id={headingId}
                variant="h2"
                component="h2"
                sx={{ maxWidth: '20ch' }}
              >
                Get the content your next campaign needs
              </Typography>

              <Typography variant="body1" sx={{ maxWidth: '56ch' }}>
                Join the businesses commissioning professional photos and videos on BetterBlue —
                and the creators producing them.
              </Typography>

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.5}
                sx={{ pt: 1, width: { xs: '100%', sm: 'auto' } }}
              >
                <Button
                  component={RouterLink}
                  to={primary.to}
                  size="large"
                  variant="contained"
                  startIcon={<Icon icon={primary.icon} width={20} />}
                  sx={{
                    borderRadius: 999,
                    bgcolor: 'common.white',
                    color: 'primary.dark',
                    '&:hover': { bgcolor: 'background.default' },
                  }}
                >
                  {primary.label}
                </Button>

                <Button
                  component={RouterLink}
                  to={secondary.to}
                  size="large"
                  variant="outlined"
                  startIcon={<Icon icon={secondary.icon} width={20} />}
                  sx={{
                    borderRadius: 999,
                    color: 'common.white',
                    borderColor: (theme) => alpha(theme.palette.common.white, 0.6),
                    '&:hover': {
                      borderColor: 'common.white',
                      bgcolor: (theme) => alpha(theme.palette.common.white, 0.14),
                    },
                  }}
                >
                  {secondary.label}
                </Button>
              </Stack>
            </Stack>
          </Box>
        </FadeInView>
      </Container>
    </Box>
  )
}
