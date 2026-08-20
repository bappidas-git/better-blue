import { CREATOR_LEVEL, getCreatorLevelMeta } from '@/constants/creatorLevels'
import {
  CREATOR_FEED_SORT,
  CREATORS_PAGE_SIZE,
  NEW_CREATOR_DAYS,
  TOP_RATED_MIN,
} from '@/services/creatorMetaService'

import { discoveryParam } from '../hooks/useDiscoveryParams'

// The creators page's filter contract in one place — Storefront V2
// (`prompts-v2/09` §2): what the query string is allowed to say, what each
// control offers, and how both turn into `creatorMetaService.listCreators`
// parameters.
//
// This file **replaces** the Prompt 12 discovery contract, which carried a
// search box, a category list, a content-type list, a price range, a rating
// floor, an availability switch, and a page number. The V2 page asks a
// different question — *which people*, in *what order* — and answers it with
// seven chips and a sort. There is no category filter here and there must not
// be one (§"Do NOT"). Availability is no longer a filter either: it is a
// condition of appearing at all, and `creatorMetaService` applies it.
//
// The mirror of `features/feeds/utils/feedFilters.js`, deliberately the same
// shape, so the two social surfaces read as one system.

/**
 * Query-string keys. Two, because a chip row is one repeatable key and an
 * ordering is one choice — and frozen, because a renamed key silently breaks
 * every link already sent.
 *
 * There is no `page` key: which page of an infinite list you happen to have
 * scrolled to is not state worth putting in a URL, and `useInfiniteList`
 * restores the accumulated pages on in-app back navigation anyway.
 */
export const CREATOR_PARAM = Object.freeze({
  FILTER: 'filter',
  SORT: 'sort',
})

/**
 * The chip vocabulary. One repeatable `?filter=` key carries them —
 * `/creators?filter=online&filter=level3` — rather than a key per chip, so the
 * row is its own source of truth and "clear all" is one write.
 */
export const CREATOR_FILTER = Object.freeze({
  ONLINE: 'online',
  LEVEL_1: 'level1',
  LEVEL_2: 'level2',
  LEVEL_3: 'level3',
  TOP_RATED: 'top_rated',
  NEW: 'new',
  VERIFIED: 'verified',
})

/** Chip token → the `CREATOR_LEVEL` it selects. */
const LEVEL_BY_FILTER = Object.freeze({
  [CREATOR_FILTER.LEVEL_1]: CREATOR_LEVEL.ONE,
  [CREATOR_FILTER.LEVEL_2]: CREATOR_LEVEL.TWO,
  [CREATOR_FILTER.LEVEL_3]: CREATOR_LEVEL.THREE,
})

/**
 * The chip row, in display order.
 *
 * Presence first (who can answer you now), then track record (the three
 * levels), then the two quality signals a buyer asks for by name. Icons are
 * decorative; the label carries it.
 *
 * The level labels come from `CREATOR_LEVEL_META` rather than being written
 * here, so a chip and the badge on the card it filters for can never disagree.
 */
export const CREATOR_FILTER_OPTIONS = Object.freeze([
  Object.freeze({ value: CREATOR_FILTER.ONLINE, label: 'Online now', icon: 'tabler:point-filled' }),
  ...Object.entries(LEVEL_BY_FILTER).map(([value, level]) =>
    Object.freeze({
      value,
      label: getCreatorLevelMeta(level).label,
      icon: 'solar:medal-ribbon-star-linear',
    })
  ),
  Object.freeze({ value: CREATOR_FILTER.TOP_RATED, label: 'Top rated', icon: 'tabler:star' }),
  Object.freeze({ value: CREATOR_FILTER.NEW, label: 'New creators', icon: 'tabler:sparkles' }),
  Object.freeze({
    value: CREATOR_FILTER.VERIFIED,
    label: 'Verified',
    icon: 'tabler:rosette-discount-check',
  }),
])

const FILTER_VALUES = CREATOR_FILTER_OPTIONS.map((option) => option.value)

/**
 * The sort menu (§2). `value` is both the URL token and the service's `sort`
 * argument — which stored column each resolves to is `creatorMetaService`'s
 * business, not a page's.
 */
export const CREATOR_SORT_OPTIONS = Object.freeze([
  Object.freeze({ value: CREATOR_FEED_SORT.RECOMMENDED, label: 'Recommended' }),
  Object.freeze({ value: CREATOR_FEED_SORT.MOST_DELIVERIES, label: 'Highest deliveries' }),
  Object.freeze({ value: CREATOR_FEED_SORT.TOP_RATED, label: 'Top rated' }),
  Object.freeze({ value: CREATOR_FEED_SORT.PRICE_LOW_HIGH, label: 'Price: Low to High' }),
  Object.freeze({ value: CREATOR_FEED_SORT.PRICE_HIGH_LOW, label: 'Price: High to Low' }),
  Object.freeze({ value: CREATOR_FEED_SORT.NEWEST, label: 'Newest' }),
])

const SORT_VALUES = CREATOR_SORT_OPTIONS.map((option) => option.value)

