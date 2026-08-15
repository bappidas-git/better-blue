import { CONTENT_TYPE, STATUS_META } from '@/constants/statuses'
import { CREATOR_ORDERING } from '@/services'

import { discoveryParam } from '../hooks/useDiscoveryParams'

// The creator-discovery filter contract in one place: what the query string is
// allowed to say, what each control offers, and how both translate into
// `creatorProfileService.search` parameters.
//
// Everything the discovery components need to *decide* something lives here, so
// the components stay declarative (§7) and the page never hand-assembles a
// service call.

/**
 * Query-string keys. Short on purpose — these end up in shared links — and
 * frozen, because the landing page's category tiles already deep-link
 * `?category=cat_…` and Prompt 11 shipped against that spelling.
 */
export const CREATOR_PARAM = Object.freeze({
  SEARCH: 'q',
  CATEGORY: 'category',
  CONTENT_TYPE: 'type',
  PRICE_MIN: 'min',
  PRICE_MAX: 'max',
  RATING: 'rating',
  AVAILABLE: 'available',
  SORT: 'sort',
  PAGE: 'page',
})

/** Cards per page: two full rows on the four-column layout, four on mobile. */
export const CREATORS_PAGE_SIZE = 8

/**
 * Starting-price slider bounds. The top stop is a **cap, not a ceiling**: at
 * `max` no `priceMax` is sent at all, so it reads "$2,000+" and keeps the
 * long tail visible.
 */
export const PRICE_RANGE = Object.freeze({ min: 0, max: 2000, step: 20 })

/** Minimum-rating steps offered by the star selector. */
export const RATING_OPTIONS = Object.freeze([
  Object.freeze({ value: 3, label: '3.0+' }),
  Object.freeze({ value: 4, label: '4.0+' }),
  Object.freeze({ value: 4.5, label: '4.5+' }),
])

const RATING_VALUES = RATING_OPTIONS.map((option) => option.value)

/** Iconify names per content type — labels come from `STATUS_META` (00 §2.5). */
const CONTENT_TYPE_ICONS = Object.freeze({
  [CONTENT_TYPE.PHOTO]: 'tabler:photo',
  [CONTENT_TYPE.VIDEO]: 'tabler:video',
  [CONTENT_TYPE.BUNDLE]: 'tabler:package',
})

/** Chip options for the content-type filter, in enum order. */
export const CONTENT_TYPE_OPTIONS = Object.freeze(
  Object.values(CONTENT_TYPE).map((value) =>
    Object.freeze({
      value,
      label: STATUS_META[value]?.label ?? value,
      icon: CONTENT_TYPE_ICONS[value],
    })
  )
)

const CONTENT_TYPE_VALUES = Object.values(CONTENT_TYPE)

/**
 * Sort menu. `value` is both the URL token and the service's `ordering`
 * argument — which stored column each resolves to is the service's business
 * (`CREATOR_ORDERING`), not the page's.
 */
export const SORT_OPTIONS = Object.freeze([
  Object.freeze({ value: CREATOR_ORDERING.RECOMMENDED, label: 'Recommended' }),
  Object.freeze({ value: CREATOR_ORDERING.TOP_RATED, label: 'Top rated' }),
  Object.freeze({ value: CREATOR_ORDERING.PRICE_LOW_HIGH, label: 'Price: low to high' }),
  Object.freeze({ value: CREATOR_ORDERING.PRICE_HIGH_LOW, label: 'Price: high to low' }),
  Object.freeze({ value: CREATOR_ORDERING.NEWEST, label: 'Newest' }),
])

const SORT_VALUES = SORT_OPTIONS.map((option) => option.value)

/** Groups the price pair so "Filters (2)" never means "you moved one slider". */
const PRICE_GROUP = 'price'

/**
 * The schema `useDiscoveryParams` runs the URL through. Frozen at module scope
 * so its identity is stable — the hook memoises on it.
 */
