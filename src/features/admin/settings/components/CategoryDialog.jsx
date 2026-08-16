import { useEffect, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'

import FormTextField from '@/components/inputs/FormTextField'
import ResponsiveDialog from '@/components/layout/ResponsiveDialog'
import { SETTINGS_BOUNDS } from '@/features/admin/settings/utils/settingsSchema'
import useForm from '@/hooks/useForm'
import { slugify } from '@/services/categoryService'
import { compose, maxLength, minLength, pattern, required } from '@/utils/validators'

// Add / edit a marketplace category — Prompt 35 §4.7.
//
// Three things this form does that a plain three-field dialog would not:
//
//   1. **The slug follows the name until somebody touches it.** A slug is the
//      category's public web address, so it has to be editable — but making
//      every author invent one is how you end up with `food-and-bev-2`. It is
//      derived as they type and stops the moment they edit it by hand.
//   2. **The icon is previewed live.** Iconify names are typed, not picked, and
//      a wrong one renders as nothing at all — so the preview is the only way
//      to know a name is real before saving it (§12: the preview has its text
//      name beside it, it is not the only label).
//   3. **Active is a decision, not a default.** A category created inactive is
//      how you stage a taxonomy change without exposing it mid-edit.

/** Icon names worth suggesting — every one is used by a seeded category. */
const ICON_SUGGESTIONS = [
  'tabler:tools-kitchen-2',
  'tabler:shirt',
  'tabler:sparkles',
  'tabler:barbell',
  'tabler:plane',
  'tabler:device-laptop',
  'tabler:shopping-bag',
  'tabler:sofa',
  'tabler:car',
  'tabler:school',
  'tabler:building-community',
  'tabler:confetti',
]

const SLUG_RULE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {(values: object) => Promise<void>} props.onSubmit resolves when saved;
 *   rejects with an `ApiError` whose `details.slug` lands under the slug field
 * @param {object} [props.category] the row being edited — omit to add one
 */
export default function CategoryDialog({ open, onClose, onSubmit, category }) {
  const isEdit = Boolean(category)
  const [slugEdited, setSlugEdited] = useState(false)

  const form = useForm({
    initialValues: { name: '', slug: '', icon: '', active: true },
    validators: {
      name: compose(
        required('Give the category a name.'),
        minLength(SETTINGS_BOUNDS.categoryName.min),
        maxLength(SETTINGS_BOUNDS.categoryName.max)
      ),
      slug: compose(
        required('A category needs a web address.'),
        pattern(
          SLUG_RULE,
          'Use lowercase letters, numbers, and single hyphens — for example “food-beverage”.'
        )
      ),
      icon: required('Name an icon so the category is recognisable at a glance.'),
    },
  })

  const { reset } = form

  // Re-seeded every time the dialog opens, so editing one category and then
  // another does not carry the first one's values across.
  useEffect(() => {
    if (!open) return
    reset({
      name: category?.name ?? '',
      slug: category?.slug ?? '',
      icon: category?.icon ?? '',
      active: category?.active !== false,
    })
    setSlugEdited(Boolean(category))
  }, [category, open, reset])

  const onNameChange = (value) => {
    form.setValue('name', value)
    if (!slugEdited) form.setValue('slug', slugify(value))
  }

  const submit = form.handleSubmit(async (values, helpers) => {
    try {
      await onSubmit({
        name: values.name.trim(),
        slug: values.slug.trim(),
        icon: values.icon.trim(),
        active: Boolean(values.active),
      })
    } catch (failure) {
      // A duplicate slug is the one failure the reader can fix here, so it is
      // shown under the field rather than only in a toast (§13).
      const slugMessage = failure?.details?.slug
      helpers.setError('slug', Array.isArray(slugMessage) ? slugMessage[0] : slugMessage)
    }
  })

  const iconName = String(form.values.icon ?? '').trim()

  return (
    <ResponsiveDialog
      open={open}
      onClose={form.isSubmitting ? undefined : onClose}
      title={isEdit ? `Edit ${category.name}` : 'Add a category'}
      description={
        isEdit
          ? 'Renaming a category changes it everywhere it appears, including on requests and orders that already use it.'
          : 'A new category is offered in every request brief, creator profile, and discovery filter as soon as it is active.'
      }
      maxWidth="sm"
      actions={
        <>
          <Button onClick={onClose} color="inherit" disabled={form.isSubmitting} sx={{ minHeight: 44 }}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            variant="gradient"
            disabled={form.isSubmitting}
            sx={{ minHeight: 44 }}
          >
            {form.isSubmitting ? 'Saving…' : isEdit ? 'Save category' : 'Add category'}
          </Button>
        </>
      }
    >
      <Stack component="form" onSubmit={submit} spacing={2.5} noValidate>
        <FormTextField
          label="Name"
          required
          maxLength={SETTINGS_BOUNDS.categoryName.max}
          helperText="What buyers and creators read in every category list."
          {...form.fieldProps('name')}
          onChange={onNameChange}
        />

        <FormTextField
          label="Web address"
          required
          helperText={
            slugEdited
              ? 'Used in links and filters. It must be unique across every category.'
              : 'Generated from the name — edit it and it stops following.'
          }
          startAdornment={
            <Box component="span" sx={{ color: 'text.secondary', mr: 0.5 }}>
              /
            </Box>
          }
          {...form.fieldProps('slug')}
          onChange={(value) => {
            setSlugEdited(true)
            form.setValue('slug', value)
          }}
        />

        <Box>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <Box
              sx={{
                flexShrink: 0,
                mt: 0.5,
                width: 56,
                height: 56,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                border: 1,
                borderColor: 'divider',
                bgcolor: 'primary.surface',
                color: 'primary.main',
              }}
            >
              {iconName ? (
                <Icon icon={iconName} width={26} aria-hidden="true" />
              ) : (
                <Icon icon="tabler:question-mark" width={22} aria-hidden="true" />
              )}
            </Box>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <FormTextField
                label="Icon"
                required
                helperText="An Iconify name from the tabler or solar sets. The tile on the left previews it — an empty tile means the name does not exist."
                {...form.fieldProps('icon')}
              />
            </Box>
          </Stack>

          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5, mb: 0.75 }}>
            Suggestions
          </Typography>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            {ICON_SUGGESTIONS.map((suggestion) => (
              <Chip
                key={suggestion}
                icon={<Icon icon={suggestion} width={16} aria-hidden="true" />}
                label={suggestion.replace('tabler:', '')}
                size="small"
                variant={iconName === suggestion ? 'filled' : 'outlined'}
                color={iconName === suggestion ? 'primary' : 'default'}
                onClick={() => form.setValue('icon', suggestion)}
                sx={{ height: 28 }}
              />
            ))}
          </Stack>
        </Box>

        <FormControlLabel
          control={
            <Switch
              checked={Boolean(form.values.active)}
              onChange={(event) => form.setValue('active', event.target.checked)}
              inputProps={{ 'aria-label': 'Category is active' }}
            />
          }
          label={
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {form.values.active ? 'Active' : 'Inactive'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {form.values.active
                  ? 'Offered in new briefs, profiles, and filters.'
                  : 'Hidden from new selections. Existing content keeps it.'}
              </Typography>
            </Box>
          }
          sx={{ minHeight: 44, ml: 0, alignItems: 'flex-start' }}
        />
      </Stack>
    </ResponsiveDialog>
  )
}
