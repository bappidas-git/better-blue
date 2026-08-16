import { useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'

import { useConfirm } from '@/components/feedback/ConfirmDialogProvider'
import { ORDER_STATUS } from '@/constants/statuses'
import { formatCurrency } from '@/utils/formatters'

// Admin interventions on an order — Prompt 31 §4.2.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ These are the exception, and the screen says so.                          ║
// ║                                                                          ║
// ║ Almost everything that goes wrong with an engagement should go through    ║
// ║ the dispute flow: it gives both parties a say, it leaves a case record,   ║
// ║ and it ends in a resolution somebody can point at. An admin cancelling    ║
// ║ an order from here does none of that — it simply ends, and the buyer gets ║
// ║ their money back. So the entry point is a kebab rather than a button, the ║
// ║ action is outlined-danger rather than filled, the dialog spells out what  ║
// ║ happens to the money, and a reason is mandatory.                          ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//
// Nothing here talks to a service. It collects an intent and a reason and hands
// both to the page, which calls `orderService.cancelOrder` / `addAdminNote` —
// the workflow functions Prompt 17 and this prompt wrote (§7: no admin
// component patches a status).

/** The states `orderService.cancelOrder` accepts from an admin (Prompt 17). */
const CANCELLABLE = [ORDER_STATUS.IN_PROGRESS, ORDER_STATUS.REVISION_REQUESTED, ORDER_STATUS.DISPUTED]

/** May this order be cancelled from here at all? Mirrors the service exactly. */
function isCancellable(order) {
  return Boolean(order) && CANCELLABLE.includes(order.status)
}

/**
 * The consequence copy for a cancellation, which changes with the money: an
 * order holding escrow is refunded, one that never got funded is not, and
 * saying "the buyer is refunded in full" about the second would be a lie.
 */
function cancelMessage(order, payment) {
  const holdsEscrow = Boolean(payment?.heldAt) && !payment?.refundedAt
  const amount = formatCurrency(payment?.amount ?? order?.price, order?.currency)

  return [
    holdsEscrow
      ? `The ${amount} held in escrow goes back to the buyer's card in full, and the creator is paid nothing for this engagement.`
      : 'No money is held against this order, so nothing is refunded.',
    'The order moves to Cancelled, which is final — it cannot be reopened.',
    'Both the buyer and the creator are notified with the reason you give below.',
  ].join(' ')
}

/**
 * @param {object} props
 * @param {object} props.order the order being worked on
 * @param {object} [props.payment] its payment, for the refund wording
 * @param {boolean} [props.canManage=false] the reader holds `orders.manage`
 * @param {boolean} [props.busy=false] a write is in flight
 * @param {(reason: string) => Promise<*>} props.onCancelOrder
 * @param {(note: string) => Promise<*>} props.onAddNote
 */
export default function InterventionDialogs({
  order,
  payment,
  canManage = false,
  busy = false,
  onCancelOrder,
  onAddNote,
}) {
  const confirm = useConfirm()
  const [anchorEl, setAnchorEl] = useState(null)

  if (!canManage) return null

  const close = () => setAnchorEl(null)
  const cancellable = isCancellable(order)

  const askToCancel = async () => {
    close()
    const result = await confirm({
      title: 'Cancel this order?',
      message: cancelMessage(order, payment),
      confirmLabel: 'Cancel the order',
      cancelLabel: 'Leave it running',
      tone: 'danger',
      requireReason: true,
      reasonLabel: 'Why is BetterBlue ending this order?',
      reasonPlaceholder: 'e.g. Creator unreachable for 21 days; buyer asked us to release the brief.',
      reasonHelperText: 'Sent to both parties and recorded in the audit trail.',
    })
    if (result) await onCancelOrder?.(result.reason)
  }

  const askForNote = async () => {
    close()
    const result = await confirm({
      title: 'Add an internal note',
      message:
        'Notes are for the admin team. Neither the buyer nor the creator can see them, and nobody is notified — ' +
        'anything they need to hear belongs in a dispute or a cancellation.',
      confirmLabel: 'Save note',
      icon: 'solar:notes-linear',
      requireReason: true,
      reasonLabel: 'Note',
      reasonPlaceholder: 'e.g. Spoke to the buyer on 14 Aug; they are happy to wait one more week.',
      reasonHelperText: 'Stored in the audit trail and shown on this order’s timeline, admin-side only.',
    })
    if (result) await onAddNote?.(result.reason)
  }

  return (
    <Stack spacing={1.5}>
      <Alert
        severity="warning"
        variant="outlined"
        icon={<Icon icon="solar:danger-triangle-linear" width={20} aria-hidden="true" />}
      >
        Exceptional action — prefer the dispute resolution flow, which gives both parties a say and
        ends in a decision they can read.
      </Alert>

      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Button
          variant="outlined"
          color="warning"
          disabled={busy}
          aria-haspopup="menu"
          aria-expanded={anchorEl ? 'true' : undefined}
          onClick={(event) => setAnchorEl(event.currentTarget)}
          startIcon={<Icon icon="solar:menu-dots-bold" width={18} aria-hidden="true" />}
        >
          Interventions
        </Button>
      </Stack>

      <Menu
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        MenuListProps={{ 'aria-label': 'Admin interventions on this order' }}
      >
        <MenuItem onClick={askForNote} disabled={busy}>
          <ListItemIcon>
            <Icon icon="solar:notes-linear" width={20} aria-hidden="true" />
          </ListItemIcon>
          <ListItemText
            primary="Add internal note"
            secondary="Admin-only. Nobody is notified."
          />
        </MenuItem>

        <Divider />

        <MenuItem onClick={askToCancel} disabled={busy || !cancellable} sx={{ color: 'error.main' }}>
          <ListItemIcon sx={{ color: 'inherit' }}>
            <Icon icon="solar:close-circle-linear" width={20} aria-hidden="true" />
          </ListItemIcon>
          <ListItemText
            primary="Cancel order"
            secondary={
              cancellable
                ? 'Refunds the escrow and ends the engagement.'
                : 'Only an order that is in progress, in revision, or disputed can be cancelled.'
            }
          />
        </MenuItem>
      </Menu>
    </Stack>
  )
}
