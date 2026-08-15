import { useCallback, useMemo, useRef } from 'react'

import { useSearchParams } from 'react-router-dom'

// URL-owned list state — 00 §12, "filters sync to URL query params".
//
// The query string **is** the state. Nothing is mirrored into React state, so a
// copied link, a reload, and the browser's back button all reproduce the same
// screen by construction rather than by keeping two stores in step. The one
// thing that does hold local state is the text input, which keeps its own draft
// and reports a debounced value — that is what stops the URL being rewritten on
// every keystroke, and why focus survives typing.
//
// Deliberately resource-agnostic: a page declares a **schema** of codecs, one
// per query key, and gets back sanitised values plus writers. Prompt 12 uses it
// for creator discovery (`utils/creatorFilters.js` holds that schema); the
// request board can lift it as-is by declaring its own.

/** Shared identity for "no selection", so an untouched list stays referentially stable. */
const EMPTY_LIST = Object.freeze([])

/** First raw value for a key, or `null` when the key is absent. */
const first = (raw) => (raw.length > 0 ? String(raw[0]) : null)

/**
 * @typedef {object} ParamCodec
 * @property {*} fallback the value when the parameter is absent or unusable
 * @property {(raw: string[], context: *) => *} parse raw query values → a value
 * @property {(value: *) => string[]} serialize a value → raw query values
 * @property {(value: *) => boolean} isDefault whether the parameter can be omitted
 * @property {boolean} isFilter counts toward the active-filter badge and is
 *   cleared by `clearFilters` — `false` for `sort` and `page`
 * @property {string} [group] keys sharing a group count as one active filter
 *   (a min/max pair is one "price" filter, not two)
 */

const codec = ({ isFilter = true, group, ...rest }) =>
  Object.freeze({ isFilter, group, ...rest })

/**
 * Codecs for the query keys a discovery page declares. Each one is total: any
 * garbage in the URL resolves to the fallback rather than reaching a service
 * (§13 — "malformed URL params sanitized").
 */
export const discoveryParam = {
  /** Free text, e.g. `?q=food`. */
  text({ fallback = '', maxLength = 160, ...shared } = {}) {
    return codec({
      ...shared,
      fallback,
      parse: (raw) => {
        const value = first(raw)
        return value === null ? fallback : value.trim().slice(0, maxLength)
      },
      serialize: (value) => [String(value)],
      isDefault: (value) => !value || value === fallback,
    })
  },

  /** Boolean switch, e.g. `?available=0`. Written only when it differs from the default. */
  flag({ fallback = false, ...shared } = {}) {
    const TRUTHY = ['1', 'true', 'yes', 'on']
    const FALSY = ['0', 'false', 'no', 'off']
    return codec({
      ...shared,
      fallback,
      parse: (raw) => {
        const value = first(raw)?.toLowerCase()
        if (value && TRUTHY.includes(value)) return true
        if (value && FALSY.includes(value)) return false
        return fallback
      },
      serialize: (value) => [value ? '1' : '0'],
      isDefault: (value) => Boolean(value) === Boolean(fallback),
    })
  },

  /**
   * Number, e.g. `?min=250`. `NaN`, `Infinity`, and empty strings fall back;
   * anything else is clamped into `[min, max]` (or rejected outright when
   * `oneOf` names the allowed values).
   */
  number({
    fallback = null,
    min = Number.NEGATIVE_INFINITY,
    max = Number.POSITIVE_INFINITY,
    integer = false,
    oneOf,
    ...shared
  } = {}) {
    return codec({
      ...shared,
      fallback,
      parse: (raw) => {
        const value = first(raw)
        if (value === null || value.trim() === '') return fallback

        const parsed = Number(value)
        if (!Number.isFinite(parsed)) return fallback

        const rounded = integer ? Math.round(parsed) : parsed
        if (oneOf) return oneOf.includes(rounded) ? rounded : fallback
        return Math.min(Math.max(rounded, min), max)
      },
      serialize: (value) => [String(value)],
      isDefault: (value) => value === null || value === undefined || value === fallback,
    })
  },

  /** One of a fixed set of strings, e.g. `?sort=top_rated`. */
  choice({ options = [], fallback = null, ...shared } = {}) {
    return codec({
      ...shared,
      fallback,
      parse: (raw) => {
        const value = first(raw)
        return value !== null && options.includes(value) ? value : fallback
      },
      serialize: (value) => [String(value)],
      isDefault: (value) => value === fallback,
    })
  },

  /**
   * Repeatable key read as OR, e.g. `?category=cat_a&category=cat_b`.
   *
   * `allow` is checked against the hook's `context`, which is how an id list
   * that arrives from the API (categories) validates without the schema having
   * to wait for it: while the context has nothing to say, everything is kept.
   */
  list({ allow = () => true, max = 24, ...shared } = {}) {
    return codec({
      ...shared,
      fallback: EMPTY_LIST,
      parse: (raw, context) => {
        const kept = []
        raw.forEach((entry) => {
          const value = String(entry).trim()
          if (!value || kept.length >= max || kept.includes(value)) return
          if (allow(value, context)) kept.push(value)
        })
        return kept.length > 0 ? kept : EMPTY_LIST
      },
      serialize: (value) => value.map(String),
      isDefault: (value) => !Array.isArray(value) || value.length === 0,
    })
  },
}

