// Creator storefront metadata for the V2 storefront surfaces — the ranked "Top
// Creators" row on the home page, the featured strip in the hero, and the
// creators page itself (`prompts-v2/03` §4, consumed by V2-04, V2-05, and the
// paged `listCreators` V2-09 added at the bottom of this file).
//
// A thin composition layer over `creatorProfileService` and its portfolio
// preview join: nothing here talks to the API client directly, and nothing here
// stores a figure of its own. `level`, `deliveriesCount`, `totalEarned`, and
// `contributionCounts` are fields on the `creatorProfiles` record (see
// `docs/data-model.md`), derived in the seed from the same ledger the earnings
// screens read.

import { CREATOR_LEVEL, getCreatorLevel } from '@/constants/creatorLevels'

import { SORT_ORDER } from './api/listAdapter'
import { creatorProfileService } from './creatorProfileService'

/**
 * Rows folded when ranking. Comfortably above the seeded twelve storefronts and
 * the provider's page ceiling (contract §4.1), so the ranking below sees the
 * whole marketplace rather than a page of it.
 */
const FOLD_LIMIT = 100

/** Thumbnails per creator in the Top Creators slider (V2-05 §3). */
const SLIDER_ITEMS = 8

/**
 * The ranking: **level, then rating, then deliveries.**
 *
 * Level first is the point of the section — it is the marketplace saying "these
 * people have done this a lot", and a five-star creator with two jobs behind
 * them has not yet. Rating breaks ties inside a level, and the delivery count
 * breaks ties inside a rating so the order is total and stable rather than
 * dependent on the order rows came back in.
 */
function byTopCreator(a, b) {
  const level = levelOf(b) - levelOf(a)
  if (level !== 0) return level

  const rating = (Number(b.ratingAvg) || 0) - (Number(a.ratingAvg) || 0)
  if (rating !== 0) return rating

  return (Number(b.deliveriesCount) || 0) - (Number(a.deliveriesCount) || 0)
}

/**
 * A storefront's level: the stored value when there is one, recomputed from the
 * same rule when there is not. A profile created by registration has neither
 * figure yet and is Level 1 — never `undefined`, which would sort unpredictably.
 */
function levelOf(profile) {
  return Number(profile?.level) || getCreatorLevel(profile)
}

/** Normalises the contribution pair so a card can render it without guarding. */
function contributionsOf(profile) {
  return {
    images: Number(profile?.contributionCounts?.images) || 0,
    videos: Number(profile?.contributionCounts?.videos) || 0,
  }
}

/* -------------------------------------------------------------------------- */
/* The creators page (V2-09)                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The orderings the creators page offers (V2-09 §2).
 *
 * Deliberately **not** `CREATOR_ORDERING`, which the retired discovery grid
 * used: two of these mean something different here. `recommended` is the
 * storefront's level-first composite rather than the grid's featured-first
 * Bayesian score, and `deliveries` counts `deliveriesCount` — every order a
 * creator has ever delivered, including the record they carried over — where
 * the grid's `most_orders` counted `completedOrders` on this platform alone.
 * Giving the two vocabularies one spelling would have made a shared link mean
 * different things on different screens.
 */
export const CREATOR_FEED_SORT = Object.freeze({
  RECOMMENDED: 'recommended',
  MOST_DELIVERIES: 'deliveries',
  TOP_RATED: 'rating',
  PRICE_LOW_HIGH: 'price_asc',
  PRICE_HIGH_LOW: 'price_desc',
  NEWEST: 'newest',
})

/** What the "Top rated" chip means, as a `ratingAvg` floor (V2-09 §2). */
export const TOP_RATED_MIN = 4.5

/** What the "New creators" chip means, as a tenure ceiling in days (V2-09 §2). */
export const NEW_CREATOR_DAYS = 60

/** Creators per page in the timeline — a scroll's worth, as Feeds sizes it. */
export const CREATORS_PAGE_SIZE = 8

/**
 * The provider field each sort reads. Only `recommended` has no single column,
 * so it borrows `level` — the first key of its composite — which is enough to
 * pull the right storefronts into the fold when the marketplace outgrows it.
 */
