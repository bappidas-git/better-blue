import { useCallback, useState } from 'react'

import { Icon } from '@iconify/react'
import Badge from '@mui/material/Badge'
import IconButton from '@mui/material/IconButton'
import Popover from '@mui/material/Popover'
import Tooltip from '@mui/material/Tooltip'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useNavigate } from 'react-router-dom'

import SideSheet from '@/components/layout/SideSheet'
import { useToast } from '@/components/feedback/ToastProvider'
import { useAuth } from '@/context/AuthContext'
import NotificationDropdown, {
  DROPDOWN_LIMIT,
} from '@/features/notifications/components/NotificationDropdown'
import { getNotificationPath } from '@/features/notifications/notificationRoutes'
import useApiQuery from '@/hooks/useApiQuery'
import useNotifications from '@/hooks/useNotifications'
import { notificationService } from '@/services/notificationService'

// The bell in the dashboard top bar (§4.2), replacing the inert placeholder
// Prompt 14 left there.
//
//   ≥ sm   a 360px popover anchored under the bell
//   < sm   a full-screen SideSheet, because a popover on a phone is a dialog
//          pretending not to be one
//
// The badge comes from `useNotifications`, so it is the same number the nav
// badge and the notifications page show, refreshed by the same poll (§7).

/** Desktop popover width — §6. */
const POPOVER_WIDTH = 360

export default function NotificationBell({ notificationsPath }) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const navigate = useNavigate()
  const toast = useToast()

  const { user } = useAuth()
  const { unreadCount, version, markRead, markAllRead } = useNotifications()

  const [anchorEl, setAnchorEl] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [isMarkingAll, setMarkingAll] = useState(false)

  const open = isMobile ? sheetOpen : Boolean(anchorEl)

  const close = useCallback(() => {
    setAnchorEl(null)
    setSheetOpen(false)
  }, [])

  // Only fetched while the panel is open: a bell nobody has clicked costs one
  // count query a minute, not a page of rows.
  const {
    data: list,
    isLoading,
    error,
    refetch,
  } = useApiQuery(
    () =>
      // `listByUser` already sorts newest first.
      notificationService.listByUser(user.id, { page: 1, limit: DROPDOWN_LIMIT }),
    [user?.id, version, open],
    { enabled: Boolean(user?.id) && open }
  )

  const onOpenItem = useCallback(
    (notification) => {
      close()
      // Navigate first: the read flag is bookkeeping, and making somebody wait
      // for a PATCH before the screen moves is the wrong way round. A failure
      // rolls the badge back inside the hook and is not worth a toast here —
      // the row simply stays unread.
      navigate(getNotificationPath(notification, user?.role))
      if (notification.read === false) markRead(notification.id).catch(() => {})
    },
    [close, markRead, navigate, user?.role]
  )

  const onMarkAllRead = useCallback(async () => {
    setMarkingAll(true)
    try {
      const { updated } = await markAllRead()
      if (updated > 0) toast.success(`Marked ${updated} notifications as read.`)
    } catch (failure) {
      toast.error(failure.message ?? 'We could not mark those as read.')
    } finally {
      setMarkingAll(false)
    }
  }, [markAllRead, toast])

  const label =
    unreadCount > 0
      ? `Notifications, ${unreadCount} unread`
      : 'Notifications, none unread'

  const panel = (
    <NotificationDropdown
      items={list?.items ?? []}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      unreadCount={unreadCount}
      onOpen={onOpenItem}
      onMarkAllRead={onMarkAllRead}
      isMarkingAll={isMarkingAll}
      viewAllPath={notificationsPath}
      onClose={close}
    />
  )

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={(event) =>
            isMobile ? setSheetOpen(true) : setAnchorEl(event.currentTarget)
          }
          sx={{ width: 44, height: 44 }}
        >
          <Badge
            badgeContent={unreadCount}
            max={99}
            color="error"
            overlap="circular"
            sx={{ '& .MuiBadge-badge': { fontSize: '0.625rem', height: 16, minWidth: 16 } }}
          >
            <Icon icon="solar:bell-linear" width={22} aria-hidden="true" />
          </Badge>
        </IconButton>
      </Tooltip>

      {isMobile ? (
        <SideSheet
          open={sheetOpen}
          onClose={close}
          title="Notifications"
          description={
            unreadCount > 0 ? `${unreadCount} unread` : 'Everything here has been read'
          }
        >
          {panel}
        </SideSheet>
      ) : (
        <Popover
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={close}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{
            paper: {
              // Labelled as a dialog so the popover is announced as the panel
              // the bell says it opens, not as an unnamed region.
              role: 'dialog',
              'aria-label': 'Notifications',
              sx: { width: POPOVER_WIDTH, maxWidth: 'calc(100vw - 32px)', mt: 1 },
            },
          }}
        >
          {panel}
        </Popover>
      )}
    </>
  )
}
