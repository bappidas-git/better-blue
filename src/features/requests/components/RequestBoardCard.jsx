import { useId } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Link from '@mui/material/Link'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { visuallyHidden } from '@mui/utils'
import { Link as RouterLink } from 'react-router-dom'

import StatusChip from '@/components/data-display/StatusChip'
import UserAvatar from '@/components/data-display/UserAvatar'
import { PROPOSAL_STATUS } from '@/constants/statuses'
import { describeDeadline, formatBudget } from '@/features/requests/utils/requestDisplay'
import { paths } from '@/routes/paths'
import { formatNumber, formatRelativeTime, truncate } from '@/utils/formatters'

// One open brief on the request board — the same card on the public board and
// inside the creator's dashboard, because a brief reads the same either way and
// two implementations would drift within a prompt (§7).
//
// The whole card is not a link: the "Invited" badge needs its own accessible
// text and the buyer row may grow an action later, so the title is the link and
// stretches its hit area across the card with the `::after` trick — the same
// pattern `BuyerRequestCard` uses.

/**
 * How the card reports the viewing creator's own offer on this brief. Only the
 * wording changes with the status — the presence of the chip always means
 * "answered, and you cannot answer again".
 */
const ANSWERED_CHIP = Object.freeze({
  [PROPOSAL_STATUS.SUBMITTED]: { label: 'Proposal sent', icon: 'tabler:check', tone: 'success' },
  [PROPOSAL_STATUS.SHORTLISTED]: {
    label: 'Shortlisted',
    icon: 'tabler:star-filled',
    tone: 'primary',
  },
  [PROPOSAL_STATUS.ACCEPTED]: { label: 'You won this', icon: 'tabler:trophy', tone: 'success' },
  [PROPOSAL_STATUS.DECLINED]: { label: 'Not selected', icon: 'tabler:x', tone: 'default' },
  [PROPOSAL_STATUS.WITHDRAWN]: {
    label: 'Proposal withdrawn',
    icon: 'tabler:arrow-back-up',
    tone: 'default',
  },
  [PROPOSAL_STATUS.EXPIRED]: { label: 'Proposal expired', icon: 'tabler:clock-x', tone: 'default' },
})

/** A labelled fact in the card's meta row. */
function Fact({ icon, label, value, tone = 'text.secondary', title }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }} title={title}>
      <Icon icon={icon} width={16} aria-hidden="true" style={{ flexShrink: 0 }} />
      <Typography variant="body2" sx={{ color: tone, whiteSpace: 'nowrap' }}>
        <Box component="span" sx={visuallyHidden}>
          {label}:{' '}
        </Box>
        {value}
      </Typography>
    </Stack>
  )
}

/**
 * @param {object} props
 * @param {object} props.request an open brief, with `buyer` from
 *   `requestService.listBoard`
 * @param {string} [props.categoryLabel] resolved category name
 * @param {boolean} [props.isInvited=false] the buyer wrote this brief from the
 *   viewing creator's storefront — see `boardFilters#isInvitedTo`
 * @param {string} [props.proposalStatus] the `PROPOSAL_STATUS` of this creator's
 *   own offer on this brief, when they have one. A brief takes **one** proposal
 *   per creator whatever became of it (contract §6.8), so any value here means
 *   "you have already answered this" — the chip only changes what it says.
 */