const SORT_FIELDS = Object.freeze({
  [CREATOR_FEED_SORT.RECOMMENDED]: { sort: 'level', order: SORT_ORDER.DESC },
  [CREATOR_FEED_SORT.MOST_DELIVERIES]: { sort: 'deliveriesCount', order: SORT_ORDER.DESC },
  [CREATOR_FEED_SORT.TOP_RATED]: { sort: 'ratingAvg', order: SORT_ORDER.DESC },
  [CREATOR_FEED_SORT.PRICE_LOW_HIGH]: { sort: 'startingPrice', order: SORT_ORDER.ASC },
  [CREATOR_FEED_SORT.PRICE_HIGH_LOW]: { sort: 'startingPrice', order: SORT_ORDER.DESC },
  [CREATOR_FEED_SORT.NEWEST]: { sort: 'createdAt', order: SORT_ORDER.DESC },
})

const numberOf = (value) => Number(value) || 0

/**
 * Every comparator ends on the id, so the order is **total**. Without it two
 * creators on the same price would swap places between one page request and the
 * next, and an infinite list would show one of them twice and the other never.
 */
const byId = (a, b) => String(a.id).localeCompare(String(b.id))

const COMPARATORS = Object.freeze({
  [CREATOR_FEED_SORT.RECOMMENDED]: (a, b) => byTopCreator(a, b) || byId(a, b),
  [CREATOR_FEED_SORT.MOST_DELIVERIES]: (a, b) =>
    numberOf(b.deliveriesCount) - numberOf(a.deliveriesCount) ||
    numberOf(b.ratingAvg) - numberOf(a.ratingAvg) ||
    byId(a, b),
  [CREATOR_FEED_SORT.TOP_RATED]: (a, b) =>
    numberOf(b.ratingAvg) - numberOf(a.ratingAvg) ||
    numberOf(b.ratingCount) - numberOf(a.ratingCount) ||
    byId(a, b),
  [CREATOR_FEED_SORT.PRICE_LOW_HIGH]: (a, b) =>
    numberOf(a.startingPrice) - numberOf(b.startingPrice) || byId(a, b),
  [CREATOR_FEED_SORT.PRICE_HIGH_LOW]: (a, b) =>
    numberOf(b.startingPrice) - numberOf(a.startingPrice) || byId(a, b),
  [CREATOR_FEED_SORT.NEWEST]: (a, b) =>
    Date.parse(b.createdAt ?? 0) - Date.parse(a.createdAt ?? 0) || byId(a, b),
})

/** The `CREATOR_LEVEL` values, so a hand-edited URL cannot ask for level 9. */
const LEVEL_VALUES = Object.values(CREATOR_LEVEL)

/**
 * The creators page's filter vocabulary → stored fields on `creatorProfiles`.
 *
 * The **one** place that mapping lives (00 §10): the page says "online",
 * "level 2", "top rated", and this decides that those are `isOnline`,
 * `level`, and a `ratingAvg` floor. Every one of them is a column, so all of
 * them are provider-side — nothing here narrows a result set in the browser.
 *
 * @param {object} [filters]
 * @param {boolean} [filters.online] only creators marked online
 * @param {number[]} [filters.levels] one or more `CREATOR_LEVEL` values (OR)
 * @param {boolean} [filters.topRated] `ratingAvg` at or above {@link TOP_RATED_MIN}
 * @param {boolean} [filters.newCreators] joined within {@link NEW_CREATOR_DAYS}
 * @param {boolean} [filters.verified] identity-verified storefronts only
 * @returns {object} filters for `creatorProfileService.search`
 */
function toRecordFilters({ online, levels, topRated, newCreators, verified } = {}) {
  const filters = {
    // The page shows people who can actually take the work, always. It is not
    // a filter a visitor can switch off — an unavailable storefront on a page
    // whose primary action is "Send message" is a dead end (V2-09 §1).
    availability: true,
  }

  if (online) filters.isOnline = true
  if (verified) filters.verified = true
  if (topRated) filters.ratingAvg_gte = TOP_RATED_MIN

  const wanted = (Array.isArray(levels) ? levels : [])
    .map(Number)
    .filter((level) => LEVEL_VALUES.includes(level))
  // Repeated `level=` parameters, which the adapter ORs (contract §4.3). All
  // three chips selected is the same set as none, so it is dropped rather than
  // sent as a three-way OR the provider would have to evaluate.
  if (wanted.length > 0 && wanted.length < LEVEL_VALUES.length) {
    filters.level = [...new Set(wanted)]
  }

  if (newCreators) {
    const since = new Date(Date.now() - NEW_CREATOR_DAYS * 24 * 60 * 60 * 1000)
    filters.createdAt_gte = since.toISOString()
  }

  return filters
}

