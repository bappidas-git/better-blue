import { useCallback, useState } from 'react'

import { Icon } from '@iconify/react'
import IconButton from '@mui/material/IconButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'
import { useNavigate } from 'react-router-dom'

import { useToast } from '@/components/feedback/ToastProvider'
import { useAuth } from '@/context/AuthContext'
import RaiseDisputeDialog from '@/features/disputes/components/RaiseDisputeDialog'
import { disputeRoutesFor } from '@/features/disputes/utils/disputeDisplay'
import useFeatureFlag from '@/hooks/useFeatureFlag'
import { API_ERROR_CODE } from '@/services/api/apiError'
import { DISPUTABLE_ORDER_STATUSES, disputeService } from '@/services/disputeService'

// "Report an issue" — the order workspace's way into a dispute, on both sides
// of an order.
//
// This is the whole entry point in one component: the overflow menu, the form,
// the service call, and the trip to the new case. Both order detail pages
// render it and neither one knows anything about disputes beyond that (00
// §16.4) — which is also what keeps the eligibility rule in one place.
//
// **The action is hidden, not disabled, on an ineligible order** (§13). A
// pending, cancelled, or completed order has no issue to report *here*: there
// is nothing to freeze, or nothing left to decide. `createDispute` refuses it
// again regardless (00 §11).
//
// Prompt 35 put the same entry point behind `features.disputes`. This component
// is the *only* way into a new case from either side of an order, so gating it
// here is the whole switch: with the flag off nobody can open one, and cases
// already running are untouched and still workable in the console. Hidden while
// the flag is still resolving, for the same reason it is hidden on an
// ineligible order — an action that appears and then vanishes is worse than one
// that arrives a beat late.

/**
 * @param {object} props
 * @param {object} props.order the order this would be raised on
 * @param {() => void} [props.onOpened] called after a dispute is created, so the
 *   page behind it can redraw around the frozen order
 */
export default function RaiseDisputeAction({ order, onOpened }) {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const { isEnabled: disputesEnabled } = useFeatureFlag('disputes')

  const [anchorEl, setAnchorEl] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const isEligible = DISPUTABLE_ORDER_STATUSES.includes(order?.status)

  const submit = useCallback(
    async ({ category, description, evidenceFiles }) => {
      try {
        const { dispute } = await disputeService.createDispute(order.id, {
          raisedById: user?.id,
          category,
          description,
          evidenceFiles,
        })

        toast.success('Dispute opened', {
          description: 'The order is on hold and our team has been notified.',
        })
        setDialogOpen(false)
        onOpened?.()
        navigate(disputeRoutesFor(user?.role).detail(dispute.id))
      } catch (failure) {
        if (failure?.code === API_ERROR_CODE.CONFLICT) {
          toast.error(failure.message, {
            description: 'This page was showing an older version of the order. It has been refreshed.',
          })
          onOpened?.()
        } else {
          toast.error(failure?.message ?? 'We could not open this dispute.')
        }
        // Rethrown so the dialog stays open with everything typed still in it.
        throw failure
      }
    },
    [navigate, onOpened, order?.id, toast, user?.id, user?.role]
  )

  if (!isEligible || !disputesEnabled) return null

  return (
    <>
      <Tooltip title="More actions">
        <IconButton
          onClick={(event) => setAnchorEl(event.currentTarget)}
          aria-label="More actions for this order"
          aria-haspopup="menu"
          sx={{ width: 44, height: 44 }}
        >
          <Icon icon="solar:menu-dots-bold" width={20} />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          onClick={() => {
            setAnchorEl(null)
            setDialogOpen(true)
          }}
          sx={{ minHeight: 44 }}
        >
          <ListItemIcon>
            <Icon icon="solar:shield-warning-linear" width={20} />
          </ListItemIcon>
          <ListItemText
            primary="Report an issue"
            secondary="Ask our team to review this order"
            secondaryTypographyProps={{ variant: 'caption' }}
          />
        </MenuItem>
      </Menu>

      <RaiseDisputeDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={submit}
        order={order}
      />
    </>
  )
}
