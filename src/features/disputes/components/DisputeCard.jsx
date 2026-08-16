import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'

import StatusChip from '@/components/data-display/StatusChip'
import UserAvatar from '@/components/data-display/UserAvatar'
import {
  categoryLabel,
  describeDisputeState,
  disputeRoutesFor,
  isRaisedByViewer,
} from '@/features/disputes/utils/disputeDisplay'
import { formatRelativeTime, truncate } from '@/utils/formatters'

// One dispute in the list.
//
// The whole card is the link, because everything on it is context for the same
// destination. The accent border is reserved for the one state that is waiting
// on this member — in a list of five cases, exactly the ones they can act on
// should stand out, and nothing else may borrow the treatment (§6).
//
// The unread hint is deliberately soft: "last word was theirs" rather than a
// read-receipt count. Nothing in the data model tracks what a member has read
// (contract §6.17), so a hard unread badge would be a lie the first time
// somebody opened the thread and came back.

/**
 * @param {object} props
 * @param {object} props.dispute the dispute record
 * @param {object} [props.order] the order it froze, for the title and the link
 * @param {object} [props.counterpart] the other party's account
 * @param {object} [props.lastMessage] the newest message on the thread
 * @param {string} props.viewerId the reader's `usr_…`
 * @param {string} props.role the reader's `ROLES` value
 */
export default function DisputeCard({
  dispute,
  order,
  counterpart,
  lastMessage,
  viewerId,
  role,
}) {
  const routes = disputeRoutesFor(role)
  const state = describeDisputeState(dispute, role)
  const otherName = counterpart?.name ?? 'the other party'
  const raisedByViewer = isRaisedByViewer(dispute, viewerId)
  const hasReply =
    Boolean(lastMessage) && lastMessage.authorId !== viewerId && !state.accent

  return (
    <Box component="li" sx={{ listStyle: 'none' }}>
      <Card
        sx={{
          borderLeft: 4,
          borderLeftColor: state.accent ? 'warning.main' : 'transparent',
          transition: (theme) => theme.transitions.create(['box-shadow', 'border-color']),
          '&:hover': { boxShadow: 2 },
        }}
      >
        <CardActionArea
          component={RouterLink}
          to={routes.detail(dispute.id)}
          sx={{ p: { xs: 2, md: 2.5 }, alignItems: 'stretch' }}
        >
          <Stack spacing={1.25}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="flex-start"
              justifyContent="space-between"
              flexWrap="wrap"
              useFlexGap
            >
              <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 700, minWidth: 0 }}>
                {order?.title ?? 'Order no longer available'}
              </Typography>
              <StatusChip status={dispute.status} size="sm" tooltip />
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                variant="outlined"
                label={categoryLabel(dispute.category)}
                icon={<Icon icon="solar:tag-linear" width={14} aria-hidden="true" />}
                sx={{ height: 24 }}
              />
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                <UserAvatar name={otherName} src={counterpart?.avatarUrl} size="xs" />
                <Typography variant="body2" color="text.secondary" noWrap>
                  {raisedByViewer ? `You raised this with ${otherName}` : `${otherName} raised this`}
                </Typography>
              </Stack>
            </Stack>

            <Typography variant="body2" color="text.secondary">
              {truncate(dispute.description, 150)}
            </Typography>

            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              justifyContent="space-between"
              flexWrap="wrap"
              useFlexGap
            >
              {state.accent ? (
                <Stack
                  direction="row"
                  spacing={0.5}
                  alignItems="center"
                  sx={{
                    px: 1,
                    py: 0.25,
                    borderRadius: 1,
                    color: 'warning.dark',
                    bgcolor: (theme) => alpha(theme.palette.warning.main, 0.12),
                  }}
                >
                  <Icon icon="solar:chat-round-dots-linear" width={16} aria-hidden="true" />
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                    Action needed
                  </Typography>
                </Stack>
              ) : hasReply ? (
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'info.dark' }}>
                  <Icon icon="solar:chat-round-line-linear" width={16} aria-hidden="true" />
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    New reply
                  </Typography>
                </Stack>
              ) : (
                <Box />
              )}

              <Typography variant="caption" color="text.secondary">
                Last activity {formatRelativeTime(dispute.updatedAt ?? dispute.createdAt)}
              </Typography>
            </Stack>
          </Stack>
        </CardActionArea>
      </Card>
    </Box>
  )
}
