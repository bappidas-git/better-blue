import { useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import { useConfirm } from '@/components/feedback/ConfirmDialogProvider'
import { useToast } from '@/components/feedback/ToastProvider'
import { AUDIT_ACTION } from '@/constants/auditActions'
import { ACCOUNT_STATUS } from '@/constants/statuses'
import { useAuth } from '@/context/AuthContext'
import useApiQuery from '@/hooks/useApiQuery'
import { auditService } from '@/services/auditService'
import { orderService } from '@/services/orderService'
import { userService } from '@/services/userService'
import { formatNumber } from '@/utils/formatters'

// Deactivating an account: the one irreversible thing a creator can do to
// themselves from Settings.
//
// The buyer's twin (`buyerAccount/DangerZoneCard`) lets a buyer leave with work
// outstanding, because the money is already in escrow and the creator is still
// paid. A creator leaving is the other way round: the buyer has paid for a
// delivery nobody is going to make. So this version is **blocked** while any
// order is in flight, and says which orders and what to do about them (§4.6).
//
// It is a **status change, never a deletion** (00 §9) — the account, its
// storefront, its portfolio, and its earnings history all stay where they are.
// Signing back in is blocked by the same status gate that handles suspensions
// (contract §2.3), so support can reverse it.
//
// SECURITY: this guard is UX (00 §11). The Laravel API must run the same check
// before it will accept the status change.

export default function CreatorDangerZoneCard() {
  const { user, logout } = useAuth()
  const confirm = useConfirm()
  const toast = useToast()
  const [isWorking, setWorking] = useState(false)

  const {
    data: activeOrders,
    isLoading,
    error,
  } = useApiQuery(() => orderService.countActiveByCreator(user?.id), [user?.id], {
    enabled: Boolean(user?.id),
  })

  // A count that could not be read is treated as "there might be work" — the
  // safe direction for a guard, and the button explains why it is unavailable.
  const isBlocked = Boolean(error) || (activeOrders ?? 0) > 0

  const handleDeactivate = async () => {
    const result = await confirm({
      title: 'Deactivate your account?',
      message:
        'You will be signed out and will not be able to sign in again. Your storefront disappears from the marketplace, and your portfolio, reviews, and earnings history are kept. Support can reactivate the account for you. Any balance still owed to you is paid out through support.',
      confirmLabel: 'Deactivate account',
      cancelLabel: 'Keep my account',
      tone: 'danger',
      requireReason: true,
      reasonLabel: 'Why are you leaving?',
      reasonHelperText: 'Shared with the BetterBlue team — it is the only way we learn.',
    })

    if (!result) return

    setWorking(true)
    try {
      await userService.update(user.id, { accountStatus: ACCOUNT_STATUS.DEACTIVATED })

      // Best effort: the account is already deactivated, and failing to write
      // the trail must not leave the member signed in to a dead account.
      try {
        await auditService.log({
          actorId: user.id,
          actorRole: user.role,
          action: AUDIT_ACTION.USER_DEACTIVATE,
          entityType: 'user',
          entityId: user.id,
          meta: {
            fromStatus: user.accountStatus,
            toStatus: ACCOUNT_STATUS.DEACTIVATED,
            reason: result.reason,
            selfService: true,
          },
        })
      } catch {
        // Swallowed deliberately — see above.
      }

      toast.success('Your account is deactivated', {
        description: 'Thank you for the work you brought to BetterBlue. Contact support to come back.',
      })
      await logout()
    } catch (failure) {
      toast.error('We could not deactivate your account', { description: failure?.message })
      setWorking(false)
    }
  }

  return (
    <Card sx={{ borderColor: (theme) => alpha(theme.palette.error.main, 0.4) }}>
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.5 }}>
          <Box aria-hidden="true" sx={{ display: 'flex', color: 'error.main' }}>
            <Icon icon="tabler:alert-triangle" width={20} />
          </Box>
          <Typography
            variant="h6"
            component="h2"
            sx={{ fontSize: '1.0625rem', color: 'error.main' }}
          >
            Danger zone
          </Typography>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: '62ch' }}>
          Deactivating closes your access to BetterBlue and removes your storefront from the
          marketplace. Nothing is deleted — your portfolio, reviews, and earnings history are kept,
          and support can bring the account back if you change your mind.
        </Typography>

        {isLoading ? (
          <Skeleton
            variant="rounded"
            role="status"
            aria-busy="true"
            aria-label="Checking for orders in flight"
            sx={{ height: 72, mb: 3 }}
          />
        ) : isBlocked ? (
          <Alert severity="warning" sx={{ mb: 3 }}>
            <AlertTitle sx={{ typography: 'subtitle2' }}>
              Complete or resolve active orders first
            </AlertTitle>
            {error
              ? 'We could not check whether you have orders in flight, so deactivation is unavailable for now. Try again in a moment.'
              : `You have ${formatNumber(activeOrders)} order${
                  activeOrders === 1 ? '' : 's'
                } still in flight. Buyers have already paid into escrow for ${
                  activeOrders === 1 ? 'it' : 'them'
                }, so deliver or cancel ${
                  activeOrders === 1 ? 'it' : 'them'
                } before you close the account. Contact support if you cannot finish the work.`}
          </Alert>
        ) : null}

        <Button
          variant="outlined"
          color="error"
          onClick={handleDeactivate}
          disabled={isWorking || isLoading || isBlocked}
          startIcon={isWorking ? null : <Icon icon="tabler:user-off" width={18} aria-hidden="true" />}
        >
          {isWorking ? 'Deactivating…' : 'Deactivate account'}
        </Button>
      </CardContent>
    </Card>
  )
}