export const creatorDiscoverySchema = Object.freeze({
  [CREATOR_PARAM.SEARCH]: discoveryParam.text(),

  // Category ids are validated against the live taxonomy passed as `context`;
  // an id that no longer exists is dropped rather than sent to the API.
  [CREATOR_PARAM.CATEGORY]: discoveryParam.list({
    allow: (value, context) => !context?.categoryIds || context.categoryIds.has(value),
  }),

  [CREATOR_PARAM.CONTENT_TYPE]: discoveryParam.list({
    allow: (value) => CONTENT_TYPE_VALUES.includes(value),
  }),

  [CREATOR_PARAM.PRICE_MIN]: discoveryParam.number({
    fallback: PRICE_RANGE.min,
    min: PRICE_RANGE.min,
    max: PRICE_RANGE.max,
    integer: true,
    group: PRICE_GROUP,
  }),
  [CREATOR_PARAM.PRICE_MAX]: discoveryParam.number({
    fallback: PRICE_RANGE.max,
    min: PRICE_RANGE.min,
    max: PRICE_RANGE.max,
    integer: true,
    group: PRICE_GROUP,
  }),

  [CREATOR_PARAM.RATING]: discoveryParam.number({ fallback: null, oneOf: RATING_VALUES }),

  // Default on: discovery should show people who can actually take the work.
  [CREATOR_PARAM.AVAILABLE]: discoveryParam.flag({ fallback: true }),

  [CREATOR_PARAM.SORT]: discoveryParam.choice({
    options: SORT_VALUES,
    fallback: CREATOR_ORDERING.RECOMMENDED,
    isFilter: false,
  }),

  [CREATOR_PARAM.PAGE]: discoveryParam.number({
    fallback: 1,
    min: 1,
    max: 9999,
    integer: true,
    isFilter: false,
  }),
})

/**
 * The slider's `[low, high]` pair, ordered even if someone hand-edits the URL
 * into `?min=900&max=100`.
 *
 * @param {object} values parsed discovery values
 * @returns {[number, number]}
 */
export function readPriceRange(values) {
  const low = values[CREATOR_PARAM.PRICE_MIN]
  const high = values[CREATOR_PARAM.PRICE_MAX]
  return low <= high ? [low, high] : [high, low]
}

/**
 * Parsed URL values → `creatorProfileService.search` parameters.
 *
 * Only the service's documented vocabulary crosses this boundary (§7): no field
 * names, no `_gte` suffixes, no provider spellings. Anything at its default is
 * omitted entirely, which is what makes the top of the price slider mean
 * "$2,000+" and the rating chips mean "no minimum" when none is picked.
 *
 * @param {object} values parsed discovery values
 * @param {object} [options]
 * @param {number} [options.limit=CREATORS_PAGE_SIZE] page size
 * @returns {object} params for `creatorProfileService.search`
 */
export function toCreatorSearchParams(values, { limit = CREATORS_PAGE_SIZE } = {}) {
  const [priceMin, priceMax] = readPriceRange(values)
  const categories = values[CREATOR_PARAM.CATEGORY]
  const contentTypes = values[CREATOR_PARAM.CONTENT_TYPE]

  return {
    page: values[CREATOR_PARAM.PAGE],
    limit,
    ordering: values[CREATOR_PARAM.SORT],
    search: values[CREATOR_PARAM.SEARCH] || undefined,
    // Only ever a positive filter: switching it off widens the result set to
    // everyone rather than inverting it into "unavailable creators".
    availability: values[CREATOR_PARAM.AVAILABLE] ? true : undefined,
    category: categories.length > 0 ? categories : undefined,
    contentType: contentTypes.length > 0 ? contentTypes : undefined,
    priceMin: priceMin > PRICE_RANGE.min ? priceMin : undefined,
    priceMax: priceMax < PRICE_RANGE.max ? priceMax : undefined,
    ratingMin: values[CREATOR_PARAM.RATING] ?? undefined,
  }
}