export const creatorMetaService = Object.freeze({
  /**
   * **Top creators** for the home page row (V2-05 §3) — ranked storefronts,
   * each with a strip of their published work for the slider.
   *
   * MOCK-SORT: the ranking is a three-key composite and the provider sorts on
   * one field (contract §4.1), so the marketplace is fetched ordered by `level`
   * — which gets the right creators into the fold — and ordered properly here.
   * At {@link FOLD_LIMIT} storefronts that is exact; a real marketplace does it
   * with `ORDER BY level DESC, rating_avg DESC, deliveries_count DESC` and
   * returns a page.
   *
   * MOCK-JOIN: the portfolio strips are one request per creator (the same
   * batched helper the discovery grid uses), collapsing to
   * `GET /creators/top?include=portfolio` on migration day.
   *
   * @param {number} [limit=4] how many creators to return
   * @returns {Promise<object[]>} storefronts, best first, each with
   *   `portfolioItems` (published, up to eight) and a normalised
   *   `contributionCounts`
   *
   * **Future endpoint:** `GET /creators/top?limit=4&include=portfolio`.
   */
  async getTopCreators(limit = 4) {
    const { items } = await creatorProfileService.search({
      page: 1,
      limit: FOLD_LIMIT,
      sort: 'level',
      // Suspended and deactivated accounts stay out of the marketing surfaces,
      // exactly as they stay out of discovery.
      activeOwnersOnly: true,
    })

    const ranked = [...items].sort(byTopCreator).slice(0, Math.max(0, limit))
    if (ranked.length === 0) return []

    // A failed strip must not empty the section — `listPortfolioPreviews`
    // already resolves a creator whose lookup failed to `[]`.
    let previews = {}
    try {
      previews = await creatorProfileService.listPortfolioPreviews(
        ranked.map((profile) => profile.id),
        { limit: SLIDER_ITEMS }
      )
    } catch {
      previews = {}
    }

    return ranked.map((profile) => ({
      ...profile,
      level: levelOf(profile),
      contributionCounts: contributionsOf(profile),
      portfolioItems: previews[profile.id] ?? [],
    }))
  },

  /**
   * **Featured creators with their contribution counts** — the hero's proof
   * that there is work on the platform (V2-04).
   *
   * The figures are already on the record; this exists so the hero asks one
   * service one question rather than reaching for `creatorProfileService` and
   * then reshaping what comes back.
   *
   * @param {number} [limit=6] how many featured storefronts to return
   * @returns {Promise<object[]>} featured storefronts, best-rated first, each
   *   with a normalised `contributionCounts` and a resolved `level`
   */
  async getFeaturedWithContributions(limit = 6) {
    const featured = await creatorProfileService.listFeatured(limit)

    return featured.map((profile) => ({
      ...profile,
      level: levelOf(profile),
      contributionCounts: contributionsOf(profile),
    }))
  },

  /**
   * The marketplace-wide contribution totals behind the hero's headline
   * figures — "112,000 images, 67,000 videos" in miniature.
   *
   * MOCK-AGGREGATE: one folded page of storefronts summed here, rather than
   * `SELECT SUM(contribution_images), SUM(contribution_videos) FROM
   * creator_profiles`.
   *
   * @returns {Promise<{images: number, videos: number, creators: number}>} zeros
   *   on any failure — a headline stat is never worth failing a page for
   */
  async getContributionTotals() {
    try {
      const { items } = await creatorProfileService.search({
        page: 1,
        limit: FOLD_LIMIT,
        activeOwnersOnly: true,
      })

      return items.reduce(
        (totals, profile) => {
          const counts = contributionsOf(profile)
          return {
            images: totals.images + counts.images,
            videos: totals.videos + counts.videos,
            creators: totals.creators + 1,
          }
        },
        { images: 0, videos: 0, creators: 0 }
      )
    } catch {
      return { images: 0, videos: 0, creators: 0 }
    }
  },

  /**
   * **The creators page** (V2-09 §1) — one page of storefronts for the
   * infinite-scroll timeline, filtered, ordered, and carrying the strip of
   * published work each card renders.
   *
   * Only active accounts with an open storefront are returned, whatever the
   * filters say.
   *
   * MOCK-PAGINATE: the marketplace is **folded, ordered, and sliced here**
   * rather than paged by the provider. Three reasons, all of them consequences
   * of the mock stack rather than of the design:
   *
   * 1. `recommended` is a three-key composite and the contract's list
   *    parameters carry one `sort` (§4.1), so it cannot be expressed as a
   *    query at all.
   * 2. `activeOwnersOnly` drops rows **after** pagination (see
   *    `creatorProfileService`, MOCK-JOIN), which leaves `total` approximate
   *    and pages short — and an infinite list that never reaches its total
   *    scrolls forever without an end cap.
   * 3. Every ordering has to be stable across page requests, and a page
   *    re-sorted in isolation is not.
   *
   * Folding {@link FOLD_LIMIT} rows costs one extra round trip on a twelve-
   * storefront marketplace and buys an exact `total`, a total order, and a
   * correct end cap. Laravel replaces the whole function with one query —
   * `WHERE availability = 1 AND account_status = 'active' … ORDER BY … LIMIT`
   * — and every note above disappears with it.
   *
   * MOCK-JOIN: the work strips are one request per creator on the page (the
   * batched helper `getTopCreators` uses), collapsing to
   * `GET /creators?include=portfolio` on migration day.
   *
   * @param {object} [params]
   * @param {number} [params.page=1]
   * @param {number} [params.limit=CREATORS_PAGE_SIZE]
   * @param {string} [params.sort='recommended'] a `CREATOR_FEED_SORT` token
   * @param {object} [params.filters] see {@link toRecordFilters}
   * @returns {Promise<import('./api/listAdapter').ListResult>} `{ items, total,
   *   page, limit }`, each item carrying a resolved `level`, a normalised
   *   `contributionCounts`, and `portfolioItems`
   *
   * **Future endpoint:**
   * `GET /creators?sort=recommended&level[]=2&online=1&include=portfolio`.
   */
  async listCreators({
    page = 1,
    limit = CREATORS_PAGE_SIZE,
    sort = CREATOR_FEED_SORT.RECOMMENDED,
    filters,
  } = {}) {
    const ordering = SORT_FIELDS[sort] ?? SORT_FIELDS[CREATOR_FEED_SORT.RECOMMENDED]
    const compare = COMPARATORS[sort] ?? COMPARATORS[CREATOR_FEED_SORT.RECOMMENDED]

    const { items } = await creatorProfileService.search({
      page: 1,
      limit: FOLD_LIMIT,
      sort: ordering.sort,
      order: ordering.order,
      activeOwnersOnly: true,
      filters: toRecordFilters(filters),
    })

    const ranked = [...items].sort(compare)
    const total = ranked.length

    const safePage = Math.max(1, Math.trunc(Number(page)) || 1)
    const safeLimit = Math.max(1, Math.trunc(Number(limit)) || CREATORS_PAGE_SIZE)
    const start = (safePage - 1) * safeLimit
    const slice = ranked.slice(start, start + safeLimit)

    if (slice.length === 0) return { items: [], total, page: safePage, limit: safeLimit }

    // A failed strip must not empty the timeline — `listPortfolioPreviews`
    // already resolves a creator whose lookup failed to `[]`.
    let previews = {}
    try {
      previews = await creatorProfileService.listPortfolioPreviews(
        slice.map((profile) => profile.id),
        { limit: SLIDER_ITEMS }
      )
    } catch {
      previews = {}
    }

    return {
      items: slice.map((profile) => ({
        ...profile,
        level: levelOf(profile),
        contributionCounts: contributionsOf(profile),
        portfolioItems: previews[profile.id] ?? [],
      })),
      total,
      page: safePage,
      limit: safeLimit,
    }
  },
})

export default creatorMetaService
