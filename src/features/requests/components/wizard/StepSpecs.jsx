import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Collapse from '@mui/material/Collapse'
import Divider from '@mui/material/Divider'
import FormLabel from '@mui/material/FormLabel'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import FilterChipGroup from '@/components/inputs/FilterChipGroup'
import FormFileField from '@/components/inputs/FormFileField'
import FormSelect from '@/components/inputs/FormSelect'
import FormTextField from '@/components/inputs/FormTextField'
import ChoiceCardGroup from '@/features/requests/components/wizard/ChoiceCardGroup'
import ListEntryInput from '@/features/requests/components/wizard/ListEntryInput'
import {
  GUIDELINES_MAX,
  MAX_LIST_ENTRIES,
  MAX_REFERENCE_FILES,
  ORIENTATION_OPTIONS,
  QUANTITY_MAX,
  QUANTITY_MIN,
  USAGE_RIGHTS_OPTIONS,
  VIDEO_DURATION_OPTIONS,
} from '@/features/requests/hooks/useRequestWizard'

// Step 2 — the specifics a creator needs before they can price the work.

/** Image types the reference picker accepts (mirrors `UPLOAD_RULES`). */
const REFERENCE_ACCEPT = 'image/jpeg,image/png,image/webp'
const REFERENCE_MAX_MB = 10

const DURATION_OPTIONS = VIDEO_DURATION_OPTIONS.map((seconds) => ({
  value: String(seconds),
  label: `${seconds} seconds`,
}))

/**
 * @param {object} props
 * @param {object} props.form the wizard's `useForm` instance
 * @param {boolean} props.needsVideoDuration true for video and bundle briefs
 * @param {boolean} [props.disabled=false]
 */
export default function StepSpecs({ form, needsVideoDuration, disabled = false }) {
  const { values } = form
  const alreadyAttached = (values.referenceUrls ?? []).length

  return (
    <Stack spacing={3}>
      <QuantityStepper
        label="How many deliverables?"
        helperText={`Between ${QUANTITY_MIN} and ${QUANTITY_MAX} finished pieces.`}
        disabled={disabled}
        {...form.fieldProps('quantity')}
      />

      {/* Video length exists only where video does — and `useRequestWizard`
          clears the answer when the type changes, so nothing stale survives. */}
      <Collapse in={needsVideoDuration} unmountOnExit>
        <FormSelect
          label="Length of each clip"
          required
          placeholder="Choose a length"
          options={DURATION_OPTIONS}
          helperText="Most social placements sit between 15 and 30 seconds."
          disabled={disabled}
          {...form.fieldProps('videoDurationSec')}
          value={values.videoDurationSec === '' ? '' : String(values.videoDurationSec)}
        />
      </Collapse>

      <Box>
        <FormLabel component="p" sx={{ mb: 1 }}>
          Framing
        </FormLabel>
        <FilterChipGroup
          label="Framing"
          options={ORIENTATION_OPTIONS}
          value={values.orientation}
          onChange={(next) => form.setValue('orientation', next ?? '')}
          allowClear={false}
        />
        {/* Chips are never "blurred", so the error shows as soon as it exists
            rather than waiting for a touch that will not come. */}
        {form.errors.orientation ? (
          <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5, mx: 1.75 }}>
            {form.errors.orientation}
          </Typography>
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, mx: 1.75 }}>
            Pick “Any” to let the creator choose what suits the shot.
          </Typography>
        )}
      </Box>

      <ChoiceCardGroup
        name="usageRights"
        label="Where will you use this content?"
        required
        options={USAGE_RIGHTS_OPTIONS}
        columns={2}
        helperText="Creators price against this, so broader rights cost more. Buy what you will actually use."
        disabled={disabled}
        {...form.fieldProps('usageRights')}
      />

      <Divider />

      <Typography variant="subtitle1" component="h3">
        Direction <Typography component="span" color="text.secondary">(optional)</Typography>
      </Typography>

      <FormTextField
        label="Brand guidelines"
        multiline
        minRows={4}
        maxLength={GUIDELINES_MAX}
        placeholder="Colours, tone, lighting, logo placement, anything a creator should match."
        helperText="Paste the essentials — creators cannot see your brand book."
        disabled={disabled}
        {...form.fieldProps('brandGuidelines')}
      />

      <ListEntryInput
        label="Do's"
        placeholder="e.g. Show the bottle in daylight, held in hand"
        maxEntries={MAX_LIST_ENTRIES}
        helperText="One point at a time. Press Enter to add it."
        disabled={disabled}
        {...form.fieldProps('dos')}
      />

      <ListEntryInput
        label="Don'ts"
        placeholder="e.g. No competitor products in frame"
        maxEntries={MAX_LIST_ENTRIES}
        helperText="The things that would send a delivery straight back for revision."
        disabled={disabled}
        {...form.fieldProps('donts')}
      />

      <FormFileField
        label="Reference images"
        accept={REFERENCE_ACCEPT}
        multiple
        maxSizeMb={REFERENCE_MAX_MB}
        maxFiles={Math.max(MAX_REFERENCE_FILES - alreadyAttached, 0)}
        helperText={
          alreadyAttached > 0
            ? `${alreadyAttached} image${alreadyAttached === 1 ? '' : 's'} already saved with this draft. Add up to ${MAX_REFERENCE_FILES} in total — they upload when you save or publish.`
            : `Up to ${MAX_REFERENCE_FILES} examples of the look you are after. They upload when you save or publish.`
        }
        disabled={disabled}
        {...form.fieldProps('referenceFiles')}
      />
    </Stack>
  )
}