export default function RequestBoardCard({
  request,
  categoryLabel,
  isInvited = false,
  proposalStatus,
}) {
  const titleId = useId()

  const deadline = describeDeadline(request)
  const proposals = Number(request.proposalsCount) || 0
  const buyerName = request.buyer?.companyName ?? request.buyer?.name ?? 'A BetterBlue business'
  const postedAt = request.publishedAt ?? request.createdAt
  const answered = proposalStatus ? ANSWERED_CHIP[proposalStatus] : null

  return (
    <Card
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        transition: (theme) => theme.transitions.create(['box-shadow', 'border-color']),
        '&:hover': { boxShadow: 2 },
        '&:focus-within': { boxShadow: 2 },
        ...(isInvited
          ? { borderColor: 'primary.light', borderWidth: 1, borderStyle: 'solid' }
          : null),
      }}
    >
      <CardContent
        sx={{
          p: { xs: 2, md: 2.5 },
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          '&:last-child': { pb: { xs: 2, md: 2.5 } },
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
          {categoryLabel ? <Chip label={categoryLabel} size="small" variant="outlined" /> : null}
          <StatusChip status={request.contentType} size="sm" tooltip />
          {isInvited ? (
            <Chip
              size="small"
              color="primary"
              icon={<Icon icon="tabler:mail-star" width={14} aria-hidden="true" />}
              // Not just "Invited": on a board of twenty cards the badge has to
              // say who was invited and to what, or it means nothing read aloud.
              aria-label="This buyer invited you to propose on this request"
              label="Invited"
              sx={{ height: 24, fontWeight: 600 }}
            />
          ) : null}
          {answered ? (
            <Chip
              size="small"
              variant="outlined"
              color={answered.tone}
              icon={<Icon icon={answered.icon} width={14} aria-hidden="true" />}
              label={answered.label}
              sx={{ height: 24 }}
            />
          ) : null}
        </Stack>

        <Typography
          id={titleId}
          variant="subtitle1"
          component="h3"
          sx={{ fontWeight: 600, lineHeight: 1.35 }}
        >
          <Link
            component={RouterLink}
            to={paths.requestDetail(request.id)}
            underline="hover"
            color="inherit"
            sx={{ '&::after': { content: '""', position: 'absolute', inset: 0, zIndex: 0 } }}
          >
            {request.title}
          </Link>
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {truncate(request.description, 150)}
        </Typography>

        <Divider sx={{ my: 1.5 }} />

        <Stack direction="row" spacing={{ xs: 1.5, sm: 2.5 }} flexWrap="wrap" useFlexGap>
          <Fact
            icon="solar:wallet-money-linear"
            label="Budget"
            value={formatBudget(request)}
            tone="text.primary"
          />
          <Fact
            icon="solar:calendar-linear"
            label="Deadline"
            value={deadline.relative || deadline.date}
            tone={deadline.tone}
            title={deadline.label}
          />
          <Fact
            icon="solar:inbox-in-linear"
            label="Proposals"
            value={
              proposals === 0
                ? 'No proposals yet'
                : `${formatNumber(proposals)} ${proposals === 1 ? 'proposal' : 'proposals'}`
            }
          />
        </Stack>

        {/* Pushed to the bottom so a row of cards lines its buyer rows up even
            when the titles wrap to different heights. */}
        <Stack
          direction="row"
          spacing={1.25}
          alignItems="center"
          sx={{ mt: 'auto', pt: 1.75, minWidth: 0 }}
        >
          <UserAvatar name={buyerName} src={request.buyer?.logoUrl} size="sm" variant="rounded" />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
              {buyerName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Posted {formatRelativeTime(postedAt)}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}

/** Matching placeholder — same rhythm as the card, so the grid does not reflow. */
export function RequestBoardCardSkeleton() {
  return (
    <Card aria-hidden="true">
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
          <Skeleton variant="rounded" width={92} height={24} />
          <Skeleton variant="rounded" width={64} height={24} />
        </Stack>
        <Skeleton variant="text" width="90%" height={28} />
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="72%" />
        <Divider sx={{ my: 1.5 }} />
        <Stack direction="row" spacing={2.5}>
          <Skeleton variant="text" width={72} />
          <Skeleton variant="text" width={88} />
          <Skeleton variant="text" width={80} />
        </Stack>
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ pt: 1.75 }}>
          <Skeleton variant="rounded" width={32} height={32} />
          <Box sx={{ flexGrow: 1 }}>
            <Skeleton variant="text" width="45%" />
            <Skeleton variant="text" width="30%" height={14} />
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}
