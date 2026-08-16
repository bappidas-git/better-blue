import { useCallback, useEffect, useRef } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { motion } from 'framer-motion'
import { Link as RouterLink } from 'react-router-dom'

import EmptyState from '@/components/feedback/EmptyState'
import ErrorState from '@/components/feedback/ErrorState'
import ListSkeleton from '@/components/feedback/skeletons/ListSkeleton'
import NotificationItem from '@/features/notifications/components/NotificationItem'
import { durations, easing } from '@/theme/motionTokens'

// The panel behind the bell — rendered inside a popover on desktop and inside a
// SideSheet on a phone, which is why it owns no chrome of its own beyond its
// header and footer.
//
// Keyboard model (§12): ArrowDown/ArrowUp move between rows, Home/End jump to
// the ends, Enter opens the focused row (it is a button, so that comes free),
// and Escape closes — handled by the popover/sheet, both of which are MUI
// Modals with a focus trap and focus return.

/** How many rows the panel shows before "View all" takes over. */
export const DROPDOWN_LIMIT = 8

/** Fast, because this opens under the pointer — 150ms, per §6. */
const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.025 } },
}

const rowVariants = {
  hidden: { opacity: 0, y: -4 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.fast / 1000, ease: easing },
  },
}

/**
 * @param {object} props
 * @param {object[]} props.items latest notifications, newest first
 * @param {boolean} props.isLoading first load
 * @param {object|null} props.error failure from the list read
 * @param {() => void} props.onRetry retry handler for the error state
 * @param {number} props.unreadCount live badge count, for the header action
 * @param {(notification: object) => void} props.onOpen row activated
 * @param {() => void} props.onMarkAllRead header action
 * @param {boolean} props.isMarkingAll disables the header action while it runs
 * @param {string} props.viewAllPath the notifications page for this role
 * @param {() => void} props.onClose called after any navigation
 */
export default function NotificationDropdown({
  items = [],
  isLoading,
  error,
  onRetry,
  unreadCount = 0,
  onOpen,
  onMarkAllRead,
  isMarkingAll = false,
  viewAllPath,
  onClose,
}) {
  const rowRefs = useRef([])

  useEffect(() => {
    rowRefs.current = rowRefs.current.slice(0, items.length)
  }, [items.length])

  const onKeyDown = useCallback(
    (event) => {
      const rows = rowRefs.current.filter(Boolean)
      if (rows.length === 0) return

      const current = rows.indexOf(document.activeElement)
      let next = null

      if (event.key === 'ArrowDown') next = current < 0 ? 0 : (current + 1) % rows.length
      else if (event.key === 'ArrowUp') next = current <= 0 ? rows.length - 1 : current - 1
      else if (event.key === 'Home') next = 0
      else if (event.key === 'End') next = rows.length - 1

      if (next === null) return
      event.preventDefault()
      rows[next].focus()
    },
    []
  )

  return (
    // The handler sits on the panel, not on the list, so ArrowDown works from
    // the header button too — otherwise tabbing into "Mark all read" and
    // pressing Down does nothing, which reads as a dead keyboard.
    <Stack onKeyDown={onKeyDown} sx={{ maxHeight: { sm: 520 }, height: '100%' }}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ px: 2, py: 1.5, flexShrink: 0 }}
      >
        <Typography variant="subtitle1" component="h2" sx={{ flexGrow: 1, fontWeight: 700 }}>
          Notifications
        </Typography>
        {unreadCount > 0 ? (
          <Button
            size="small"
            onClick={onMarkAllRead}
            disabled={isMarkingAll}
            sx={{ minHeight: 36 }}
          >
            Mark all read
          </Button>
        ) : null}
      </Stack>

      <Divider />

      <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 1, py: 1 }}>
        {error ? (
          <ErrorState
            dense
            title="We could not load your notifications"
            message="Nothing has been missed — the list just needs another go."
            error={error}
            onRetry={onRetry}
          />
        ) : isLoading ? (
          <ListSkeleton rows={4} avatar label="Loading your notifications" />
        ) : items.length === 0 ? (
          <EmptyState
            dense
            icon="solar:check-circle-linear"
            title="You’re all caught up"
            description="New proposals, deliveries, and payment updates land here."
          />
        ) : (
          <Stack
            component={motion.ul}
            variants={listVariants}
            initial="hidden"
            animate="visible"
            spacing={0.25}
            role="list"
            sx={{ listStyle: 'none', m: 0, p: 0 }}
          >
            {items.map((notification, index) => (
              <motion.div key={notification.id} variants={rowVariants} style={{ minWidth: 0 }}>
                <NotificationItem
                  dense
                  ref={(node) => {
                    rowRefs.current[index] = node
                  }}
                  notification={notification}
                  onOpen={() => onOpen(notification)}
                />
              </motion.div>
            ))}
          </Stack>
        )}
      </Box>

      {viewAllPath ? (
        <>
          <Divider />
          <Box sx={{ p: 1, flexShrink: 0 }}>
            <Button
              fullWidth
              component={RouterLink}
              to={viewAllPath}
              onClick={onClose}
              endIcon={<Icon icon="tabler:arrow-right" width={18} aria-hidden="true" />}
              sx={{ minHeight: 44 }}
            >
              View all notifications
            </Button>
          </Box>
        </>
      ) : null}
    </Stack>
  )
}
