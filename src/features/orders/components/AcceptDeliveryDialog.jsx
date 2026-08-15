import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import ResponsiveDialog from '@/components/layout/ResponsiveDialog'
import { formatCurrency } from '@/utils/formatters'

// The second ask before the most consequential click in the product.
//
// 00 §12 requires a confirmation with "explicit consequence copy" for anything
// irreversible, and this is the definition of one: accepting releases money
// BetterBlue is holding on the buyer's behalf, and there is no un-accept. So the
// dialog names the amount, names who receives it, and says plainly that it
// cannot be undone — rather than asking "Are you sure?" and hoping.
//
// The consequences are a list rather than a paragraph so a screen reader reads
// them as three distinct facts; `ResponsiveDialog` supplies the focus trap,
// Escape, and focus return (00 §13).

/** One consequence of pressing the button. */
function Consequence({ icon, children }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="flex-start" component="li">
      <Box aria-hidden="true" sx={{ mt: 0.25, color: 'text.secondary', flexShrink: 0 }}>
        <Icon icon={icon} width={18} />
      </Box>
      <Typography variant="body2" color="text.secondary">
        {children}
      </Typography>
    </Stack>
  )
}

/**
 * @param {object} props
 * @param {boolean} props.open whether the dialog is shown
 * @param {() => void} props.onClose dismiss handler
 * @param {() => void} props.onConfirm accept handler
 * @param {boolean} [props.isSubmitting] disables the buttons while the chain runs
 * @param {object} props.order the order being accepted
 * @param {{name?: string}} [props.creator] who gets paid
 */
export default function AcceptDeliveryDialog({
  open,
  onClose,
  onConfirm,
  isSubmitting = false,
  order,
  creator,
}) {
  const amount = formatCurrency(order?.price, order?.currency)
  const creatorName = creator?.name ?? 'the creator'

  return (
    <ResponsiveDialog
      open={open}
      onClose={isSubmitting ? undefined : onClose}
      title="Accept this delivery?"
      description={`This releases your payment and closes the order. It cannot be undone.`}
      actions={
        <>
          <Button onClick={onClose} color="inherit" disabled={isSubmitting}>
            Not yet
          </Button>
          <Button
            onClick={onConfirm}
            variant="gradient"
            disabled={isSubmitting}
            startIcon={
              isSubmitting ? null : <Icon icon="tabler:circle-check" width={18} aria-hidden="true" />
            }
          >
            {isSubmitting ? 'Releasing payment…' : 'Accept and release payment'}
          </Button>
        </>
      }
    >
      <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', m: 0, p: 0 }}>
        <Consequence icon="solar:wallet-money-linear">
          <strong>{amount}</strong> leaves escrow and is released to {creatorName}, less the
          BetterBlue commission.
        </Consequence>
        <Consequence icon="solar:verified-check-linear">
          The order moves to completed, and you can leave {creatorName} a review.
        </Consequence>
        <Consequence icon="solar:lock-keyhole-unlocked-linear">
          You can no longer ask for changes on this order.
        </Consequence>
      </Stack>

      <Alert severity="info" icon={<Icon icon="solar:info-circle-linear" width={20} />} sx={{ mt: 2.5 }}>
        Only accept once you have opened every file and they are what you asked for. If something is
        wrong, ask for changes instead — nothing moves while you do.
      </Alert>
    </ResponsiveDialog>
  )
}
