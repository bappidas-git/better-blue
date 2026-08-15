import { Icon } from '@iconify/react'
import Badge from '@mui/material/Badge'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { NavLink } from 'react-router-dom'

import { NAV_FALLBACK_ICON } from '@/routes/navConfig'

// The mobile navigation bar (< md): at most five slots, thumb-height, pinned to
// the bottom edge above the home indicator. `DashboardLayout` decides which
// destinations reach the bar and which fall into the "More" sheet — this
// component only draws what it is given (00 §16.9).

/** Bar height before the safe-area inset (00 §6: 64px with labels). */
export const BOTTOM_NAV_HEIGHT = 64

const tileSx = {
  flex: 1,
  minWidth: 0,
  height: BOTTOM_NAV_HEIGHT,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 0.25,
  px: 0.5,
  color: 'text.secondary',
  position: 'relative',
  '&.active, &[aria-current="page"]': {
    color: 'primary.main',
    // Short indicator on the top edge — the tint alone is easy to miss at 10px.
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      width: 28,
      height: 3,
      borderRadius: '0 0 3px 3px',
      backgroundColor: 'primary.main',
    },
  },
}

const labelSx = {
  fontSize: '0.6875rem',
  lineHeight: 1.2,
  fontWeight: 600,
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

function TileIcon({ icon, badge }) {
  const glyph = <Icon icon={icon || NAV_FALLBACK_ICON} width={22} aria-hidden="true" />

  if (!badge) return glyph

  return (
    <Badge
      variant="dot"
      color="error"
      overlap="circular"
      sx={{ '& .MuiBadge-badge': { top: 2, right: 2 } }}
    >
      {glyph}
    </Badge>
  )
}

/**
 * @param {object} props
 * @param {Array} props.items destinations shown on the bar (four at most when a
 *   "More" tile is present)
 * @param {Array} [props.moreItems] destinations behind "More" — an empty array
 *   hides the tile entirely
 * @param {boolean} [props.moreActive] `true` when the current route lives inside
 *   the sheet, so the tile carries the active state
 * @param {boolean} [props.moreOpen] sheet open state, for `aria-expanded`
 * @param {() => void} [props.onMoreClick] opens the sheet
 * @param {Record<string, number>} [props.badges] counts keyed by `item.badgeKey`
 */
export default function MobileBottomNav({
  items = [],
  moreItems = [],
  moreActive = false,
  moreOpen = false,
  onMoreClick,
  badges = {},
}) {
  const showMore = moreItems.length > 0

  return (
    <Paper
      component="nav"
      aria-label="Dashboard sections"
      square
      elevation={0}
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: (theme) => theme.zIndex.appBar,
        borderTop: 1,
        borderColor: 'divider',
        // Keeps the tiles clear of the iOS home indicator.
        pb: 'env(safe-area-inset-bottom)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
        {items.map((item) => (
          <ButtonBase
            key={item.key}
            component={NavLink}
            to={item.path}
            end={Boolean(item.exact)}
            sx={tileSx}
          >
            <TileIcon icon={item.icon} badge={badges[item.badgeKey]} />
            <Typography component="span" sx={labelSx}>
              {item.label}
            </Typography>
          </ButtonBase>
        ))}

        {showMore ? (
          <ButtonBase
            onClick={onMoreClick}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-current={moreActive ? 'page' : undefined}
            aria-label="More sections"
            sx={tileSx}
          >
            <TileIcon
              icon="tabler:dots"
              badge={moreItems.some((item) => badges[item.badgeKey])}
            />
            <Typography component="span" sx={labelSx}>
              More
            </Typography>
          </ButtonBase>
        ) : null}
      </Box>
    </Paper>
  )
}
