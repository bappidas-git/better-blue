import { useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Checkbox from '@mui/material/Checkbox'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

import RatingStars from '@/components/data-display/RatingStars'
import StatusChip from '@/components/data-display/StatusChip'
import UserAvatar from '@/components/data-display/UserAvatar'
import { PROPOSAL_STATUS } from '@/constants/statuses'
import { isLiveProposal } from '@/features/proposals/utils/proposalDisplay'
import { paths } from '@/routes/paths'
import { formatCurrency, formatNumber } from '@/utils/formatters'

// One creator's offer, as the buyer reads it while deciding.
//
// The visual hierarchy is deliberate (§6): price is the largest thing on the
// card and the creator's name and rating are the second, because those are the
// two facts a buyer compares first. Everything else — turnaround, revisions,
// the message, the samples — supports them.

/** Lines of the cover message shown before "Read more". */
const MESSAGE_CLAMP = 3

/** Sample thumbnails on a card; the rest are behind "+n" in the detail sheet. */
const THUMBNAIL_LIMIT = 4

/** A number with its unit, stacked under a quiet label. */
function Term({ label, value, hint }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" component="p">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {value}
      </Typography>
      {hint ? (
        <Typography variant="caption" color="text.disabled" component="p">
          {hint}
        </Typography>
      ) : null}
    </Box>
  )
}

/** The creator behind an offer: avatar, name, and the two numbers that matter. */
export function CreatorSummary({ creator, size = 'md', showLink = true }) {
  const name = creator?.name ?? 'Creator'
  const hasRating = Number.isFinite(Number(creator?.ratingAvg)) && creator.ratingCount > 0

  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
      <UserAvatar name={name} src={creator?.avatarUrl} size={size === 'sm' ? 'sm' : 'md'} />
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
          {showLink && creator?.profileId ? (
            <Link
              component={RouterLink}
              to={paths.creatorProfile(creator.profileId)}
              target="_blank"
              rel="noopener"
              underline="hover"
              color="inherit"
              variant="subtitle2"
              sx={{
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                minWidth: 0,
              }}
            >
              <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
              </Box>
              <Icon
                icon="tabler:external-link"
                width={14}
                aria-label="opens in a new tab"
                role="img"
                style={{ flexShrink: 0 }}
              />
            </Link>
          ) : (
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
              {name}
            </Typography>
          )}
          {creator?.verified ? (
            <Tooltip title="Identity verified by BetterBlue">
              <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}>
                <Icon icon="solar:verified-check-bold" width={16} role="img" aria-label="Verified creator" />
              </Box>
            </Tooltip>
          ) : null}
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          {hasRating ? (
            <RatingStars value={creator.ratingAvg} count={creator.ratingCount} size="sm" />
          ) : (
            <Typography variant="caption" color="text.secondary">
              No reviews yet
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            {formatNumber(creator?.completedOrders ?? 0)} completed
          </Typography>
        </Stack>
      </Box>
    </Stack>
  )
}

/**
 * @param {object} props
 * @param {object} props.proposal an enriched offer (`creator`, `samples`)
 * @param {boolean} [props.canDecide] the brief is still open, so accept/decline apply
 * @param {boolean} [props.compareMode] show the compare checkbox instead of nothing
 * @param {boolean} [props.selected] this offer is in the compare set
 * @param {boolean} [props.selectionFull] the compare set is full and this one is not in it
 * @param {(proposalId: string) => void} [props.onToggleCompare]
 * @param {(proposal: object) => void} props.onOpen open the detail sheet
 * @param {(proposal: object) => void} props.onShortlist toggle the star
 * @param {(proposal: object) => void} props.onDecline
 * @param {(proposal: object) => void} props.onAccept
 * @param {(proposal: object, index: number) => void} props.onOpenSample lightbox
 * @param {boolean} [props.busy] a mutation on this offer is in flight
 */
