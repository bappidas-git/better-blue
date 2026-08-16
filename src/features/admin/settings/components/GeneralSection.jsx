import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import InputAdornment from '@mui/material/InputAdornment'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import FormSelect from '@/components/inputs/FormSelect'
import FormTextField from '@/components/inputs/FormTextField'
import SettingsField from '@/features/admin/settings/components/SettingsField'
import { SETTINGS_BOUNDS } from '@/features/admin/settings/utils/settingsSchema'

// General — Prompt 35 §4.2.
//
// Two cards, because these five fields answer two different questions: what the
// marketplace is called and where members write to (identity), and the two
// windows that decide when money moves (operations). Grouping them by what they
// do rather than by where they live in the JSON is what makes a settings screen
// readable (§6).

/** The only currency the product supports today — see the note beside it. */
const CURRENCY_OPTIONS = [{ value: 'USD', label: 'USD — US Dollar' }]

/**
 * @param {object} props
 * @param {import('@/hooks/useForm').UseFormResult} props.form the section's form
 */
export default function GeneralSection({ form }) {
  return (
    <Stack spacing={{ xs: 2, md: 2.5 }}>
      <Card>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Identity
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, maxWidth: '68ch' }}>
            What members see the marketplace called, and where they write when something goes wrong.
          </Typography>

          <Stack spacing={2.5}>
            <SettingsField
              helper="Appears in the browser tab, the sign-in screens, transactional email, and the footer. Changing it renames the product everywhere at once, so it is worth being sure."
              usedBy={['Every page title', 'Auth screens', 'Public footer']}
            >
              <FormTextField
                label="Platform name"
                required
                maxLength={SETTINGS_BOUNDS.platformName.max}
                {...form.fieldProps('platformName')}
              />
            </SettingsField>

            <SettingsField
              helper="The address shown on refusal screens, the contact page, and every “get in touch” affordance in the console. Nothing is sent from BetterBlue to it — it is what members are asked to write to."
              usedBy={['Contact page', 'Access-denied cards', 'Support screens']}
            >
              <FormTextField
                label="Support email"
                type="email"
                required
                {...form.fieldProps('supportEmail')}
              />
            </SettingsField>

            <SettingsField
              helper="Every amount on the platform is stored and displayed in this currency. It is display-only consistency today: there is no conversion, and orders already priced are not re-denominated."
              usedBy={['All pricing', 'Checkout', 'Earnings', 'Payouts']}
            >
              <FormSelect
                label="Currency"
                options={CURRENCY_OPTIONS}
                required
                {...form.fieldProps('currency')}
              />
            </SettingsField>

            <Alert severity="info" sx={{ mt: -0.5 }}>
              More currencies later. Multi-currency needs conversion at award time and a stored rate
              per order — until that exists, offering a second option here would misprice work rather
              than translate it.
            </Alert>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Money and timing
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, maxWidth: '68ch' }}>
            The two windows that decide when escrow is released and when a creator can withdraw.
          </Typography>

          <Box
            sx={{
              display: 'grid',
              gap: 2.5,
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
            }}
          >
            <SettingsField
              helper={`How long a buyer has to review a delivery before it accepts itself and the creator is paid. Shown to buyers on the order screen as “accepts automatically in N days”. Between ${SETTINGS_BOUNDS.autoAcceptDays.min} and ${SETTINGS_BOUNDS.autoAcceptDays.max} days.`}
              usedBy={['Buyer order detail', 'Creator order detail', 'Pricing page']}
            >
              <FormTextField
                label="Auto-accept window"
                type="number"
                required
                inputProps={{
                  min: SETTINGS_BOUNDS.autoAcceptDays.min,
                  max: SETTINGS_BOUNDS.autoAcceptDays.max,
                  step: 1,
                  inputMode: 'numeric',
                }}
                endAdornment={<InputAdornment position="end">days</InputAdornment>}
                {...form.fieldProps('autoAcceptDays')}
              />
            </SettingsField>

            <SettingsField
              helper={`The balance a creator must hold before they can request a payout. The earnings screen quotes it, and a request below it is refused. Between ${SETTINGS_BOUNDS.payoutMinAmount.min} and ${SETTINGS_BOUNDS.payoutMinAmount.max} dollars.`}
              usedBy={['Creator earnings', 'Payout request', 'Admin › Settlements']}
            >
              <FormTextField
                label="Payout minimum"
                type="number"
                required
                inputProps={{
                  min: SETTINGS_BOUNDS.payoutMinAmount.min,
                  max: SETTINGS_BOUNDS.payoutMinAmount.max,
                  step: 5,
                  inputMode: 'decimal',
                }}
                startAdornment={<InputAdornment position="start">$</InputAdornment>}
                {...form.fieldProps('payoutMinAmount')}
              />
            </SettingsField>
          </Box>
        </CardContent>
      </Card>
    </Stack>
  )
}
