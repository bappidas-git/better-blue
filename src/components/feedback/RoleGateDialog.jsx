import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { Link as RouterLink, useLocation } from 'react-router-dom'

import ResponsiveDialog from '@/components/layout/ResponsiveDialog'
import { ROLES } from '@/constants/roles'
import { paths } from '@/routes/paths'

// The reusable "you need to be signed in as X to do this" gate (Storefront V2,
// prompts-v2/03 §5), used by Reply on a feed (V2-05, V2-07, V2-08), Send
// message and Promote on a creator (V2-09), and anything else V2 gates.
//
// It exists so that **every** gated action asks the same question the same way
// and offers the same two routes out: register in the role the action needs, or
// sign in and come straight back. A dialog per action would drift within a
// prompt or two.
//
// SECURITY: this is UX (00 §11). It hides an action the visitor cannot
// complete; it does not protect anything. Every one of these actions is also
// guarded server-side in the Laravel build.

/** Copy per gated role. `article` is the grammatical article for the label. */
const ROLE_COPY = {
  [ROLES.CREATOR]: {
    label: 'Creator',
    article: 'a',
    blurb:
      'Creators reply to feeds, send work to buyers, and get paid through BetterBlue escrow.',
  },
  [ROLES.BUYER]: {
    label: 'Buyer',
    article: 'a',
    blurb:
      'Buyers post feeds, message creators, and pay through BetterBlue escrow so the work is protected on both sides.',
  },
}

/**
 * The register link for a role, carrying the role as a query parameter.
 *
 * The key is spelled here rather than imported from `RegisterPage` for the same
 * reason `paths.buyerRequestDraft` spells `draft`: linking to a screen should
 * not pull that screen's module into the page doing the linking. V2-06 reads it
 * on the other side — until then the parameter is inert and the register form
 * simply opens on its role step, which is the correct fallback.
 */
const registerPath = (role) => `${paths.REGISTER}?role=${encodeURIComponent(role)}`

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {'creator'|'buyer'} [props.requiredRole='creator'] the role the action needs
 * @param {string} [props.action] what they were trying to do, as a verb phrase —
 *   "reply to this feed", "send a message to this creator". Completes the
 *   sentence "Log in or register as a Creator to …".
 */
export default function RoleGateDialog({
  open,
  onClose,
  requiredRole = ROLES.CREATOR,
  action,
}) {
  const location = useLocation()
  const copy = ROLE_COPY[requiredRole] ?? ROLE_COPY[ROLES.CREATOR]

  // The same `state.from` shape the route guards use, so signing in from here
  // returns the visitor to the page they were gated on — `GuestRoute` reads it
  // back after the session updates (`src/routes/guards.jsx`).
  const loginState = { from: location }

  const sentence = action
    ? `Log in or register as ${copy.article} ${copy.label} to ${action}.`
    : `Log in or register as ${copy.article} ${copy.label} to continue.`

  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      title={`${copy.label}s only`}
      description={sentence}
      actions={
        <Stack
          direction={{ xs: 'column-reverse', sm: 'row' }}
          spacing={1}
          sx={{ width: '100%', justifyContent: 'flex-end' }}
        >
          <Button
            component={RouterLink}
            to={paths.LOGIN}
            state={loginState}
            variant="outlined"
            onClick={onClose}
            fullWidth={false}
          >
            Log in
          </Button>
          <Button
            component={RouterLink}
            to={registerPath(requiredRole)}
            variant="gradient"
            onClick={onClose}
            fullWidth={false}
          >
            Register as {copy.article} {copy.label}
          </Button>
        </Stack>
      }
    >
      <Stack direction="row" spacing={2} alignItems="flex-start">
        <Box
          aria-hidden="true"
          sx={{
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            width: 44,
            height: 44,
            borderRadius: 'var(--bb-radius-md)',
            color: 'primary.light',
            bgcolor: 'primary.lighter',
            boxShadow: (theme) => `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.28)}`,
          }}
        >
          <Icon icon="solar:lock-keyhole-minimalistic-linear" width={22} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary">
            {copy.blurb}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Registering takes a minute and is free — BetterBlue only charges commission on
            completed work.
          </Typography>
        </Box>
      </Stack>
    </ResponsiveDialog>
  )
}
