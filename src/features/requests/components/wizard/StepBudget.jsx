import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import FormLabel from '@mui/material/FormLabel'
import Stack from '@mui/material/Stack'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import dayjs from 'dayjs'

import CurrencyField from '@/components/inputs/CurrencyField'
import FormDateField from '@/components/inputs/FormDateField'
import { BUDGET_TYPE } from '@/constants/statuses'
import {
  BUDGET_TYPE_OPTIONS,
  MIN_BUDGET,
  MIN_DEADLINE_DAYS,
  earliestDeadline,
} from '@/features/requests/hooks/useRequestWizard'
import { formatDate } from '@/utils/formatters'

// Step 3 — money and time, the two answers creators decide on.

/** "in 12 days" — the reading of a date everyone actually does in their head. */
function deadlineHelper(value) {
  if (!value) return `Pick a date at least ${MIN_DEADLINE_DAYS} days out.`

  const picked = dayjs(value).startOf('day')
  if (!picked.isValid()) return `Pick a date at least ${MIN_DEADLINE_DAYS} days out.`

  const days = picked.diff(dayjs().startOf('day'), 'day')
  if (days < 0) return `${formatDate(value)} — that date has passed.`
  if (days === 0) return `${formatDate(value)} — today.`
  if (days === 1) return `${formatDate(value)} — tomorrow.`
  return `${formatDate(value)} — in ${days} days.`
}

/**
 * @param {object} props
 * @param {object} props.form the wizard's `useForm` instance
 * @param {boolean} [props.disabled=false]
 */
export default function StepBudget({ form, disabled = false }) {
  const { values } = form
  const isRange = values.budgetType === BUDGET_TYPE.RANGE
  const budgetTypeMeta = BUDGET_TYPE_OPTIONS.find((option) => option.value === values.budgetType)

  const changeBudgetType = (next) => {
    // A toggle group returns `null` when the pressed button was already on;
    // there is no "no budget type", so that press is simply ignored.
    if (!next || next === values.budgetType) return
    form.setValue('budgetType', next)
    // Leaving the maximum behind would publish a range of one on a fixed brief.
    if (next === BUDGET_TYPE.FIXED) form.setValue('budgetMax', '')
  }

  return (
    <Stack spacing={3}>
      <Box>
        <FormLabel component="p" required sx={{ mb: 1 }}>
          How is your budget set?
        </FormLabel>
        <ToggleButtonGroup
          exclusive
          value={values.budgetType}
          onChange={(event, next) => changeBudgetType(next)}
          disabled={disabled}
          aria-label="Budget type"
          sx={{ '& .MuiToggleButton-root': { minHeight: 44, px: 3, flex: { xs: 1, sm: '0 0 auto' } }, width: { xs: '100%', sm: 'auto' } }}
        >
          {BUDGET_TYPE_OPTIONS.map((option) => (
            <ToggleButton key={option.value} value={option.value}>
              {option.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {budgetTypeMeta?.description ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
            {budgetTypeMeta.description}
          </Typography>
        ) : null}
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <CurrencyField
          label={isRange ? 'Minimum budget' : 'Budget'}
          required
          helperText={`The floor is $${MIN_BUDGET}.`}
          disabled={disabled}
          {...form.fieldProps('budgetMin')}
        />
        {isRange ? (
          <CurrencyField
            label="Maximum budget"
            required
            helperText="The most you would pay for the strongest proposal."
            disabled={disabled}
            {...form.fieldProps('budgetMax')}
          />
        ) : null}
      </Stack>

      <FormDateField
        label="Deadline"
        required
        minDate={earliestDeadline()}
        disablePast
        helperText={deadlineHelper(values.deadline)}
        disabled={disabled}
        {...form.fieldProps('deadline')}
      />

      <Alert
        severity="info"
        icon={<Icon icon="solar:chart-2-linear" width={22} />}
        sx={{ borderRadius: 2 }}
      >
        <AlertTitle sx={{ mb: 0.5 }}>What to expect</AlertTitle>
        Most requests receive 3–6 proposals in 48 hours. Briefs with a realistic budget and a
        deadline more than a week out tend to attract the strongest creators.
      </Alert>
    </Stack>
  )
}