/**
 * Two-way binding between a query string and a page's filter/sort/page state.
 *
 * @param {Object<string, ParamCodec>} schema query key → codec; declare it at
 *   module scope so its identity is stable across renders
 * @param {object} [options]
 * @param {*} [options.context] passed to every codec's `parse` — memoise it
 * @param {string} [options.pageKey='page'] the pagination key; any write that
 *   does not name it explicitly resets it, because staying on page 4 of a
 *   result set that now has two pages is the most common list bug there is
 * @returns {{values: object, setValue: (key: string, value: *, options?: object) => void,
 *   setValues: (patch: object|((current: object) => object), options?: object) => void,
 *   clearFilters: (options?: object) => void, activeFilters: string[],
 *   activeFilterCount: number, isFiltered: boolean}}
 *
 * @example
 * const { values, setValue, clearFilters } = useDiscoveryParams(schema, { context })
 * <SearchInput value={values.q} onChange={(q) => setValue('q', q)} />
 */
export function useDiscoveryParams(schema, { context = null, pageKey = 'page' } = {}) {
  const [searchParams, setSearchParams] = useSearchParams()

  const values = useMemo(() => {
    const parsed = {}
    Object.entries(schema).forEach(([key, spec]) => {
      parsed[key] = spec.parse(searchParams.getAll(key), context)
    })
    return parsed
  }, [schema, searchParams, context])

  // Read inside the writers so they stay referentially stable — they are handed
  // to memoised toolbars and to the filter sheet.
  const valuesRef = useRef(values)
  valuesRef.current = values

  const write = useCallback(
    (next, { replace = false } = {}) => {
      // Rebuilt from the parsed values rather than patched onto the incoming
      // string, so anything unrecognised or defaulted drops out of the URL and
      // the address bar always shows the state actually in effect.
      const query = new URLSearchParams()
      Object.entries(schema).forEach(([key, spec]) => {
        const value = next[key]
        if (spec.isDefault(value)) return
        spec.serialize(value).forEach((entry) => query.append(key, entry))
      })
      // A push, not a replace: filter changes are navigation, and back has to
      // undo them (§14 — "back/forward navigates filter history").
      setSearchParams(query, { replace })
    },
    [schema, setSearchParams]
  )

  const setValues = useCallback(
    (patch, options) => {
      const current = valuesRef.current
      const changes = typeof patch === 'function' ? patch(current) : patch
      const next = { ...current, ...changes }

      if (schema[pageKey] && !Object.prototype.hasOwnProperty.call(changes, pageKey)) {
        next[pageKey] = schema[pageKey].fallback
      }

      write(next, options)
    },
    [pageKey, schema, write]
  )

  const setValue = useCallback(
    (key, value, options) => setValues({ [key]: value }, options),
    [setValues]
  )

  const clearFilters = useCallback(
    (options) => {
      const next = { ...valuesRef.current }
      Object.entries(schema).forEach(([key, spec]) => {
        if (spec.isFilter) next[key] = spec.fallback
      })
      if (schema[pageKey]) next[pageKey] = schema[pageKey].fallback
      write(next, options)
    },
    [pageKey, schema, write]
  )

  const activeFilters = useMemo(
    () =>
      Object.entries(schema)
        .filter(([key, spec]) => spec.isFilter && !spec.isDefault(values[key]))
        .map(([key]) => key),
    [schema, values]
  )

  const activeFilterCount = useMemo(
    () => new Set(activeFilters.map((key) => schema[key].group ?? key)).size,
    [activeFilters, schema]
  )

  return {
    values,
    setValue,
    setValues,
    clearFilters,
    activeFilters,
    activeFilterCount,
    isFiltered: activeFilterCount > 0,
  }
}

export default useDiscoveryParams
