import { useEffect, useMemo, useRef, useState } from 'react'

import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormGroup from '@mui/material/FormGroup'
import Skeleton from '@mui/material/Skeleton'
import Slider from '@mui/material/Slider'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'

import FilterChipGroup from '@/components/inputs/FilterChipGroup'
import useDebounce from '@/hooks/useDebounce'
import { formatCurrency } from '@/utils/formatters'

import {
  CONTENT_TYPE_OPTIONS,
  CREATOR_PARAM,
  PRICE_RANGE,
  RATING_OPTIONS,
  readPriceRange,
} from '../utils/creatorFilters'

// The filter form itself — rendered in the desktop rail and, unchanged, inside
// the mobile `FilterSheet`. One implementation, so the two can never drift.
//
// Presentational throughout: it reads the parsed values it is given and reports
// patches back. Nothing here knows about the URL, the service, or paging.

/** Placeholder rows while the taxonomy loads. */
const CATEGORY_SKELETONS = 6

/**
 * Quiet period before a slider position reaches the URL. Every other control
 * here commits on the click, but a slider emits a *stream* of values — and on
 * the keyboard, MUI treats each arrow press as a settled change. Writing each
 * one would push a history entry per step and turn the back button into an
 * undo-by-$20 machine. One entry per adjustment is what a person means.
 */
const PRICE_COMMIT_DELAY_MS = 350

/** Slider marks: the ends plus the midpoint, enough to orient without clutter. */
const PRICE_MARKS = [
  { value: PRICE_RANGE.min },
  { value: PRICE_RANGE.max / 2 },
  { value: PRICE_RANGE.max },
]

const priceLabel = (value) => {
  const amount = formatCurrency(value, undefined, { hideDecimals: true })
  return value >= PRICE_RANGE.max ? `${amount}+` : amount
}

function FilterSection({ title, id, children }) {
  return (
    <Box component="section" aria-labelledby={id}>
      <Typography
        id={id}
        variant="subtitle2"
        component="h3"
        sx={{ mb: 1.5, fontWeight: 700 }}
      >
        {title}
      </Typography>
      {children}
    </Box>
  )
}

/**
 * @param {object} props
 * @param {object} props.values parsed discovery values
 * @param {(patch: object) => void} props.onChange reports changed parameters
 * @param {object[]} [props.categories] active categories from the API
 * @param {boolean} [props.isCategoriesLoading=false] taxonomy request in flight
 * @param {string} [props.idPrefix='filters'] disambiguates label ids when the
 *   rail and the sheet are both mounted
 */
