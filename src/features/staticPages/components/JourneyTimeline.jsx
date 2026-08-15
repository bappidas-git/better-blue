import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

import FadeInView from '@/components/motion/FadeInView'

// The step-by-step journey on the How It Works page: a numbered `<ol>` drawn as
// a timeline, with the steps alternating either side of the rail from `md` up
// and stacking beside it on a phone.
//
// The rail is built from one segment per step rather than a single absolutely
// positioned line, so it always ends exactly at the last marker no matter how
// tall a step's copy grows. Steps reveal as they scroll into view, staggered by
// hand (00 §7 — transform and opacity only; `MotionConfig` handles reduced
// motion globally).

/** Marker diameter, and the width of the rail column it centres in. */
const MARKER = 48

/** Seconds between consecutive step reveals. */
const STEP_DELAY = 0.07

/**
 * @param {object} props
 * @param {{key: string, icon: string, title: string, description: string}[]} props.steps
 *   ordered steps; `icon` is an iconify name
 * @param {string} [props.stepLabel='Step'] word before the step number
 */
export default function JourneyTimeline({ steps = [], stepLabel = 'Step' }) {
  return (
    <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1
        // Odd steps sit in the right-hand column on desktop; everything sits to
        // the right of the rail on mobile.
        const onRight = index % 2 === 1

        return (
          <FadeInView
            key={step.key}
            component="li"
            delay={index * STEP_DELAY}
            sx={{
              display: 'grid',
              columnGap: { xs: 2, md: 4 },
              gridTemplateColumns: {
                xs: `${MARKER}px minmax(0, 1fr)`,
                md: `minmax(0, 1fr) ${MARKER}px minmax(0, 1fr)`,
              },
            }}
          >
            <Box
              aria-hidden="true"
              sx={{
                gridRow: 1,
                gridColumn: { xs: 1, md: 2 },
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <Box
                sx={{
                  width: MARKER,
                  height: MARKER,
                  flexShrink: 0,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: 'primary.surface',
                  color: 'primary.main',
                }}
              >
                <Icon icon={step.icon} width={24} />
              </Box>

              {isLast ? null : (
                <Box sx={{ flexGrow: 1, width: 2, minHeight: 24, bgcolor: 'divider' }} />
              )}
            </Box>

            <Box
              sx={{
                gridRow: 1,
                gridColumn: { xs: 2, md: onRight ? 3 : 1 },
                pb: isLast ? 0 : { xs: 4, md: 6 },
                textAlign: { xs: 'left', md: onRight ? 'left' : 'right' },
              }}
            >
              <Typography variant="overline" component="p" color="text.secondary">
                {`${stepLabel} ${index + 1}`}
              </Typography>

              <Typography variant="h6" component="h3" sx={{ mt: 0.25 }}>
                {step.title}
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mt: 1,
                  maxWidth: '46ch',
                  // Pull the measure against the rail on the left-hand side.
                  ml: { md: onRight ? 0 : 'auto' },
                }}
              >
                {step.description}
              </Typography>
            </Box>
          </FadeInView>
        )
      })}
    </Box>
  )
}
