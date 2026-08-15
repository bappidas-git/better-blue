import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import KeyValueList from '@/components/data-display/KeyValueList'
import StatusChip from '@/components/data-display/StatusChip'
import SideSheet from '@/components/layout/SideSheet'
import { PROPOSAL_STATUS } from '@/constants/statuses'
import { isLiveProposal } from '@/features/proposals/utils/proposalDisplay'
import { CreatorSummary } from '@/features/proposals/components/ProposalCard'
import { EMPTY_PLACEHOLDER, formatCurrency, formatDate, formatNumber } from '@/utils/formatters'

// The whole of one offer, without leaving the proposals tab: the full cover
// message, every sample, and the creator's numbers side by side.
//
// A sheet rather than a page because comparing is the job — closing this puts
// the buyer straight back in the list they were reading (00 §12).

/** `4 hours` / `2 days` — a response time a buyer can feel. */
function formatResponseTime(hours) {
  const value = Number(hours)
  if (!Number.isFinite(value) || value <= 0) return EMPTY_PLACEHOLDER
  if (value < 24) return `${formatNumber(value)} ${value === 1 ? 'hour' : 'hours'}`
  const days = Math.round(value / 24)
  return `${formatNumber(days)} ${days === 1 ? 'day' : 'days'}`
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {object|null} props.proposal the enriched offer being read
 * @param {boolean} [props.canDecide] the brief is open, so accept/decline apply
 * @param {() => void} props.onClose
 * @param {(proposal: object) => void} props.onShortlist
 * @param {(proposal: object) => void} props.onDecline
 * @param {(proposal: object) => void} props.onAccept
 * @param {(proposal: object, index: number) => void} props.onOpenSample
 * @param {boolean} [props.busy]
 */
export default function ProposalDetailSheet({
  open,
  proposal,
  canDecide = false,
  onClose,
  onShortlist,
  onDecline,
  onAccept,
  onOpenSample,
  busy = false,
}) {
  const creator = proposal?.creator
  const samples = proposal?.samples ?? []
  const decidable = canDecide && isLiveProposal(proposal)
  const isShortlisted = proposal?.status === PROPOSAL_STATUS.SHORTLISTED

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title="Proposal details"
      description={creator?.name ? `From ${creator.name}` : undefined}
      width={480}
      actions={
        decidable ? (
          <>
            <Button color="inherit" onClick={() => onDecline?.(proposal)} disabled={busy}>
              Decline
            </Button>
            <Button variant="gradient" onClick={() => onAccept?.(proposal)} disabled={busy}>
              Accept proposal
            </Button>
          </>
        ) : (
          <Button color="inherit" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      {proposal ? (
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <StatusChip status={proposal.status} size="sm" tooltip />
            {decidable ? (
              <Button
                size="small"
                variant="outlined"
                onClick={() => onShortlist?.(proposal)}
                disabled={busy}
                startIcon={
                  <Icon
                    icon={isShortlisted ? 'tabler:star-filled' : 'tabler:star'}
                    width={16}
                    aria-hidden="true"
                  />
                }
              >
                {isShortlisted ? 'Shortlisted' : 'Shortlist'}
              </Button>
            ) : null}
          </Stack>

          <Box>
            <Typography variant="overline" component="h3" color="text.secondary">
              The offer
            </Typography>
            <KeyValueList
              labelWidth={150}
              sx={{ mt: 1 }}
              items={[
                {
                  label: 'Price',
                  value: (
                    <Typography variant="h6" component="p" sx={{ fontWeight: 700 }}>
                      {formatCurrency(proposal.price, proposal.currency, { hideDecimals: true })}
                    </Typography>
                  ),
                },
                {
                  label: 'Delivery',
                  value: proposal.deliveryDays
                    ? `${formatNumber(proposal.deliveryDays)} days from funding`
                    : EMPTY_PLACEHOLDER,
                },
                {
                  label: 'Revisions included',
                  value: formatNumber(proposal.revisionsIncluded ?? 0),
                },
                { label: 'Sent', value: formatDate(proposal.createdAt) },
              ]}
            />
          </Box>

          <Divider />

          <Box>
            <Typography variant="overline" component="h3" color="text.secondary">
              Their message
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-line' }}>
              {proposal.coverMessage || 'This creator did not add a message.'}
            </Typography>
          </Box>

          {samples.length > 0 ? (
            <>
              <Divider />
              <Box>
                <Typography variant="overline" component="h3" color="text.secondary">
                  Sample work ({formatNumber(samples.length)})
                </Typography>
                <Box
                  component="ul"
                  sx={{
                    listStyle: 'none',
                    m: 0,
                    mt: 1,
                    p: 0,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                    gap: 1,
                  }}
                >
                  {samples.map((item, index) => (
                    <Box component="li" key={item.id}>
                      <ButtonBase
                        onClick={() => onOpenSample?.(proposal, index)}
                        aria-label={`View sample: ${item.title}`}
                        sx={{
                          width: '100%',
                          aspectRatio: '4 / 3',
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
                </Box>
              </Box>
            </>
          ) : null}

          <Divider />

          <Box>
            <Typography variant="overline" component="h3" color="text.secondary">
              About the creator
            </Typography>
            <Box sx={{ mt: 1.5 }}>
              <CreatorSummary creator={creator} />
            </Box>
            {creator?.tagline ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                {creator.tagline}
              </Typography>
            ) : null}
            <KeyValueList
              dense
              labelWidth={150}
              sx={{ mt: 2 }}
              items={[
                { label: 'Completed orders', value: formatNumber(creator?.completedOrders ?? 0) },
                {
                  label: 'Typical response',
                  value: formatResponseTime(creator?.responseTimeHours),
                },
                { label: 'Based in', value: creator?.location ?? EMPTY_PLACEHOLDER },
              ]}
            />
          </Box>
        </Stack>
      ) : null}
    </SideSheet>
  )
}