/**
 * Plus/minus quantity control. A `type="number"` spinner is unusable on touch
 * and inconsistent across browsers, so this is two 44px buttons around a plain
 * numeric input (00 §13).
 */
function QuantityStepper({
  id,
  name,
  label,
  value,
  onChange,
  onBlur,
  error,
  helperText,
  disabled = false,
  inputRef,
}) {
  const current = Number(value) || QUANTITY_MIN
  const hasError = Boolean(error)
  const message = typeof error === 'string' && error ? error : helperText

  const step = (delta) => {
    const next = Math.min(Math.max(current + delta, QUANTITY_MIN), QUANTITY_MAX)
    onChange?.(next)
  }

  return (
    <Box>
      <FormLabel component="p" required error={hasError} sx={{ mb: 1 }}>
        {label}
      </FormLabel>

      <Stack direction="row" spacing={1} alignItems="center">
        <IconButton
          onClick={() => step(-1)}
          disabled={disabled || current <= QUANTITY_MIN}
          aria-label="One fewer deliverable"
          sx={{ border: 1, borderColor: 'divider', width: 44, height: 44 }}
        >
          <Icon icon="tabler:minus" width={18} />
        </IconButton>

        <FormTextField
          id={id}
          name={name}
          label={null}
          value={String(value ?? '')}
          onChange={(next) => onChange?.(next.replace(/\D/g, ''))}
          onBlur={() => {
            // Clamp on blur rather than on every keystroke, so deleting the
            // digits to retype them does not fight the person typing.
            const clamped = Math.min(Math.max(Number(value) || QUANTITY_MIN, QUANTITY_MIN), QUANTITY_MAX)
            if (clamped !== Number(value)) onChange?.(clamped)
            onBlur?.()
          }}
          error={hasError ? true : undefined}
          disabled={disabled}
          inputRef={inputRef}
          fullWidth={false}
          inputProps={{
            inputMode: 'numeric',
            'aria-label': typeof label === 'string' ? label : 'Quantity',
            style: { textAlign: 'center' },
          }}
          sx={{ width: 96 }}
        />

        <IconButton
          onClick={() => step(1)}
          disabled={disabled || current >= QUANTITY_MAX}
          aria-label="One more deliverable"
          sx={{ border: 1, borderColor: 'divider', width: 44, height: 44 }}
        >
          <Icon icon="tabler:plus" width={18} />
        </IconButton>
      </Stack>

      {message ? (
        <Typography
          variant="caption"
          color={hasError ? 'error' : 'text.secondary'}
          sx={{ display: 'block', mt: 0.75 }}
        >
          {message}
        </Typography>
      ) : null}
    </Box>
  )
}
