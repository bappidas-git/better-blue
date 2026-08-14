// Provider adapter for list endpoints — 00 §10, `docs/api-contract.md` §4.
//
// **This is the only module in the codebase that knows how a provider spells a
// list.** `_page`, `_limit`, `_sort`, `_order`, `q`, `_like`, and the
// `X-Total-Count` header appear here and nowhere else; grep for them to prove
// it. Everything above this line speaks the contract's five parameters and
// reads the contract's `{ items, total, page, limit }` envelope.
//
// Migrating to Laravel is: change `VITE_API_BASE_URL`, and swap the branch
// below (contract §4.5).

import { appConfig } from '@/config/appConfig'
import { env } from '@/config/env'

/** Providers this adapter can speak. */
export const API_PROVIDER = Object.freeze({
  JSON_SERVER: 'json-server',
  LARAVEL: 'laravel',
})

/** Sort directions (contract §4.1). */
export const SORT_ORDER = Object.freeze({ ASC: 'asc', DESC: 'desc' })

/** Contract defaults: 1-based pages, `appConfig.defaultPageSize` rows. */
export const DEFAULT_PAGE = 1
export const DEFAULT_LIMIT = appConfig.defaultPageSize
const MAX_LIMIT = 100

const ARRAY_CONTAINS = '@@arrayContains'

/**
 * Marks a filter as **array membership** rather than equality — "this record's
 * `categories` array contains `cat_food_beverage`".
 *
 * Services use it declaratively and stay provider-agnostic; how it is spelled
 * on the wire is this module's problem (contract §4.3, finding 3).
 *
 * @param {string|number|Array} value the value(s) that must be present
 * @returns {object} an opaque marker for `buildListParams`
 *
 * @example
 * buildListParams({ filters: { categories: arrayContains(categoryId) } })
 */
export function arrayContains(value) {
  return { [ARRAY_CONTAINS]: value }
}

const isArrayContains = (value) =>
  Boolean(value) && typeof value === 'object' && ARRAY_CONTAINS in value

/** Drops `null`, `undefined`, and `''` — an absent filter, not a filter for "". */
const isEmpty = (value) => value === null || value === undefined || value === ''

/** Collapses a value to what a query string can carry, or `undefined` to skip. */
function toQueryValue(value) {
  if (isEmpty(value)) return undefined
  if (Array.isArray(value)) {
    const kept = value.filter((entry) => !isEmpty(entry))
    if (kept.length === 0) return undefined
    return kept.length === 1 ? kept[0] : kept
  }
  return value
}

/**
 * A plain object that reached the filter map is always a mistake — usually a
 * whole `ListParams` passed where its `filters` belonged. Serialising it would
 * emit `filters[category]=…`, which no provider understands and which fails
 * silently by returning everything. Dropped, loudly in dev.
 */
function isMalformedFilter(key, value) {
  const malformed =
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !isArrayContains(value)

  if (malformed && env.isDev) {
    console.warn(
      `[listAdapter] Filter "${key}" is an object and was dropped. Pass a scalar, ` +
        'an array (OR), a `field_gte`/`field_lte` range, or arrayContains(value).'
    )
  }
  return malformed
}

