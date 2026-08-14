import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import { useLinkProps } from '@/hooks/useLinkProps'

// The empty half of every list — 00 §12: "empty = EmptyState with icon +
// primary action". Elegant and centered rather than apologetic: a soft icon
// tile, one clear sentence, and the action that fills the gap.

/**
 * @typedef {object} EmptyStateAction
 * @property {string} label button text
 * @property {() => void} [onClick] click handler
 * @property {string} [to] route path — rendered as a link instead of a button handler
 * @property {string} [icon] iconify name shown before the label
 * @property {string} [variant] MUI button variant override
 */

function ActionButton({ action, primary }) {
  const linkProps = useLinkProps(action.to)
  return (
    <Button
      variant={action.variant ?? (primary ? 'gradient' : 'outlined')}
      onClick={action.onClick}
      startIcon={action.icon ? <Icon icon={action.icon} width={18} /> : undefined}
      {...linkProps}
    >
      {action.label}
    </Button>
  )
}

/**
 * @param {object} props
 * @param {string} [props.icon='tabler:inbox'] iconify name for the tile
 * @param {React.ReactNode} props.title short headline — say what is missing, not "No data"
 * @param {React.ReactNode} [props.description] one or two sentences of context
 * @param {EmptyStateAction} [props.primaryAction] main way out of the empty state
 * @param {EmptyStateAction} [props.secondaryAction] alternative, lower-emphasis action
 * @param {React.ReactNode} [props.children] extra content under the actions
 * @param {boolean} [props.dense=false] tighter padding for cards and side panels
 * @param {object} [props.sx] MUI system styles
 */
export default function EmptyState({
  icon = 'tabler:inbox',
  title,
  description,
  primaryAction,
  secondaryAction,
  children,
  dense = false,
  sx,
  ...rest
}) {
  return (
    <Stack
      alignItems="center"
      textAlign="center"
      spacing={2}
      sx={{
        px: 3,
        py: dense ? 4 : { xs: 6, md: 8 },
        mx: 'auto',
        maxWidth: 460,
        ...sx,
      }}
      {...rest}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: dense ? 56 : 72,
          height: dense ? 56 : 72,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'primary.surface',
          color: 'primary.main',
        }}
      >
        <Icon icon={icon} width={dense ? 26 : 32} />
      </Box>

      <Box>
        <Typography variant="h6" component="p" gutterBottom>
          {title}
        </Typography>
        {description ? (
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        ) : null}
      </Box>

      {primaryAction || secondaryAction ? (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ pt: 0.5, width: { xs: '100%', sm: 'auto' } }}
        >
          {primaryAction ? <ActionButton action={primaryAction} primary /> : null}
          {secondaryAction ? <ActionButton action={secondaryAction} /> : null}
        </Stack>
      ) : null}

      {children}
    </Stack>
  )
}