/** How each ordering reads in the live status line. */
const ORDERING_LABELS = Object.freeze({
  [CREATOR_FEED_SORT.RECOMMENDED]: 'Recommended',
  [CREATOR_FEED_SORT.MOST_DELIVERIES]: 'Most deliveries first',
  [CREATOR_FEED_SORT.TOP_RATED]: 'Best rated first',
  [CREATOR_FEED_SORT.PRICE_LOW_HIGH]: 'Price: low to high',
  [CREATOR_FEED_SORT.PRICE_HIGH_LOW]: 'Price: high to low',
  [CREATOR_FEED_SORT.NEWEST]: 'Newest first',
})

/** The width the header, the filter bar, and the card column share (§1). */
export const CREATORS_CONTENT_MAX_WIDTH = 940

/** Creators per page — the service's own page size, so the two cannot drift. */
export { CREATORS_PAGE_SIZE }

/**
 * The schema `useDiscoveryParams` runs the URL through. Frozen at module scope
 * so its identity is stable — the hook memoises on it.
 *
 * Both keys are total: an invented chip token or an unknown sort resolves to
 * the default rather than reaching the service (00 §13).
 */
export const creatorsSchema = Object.freeze({
  [CREATOR_PARAM.FILTER]: discoveryParam.list({
    allow: (value) => FILTER_VALUES.includes(value),
    max: FILTER_VALUES.length,
  }),
  [CREATOR_PARAM.SORT]: discoveryParam.choice({
    options: SORT_VALUES,
    fallback: CREATOR_FEED_SORT.RECOMMENDED,
    // A sort is not a filter: "Clear" returns the chips to none and leaves the
    // ordering alone, and the active-filter badge does not count it.
    isFilter: false,
  }),
})

/** The selected chip tokens, always an array. */
const chipsOf = (values) =>
  Array.isArray(values?.[CREATOR_PARAM.FILTER]) ? values[CREATOR_PARAM.FILTER] : []

const sortOf = (values) => values?.[CREATOR_PARAM.SORT] ?? CREATOR_FEED_SORT.RECOMMENDED

/**
 * How the current view reads in a sentence — the live status line, and what a
 * screen reader hears when a control changes (§2).
 *
 * @param {object} values parsed creator values
 * @returns {{scope: string, ordering: string, isNarrowed: boolean}} `scope` is
 *   empty when the view is the whole marketplace, so the line can say
 *   "10 creators · Recommended" rather than naming a filter nobody set
 */
export function describeCreatorView(values) {
  const chips = chipsOf(values)
  const labels = CREATOR_FILTER_OPTIONS.filter((option) => chips.includes(option.value)).map(
    (option) => option.label
  )

  return {
    scope: labels.join(' · '),
    ordering: ORDERING_LABELS[sortOf(values)] ?? ORDERING_LABELS[CREATOR_FEED_SORT.RECOMMENDED],
    isNarrowed: labels.length > 0,
  }
}

/**
 * How many of the controls that live in the mobile filter sheet are set — the
 * number on its "Filters" button.
 *
 * The sheet holds the whole panel below `md` (the chips *and* the sort), so
 * unlike the feeds bar this counts both. A sort left on Recommended is not a
 * filter and is not counted.
 *
 * @param {object} values parsed creator values
 * @returns {number}
 */
export function countSheetFilters(values) {
  const chips = chipsOf(values).length
  return chips + (sortOf(values) === CREATOR_FEED_SORT.RECOMMENDED ? 0 : 1)
}

/**
 * Parsed URL values → `creatorMetaService.listCreators` parameters.
 *
 * Only the service's documented vocabulary crosses this boundary (00 §10): no
 * field names, no `_gte` suffixes, no provider spellings. The chip tokens
 * become the four booleans and the level list the service takes; what those
 * mean as stored columns is decided there.
 *
 * @param {object} values parsed creator values
 * @param {object} [options]
 * @param {number} [options.limit=CREATORS_PAGE_SIZE] rows per page
 * @returns {object} params for `listCreators` (without `page`, which
 *   `useInfiniteList` owns)
 */
export function toCreatorListParams(values, { limit = CREATORS_PAGE_SIZE } = {}) {
  const chips = chipsOf(values)
  const levels = chips.map((token) => LEVEL_BY_FILTER[token]).filter(Boolean)

  const filters = {}
  if (chips.includes(CREATOR_FILTER.ONLINE)) filters.online = true
  if (chips.includes(CREATOR_FILTER.TOP_RATED)) filters.topRated = true
  if (chips.includes(CREATOR_FILTER.NEW)) filters.newCreators = true
  if (chips.includes(CREATOR_FILTER.VERIFIED)) filters.verified = true
  if (levels.length > 0) filters.levels = levels

  return { limit, sort: sortOf(values), filters }
}

/**
 * What the two threshold chips promise, spelled out for the filter sheet — the
 * numbers come from the service so the copy cannot drift from the query.
 */
export const FILTER_HINTS = Object.freeze({
  [CREATOR_FILTER.TOP_RATED]: `Rated ${TOP_RATED_MIN} and above`,
  [CREATOR_FILTER.NEW]: `Joined in the last ${NEW_CREATOR_DAYS} days`,
})
