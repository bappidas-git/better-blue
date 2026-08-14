import { useState } from 'react'

import { Box, Button, Divider, Paper, Stack, Typography } from '@mui/material'

import { useToast } from '@/components/feedback/ToastProvider'
import CurrencyField from '@/components/inputs/CurrencyField'
import FilterChipGroup from '@/components/inputs/FilterChipGroup'
import FormDateField from '@/components/inputs/FormDateField'
import FormFileField from '@/components/inputs/FormFileField'
import FormSelect from '@/components/inputs/FormSelect'
import FormTextField from '@/components/inputs/FormTextField'
import SearchInput from '@/components/inputs/SearchInput'
import SortSelect from '@/components/inputs/SortSelect'
import StickyActionBar from '@/components/layout/StickyActionBar'
import { CONTENT_TYPE, CATEGORIES_FALLBACK, USAGE_RIGHTS, getStatusMeta } from '@/constants'
import { useForm } from '@/hooks/useForm'
import { compose, maxLength, min, minLength, numeric, required } from '@/utils/validators'
import GalleryBlock from './GalleryBlock'

// Forms tab — toolbar inputs, every `Form*` field, and a `useForm` submission
// proving the validation contract from 00 §12: validate on blur and submit,
// inline messages, first invalid field focused.

const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'budget:desc', label: 'Highest budget' },
  { value: 'proposals:asc', label: 'Fewest proposals' },
]

const STATUS_FILTERS = [
  { value: 'open', label: 'Open', count: 24 },
  { value: 'awarded', label: 'Awarded', count: 8 },
  { value: 'completed', label: 'Completed', count: 132 },
  { value: 'closed', label: 'Closed', count: 11 },
]

const CATEGORY_FILTERS = CATEGORIES_FALLBACK.slice(0, 8).map((category) => ({
  value: category.id,
  label: category.name,
  icon: category.icon,
}))

const CONTENT_TYPE_OPTIONS = Object.values(CONTENT_TYPE).map((value) => ({
  value,
  label: getStatusMeta(value).label,
}))

const USAGE_RIGHTS_OPTIONS = Object.values(USAGE_RIGHTS).map((value) => ({
  value,
  label: getStatusMeta(value).label,
}))

const CATEGORY_OPTIONS = CATEGORIES_FALLBACK.map((category) => ({
  value: category.id,
  label: category.name,
}))

// Declaration order decides which field gets focus on an invalid submit.
const VALIDATORS = {
  title: compose(required('Give the request a title.'), minLength(8), maxLength(80)),
  brief: compose(required('Describe what you need.'), minLength(20)),
  contentType: required('Choose a content type.'),
  categories: required('Pick at least one category.'),
  usageRights: required('Choose the usage rights you need.'),
  deadline: required('Set a delivery deadline.'),
  budget: compose(required('Enter a budget.'), numeric(), min(50, 'Budgets start at $50.')),
  references: required('Attach at least one reference image.'),
}

const INITIAL_VALUES = {
  title: '',
  brief: '',
  contentType: '',
  categories: [],
  usageRights: '',
  deadline: null,
  budget: '',
  references: [],
}

function ToolbarDemo() {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('createdAt:desc')
  const [status, setStatus] = useState('open')
  const [categories, setCategories] = useState([])

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search requests, creators, or brands"
          sx={{ flexGrow: 1 }}
        />
        <SortSelect value={sort} onChange={setSort} options={SORT_OPTIONS} />
      </Stack>

      <Box>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 0.5 }}>
          Single-select — clicking the active chip clears it
        </Typography>
        <FilterChipGroup
          options={STATUS_FILTERS}
          value={status}
          onChange={setStatus}
          label="Filter by status"
        />
      </Box>

      <Box>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 0.5 }}>
          Multi-select — scrolls horizontally below 900px
        </Typography>
        <FilterChipGroup
          options={CATEGORY_FILTERS}
          value={categories}
          onChange={setCategories}
          multiple
          label="Filter by category"
        />
      </Box>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary" component="p">
          Debounced state (300ms)
        </Typography>
        <Typography
          variant="body2"
          sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
        >
          {JSON.stringify({ query, sort, status, categories })}
        </Typography>
      </Paper>
    </Stack>
  )
}

