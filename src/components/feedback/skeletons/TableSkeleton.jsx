import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'

// Loading placeholder for `DataTable`'s desktop layout: a muted header strip
// over evenly spaced cell bones, inside the same outlined paper as the table.

/**
 * @param {object} props
 * @param {number} [props.rows=5] body rows
 * @param {number} [props.cols=4] columns
 * @param {boolean} [props.header=true] include the header strip
 * @param {string} [props.label='Loading table'] accessible label announced while busy
 * @param {object} [props.sx] MUI system styles
 */
export default function TableSkeleton({
  rows = 5,
  cols = 4,
  header = true,
  label = 'Loading table',
  sx,
  ...rest
}) {
  const gridTemplateColumns = `2fr repeat(${Math.max(cols - 1, 0)}, 1fr)`

  return (
    <Paper
      variant="outlined"
      role="status"
      aria-busy="true"
      aria-label={label}
      sx={{ overflow: 'hidden', ...sx }}
      {...rest}
    >
      {header ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns,
            gap: 2,
            px: 2,
            py: 1.75,
            bgcolor: 'background.default',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          {Array.from({ length: cols }, (_, index) => (
            <Skeleton key={index} variant="text" width="60%" sx={{ fontSize: '0.8125rem' }} />
          ))}
        </Box>
      ) : null}

      {Array.from({ length: rows }, (_, rowIndex) => (
        <Box
          key={rowIndex}
          sx={{
            display: 'grid',
            gridTemplateColumns,
            gap: 2,
            alignItems: 'center',
            px: 2,
            py: 2,
            borderBottom: rowIndex < rows - 1 ? 1 : 0,
            borderColor: 'divider',
          }}
        >
          {Array.from({ length: cols }, (_, colIndex) => (
            <Skeleton
              key={colIndex}
              variant="text"
              width={colIndex === 0 ? '85%' : '55%'}
              sx={{ fontSize: '0.875rem' }}
            />
          ))}
        </Box>
      ))}
    </Paper>
  )
}
