import Pagination from '@mui/material/Pagination'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'

import { formatNumber } from '@/utils/formatters'

// Closes every list page (00 §12). Pagination is controlled: this component
// derives the page count from `total`/`pageSize` and reports clicks — fetching
// stays with the page's `usePaginatedQuery`.

/**
 * @param {object} props
 * @param {number} [props.page=1] current page, 1-based
 * @param {number} [props.pageSize=10] items per page
 * @param {number} [props.total=0] total items across all pages
 * @param {(page: number) => void} props.onPageChange called with the new page number
 * @param {boolean} [props.showRange=true] render the "1–10 of 42" summary
 * @param {boolean} [props.hideOnSinglePage=false] render nothing when everything fits on one page
 * @param {string} [props.itemLabel='results'] noun used in the range summary
 * @param {boolean} [props.disabled=false] disable the control while a page is loading
 */
export default function PaginationControl({
  page = 1,
  pageSize = 10,
  total = 0,
  onPageChange,
  showRange = true,
  hideOnSinglePage = false,
  itemLabel = 'results',
  disabled = false,
  sx,
  ...rest
}) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const pageCount = Math.max(1, Math.ceil(total / Math.max(pageSize, 1)))
  if (hideOnSinglePage && pageCount <= 1) return null

  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <Stack
      direction={{ xs: 'column-reverse', sm: 'row' }}
      spacing={2}
      alignItems="center"
      justifyContent="space-between"
      sx={{ pt: 3, ...sx }}
      {...rest}
    >
      {showRange ? (
        <Typography variant="body2" color="text.secondary">
          {total === 0
            ? `No ${itemLabel}`
            : `${formatNumber(first)}–${formatNumber(last)} of ${formatNumber(total)} ${itemLabel}`}
        </Typography>
      ) : (
        <span />
      )}

      <Pagination
        page={Math.min(page, pageCount)}
        count={pageCount}
        onChange={(event, next) => onPageChange?.(next)}
        color="primary"
        shape="rounded"
        disabled={disabled}
        siblingCount={isMobile ? 0 : 1}
        boundaryCount={1}
        sx={{
          // MUI's page buttons are 32px (26px when small) — too small to tap.
          // Tight margins keep seven 44px targets inside a 360px viewport.
          '& .MuiPaginationItem-root': {
            minWidth: { xs: 44, sm: 36 },
            height: { xs: 44, sm: 36 },
            margin: { xs: '0 1px', sm: '0 3px' },
          },
        }}
      />
    </Stack>
  )
}
