import { useMemo } from 'react'

import FilterChipGroup from '@/components/inputs/FilterChipGroup'
import { NOTIFICATION_CATEGORY_META } from '@/constants/notificationTypes'
import {
  ALL_CATEGORIES,
  CATEGORY_CHIP_LABEL,
  categoriesForRole,
} from '@/features/notifications/notificationFilters'

// The category row on the notifications page (§4.3). A thin wrapper over the
// shared `FilterChipGroup`: all this adds is the "All" chip and the labels —
// which categories a role can see lives in ../notificationFilters.js.

/**
 * @param {object} props
 * @param {string|null} props.value selected category, or `ALL_CATEGORIES`
 * @param {(value: string|null) => void} props.onChange
 * @param {string} props.role the reader's role — decides which chips appear
 */
export default function CategoryFilterChips({ value, onChange, role }) {
  const options = useMemo(
    () => [
      { value: 'all', label: 'All' },
      ...categoriesForRole(role).map((category) => ({
        value: category,
        label:
          CATEGORY_CHIP_LABEL[category] ??
          NOTIFICATION_CATEGORY_META[category]?.label ??
          category,
      })),
    ],
    [role]
  )

  return (
    <FilterChipGroup
      label="Filter notifications by category"
      options={options}
      value={value ?? 'all'}
      // "All" is a chip rather than the absence of one, so clearing the active
      // chip has to mean "All" too — otherwise the row can reach a state with
      // nothing selected and no way to tell what it is showing.
      onChange={(next) => onChange(!next || next === 'all' ? ALL_CATEGORIES : next)}
      allowClear={false}
    />
  )
}
