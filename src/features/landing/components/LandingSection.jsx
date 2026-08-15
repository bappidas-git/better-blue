import { useId } from 'react'

import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

// Vertical rhythm for the marketing page — 64px on mobile, 96px on desktop
// (00 §6). The app's `components/layout/Section` owns the same job *inside*
// dashboards, where headings are `h5` and the spacing is margin-based; a landing
// band needs full-bleed padding it can tint and display-scale headings, so this
// is its marketing counterpart rather than a second copy of it.
//
// Every band is a labelled `<section>`: the heading gets an id and the section
// points at it, so a screen-reader rotor lists the page as nine named regions.

const TONE_SX = {
  /** Page background — the default band. */
  default: null,
  /** White, for bands that need to lift off the page background. */
  paper: { bgcolor: 'background.paper' },
  /** The faint brand wash (00 §6) — used sparingly, for one or two bands. */
  tint: { bgcolor: 'primary.surface' },
}

/**
 * @param {object} props
 * @param {React.ReactNode} [props.eyebrow] small uppercase label above the heading
 * @param {React.ReactNode} [props.title] section heading
 * @param {React.ReactNode} [props.description] supporting copy under the heading
 * @param {React.ReactNode} [props.action] control rendered under/beside the heading
 * @param {'center'|'start'} [props.align='center'] header alignment
 * @param {'default'|'paper'|'tint'} [props.tone='default'] band background
 * @param {'md'|'lg'|'xl'} [props.maxWidth='lg'] content container width
 * @param {React.ElementType} [props.titleComponent='h2'] heading level
 * @param {object} [props.headerProps] props spread onto the header block — the
 *   hook-in for `data-landing-reveal`
 * @param {React.ReactNode} props.children band content
 * @param {object} [props.sx] MUI system styles applied to the band
 */
export default function LandingSection({
  eyebrow,
  title,
  description,
  action,
  align = 'center',
  tone = 'default',
  maxWidth = 'lg',
  titleComponent = 'h2',
  headerProps,
  children,
  sx,
  ...rest
}) {
  const headingId = useId()
  const centered = align === 'center'
  const hasHeader = Boolean(eyebrow || title || description || action)

  return (
    <Box
      component="section"
      aria-labelledby={title ? headingId : undefined}
      sx={{ py: { xs: 8, md: 12 }, ...TONE_SX[tone], ...sx }}
      {...rest}
    >
      <Container maxWidth={maxWidth} sx={{ px: { xs: 2, md: 4 } }}>
        {hasHeader ? (
          <Stack
            spacing={1.5}
            alignItems={centered ? 'center' : 'flex-start'}
            textAlign={centered ? 'center' : 'left'}
            sx={{ mb: { xs: 4, md: 6 }, ...(centered ? { mx: 'auto', maxWidth: 720 } : null) }}
            {...headerProps}
          >
            {eyebrow ? (
              <Typography variant="overline" component="p" sx={{ color: 'primary.main' }}>
                {eyebrow}
              </Typography>
            ) : null}

            {title ? (
              <Typography id={headingId} variant="h3" component={titleComponent}>
                {title}
              </Typography>
            ) : null}

            {description ? (
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '62ch' }}>
                {description}
              </Typography>
            ) : null}

            {action ? <Box sx={{ pt: 1 }}>{action}</Box> : null}
          </Stack>
        ) : null}

        {children}
      </Container>
    </Box>
  )
}
