import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'

import FormSelect from '@/components/inputs/FormSelect'
import FormTextField from '@/components/inputs/FormTextField'
import ChoiceCardGroup from '@/features/requests/components/wizard/ChoiceCardGroup'
import {
  CONTENT_TYPE_OPTIONS,
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  TITLE_MAX,
  TITLE_MIN,
} from '@/features/requests/hooks/useRequestWizard'

// Step 1 — what this brief is. Presentational: every value and every rule
// arrives through `form` from `useRequestWizard` (00 §16.9).

/** What a good description covers, spelled out rather than left to guesswork. */
const DESCRIPTION_GUIDANCE =
  'Include the product or service, who it is for, the style you are after, and where it will be shot or set. ' +
  `Between ${DESCRIPTION_MIN} and ${DESCRIPTION_MAX} characters.`

/**
 * @param {object} props
 * @param {object} props.form the wizard's `useForm` instance
 * @param {{value: string, label: string}[]} props.categoryOptions from the categories API
 * @param {boolean} [props.categoriesLoading=false] show a placeholder instead of an empty select
 * @param {boolean} [props.disabled=false]
 */
export default function StepBasics({
  form,
  categoryOptions = [],
  categoriesLoading = false,
  disabled = false,
}) {
  return (
    <Stack spacing={3}>
      <FormTextField
        label="Request title"
        required
        maxLength={TITLE_MAX}
        placeholder="e.g. 15 lifestyle photos for our new eco water bottle"
        helperText={`What you need and how much of it, in ${TITLE_MIN}–${TITLE_MAX} characters. This is the headline creators browse.`}
        disabled={disabled}
        {...form.fieldProps('title')}
      />

      {categoriesLoading ? (
        <Skeleton
          variant="rounded"
          height={56}
          role="status"
          aria-label="Loading categories"
        />
      ) : (
        <FormSelect
          label="Category"
          required
          placeholder="Choose a category"
          options={categoryOptions}
          helperText="Creators filter the board by category, so this decides who sees your brief first."
          disabled={disabled}
          {...form.fieldProps('categoryId')}
        />
      )}

      <ChoiceCardGroup
        name="contentType"
        label="What do you need made?"
        required
        options={CONTENT_TYPE_OPTIONS}
        columns={3}
        disabled={disabled}
        {...form.fieldProps('contentType')}
      />

      <FormTextField
        label="Describe the content you need"
        required
        multiline
        minRows={6}
        maxLength={DESCRIPTION_MAX}
        helperText={DESCRIPTION_GUIDANCE}
        disabled={disabled}
        {...form.fieldProps('description')}
      />
    </Stack>
  )
}
