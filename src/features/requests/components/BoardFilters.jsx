import { useEffect, useRef, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormGroup from '@mui/material/FormGroup'
import Skeleton from '@mui/material/Skeleton'
import Slider from '@mui/material/Slider'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'

import { visuallyHidden } from '@mui/utils'
import FilterChipGroup from '@/components/inputs/FilterChipGroup'
import useDebounce from '@/hooks/useDebounce'
import { formatCurrency } from '@/utils/formatters'

import {
  BOARD_PARAM,
  BUDGET_RANGE,
  CONTENT_TYPE_OPTIONS,
  DEADLINE_OPTIONS,
} from '../utils/boardFilters'

// The board's filter form — rendered in the desktop rail and, unchanged, inside
// the mobile sheet. One implementation, so the two can never drift (the shape
// `FilterRail` established for creator discovery in Prompt 12).
//
// Presentational throughout: it reads the parsed values it is given and reports
// patches back. Nothing here knows about the URL, the service, or paging.

/** Placeholder rows while the taxonomy loads. */
const CATEGORY_SKELETONS = 6

/**
 * Quiet period before a slider position reaches the URL. Every other control
 * commits on the click, but a slider emits a *stream* of values — and on the
 * keyboard MUI treats each arrow press as a settled change. Writing each one
 * would push a history entry per step.
 */
const BUDGET_COMMIT_DELAY_MS = 350

const BUDGET_MARKS = [
  { value: BUDGET_RANGE.min },
  { value: BUDGET_RANGE.max / 2 },
  { value: BUDGET_RANGE.max },
]

const money = (value) => formatCurrency(value, undefined, { hideDecimals: true })

const budgetLabel = (value) =>
  value <= BUDGET_RANGE.min ? 'Any budget' : `${money(value)}+`

function FilterSection({ title, id, children }) {
  return (
    <Box component="section" aria-labelledby={id}>
      <Typography id={id} variant="subtitle2" component="h3" sx={{ mb: 1.5, fontWeight: 700 }}>
        {title}
      </Typography>
      {children}
    </Box>
  )
}

/**
 * @param {object} props
 * @param {object} props.values parsed board values
 * @param {(patch: object) => void} props.onChange reports changed parameters
 * @param {object[]} [props.categories] active categories from the API
 * @param {boolean} [props.isCategoriesLoading=false] taxonomy request in flight
 * @param {boolean} [props.showInvited=false] render the "Invited to you" switch —
 *   only when the viewer is a creator who actually has invitations
 * @param {string} [props.idPrefix='board-filters'] disambiguates label ids when
 *   the rail and the sheet are both mounted
 */
export default function BoardFilters({
  values,
  onChange,
  categories = [],
  isCategoriesLoading = false,
  showInvited = false,
  idPrefix = 'board-filters',
}) {
  const selectedCategories = values[BOARD_PARAM.CATEGORY]
  const committedBudget = values[BOARD_PARAM.BUDGET_MIN]

  // The handle tracks locally so dragging stays at pointer speed; the settled
  // value is what reaches the URL.
  const [draftBudget, setDraftBudget] = useState(committedBudget)
  const debouncedBudget = useDebounce(draftBudget, BUDGET_COMMIT_DELAY_MS)

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  /**
   * Whether the draft is the person's rather than the URL's. Without it the
   * debounced value outlives the state that produced it, and a back navigation
   * would be pushed straight forward again by the stale draft settling.
   */
  const isDragging = useRef(false)

  useEffect(() => {
    isDragging.current = false
    setDraftBudget(committedBudget)
  }, [committedBudget])

  useEffect(() => {
    if (!isDragging.current) return
    isDragging.current = false
    if (debouncedBudget === committedBudget) return
    onChangeRef.current({ [BOARD_PARAM.BUDGET_MIN]: debouncedBudget })
  }, [debouncedBudget, committedBudget])

  const toggleCategory = (categoryId) => {
    const next = selectedCategories.includes(categoryId)
      ? selectedCategories.filter((id) => id !== categoryId)
      : [...selectedCategories, categoryId]
    onChange({ [BOARD_PARAM.CATEGORY]: next })
  }

  return (
    <Stack spacing={3} divider={<Divider />}>
      {/* The rail's own level in the outline. Without it the page jumps
          straight from its `h1` to the `h3` of the first filter group
          (00 §13). Visually hidden — the divider and the layout already say
          "filters" to anyone who can see them. */}
      <Typography component="h2" sx={visuallyHidden}>
        Filters
      </Typography>

      {showInvited ? (
        <FilterSection title="Invitations" id={`${idPrefix}-invited`}>
          <FormControlLabel
            control={
              <Switch
                checked={values[BOARD_PARAM.INVITED]}
                onChange={(event) => onChange({ [BOARD_PARAM.INVITED]: event.target.checked })}
              />
            }
            label={<Typography variant="body2">Invited to you only</Typography>}
            sx={{ mr: 0 }}
          />
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
            Briefs a buyer wrote after visiting your profile.
          </Typography>
        </FilterSection>
      ) : null}

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
          value={values[BOARD_PARAM.CONTENT_TYPE]}
          onChange={(next) => onChange({ [BOARD_PARAM.CONTENT_TYPE]: next })}
          sx={{ flexWrap: 'wrap', overflowX: 'visible' }}
        />
      </FilterSection>

      <FilterSection title="Minimum budget" id={`${idPrefix}-budget`}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {budgetLabel(draftBudget)}
        </Typography>
        <Box sx={{ px: 1 }}>
          <Slider
            value={draftBudget}
            onChange={(event, next) => {
              isDragging.current = true
              setDraftBudget(next)
            }}
            min={BUDGET_RANGE.min}
            max={BUDGET_RANGE.max}
            step={BUDGET_RANGE.step}
            marks={BUDGET_MARKS}
            valueLabelDisplay="auto"
            valueLabelFormat={budgetLabel}
            aria-label="Minimum budget"
            getAriaValueText={budgetLabel}
            sx={{
              // MUI's 12px thumb is under the 44px touch target (00 §13); the
              // padded track keeps the whole control comfortably grabbable.
              py: 2,
              '& .MuiSlider-thumb': { width: 20, height: 20 },
            }}
          />
        </Box>
      </FilterSection>

      <FilterSection title="Deadline" id={`${idPrefix}-deadline`}>
        <FilterChipGroup
          size="sm"
          label="Deadline window"
          options={[...DEADLINE_OPTIONS]}
          value={values[BOARD_PARAM.DEADLINE]}
          onChange={(next) => onChange({ [BOARD_PARAM.DEADLINE]: next })}
          sx={{ flexWrap: 'wrap', overflowX: 'visible' }}
        />
      </FilterSection>
    </Stack>
  )
}

/**
 * Builds the active-filter chip list. Every entry knows how to remove itself,
 * so the row below stays a plain `map`.
 */
function buildChips(values, { categoryNames, onChange }) {
  const chips = []

  const search = values[BOARD_PARAM.SEARCH]
  if (search) {
    chips.push({
      key: BOARD_PARAM.SEARCH,
      label: `“${search}”`,
      onDelete: () => onChange({ [BOARD_PARAM.SEARCH]: '' }),
    })
  }

  if (values[BOARD_PARAM.INVITED]) {
    chips.push({
      key: BOARD_PARAM.INVITED,
      label: 'Invited to you',
      onDelete: () => onChange({ [BOARD_PARAM.INVITED]: false }),
    })
  }

  values[BOARD_PARAM.CATEGORY].forEach((categoryId) => {
    chips.push({
      key: `${BOARD_PARAM.CATEGORY}-${categoryId}`,
      label: categoryNames[categoryId] ?? categoryId,
      onDelete: () =>
        onChange({
          [BOARD_PARAM.CATEGORY]: values[BOARD_PARAM.CATEGORY].filter((id) => id !== categoryId),
        }),
    })
  })

  values[BOARD_PARAM.CONTENT_TYPE].forEach((type) => {
    const option = CONTENT_TYPE_OPTIONS.find((entry) => entry.value === type)
    chips.push({
      key: `${BOARD_PARAM.CONTENT_TYPE}-${type}`,
      label: option?.label ?? type,
      onDelete: () =>
        onChange({
          [BOARD_PARAM.CONTENT_TYPE]: values[BOARD_PARAM.CONTENT_TYPE].filter(
            (entry) => entry !== type
          ),
        }),
    })
  })

  const budget = values[BOARD_PARAM.BUDGET_MIN]
  if (budget > BUDGET_RANGE.min) {
    chips.push({
      key: BOARD_PARAM.BUDGET_MIN,
      label: `${money(budget)}+ budget`,
      onDelete: () => onChange({ [BOARD_PARAM.BUDGET_MIN]: BUDGET_RANGE.min }),
    })
  }

  const deadline = values[BOARD_PARAM.DEADLINE]
  if (deadline) {
    const option = DEADLINE_OPTIONS.find((entry) => entry.value === deadline)
    chips.push({
      key: BOARD_PARAM.DEADLINE,
      label: option?.label ?? `Next ${deadline} days`,
      onDelete: () => onChange({ [BOARD_PARAM.DEADLINE]: null }),
    })
  }

  return chips
}

/**
 * What is currently narrowing the board, and one click to undo any of it.
 *
 * On mobile this row is the only place the active filters are visible at all —
 * the rest of the form lives behind the sheet — so it doubles as the summary
 * and the escape hatch, and scrolls sideways rather than stacking.
 *
 * @param {object} props
 * @param {object} props.values parsed board values
 * @param {(patch: object) => void} props.onChange reports changed parameters
 * @param {() => void} props.onClear reset every filter
 * @param {Object<string, string>} [props.categoryNames] category id → display name
 * @param {object} [props.sx] MUI system styles
 */
export function ActiveBoardFilters({ values, onChange, onClear, categoryNames = {}, sx }) {
  const chips = buildChips(values, { categoryNames, onChange })
  if (chips.length === 0) return null

  return (
    <Box
      role="group"
      aria-label="Active filters"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        flexWrap: { xs: 'nowrap', md: 'wrap' },
        overflowX: { xs: 'auto', md: 'visible' },
        // Room for the focus ring, which would otherwise clip in the scroller.
        px: 0.25,
        mx: -0.25,
        py: 0.5,
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
        ...sx,
      }}
    >
      {chips.map((chip) => (
        <Chip
          key={chip.key}
          label={chip.label}
          aria-label={`Remove filter: ${chip.label}`}
          onDelete={chip.onDelete}
          deleteIcon={<Icon icon="tabler:x" width={16} aria-hidden="true" />}
          size="small"
          variant="outlined"
          sx={{ flexShrink: 0, borderRadius: 999 }}
        />
      ))}

      <Button variant="text" size="small" onClick={onClear} sx={{ flexShrink: 0, minHeight: 32 }}>
        Clear all
      </Button>
    </Box>
  )
}
