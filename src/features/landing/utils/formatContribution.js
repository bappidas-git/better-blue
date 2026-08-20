import { formatNumber } from '@/utils/formatters'

// How the hero prints a creator's `contributionCounts`: `112+ Images · 67 Videos`.
//
// Feature-local on purpose. This is marketing phrasing — title-cased units, a
// `+` that turns a total into a floor — and not a domain format: the dashboard
// and admin screens count the same records and print them their own way, so
// putting this in `utils/formatters.js` would invite them to inherit copy they
// do not want.

/** At or above this a figure reads as a floor rather than an exact total. */
const PLUS_THRESHOLD = 100

/** The two contribution kinds, in the order the hero prints them. */
const UNITS = [
  { key: 'images', one: 'Image', many: 'Images' },
  { key: 'videos', one: 'Video', many: 'Videos' },
]

/**
 * Formats a creator's contribution counts as one caption line.
 *
 * A kind with nothing in it is dropped rather than printed as a zero, so the
 * result is `''` for a storefront with no published work — the caller renders
 * nothing at all instead of "0 Images · 0 Videos".
 *
 * @param {{images?: number, videos?: number}} [counts] `contributionCounts`
 *   from `creatorMetaService`
 * @returns {string} e.g. `112+ Images · 67 Videos`, or `''` when both are empty
 *
 * @example
 * formatContribution({ images: 112, videos: 67 }) // '112+ Images · 67 Videos'
 * formatContribution({ images: 1, videos: 0 })    // '1 Image'
 */
export function formatContribution(counts) {
  return UNITS.map(({ key, one, many }) => {
    const value = Math.trunc(Number(counts?.[key]) || 0)
    if (value <= 0) return null

    const plus = value >= PLUS_THRESHOLD ? '+' : ''
    return `${formatNumber(value)}${plus} ${value === 1 ? one : many}`
  })
    .filter(Boolean)
    .join(' · ')
}

export default formatContribution
