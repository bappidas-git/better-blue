import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableFooter from '@mui/material/TableFooter'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableSortLabel from '@mui/material/TableSortLabel'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'

import PaginationControl from '@/components/data-display/PaginationControl'
import EmptyState from '@/components/feedback/EmptyState'
import ErrorState from '@/components/feedback/ErrorState'
import ListSkeleton from '@/components/feedback/skeletons/ListSkeleton'
import TableSkeleton from '@/components/feedback/skeletons/TableSkeleton'

// The list surface for every table in BetterBlue. Desktop gets a real table
// with a sticky header; below md it renders `renderMobileCard(row)` instead —
// 00 §13 forbids shrunken tables on phones.
//
// Everything is controlled: sorting, paging, and fetching belong to the page,
// this component only reports intent and renders the state it is handed.

/**
 * @typedef {object} DataTableColumn
 * @property {string} key unique column key — also the row property read by default
 * @property {React.ReactNode} label header text
 * @property {(row: object) => React.ReactNode} [render] custom cell renderer
 * @property {boolean} [sortable] show a sort control in the header
 * @property {'left'|'right'|'center'} [align='left'] cell alignment
 * @property {number|string} [width] fixed column width
 */

/**
 * @param {object} props
 * @param {DataTableColumn[]} props.columns column definitions, in display order
 * @param {object[]} props.rows current page of rows
 * @param {(row: object, index: number) => string} [props.getRowId] row key resolver (defaults to `row.id`)
 * @param {boolean} [props.loading=false] show skeletons sized to the layout
 * @param {Error|object|string} [props.error] failure — renders `ErrorState` instead of rows
 * @param {() => void} [props.onRetry] retry handler passed to `ErrorState`
 * @param {object} [props.emptyState] props forwarded to `EmptyState` when there are no rows
 * @param {{key: string, direction: 'asc'|'desc'}} [props.sort] current sort
 * @param {(sort: {key: string, direction: 'asc'|'desc'}) => void} [props.onSortChange] sort handler
 * @param {{page: number, pageSize: number, total: number, onPageChange: Function}} [props.pagination]
 *   props forwarded to `PaginationControl` — omit to hide paging
 * @param {Object<string, React.ReactNode>} [props.footer] a totals row, keyed by column
 *   key — desktop only, because the mobile layout renders its own summary card.
 *   Added by Prompt 25 for the earnings breakdown; omit it and nothing changes.
 * @param {(row: object) => void} [props.onRowClick] row activation handler (mouse + Enter/Space)
 * @param {(row: object) => React.ReactNode} props.renderMobileCard card renderer used below md — required
 * @param {'auto'|'table'|'cards'} [props.layout='auto'] force a layout instead of following the viewport
 * @param {boolean} [props.stickyHeader=true] pin the header while the table scrolls
 * @param {number|string} [props.maxHeight] scroll height for the table body
 * @param {string} [props.ariaLabel='Data table'] accessible name for the table
 */
