import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'

import { describeDisputeState } from '@/features/disputes/utils/disputeDisplay'

// The one line at the top of a dispute that answers "so where is this?" before
// anyone reads the thread.
//
// `role="status"` (§12): the banner is the first thing to change when a reply
// clears the ball, and a screen-reader user must hear that without hunting for
// it.
//
// The tone is deliberately flat (§6). A dispute is a process, not an emergency:
// the only banner that raises its voice at all is the one asking this member
// for something, and even that one is `warning`, never `error`. Nothing here
// says who is at fault, because at this point nobody has decided that.

/**
 * @param {object} props
 * @param {object} props.dispute the dispute record
 * @param {string} props.role the reader's `ROLES` value
 */
export default function DisputeStatusBanner({ dispute, role }) {
  const state = describeDisputeState(dispute, role)
  if (!state.title) return null

  return (
    <Alert
      role="status"
      severity={state.severity}
      icon={<Icon icon={state.icon} width={22} />}
      sx={{ alignItems: 'center' }}
    >
      <AlertTitle sx={{ mb: 0.25 }}>{state.title}</AlertTitle>
      {state.text}
    </Alert>
  )
}
