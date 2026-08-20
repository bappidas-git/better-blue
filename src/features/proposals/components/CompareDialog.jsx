import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import RatingStars from '@/components/data-display/RatingStars'
import UserAvatar from '@/components/data-display/UserAvatar'
import ResponsiveDialog from '@/components/layout/ResponsiveDialog'
import { PROPOSAL_STATUS } from '@/constants/statuses'
import { bestOf, isLiveProposal } from '@/features/proposals/utils/proposalDisplay'
import { EMPTY_PLACEHOLDER, formatCurrency, formatNumber, truncate } from '@/utils/formatters'

// Two or three offers, the same facts, the same order — the view that makes a
// decision obvious rather than a matter of scrolling back and forth.
//
// The layout is one CSS grid with a fixed label column and one column per
// offer, so every row lines up by construction. Below md the label column is
// dropped and the offer columns become a snap-scrolling row (§11), each one
// repeating its own labels — a table you swipe rather than a table you squint at.

/** Minimum column width on a phone, so two columns are never both half-legible. */
const COLUMN_MIN = 280

/** Characters of the cover message shown in a column. */
const MESSAGE_EXCERPT = 220

/** Sample thumbnails per column. */
const THUMBNAILS = 3

/** `4 hours` / `2 days`, matching the detail sheet. */
function formatResponseTime(hours) {
  const value = Number(hours)
  if (!Number.isFinite(value) || value <= 0) return EMPTY_PLACEHOLDER
  if (value < 24) return `${formatNumber(value)} ${value === 1 ? 'hour' : 'hours'}`
  const days = Math.round(value / 24)
  return `${formatNumber(days)} ${days === 1 ? 'day' : 'days'}`
}

/**
 * The rows of the comparison, top to bottom. `best` marks the cell that wins —
 * a quiet tint and a "Best" pill rather than a colour-only signal, so the
 * highlight survives both a monochrome screen and a screen reader (§12).
 */
function buildRows(proposals, best) {
  return [
    {
      key: 'price',
      label: 'Price',
      emphasis: true,
      render: (proposal) =>
        formatCurrency(proposal.price, proposal.currency, { hideDecimals: true }),
      isBest: (proposal) =>
        best.price !== null && Number(proposal.price) === best.price && isLiveProposal(proposal),
      bestLabel: 'Lowest price',
    },
    {
      key: 'delivery',
      label: 'Delivery',
      render: (proposal) =>
        proposal.deliveryDays
          ? `${formatNumber(proposal.deliveryDays)} ${proposal.deliveryDays === 1 ? 'day' : 'days'}`
          : EMPTY_PLACEHOLDER,
      isBest: (proposal) =>
        best.deliveryDays !== null &&
        Number(proposal.deliveryDays) === best.deliveryDays &&
        isLiveProposal(proposal),
      bestLabel: 'Fastest',
    },
    {
      key: 'revisions',
      label: 'Revisions included',
      render: (proposal) => formatNumber(proposal.revisionsIncluded ?? 0),
    },
    {
      key: 'rating',
      label: 'Rating',
      render: (proposal) =>
        proposal.creator?.ratingCount > 0 ? (
          <RatingStars
            value={proposal.creator.ratingAvg}
            count={proposal.creator.ratingCount}
            size="sm"
          />
        ) : (
          'No reviews yet'
        ),
    },
    {
      key: 'orders',
      label: 'Completed orders',
      render: (proposal) => formatNumber(proposal.creator?.completedOrders ?? 0),
    },
    {
      key: 'response',
      label: 'Typical response',
      render: (proposal) => formatResponseTime(proposal.creator?.responseTimeHours),
    },
    {
      key: 'samples',
      label: 'Sample work',
      render: (proposal) => {
        const samples = (proposal.samples ?? []).slice(0, THUMBNAILS)
        if (samples.length === 0) return 'None attached'
        return (
          <Stack direction="row" spacing={0.75}>
            {samples.map((item) => (
              <Box
                key={item.id}
                component="img"
                src={item.thumbnailUrl}
                alt={item.title}
                loading="lazy"
                sx={{
                  width: 56,
                  height: 42,
                  objectFit: 'cover',
                  borderRadius: 1,
                  border: 1,
                  borderColor: 'divider',
                }}
              />
            ))}
          </Stack>
        )
      },
    },
    {
      key: 'message',
      label: 'Their message',
      render: (proposal) => (
        <Typography variant="body2" color="text.secondary">
          {proposal.coverMessage
            ? truncate(proposal.coverMessage, MESSAGE_EXCERPT)
            : 'No message added.'}
        </Typography>
      ),
    },
  ]
}

