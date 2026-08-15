import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import KeyValueList from '@/components/data-display/KeyValueList'
import ResponsiveDialog from '@/components/layout/ResponsiveDialog'
import { CreatorSummary } from '@/features/proposals/components/ProposalCard'
import { formatCurrency, formatNumber } from '@/utils/formatters'

// The last screen before an award. Accepting is the biggest decision on the
// buyer's side of the marketplace — it ends every other proposal on the brief
// and commits money — so this dialog states all of it plainly before the button
// (00 §12: explicit consequence copy on irreversible actions).

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {object|null} props.proposal the offer being accepted
 * @param {number} [props.otherLiveProposals] how many other offers get declined
 * @param {() => void} props.onConfirm
 * @param {() => void} props.onClose
 * @param {boolean} [props.isSubmitting]
 */
export default function AcceptConfirmDialog({
  open,
  proposal,
  otherLiveProposals = 0,
  onConfirm,
  onClose,
  isSubmitting = false,
}) {
  const price = formatCurrency(proposal?.price, proposal?.currency, { hideDecimals: true })
  const creatorName = proposal?.creator?.name ?? 'this creator'

  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title={`Accept ${creatorName}’s proposal?`}
      description="This awards the request and opens an order for you to fund."
      maxWidth="sm"
      actions={
        <>
          <Button color="inherit" onClick={onClose} disabled={isSubmitting}>
            Not yet
          </Button>
          <Button variant="gradient" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Awarding…' : 'Accept and continue to payment'}
          </Button>
        </>
      }
    >
      <Stack spacing={2.5}>
        {proposal ? <CreatorSummary creator={proposal.creator} showLink={false} /> : null}

        <KeyValueList
          labelWidth={170}
          items={[
            {
              label: 'Price',
              value: (
                <Typography variant="h6" component="p" sx={{ fontWeight: 700 }}>
                  {price}
                </Typography>
              ),
            },
            {
              label: 'Delivery',
              value: proposal?.deliveryDays
                ? `${formatNumber(proposal.deliveryDays)} days from the moment you fund it`
                : 'As agreed',
            },
            {
              label: 'Revisions included',
              value: formatNumber(proposal?.revisionsIncluded ?? 0),
            },
          ]}
        />

        {/* The escrow promise, in the buyer's own terms. */}
        <Alert
          severity="info"
          icon={<Icon icon="solar:shield-check-linear" width={22} />}
          sx={{ alignItems: 'flex-start' }}
        >
          <Typography variant="body2">
            You will fund <strong>{price}</strong> now. BetterBlue holds it in escrow and releases
            it to {creatorName} only once you have approved the final content.
          </Typography>
        </Alert>

        {otherLiveProposals > 0 ? (
          <Box>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Icon icon="tabler:alert-triangle" width={20} aria-hidden="true" />
              <Typography variant="body2" color="text.secondary">
                {formatNumber(otherLiveProposals)} other{' '}
                {otherLiveProposals === 1 ? 'proposal' : 'proposals'} on this request will be
                declined automatically, and{' '}
                {otherLiveProposals === 1 ? 'that creator' : 'those creators'} will be told. This
                cannot be undone.
              </Typography>
            </Stack>
          </Box>
        ) : null}
      </Stack>
    </ResponsiveDialog>
  )
}
