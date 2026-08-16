import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import FormControlLabel from '@mui/material/FormControlLabel'
import InputAdornment from '@mui/material/InputAdornment'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'

import FormTextField from '@/components/inputs/FormTextField'
import SettingsField from '@/features/admin/settings/components/SettingsField'
import {
  COMMISSION_EXAMPLE_ORDER,
  SETTINGS_BOUNDS,
  percentToRate,
} from '@/features/admin/settings/utils/settingsSchema'
import { formatCurrency } from '@/utils/formatters'
import { applyRate } from '@/utils/money'

// Affiliate — Prompt 35 §4.4.
//
// **One switch, not two.** The program used to carry its own `affiliate.enabled`
// boolean *and* sit behind the `features.affiliateProgram` flag, which meant two
// places to look when it was off and two ways for them to disagree. Prompt 35
// retired `affiliate.enabled`: the toggle below writes the feature flag, the
// same key the Features section writes and the same one `useFeatureFlag` reads.
// `affiliate` now holds only the program's numbers.
//
// The share is a share **of the platform commission**, not of the order — a
// distinction worth a worked example rather than a footnote, since 10% of a
// commission and 10% of an order differ by a factor of five.

/** What a referral is actually worth, recomputed as the rate is typed. */
function ShareExample({ percent, commissionRate }) {
  const share = percentToRate(percent)
  if (share === null || !Number.isFinite(commissionRate)) return null

  const commission = applyRate(COMMISSION_EXAMPLE_ORDER, commissionRate)
  const affiliate = applyRate(commission, share)

  return (
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap role="status" sx={{ mt: 1.25 }}>
      <Icon icon="solar:calculator-minimalistic-linear" width={18} aria-hidden="true" />
      <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        On a {formatCurrency(COMMISSION_EXAMPLE_ORDER, 'USD', { hideDecimals: true })} order,
        BetterBlue keeps {formatCurrency(commission)} — the referrer earns{' '}
        <Box component="strong">{formatCurrency(affiliate)}</Box> of it.
      </Typography>
    </Stack>
  )
}

/**
 * @param {object} props
 * @param {import('@/hooks/useForm').UseFormResult} props.form the section's form
 * @param {number} [props.commissionRate] the saved platform rate, for the example
 */
export default function AffiliateSection({ form, commissionRate }) {
  const enabled = Boolean(form.values.affiliateProgram)

  return (
    <Stack spacing={{ xs: 2, md: 2.5 }}>
      <Card>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Program status
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, maxWidth: '68ch' }}>
            Whether members can refer businesses to BetterBlue at all.
          </Typography>

          <SettingsField
            helper="Off means referral links stop capturing signups, no new commission accrues, and the Affiliate entry leaves the buyer nav and the console. Accounts, earned commission, and payouts already recorded are untouched."
            usedBy={['Affiliate dashboard', 'Admin › Affiliates', 'Buyer nav', 'Pricing page']}
          >
            <FormControlLabel
              control={
                <Switch
                  checked={enabled}
                  onChange={(event) => form.setValue('affiliateProgram', event.target.checked)}
                  inputProps={{ 'aria-label': 'Affiliate program' }}
                />
              }
              label={
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Affiliate program is {enabled ? 'on' : 'off'}
                </Typography>
              }
              sx={{ minHeight: 44, ml: 0 }}
            />
          </SettingsField>

          <Alert severity="info" sx={{ mt: 2 }}>
            <AlertTitle sx={{ mb: 0.5 }}>This is the same switch as “Affiliate program” in Features</AlertTitle>
            The program has one control, stored as <code>features.affiliateProgram</code>. Setting it
            here and setting it there do exactly the same thing — there is no second, separate
            “enabled” flag to get out of step with it.
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Referral terms
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, maxWidth: '68ch' }}>
            What a referral earns, how long a click counts for, and when it can be withdrawn.
          </Typography>

          <Stack spacing={2.5}>
            <SettingsField
              helper={`A share of BetterBlue’s commission on the referred business’s first completed order — not a share of the order. Between ${SETTINGS_BOUNDS.affiliatePercent.min}% and ${SETTINGS_BOUNDS.affiliatePercent.max}%.`}
              usedBy={['Affiliate dashboard', 'Commission accrual', 'Pricing page teaser']}
            >
              <Box sx={{ maxWidth: 260 }}>
                <FormTextField
                  label="Referral share"
                  type="number"
                  required
                  inputProps={{
                    min: SETTINGS_BOUNDS.affiliatePercent.min,
                    max: SETTINGS_BOUNDS.affiliatePercent.max,
                    step: 1,
                    inputMode: 'decimal',
                    'aria-label': 'Referral share, percent of platform commission',
                  }}
                  endAdornment={<InputAdornment position="end">%</InputAdornment>}
                  {...form.fieldProps('commissionRatePercent')}
                />
              </Box>
              <ShareExample percent={form.values.commissionRatePercent} commissionRate={commissionRate} />
            </SettingsField>

            <Box
              sx={{
                display: 'grid',
                gap: 2.5,
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              <SettingsField
                helper={`How long after clicking a referral link a signup still counts for the referrer. Judged at signup against when the link was clicked, so shortening it does not retract attribution already recorded. Between ${SETTINGS_BOUNDS.attributionDays.min} and ${SETTINGS_BOUNDS.attributionDays.max} days.`}
                usedBy={['Referral capture', 'Signup attribution', 'Affiliate dashboard']}
              >
                <FormTextField
                  label="Attribution window"
                  type="number"
                  required
                  inputProps={{
                    min: SETTINGS_BOUNDS.attributionDays.min,
                    max: SETTINGS_BOUNDS.attributionDays.max,
                    step: 1,
                    inputMode: 'numeric',
                  }}
                  endAdornment={<InputAdornment position="end">days</InputAdornment>}
                  {...form.fieldProps('attributionDays')}
                />
              </SettingsField>

              <SettingsField
                helper={`The approved commission an affiliate must hold before they can request a payout. Separate from the platform payout minimum, because referral commission accrues in much smaller amounts than order earnings.`}
                usedBy={['Affiliate dashboard', 'Payout request', 'Admin › Affiliates']}
              >
                <FormTextField
                  label="Affiliate payout minimum"
                  type="number"
                  required
                  inputProps={{
                    min: SETTINGS_BOUNDS.affiliatePayoutMin.min,
                    max: SETTINGS_BOUNDS.affiliatePayoutMin.max,
                    step: 5,
                    inputMode: 'decimal',
                  }}
                  startAdornment={<InputAdornment position="start">$</InputAdornment>}
                  {...form.fieldProps('payoutMinAmount')}
                />
              </SettingsField>
            </Box>
          </Stack>

          <Alert severity="info" sx={{ mt: 2.5 }}>
            Lowering the referral share applies to commission that accrues from here on. Commission
            already recorded against a referral keeps the amount it was calculated at, whatever its
            approval status — the same rule an order’s frozen commission rate follows.
          </Alert>
        </CardContent>
      </Card>
    </Stack>
  )
}
