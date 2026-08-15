import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Button from '@mui/material/Button'
import { Link as RouterLink } from 'react-router-dom'

import { ORDER_STATUS } from '@/constants/statuses'
import { describeAutoAccept, describeDue } from '@/features/orders/utils/orderDisplay'
import { paths } from '@/routes/paths'

// The one line at the top of the order workspace that answers "so where is
// this?" before anyone reads anything else.
//
// `role="status"` (§12): the banner is the first thing to change after a buyer
// accepts a delivery or asks for changes, and a screen-reader user must hear
// that without hunting for it.

/**
 * `{ severity, title, body }` per status. The copy is written from the buyer's
 * chair — what happened, and what (if anything) is theirs to do.
 */
function describe(order, autoAccept) {
  const due = describeDue(order)

  switch (order?.status) {
    case ORDER_STATUS.PENDING_PAYMENT:
      return {
        severity: 'warning',
        icon: 'solar:wallet-money-linear',
        title: 'Waiting for payment',
        body: 'The creator cannot start until the escrow is funded. Nothing has been charged yet.',
      }
    case ORDER_STATUS.IN_PROGRESS:
      return {
        severity: 'info',
        icon: 'solar:clock-circle-linear',
        title: due.isOverdue ? 'Delivery is overdue' : 'In progress',
        body: due.isOverdue
          ? `This was due ${due.relative}, on ${due.date}. Your payment is still held in escrow.`
          : `The creator is working on this. Delivery is due ${due.relative}, on ${due.date}.`,
      }
    case ORDER_STATUS.DELIVERED:
      return {
        severity: 'success',
        icon: 'solar:box-linear',
        title: 'Delivered — ready for your review',
        body: autoAccept
          ? `Look through the files below, then accept the work or ask for changes. If you do neither, it accepts automatically on ${autoAccept.date}.`
          : 'Look through the files below, then accept the work or ask for changes.',
      }
    case ORDER_STATUS.REVISION_REQUESTED:
      return {
        severity: 'info',
        icon: 'solar:restart-linear',
        title: 'Changes requested',
        body: 'The creator is working on the changes you asked for. Your payment stays in escrow until you accept.',
      }
    case ORDER_STATUS.COMPLETED:
      return {
        severity: 'success',
        icon: 'solar:verified-check-linear',
        title: 'Completed',
        body: 'You accepted the delivery and the escrow was released to the creator. The files stay here for your records.',
      }
    case ORDER_STATUS.DISPUTED:
      return {
        severity: 'warning',
        icon: 'solar:danger-triangle-linear',
        title: 'Under review by BetterBlue',
        body: 'A dispute is open on this order. Your payment is held until our team reaches a decision.',
      }
    case ORDER_STATUS.CANCELLED:
      return {
        severity: 'info',
        icon: 'solar:close-circle-linear',
        title: 'Cancelled',
        body: 'This engagement was called off. Nothing further is owed on either side.',
      }
    case ORDER_STATUS.REFUNDED:
      return {
        severity: 'info',
        icon: 'solar:card-recive-linear',
        title: 'Refunded',
        body: 'The escrow was returned to the card it came from. Card refunds usually settle within a few working days.',
      }
    default:
      return null
  }
}

/**
 * @param {object} props
 * @param {object} props.order the order record
 * @param {number} [props.autoAcceptDays] `platformSettings.general.autoAcceptDays`
 */
export default function OrderStateBanner({ order, autoAcceptDays }) {
  const autoAccept = describeAutoAccept(order, autoAcceptDays)
  const state = describe(order, autoAccept)
  if (!state) return null

  return (
    <Alert
      role="status"
      severity={state.severity}
      icon={<Icon icon={state.icon} width={22} />}
      action={
        order.status === ORDER_STATUS.PENDING_PAYMENT ? (
          <Button
            component={RouterLink}
            to={paths.buyerCheckout(order.id)}
            size="small"
            variant="contained"
            color="warning"
            sx={{ whiteSpace: 'nowrap', minHeight: 44 }}
          >
            Complete payment
          </Button>
        ) : undefined
      }
      sx={{ alignItems: 'center' }}
    >
      <AlertTitle sx={{ mb: 0.25 }}>{state.title}</AlertTitle>
      {state.body}
    </Alert>
  )
}
