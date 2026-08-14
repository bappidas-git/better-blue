import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import { formatDateTime } from '@/utils/formatters'

// Vertical activity timeline for order histories, dispute threads, and admin
// audit trails. Newest-first or oldest-first is the caller's choice — this
// component only renders the list it is handed.

/** Tone → palette key. `neutral` uses the ink/divider treatment. */
const TONE_PALETTE = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
  brand: 'primary',
}

/**
 * @param {object} props
 * @param {{
 *   id?: string,
 *   icon?: string,
 *   title: React.ReactNode,
 *   description?: React.ReactNode,
 *   timestamp?: string|React.ReactNode,
 *   tone?: 'neutral'|'info'|'success'|'warning'|'error'|'brand',
 *   meta?: React.ReactNode,
 * }[]} props.items timeline entries in display order
 * @param {boolean} [props.dense=false] tighter vertical spacing
 * @param {string} [props.emptyText] text shown when there are no entries
 * @param {object} [props.sx] MUI system styles
 */
export default function TimelineList({ items = [], dense = false, emptyText, sx, ...rest }) {
  if (items.length === 0 && emptyText) {
    return (
      <Typography variant="body2" color="text.secondary" sx={sx}>
        {emptyText}
      </Typography>
    )
  }

  return (
    <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, ...sx }} {...rest}>
      {items.map((item, index) => {
        const paletteKey = TONE_PALETTE[item.tone]
        const isLast = index === items.length - 1

        return (
          <Box
            component="li"
            key={item.id ?? index}
            sx={{ display: 'flex', gap: 2, pb: isLast ? 0 : dense ? 2 : 3 }}
          >
            {/* Node + connector rail */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <Box
                aria-hidden="true"
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: (theme) =>
                    paletteKey
                      ? alpha(theme.palette[paletteKey].main, 0.12)
                      : alpha(theme.palette.text.primary, 0.06),
                  color: paletteKey ? `${paletteKey}.main` : 'text.secondary',
                }}
              >
                <Icon icon={item.icon ?? 'tabler:point'} width={18} />
              </Box>
              {isLast ? null : (
                <Box sx={{ flexGrow: 1, width: '2px', bgcolor: 'divider', mt: 1, mb: -1 }} />
              )}
            </Box>

            <Box sx={{ minWidth: 0, pb: 0.5, flexGrow: 1 }}>
              <Typography variant="subtitle2" component="p">
                {item.title}
              </Typography>
              {item.description ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {item.description}
                </Typography>
              ) : null}
              {item.timestamp ? (
                <Typography variant="caption" color="text.disabled" component="p" sx={{ mt: 0.5 }}>
                  {typeof item.timestamp === 'string'
                    ? formatDateTime(item.timestamp)
                    : item.timestamp}
                </Typography>
              ) : null}
              {item.meta ? <Box sx={{ mt: 1 }}>{item.meta}</Box> : null}
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
