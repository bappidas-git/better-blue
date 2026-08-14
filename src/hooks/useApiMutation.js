import { useCallback, useEffect, useRef, useState } from 'react'

// Server state for a single write — 00 §10. Pairs with `useApiQuery`: that one
// reads on render, this one writes on an interaction.

/**
 * Wraps a mutating service call as `{ mutate, isLoading, error, reset }`.
 *
 * `mutate` **returns the result and rethrows on failure**, so the caller stays
 * in control of what happens next — toast, close the dialog, refetch a list
 * (00 §12). `error` is there for inline field errors from an `ApiError`'s
 * `details`; it is not a substitute for catching.
 *
 * @param {(...args: *) => Promise<*>} mutationFn the service call to run
 * @returns {{mutate: (...args: *) => Promise<*>, isLoading: boolean,
 *   error: ApiError|null, reset: () => void}}
 *
 * @example
 * const { mutate, isLoading } = useApiMutation(proposalService.submitProposal)
 * try {
 *   await mutate(values)
 *   toast.success('Proposal sent.')
 * } catch (error) {
 *   toast.error(error.message)
 * }
 */
export function useApiMutation(mutationFn) {
  const [isLoading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const mutationRef = useRef(mutationFn)
  mutationRef.current = mutationFn

  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const mutate = useCallback(async (...args) => {
    if (mounted.current) {
      setLoading(true)
      setError(null)
    }

    try {
      const result = await mutationRef.current(...args)
      if (mounted.current) setLoading(false)
      return result
    } catch (failure) {
      // State is recorded for inline display, then the error is rethrown: a
      // mutation that fails silently is how a member ends up thinking a
      // payment went through.
      if (mounted.current) {
        setError(failure)
        setLoading(false)
      }
      throw failure
    }
  }, [])

  /** Clears the last error — e.g. when a dialog reopens. */
  const reset = useCallback(() => {
    setError(null)
    setLoading(false)
  }, [])

  return { mutate, isLoading, error, reset }
}

export default useApiMutation
