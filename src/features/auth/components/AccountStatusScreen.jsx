import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { motion } from 'framer-motion'

import { fadeInUp } from '@/components/motion/motionPresets'
import { appConfig } from '@/config/appConfig'
import { ACCOUNT_STATUS } from '@/constants/statuses'

// Shown instead of the sign-in form when `login()` or the boot `me()` call is
// rejected for a non-active account (contract §2.3, 00 §11).
//
// The tone matters as much as the mechanics: someone reading this is locked out
// of their own account, and the screen's job is to say what happened, what it
// means, and how to reach a person about it. No jargon, no error codes, no
// blame. The copy is per status because "under review" and "permanently
// blocked" are not the same news.

/** Icon and headline per status. Body copy comes from the API message. */
const STATUS_COPY = {
  [ACCOUNT_STATUS.SUSPENDED]: {
    icon: 'tabler:clock-pause',
    title: 'Your account is on hold',
    detail:
      'Our Trust & Safety team is reviewing something on this account. Most reviews are finished within a few business days, and we will email you as soon as it is resolved.',
  },
  [ACCOUNT_STATUS.BLACKLISTED]: {
    icon: 'tabler:shield-x',
    title: 'This account has been restricted',
    detail: 'This account has been restricted for violating the BetterBlue marketplace policies.',
  },
  [ACCOUNT_STATUS.DEACTIVATED]: {
    icon: 'tabler:archive',
    title: 'This account is closed',
    detail:
      'This account was closed by its owner. Your order and payment history is retained. If you would like it reopened, our support team can help.',
  },
}

const FALLBACK_COPY = {
  icon: 'tabler:lock',
  title: 'You cannot sign in right now',
  detail: 'Access to this account is restricted. Our support team can tell you more.',
}

/**
 * @param {object} props
 * @param {string} props.accountStatus a value from `ACCOUNT_STATUS`
 * @param {string} [props.message] the server's explanation, shown verbatim
 * @param {() => void} [props.onDismiss] back to the sign-in form
 * @param {() => void} [props.onSignOut] clear the session on this device
 */
export default function AccountStatusScreen({ accountStatus, message, onDismiss, onSignOut }) {
  const copy = STATUS_COPY[accountStatus] ?? FALLBACK_COPY
  const supportSubject = encodeURIComponent(`Account access — ${accountStatus ?? 'restricted'}`)

  return (
    <Card component={motion.div} variants={fadeInUp} initial="hidden" animate="visible">
      <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
        <Stack spacing={3}>
          <Box
            aria-hidden="true"
            sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              bgcolor: (theme) => alpha(theme.palette.warning.main, 0.14),
              color: 'warning.dark',
            }}
          >
            <Icon icon={copy.icon} width={28} />
          </Box>

          <Stack spacing={1.5}>
            <Typography variant="h5" component="h1">
              {copy.title}
            </Typography>
            {/* The API's own wording first (it matches STATUS_META, so the two
                sides of the migration say the same thing), then the detail. */}
            {message ? (
              <Typography variant="body1" color="text.secondary">
                {message}
              </Typography>
            ) : null}
            <Typography variant="body2" color="text.secondary">
              {copy.detail}
            </Typography>
          </Stack>

          <Typography variant="body2" color="text.secondary">
            Questions about this decision? Email{' '}
            <Link href={`mailto:${appConfig.supportEmail}?subject=${supportSubject}`}>
              {appConfig.supportEmail}
            </Link>{' '}
            and our support team will take a look.
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            {onDismiss ? (
              <Button variant="contained" onClick={onDismiss} fullWidth>
                Back to sign in
              </Button>
            ) : null}
            {onSignOut ? (
              <Button
                variant="outlined"
                onClick={onSignOut}
                startIcon={<Icon icon="tabler:logout" width={18} />}
                fullWidth
              >
                Sign out
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}
