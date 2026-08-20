import { CONTENT_TYPE, STATUS_META } from '@/constants/statuses'

// What the portfolio gallery is allowed to filter by, and how a filter turns
// into a set of items. Kept beside the components rather than inside them so
// the gallery and its filter bar agree by construction — the lightbox pages
// through exactly the set the grid is showing.

/** The "no filter" token, used by both chip rows. */
export const FILTER_ALL = 'all'

/** Iconify names per content type — labels come from `STATUS_META` (00 §2.5). */
export const CONTENT_TYPE_ICONS = Object.freeze({
  [CONTENT_TYPE.PHOTO]: 'tabler:photo',
  [CONTENT_TYPE.VIDEO]: 'tabler:video',
  [CONTENT_TYPE.BUNDLE]: 'tabler:package',
})

/**
 * The default (unfiltered) selection.
 *
 * V2-10: content type is the only axis left. The category sub-filter went with
 * every other category control on the storefront — the taxonomy still exists in
 * the database and in the admin console, it is simply not something a visitor
 * browses by any more.
 */
export const DEFAULT_PORTFOLIO_FILTER = Object.freeze({ type: FILTER_ALL })

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
 * Applies a selection to the published set.
 *
 * @param {object[]} items published portfolio items
 * @param {{type?: string}} [filter]
 * @returns {object[]} the items the gallery shows, in the order given
 */
export function filterPortfolioItems(items = [], filter = DEFAULT_PORTFOLIO_FILTER) {
  const { type = FILTER_ALL } = filter
  if (type === FILTER_ALL) return items

  return items.filter((item) => item.contentType === type)
}
