import { forwardRef } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

import { getStatusMeta, VISIBILITY } from '@/constants/statuses'

// Whether a published item is actually in the shop window.
//
// Two views of one field: a badge on the card, so a creator can see at a glance
// which of their live pieces are hidden, and the menu item that flips it. The
// pair lives in one module because the icon vocabulary — an open eye for public,
// a closed one for unlisted — has to mean the same thing in both places.
//
// Visibility is not moderation. An unlisted item keeps its approval; it is just
// filtered out of every public query (`portfolioService.listPublished`).

const VISIBILITY_ICONS = {
  [VISIBILITY.PUBLIC]: 'solar:eye-linear',
  [VISIBILITY.UNLISTED]: 'solar:eye-closed-linear',
}

/** The other one — a toggle has exactly two states. */
const nextVisibility = (visibility) =>
  visibility === VISIBILITY.UNLISTED ? VISIBILITY.PUBLIC : VISIBILITY.UNLISTED

/**
 * The card's inline marker. Text as well as an icon, so the state is never
 * carried by shape or colour alone (00 §13).
 *
 * @param {object} props
 * @param {string} props.visibility a `VISIBILITY` value
 */
export function VisibilityBadge({ visibility = VISIBILITY.PUBLIC }) {
  const meta = getStatusMeta(visibility)

  return (
    <Tooltip title={meta.description}>
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          color: visibility === VISIBILITY.UNLISTED ? 'text.secondary' : 'success.main',
        }}
      >
        <Box aria-hidden="true" sx={{ display: 'flex' }}>
          <Icon icon={VISIBILITY_ICONS[visibility] ?? VISIBILITY_ICONS[VISIBILITY.PUBLIC]} width={16} />
        </Box>
        <Typography variant="caption" component="span" sx={{ fontWeight: 600 }}>
          {meta.label}
        </Typography>
      </Box>
    </Tooltip>
  )
}

/**
 * The menu row that flips it. Labelled by what it *will do*, not by the current
 * state, which is the only wording that stays unambiguous in a menu.
 *
 * `forwardRef` because MUI's `Menu` manages focus through its children's refs —
 * without it the keyboard would skip this row.
 *
 * @param {object} props
 * @param {string} props.visibility the item's current `VISIBILITY` value
 * @param {(next: string) => void} props.onChange receives the next value
 * @param {boolean} [props.disabled=false]
 */
const VisibilityToggle = forwardRef(function VisibilityToggle(
  { visibility = VISIBILITY.PUBLIC, onChange, disabled = false, ...rest },
  ref
) {
  const next = nextVisibility(visibility)
  const goingPublic = next === VISIBILITY.PUBLIC

  return (
    <MenuItem ref={ref} disabled={disabled} onClick={() => onChange?.(next)} {...rest}>
      <ListItemIcon>
        <Icon icon={VISIBILITY_ICONS[next]} width={18} aria-hidden="true" />
      </ListItemIcon>
      <ListItemText
        primary={goingPublic ? 'Show on public profile' : 'Hide from public profile'}
        secondary={
          goingPublic
            ? 'Buyers can find it again'
            : 'Stays approved, but off your profile'
        }
        primaryTypographyProps={{ variant: 'body2' }}
        secondaryTypographyProps={{ variant: 'caption' }}
      />
    </MenuItem>
  )
})

export default VisibilityToggle
