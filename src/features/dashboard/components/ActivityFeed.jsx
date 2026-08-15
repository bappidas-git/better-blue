import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { visuallyHidden } from '@mui/utils'

import EmptyState from '@/components/feedback/EmptyState'
import ListSkeleton from '@/components/feedback/skeletons/ListSkeleton'
import { getNotificationMeta } from '@/constants/notificationTypes'
import { formatRelativeTime } from '@/utils/formatters'

// "What happened lately" for every dashboard overview. Items are
// notification-shaped — the records `notificationService` writes — so the same
// component renders a buyer's order updates, a creator's proposal outcomes, and
// the admin console's moderation activity without a per-role variant.
//
// Icon and tone come from `NOTIFICATION_META` (00 §9), never from the caller:
// a `delivery_submitted` row looks the same wherever it appears.

/** `NOTIFICATION_META.tone` → palette key, matching `StatusChip`'s mapping. */
const TONE_PALETTE = {
  brand: 'primary',
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
}

function ActivityRow({ item, onItemClick, isLast }) {
  const meta = getNotificationMeta(item.type)
  const paletteKey = TONE_PALETTE[meta.tone]
  const interactive = typeof onItemClick === 'function'

  const body = (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="flex-start"
      sx={{
        width: '100%',
        px: interactive ? 1.5 : 0,
        py: 1.75,
        borderBottom: isLast ? 0 : 1,
        borderColor: 'divider',
        textAlign: 'left',
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          flexShrink: 0,
          width: 36,
          height: 36,
          borderRadius: 2,
          display: 'grid',
          placeItems: 'center',
          bgcolor: (theme) =>
            paletteKey
              ? alpha(theme.palette[paletteKey].main, 0.12)
              : alpha(theme.palette.text.primary, 0.06),
          color: paletteKey ? `${paletteKey}.main` : 'text.secondary',
        }}
      >
        <Icon icon={meta.icon} width={19} />
      </Box>

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="baseline">
          <Typography
            variant="subtitle2"
            sx={{ flexGrow: 1, minWidth: 0, fontWeight: item.read === false ? 700 : 600 }}
          >
            {item.title ?? meta.label}
          </Typography>
          {item.createdAt ? (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ flexShrink: 0 }}>
              {formatRelativeTime(item.createdAt)}
            </Typography>
          ) : null}
        </Stack>

        {item.body ? (
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
            {item.body}
          </Typography>
        ) : null}
      </Box>

      {item.read === false ? (
        <Box sx={{ flexShrink: 0, mt: 1, position: 'relative' }}>
          <Box
            aria-hidden="true"
            sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main' }}
          />
          {/* The dot is the only thing marking a row unread — say so out loud. */}
          <Box component="span" sx={visuallyHidden}>
            Unread
          </Box>
        </Box>
      ) : null}
    </Stack>
  )

  if (!interactive) return body

  return (
    <ButtonBase
      onClick={() => onItemClick(item)}
      sx={{
        display: 'block',
        width: '100%',
        borderRadius: 2,
        '&:hover': { backgroundColor: 'action.hover' },
      }}
    >
      {body}
    </ButtonBase>
  )
}

/**
 * @param {object} props
 * @param {Array<{id: string, type: string, title: string, body?: string, createdAt?: string, read?: boolean}>} props.items
 *   notification-shaped rows, newest first
 * @param {boolean} [props.loading=false] render skeleton rows instead
 * @param {number} [props.skeletonRows=4] how many skeleton rows while loading
 * @param {number} [props.maxItems] cap the rows rendered — the rest stay behind "View all"
 * @param {(item: object) => void} [props.onItemClick] makes each row a button; omit for a
 *   read-only feed
 * @param {string} [props.emptyTitle='No activity yet'] empty headline
 * @param {string} [props.emptyDescription] one line under the empty headline
 * @param {string} [props.emptyIcon='solar:bell-linear'] empty-state icon
 * @param {object} [props.sx] MUI system styles
 */
export default function ActivityFeed({
  items = [],
  loading = false,
  skeletonRows = 4,
  maxItems,
  onItemClick,
  emptyTitle = 'No activity yet',
  emptyDescription,
  emptyIcon = 'solar:bell-linear',
  sx,
  ...rest
}) {
  if (loading) {
    return <ListSkeleton rows={skeletonRows} label="Loading recent activity" sx={sx} {...rest} />
  }

  if (items.length === 0) {
    return (
      <EmptyState
        dense
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        sx={sx}
        {...rest}
      />
    )
  }

  const rows = typeof maxItems === 'number' ? items.slice(0, maxItems) : items

  return (
    <Box sx={sx} {...rest}>
      {rows.map((item, index) => (
        <ActivityRow
          key={item.id ?? index}
          item={item}
          onItemClick={onItemClick}
          isLast={index === rows.length - 1}
        />
      ))}
    </Box>
  )
}
