// Creator storefront metadata for the V2 marketing surfaces — the ranked "Top
// Creators" row on the home page and the featured strip in the hero
// (`prompts-v2/03` §4, consumed by V2-04, V2-05, and V2-09).
//
// A thin composition layer over `creatorProfileService` and its portfolio
// preview join: nothing here talks to the API client directly, and nothing here
// stores a figure of its own. `level`, `deliveriesCount`, `totalEarned`, and
// `contributionCounts` are fields on the `creatorProfiles` record (see
// `docs/data-model.md`), derived in the seed from the same ledger the earnings
// screens read.

import { getCreatorLevel } from '@/constants/creatorLevels'

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
})

export default creatorMetaService
