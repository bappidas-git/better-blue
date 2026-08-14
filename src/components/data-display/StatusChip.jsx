import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'

import { STATUS_META, getStatusMeta } from '@/constants'

// The single way BetterBlue renders a status (00 §9). Give it any domain value
// — `ORDER_STATUS.DELIVERED`, `PAYMENT_STATUS.HELD`, `CONTENT_STATUS.RESTRICTED`
// — and it looks up `{ label, tone, description }` and renders the matching
// tinted chip. Unknown values still render, via `getStatusMeta`'s fallback.

/** `STATUS_META.tone` → MUI chip color. The theme turns these into soft tints. */
const TONE_COLORS = {
  neutral: 'default',
  info: 'info',
  warning: 'warning',
  success: 'success',
  error: 'error',
  brand: 'primary',
}

/**
 * @param {object} props
 * @param {string} props.status domain status value, e.g. `ORDER_STATUS.IN_PROGRESS`
 * @param {Record<string, {label: string, tone: string, description?: string}>} [props.metaMap=STATUS_META]
 *   alternative metadata map for screens that need context-specific wording
 * @param {'sm'|'md'} [props.size='md'] chip size
 * @param {boolean} [props.showDot=true] render the leading tone dot
 * @param {boolean} [props.tooltip=false] reveal the status description on hover/focus
 * @param {React.ReactNode} [props.label] override the label from the metadata map
 * @param {'filled'|'outlined'} [props.variant='filled'] chip variant
 */
export default function StatusChip({
  status,
  metaMap = STATUS_META,
  size = 'md',
  showDot = true,
  tooltip = false,
  label,
  variant = 'filled',
  sx,
  ...rest
}) {
  const meta = getStatusMeta(status, metaMap)
  const isSmall = size === 'sm'

  const chip = (
    <Chip
      label={label ?? meta.label}
      color={TONE_COLORS[meta.tone] ?? 'default'}
      variant={variant}
      size={isSmall ? 'small' : 'medium'}
      icon={
        showDot ? (
          <Box
            component="span"
            aria-hidden="true"
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: 'currentColor',
              // MUI's icon slot forces its own color; inherit the chip's.
              color: 'inherit',
            }}
          />
        ) : undefined
      }
      sx={{
        fontSize: isSmall ? '0.6875rem' : '0.75rem',
        '& .MuiChip-icon': { color: 'inherit', ml: isSmall ? 1 : 1.25, mr: -0.5 },
        ...sx,
      }}
      {...rest}
    />
  )

  if (!tooltip || !meta.description) return chip

  // The span keeps the tooltip's ref off the Chip, which forwards it to the
  // root anyway — and gives disabled chips a hoverable wrapper.
  return (
    <Tooltip title={meta.description}>
      <span style={{ display: 'inline-flex' }}>{chip}</span>
    </Tooltip>
  )
}
