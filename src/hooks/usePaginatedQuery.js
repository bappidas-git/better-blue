import { useCallback, useMemo, useState } from 'react'

import { appConfig } from '@/config/appConfig'

import { useApiQuery } from './useApiQuery'
import { useDebounce } from './useDebounce'

// The engine behind every list page — 00 §12: PageHeader → toolbar (search,
// filters, sort) → content → PaginationControl. One hook owns the whole
// parameter set so no page reinvents the wiring, and every list behaves the
// same way.

/** Keystrokes are debounced here so `SearchInput` stays a controlled input. */
const SEARCH_DEBOUNCE_MS = 300

const DEFAULT_PARAMS = Object.freeze({
  page: 1,
  limit: appConfig.defaultPageSize,
  sort: undefined,
  order: 'desc',
  search: '',
  filters: Object.freeze({}),
})

/** Applies an updater that may be a value or a `(previous) => next` function. */
const resolve = (update, previous) =>
  typeof update === 'function' ? update(previous) : update

/**
 * Drives a paginated list against any `*Service.list`-shaped function.
 *
 * Anything that narrows the result — a new search term, a filter, a different
 * sort — resets to page 1, because staying on page 4 of a result set that now
 * has two pages is the most common list bug there is.
 *
 * @param {(params: import('@/services/api/listAdapter').ListParams) => Promise<import('@/services/api/listAdapter').ListResult>} listFn
 *   the service function to call, e.g. `requestService.listOpen`
 * @param {object} [options]
 * @param {import('@/services/api/listAdapter').ListParams} [options.initialParams]
 *   starting page, limit, sort, order, search, and filters
 * @param {boolean} [options.enabled=true] skip fetching while `false`
 * @returns {{items: object[], total: number, page: number, limit: number,
 *   params: object, setPage: (page: number) => void,
 *   setSort: (sort: string, order?: 'asc'|'desc') => void,
 *   setSearch: (search: string) => void,
 *   setFilters: (filters: object|((previous: object) => object)) => void,
 *   isLoading: boolean, error: ApiError|null, refetch: () => void}}
 *
 * @example
 * const list = usePaginatedQuery(requestService.listOpen, {
 *   initialParams: { limit: 12, sort: 'publishedAt' },
 * })
 * <SearchInput value={list.params.search} onChange={list.setSearch} />
 * <PaginationControl page={list.page} pageSize={list.limit} total={list.total}
 *   onPageChange={list.setPage} />
 */
export function usePaginatedQuery(listFn, { initialParams, enabled = true } = {}) {
  const [params, setParams] = useState(() => ({
    ...DEFAULT_PARAMS,
    ...initialParams,
    filters: { ...DEFAULT_PARAMS.filters, ...initialParams?.filters },
  }))

  // The typed value drives the input; the quiet one drives the request.
  const debouncedSearch = useDebounce(params.search, SEARCH_DEBOUNCE_MS)

  const requestParams = useMemo(
    () => ({ ...params, search: debouncedSearch }),
    [params, debouncedSearch]
  )

  // A stable string is a safer dependency than an object literal that is
  // recreated on every render.
  const paramsKey = useMemo(() => JSON.stringify(requestParams), [requestParams])

  const { data, isLoading, error, refetch } = useApiQuery(
    () => listFn(requestParams),
    [paramsKey],
    { enabled }
  )

  const setPage = useCallback((page) => {
    setParams((previous) => ({ ...previous, page: Math.max(1, Number(page) || 1) }))
  }, [])

  const setSort = useCallback((sort, order) => {
    setParams((previous) => ({
      ...previous,
      sort,
      order: order ?? previous.order,
      page: 1,
    }))
  }, [])

  const setSearch = useCallback((search) => {
    setParams((previous) => ({ ...previous, search: search ?? '', page: 1 }))
  }, [])

  const setFilters = useCallback((update) => {
    setParams((previous) => ({
      ...previous,
      filters: resolve(update, previous.filters) ?? {},
      page: 1,
    }))
  }, [])

  return {
    items: data?.items ?? [],
    total: data?.total ?? 0,
    // The *requested* page and size, not the last response's — so the paginator
    // highlights the page being loaded rather than the one being replaced.
    page: params.page,
    limit: params.limit,
    params,
    setPage,
    setSort,
    setSearch,
    setFilters,
    isLoading,
    error,
    refetch,
  }
}

export default usePaginatedQuery
