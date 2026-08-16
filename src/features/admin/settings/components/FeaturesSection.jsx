import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'

import { FEATURE_FLAGS } from '@/features/admin/settings/utils/settingsSchema'

// Features — Prompt 35 §4.6.
//
// Four switches, each hiding a whole area of BetterBlue from everybody at once.
// So each one states its **scope** (what it covers), its **consumers** (the
// surfaces that change), and — when it is being switched off — exactly what
// disappears, quoted back in the confirmation dialog before anything is written.
//
// The switches are plain `Switch`es rather than a form field per flag because
// there is nothing to validate: the value is a boolean and the guard rail is the
// confirmation, not a validator.
//
// Each row is a `<label>` wrapping its switch, so the whole card is a hit target
// and a screen reader hears the flag's name with its state (§12).

/**
 * @param {object} props
 * @param {import('@/hooks/useForm').UseFormResult} props.form the section's form
 */
export default function FeaturesSection({ form }) {
  return (
    <Stack spacing={{ xs: 2, md: 2.5 }}>
      <Alert severity="info" icon={<Icon icon="solar:info-circle-linear" width={22} />}>
        Switching a feature off hides it for every member immediately — no reload, no deploy. Nothing
        already created is deleted: existing records stay, and switching the feature back on brings
        its screens back exactly as they were.
      </Alert>

      {FEATURE_FLAGS.map((flag) => {
        const enabled = Boolean(form.values[flag.key])
        return (
          <Card key={flag.key}>
            <CardContent
              component="label"
              htmlFor={`feature-${flag.key}`}
              sx={{ p: { xs: 2.5, md: 3 }, display: 'block', cursor: 'pointer' }}
            >
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <Box
                  aria-hidden="true"
                  sx={{
                    flexShrink: 0,
                    width: 44,
                    height: 44,
                    borderRadius: 2,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: enabled ? 'primary.surface' : 'action.hover',
                    color: enabled ? 'primary.main' : 'text.disabled',
                  }}
                >
                  <Icon icon={flag.icon} width={22} />
                </Box>

                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25 }}>
                    <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
                      {flag.label}
                    </Typography>
                    <Chip
                      label={enabled ? 'On' : 'Off'}
                      size="small"
                      color={enabled ? 'success' : 'default'}
                      variant={enabled ? 'filled' : 'outlined'}
                      sx={{ height: 22, fontSize: 12 }}
                    />
                  </Stack>

                  <Typography variant="body2" color="text.secondary" sx={{ maxWidth: '68ch' }}>
                    {flag.scope}
                  </Typography>

                  <Typography
                    variant="caption"
                    color="text.secondary"
                    component="p"
                    sx={{ mt: 1, maxWidth: '68ch' }}
                  >
                    {enabled ? `Off: ${flag.disableWarning}` : 'Currently off across the platform.'}
                  </Typography>

                  <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1, alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary" component="span">
                      Used by
                    </Typography>
                    {flag.usedBy.map((surface) => (
                      <Chip
                        key={surface}
                        label={surface}
                        size="small"
                        variant="outlined"
                        sx={{ height: 22, fontSize: 12 }}
                      />
                    ))}
                  </Stack>
                </Box>

                <Switch
                  id={`feature-${flag.key}`}
                  checked={enabled}
                  onChange={(event) => form.setValue(flag.key, event.target.checked)}
                  inputProps={{ 'aria-label': `${flag.label} — currently ${enabled ? 'on' : 'off'}` }}
                  sx={{ flexShrink: 0 }}
                />
              </Stack>
            </CardContent>
          </Card>
        )
      })}
    </Stack>
  )
}