function UseFormDemo() {
  const toast = useToast()
  const [submitted, setSubmitted] = useState(null)

  const form = useForm({ initialValues: INITIAL_VALUES, validators: VALIDATORS })

  const handleSubmit = form.handleSubmit(async (values) => {
    // A service call lives here in real features (00 §10) — the gallery just
    // shows what would be sent.
    setSubmitted({
      ...values,
      references: values.references.map((file) => file.name),
    })
    toast.success('Request published', { description: 'Creators can now send proposals.' })
    form.reset()
  })

  return (
    <Stack spacing={3}>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
          }}
        >
          <FormTextField
            label="Request title"
            required
            maxLength={80}
            helperText="Shown to creators in search results."
            sx={{ gridColumn: { md: 'span 2' } }}
            {...form.fieldProps('title')}
          />

          <FormTextField
            label="Brief"
            required
            multiline
            minRows={4}
            maxLength={600}
            helperText="What are you promoting, and where will the content run?"
            sx={{ gridColumn: { md: 'span 2' } }}
            {...form.fieldProps('brief')}
          />

          <FormSelect
            label="Content type"
            required
            options={CONTENT_TYPE_OPTIONS}
            placeholder="Choose a type"
            {...form.fieldProps('contentType')}
          />

          <FormSelect
            label="Usage rights"
            required
            options={USAGE_RIGHTS_OPTIONS}
            placeholder="Choose usage rights"
            {...form.fieldProps('usageRights')}
          />

          <FormSelect
            label="Categories"
            required
            multiple
            options={CATEGORY_OPTIONS}
            placeholder="Select categories"
            helperText="Up to a few categories keeps matching sharp."
            {...form.fieldProps('categories')}
          />

          <FormDateField
            label="Delivery deadline"
            required
            disablePast
            helperText="Emitted as an ISO date string."
            {...form.fieldProps('deadline')}
          />

          <CurrencyField
            label="Budget"
            required
            helperText="Normalizes to two decimals on blur."
            {...form.fieldProps('budget')}
          />

          <Box sx={{ gridColumn: { md: 'span 2' } }}>
            <FormFileField
              label="Reference images"
              required
              accept="image/*"
              multiple
              maxSizeMb={5}
              maxFiles={4}
              helperText="Mood boards, brand guidelines, or shots you like."
              {...form.fieldProps('references')}
            />
          </Box>
        </Box>

        <StickyActionBar
          position="sticky"
          sx={{ mt: 4, mx: { xs: -2, md: -3 }, px: { xs: 2, md: 3 }, borderRadius: 0 }}
        >
          <Button color="inherit" onClick={() => form.reset()} disabled={form.isSubmitting}>
            Reset
          </Button>
          <Button type="submit" variant="gradient" disabled={form.isSubmitting}>
            {form.isSubmitting ? 'Publishing…' : 'Publish request'}
          </Button>
        </StickyActionBar>
      </Box>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary" component="p">
          Form state — errors appear on blur and on submit; an invalid submit focuses the first
          errored field (validator declaration order).
        </Typography>
        <Typography
          variant="body2"
          sx={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {JSON.stringify(
            {
              isValid: form.isValid,
              isSubmitting: form.isSubmitting,
              errors: form.errors,
              touched: Object.keys(form.touched).filter((key) => form.touched[key]),
            },
            null,
            2
          )}
        </Typography>
      </Paper>

      {submitted ? (
        <Paper variant="outlined" sx={{ p: 2, borderColor: 'success.main' }}>
          <Typography variant="caption" color="text.secondary" component="p">
            Last valid submission
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {JSON.stringify(submitted, null, 2)}
          </Typography>
        </Paper>
      ) : null}
    </Stack>
  )
}

function FieldStatesDemo() {
  const [value, setValue] = useState('')

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 3,
        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
      }}
    >
      <FormTextField
        label="With helper text"
        value={value}
        onChange={setValue}
        helperText="Helper copy sits under the field."
      />
      <FormTextField
        label="With an error"
        value="Too short"
        onChange={() => {}}
        error="Use at least 20 characters."
      />
      <FormTextField label="Disabled" value="Read-only value" onChange={() => {}} disabled />
      <FormTextField
        label="Dense (size=small)"
        value=""
        onChange={() => {}}
        size="small"
        helperText="Still 44px tall for touch."
      />
      <CurrencyField label="Currency — disabled" value="1250.00" onChange={() => {}} disabled />
      <FormFileField
        label="Single file, PDF only, 2 MB"
        value={[]}
        onChange={() => {}}
        accept="application/pdf,.pdf"
        maxSizeMb={2}
        helperText="Try dropping an image here to see the inline rejection."
      />
    </Box>
  )
}

export default function FormsGallery() {
  return (
    <Stack spacing={{ xs: 6, md: 8 }} divider={<Divider />}>
      <GalleryBlock
        title="List toolbar"
        caption="SearchInput (debounced 300ms), SortSelect, and FilterChipGroup — the toolbar every list page assembles from 00 §12."
      >
        <ToolbarDemo />
      </GalleryBlock>

      <GalleryBlock
        title="useForm + validators"
        caption="A full content-request form wired to useForm. Submit it empty to see inline errors and focus land on the title field; fill it in to see the payload a service would receive."
      >
        <UseFormDemo />
      </GalleryBlock>

      <GalleryBlock
        title="Field states"
        caption="Helper, error, disabled, dense, and file rejection — the states every Form* field shares."
      >
        <FieldStatesDemo />
      </GalleryBlock>
    </Stack>
  )
}
