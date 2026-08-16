import { useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

import FormTextField from '@/components/inputs/FormTextField'
import { REJECTION_REASONS } from '@/constants/policy'
import SettingsField from '@/features/admin/settings/components/SettingsField'
import {
  SETTINGS_BOUNDS,
  rejectionReasonCode,
} from '@/features/admin/settings/utils/settingsSchema'

// Moderation — Prompt 35 §4.5.
//
// **Rejection reasons: the constants stay canonical.** The six built-in codes
// live in `src/constants/policy.js` (Prompt 03) and are not editable here — a
// stored `reasonCode` has to mean the same thing in a year as it did when a
// reviewer chose it, and a renameable list cannot promise that. What a super
// admin *can* do is append: each addition is a `{ code, label }` stored in
// settings and offered alongside the canonical six in the decision dialog. Codes
// are generated from the label with a `custom_` prefix, so an addition can never
// collide with a built-in one (contract §6.27).
//
// Removing an addition stops offering it; cases already decided with it keep
// their code and their reviewer's note.

/** The canonical six, shown read-only so the reader knows what already exists. */
function CanonicalReasons() {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
        Built in — always offered, and not editable
      </Typography>
      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
        {REJECTION_REASONS.map((reason) => (
          <Tooltip key={reason.code} title={reason.description}>
            <Chip label={reason.label} size="small" variant="outlined" sx={{ height: 26 }} />
          </Tooltip>
        ))}
      </Stack>
    </Box>
  )
}

/**
 * @param {object} props
 * @param {import('@/hooks/useForm').UseFormResult} props.form the section's form
 */
export default function ModerationSection({ form }) {
  const [draft, setDraft] = useState('')
  const [draftError, setDraftError] = useState(undefined)

  const additions = form.values.customRejectionReasons ?? []
  const autoApprove = Boolean(form.values.autoApproveDeliveries)
  const { min: shortest, max: longest } = SETTINGS_BOUNDS.rejectionReasonLabel

  const addReason = () => {
    const label = draft.trim()
    if (label.length < shortest || label.length > longest) {
      setDraftError(`Use between ${shortest} and ${longest} characters.`)
      return
    }

    const code = rejectionReasonCode(label)
    const clashesWithBuiltIn = REJECTION_REASONS.some((reason) => reason.code === code)
    const clashesWithAddition = additions.some((reason) => reason.code === code)
    if (!code || clashesWithBuiltIn || clashesWithAddition) {
      setDraftError('That reason is already offered — pick a different wording.')
      return
    }

    form.setValue('customRejectionReasons', [...additions, { code, label }])
    setDraft('')
    setDraftError(undefined)
  }

  const removeReason = (code) => {
    form.setValue(
      'customRejectionReasons',
      additions.filter((reason) => reason.code !== code)
    )
  }

  return (
    <Stack spacing={{ xs: 2, md: 2.5 }}>
      <Card>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Review queue
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, maxWidth: '68ch' }}>
            How much of what the marketplace produces reaches a reviewer, and how fast it is expected
            to move once it does.
          </Typography>

          <Stack spacing={2.5}>
            <SettingsField
              helper={
                autoApprove
                  ? 'On: a delivery opens its moderation case already approved, with a system note saying why, so Trust & Safety spot-check decided records instead of working every file the marketplace produces. Portfolio submissions are always reviewed either way.'
                  : 'Off: every delivery lands in the moderation queue at “submitted” and waits for a decision. Expect the queue to grow by roughly one case per delivery.'
              }
              usedBy={['Delivery submission', 'Admin › Moderation queue']}
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={autoApprove}
                    onChange={(event) => form.setValue('autoApproveDeliveries', event.target.checked)}
                    inputProps={{ 'aria-label': 'Auto-approve deliveries' }}
                  />
                }
                label={
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Auto-approve deliveries is {autoApprove ? 'on' : 'off'}
                  </Typography>
                }
                sx={{ minHeight: 44, ml: 0 }}
              />
            </SettingsField>

            <SettingsField
              helper={`How long a case may wait before the queue starts flagging it. It tints the waiting badges in the moderation console — amber at the target, red at double it — and nothing is auto-decided when it passes. Between ${SETTINGS_BOUNDS.reviewSlaDays.min} and ${SETTINGS_BOUNDS.reviewSlaDays.max} days.`}
              usedBy={['Admin › Moderation queue', 'Waiting badges']}
            >
              <Box sx={{ maxWidth: 260 }}>
                <FormTextField
                  label="Review target"
                  type="number"
                  required
                  inputProps={{
                    min: SETTINGS_BOUNDS.reviewSlaDays.min,
                    max: SETTINGS_BOUNDS.reviewSlaDays.max,
                    step: 1,
                    inputMode: 'numeric',
                  }}
                  endAdornment={<InputAdornment position="end">days</InputAdornment>}
                  {...form.fieldProps('reviewSlaDays')}
                />
              </Box>
            </SettingsField>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Rejection reasons
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, maxWidth: '68ch' }}>
            What a reviewer picks from when they reject a submission or ask for changes. The creator
            reads the reason word for word alongside the reviewer’s note.
          </Typography>

          <Stack spacing={2.5}>
            <CanonicalReasons />

            <SettingsField
              helper="Additions appear at the end of the reviewer’s list, after the built-in six. Removing one stops offering it; decisions already recorded with it keep their reason and their note."
              usedBy={['Admin › Moderation decisions']}
            >
              <Box>
                <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
                  Your additions
                </Typography>

                {additions.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    None yet — the built-in reasons cover most decisions.
                  </Typography>
                ) : (
                  <List dense disablePadding sx={{ mb: 1.5 }}>
                    {additions.map((reason) => (
                      <ListItem
                        key={reason.code}
                        disableGutters
                        secondaryAction={
                          <IconButton
                            edge="end"
                            onClick={() => removeReason(reason.code)}
                            aria-label={`Remove the rejection reason “${reason.label}”`}
                            sx={{ width: 44, height: 44 }}
                          >
                            <Icon icon="solar:trash-bin-trash-linear" width={18} />
                          </IconButton>
                        }
                        sx={{ borderBottom: 1, borderColor: 'divider' }}
                      >
                        <ListItemText
                          primary={reason.label}
                          secondary={reason.code}
                          primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                          secondaryTypographyProps={{ variant: 'caption', fontFamily: 'monospace' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-start">
                  <TextField
                    label="Add a reason"
                    value={draft}
                    onChange={(event) => {
                      setDraft(event.target.value)
                      setDraftError(undefined)
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return
                      event.preventDefault()
                      addReason()
                    }}
                    error={Boolean(draftError)}
                    helperText={
                      draftError ??
                      (draft.trim()
                        ? `Saved as ${rejectionReasonCode(draft.trim()) || '—'}`
                        : 'e.g. “Client logo not cleared”')
                    }
                    inputProps={{ maxLength: longest }}
                    fullWidth
                    sx={{ maxWidth: { sm: 380 } }}
                  />
                  <Button
                    onClick={addReason}
                    variant="outlined"
                    disabled={!draft.trim()}
                    sx={{ minHeight: 44, mt: { xs: 0, sm: 1 }, flexShrink: 0 }}
                    startIcon={<Icon icon="tabler:plus" width={18} aria-hidden="true" />}
                  >
                    Add
                  </Button>
                </Stack>
              </Box>
            </SettingsField>

            <Alert severity="info">
              The six built-in reasons are part of the Content Policy and cannot be renamed or
              removed here. A stored reason has to keep meaning what it meant when a reviewer chose
              it — so this list only ever grows.
            </Alert>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}
