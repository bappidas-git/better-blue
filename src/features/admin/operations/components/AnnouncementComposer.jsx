import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import LinearProgress from '@mui/material/LinearProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import FormSelect from '@/components/inputs/FormSelect'
import FormTextField from '@/components/inputs/FormTextField'
import { AUDIENCE_OPTIONS } from '@/features/admin/operations/utils/operationsFilters'
import {
  ANNOUNCEMENT_BODY_MAX,
  ANNOUNCEMENT_BODY_MIN,
  ANNOUNCEMENT_TITLE_MAX,
  ANNOUNCEMENT_TITLE_MIN,
} from '@/services/notificationService'
import { formatNumber } from '@/utils/formatters'

// The compose half of the announcements screen — Prompt 31 §4.4.
//
// Presentation only: the form state, the audience count, and the send all belong
// to the page, which owns the confirmation and the service call. This renders
// the fields, the live recipient count, and the progress of a send in flight.
//
// The audience selector prints *who each audience really is* under the field
// rather than trusting three one-word labels to carry it — "All members" not
// including the admin team is exactly the kind of thing somebody finds out
// afterwards otherwise.

/**
 * @param {object} props
 * @param {object} props.values `{ audience, title, body }`
 * @param {object} props.errors validation messages by field
 * @param {(name: string, value: string) => void} props.onChange
 * @param {(name: string) => void} [props.onBlur]
 * @param {number|null} [props.recipientCount] members in the chosen audience
 * @param {boolean} [props.countLoading=false]
 * @param {{sent: number, failed: number, total: number}|null} [props.progress] a send in flight
 * @param {boolean} [props.sending=false]
 * @param {() => void} props.onSend
 */
export default function AnnouncementComposer({
  values,
  errors = {},
  onChange,
  onBlur,
  recipientCount,
  countLoading = false,
  progress,
  sending = false,
  onSend,
}) {
  const audience = AUDIENCE_OPTIONS.find((option) => option.value === values.audience)

  const countLine = countLoading
    ? 'Counting the audience…'
    : typeof recipientCount === 'number'
      ? `${formatNumber(recipientCount)} member${recipientCount === 1 ? '' : 's'} will receive this.`
      : 'We could not count this audience — the send will still tell you how many it reached.'

  return (
    <Card component="form" onSubmit={(event) => event.preventDefault()}>
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Typography variant="subtitle2" component="h2" sx={{ mb: 2 }}>
          Compose
        </Typography>

        <Stack spacing={2.5}>
          <Box>
            <FormSelect
              id="announcement-audience"
              label="Audience"
              value={values.audience}
              onChange={(next) => onChange('audience', next)}
              options={AUDIENCE_OPTIONS.map(({ value, label }) => ({ value, label }))}
              error={errors.audience}
              helperText={audience?.description}
              required
            />
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.75 }}>
              {countLine}
            </Typography>
          </Box>

          <FormTextField
            id="announcement-title"
            label="Title"
            value={values.title}
            onChange={(next) => onChange('title', next)}
            onBlur={() => onBlur?.('title')}
            error={errors.title}
            maxLength={ANNOUNCEMENT_TITLE_MAX}
            required
            placeholder="e.g. Escrow protection now covers revisions"
            helperText={`${ANNOUNCEMENT_TITLE_MIN}–${ANNOUNCEMENT_TITLE_MAX} characters. This is the line members read first.`}
          />

          <FormTextField
            id="announcement-body"
            label="Message"
            value={values.body}
            onChange={(next) => onChange('body', next)}
            onBlur={() => onBlur?.('body')}
            error={errors.body}
            multiline
            minRows={5}
            maxLength={ANNOUNCEMENT_BODY_MAX}
            required
            placeholder="Say what has changed and what, if anything, members need to do."
            helperText={`${ANNOUNCEMENT_BODY_MIN}–${ANNOUNCEMENT_BODY_MAX} characters. Announcements have nowhere to link to, so the message has to stand alone.`}
          />

          {progress ? (
            <Box aria-live="polite">
              <Typography variant="body2" sx={{ mb: 0.75 }}>
                Sending… {formatNumber(progress.sent)} of {formatNumber(progress.total)}
                {progress.failed > 0 ? ` · ${formatNumber(progress.failed)} failed` : ''}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={
                  progress.total > 0
                    ? Math.round(((progress.sent + progress.failed) / progress.total) * 100)
                    : 0
                }
              />
            </Box>
          ) : null}

          <Alert severity="warning" variant="outlined">
            An announcement cannot be recalled. Every member in the audience gets it once, and
            preferences do not suppress it.
          </Alert>
        </Stack>
      </CardContent>

      {/* Sticky on a phone so the action stays reachable under a long message. */}
      <Box
        sx={{
          position: { xs: 'sticky', md: 'static' },
          bottom: 0,
          px: { xs: 2.5, md: 3 },
          py: 2,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <Button
          type="submit"
          variant="gradient"
          onClick={onSend}
          disabled={sending}
          startIcon={<Icon icon="solar:megaphone-linear" width={18} aria-hidden="true" />}
        >
          {sending ? 'Sending…' : 'Send announcement'}
        </Button>
      </Box>
    </Card>
  )
}
