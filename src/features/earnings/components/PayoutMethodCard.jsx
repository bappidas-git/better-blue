import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'

import { CREATOR_PAYOUT_METHOD_ANCHOR } from '@/features/creatorAccount/components/PayoutMethodCard'
import { paths } from '@/routes/paths'

// Where a payout goes — the read-only twin of the editable card on the profile
// screen (`features/creatorAccount/components/PayoutMethodCard`, Prompt 21).
//
// Two states, and the difference between them is not cosmetic: **without a
// method there is no way to be paid**, so the card turns into a warning that
// gates the whole withdraw flow rather than a tidy line of grey text. The
// account itself is only ever the mask the profile screen stored — the full
// number was never saved anywhere (00 §14).
//
// Editing belongs on the profile, so this card links there rather than
// duplicating the form: there is exactly one place a payout method is written.

/** Deep link straight to the payout section of the profile form. */
const EDIT_LINK = `${paths.CREATOR_PROFILE}#${CREATOR_PAYOUT_METHOD_ANCHOR}`

/**
 * @param {object} props
 * @param {object|null} [props.method] `creatorProfiles.payoutMethod` —
 *   `{ type, accountName, accountMasked, routingNumber }`, or `null`
 * @param {boolean} [props.loading=false]
 */
export default function PayoutMethodCard({ method, loading = false }) {
  if (loading) {
    return (
      <Card>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Skeleton
            variant="rounded"
            role="status"
            aria-busy="true"
            aria-label="Loading your payout method"
            sx={{ height: 96 }}
          />
        </CardContent>
      </Card>
    )
  }

  const account = method?.accountMasked

  if (!account) {
    return (
      <Card
        sx={{
          borderColor: (theme) => alpha(theme.palette.warning.main, 0.4),
          bgcolor: (theme) => alpha(theme.palette.warning.main, 0.06),
        }}
      >
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <Box aria-hidden="true" sx={{ display: 'flex', color: 'warning.dark', pt: '2px' }}>
              <Icon icon="solar:danger-triangle-linear" width={22} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" component="h3">
                Add a payout method before you withdraw
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Your earnings keep accruing either way — we just have nowhere to send them yet.
                It takes a minute on your profile.
              </Typography>
              <Button
                component={RouterLink}
                to={EDIT_LINK}
                variant="contained"
                color="warning"
                sx={{ mt: 2, minHeight: 44 }}
                startIcon={<Icon icon="solar:card-linear" width={18} aria-hidden="true" />}
              >
                Add payout method
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={1.75} alignItems="center" sx={{ minWidth: 0 }}>
            <Box
              aria-hidden="true"
              sx={{
                flexShrink: 0,
                width: 44,
                height: 44,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                color: 'primary.main',
                bgcolor: 'primary.surface',
              }}
            >
              <Icon icon="solar:card-linear" width={22} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="overline" component="p" color="text.secondary">
                Payout method
              </Typography>
              <Typography variant="subtitle2" component="p" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                Bank account {account}
              </Typography>
              {method?.accountName ? (
                <Typography variant="caption" color="text.secondary">
                  {method.accountName}
                </Typography>
              ) : null}
            </Box>
          </Stack>

          <Button
            component={RouterLink}
            to={EDIT_LINK}
            variant="outlined"
            color="inherit"
            sx={{ flexShrink: 0, minHeight: 44 }}
          >
            Update
          </Button>
        </Stack>
      </CardContent>
    </Card>
  )
}
