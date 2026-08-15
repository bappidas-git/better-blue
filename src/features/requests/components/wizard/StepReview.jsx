import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormHelperText from '@mui/material/FormHelperText'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { visuallyHidden } from '@mui/utils'
import { Link as RouterLink } from 'react-router-dom'

import KeyValueList from '@/components/data-display/KeyValueList'
import { BUDGET_TYPE, getStatusMeta } from '@/constants/statuses'
import { STEP_INDEX } from '@/features/requests/hooks/useRequestWizard'
import { paths } from '@/routes/paths'
import { EMPTY_PLACEHOLDER, formatCurrency, formatDate } from '@/utils/formatters'

// Step 4 — the whole brief, read back plainly, with a way into any answer that
// looks wrong and the Content Policy acknowledgment that gates publishing.

/** Card wrapper with the "Edit" jump link its step is reached through. */
function SummaryCard({ title, stepKey, onEdit, disabled, children }) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 2 }}
        >
          <Typography variant="subtitle1" component="h3">
            {title}
          </Typography>
          <Button
            size="small"
            onClick={() => onEdit(STEP_INDEX[stepKey])}
            disabled={disabled}
            startIcon={<Icon icon="tabler:pencil" width={16} aria-hidden="true" />}
          >
            Edit
            {/* Four buttons all reading "Edit" are useless in a screen
                reader's button list — each says which card it edits. */}
            <Box component="span" sx={visuallyHidden}>{` ${title}`}</Box>
          </Button>
        </Stack>
        {children}
      </CardContent>
    </Card>
  )
}

/** A list of points, or the em-dash that means "nothing was said here". */
function PointList({ entries }) {
  if (!entries?.length) return EMPTY_PLACEHOLDER
  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
      {entries.map((entry) => (
        <Chip key={entry} label={entry} size="small" variant="outlined" />
      ))}
    </Stack>
  )
}

/** `label` of an enum value, or the placeholder while it is unanswered. */
const metaLabel = (value) => (value ? getStatusMeta(value).label : EMPTY_PLACEHOLDER)

/**
 * @param {object} props
 * @param {object} props.form the wizard's `useForm` instance
 * @param {(index: number) => void} props.onEditStep jump back to a step
 * @param {string} [props.categoryLabel] the chosen category's display name
 * @param {object} [props.invitedCreator] the `?creator=` profile, when resolved
 * @param {boolean} [props.disabled=false] freeze the step while publishing
 */
export default function StepReview({
  form,
  onEditStep,
  categoryLabel,
  invitedCreator,
  disabled = false,
}) {
  const { values } = form
  const policyError = form.touched.policyAck ? form.errors.policyAck : undefined

  const budget =
    values.budgetType === BUDGET_TYPE.RANGE
      ? `${formatCurrency(values.budgetMin)} – ${formatCurrency(values.budgetMax)}`
      : formatCurrency(values.budgetMin)

  const referenceCount =
    (values.referenceFiles?.length ?? 0) + (values.referenceUrls?.length ?? 0)

  return (
    <Stack spacing={2.5}>
      <SummaryCard title="Basics" stepKey="basics" onEdit={onEditStep} disabled={disabled}>
        <KeyValueList
          divided
          labelWidth={160}
          items={[
            { label: 'Title', value: values.title || EMPTY_PLACEHOLDER },
            { label: 'Category', value: categoryLabel || EMPTY_PLACEHOLDER },
            { label: 'Content type', value: metaLabel(values.contentType) },
            {
              label: 'Description',
              value: (
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                  {values.description || EMPTY_PLACEHOLDER}
                </Typography>
              ),
            },
          ]}
        />
      </SummaryCard>

      <SummaryCard
        title="Specifications"
        stepKey="specs"
        onEdit={onEditStep}
        disabled={disabled}
      >
        <KeyValueList
          divided
          labelWidth={160}
          items={[
            { label: 'Quantity', value: `${values.quantity} deliverable${Number(values.quantity) === 1 ? '' : 's'}` },
            ...(values.videoDurationSec
              ? [{ label: 'Clip length', value: `${values.videoDurationSec} seconds` }]
              : []),
            { label: 'Framing', value: metaLabel(values.orientation) },
            {
              label: 'Usage rights',
              // The plain-language line belongs with the value it explains —
              // `hint` sits under the *label* column, which would read as a
              // description of the question rather than of the answer.
              value: (
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {metaLabel(values.usageRights)}
                  </Typography>
                  {values.usageRights ? (
                    <Typography variant="caption" color="text.secondary">
                      {getStatusMeta(values.usageRights).description}
                    </Typography>
                  ) : null}
                </Box>
              ),
            },
            {
              label: 'Brand guidelines',
              value: (
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                  {values.brandGuidelines || EMPTY_PLACEHOLDER}
                </Typography>
              ),
            },
            { label: "Do's", value: <PointList entries={values.dos} /> },
            { label: "Don'ts", value: <PointList entries={values.donts} /> },
            {
              label: 'References',
              value:
                referenceCount > 0
                  ? `${referenceCount} image${referenceCount === 1 ? '' : 's'}`
                  : EMPTY_PLACEHOLDER,
            },
          ]}
        />
      </SummaryCard>

      <SummaryCard
        title="Budget & timeline"
        stepKey="budget"
        onEdit={onEditStep}
        disabled={disabled}
      >
        <KeyValueList
          divided
          labelWidth={160}
          items={[
            { label: 'Budget', value: budget, hint: metaLabel(values.budgetType) },
            {
              label: 'Deadline',
              value: values.deadline ? formatDate(values.deadline) : EMPTY_PLACEHOLDER,
            },
          ]}
        />
      </SummaryCard>

      {invitedCreator ? (
        <Card variant="outlined" sx={{ bgcolor: 'primary.surface', borderColor: 'primary.light' }}>
          <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <Box aria-hidden="true" sx={{ color: 'primary.main', display: 'flex', mt: 0.25 }}>
                <Icon icon="solar:user-check-rounded-linear" width={22} />
              </Box>
              <Box>
                <Typography variant="subtitle2" component="p">
                  {invitedCreator.displayName ?? 'This creator'} will see an invitation
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  You came here from their profile, so their proposal is flagged as invited. Your
                  brief still goes to the whole marketplace, and you choose freely between every
                  proposal you receive.
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      <Card variant="outlined" sx={{ borderColor: policyError ? 'error.main' : 'divider' }}>
        <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
          <FormControlLabel
            sx={{ alignItems: 'flex-start', m: 0 }}
            control={
              <Checkbox
                id="field-policyAck"
                name="policyAck"
                checked={Boolean(values.policyAck)}
                onChange={(event) => form.setValue('policyAck', event.target.checked)}
                onBlur={() => form.handleBlur('policyAck')}
                disabled={disabled}
                inputRef={form.registerField('policyAck')}
                inputProps={{ 'aria-describedby': policyError ? 'policyAck-error' : undefined }}
                sx={{ mt: -1 }}
              />
            }
            label={
              <Typography variant="body2" component="span">
                This request complies with the BetterBlue{' '}
                <Link
                  component={RouterLink}
                  to={paths.CONTENT_POLICY}
                  target="_blank"
                  rel="noopener"
                >
                  Content Policy
                </Link>
                {' '}— commercial marketing content only.
              </Typography>
            }
          />
          {policyError ? (
            <FormHelperText id="policyAck-error" error sx={{ mx: 0, mt: 1 }}>
              {policyError}
            </FormHelperText>
          ) : null}
        </CardContent>
      </Card>
    </Stack>
  )
}
