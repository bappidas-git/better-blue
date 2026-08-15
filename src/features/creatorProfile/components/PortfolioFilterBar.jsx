import Stack from '@mui/material/Stack'

import FilterChipGroup from '@/components/inputs/FilterChipGroup'

import { FILTER_ALL } from '../utils/portfolioFilters'

// The gallery's two chip rows: content type, and — once a portfolio is big
// enough to need it — the category sub-filter underneath. Both are presentation
// only; which options exist is decided in `utils/portfolioFilters`.

/**
 * @param {object} props
 * @param {{type: string, category: string}} props.value current selection
 * @param {(next: {type: string, category: string}) => void} props.onChange
 * @param {{value: string, label: string, icon?: string, count: number}[]} props.typeOptions
 * @param {{value: string, label: string, count: number}[]} [props.categoryOptions]
 *   omit or pass an empty array to hide the sub-filter
 */
export default function PortfolioFilterBar({
  value,
  onChange,
  typeOptions = [],
  categoryOptions = [],
}) {
  if (typeOptions.length === 0 && categoryOptions.length === 0) return null

  return (
    <Stack spacing={0.5} sx={{ mb: 2.5 }}>
      {typeOptions.length > 0 ? (
        <FilterChipGroup
          label="Filter portfolio by content type"
          options={typeOptions}
          value={value.type}
          // Clearing a chip means "All" here rather than "nothing selected" —
          // an empty gallery is never what a click on the active chip meant.
          onChange={(next) => onChange({ ...value, type: next ?? FILTER_ALL, category: FILTER_ALL })}
        />
      ) : null}

      {categoryOptions.length > 0 ? (
        <FilterChipGroup
          size="sm"
          label="Filter portfolio by category"
          options={categoryOptions}
          value={value.category}
          onChange={(next) => onChange({ ...value, category: next ?? FILTER_ALL })}
        />
      ) : null}
    </Stack>
  )
}
