import { useCallback, useMemo, useState } from 'react'

// Which proposals are ticked for comparison. Feature-local state by design
// (§7): it describes a moment in one screen, not anything the server or the URL
// needs to remember, and it is thrown away the moment compare mode is left.

/** Two is the fewest worth comparing; three is the most that fits a phone column set. */
export const COMPARE_MIN = 2
export const COMPARE_MAX = 3

/**
 * @param {object} [options]
 * @param {number} [options.max=COMPARE_MAX] cap on the selection
 * @returns {{active: boolean, selectedIds: string[], isSelected: (id: string) => boolean,
 *   isFull: boolean, canCompare: boolean, toggle: (id: string) => void,
 *   start: () => void, stop: () => void, keepOnly: (ids: string[]) => void}}
 */
export function useCompareSelection({ max = COMPARE_MAX } = {}) {
  const [active, setActive] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])

  const toggle = useCallback(
    (id) => {
      setSelectedIds((current) => {
        if (current.includes(id)) return current.filter((entry) => entry !== id)
        // A silent no-op at the cap: the checkboxes past it are already
        // disabled, so this only ever catches a keyboard or race case.
        return current.length >= max ? current : [...current, id]
      })
    },
    [max]
  )

  const start = useCallback(() => setActive(true), [])

  const stop = useCallback(() => {
    setActive(false)
    setSelectedIds([])
  }, [])

  /**
   * Drops anything no longer on screen. Accepting or declining removes an offer
   * from the live set, and a comparison of a proposal that no longer exists is
   * the kind of stale state that produces a blank column.
   */
  const keepOnly = useCallback((ids) => {
    const available = new Set(ids)
    setSelectedIds((current) => {
      const kept = current.filter((id) => available.has(id))
      return kept.length === current.length ? current : kept
    })
  }, [])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  return {
    active,
    selectedIds,
    isSelected: useCallback((id) => selectedSet.has(id), [selectedSet]),
    isFull: selectedIds.length >= max,
    canCompare: selectedIds.length >= COMPARE_MIN,
    toggle,
    start,
    stop,
    keepOnly,
  }
}

export default useCompareSelection