function clampInt(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Math.floor(Number(value))
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

/**
 * @typedef {object} ListParams
 * @property {number} [page=1] 1-based page number
 * @property {number} [limit=12] rows per page, 1–100
 * @property {string} [sort] field name to sort by
 * @property {'asc'|'desc'} [order='desc'] sort direction
 * @property {string} [search] free-text query
 * @property {Object<string, *>} [filters] resource filters — scalars, arrays
 *   (OR), `field_gte`/`field_lte` ranges, or `arrayContains(…)` markers
 */

/**
 * @typedef {object} ListResult
 * @property {Array<object>} items the page of records
 * @property {number} total matches after filters, before pagination
 * @property {number} page the page that was returned
 * @property {number} limit the page size that was applied
 */

/* -- json-server ----------------------------------------------------------- */

function buildJsonServerParams({ page, limit, sort, order, search, filters }) {
  // `_page` and `_limit` are sent on **every** list request: JSON Server only
  // emits `X-Total-Count` when one of them is present (contract §4.3, finding 1).
  const params = {
    _page: clampInt(page, DEFAULT_PAGE),
    _limit: clampInt(limit, DEFAULT_LIMIT, { max: MAX_LIMIT }),
  }

  if (sort) {
    params._sort = sort
    params._order = order === SORT_ORDER.ASC ? SORT_ORDER.ASC : SORT_ORDER.DESC
  }

  const query = toQueryValue(search)
  if (query !== undefined) params.q = query

  Object.entries(filters ?? {}).forEach(([key, rawValue]) => {
    if (isArrayContains(rawValue)) {
      // JSON Server compares scalars, so equality against an array field
      // matches nothing. `_like` is a regex substring match — safe for our
      // unique, non-overlapping `cat_…`/`pfi_…` ids (contract §4.3, finding 3).
      const value = toQueryValue(rawValue[ARRAY_CONTAINS])
      if (value !== undefined) params[`${key}_like`] = value
      return
    }
    if (isMalformedFilter(key, rawValue)) return

    const value = toQueryValue(rawValue)
    if (value !== undefined) params[key] = value
  })

  return params
}

function parseJsonServerResponse(response) {
  const items = Array.isArray(response?.data) ? response.data : []
  const sent = response?.config?.params ?? {}

  // Header first, `items.length` as the floor — `total` is never undefined.
  // Readable only because JSON Server sets `Access-Control-Expose-Headers`
  // (contract §4.3, finding 2).
  const header = response?.headers?.['x-total-count']
  const total = Number.isFinite(Number(header)) && header !== null && header !== undefined
    ? Number(header)
    : items.length

  return {
    items,
    total,
    page: clampInt(sent._page, DEFAULT_PAGE),
    limit: clampInt(sent._limit, DEFAULT_LIMIT, { max: MAX_LIMIT }),
  }
}

/* -- laravel (stub) -------------------------------------------------------- */

function buildLaravelParams({ page, limit, sort, order, search, filters }) {
  // TODO(laravel): confirm against the real API before switching the provider.
  // Contract §4.5 is the target mapping:
  //   page   → `page`      (identical, 1-based)
  //   limit  → `per_page`  (Laravel's paginator name)
  //   sort   → `sort`      (validate server-side against a per-resource allow-list)
  //   order  → `order`
  //   search → `search`    (scoped to the fields listed per resource in §6 —
  //                         NOT every column, unlike JSON Server's `q`)
  const params = {
    page: clampInt(page, DEFAULT_PAGE),
    per_page: clampInt(limit, DEFAULT_LIMIT, { max: MAX_LIMIT }),
  }

  if (sort) {
    params.sort = sort
    params.order = order === SORT_ORDER.ASC ? SORT_ORDER.ASC : SORT_ORDER.DESC
  }

  const query = toQueryValue(search)
  if (query !== undefined) params.search = query

  Object.entries(filters ?? {}).forEach(([key, rawValue]) => {
    if (!isArrayContains(rawValue) && isMalformedFilter(key, rawValue)) return

    // TODO(laravel): array membership has no `_like` equivalent — the backend
    // should expose it as a plain repeated filter resolved with
    // `whereJsonContains` / a pivot join, so `categories=cat_x` just works and
    // this branch collapses into the one below.
    const value = toQueryValue(isArrayContains(rawValue) ? rawValue[ARRAY_CONTAINS] : rawValue)
    // TODO(laravel): `field_gte` / `field_lte` pass through unchanged; the
    // backend parses the suffix into `where(field, '>=', value)`.
    if (value !== undefined) params[key] = value
  })

  return params
}

function parseLaravelResponse(response) {
  // TODO(laravel): the API Resource collection must already emit the contract
  // envelope (§4.2), so this is a pass-through with defensive defaults rather
  // than a reshape of `{ data, meta: { total, current_page, per_page } }`. If
  // the backend ships Laravel's native paginator shape instead, map it *here*
  // — never in a service.
  const body = response?.data ?? {}
  const items = Array.isArray(body.items) ? body.items : []
  return {
    items,
    total: Number.isFinite(Number(body.total)) ? Number(body.total) : items.length,
    page: clampInt(body.page, DEFAULT_PAGE),
    limit: clampInt(body.limit, DEFAULT_LIMIT, { max: MAX_LIMIT }),
  }
}

/* -- dispatch -------------------------------------------------------------- */

let warnedUnknownProvider = false

function resolveProvider() {
  const provider = env.apiProvider
  if (provider === API_PROVIDER.JSON_SERVER || provider === API_PROVIDER.LARAVEL) return provider

  if (env.isDev && !warnedUnknownProvider) {
    warnedUnknownProvider = true
    console.warn(
      `[listAdapter] Unknown VITE_API_PROVIDER "${provider}" — falling back to ` +
        `"${API_PROVIDER.JSON_SERVER}". Valid values: ${Object.values(API_PROVIDER).join(', ')}.`
    )
  }
  return API_PROVIDER.JSON_SERVER
}

/**
 * Translates the contract's list parameters into the current provider's query
 * string.
 *
 * @param {ListParams} [params]
 * @returns {Object<string, *>} params for `apiClient.get(path, { params })`
 */
export function buildListParams(params = {}) {
  const build =
    resolveProvider() === API_PROVIDER.LARAVEL ? buildLaravelParams : buildJsonServerParams
  return build(params ?? {})
}

/**
 * Normalises a provider's list response into the contract envelope (§4.2).
 *
 * @param {import('axios').AxiosResponse} response the raw axios response
 * @returns {ListResult} `{ items, total, page, limit }`
 */
export function parseListResponse(response) {
  const parse =
    resolveProvider() === API_PROVIDER.LARAVEL ? parseLaravelResponse : parseJsonServerResponse
  return parse(response)
}
