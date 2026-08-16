import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'

import FilterChipGroup from '@/components/inputs/FilterChipGroup'
import SearchInput from '@/components/inputs/SearchInput'
import SortSelect from '@/components/inputs/SortSelect'
import DataTable from '@/components/table/DataTable'
import usePaginatedQuery from '@/hooks/usePaginatedQuery'
import DashboardPage from '@/layouts/dashboard/DashboardPage'

import AdminPageGuard from './AdminPageGuard'

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ THE ADMIN LIST PATTERN — a worked example, not a framework.              ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//
// Every screen in Prompts 29–36 is the same shape (00 §12):
//
//   DashboardPage (title, subtitle, actions)
//     └ AdminPageGuard (the screen's permission)
//         └ toolbar   — SearchInput + FilterChipGroup + SortSelect
//         └ DataTable — rows on desktop, cards below md
//         └ pagination (DataTable renders PaginationControl for you)
//   …all driven by one `usePaginatedQuery(service.list)`.
//
// This component is that shape, wired and working. **Use it when your screen
// fits it, and copy it into your feature when it does not** — a moderation
// queue with bulk selection, a settlements screen with a totals footer, and a
// users directory with a status filter row are three different screens, and
// bending one component into all three would produce a worse version of each.
// The value here is that the wiring is decided once: which prop resets the page
// to 1, where the empty state lives, what the mobile layout does. Copying that
// is cheap; discovering it three times is not.
//
// What it deliberately does **not** do: own filter state in the URL. Filters
// sync to query params per 00 §12, and that belongs to the page, which knows
// which of its filters are worth a shareable link. `useListParams` is the hook
// for it; pass the result in through `initialParams` and `onParamsChange`.

/**
 * @param {object} props
 * @param {React.ReactNode} props.title page heading
 * @param {React.ReactNode} [props.subtitle] one line under the heading
 * @param {React.ReactNode} [props.actions] page-level buttons (export, create)
 * @param {string|string[]} [props.permission] `PERMISSIONS` key(s) required —
 *   omit only for screens every admin may open
 * @param {(params: object) => Promise<object>} props.listFn the service list
 *   function, e.g. `userService.list` (00 §10 — never a raw collection read)
 * @param {object} [props.initialParams] starting page, limit, sort, order, filters
 * @param {import('@/components/table/DataTable').DataTableColumn[]} props.columns
 * @param {(row: object) => React.ReactNode} props.renderMobileCard card renderer below md
 * @param {(row: object) => void} [props.onRowClick] row activation
 * @param {string} [props.searchPlaceholder] omit to hide the search field
 * @param {{value: string, label: string}[]} [props.sortOptions] omit to hide the sort control
 * @param {{key: string, options: Array, multiple?: boolean, label?: string}} [props.filter]
 *   one chip-group filter bound to `params.filters[key]`
 * @param {object} [props.emptyState] props forwarded to `EmptyState`
 * @param {string} [props.itemLabel='results'] noun in the pagination summary
 * @param {React.ReactNode} [props.children] extra content between toolbar and table
 *
 * @example
 * <AdminListPage
 *   title="Users"
 *   subtitle="Every buyer, creator, and team member on the platform"
 *   permission={PERMISSIONS.USERS_MANAGE}
 *   listFn={userService.list}
 *   initialParams={{ sort: 'createdAt', limit: 20 }}
 *   columns={USER_COLUMNS}
 *   renderMobileCard={(row) => <UserCard user={row} />}
 *   searchPlaceholder="Search by name or email"
 *   filter={{ key: 'accountStatus', options: ACCOUNT_STATUS_OPTIONS }}
 *   emptyState={{ title: 'No accounts match those filters' }}
 *   itemLabel="members"
 * />
 */
export default function AdminListPage({
  title,
  subtitle,
  actions,
  permission,
  listFn,
  initialParams,
  columns,
  renderMobileCard,
  onRowClick,
  searchPlaceholder,
  sortOptions,
  filter,
  emptyState,
  itemLabel = 'results',
  children,
}) {
  const list = usePaginatedQuery(listFn, { initialParams })

  const hasToolbar = Boolean(searchPlaceholder || sortOptions || filter)

  const body = (
    <Stack spacing={{ xs: 2, md: 2.5 }}>
      {hasToolbar ? (
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'stretch', md: 'center' }}
        >
          {searchPlaceholder ? (
            <Box sx={{ flexGrow: 1, minWidth: 0, maxWidth: { md: 360 } }}>
              <SearchInput
                value={list.params.search}
                onChange={list.setSearch}
                placeholder={searchPlaceholder}
              />
            </Box>
          ) : (
            <Box sx={{ flexGrow: 1 }} />
          )}

          {filter ? (
            <FilterChipGroup
              label={filter.label ?? 'Filters'}
              options={filter.options}
              multiple={filter.multiple}
              value={list.params.filters[filter.key] ?? (filter.multiple ? [] : null)}
              // Setting a filter resets to page 1 — `usePaginatedQuery` does it,
              // which is why filters go through the hook rather than local state.
              onChange={(value) =>
                list.setFilters((previous) => ({ ...previous, [filter.key]: value }))
              }
              size="sm"
            />
          ) : null}

          {sortOptions ? (
            <SortSelect
              value={list.params.sort ?? sortOptions[0]?.value}
              onChange={(value) => list.setSort(value, list.params.order)}
              options={sortOptions}
            />
          ) : null}
        </Stack>
      ) : null}

      {children}

      <DataTable
        columns={columns}
        rows={list.items}
        loading={list.isLoading}
        error={list.error}
        onRetry={list.refetch}
        emptyState={emptyState}
        onRowClick={onRowClick}
        renderMobileCard={renderMobileCard}
        sort={list.params.sort ? { key: list.params.sort, direction: list.params.order } : undefined}
        onSortChange={(next) => list.setSort(next.key, next.direction)}
        pagination={{
          page: list.page,
          pageSize: list.limit,
          total: list.total,
          onPageChange: list.setPage,
          itemLabel,
        }}
        ariaLabel={typeof title === 'string' ? title : 'Admin list'}
      />
    </Stack>
  )

  return (
    <DashboardPage title={title} subtitle={subtitle} actions={actions} maxWidth={false}>
      {permission ? <AdminPageGuard permission={permission}>{body}</AdminPageGuard> : body}
    </DashboardPage>
  )
}
