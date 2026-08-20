import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import { alpha } from '@mui/material/styles'

import { FEED_DEAL_STATUS, getFeedDealMeta, getFeedDealStatus } from '@/constants/feedStatus'

// The one way a feed's deal status is rendered (Storefront V2, prompts-v2/03).
//
// Deliberately not `StatusChip`: that component renders a *stored* status from
// `STATUS_META`, and a deal status is a three-way projection of one
// (`constants/feedStatus.js`). Feeding a derived value into the status map
// would put `open` — which means one thing to a request and another to a feed —
// under two definitions. It is the same shape and the same tinted-chip
// treatment, tuned for the one state that carries an affordance.

/** `FEED_DEAL_META.tone` → MUI chip colour; the theme turns these into tints. */
const TONE_COLORS = {
  neutral: 'default',
  info: 'info',
  success: 'success',
}

/**
 * @param {object} props
 * @param {object} [props.feed] a feed record — its status is mapped for you
 * @param {'open'|'closed'|'delivered'} [props.dealStatus] the status directly,
 *   when the caller has already derived it (`feedService` attaches it)
 * @param {'sm'|'md'} [props.size='sm']
 * @param {boolean} [props.tooltip=true] reveal the description on hover/focus
 */
export default function FeedDealChip({
  feed,
  dealStatus,
  size = 'sm',
  tooltip = true,
  sx,
  ...rest
}) {
  const status = dealStatus ?? getFeedDealStatus(feed)
  const meta = getFeedDealMeta(status)
  const isSmall = size === 'sm'

  const chip = (
    <Chip
      label={meta.label}
      color={TONE_COLORS[meta.tone] ?? 'default'}
      size={isSmall ? 'small' : 'medium'}
      icon={
        <Box
          component="span"
          aria-hidden="true"
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: 'currentColor',
            color: 'inherit',
          }}
        />
      }
      sx={{
        fontWeight: 600,
        fontSize: isSmall ? '0.6875rem' : '0.75rem',
        '& .MuiChip-icon': { color: 'inherit', ml: isSmall ? 1 : 1.25, mr: -0.5 },
        // The one state a creator can act on gets the halo. Closed and
        // delivered are facts, not invitations, so they stay flat — which is
        // also what keeps the "one glow per viewport" rule affordable on a
        // board of twenty cards (docs/theme-v2.md §5).
        ...(status === FEED_DEAL_STATUS.OPEN
          ? {
              boxShadow: (theme) => `0 0 12px ${alpha(theme.palette.success.main, 0.3)}`,
            }
          : null),
        ...sx,
      }}
      {...rest}
    />
  )

  if (!tooltip) return chip

  // The span keeps the tooltip's ref off the Chip, which forwards it to its own
  // root — the same wrapper `StatusChip` uses.
  return (
    <Tooltip title={meta.description}>
      <span style={{ display: 'inline-flex' }}>{chip}</span>
    </Tooltip>
  )
}