/** One value cell, with the "best" treatment when it has earned it. */
function Cell({ row, proposal }) {
  const best = row.isBest?.(proposal) ?? false
  const value = row.render(proposal)

  return (
    <Box
      sx={{
        py: 1.25,
        px: best ? 1.25 : 0,
        mx: best ? -1.25 : 0,
        borderRadius: 1.5,
        bgcolor: best ? (theme) => alpha(theme.palette.success.main, 0.08) : undefined,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        {typeof value === 'string' ? (
          <Typography
            variant={row.emphasis ? 'h6' : 'body2'}
            component="p"
            sx={{ fontWeight: row.emphasis ? 700 : 500 }}
          >
            {value}
          </Typography>
        ) : (
          value
        )}
        {best ? (
          <Typography
            variant="caption"
            sx={{
              px: 1,
              py: 0.25,
              borderRadius: 999,
              bgcolor: 'success.main',
              color: 'success.contrastText',
              fontWeight: 600,
            }}
          >
            {row.bestLabel}
          </Typography>
        ) : null}
      </Stack>
    </Box>
  )
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {object[]} props.proposals the two or three offers being compared
 * @param {boolean} [props.canDecide] the brief is open, so the column actions apply
 * @param {() => void} props.onClose
 * @param {(proposal: object) => void} props.onShortlist
 * @param {(proposal: object) => void} props.onAccept
 * @param {boolean} [props.busy]
 */
export default function CompareDialog({
  open,
  proposals = [],
  canDecide = false,
  onClose,
  onShortlist,
  onAccept,
  busy = false,
}) {
  const best = bestOf(proposals)
  const rows = buildRows(proposals, best)
  const columns = `repeat(${proposals.length}, minmax(${COLUMN_MIN}px, 1fr))`

  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title={`Comparing ${formatNumber(proposals.length)} proposals`}
      description="The same facts, side by side. Accept from any column."
      maxWidth="lg"
      actions={
        <Button color="inherit" onClick={onClose}>
          Close
        </Button>
      }
    >
      <Box
        sx={{
          // Below md the label column is dropped and the columns snap-scroll;
          // from md up the labels take a fixed first column and nothing scrolls.
          overflowX: 'auto',
          scrollSnapType: { xs: 'x mandatory', md: 'none' },
          mx: { xs: -1, md: 0 },
          px: { xs: 1, md: 0 },
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: columns, md: `minmax(160px, 200px) ${columns}` },
            columnGap: { xs: 2, md: 3 },
            minWidth: 'min-content',
          }}
        >
          {/* Header row — the label column's own header is empty on desktop. */}
          <Box sx={{ display: { xs: 'none', md: 'block' } }} />
          {proposals.map((proposal) => (
            <Box
              key={proposal.id}
              sx={{
                scrollSnapAlign: { xs: 'start', md: 'none' },
                pb: 1.5,
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
                <UserAvatar name={proposal.creator?.name} src={proposal.creator?.avatarUrl} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" component="h3" sx={{ fontWeight: 600 }} noWrap>
                    {proposal.creator?.name ?? 'Creator'}
                  </Typography>
                  {proposal.status === PROPOSAL_STATUS.SHORTLISTED ? (
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'warning.main' }}>
                      <Icon icon="tabler:star-filled" width={13} aria-hidden="true" />
                      <Typography variant="caption">Shortlisted</Typography>
                    </Stack>
                  ) : null}
                </Box>
              </Stack>
            </Box>
          ))}

          {rows.map((row) => (
            <Box key={row.key} sx={{ display: 'contents' }}>
              <Box
                sx={{
                  display: { xs: 'none', md: 'flex' },
                  alignItems: 'center',
                  py: 1.25,
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {row.label}
                </Typography>
              </Box>

              {proposals.map((proposal) => (
                <Box
                  key={`${row.key}-${proposal.id}`}
                  sx={{
                    scrollSnapAlign: { xs: 'start', md: 'none' },
                    borderBottom: 1,
                    borderColor: 'divider',
                  }}
                >
                  {/* The label rides with the value on a phone, where the
                      label column has been dropped. */}
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    component="p"
                    sx={{ display: { xs: 'block', md: 'none' }, pt: 1.25 }}
                  >
                    {row.label}
                  </Typography>
                  <Cell row={row} proposal={proposal} />
                </Box>
              ))}
            </Box>
          ))}

          {/* Action row */}
          <Box sx={{ display: { xs: 'none', md: 'block' } }} />
          {proposals.map((proposal) => (
            <Stack
              key={`actions-${proposal.id}`}
              spacing={1}
              sx={{ pt: 2, scrollSnapAlign: { xs: 'start', md: 'none' } }}
            >
              {canDecide && isLiveProposal(proposal) ? (
                <>
                  <Button
                    variant="gradient"
                    onClick={() => onAccept?.(proposal)}
                    disabled={busy}
                    fullWidth
                  >
                    Accept {proposal.creator?.name?.split(' ')[0] ?? 'this'}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => onShortlist?.(proposal)}
                    disabled={busy}
                    fullWidth
                    startIcon={
                      <Icon
                        icon={
                          proposal.status === PROPOSAL_STATUS.SHORTLISTED
                            ? 'tabler:star-filled'
                            : 'tabler:star'
                        }
                        width={16}
                        aria-hidden="true"
                      />
                    }
                  >
                    {proposal.status === PROPOSAL_STATUS.SHORTLISTED ? 'Shortlisted' : 'Shortlist'}
                  </Button>
                </>
              ) : (
                <Tooltip title="This proposal is no longer available to accept">
                  <span>
                    <Button variant="outlined" disabled fullWidth>
                      Unavailable
                    </Button>
                  </span>
                </Tooltip>
              )}
            </Stack>
          ))}
        </Box>
      </Box>
    </ResponsiveDialog>
  )
}
