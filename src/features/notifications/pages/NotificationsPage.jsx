import { useCallback, useEffect, useMemo, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import FormControlLabel from '@mui/material/FormControlLabel'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'
import { useNavigate } from 'react-router-dom'

import EmptyState from '@/components/feedback/EmptyState'
import ErrorState from '@/components/feedback/ErrorState'
import ListSkeleton from '@/components/feedback/skeletons/ListSkeleton'
import { useConfirm } from '@/components/feedback/ConfirmDialogProvider'
import { useToast } from '@/components/feedback/ToastProvider'
import {
  NOTIFICATION_CATEGORY_META,
  NOTIFICATION_META,
  NOTIFICATION_TYPE,
} from '@/constants/notificationTypes'
import { useAuth } from '@/context/AuthContext'
import CategoryFilterChips from '@/features/notifications/components/CategoryFilterChips'
import NotificationItem from '@/features/notifications/components/NotificationItem'
import {
  ALL_CATEGORIES,
  categoriesForRole,
} from '@/features/notifications/notificationFilters'
import { getNotificationPath } from '@/features/notifications/notificationRoutes'
import useApiQuery from '@/hooks/useApiQuery'
import useListParams, { listParam } from '@/hooks/useListParams'
import useNotifications from '@/hooks/useNotifications'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { notificationService } from '@/services/notificationService'
import { formatDate } from '@/utils/formatters'

// "Notifications" — **one page, every role** (§7).
//
// Like the disputes screens in Prompt 26, the buyer's copy, the creator's copy,
// and (from Prompt 28) the admin's copy are the same component mounted at three
// paths. The only role-dependent things here are which category chips appear and
// where a row's deep link goes, and both of those read the signed-in role for
// themselves. Prompt 28 should mount this unchanged at `/admin/notifications`.

/** Rows per "Load more" press (§4.3). */
const PAGE_SIZE = 25

/** Above this many unread, "Mark all as read" asks first (§4.3). */
const CONFIRM_ABOVE = 20

/**
 * Category and unread live in the URL (00 §12) so a filtered feed is a link.
 * How far somebody has scrolled does **not**: "load more" is a session-length
 * decision, not a filter, and a `?shown=125` riding along in a shared link
 * would make the recipient wait for 125 rows they did not ask for.
 */
const NOTIFICATION_PARAMS = Object.freeze({
  category: listParam.text({ fallback: '', maxLength: 32 }),
  unread: listParam.flag({ fallback: false }),
})

/** `notifications.type` values belonging to a category — the list filter. */
const typesFor = (category) =>
  Object.values(NOTIFICATION_TYPE).filter(
    (type) => NOTIFICATION_META[type]?.category === category
  )

/**
 * Day buckets, newest first. `Today` / `Yesterday` / the date — the same
 * grouping a message thread uses, because a feed is read the same way.
 */
function groupByDay(items) {
  const groups = []
  const index = new Map()

  const startOfDay = (iso) => {
    const date = new Date(iso)
    return Number.isNaN(date.getTime())
      ? 'unknown'
      : new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  }

  const today = startOfDay(new Date().toISOString())
  const yesterday = today - 24 * 60 * 60 * 1000

  items.forEach((item) => {
    const key = startOfDay(item.createdAt)
    if (!index.has(key)) {
      const label =
        key === 'unknown'
          ? 'Earlier'
          : key === today
            ? 'Today'
            : key === yesterday
              ? 'Yesterday'
              : formatDate(item.createdAt)
      const group = { key: String(key), label, items: [] }
      index.set(key, group)
      groups.push(group)
    }
    index.get(key).items.push(item)
  })

  return groups
}

/** What each filter says when it has nothing to show. */
function emptyStateFor({ category, unreadOnly }) {
  if (unreadOnly) {
    return {
      icon: 'solar:check-circle-linear',
      title: 'Nothing unread',
      description: 'Everything that has come in has been read. Switch the filter off to see it.',
    }
  }
  if (category) {
    return {
      icon: 'solar:bell-off-linear',
      title: `Nothing under ${NOTIFICATION_CATEGORY_META[category]?.label ?? 'this filter'}`,
      description: 'Notifications in this category will appear here as they arrive.',
    }
  }
  return {
    icon: 'solar:bell-linear',
    title: 'No notifications yet',
    description:
      'Proposals, deliveries, payments, and anything needing a decision will show up here.',
  }
}

export default function NotificationsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()

  const userId = user?.id
  const role = user?.role

  const { unreadCount, version, markRead, markAllRead } = useNotifications()
  const { values, setValue } = useListParams(NOTIFICATION_PARAMS)

  // A category from a hand-edited URL that this role can never receive is
  // dropped rather than left to render an empty list with a chip nobody can see.
  const allowed = useMemo(() => categoriesForRole(role), [role])
  const category = allowed.includes(values.category) ? values.category : ALL_CATEGORIES
  const unreadOnly = values.unread

  const [shown, setShown] = useState(PAGE_SIZE)
  const [busyId, setBusyId] = useState(null)
  const [isMarkingAll, setMarkingAll] = useState(false)

  // A filter change starts the list again from the top.
  useEffect(() => {
    setShown(PAGE_SIZE)
  }, [category, unreadOnly])

  // MOCK-PAGINATION: "load more" re-reads rows 1..N rather than appending page
  // N+1, so a mark-read anywhere in the list stays correct without merge logic.
  // With a mock dataset that is a few dozen rows; Laravel replaces it with a
  // cursor and an append (contract §6.19).
  const {
    data: list,
    isLoading,
    error,
    refetch,
  } = useApiQuery(
    () =>
      notificationService.listByUser(userId, {
        page: 1,
        limit: shown,
        filters: {
          ...(unreadOnly ? { read: false } : {}),
          ...(category ? { type: typesFor(category) } : {}),
        },
      }),
    [userId, shown, category, unreadOnly, version],
    { enabled: Boolean(userId) }
  )

  const items = useMemo(() => list?.items ?? [], [list])
  const total = list?.total ?? 0
  const groups = useMemo(() => groupByDay(items), [items])

  const onOpen = useCallback(
    (notification) => {
      navigate(getNotificationPath(notification, role))
      if (notification.read === false) markRead(notification.id).catch(() => {})
    },
    [markRead, navigate, role]
  )

  const onToggleRead = useCallback(
    async (notification, read) => {
      setBusyId(notification.id)
      try {
        await markRead(notification.id, read)
      } catch (failure) {
        toast.error(failure.message ?? 'We could not update that notification.')
      } finally {
        setBusyId(null)
      }
    },
    [markRead, toast]
  )

  const onMarkAllRead = useCallback(async () => {
    if (unreadCount > CONFIRM_ABOVE) {
      const ok = await confirm({
        title: `Mark ${unreadCount} notifications as read?`,
        message:
          'They stay in your feed and nothing is deleted — the unread badge simply clears. ' +
          'You can mark individual notifications unread again afterwards.',
        confirmLabel: 'Mark all as read',
      })
      if (!ok) return
    }

    setMarkingAll(true)
    try {
      const { updated, remaining } = await markAllRead()
      toast.success(
        remaining > 0
          ? `Marked ${updated} as read. ${remaining} more to go — run it again.`
          : `Marked ${updated} notifications as read.`
      )
    } catch (failure) {
      toast.error(failure.message ?? 'We could not mark those as read.')
    } finally {
      setMarkingAll(false)
    }
  }, [confirm, markAllRead, toast, unreadCount])

  return (
    <DashboardPage
      title="Notifications"
      subtitle={
        unreadCount > 0
          ? `${unreadCount} unread. Everything BetterBlue has told you, newest first.`
          : 'Everything BetterBlue has told you, newest first.'
      }
      actions={
        unreadCount > 0 ? (
          <Button
            variant="outlined"
            onClick={onMarkAllRead}
            disabled={isMarkingAll}
            startIcon={<Icon icon="solar:check-read-linear" width={18} aria-hidden="true" />}
          >
            Mark all as read
          </Button>
        ) : null
      }
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={{ xs: 1, md: 2 }}
        alignItems={{ xs: 'stretch', md: 'center' }}
        sx={{ mb: { xs: 2, md: 2.5 } }}
      >
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <CategoryFilterChips
            role={role}
            value={category}
            onChange={(next) => setValue('category', next ?? '')}
          />
        </Box>

        <FormControlLabel
          sx={{ m: 0, flexShrink: 0, minHeight: 44 }}
          control={
            <Switch
              checked={unreadOnly}
              onChange={(event) => setValue('unread', event.target.checked)}
              inputProps={{ 'aria-label': 'Show unread notifications only' }}
            />
          }
          label="Unread only"
        />
      </Stack>

      {error ? (
        <ErrorState
          title="We could not load your notifications"
          message="Nothing has been missed — this list just needs another go."
          error={error}
          onRetry={refetch}
        />
      ) : isLoading && items.length === 0 ? (
        <ListSkeleton rows={6} avatar label="Loading your notifications" />
      ) : items.length === 0 ? (
        <EmptyState {...emptyStateFor({ category, unreadOnly })} />
      ) : (
        <>
          <Stack spacing={{ xs: 2, md: 3 }}>
            {groups.map((group) => (
              <Box key={group.key} component="section" aria-labelledby={`day-${group.key}`}>
                <Typography
                  id={`day-${group.key}`}
                  variant="overline"
                  component="h2"
                  color="text.secondary"
                  sx={{ display: 'block', mb: 1 }}
                >
                  {group.label}
                </Typography>

                <Card sx={{ p: { xs: 0.5, md: 1 } }}>
                  <Stack component="ul" spacing={0.25} sx={{ listStyle: 'none', m: 0, p: 0 }}>
                    {group.items.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        busy={busyId === notification.id}
                        onOpen={() => onOpen(notification)}
                        onToggleRead={(read) => onToggleRead(notification, read)}
                      />
                    ))}
                  </Stack>
                </Card>
              </Box>
            ))}
          </Stack>

          <Stack alignItems="center" spacing={1} sx={{ mt: 3 }}>
            {items.length < total ? (
              <Button
                variant="outlined"
                onClick={() => setShown((current) => current + PAGE_SIZE)}
                disabled={isLoading}
                sx={{ minHeight: 44 }}
              >
                {isLoading ? 'Loading…' : 'Load more'}
              </Button>
            ) : null}

            <Typography variant="caption" color="text.secondary">
              Showing {items.length} of {total}
            </Typography>
          </Stack>
        </>
      )}
    </DashboardPage>
  )
}
