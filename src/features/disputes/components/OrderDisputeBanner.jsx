import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Button from '@mui/material/Button'
import { Link as RouterLink } from 'react-router-dom'

import { ORDER_STATUS } from '@/constants/statuses'
import { disputeRoutesFor } from '@/features/disputes/utils/disputeDisplay'

// The line on an order workspace that says why nothing on it can be done.
//
// It appears on both sides of a disputed order and says the same thing to both,
// because the two people are in the same situation: the order is paused, the
// money has not moved, and the next step belongs to somebody else. The one way
// out of it is the link to the case, which is the only place either of them can
// actually do anything.
//
// `role="status"` (§12) for the same reason `OrderStateBanner` has it: this is
// the first thing to change when an order freezes.

/**
 * @param {object} props
 * @param {object} props.order the order record
 * @param {object|null} [props.dispute] the case on it, once it has loaded
 * @param {string} props.role the reader's `ROLES` value
 */
export default function OrderDisputeBanner({ order, dispute, role }) {
  if (order?.status !== ORDER_STATUS.DISPUTED) return null

  const routes = disputeRoutesFor(role)

  return (
    <Alert
      role="status"
      severity="warning"
      icon={<Icon icon="solar:shield-warning-linear" width={22} />}
      action={
        dispute ? (
          <Button
            component={RouterLink}
            to={routes.detail(dispute.id)}
            size="small"
            variant="contained"
            color="warning"
            sx={{ whiteSpace: 'nowrap', minHeight: 44 }}
          >
            View dispute
          </Button>
        ) : undefined
      }
      sx={{ alignItems: 'center' }}
    >
      <AlertTitle sx={{ mb: 0.25 }}>This order is under dispute</AlertTitle>
      Nothing can be delivered, accepted, or cancelled while our team reviews it, and the payment
      stays held exactly where it is.
    </Alert>
  )
}
