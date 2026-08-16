import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import StatusChip from '@/components/data-display/StatusChip'
import { isAdminRole, ROLES } from '@/constants/roles'
import { DISPUTE_RESOLUTION, getStatusMeta } from '@/constants/statuses'
import { formatCurrency, formatDate } from '@/utils/formatters'

// The decision, once there is one.
//
// Every dispute ends in exactly one of three outcomes, and this card says which
// one, what it meant in money, why, and when — in that order, because that is
// the order the question is asked in. The reasoning is quoted verbatim from the
// reviewer rather than summarised: a decision a member cannot read the grounds
// for is a decision they cannot accept.
//
// **Rendering only.** Executing an outcome — releasing the escrow, refunding
// the card — is `disputeService.resolveDispute` in Prompt 33. This card renders
// what that operation (and, today, the seeds) recorded.

/**
 * What each outcome meant for the person reading it. The sentence says what
 * happened and the figure below says how much — deliberately not both, since a
 * number stated twice is a number somebody reads twice to check it agrees.
 *
 * Three voices, not two (Prompt 33): the buyer's, the creator's, and — for the
 * admin workspace, which renders this same card — a third-person one. "Released
 * to you" on a reviewer's screen would be plainly wrong, and forking the card
 * to avoid it would leave two descriptions of one decision to keep in step.
 */
function describeOutcome(resolution, role) {
  const isBuyer = role === ROLES.BUYER
  const isTeam = isAdminRole(role)

  switch (resolution?.outcome) {
    case DISPUTE_RESOLUTION.RELEASE_PAYMENT:
      return isTeam
        ? 'The escrow was released to the creator in full, minus the usual commission, and the order was completed.'
        : isBuyer
          ? 'The escrow was released to the creator in full. Nothing was returned to your payment method.'
          : 'The escrow was released to you in full, minus the usual commission.'
    case DISPUTE_RESOLUTION.FULL_REFUND:
      return isTeam
        ? 'The full order amount was returned to the buyer and the order was marked refunded. The creator was paid nothing for it.'
        : isBuyer
          ? 'The full order amount was returned to your payment method. Card refunds usually settle within a few working days.'
          : 'The full order amount was returned to the buyer, so nothing was released for this order.'
    case DISPUTE_RESOLUTION.PARTIAL_REFUND:
      return isTeam
        ? 'Part of the order amount was returned to the buyer, the balance was released to the creator, and the order was completed.'
        : isBuyer
          ? 'Part of the order amount was returned to your payment method and the balance was released to the creator.'
          : 'Part of the order amount was returned to the buyer and the balance was released to you.'
    default:
      return 'The order was settled according to the decision below.'
  }
}

/**
 * @param {object} props
 * @param {object} props.dispute the resolved dispute — read for `resolution`
 * @param {string} props.role the reader's `ROLES` value
 * @param {string} [props.currency='USD'] the order's currency
 */
export default function ResolutionCard({ dispute, role, currency = 'USD' }) {
  const resolution = dispute?.resolution
  if (!resolution?.outcome) return null

  const meta = getStatusMeta(resolution.outcome)
  const amount = Number(resolution.amountRefunded)
  const hasAmount = Number.isFinite(amount) && amount > 0

  return (
    <Card
      component="section"
      aria-labelledby="dispute-resolution-heading"
      sx={{ borderColor: 'success.main', borderWidth: 1, borderStyle: 'solid' }}
    >
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
          sx={{ mb: 1.5 }}
        >
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box aria-hidden="true" sx={{ color: 'success.dark', display: 'flex' }}>
              <Icon icon="solar:shield-check-linear" width={22} />
            </Box>
            <Typography id="dispute-resolution-heading" variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
              Decision
            </Typography>
          </Stack>
          <StatusChip status={resolution.outcome} tooltip label={meta.label} />
        </Stack>

        <Typography variant="body2" color="text.secondary">
          {describeOutcome(resolution, role)}
        </Typography>

        {hasAmount ? (
          <Typography
            variant="h5"
            component="p"
            sx={{ mt: 1.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
          >
            {formatCurrency(amount, currency)}{' '}
            <Typography component="span" variant="body2" color="text.secondary">
              refunded
            </Typography>
          </Typography>
        ) : null}

        {resolution.note ? (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" component="h3" sx={{ mb: 0.75 }}>
              Why we decided this
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
              {resolution.note}
            </Typography>
          </>
        ) : null}

        {resolution.resolvedAt ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            Decided on {formatDate(resolution.resolvedAt)} by the BetterBlue Trust &amp; Safety team.
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  )
}
