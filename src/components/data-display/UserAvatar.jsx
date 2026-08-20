import Avatar from '@mui/material/Avatar'
import AvatarGroup from '@mui/material/AvatarGroup'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import { visuallyHidden } from '@mui/utils'

import { avatarDataUri, initialsFromName } from '@/constants'

// Avatar for creators, buyers, and admins. Falls back to the locally generated
// initials SVG from `constants/images.js` (00 §1 — nothing is hotlinked), so
// there is never a broken-image frame while a profile photo loads or 404s.

/** Named sizes keep avatars consistent across cards, tables, and headers. */
const AVATAR_SIZES = { xs: 24, sm: 32, md: 40, lg: 56, xl: 96 }

/** Presence dot tones — `label` is what assistive tech announces. */
const STATUS_DOTS = {
  online: { color: 'success.main', label: 'Online' },
  away: { color: 'warning.main', label: 'Away' },
  busy: { color: 'error.main', label: 'Busy' },
  offline: { color: 'text.disabled', label: 'Offline' },
}

const resolveSize = (size) =>
  typeof size === 'number' ? size : (AVATAR_SIZES[size] ?? AVATAR_SIZES.md)

/**
 * @param {object} props
 * @param {string} props.name display name — drives the initials fallback and the alt text
 * @param {string} [props.src] profile image URL
 * @param {'xs'|'sm'|'md'|'lg'|'xl'|number} [props.size='md'] rendered size
 * @param {'online'|'away'|'busy'|'offline'} [props.status] presence dot
 * @param {string} [props.statusLabel] override the announced presence text
 * @param {string} [props.tint] avatar tint name from `AVATAR_TINTS` — defaults to one derived from the name
 * @param {'circular'|'rounded'} [props.variant='circular'] avatar shape
 * @param {boolean} [props.tooltip=false] show the name on hover/focus
 */
export default function UserAvatar({
  name,
  src,
  size = 'md',
  status,
  statusLabel,
  tint,
  variant = 'circular',
  tooltip = false,
  sx,
  ...rest
}) {
  const pixels = resolveSize(size)
  const dot = status ? STATUS_DOTS[status] : null
  const announcedStatus = statusLabel ?? dot?.label

  const avatar = (
    <Avatar
      src={src || avatarDataUri(name, tint, { size: pixels * 2 })}
      alt={name ? `${name}` : 'User avatar'}
      variant={variant}
      sx={{
        width: pixels,
        height: pixels,
        fontSize: Math.max(11, Math.round(pixels * 0.36)),
        fontWeight: 600,
        bgcolor: 'primary.surface',
        color: 'primary.light',
        ...sx,
      }}
      {...rest}
    >
      {/* Rendered only if both the src and the generated data URI fail. */}
      {initialsFromName(name)}
    </Avatar>
  )

  const withStatus = dot ? (
    <Box sx={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      {avatar}
      <Box
        sx={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: Math.max(8, Math.round(pixels * 0.26)),
          height: Math.max(8, Math.round(pixels * 0.26)),
          borderRadius: '50%',
          bgcolor: dot.color,
          border: 2,
          borderColor: 'background.paper',
        }}
      />
      <Box component="span" sx={visuallyHidden}>
        {announcedStatus}
      </Box>
    </Box>
  ) : (
    avatar
  )

  if (!tooltip || !name) return withStatus

  return (
    <Tooltip title={name}>
      <span style={{ display: 'inline-flex' }}>{withStatus}</span>
    </Tooltip>
  )
}

/**
 * Overlapping row of avatars for order participants and shortlists.
 *
 * @param {object} props
 * @param {{id?: string, name: string, avatarUrl?: string}[]} props.users people to show
 * @param {number} [props.max=4] avatars rendered before the "+n" surplus chip
 * @param {'xs'|'sm'|'md'|'lg'|'xl'|number} [props.size='sm'] size of each avatar
 */
export function UserAvatarGroup({ users = [], max = 4, size = 'sm', sx, ...rest }) {
  const pixels = resolveSize(size)

  return (
    <AvatarGroup
      max={max}
      sx={{
        '& .MuiAvatar-root': {
          width: pixels,
          height: pixels,
          fontSize: Math.max(11, Math.round(pixels * 0.36)),
          borderColor: 'background.paper',
        },
        ...sx,
      }}
      {...rest}
    >
      {users.map((user, index) => (
        <UserAvatar
          key={user.id ?? `${user.name}-${index}`}
          name={user.name}
          src={user.avatarUrl}
          size={size}
          tooltip
        />
      ))}
    </AvatarGroup>
  )
}
