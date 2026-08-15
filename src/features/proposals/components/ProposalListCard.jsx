import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
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
import { paths } from '@/routes/paths'
import { formatCurrency, formatDate } from '@/utils/formatters'

import useCommission from '../hooks/useCommission'

// One of the creator's own proposals.
//
// The buyer's `ProposalCard` (Prompt 18) shows an offer to the person deciding
// on it; this one shows the same offer to the person who sent it, so the two
// answer different questions and stay separate components. Here the headline is
// the brief, the price carries its after-commission subline, and the actions
// are the two things a creator can still do about it.

/** A labelled fact in the card's meta row. */
function Fact({ icon, label, value, tone = 'text.secondary' }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
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
 * @param {object} props.proposal an offer from `proposalService.listForCreator`,
 *   carrying `request` and `buyer`
 * @param {object} [props.order] the order an accepted offer created
 * @param {() => void} [props.onEdit] open the dialog prefilled — `submitted` only
 * @param {() => void} [props.onWithdraw] withdraw it — `submitted`/`shortlisted`
 */
export default function ProposalListCard({ proposal, order, onEdit, onWithdraw }) {
  const request = proposal.request
  const isShortlisted = proposal.status === PROPOSAL_STATUS.SHORTLISTED
  const isSubmitted = proposal.status === PROPOSAL_STATUS.SUBMITTED
  const isAccepted = proposal.status === PROPOSAL_STATUS.ACCEPTED
  const canWithdraw = isSubmitted || isShortlisted

  const { net, isLoading: isRateLoading } = useCommission(proposal.price, {
    categoryId: request?.categoryId,
    creatorId: proposal.creatorId,
  })

  const buyerName = proposal.buyer?.companyName ?? proposal.buyer?.name ?? 'A BetterBlue business'
  const money = (value) => formatCurrency(value, proposal.currency)

  return (
    <Card
      sx={{
        ...(isShortlisted
          ? { borderColor: 'primary.main', borderWidth: 1, borderStyle: 'solid' }
          : null),
      }}
    >
      <CardContent sx={{ p: { xs: 2, md: 2.5 }, '&:last-child': { pb: { xs: 2, md: 2.5 } } }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
          <StatusChip status={proposal.status} size="sm" tooltip />
          {isShortlisted ? (
            <Chip
              size="small"
              color="primary"
              icon={<Icon icon="tabler:star-filled" width={14} aria-hidden="true" />}
              label="Shortlisted by buyer"
              sx={{ height: 24, fontWeight: 600 }}
            />
          ) : null}
        </Stack>

        <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 600, lineHeight: 1.35 }}>
          {request ? (
            <Link
              component={RouterLink}
              to={paths.requestDetail(request.id)}
              underline="hover"
              color="inherit"
            >
              {request.title}
            </Link>
          ) : (
            'This request is no longer available'
          )}
        </Typography>

        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1, minWidth: 0 }}>
          <UserAvatar name={buyerName} src={proposal.buyer?.logoUrl} size="xs" variant="rounded" />
          <Typography variant="body2" color="text.secondary" noWrap>
            {buyerName}
          </Typography>
        </Stack>

        <Divider sx={{ my: 1.5 }} />

        <Stack direction="row" spacing={{ xs: 1.5, sm: 3 }} flexWrap="wrap" useFlexGap>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              <Box component="span" sx={visuallyHidden}>
                Your price:{' '}
              </Box>
              {money(proposal.price)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {net === null ? (
                isRateLoading ? (
                  <Skeleton variant="text" width={130} />
                ) : (
                  'After commission unavailable'
                )
              ) : (
                `${money(net)} to you after commission`
              )}
            </Typography>
          </Box>

          <Stack spacing={0.5} sx={{ justifyContent: 'center' }}>
            <Fact
              icon="solar:clock-circle-linear"
              label="Delivery"
              value={`${proposal.deliveryDays} days`}
            />
            <Fact
              icon="solar:calendar-linear"
              label="Submitted"
              value={`Sent ${formatDate(proposal.createdAt)}`}
            />
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
          {isSubmitted ? (
            <Button
              size="small"
              variant="outlined"
              onClick={onEdit}
              startIcon={<Icon icon="tabler:pencil" width={16} aria-hidden="true" />}
            >
              Edit
            </Button>
          ) : null}

          {canWithdraw ? (
            <Button size="small" color="error" onClick={onWithdraw}>
              Withdraw
            </Button>
          ) : null}

          {request ? (
            <Button
              size="small"
              color="inherit"
              component={RouterLink}
              to={paths.requestDetail(request.id)}
            >
              View request
            </Button>
          ) : null}

          {isAccepted && order ? (
            <Button
              size="small"
              variant="gradient"
              component={RouterLink}
              to={paths.creatorOrderDetail(order.id)}
              startIcon={<Icon icon="solar:box-linear" width={16} aria-hidden="true" />}
            >
              Open the order
            </Button>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  )
}

/** Matching placeholder — same rhythm as the card, so the list does not reflow. */
export function ProposalListCardSkeleton() {
  return (
    <Card aria-hidden="true">
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Skeleton variant="rounded" width={88} height={24} sx={{ mb: 1.5 }} />
        <Skeleton variant="text" width="80%" height={26} />
        <Skeleton variant="text" width="35%" />
        <Divider sx={{ my: 1.5 }} />
        <Stack direction="row" spacing={3}>
          <Box>
            <Skeleton variant="text" width={80} height={26} />
            <Skeleton variant="text" width={150} height={14} />
          </Box>
          <Box>
            <Skeleton variant="text" width={90} />
            <Skeleton variant="text" width={110} />
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Skeleton variant="rounded" width={72} height={32} />
          <Skeleton variant="rounded" width={92} height={32} />
        </Stack>
      </CardContent>
    </Card>
  )
}
