// Platform configuration — `docs/api-contract.md` §6.27.
//
// A **singleton**: no id, no list, no pagination. These values are load-bearing
// — `commission.defaultRate` prices every order at award time,
// `general.payoutMinAmount` gates payout requests, `features.*` are the flags
// behind `useFeatureFlag` — so they are cached briefly and read through
// accessors that always have an answer.

import { apiClient } from './api/apiClient'

const SETTINGS_PATH = '/platformSettings'

/** Cache lifetime. Short enough that an admin edit shows up on the next page. */
export const SETTINGS_CACHE_MS = 60_000

/**
 * Last-resort defaults, used when the API cannot be reached. They mirror the
 * seeded singleton so a disconnected app still prices, gates, and flags
 * consistently instead of dividing by `undefined`.
 */
export const SETTINGS_FALLBACK = Object.freeze({
  general: Object.freeze({
    platformName: 'BetterBlue',
    currency: 'USD',
    autoAcceptDays: 5,
    payoutMinAmount: 50,
  }),
  commission: Object.freeze({ defaultRate: 0.2, categoryOverrides: Object.freeze({}) }),
  affiliate: Object.freeze({
    enabled: true,
    commissionRate: 0.1,
    attributionDays: 30,
    payoutMinAmount: 25,
  }),
  moderation: Object.freeze({ autoApproveDeliveries: true, reviewSlaDays: 2 }),
  features: Object.freeze({
    affiliateProgram: true,
    publicRequestBoard: true,
    reviews: true,
    disputes: true,
  }),
})

let cache = null
let cachedAt = 0
let inFlight = null

/** Resolves the settings, from cache when fresh, otherwise from the API. */
async function loadSettings(force) {
  const isFresh = cache && Date.now() - cachedAt < SETTINGS_CACHE_MS
  if (isFresh && !force) return cache

  // Concurrent callers on first paint share one request rather than racing.
  if (!inFlight) {
    inFlight = apiClient
      .get(SETTINGS_PATH)
      .then((response) => {
        cache = response.data
        cachedAt = Date.now()
        return cache
      })
      .finally(() => {
        inFlight = null
      })
  }

  return inFlight
}

export const settingsService = Object.freeze({
  /**
   * The whole settings object, cached for {@link SETTINGS_CACHE_MS}.
   *
   * @param {object} [options]
   * @param {boolean} [options.force=false] bypass the cache and refetch
   * @returns {Promise<object>} the platform settings
   * @throws {ApiError} when the settings cannot be read and nothing is cached
   */
  getSettings: ({ force = false } = {}) => loadSettings(force),

  /** Drops the cache — call after an admin saves settings. */
  invalidate() {
    cache = null
    cachedAt = 0
  },

  /**
   * The commission rate to apply to an order, as a decimal fraction (`0.2` =
   * 20%). A category override wins over the platform default.
   *
   * Never throws: an unreachable API falls back to
   * `SETTINGS_FALLBACK.commission.defaultRate`, because a missing rate would
   * silently price an order at zero commission.
   *
   * @param {object} [options]
   * @param {string} [options.categoryId] `cat_…` to check for an override
   * @returns {Promise<number>} the rate to use
   */
  async getCommissionRate({ categoryId } = {}) {
    let commission
    try {
      commission = (await loadSettings(false))?.commission
    } catch {
      commission = SETTINGS_FALLBACK.commission
    }

    const override = categoryId ? commission?.categoryOverrides?.[categoryId] : undefined
    const rate = override ?? commission?.defaultRate

    return Number.isFinite(Number(rate))
      ? Number(rate)
      : SETTINGS_FALLBACK.commission.defaultRate
  },

  /**
   * A feature flag (contract §6.27, `features.*`) — the source `useFeatureFlag`
   * reads. Falls back to the bundled default rather than throwing, so a flag
   * check never breaks a render.
   *
   * @param {string} flagKey e.g. `'affiliateProgram'`, `'reviews'`
   * @returns {Promise<boolean>} whether the feature is on
   */
  async getFeature(flagKey) {
    if (!flagKey) return false
    try {
      const settings = await loadSettings(false)
      const value = settings?.features?.[flagKey]
      return value === undefined ? Boolean(SETTINGS_FALLBACK.features[flagKey]) : Boolean(value)
    } catch {
      return Boolean(SETTINGS_FALLBACK.features[flagKey])
    }
  },

  /**
   * Saves configuration (super admin).
   *
   * MOCK-MERGE: JSON Server merges a singular-route `PATCH` at the **top level
   * only** — sending `{ commission: { defaultRate: 0.18 } }` replaces the whole
   * `commission` object and silently drops `categoryOverrides` (contract
   * §6.27). So callers always send the **complete sub-object**.
   *
   * @param {object} patch complete sub-objects for every section being changed
   * @returns {Promise<object>} the updated settings
   */
  async updateSettings(patch) {
    const response = await apiClient.patch(SETTINGS_PATH, patch)
    cache = response.data
    cachedAt = Date.now()
    return cache
  },

  // —— workflow operations (added by later prompts) ——
  // saveSettings — Prompt 35 (admin settings): wraps `updateSettings` with the
  // `settings.update` audit entry carrying the before/after in `meta`.
})

export default settingsService