export default function FilterRail({
  values,
  onChange,
  categories = [],
  isCategoriesLoading = false,
  idPrefix = 'filters',
}) {
  const selectedCategories = values[CREATOR_PARAM.CATEGORY]
  const [priceMin, priceMax] = readPriceRange(values)
  const committedPrice = useMemo(() => [priceMin, priceMax], [priceMin, priceMax])

  // The handle tracks locally so dragging stays at pointer speed, and the
  // settled value is what reaches the URL.
  const [draftPrice, setDraftPrice] = useState(committedPrice)
  const debouncedPrice = useDebounce(draftPrice, PRICE_COMMIT_DELAY_MS)

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  /**
   * Whether the draft is the person's, rather than the URL's. Without it the
   * debounced value outlives the state that produced it: a back navigation
   * would land on the previous range, then the stale draft would settle and
   * push the range straight back — leaving the back button unable to escape.
   */
  const isDragging = useRef(false)

  // The URL is the source of truth: a "Clear all", a back navigation, or a
  // shared link resets the handle rather than the other way round.
  useEffect(() => {
    isDragging.current = false
    setDraftPrice(committedPrice)
  }, [committedPrice])

  useEffect(() => {
    if (!isDragging.current) return
    isDragging.current = false

    const [low, high] = debouncedPrice
    if (low === committedPrice[0] && high === committedPrice[1]) return

    onChangeRef.current({
      [CREATOR_PARAM.PRICE_MIN]: low,
      [CREATOR_PARAM.PRICE_MAX]: high,
    })
  }, [debouncedPrice, committedPrice])

  const toggleCategory = (categoryId) => {
    const next = selectedCategories.includes(categoryId)
      ? selectedCategories.filter((id) => id !== categoryId)
      : [...selectedCategories, categoryId]
    onChange({ [CREATOR_PARAM.CATEGORY]: next })
  }

  return (
    <Stack spacing={3} divider={<Divider />}>
      <FilterSection title="Category" id={`${idPrefix}-category`}>
        {isCategoriesLoading ? (
          <Stack spacing={1.25}>
            {Array.from({ length: CATEGORY_SKELETONS }, (_, index) => (
              <Skeleton key={index} variant="text" width="80%" height={24} />
            ))}
          </Stack>
        ) : (
          <FormGroup>
            {categories.map((category) => (
              <FormControlLabel
                key={category.id}
                control={
                  <Checkbox
                    size="small"
                    checked={selectedCategories.includes(category.id)}
                    onChange={() => toggleCategory(category.id)}
                  />
                }
                label={<Typography variant="body2">{category.name}</Typography>}
                sx={{ mr: 0, py: 0.25 }}
              />
            ))}
          </FormGroup>
        )}
      </FilterSection>

      <FilterSection title="Content type" id={`${idPrefix}-content-type`}>
        <FilterChipGroup
          multiple
          size="sm"
          label="Content type"
          options={CONTENT_TYPE_OPTIONS}
          value={values[CREATOR_PARAM.CONTENT_TYPE]}
          onChange={(next) => onChange({ [CREATOR_PARAM.CONTENT_TYPE]: next })}
          sx={{ flexWrap: 'wrap', overflowX: 'visible' }}
        />
      </FilterSection>

      <FilterSection title="Starting price" id={`${idPrefix}-price`}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {priceLabel(draftPrice[0])} – {priceLabel(draftPrice[1])}
        </Typography>
        <Box sx={{ px: 1 }}>
          <Slider
            value={draftPrice}
            onChange={(event, next) => {
              isDragging.current = true
              setDraftPrice(next)
            }}
            min={PRICE_RANGE.min}
            max={PRICE_RANGE.max}
            step={PRICE_RANGE.step}
            marks={PRICE_MARKS}
            valueLabelDisplay="auto"
            valueLabelFormat={priceLabel}
            getAriaLabel={(index) => (index === 0 ? 'Minimum starting price' : 'Maximum starting price')}
            getAriaValueText={priceLabel}
            disableSwap
            sx={{
              // MUI's 12px thumb is under the 44px touch target (00 §13); the
              // padded track keeps the whole control comfortably grabbable.
              py: 2,
              '& .MuiSlider-thumb': { width: 20, height: 20 },
            }}
          />
        </Box>
      </FilterSection>

      <FilterSection title="Minimum rating" id={`${idPrefix}-rating`}>
        <FilterChipGroup
          size="sm"
          label="Minimum rating"
          options={RATING_OPTIONS.map((option) => ({
            value: String(option.value),
            label: option.label,
            icon: 'tabler:star-filled',
          }))}
          value={
            values[CREATOR_PARAM.RATING] === null ? null : String(values[CREATOR_PARAM.RATING])
          }
          onChange={(next) =>
            onChange({ [CREATOR_PARAM.RATING]: next === null ? null : Number(next) })
          }
          sx={{ flexWrap: 'wrap', overflowX: 'visible' }}
        />
      </FilterSection>

      <FilterSection title="Availability" id={`${idPrefix}-availability`}>
        <FormControlLabel
          control={
            <Switch
              checked={values[CREATOR_PARAM.AVAILABLE]}
              onChange={(event) =>
                onChange({ [CREATOR_PARAM.AVAILABLE]: event.target.checked })
              }
            />
          }
          label={<Typography variant="body2">Available for new work</Typography>}
          sx={{ mr: 0 }}
        />
      </FilterSection>
    </Stack>
  )
}
