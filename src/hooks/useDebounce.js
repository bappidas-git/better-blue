import { useEffect, useState } from 'react'

/**
 * Debounced mirror of a fast-changing value — used by `SearchInput` (300ms) and
 * anywhere a keystroke shouldn't immediately hit a filter, URL param, or query.
 *
 * The returned value only catches up once `value` has been still for `delay`
 * milliseconds, so callers keep rendering the live value while reacting to the
 * quiet one.
 *
 * @param {*} value value to debounce (any type — compared by identity)
 * @param {number} [delay=300] quiet period in ms; `0` disables debouncing
 * @returns {*} the value as it was `delay` ms ago
 *
 * @example
 * const [query, setQuery] = useState('')
 * const debouncedQuery = useDebounce(query, 300)
 * useEffect(() => { search(debouncedQuery) }, [debouncedQuery])
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    if (delay <= 0) {
      setDebouncedValue(value)
      return undefined
    }

    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

export default useDebounce
