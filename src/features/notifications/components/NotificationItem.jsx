import { forwardRef } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import { getNotificationMeta } from '@/constants/notificationTypes'
import { formatDateTime, formatRelativeTime } from '@/utils/formatters'

// One row of the feed, shared by the bell dropdown and the notifications page
// (§7 — the two surfaces must not drift apart).
//
// Unread is carried three ways on purpose: a tinted background, a dot, and the
// word "unread" inside the accessible name (§12). The tint is 6% of the tone
// colour rather than a solid block — a feed where half the rows shout is a feed
// nobody reads.

/** `NOTIFICATION_META.tone` → theme palette key. Mirrors `StatusChip`. */
const TONE_PALETTE = {
  neutral: 'grey',
  info: 'info',
  warning: 'warning',
  success: 'success',
  error: 'error',
  brand: 'primary',
}

/** Icon tile colours for a tone, resolved against the theme. */
function toneColors(theme, tone) {
  const key = TONE_PALETTE[tone] ?? 'grey'
  const palette = theme.palette[key]
  const main = key === 'grey' ? theme.palette.text.secondary : palette.main
  return { main, surface: alpha(main, 0.1) }
}

function ToneTile({ tone, icon, size = 36 }) {
  return (
    <Box
      aria-hidden="true"
      sx={(theme) => ({
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 1.5,
        display: 'grid',
        placeItems: 'center',
        bgcolor: toneColors(theme, tone).surface,
        color: toneColors(theme, tone).main,
      })}
    >
      <Icon icon={icon} width={Math.round(size * 0.55)} />
    </Box>
  )
}

/**
 * @param {object} props
 * @param {object} props.notification a `notifications` record
 * @param {() => void} props.onOpen click / Enter — mark read, then navigate
 * @param {(read: boolean) => void} [props.onToggleRead] renders the kebab when given
 * @param {boolean} [props.dense=false] dropdown density (tighter, 2-line clamp)
 * @param {boolean} [props.busy=false] a write is in flight — disables the menu button
 */
const NotificationItem = forwardRef(function NotificationItem(
  { notification, onOpen, onToggleRead, dense = false, busy = false, ...rest },
  ref
) {
  const meta = getNotificationMeta(notification?.type)
  const unread = notification?.read === false

  // Everything a screen reader needs in one string, because the dot and the
  // tint say "unread" only to people who can see them.
  const accessibleName = [
    unread ? 'Unread notification' : 'Notification',
    meta.label,
    notification?.title,
    formatRelativeTime(notification?.createdAt),
  ]
    .filter(Boolean)
    .join('. ')

  return (
    <Box
      component="li"
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        position: 'relative',
        borderRadius: 2,
        ...(unread && {
          bgcolor: (theme) => alpha(toneColors(theme, meta.tone).main, 0.06),
        }),
      }}
      {...rest}
    >
      <ButtonBase
        ref={ref}
        onClick={onOpen}
        aria-label={accessibleName}
        sx={{
          flexGrow: 1,
          minWidth: 0,
          textAlign: 'left',
          alignItems: 'flex-start',
          gap: 1.5,
          px: dense ? 1.5 : 2,
          py: dense ? 1.25 : 1.75,
          borderRadius: 2,
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <ToneTile tone={meta.tone} icon={meta.icon} size={dense ? 36 : 40} />

        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <Typography
              variant="subtitle2"
              component="p"
              sx={{
                flexGrow: 1,
                minWidth: 0,
                fontWeight: unread ? 700 : 600,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {notification?.title}
            </Typography>

            {unread ? (
              <Box
                aria-hidden="true"
                sx={{
                  mt: 0.75,
                  width: 8,
                  height: 8,
                  flexShrink: 0,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                }}
              />
            ) : null}
          </Stack>

          {notification?.body ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 0.25,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {notification.body}
            </Typography>
          ) : null}

          <Tooltip title={formatDateTime(notification?.createdAt)} placement="top-start">
            <Typography
              variant="caption"
              color="text.secondary"
              component="time"
              dateTime={notification?.createdAt}
              sx={{ display: 'inline-block', mt: 0.75 }}
            >
              {formatRelativeTime(notification?.createdAt)}
            </Typography>
          </Tooltip>
        </Box>
      </ButtonBase>

      {onToggleRead ? (
        <Tooltip title={unread ? 'Mark as read' : 'Mark as unread'}>
          <span>
            <IconButton
              aria-label={
                unread
                  ? `Mark “${notification?.title}” as read`
                  : `Mark “${notification?.title}” as unread`
              }
              disabled={busy}
              onClick={() => onToggleRead(!unread)}
              sx={{ alignSelf: 'center', width: 44, height: 44, mr: 0.5 }}
            >
              <Icon
                icon={unread ? 'solar:check-read-linear' : 'solar:mailbox-linear'}
                width={20}
                aria-hidden="true"
              />
            </IconButton>
          </span>
        </Tooltip>
      ) : null}
    </Box>
  )
})

export default NotificationItem
