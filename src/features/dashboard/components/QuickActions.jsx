import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

import { useLinkProps } from '@/hooks/useLinkProps'

// The two or three things a member came to the dashboard to *do* — post a
// brief, submit a delivery, request a payout — as tiles rather than a row of
// buttons, so they survive a 360px screen without wrapping into a stack of
// full-width bars.
//
// Two columns on a phone, a single row from `sm` up.

function ActionTile({ action }) {
  // A tile whose destination has not been built yet (Prompt 14's rule for nav
  // entries, applied here by Prompt 21) is rendered *disabled* rather than
  // dropped: the shape of the dashboard stays stable across prompts, and a
  // hover explains why it does nothing instead of leaving a dead button.
  const isDisabled = Boolean(action.disabled) || (!action.to && !action.onClick)
  const linkProps = useLinkProps(isDisabled ? undefined : action.to)

  const tile = (
    <ButtonBase
      onClick={isDisabled ? undefined : action.onClick}
      disabled={isDisabled}
      {...linkProps}
      sx={{
        flex: { sm: 1 },
        minWidth: 0,
        p: 2,
        borderRadius: 3,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 1,
        textAlign: 'left',
        transition: (theme) =>
          theme.transitions.create(['border-color', 'background-color', 'box-shadow']),
        '&:hover': {
          borderColor: 'primary.light',
          bgcolor: 'primary.surface',
        },
        '&.Mui-disabled': { opacity: 0.55 },
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 40,
          height: 40,
          borderRadius: 2,
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'primary.surface',
          color: 'primary.main',
        }}
      >
        <Icon icon={action.icon ?? 'solar:bolt-linear'} width={21} />
      </Box>

      <Box sx={{ minWidth: 0, width: '100%' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {action.label}
        </Typography>
        {action.description ? (
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.25 }}>
            {action.description}
          </Typography>
        ) : null}
      </Box>
    </ButtonBase>
  )

  if (!isDisabled || !action.disabledReason) return tile

  // A disabled `ButtonBase` fires no pointer events, so the tooltip needs a
  // wrapper it can listen on.
  return (
    <Tooltip title={action.disabledReason}>
      <Box sx={{ display: 'flex', '& > *': { flex: 1 } }}>{tile}</Box>
    </Tooltip>
  )
}

/**
 * @param {object} props
 * @param {Array<{key: string, label: string, icon?: string, description?: string,
 *   to?: string, onClick?: () => void, disabled?: boolean, disabledReason?: string}>} props.actions
 *   tiles, in priority order — three or four is the comfortable maximum. A tile
 *   with neither `to` nor `onClick` renders disabled; `disabledReason` becomes
 *   its tooltip
 * @param {object} [props.sx] MUI system styles
 */
export default function QuickActions({ actions = [], sx, ...rest }) {
  if (actions.length === 0) return null

  return (
    <Box
      sx={{
        display: 'grid',
        gap: { xs: 1.5, md: 2 },
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',
          sm: `repeat(${actions.length}, minmax(0, 1fr))`,
        },
        ...sx,
      }}
      {...rest}
    >
      {actions.map((action) => (
        <ActionTile key={action.key ?? action.label} action={action} />
      ))}
    </Box>
  )
}

/** Exported for screens that need a single tile outside the grid. */
export { ActionTile }
