import { FEED_DEAL_STATUS } from '@/constants/feedStatus'
import { listParam } from '@/hooks/useListParams'
import { FEED_SORT } from '@/services/feedService'

// The feeds timeline's filter contract in one place — Storefront V2
// (`prompts-v2/07` §2): what the query string is allowed to say, what each
// control offers, and how both turn into `feedService.listFeeds` parameters.
//
// The mirror of `features/requests/utils/boardFilters.js`, deliberately much
// smaller. The board asked a creator to narrow by category, content type,
// budget, and deadline; a timeline asks one question — *which* feeds, in *what*
// order — and answers it with four chips, a price sort, and a switch. There is
// no category filter here and there must not be one (§"Do NOT").

/**
 * Query-string keys. Short, because these end up in shared links, and frozen
 * because a renamed key silently breaks every link already sent.
 *
 * There is no `page` key: which page of an infinite list you happen to have
 * scrolled to is not state worth putting in a URL, and `useInfiniteList`
 * restores the accumulated pages on in-app back navigation anyway (§3).
 */
export const FEED_PARAM = Object.freeze({
  FILTER: 'filter',
  PRICE: 'price',
  OPEN_ONLY: 'open',
})

/** The primary chips. Single-select: a timeline has one shape at a time. */
export const FEED_FILTER = Object.freeze({
  LATEST: 'latest',
  MOST_REPLIES: 'replies',
  OPEN: 'open',
  CLOSED: 'closed',
})

/** The price sort, which is off by default — `none` is a real, chosen state. */
export const FEED_PRICE_SORT = Object.freeze({
  NONE: 'none',
  LOW_HIGH: 'low',
  HIGH_LOW: 'high',
})

/** Feeds per page. A timeline page is a scroll's worth, not a screen's worth. */
export const FEEDS_PAGE_SIZE = 10

/**
 * The width the page header and the filter bar are laid out in.
 *
 * Wider than the 680px card column, because four chips plus a sort and a
 * switch do not fit in it — but a *shared* width, so the header, the controls,
 * and the column all sit on one centre axis instead of three.
 */
export const FEEDS_CONTENT_MAX_WIDTH = 940

/**
 * What each chip *does*, which is not the same thing for all four.
 *
 * `latest` and `replies` are **orderings** over the whole public board;
 * `open` and `closed` are **filters** that keep the board's default order. That
 * asymmetry is the whole reason the price sort needs the interplay rule below:
 * a price sort replaces what the first two chips contribute and merely reorders
 * what the last two select.
 */
const FILTER_SPECS = Object.freeze({
  [FEED_FILTER.LATEST]: Object.freeze({
    ordering: FEED_SORT.LATEST,
    orderingLabel: 'Newest first',
    dealStatus: null,
    scopeLabel: 'All feeds',
  }),
  [FEED_FILTER.MOST_REPLIES]: Object.freeze({
    ordering: FEED_SORT.MOST_REPLIES,
    orderingLabel: 'Most replies first',
    dealStatus: null,
    scopeLabel: 'All feeds',
  }),
  [FEED_FILTER.OPEN]: Object.freeze({
    ordering: FEED_SORT.LATEST,
    orderingLabel: 'Newest first',
    dealStatus: FEED_DEAL_STATUS.OPEN,
    scopeLabel: 'Open deals',
  }),
  [FEED_FILTER.CLOSED]: Object.freeze({
    ordering: FEED_SORT.LATEST,
    orderingLabel: 'Newest first',
    dealStatus: Object.freeze([FEED_DEAL_STATUS.CLOSED, FEED_DEAL_STATUS.DELIVERED]),
    scopeLabel: 'Closed & delivered',
  }),
})

/** Chip row, in display order. Icons are decorative; the label carries it. */
export const FEED_FILTER_OPTIONS = Object.freeze([
  Object.freeze({ value: FEED_FILTER.LATEST, label: 'Latest', icon: 'tabler:clock-hour-3' }),
  Object.freeze({
    value: FEED_FILTER.MOST_REPLIES,
    label: 'Most replies',
    icon: 'tabler:message-circle',
  }),
  Object.freeze({ value: FEED_FILTER.OPEN, label: 'Open deals', icon: 'tabler:circle-dot' }),
  Object.freeze({
    value: FEED_FILTER.CLOSED,
    label: 'Closed & delivered',
    icon: 'tabler:circle-check',
  }),
])

/** Price-sort select, in display order. */
export const PRICE_SORT_OPTIONS = Object.freeze([
  Object.freeze({ value: FEED_PRICE_SORT.NONE, label: 'None' }),
  Object.freeze({ value: FEED_PRICE_SORT.LOW_HIGH, label: 'Price: Low to High' }),
  Object.freeze({ value: FEED_PRICE_SORT.HIGH_LOW, label: 'Price: High to Low' }),
])

/** Price choice → the service's sort token, and how the UI says it. */
const PRICE_SORTS = Object.freeze({
  [FEED_PRICE_SORT.LOW_HIGH]: Object.freeze({
    ordering: FEED_SORT.PRICE_ASC,
    orderingLabel: 'Price: low to high',
  }),
  [FEED_PRICE_SORT.HIGH_LOW]: Object.freeze({
    ordering: FEED_SORT.PRICE_DESC,
    orderingLabel: 'Price: high to low',
  }),
})

const FILTER_VALUES = Object.values(FEED_FILTER)
const PRICE_VALUES = Object.values(FEED_PRICE_SORT)

