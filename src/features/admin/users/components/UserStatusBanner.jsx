import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

import { ACCOUNT_STATUS, STATUS_META } from '@/constants/statuses'
import { formatDateTime } from '@/utils/formatters'

// Why this account is restricted, said once at the top of the detail page —
// Prompt 29 §4.3.
//
// Prominent but professional (§6): this is a colleague's decision being handed
// to the next admin who opens the account, not an alarm. The three facts that
// matter are what was done, why, and by whom — an admin looking at a suspended
// account is nearly always about to decide whether to lift it, and those are
// the inputs to that decision.
//
// Status is never colour-only (§12): the severity is carried by an icon and by
// the heading text as well as the tint.

/** Severity and icon per restricted status. `active` renders nothing at all. */
const BANNER = Object.freeze({
  [ACCOUNT_STATUS.SUSPENDED]: Object.freeze({
    severity: 'warning',
    icon: 'solar:pause-circle-linear',
    consequence:
      'They cannot sign in or transact, and their public content is hidden from discovery and from their profile page.',
  }),
  [ACCOUNT_STATUS.BLACKLISTED]: Object.freeze({
    severity: 'error',
    icon: 'solar:forbidden-circle-linear',
    consequence:
      'Their account is closed: sign-in is blocked and their public content is hidden. Their records are retained for audit.',
  }),
  [ACCOUNT_STATUS.DEACTIVATED]: Object.freeze({
    severity: 'info',
    icon: 'solar:user-cross-linear',
    consequence:
      'This member closed their own account from Settings — it is not something our team did. Reinstate it only if they have asked us to reopen it.',
  }),
})

/**
 * @param {object} props
 * @param {object} props.user the account
 * @param {object|null} [props.actor] the admin who made the change, already
 *   resolved to a record — the banner does not fetch
 */
export default function UserStatusBanner({ user, actor }) {
  const config = BANNER[user?.accountStatus]
  if (!config) return null

  const meta = STATUS_META[user.accountStatus]

  return (
    <Alert
      severity={config.severity}
      variant="outlined"
      icon={<Icon icon={config.icon} width={22} aria-hidden="true" />}
      sx={{ alignItems: 'flex-start' }}
    >
      <AlertTitle sx={{ fontWeight: 700 }}>
        {`Account ${meta?.label?.toLowerCase() ?? user.accountStatus}`}
      </AlertTitle>

      <Typography variant="body2" sx={{ mb: user.statusReason ? 1.5 : 0 }}>
        {config.consequence}
      </Typography>

      {user.statusReason ? (
        <Box
          sx={{
            borderLeft: 3,
            borderColor: 'divider',
            pl: 1.5,
            py: 0.25,
          }}
        >
          <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
            “{user.statusReason}”
          </Typography>
        </Box>
      ) : null}

      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
        {[
          user.statusChangedAt ? `Changed ${formatDateTime(user.statusChangedAt)}` : null,
          actor?.name ? `by ${actor.name}` : user.statusChangedById ? 'by our team' : null,
        ]
          .filter(Boolean)
          .join(' ') || 'No change history was recorded for this status.'}
      </Typography>
    </Alert>
  )
}
