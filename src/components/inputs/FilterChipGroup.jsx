import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'

// Chip row for the quick filters that sit next to `SearchInput` on list pages
// (00 §12). Scrolls horizontally on mobile instead of wrapping into a wall of
// chips, and wraps normally from md up.

/**
 * @param {object} props
 * @param {{value: string, label: string, icon?: string, count?: number}[]} props.options filter options
 * @param {string|string[]|null} props.value selected value — an array when `multiple`
 * @param {(value: string|string[]|null) => void} props.onChange called with the next selection
 * @param {boolean} [props.multiple=false] allow several filters at once
 * @param {string} [props.label='Filters'] accessible group label
 * @param {boolean} [props.allowClear=true] clicking the active chip clears it (single-select)
 * @param {'sm'|'md'} [props.size='md'] chip size
 * @param {object} [props.sx] MUI system styles
 */
export default function FilterChipGroup({
  options = [],
  value,
  onChange,
  multiple = false,
  label = 'Filters',
  allowClear = true,
  size = 'md',
  sx,
  ...rest
}) {
  const selected = multiple ? (Array.isArray(value) ? value : []) : value
  const isSelected = (optionValue) =>
    multiple ? selected.includes(optionValue) : selected === optionValue

  const toggle = (optionValue) => {
    if (multiple) {
      const next = selected.includes(optionValue)
        ? selected.filter((item) => item !== optionValue)
        : [...selected, optionValue]
      onChange?.(next)
      return
    }
    if (selected === optionValue) {
      if (allowClear) onChange?.(null)
      return
    }
    onChange?.(optionValue)
  }

  return (
    <Box
      role="group"
      aria-label={label}
      sx={{
        display: 'flex',
        gap: 1,
        flexWrap: { xs: 'nowrap', md: 'wrap' },
        overflowX: { xs: 'auto', md: 'visible' },
        // Room for the focus ring, which would otherwise clip in the scroller.
        px: 0.25,
        py: 0.5,
        mx: -0.25,
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
        // MUI chips are 32px tall at `medium` and 24px at `small` — both too
        // small to tap, so every chip grows to a 44px target on touch-sized
        // viewports (00 §13). `size` sets the *desktop* density only: it is a
        // choice about how tight a toolbar looks, not about whether a finger
        // can hit it. (Until the Prompt 37 responsive sweep the floor was
        // applied to `md` alone, which left every admin list page's filters at
        // 24px on a phone.)
        '& .MuiChip-root': {
          height: { xs: 44, md: size === 'sm' ? 24 : 32 },
          borderRadius: 999,
        },
        ...sx,
      }}
      {...rest}
    >
      {options.map((option) => {
        const active = isSelected(option.value)
        return (
          <Chip
            key={option.value}
            label={option.count === undefined ? option.label : `${option.label} (${option.count})`}
            icon={option.icon ? <Icon icon={option.icon} width={16} /> : undefined}
            onClick={() => toggle(option.value)}
            aria-pressed={active}
            color={active ? 'primary' : 'default'}
            variant={active ? 'filled' : 'outlined'}
            size={size === 'sm' ? 'small' : 'medium'}
            sx={{ flexShrink: 0 }}
          />
        )
      })}
    </Box>
  )
}
