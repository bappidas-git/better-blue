import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import FormTextField from '@/components/inputs/FormTextField'

// Where a creator's released earnings are sent — the record `requestPayout`
// snapshots onto every payout (Prompt 17) and the settlement console reads
// (Prompt 32).
//
// SECURITY (00 §14, Prompt 21 §7): **the account number is never stored.** The
// field below is an ordinary input while it is being typed, and
// `maskAccountNumber` reduces it to `"**** 4821"` on the way into the patch
// body — so what leaves the browser, what JSON Server holds, and what every
// later screen displays is the masked form and nothing else. A creator who
// wants to change the account retypes it; there is no full number to prefill
// because there is no full number anywhere.
//
// That also means this card is a **demo**, and says so: a real integration
// would hand the number straight to a payments provider over a server-side
// channel and store the returned token, never touching it in the browser at
// all. Everything visual here — the lock, the tinted frame, the masked display
// — is there so the demo does not teach anyone the wrong habit.

/**
 * DOM id of this card, so other screens can deep-link to it rather than to the
 * top of a long form. Prompt 25's earnings screen sends "Update payout method"
 * to `/creator/profile#payout-method`; `CreatorProfilePage` scrolls to it once
 * the form has rendered.
 */
export const CREATOR_PAYOUT_METHOD_ANCHOR = 'payout-method'

/**
 * @param {object} props
 * @param {object} props.form the `useForm` instance owning `payoutAccountName`,
 *   `payoutAccountNumber`, and `payoutRoutingNumber`
 * @param {string} [props.savedMasked] the masked account already on the record,
 *   e.g. `"**** 4821"`
 * @param {boolean} [props.disabled=false] disable while the form is saving
 */
export default function PayoutMethodCard({ form, savedMasked, disabled = false }) {
  const hasSaved = Boolean(savedMasked)

  return (
    <Card id={CREATOR_PAYOUT_METHOD_ANCHOR} sx={{ scrollMarginTop: 96 }}>
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.5 }}>
          <Box
            aria-hidden="true"
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1.5,
              display: 'grid',
              placeItems: 'center',
              color: 'primary.main',
              bgcolor: 'primary.surface',
            }}
          >
            <Icon icon="solar:lock-password-linear" width={18} />
          </Box>
          <Typography variant="h6" component="h2" sx={{ fontSize: '1.0625rem' }}>
            Payout method
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
          Where BetterBlue sends your earnings once an order completes and the payment is released.
        </Typography>

        <Alert severity="info" icon={<Icon icon="solar:shield-check-linear" width={20} />} sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Demo payout details.</strong> This prototype stores only the last four digits
            of the account number — nothing you type here is kept in full, and no money moves.
          </Typography>
        </Alert>

        <Stack spacing={3}>
          {hasSaved ? (
            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
              sx={{
                p: 2,
                borderRadius: 2,
                border: 1,
                borderColor: (theme) => alpha(theme.palette.success.main, 0.35),
                bgcolor: (theme) => alpha(theme.palette.success.main, 0.06),
              }}
            >
              <Box aria-hidden="true" sx={{ display: 'flex', color: 'success.main' }}>
                <Icon icon="solar:card-linear" width={22} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" component="p">
                  Bank account ending {savedMasked}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Enter a new account number below to replace it.
                </Typography>
              </Box>
            </Stack>
          ) : null}

          <FormTextField
            label="Account holder name"
            maxLength={80}
            autoComplete="off"
            helperText="Exactly as it appears on the account."
            disabled={disabled}
            {...form.fieldProps('payoutAccountName')}
          />

          <FormTextField
            label={hasSaved ? 'New account number' : 'Account number'}
            autoComplete="off"
            placeholder="8 to 17 digits"
            inputProps={{ inputMode: 'numeric' }}
            disabled={disabled}
            helperText={
              form.errors.payoutAccountNumber
                ? undefined
                : 'Only the last four digits are saved. Leave blank to keep the account already on file.'
            }
            {...form.fieldProps('payoutAccountNumber')}
          />

          <FormTextField
            label="Sort code or routing number"
            autoComplete="off"
            placeholder="6 to 9 digits"
            inputProps={{ inputMode: 'numeric' }}
            disabled={disabled}
            helperText={
              form.errors.payoutRoutingNumber
                ? undefined
                : 'Identifies the bank, not the account — this one is stored as entered.'
            }
            {...form.fieldProps('payoutRoutingNumber')}
          />
        </Stack>
      </CardContent>
    </Card>
  )
}
