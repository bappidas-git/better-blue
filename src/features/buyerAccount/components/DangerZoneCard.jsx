import { useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import { useConfirm } from '@/components/feedback/ConfirmDialogProvider'
import { useToast } from '@/components/feedback/ToastProvider'
import { ACCOUNT_STATUS } from '@/constants/statuses'
import { useAuth } from '@/context/AuthContext'
import { auditService } from '@/services/auditService'
import { userService } from '@/services/userService'

// Deactivating an account: the one irreversible thing a buyer can do to
// themselves from Settings.
//
// It is a **status change, never a deletion** (00 §9) — the account, its
// briefs, its orders, and its payment history all stay exactly where they are,
// which is what the confirmation copy promises. Signing back in is blocked by
// the same status gate that handles suspensions (contract §2.3), so support can
// reverse it.
//
// The action writes an audit entry with the member as their own actor. Buyer
// activity is not normally audited (contract §6.26), but an account leaving the
// platform is exactly the kind of event support needs a record of.

/** Audit verb for a member deactivating their own account (contract §6.26). */
const AUDIT_ACTION = 'user.deactivate'

export default function DangerZoneCard() {
  const { user, logout } = useAuth()
  const confirm = useConfirm()
  const toast = useToast()
  const [isWorking, setWorking] = useState(false)

  const handleDeactivate = async () => {
    const result = await confirm({
      title: 'Deactivate your account?',
      message:
        'You will be signed out and will not be able to sign in again. Your briefs, orders, and payment history are kept, and support can reactivate the account for you. Any order still in progress carries on — talk to us first if that is a problem.',
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
          action: AUDIT_ACTION,
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
    <Card
      sx={{
        borderColor: (theme) => alpha(theme.palette.error.main, 0.4),
      }}
    >
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.5 }}>
          <Box aria-hidden="true" sx={{ display: 'flex', color: 'error.main' }}>
            <Icon icon="tabler:alert-triangle" width={20} />
          </Box>
          <Typography variant="h6" component="h2" sx={{ fontSize: '1.0625rem', color: 'error.main' }}>
            Danger zone
          </Typography>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: '62ch' }}>
          Deactivating closes your access to BetterBlue. Nothing is deleted — your briefs, orders,
          and receipts are kept, and support can bring the account back if you change your mind.
        </Typography>

        <Button
          variant="outlined"
          color="error"
          onClick={handleDeactivate}
          disabled={isWorking}
          startIcon={
            isWorking ? null : <Icon icon="tabler:user-off" width={18} aria-hidden="true" />
          }
        >
          {isWorking ? 'Deactivating…' : 'Deactivate account'}
        </Button>
      </CardContent>
    </Card>
  )
}