export default function ProposalCard({
  proposal,
  canDecide = false,
  compareMode = false,
  selected = false,
  selectionFull = false,
  onToggleCompare,
  onOpen,
  onShortlist,
  onDecline,
  onAccept,
  onOpenSample,
  busy = false,
}) {
  const [expanded, setExpanded] = useState(false)

  const creatorName = proposal.creator?.name ?? 'this creator'
  const isShortlisted = proposal.status === PROPOSAL_STATUS.SHORTLISTED
  const live = isLiveProposal(proposal)
  const decidable = canDecide && live
  const samples = proposal.samples ?? []
  const shown = samples.slice(0, THUMBNAIL_LIMIT)

  return (
    <Card
      component="li"
      sx={{
        listStyle: 'none',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        borderColor: selected ? 'primary.main' : undefined,
        borderWidth: selected ? 2 : undefined,
        opacity: busy ? 0.6 : 1,
        transition: (theme) => theme.transitions.create(['opacity', 'border-color']),
      }}
    >
      <CardContent
        sx={{
          p: { xs: 2, md: 2.5 },
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.75,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="flex-start">
          {compareMode ? (
            <Checkbox
              checked={selected}
              disabled={!selected && selectionFull}
              onChange={() => onToggleCompare?.(proposal.id)}
              inputProps={{ 'aria-label': `Compare the proposal from ${creatorName}` }}
              sx={{ mt: -0.5, ml: -1 }}
            />
          ) : null}

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <CreatorSummary creator={proposal.creator} />
          </Box>

          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
            {decidable ? (
              <Tooltip title={isShortlisted ? 'Remove from shortlist' : 'Add to shortlist'}>
                <IconButton
                  onClick={() => onShortlist?.(proposal)}
                  aria-pressed={isShortlisted}
                  aria-label={
                    isShortlisted
                      ? `Remove ${creatorName} from your shortlist`
                      : `Shortlist ${creatorName}`
                  }
                  disabled={busy}
                  sx={{ width: 44, height: 44, color: isShortlisted ? 'warning.main' : 'text.secondary' }}
                >
                  <Icon icon={isShortlisted ? 'tabler:star-filled' : 'tabler:star'} width={20} />
                </IconButton>
              </Tooltip>
            ) : (
              <StatusChip status={proposal.status} size="sm" tooltip />
            )}
          </Stack>
        </Stack>

        {decidable && isShortlisted ? (
          <Box>
            <StatusChip status={proposal.status} size="sm" tooltip />
          </Box>
        ) : null}

        <Divider />

        {/* Price leads; the terms that qualify it sit beside it. */}
        <Stack direction="row" spacing={2.5} alignItems="flex-end" flexWrap="wrap" useFlexGap>
          <Box>
            <Typography variant="caption" color="text.secondary" component="p">
              Their price
            </Typography>
            <Typography variant="h5" component="p" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {formatCurrency(proposal.price, proposal.currency, { hideDecimals: true })}
            </Typography>
          </Box>
          <Term
            label="Delivery"
            value={
              proposal.deliveryDays
                ? `${formatNumber(proposal.deliveryDays)} ${proposal.deliveryDays === 1 ? 'day' : 'days'}`
                : '—'
            }
          />
          <Term
            label="Revisions"
            value={formatNumber(proposal.revisionsIncluded ?? 0)}
            hint="included"
          />
        </Stack>

        {proposal.coverMessage ? (
          <Box>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={
                expanded
                  ? undefined
                  : {
                      display: '-webkit-box',
                      WebkitLineClamp: MESSAGE_CLAMP,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }
              }
            >
              {proposal.coverMessage}
            </Typography>
            <Button
              size="small"
              variant="text"
              onClick={() => setExpanded((open) => !open)}
              aria-expanded={expanded}
              sx={{ mt: 0.5, ml: -1 }}
            >
              {expanded ? 'Show less' : 'Read more'}
            </Button>
          </Box>
        ) : null}

        {shown.length > 0 ? (
          <Stack
            direction="row"
            spacing={1}
            component="ul"
            aria-label={`Sample work from ${creatorName}`}
            sx={{ listStyle: 'none', m: 0, p: 0, overflowX: 'auto', pb: 0.5 }}
          >
            {shown.map((item, index) => (
              <Box component="li" key={item.id} sx={{ flexShrink: 0 }}>
                <ButtonBase
                  onClick={() => onOpenSample?.(proposal, index)}
                  aria-label={`View sample: ${item.title}`}
                  sx={{
                    width: 72,
                    height: 54,
                    borderRadius: 1.5,
                    overflow: 'hidden',
                    display: 'block',
                    border: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Box
                    component="img"
                    src={item.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </ButtonBase>
              </Box>
            ))}
            {samples.length > shown.length ? (
              <Box
                component="li"
                sx={{
                  flexShrink: 0,
                  width: 72,
                  height: 54,
                  borderRadius: 1.5,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: 'background.default',
                  border: 1,
                  borderColor: 'divider',
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  +{samples.length - shown.length}
                </Typography>
              </Box>
            ) : null}
          </Stack>
        ) : null}

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ mt: 'auto', pt: 0.5 }}
        >
          <Button
            variant="outlined"
            onClick={() => onOpen?.(proposal)}
            fullWidth
            startIcon={<Icon icon="tabler:eye" width={18} aria-hidden="true" />}
          >
            View details
          </Button>
          {decidable ? (
            <>
              <Button
                color="inherit"
                onClick={() => onDecline?.(proposal)}
                disabled={busy}
                fullWidth
                sx={{ flexShrink: 0, width: { sm: 'auto' } }}
              >
                Decline
              </Button>
              <Button
                variant="gradient"
                onClick={() => onAccept?.(proposal)}
                disabled={busy}
                fullWidth
              >
                Accept
              </Button>
            </>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  )
}
