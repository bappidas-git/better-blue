import { useId } from 'react'

import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

// Vertical rhythm wrapper (00 §6: 48–96px between sections). Owns the spacing
// between page sections so individual pages stop inventing their own margins.

/**
 * @param {object} props
 * @param {React.ReactNode} [props.title] section heading
 * @param {React.ReactNode} [props.eyebrow] small uppercase label above the heading
 * @param {React.ReactNode} [props.description] supporting copy under the heading
 * @param {React.ReactNode} [props.action] right-aligned control beside the heading (a link or button)
 * @param {React.ReactNode} props.children section content
 * @param {'sm'|'md'|'lg'} [props.spacing='md'] bottom rhythm — sm 32/40, md 48/64, lg 64/96 px
 * @param {React.ElementType} [props.component='section'] element rendered
 * @param {React.ElementType} [props.titleComponent='h2'] heading level to render
 * @param {object} [props.sx] MUI system styles
 */
const SPACING = {
  sm: { xs: 4, md: 5 },
  md: { xs: 6, md: 8 },
  lg: { xs: 8, md: 12 },
}

export default function Section({
  title,
  eyebrow,
  description,
  action,
  children,
  spacing = 'md',
  component = 'section',
  titleComponent = 'h2',
  sx,
  ...rest
}) {
  const headingId = useId()
  const hasHeading = Boolean(title || eyebrow || description || action)

  return (
    <Box
      component={component}
      aria-labelledby={title ? headingId : undefined}
      sx={{ '&:not(:last-child)': { mb: SPACING[spacing] ?? SPACING.md }, ...sx }}
      {...rest}
    >
      {hasHeading ? (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 1.5, sm: 3 }}
          alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
          justifyContent="space-between"
          sx={{ mb: { xs: 2, md: 3 } }}
        >
          <Box sx={{ minWidth: 0 }}>
            {eyebrow ? (
              <Typography variant="overline" component="p" color="text.secondary">
                {eyebrow}
              </Typography>
            ) : null}
            {title ? (
              <Typography id={headingId} variant="h5" component={titleComponent}>
                {title}
              </Typography>
            ) : null}
            {description ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 1, maxWidth: '68ch' }}
              >
                {description}
              </Typography>
            ) : null}
          </Box>
          {action ? <Box sx={{ flexShrink: 0 }}>{action}</Box> : null}
        </Stack>
      ) : null}

      {children}
    </Box>
  )
}
