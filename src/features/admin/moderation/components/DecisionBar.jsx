import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import StickyActionBar from '@/components/layout/StickyActionBar'
import { CONTENT_STATUS } from '@/constants/statuses'
import { MODERATION_DECISION } from '@/services/moderationService'
import {
  isOpenCase,
  isRestrictable,
} from '@/features/admin/moderation/utils/moderationQueue'

// The decision bar — Prompt 30 §4.3.
//
// Pinned to the bottom of the review screen on every width, because it is the
// one thing on the page that is always relevant: a reviewer scrolls the
// submission and the context, and the verdict has to be reachable from wherever
// they stop reading.
//
// What it offers is derived from where the case actually is, never from what
// looks tidy — a case nobody has claimed offers exactly one button, because
// working a queue starts with taking something off it. That is the same
// derivation the service guards with (`isOpenCase`, `isRestrictable` read the
// state machine's rules), so the bar can never offer an action the service
// would refuse.
//
// Every button carries its consequence in the accessible name (§12): "Approve"
// on its own is not enough to act on when the label is all you get.

/** The three decisions available on a claimed case, in order of likelihood. */
const OPEN_ACTIONS = [
  {
    decision: MODERATION_DECISION.APPROVE,
    label: 'Approve',
    hint: 'approve and publish this submission',
    icon: 'solar:check-circle-linear',
    variant: 'contained',
    color: 'primary',
  },
  {
    decision: MODERATION_DECISION.REQUEST_CHANGES,
    label: 'Request changes',
    hint: 'send this back to the creator with a note',
    icon: 'solar:pen-new-square-linear',
    variant: 'outlined',
    color: 'warning',
  },
  {
    decision: MODERATION_DECISION.REJECT,
    label: 'Reject',
    hint: 'reject this submission with a policy reason',
    icon: 'solar:close-circle-linear',
    variant: 'outlined',
    color: 'error',
  },
]

/**
 * @param {object} props
 * @param {object} props.review the case being decided
 * @param {boolean} [props.disabled=false] no `moderation.review` permission, or
 *   a decision is already in flight
 * @param {boolean} [props.isWorking=false] a claim or decision is pending
 * @param {() => void} props.onClaim take the case
 * @param {(decision: string) => void} props.onDecide open a decision dialog
 * @param {() => void} props.onBackToQueue leave without deciding
 * @param {number} [props.remaining] how many cases are left after this one
 */
export default function DecisionBar({
  review,
  disabled = false,
  isWorking = false,
  onClaim,
  onDecide,
  onBackToQueue,
  remaining,
}) {
  const open = isOpenCase(review)
  const unclaimed = review?.status === CONTENT_STATUS.SUBMITTED
  const restrictable = isRestrictable(review)

  const status = open
    ? unclaimed
      ? 'Waiting for a reviewer'
      : 'Claimed — decide when you are ready'
    : 'Decision recorded'

  return (
    <StickyActionBar justify="space-between" sx={{ mt: { xs: 2, md: 3 } }}>
      <Box sx={{ minWidth: 0, display: { xs: 'none', sm: 'block' } }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {status}
        </Typography>
        {typeof remaining === 'number' && remaining > 0 ? (
          <Typography variant="caption" color="text.secondary">
            {remaining} more {remaining === 1 ? 'case' : 'cases'} in this queue
          </Typography>
        ) : null}
      </Box>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ width: { xs: '100%', sm: 'auto' } }}
      >
        <Button
          onClick={onBackToQueue}
          disabled={isWorking}
          sx={{ display: { xs: 'none', md: 'inline-flex' } }}
        >
          Back to queue
        </Button>

        {unclaimed ? (
          <Button
            variant="contained"
            fullWidth
            onClick={onClaim}
            disabled={disabled || isWorking}
            aria-label="Claim this case — it moves to under review and is marked as yours"
            startIcon={<Icon icon="tabler:shield-check" width={18} aria-hidden="true" />}
          >
            {isWorking ? 'Claiming…' : 'Claim for review'}
          </Button>
        ) : null}

        {open && !unclaimed
          ? OPEN_ACTIONS.map((action) => (
              <Button
                key={action.decision}
                variant={action.variant}
                color={action.color}
                fullWidth
                onClick={() => onDecide(action.decision)}
                disabled={disabled || isWorking}
                aria-label={`${action.label} — ${action.hint}`}
                startIcon={<Icon icon={action.icon} width={18} aria-hidden="true" />}
              >
                {action.label}
              </Button>
            ))
          : null}

        {restrictable ? (
          <Button
            variant="outlined"
            color="warning"
            fullWidth
            onClick={() => onDecide(MODERATION_DECISION.RESTRICT)}
            disabled={disabled || isWorking}
            aria-label="Restrict — remove this content from public view with a policy reason"
            startIcon={<Icon icon="solar:eye-closed-linear" width={18} aria-hidden="true" />}
          >
            Restrict
          </Button>
        ) : null}

        {!open && !restrictable ? (
          <Button variant="outlined" fullWidth onClick={onBackToQueue} disabled={isWorking}>
            Back to queue
          </Button>
        ) : null}
      </Stack>
    </StickyActionBar>
  )
}
