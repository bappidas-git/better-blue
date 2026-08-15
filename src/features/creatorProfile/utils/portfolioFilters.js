import { CONTENT_TYPE, STATUS_META } from '@/constants/statuses'

// What the portfolio gallery is allowed to filter by, and how a filter turns
// into a set of items. Kept beside the components rather than inside them so
// the gallery and its filter bar agree by construction — the lightbox pages
// through exactly the set the grid is showing.

/** The "no filter" token, used by both chip rows. */
export const FILTER_ALL = 'all'

/**
 * Published items above which the category sub-filter appears. Below it the
 * grid is small enough to scan whole, and a second chip row is just noise.
 */
export const CATEGORY_FILTER_THRESHOLD = 8

/** Iconify names per content type — labels come from `STATUS_META` (00 §2.5). */
export const CONTENT_TYPE_ICONS = Object.freeze({
  [CONTENT_TYPE.PHOTO]: 'tabler:photo',
  [CONTENT_TYPE.VIDEO]: 'tabler:video',
  [CONTENT_TYPE.BUNDLE]: 'tabler:package',
})

/** The default (unfiltered) selection. */
export const DEFAULT_PORTFOLIO_FILTER = Object.freeze({
  type: FILTER_ALL,
  category: FILTER_ALL,
})

/**
 * Content-type chips, in enum order and **only for the types this creator
 * actually published** — an empty "Video" filter is a dead end, not a choice.
 *
 * @param {object[]} items published portfolio items
 * @returns {{value: string, label: string, icon?: string, count: number}[]}
 */
export function buildTypeOptions(items = []) {
  const counts = new Map()
  items.forEach((item) => {
    counts.set(item.contentType, (counts.get(item.contentType) ?? 0) + 1)
  })

  const present = Object.values(CONTENT_TYPE)
    .filter((type) => counts.has(type))
    .map((type) => ({
      value: type,
      label: STATUS_META[type]?.label ?? type,
      icon: CONTENT_TYPE_ICONS[type],
      count: counts.get(type),
    }))

  // One type means one chip plus "All" — the same grid twice. Offer nothing.
  if (present.length < 2) return []

  return [{ value: FILTER_ALL, label: 'All', count: items.length }, ...present]
}

/**
 * Category chips for the sub-filter, counted against the items left after the
 * type filter so the numbers match what a click will actually show.
 *
 * @param {object[]} items items the type filter already narrowed to
 * @param {Object<string, string>} [categoryNames] category id → display name
 * @returns {{value: string, label: string, count: number}[]}
 */
export function buildCategoryOptions(items = [], categoryNames = {}) {
  const counts = new Map()
  items.forEach((item) => {
    if (!item.categoryId) return
    counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + 1)
  })

  if (counts.size < 2) return []

  const options = [...counts.entries()]
    .map(([categoryId, count]) => ({
      value: categoryId,
      label: categoryNames[categoryId] ?? categoryId,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))

  return [{ value: FILTER_ALL, label: 'All work', count: items.length }, ...options]
}

/**
 * Applies a selection to the published set.
 *
 * @param {object[]} items published portfolio items
 * @param {{type?: string, category?: string}} [filter]
 * @returns {object[]} the items the gallery shows, in the order given
 */
export function filterPortfolioItems(items = [], filter = DEFAULT_PORTFOLIO_FILTER) {
  const { type = FILTER_ALL, category = FILTER_ALL } = filter

  return items.filter((item) => {
    if (type !== FILTER_ALL && item.contentType !== type) return false
    if (category !== FILTER_ALL && item.categoryId !== category) return false
    return true
  })
}
