import Stack from '@mui/material/Stack'

import FilterChipGroup from '@/components/inputs/FilterChipGroup'

import { FILTER_ALL } from '../utils/portfolioFilters'

// The gallery's chip row: content type, and nothing else. Presentation only —
// which options exist is decided in `utils/portfolioFilters`.
//
// V2-10 removed the category sub-filter that used to sit underneath, along with
// every other category control on the storefront.

/**
 * @param {object} props
 * @param {{type: string}} props.value current selection
 * @param {(next: {type: string}) => void} props.onChange
 * @param {{value: string, label: string, icon?: string, count: number}[]} props.typeOptions
 */
export default function PortfolioFilterBar({ value, onChange, typeOptions = [] }) {
  if (typeOptions.length === 0) return null

  return (
    <Stack spacing={0.5} sx={{ mb: 2.5 }}>
      <FilterChipGroup
        label="Filter portfolio by content type"
        options={typeOptions}
        value={value.type}
        // Clearing a chip means "All" here rather than "nothing selected" — an
        // empty gallery is never what a click on the active chip meant.
        onChange={(next) => onChange({ ...value, type: next ?? FILTER_ALL })}
      />
    </Stack>
  )
}
