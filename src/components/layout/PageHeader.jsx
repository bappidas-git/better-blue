import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import { useLinkProps } from '@/hooks/useLinkProps'

// Standard page heading — 00 §12 opens every list and detail page with it.
// Actions sit beside the title on desktop and wrap below it on mobile, where
// horizontal space belongs to the title.

/**
 * @param {object} props
 * @param {React.ReactNode} props.title page title (rendered as the page `h1` by default)
 * @param {React.ReactNode} [props.subtitle] one-line description under the title
 * @param {string} [props.backTo] route path for the back button (uses the router when mounted)
 * @param {() => void} [props.onBack] click handler for the back button — pair with or replace `backTo`
 * @param {string} [props.backLabel='Go back'] accessible label for the back button
 * @param {React.ReactNode} [props.breadcrumbs] breadcrumbs slot, rendered above the title
 * @param {React.ReactNode} [props.meta] inline slot beside the title — a `StatusChip`, id, or badge
 * @param {React.ReactNode} [props.actions] buttons slot, right-aligned on desktop
 * @param {React.ElementType} [props.titleComponent='h1'] heading level to render
 * @param {object} [props.sx] MUI system styles
 */
export default function PageHeader({
  title,
  subtitle,
  backTo,
  onBack,
  backLabel = 'Go back',
  breadcrumbs,
  meta,
  actions,
  titleComponent = 'h1',
  sx,
  ...rest
}) {
  const linkProps = useLinkProps(backTo)
  const showBack = Boolean(backTo || onBack)

  return (
    <Box component="header" sx={{ mb: { xs: 3, md: 4 }, ...sx }} {...rest}>
      {breadcrumbs ? <Box sx={{ mb: 1.5 }}>{breadcrumbs}</Box> : null}

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={{ xs: 2, md: 3 }}
        alignItems={{ xs: 'stretch', md: 'flex-start' }}
        justifyContent="space-between"
      >
        <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ minWidth: 0 }}>
          {showBack ? (
            <IconButton
              aria-label={backLabel}
              onClick={onBack}
              size="small"
              sx={{ width: 44, height: 44, mt: -0.5, ml: -1, flexShrink: 0 }}
              {...linkProps}
            >
              <Icon icon="tabler:arrow-left" width={20} />
            </IconButton>
          ) : null}

          <Box sx={{ minWidth: 0 }}>
            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
            >
              <Typography variant="h4" component={titleComponent} sx={{ minWidth: 0 }}>
                {title}
              </Typography>
              {meta}
            </Stack>
            {subtitle ? (
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ mt: 1, maxWidth: '68ch' }}
              >
                {subtitle}
              </Typography>
            ) : null}
          </Box>
        </Stack>

        {actions ? (
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            sx={{ flexShrink: 0, justifyContent: { xs: 'flex-start', md: 'flex-end' } }}
          >
            {actions}
          </Stack>
        ) : null}
      </Stack>
    </Box>
  )
}
