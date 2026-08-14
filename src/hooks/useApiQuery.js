import { useCallback, useEffect, useRef, useState } from 'react'

// Server state for a single read — 00 §10. No Redux, no react-query: a fetch,
// three pieces of state, and a stable `refetch`.

/**
 * Runs `fetcher` whenever `deps` change and exposes the result as
 * `{ data, isLoading, error, refetch }`.
 *
 * Two guarantees the call sites depend on:
 *
 * - **Stale responses are ignored.** Every run carries a request id and only
 *   the newest one may write state, so a slow first request can never overwrite
 *   a fast second one — the classic filter-typing race.
 * - **`refetch` is referentially stable**, so it is safe in a dependency array
 *   or as an `ErrorState` retry handler without re-triggering itself.
 *
 * @param {() => Promise<*>} fetcher async function returning the data
 * @param {Array} [deps=[]] values that should trigger a refetch when they change
 * @param {object} [options]
 * @param {boolean} [options.enabled=true] skip the request while `false`
 *   (waiting on an id, a signed-out user, a closed dialog)
 * @returns {{data: *, isLoading: boolean, error: ApiError|null, refetch: () => void}}
 *
 * @example
 * const { data, isLoading, error, refetch } = useApiQuery(
 *   () => orderService.getWithRelations(orderId),
 *   [orderId]
 * )
 */
export function useApiQuery(fetcher, deps = [], { enabled = true } = {}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [isLoading, setLoading] = useState(enabled)

  // Kept in refs so neither a freshly declared `fetcher` nor a re-render
  // re-triggers the effect: `deps` is the single source of "run again".
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const requestId = useRef(0)
  const mounted = useRef(true)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return undefined
    }

    // Bumping the id invalidates every request already in flight.
    requestId.current += 1
    const id = requestId.current
    const isCurrent = () => mounted.current && id === requestId.current

    setLoading(true)
    setError(null)

    Promise.resolve()
      .then(() => fetcherRef.current())
      .then((result) => {
        if (!isCurrent()) return
        setData(result)
        setLoading(false)
      })
      .catch((failure) => {
        if (!isCurrent()) return
        setError(failure)
        setLoading(false)
      })

    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` is the caller's contract.
  }, [enabled, reloadToken, ...deps])

  const refetch = useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  return { data, isLoading, error, refetch }
}

export default useApiQuery
