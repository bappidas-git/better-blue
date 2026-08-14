import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

import { EMPTY_PLACEHOLDER } from '@/utils/formatters'

// Definition list for detail panels — order summaries, payment breakdowns,
// profile facts. Label over value on mobile, label beside value from md up, so
// long values never get squeezed into a narrow column on a phone.

/**
 * @param {object} props
 * @param {{label: React.ReactNode, value: React.ReactNode, hint?: React.ReactNode}[]} props.items
 *   rows to render — falsy values fall back to the em-dash placeholder
 * @param {boolean} [props.dense=false] tighter row spacing
 * @param {number|string} [props.labelWidth=200] desktop width of the label column
 * @param {boolean} [props.divided=false] draw hairlines between rows
 * @param {object} [props.sx] MUI system styles
 */
export default function KeyValueList({
  items = [],
  dense = false,
  labelWidth = 200,
  divided = false,
  sx,
  ...rest
}) {
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: `minmax(0, ${
          typeof labelWidth === 'number' ? `${labelWidth}px` : labelWidth
        }) minmax(0, 1fr)` },
        columnGap: 3,
        rowGap: dense ? 1.5 : 2,
        ...sx,
      }}
      {...rest}
    >
      {items.map((item, index) => (
        <Box
          key={typeof item.label === 'string' ? item.label : index}
          sx={{
            display: 'contents',
            // Hairlines are drawn per cell: `display: contents` means this
            // wrapper has no box of its own to border.
            '& > *': divided
              ? {
                  pb: dense ? 1.5 : 2,
                  borderBottom: index < items.length - 1 ? 1 : 0,
                  borderColor: 'divider',
                }
              : undefined,
          }}
        >
          <Box component="dt">
            <Typography variant="body2" color="text.secondary">
              {item.label}
            </Typography>
            {item.hint ? (
              <Typography variant="caption" color="text.disabled" component="p">
                {item.hint}
              </Typography>
            ) : null}
          </Box>
          <Box component="dd" sx={{ m: 0, minWidth: 0 }}>
            {typeof item.value === 'string' || typeof item.value === 'number' ? (
              <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
                {item.value}
              </Typography>
            ) : (
              (item.value ?? (
                <Typography variant="body2" color="text.disabled">
                  {EMPTY_PLACEHOLDER}
                </Typography>
              ))
            )}
          </Box>
        </Box>
      ))}
    </Box>
  )
}