export default function DataTable({
  columns = [],
  rows = [],
  getRowId,
  loading = false,
  error,
  onRetry,
  emptyState,
  sort,
  onSortChange,
  pagination,
  footer,
  onRowClick,
  renderMobileCard,
  layout = 'auto',
  stickyHeader = true,
  maxHeight,
  ariaLabel = 'Data table',
  sx,
  ...rest
}) {
  const theme = useTheme()
  const viewportIsNarrow = useMediaQuery(theme.breakpoints.down('md'))
  const asCards = layout === 'auto' ? viewportIsNarrow : layout === 'cards'

  if (import.meta.env.DEV && typeof renderMobileCard !== 'function') {
    console.warn(
      '[DataTable] `renderMobileCard` is required — falling back to a generic card built from `columns`.'
    )
  }

  const rowKey = (row, index) => getRowId?.(row, index) ?? row?.id ?? index

  const handleSort = (key) => {
    const direction = sort?.key === key && sort?.direction === 'asc' ? 'desc' : 'asc'
    onSortChange?.({ key, direction })
  }

  const activateRow = (row) => (event) => {
    if (event.type === 'keydown') {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
    }
    onRowClick?.(row)
  }

  /** Last-resort card so a missing `renderMobileCard` degrades instead of crashing. */
  const fallbackCard = (row) => (
    <Stack spacing={0.75}>
      {columns.map((column) => (
        <Stack key={column.key} direction="row" spacing={2} justifyContent="space-between">
          <Box component="span" sx={{ color: 'text.secondary', typography: 'caption' }}>
            {column.label}
          </Box>
          <Box component="span" sx={{ typography: 'body2', textAlign: 'right', minWidth: 0 }}>
            {column.render ? column.render(row) : row?.[column.key]}
          </Box>
        </Stack>
      ))}
    </Stack>
  )

  const renderCard = typeof renderMobileCard === 'function' ? renderMobileCard : fallbackCard

  let content

  if (error) {
    content = <ErrorState error={error} onRetry={onRetry} />
  } else if (loading) {
    content = asCards ? (
      <ListSkeleton rows={4} />
    ) : (
      <TableSkeleton rows={5} cols={Math.max(columns.length, 1)} />
    )
  } else if (rows.length === 0) {
    content = (
      <EmptyState
        title="Nothing here yet"
        description="Once there is activity, it will show up in this list."
        {...emptyState}
      />
    )
  } else if (asCards) {
    content = (
      <Stack spacing={2}>
        {rows.map((row, index) => {
          const card = renderCard(row, index)
          return onRowClick ? (
            <Box
              key={rowKey(row, index)}
              role="button"
              tabIndex={0}
              onClick={activateRow(row)}
              onKeyDown={activateRow(row)}
              sx={{
                cursor: 'pointer',
                borderRadius: 2,
                '&:focus-visible': {
                  outline: `2px solid ${theme.palette.primary.main}`,
                  outlineOffset: 2,
                },
              }}
            >
              {card}
            </Box>
          ) : (
            <Box key={rowKey(row, index)}>{card}</Box>
          )
        })}
      </Stack>
    )
  } else {
    content = (
      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight }}>
        <Table stickyHeader={stickyHeader} aria-label={ariaLabel}>
          <TableHead>
            <TableRow>
              {columns.map((column) => {
                const isSorted = sort?.key === column.key
                return (
                  <TableCell
                    key={column.key}
                    align={column.align ?? 'left'}
                    sortDirection={isSorted ? sort.direction : false}
                    sx={{ width: column.width, whiteSpace: 'nowrap' }}
                  >
                    {column.sortable && onSortChange ? (
                      <TableSortLabel
                        active={isSorted}
                        direction={isSorted ? sort.direction : 'asc'}
                        onClick={() => handleSort(column.key)}
                      >
                        {column.label}
                      </TableSortLabel>
                    ) : (
                      column.label
                    )}
                  </TableCell>
                )
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow
                key={rowKey(row, index)}
                hover={Boolean(onRowClick)}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? activateRow(row) : undefined}
                onKeyDown={onRowClick ? activateRow(row) : undefined}
                sx={{
                  cursor: onRowClick ? 'pointer' : 'default',
                  '&:last-child td': { borderBottom: 0 },
                  '&:focus-visible': {
                    outline: `2px solid ${theme.palette.primary.main}`,
                    outlineOffset: -2,
                  },
                }}
              >
                {columns.map((column) => (
                  <TableCell key={column.key} align={column.align ?? 'left'}>
                    {column.render ? column.render(row) : row?.[column.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
          {footer ? (
            <TableFooter>
              <TableRow
                sx={{
                  '& td': {
                    borderBottom: 0,
                    borderTop: 2,
                    borderTopStyle: 'solid',
                    borderTopColor: 'divider',
                    // A totals row is read, not skimmed: it keeps the body's
                    // type size and colour rather than the muted footer default.
                    color: 'text.primary',
                    fontSize: (theme) => theme.typography.body2.fontSize,
                    fontWeight: 700,
                    bgcolor: 'background.default',
                  },
                }}
              >
                {columns.map((column) => (
                  <TableCell key={column.key} align={column.align ?? 'left'}>
                    {footer[column.key] ?? null}
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      </TableContainer>
    )
  }

  const showPagination = Boolean(pagination) && !loading && !error && rows.length > 0

  return (
    <Box sx={sx} {...rest}>
      {content}
      {showPagination ? <PaginationControl {...pagination} /> : null}
    </Box>
  )
}
