import { Icon } from '@iconify/react'
import AvatarGroup from '@mui/material/AvatarGroup'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

import StatusChip from '@/components/data-display/StatusChip'
import UserAvatar from '@/components/data-display/UserAvatar'
import { AgeBadge } from '@/features/admin/shared'
import {
  awaitingPartyLabel,
  DISPUTE_SLA,
  sideLabel,
} from '@/features/admin/disputes/utils/disputeQueue'
import { shortId } from '@/features/admin/operations/utils/operationsFilters'
import { categoryLabel } from '@/features/disputes/utils/disputeDisplay'
import { paths } from '@/routes/paths'
import { EMPTY_PLACEHOLDER, formatCurrency, formatRelativeTime } from '@/utils/formatters'

// One case in the queue — Prompt 33 §4.2.
//
// A card rather than a table row at every width, and deliberately so: the six
// things a reviewer triages on (who is waiting, how long, how much is frozen,
// what it is about, who owns it, what happened last) do not fit a scannable
// row without shrinking three of them to nothing. The console's `DataTable`
// screens are lists of records; this is a list of *decisions to make*.
//
// The whole card is the link, with one exception. "Assign to me" is a button
// **inside** it, because picking a case up without opening it is the entire
// point of the unassigned tab — and a nested button needs to sit outside the
// `CardActionArea` or a click lands on both.

/** The buyer and the creator as a pair, which is what a case is between. */
function PartyPair({ buyer, creator }) {
  const people = [
    { user: buyer?.user ?? buyer, side: 'buyer' },
    { user: creator?.user ?? creator, side: 'creator' },
  ].filter((entry) => entry.user)

  if (people.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        {EMPTY_PLACEHOLDER}
      </Typography>
    )
  }

  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
      <AvatarGroup
        max={2}
        spacing="small"
        sx={{ '& .MuiAvatar-root': { width: 28, height: 28, fontSize: '0.75rem' } }}
      >
        {people.map((entry) => (
          <UserAvatar
            key={entry.user.id}
            name={entry.user.name ?? sideLabel(entry.side)}
            src={entry.user.avatarUrl}
            size="xs"
          />
        ))}
      </AvatarGroup>
      <Typography variant="caption" color="text.secondary" noWrap sx={{ minWidth: 0 }}>
        {people.map((entry) => entry.user.name ?? sideLabel(entry.side)).join(' · ')}
      </Typography>
    </Stack>
  )
}

/**
 * @param {object} props
 * @param {object} props.dispute a row from `disputeService.adminListQueue`
 * @param {(dispute: object) => void} [props.onAssignToMe] omitted when the case
 *   is already this reviewer's, already decided, or they cannot resolve
 * @param {boolean} [props.assigning=false] a claim is in flight
 */
export default function DisputeQueueRow({ dispute, onAssignToMe, assigning = false }) {
  const order = dispute.order
  const held = dispute.payment
  const awaiting = awaitingPartyLabel(dispute)
  const outcome = dispute.resolution?.outcome

  return (
    <Box component="li" sx={{ listStyle: 'none' }}>
      <Card
        sx={{
          // The accent is reserved for cases parked on a party — the ones where
          // the queue is *not* the thing holding them up.
          borderLeft: 4,
          borderLeftColor: awaiting ? 'warning.main' : 'transparent',
          transition: (theme) => theme.transitions.create(['box-shadow', 'border-color']),
          '&:hover': { boxShadow: 2 },
        }}
      >
        <CardActionArea
          component={RouterLink}
          to={paths.adminDisputeDetail(dispute.id)}
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
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 700 }}>
                  {order?.title ?? 'Order no longer available'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {shortId(dispute.id)} · {categoryLabel(dispute.category)}
                </Typography>
              </Box>

              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                <StatusChip status={dispute.status} size="sm" tooltip />
                <AgeBadge date={dispute.createdAt} noun="Raised" {...DISPUTE_SLA} />
              </Stack>
            </Stack>

            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
              {/* A plain chip, deliberately: `EntityRefChip` renders a link, and
                  a link inside the card's own link is invalid HTML and a
                  keyboard trap. The row opens the case; the case's header links
                  on to the order. */}
              <Chip
                size="small"
                variant="outlined"
                icon={<Icon icon="solar:box-linear" width={14} aria-hidden="true" />}
                label={dispute.orderId}
                sx={{ fontSize: '0.6875rem' }}
              />
              {held ? (
                <Chip
                  size="small"
                  variant="outlined"
                  color="warning"
                  icon={<Icon icon="solar:lock-password-linear" width={14} aria-hidden="true" />}
                  label={`${formatCurrency(held.amount, held.currency)} held`}
                  sx={{ fontSize: '0.6875rem', fontWeight: 600 }}
                />
              ) : (
                <Chip
                  size="small"
                  variant="outlined"
                  label="No escrow held"
                  sx={{ fontSize: '0.6875rem' }}
                />
              )}
              {outcome ? <StatusChip status={outcome} size="sm" showDot={false} tooltip /> : null}
            </Stack>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={{ xs: 1, sm: 2 }}
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              justifyContent="space-between"
            >
              <PartyPair buyer={dispute.buyer} creator={dispute.creator} />

              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                {dispute.assignee ? (
                  <Tooltip title={`Assigned to ${dispute.assignee.name}`}>
                    <Box sx={{ display: 'inline-flex' }}>
                      <UserAvatar
                        name={dispute.assignee.name}
                        src={dispute.assignee.avatarUrl}
                        size="xs"
                      />
                    </Box>
                  </Tooltip>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    Unassigned
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  Last activity {formatRelativeTime(dispute.updatedAt ?? dispute.createdAt)}
                </Typography>
              </Stack>
            </Stack>

            {awaiting ? (
              <Typography variant="caption" sx={{ color: 'warning.dark', fontWeight: 600 }}>
                {awaiting}
              </Typography>
            ) : null}
          </Stack>
        </CardActionArea>

        {onAssignToMe ? (
          <Box sx={{ px: { xs: 2, md: 2.5 }, pb: { xs: 2, md: 2.5 }, pt: 0 }}>
            <Button
              size="small"
              variant="outlined"
              color="primary"
              disabled={assigning}
              onClick={() => onAssignToMe(dispute)}
              startIcon={<Icon icon="solar:user-check-linear" width={16} aria-hidden="true" />}
              aria-label={`Assign the ${categoryLabel(dispute.category)} case on ${
                order?.title ?? 'this order'
              } to me`}
              sx={{ minHeight: 40 }}
            >
              {assigning ? 'Assigning…' : 'Assign to me'}
            </Button>
          </Box>
        ) : null}
      </Card>
    </Box>
  )
}
