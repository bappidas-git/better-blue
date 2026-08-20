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
import { ROLES } from '@/constants/roles'
import { paths } from '@/routes/paths'
import { brandGradientAnimated } from '@/theme/palette'

// The closing band — the one full-colour panel on the page (theme-v2 §4: the
// gradient is an accent, never a whole-surface wash).
//
// The copy is placeholder Lorem Ipsum (V2-06 §2), sized to the wording it stands
// in for: a three-word eyebrow, a one-line headline, and two lines of lead. Both
// buttons open the register form with the account type already chosen, the same
// pair the audience panels above offer.
//
// The gradient is laid over the page ink at 60% rather than used neat: white on
// the pink end of the raw token is 3.53:1, which fails AA for anything but large
// text, while the same gradient over the near-black surface measures 7.53:1 at
// that end and 8.08:1 at the purple one — every position of the sweep is between
// the two. Same token, same look, readable copy (theme-v2 §8, §9).
//
// V2-06 moved that ink base off `text.primary`. Under the dark theme the token
// resolves to near-white, so the panel it used to darken was lifting the copy
// onto a *light* surface — the last light-theme surface left on the page.

/** How much of the brand gradient sits over the ink base. */
const GRADIENT_OPACITY = 0.6

/**
 * The animated wash, per theme-v2 §4/§7: the gradient token at `200% 200%`,
 * ping-ponged by the one global keyframe. Reduced motion pins it to the start
 * position, so the panel keeps the full gradient as a **static** fill rather
 * than freezing mid-sweep — the same treatment `.bb-gradient-text` gets.
 */
const animatedWashSx = {
  position: 'absolute',
  inset: 0,
  backgroundImage: brandGradientAnimated,
  backgroundSize: '200% 200%',
  opacity: GRADIENT_OPACITY,
  animation: 'bb-gradient-shift var(--bb-duration-gradient) var(--bb-ease) infinite',
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none',
    backgroundPosition: '0% 50%',
  },
}

export default function FinalCta() {
  const headingId = useId()

  return (
    <Box component="section" aria-labelledby={headingId} sx={{ py: { xs: 8, md: 12 } }}>
      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 } }}>
        <FadeInView>
          <Box
            sx={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: { xs: 3, md: 4 },
              bgcolor: 'background.default',
              color: 'common.white',
              px: { xs: 3, md: 8 },
              py: { xs: 6, md: 9 },
            }}
          >
            <Box aria-hidden="true" sx={animatedWashSx} />

            <Stack
              spacing={2.5}
              alignItems="center"
              textAlign="center"
              sx={{ position: 'relative' }}
            >
              <Typography variant="overline" component="p" sx={{ opacity: 0.9 }}>
                Lorem ipsum dolor
              </Typography>

              <Typography
                id={headingId}
                variant="h2"
                component="h2"
                sx={{ maxWidth: '20ch' }}
              >
                Sed ut perspiciatis unde omnis iste natus
              </Typography>

              <Typography variant="body1" sx={{ maxWidth: '56ch' }}>
                Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit,
                sed quia consequuntur magni dolores eos qui ratione.
              </Typography>

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.5}
                sx={{ pt: 1, width: { xs: '100%', sm: 'auto' } }}
              >
                <Button
                  component={RouterLink}
                  to={paths.registerAs(ROLES.BUYER)}
                  size="large"
                  variant="gradient"
                  startIcon={<Icon icon="tabler:building-store" width={20} />}
                  sx={{ borderRadius: 999 }}
                >
                  Register as a Buyer
                </Button>

                {/* The panel is the brand colour, so the outlined button drops
                    the theme's purple edge for white — `primary.light` on this
                    wash would read as a smudge rather than as a control. */}
                <Button
                  component={RouterLink}
                  to={paths.registerAs(ROLES.CREATOR)}
                  size="large"
                  variant="outlined"
                  startIcon={<Icon icon="tabler:camera" width={20} />}
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
                  Register as a Creator
                </Button>
              </Stack>
            </Stack>
          </Box>
        </FadeInView>
      </Container>
    </Box>
  )
}
