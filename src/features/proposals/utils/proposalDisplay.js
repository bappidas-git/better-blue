import { PROPOSAL_STATUS } from '@/constants/statuses'

// How the buyer's proposal board orders, filters, and reads a set of offers.
//
// All of it is in memory: a brief carries a handful of offers and
// `proposalService.listForRequestReview` fetches the whole set in one go, so
// changing the sort is instant and does not cost a round trip. It also has to
// be in memory — "by rating" sorts on a column that lives on the creator's
// storefront, not on the offer (see that function's MOCK-SORT note).

/** Offers the buyer has not decided on — the ones still worth comparing. */
export const LIVE_PROPOSAL_STATUSES = Object.freeze([
  PROPOSAL_STATUS.SUBMITTED,
  PROPOSAL_STATUS.SHORTLISTED,
])

/** Can this offer still be accepted or declined? */
export const isLiveProposal = (proposal) =>
  LIVE_PROPOSAL_STATUSES.includes(proposal?.status)

export const PROPOSAL_SORT = Object.freeze({
  SHORTLISTED: 'shortlisted',
  PRICE: 'price',
  RATING: 'rating',
  DELIVERY: 'delivery',
})

export const PROPOSAL_SORT_OPTIONS = Object.freeze([
  Object.freeze({ value: PROPOSAL_SORT.SHORTLISTED, label: 'Shortlisted first' }),
  Object.freeze({ value: PROPOSAL_SORT.PRICE, label: 'Lowest price' }),
  Object.freeze({ value: PROPOSAL_SORT.RATING, label: 'Highest rated' }),
  Object.freeze({ value: PROPOSAL_SORT.DELIVERY, label: 'Fastest delivery' }),
])

export const PROPOSAL_FILTER = Object.freeze({ ALL: 'all', SHORTLISTED: 'shortlisted' })

/** A missing number sorts last in every ordering, rather than as a zero. */
const asc = (value) => (Number.isFinite(Number(value)) ? Number(value) : Number.POSITIVE_INFINITY)
const desc = (value) => (Number.isFinite(Number(value)) ? Number(value) : Number.NEGATIVE_INFINITY)

/**
 * A decided offer never outranks a live one, whatever the sort says: a declined
 * proposal at the cheapest price is not the top of a price list the buyer is
 * still choosing from. Within each half, the chosen ordering applies.
 */
const liveFirst = (a, b) => Number(isLiveProposal(b)) - Number(isLiveProposal(a))

const COMPARATORS = {
  [PROPOSAL_SORT.SHORTLISTED]: (a, b) => {
    const starred =
      Number(b.status === PROPOSAL_STATUS.SHORTLISTED) -
      Number(a.status === PROPOSAL_STATUS.SHORTLISTED)
    return starred !== 0 ? starred : asc(a.price) - asc(b.price)
  },
  [PROPOSAL_SORT.PRICE]: (a, b) => asc(a.price) - asc(b.price),
  [PROPOSAL_SORT.RATING]: (a, b) => desc(b.creator?.ratingAvg) - desc(a.creator?.ratingAvg),
  [PROPOSAL_SORT.DELIVERY]: (a, b) => asc(a.deliveryDays) - asc(b.deliveryDays),
}

/**
 * Orders and filters a set of offers for display.
 *
 * @param {object[]} proposals enriched offers from `listForRequestReview`
 * @param {object} [options]
 * @param {string} [options.sort] a `PROPOSAL_SORT` value
 * @param {string} [options.filter] a `PROPOSAL_FILTER` value
 * @returns {object[]} a new array — the input is never mutated
 */
export function arrangeProposals(proposals = [], { sort, filter } = {}) {
  const comparator = COMPARATORS[sort] ?? COMPARATORS[PROPOSAL_SORT.SHORTLISTED]

  const kept =
    filter === PROPOSAL_FILTER.SHORTLISTED
      ? proposals.filter((proposal) => proposal.status === PROPOSAL_STATUS.SHORTLISTED)
      : proposals

  return [...kept].sort((a, b) => liveFirst(a, b) || comparator(a, b))
}

/**
 * The best price and the fastest turnaround among the offers being compared —
 * the two cells the compare table quietly highlights (§6).
 *
 * Only live offers are eligible: highlighting the best price on a proposal that
 * has already been declined would be pointing at something unbuyable.
 *
 * @param {object[]} proposals the offers on screen
 * @returns {{price: number|null, deliveryDays: number|null}}
 */
export function bestOf(proposals = []) {
  const live = proposals.filter(isLiveProposal)
  if (live.length < 2) return { price: null, deliveryDays: null }

  const lowest = (values) => {
    const numbers = values.filter((value) => Number.isFinite(Number(value))).map(Number)
    return numbers.length > 0 ? Math.min(...numbers) : null
  }

  return {
    price: lowest(live.map((proposal) => proposal.price)),
    deliveryDays: lowest(live.map((proposal) => proposal.deliveryDays)),
  }
}

/**
 * Portfolio items → `MediaLightbox` items (Prompt 04). Alt text is required for
 * images, so it always falls back to the item's title.
 *
 * @param {object[]} samples `portfolioItems` attached to an offer
 * @param {string} [creatorName] used in the alt text, e.g. "…, by Ava Martinez"
 * @returns {{id: string, type: string, src: string, poster?: string, alt: string, caption: string}[]}
 */
export function toMediaItems(samples = [], creatorName) {
  return samples.map((item) => ({
    id: item.id,
    type: item.mediaType === 'video' ? 'video' : 'image',
    src: item.mediaUrl,
    poster: item.thumbnailUrl,
    alt: creatorName ? `${item.title} — sample work by ${creatorName}` : item.title,
    caption: item.title,
  }))
}