/**
 * The schema `useListParams` runs the URL through. Frozen at module scope so
 * its identity is stable — the hook memoises on it.
 *
 * All three are filters, so "Clear" returns the timeline to Latest / no price
 * sort / open-only off in one action, and the active-filter badge counts what a
 * visitor would have to undo.
 */
export const feedsSchema = Object.freeze({
  [FEED_PARAM.FILTER]: listParam.choice({
    options: FILTER_VALUES,
    fallback: FEED_FILTER.LATEST,
  }),
  [FEED_PARAM.PRICE]: listParam.choice({
    options: PRICE_VALUES,
    fallback: FEED_PRICE_SORT.NONE,
  }),
  [FEED_PARAM.OPEN_ONLY]: listParam.flag({ fallback: false }),
})

/** The chip's own spec, tolerant of a value the URL invented. */
const specFor = (values) =>
  FILTER_SPECS[values?.[FEED_PARAM.FILTER]] ?? FILTER_SPECS[FEED_FILTER.LATEST]

/**
 * Is the "Open deals only" switch redundant — i.e. already implied by the chip?
 *
 * The switch is rendered on and disabled in that state rather than hidden: a
 * control that vanishes when it becomes true is a control a visitor stops
 * trusting (§2, "redundant-safe with the Open chip").
 *
 * @param {object} values parsed feed values
 * @returns {boolean}
 */
export function isOpenOnlyLocked(values) {
  return values?.[FEED_PARAM.FILTER] === FEED_FILTER.OPEN
}

/**
 * Does the price sort own the ordering *instead of* the active chip?
 *
 * True only for the two chips that are themselves orderings: picking a price
 * sort while "Open deals" is active reorders that selection and takes nothing
 * away, but picking one while "Latest" is active means Latest is no longer
 * doing anything at all. The filter bar says so out loud (§2).
 *
 * @param {object} values parsed feed values
 * @returns {boolean}
 */
export function isOrderingOverridden(values) {
  const filter = values?.[FEED_PARAM.FILTER] ?? FEED_FILTER.LATEST
  const price = values?.[FEED_PARAM.PRICE] ?? FEED_PRICE_SORT.NONE
  return (
    price !== FEED_PRICE_SORT.NONE &&
    (filter === FEED_FILTER.LATEST || filter === FEED_FILTER.MOST_REPLIES)
  )
}

/**
 * How the current view reads in a sentence — the live status line, and the
 * announcement a screen reader hears when a control changes (§2, §"Verify" 3).
 *
 * @param {object} values parsed feed values
 * @returns {{scope: string, ordering: string, chipLabel: string, isNarrowed: boolean}}
 *   `isNarrowed` is false when the view is the whole board, so the status line
 *   can say "61 feeds · Newest first" rather than "61 feeds · All feeds · …"
 */
export function describeFeedView(values) {
  const spec = specFor(values)
  const price = PRICE_SORTS[values?.[FEED_PARAM.PRICE]]
  const openOnly = Boolean(values?.[FEED_PARAM.OPEN_ONLY]) && !isOpenOnlyLocked(values)

  return {
    scope: openOnly ? `${spec.scopeLabel}, open only` : spec.scopeLabel,
    ordering: price ? price.orderingLabel : spec.orderingLabel,
    chipLabel:
      FEED_FILTER_OPTIONS.find((option) => option.value === values?.[FEED_PARAM.FILTER])?.label ??
      FEED_FILTER_OPTIONS[0].label,
    isNarrowed: Boolean(spec.dealStatus) || openOnly,
  }
}

/**
 * How many of the controls that live in the mobile filter sheet are set — the
 * number on its "Filters" button. The chips are in the bar, not the sheet, so
 * they are deliberately not counted.
 *
 * @param {object} values parsed feed values
 * @returns {number}
 */
export function countSheetFilters(values) {
  let count = 0
  if (values?.[FEED_PARAM.PRICE] !== FEED_PRICE_SORT.NONE) count += 1
  if (values?.[FEED_PARAM.OPEN_ONLY] && !isOpenOnlyLocked(values)) count += 1
  return count
}

/**
 * Parsed URL values → `feedService.listFeeds` parameters.
 *
 * Only the service's documented vocabulary crosses this boundary: a deal
 * status, an `openOnly` flag, and a `FEED_SORT` token. The **interplay rule**
 * lives here and nowhere else — a price sort replaces the chip's ordering while
 * leaving the chip's filtering alone, which is what makes "Open deals" +
 * "Price: low to high" mean the cheapest open feed first.
 *
 * @param {object} values parsed feed values
 * @param {object} [options]
 * @param {number} [options.limit=FEEDS_PAGE_SIZE] rows per page
 * @returns {object} params for `feedService.listFeeds` (without `page`, which
 *   `useInfiniteList` owns)
 */
export function toFeedListParams(values, { limit = FEEDS_PAGE_SIZE } = {}) {
  const spec = specFor(values)
  const price = PRICE_SORTS[values?.[FEED_PARAM.PRICE]]

  const filters = {}
  if (spec.dealStatus) filters.dealStatus = spec.dealStatus
  // The chip already constrains the query, so the switch only has to say so
  // when it is the thing doing the constraining. `listFeeds` intersects rather
  // than replaces, so passing both would be harmless — but it would also put a
  // redundant parameter in every request the Open chip makes.
  if (values?.[FEED_PARAM.OPEN_ONLY] && !isOpenOnlyLocked(values)) filters.openOnly = true

  return {
    limit,
    sort: price ? price.ordering : spec.ordering,
    filters,
  }
}
