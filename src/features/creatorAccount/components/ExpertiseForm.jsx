import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormGroup from '@mui/material/FormGroup'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import CurrencyField from '@/components/inputs/CurrencyField'
import FormSelect from '@/components/inputs/FormSelect'
import { CONTENT_TYPE, getStatusMeta } from '@/constants/statuses'
import { formatCurrency } from '@/utils/formatters'

// What this creator does, at what price — the three fields discovery actually
// filters on (contract §6.4), grouped so they are chosen together rather than
// scattered down a long form.
//
// Categories and content types are what put a storefront in front of the right
// briefs; the starting price is what a buyer compares before they open it. All
// three come from constants or the API, never from free text, so a storefront
// can never be filed under a category the marketplace does not have.

/** The most categories one storefront may claim (§5). */
export const MAX_CATEGORIES = 4

/** Floor for `startingPrice`, in the platform currency (§13). */
export const MIN_STARTING_PRICE = 25

/** Content types a creator can offer, in the order the request wizard lists them. */
const CONTENT_TYPE_ORDER = [CONTENT_TYPE.PHOTO, CONTENT_TYPE.VIDEO, CONTENT_TYPE.BUNDLE]

/**
 * @param {object} props
 * @param {object} props.form the `useForm` instance owning `categories`,
 *   `contentTypes`, and `startingPrice`
 * @param {object[]} [props.categories=[]] active categories from `categoryService`
 * @param {boolean} [props.categoriesLoading=false] render a skeleton for the select
 * @param {string} [props.currency='USD'] ISO 4217 code for the price helper text
 * @param {boolean} [props.disabled=false] disable while the form is saving
 */
export default function ExpertiseForm({
  form,
  categories = [],
  categoriesLoading = false,
  currency = 'USD',
  disabled = false,
}) {
  const selectedCategories = form.values.categories ?? []
  const selectedContentTypes = form.values.contentTypes ?? []
  const isAtCategoryLimit = selectedCategories.length >= MAX_CATEGORIES

  const categoryOptions = categories.map((category) => ({
    value: category.id,
    label: category.name,
    // The cap is enforced by disabling what cannot be added rather than by
    // silently truncating a selection — the limit is visible before it bites.
    disabled: isAtCategoryLimit && !selectedCategories.includes(category.id),
  }))

  const toggleContentType = (value) => {
    const next = selectedContentTypes.includes(value)
      ? selectedContentTypes.filter((entry) => entry !== value)
      : [...selectedContentTypes, value]
    form.setValue('contentTypes', next)
  }

  return (
    <Stack spacing={3}>
      {categoriesLoading ? (
        <Skeleton
          variant="rounded"
          role="status"
          aria-busy="true"
          aria-label="Loading categories"
          sx={{ height: 56 }}
        />
      ) : (
        <FormSelect
          label="Categories"
          multiple
          required
          options={categoryOptions}
          disabled={disabled}
          helperText={
            form.errors.categories
              ? undefined
              : `Pick up to ${MAX_CATEGORIES}. Briefs in these categories show up on your dashboard. ` +
                `${selectedCategories.length} of ${MAX_CATEGORIES} chosen.`
          }
          {...form.fieldProps('categories')}
        />
      )}

      <FormControl
        component="fieldset"
        error={Boolean(form.errors.contentTypes)}
        disabled={disabled}
      >
        <FormLabel component="legend" sx={{ typography: 'body2', mb: 0.5 }}>
          Content types you offer
        </FormLabel>
        <FormGroup row>
          {CONTENT_TYPE_ORDER.map((value) => (
            <FormControlLabel
              key={value}
              control={
                <Checkbox
                  checked={selectedContentTypes.includes(value)}
                  onChange={() => toggleContentType(value)}
                  disabled={disabled}
                />
              }
              label={getStatusMeta(value).label}
            />
          ))}
        </FormGroup>
        <FormHelperText>
          {form.errors.contentTypes ??
            'A bundle is photo and video delivered together from one shoot.'}
        </FormHelperText>
      </FormControl>

      <CurrencyField
        label="Starting price"
        required
        disabled={disabled}
        helperText={
          form.errors.startingPrice
            ? undefined
            : `The lowest you would take on a brief — buyers see "from ${formatCurrency(
                Math.max(Number(form.values.startingPrice) || 0, MIN_STARTING_PRICE),
                currency,
                { hideDecimals: true }
              )}" on your card. Minimum ${formatCurrency(MIN_STARTING_PRICE, currency, {
                hideDecimals: true,
              })}.`
        }
        {...form.fieldProps('startingPrice')}
      />

      <Stack direction="row" spacing={1.25} alignItems="flex-start">
        <Box aria-hidden="true" sx={{ display: 'flex', color: 'text.secondary', mt: 0.25 }}>
          <Icon icon="solar:info-circle-linear" width={18} />
        </Box>
        <Typography variant="caption" color="text.secondary">
          Your rating, completed order count, and response time are calculated from your work on
          BetterBlue and cannot be edited here.
        </Typography>
      </Stack>
    </Stack>
  )
}
