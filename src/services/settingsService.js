// Platform configuration — `docs/api-contract.md` §6.27.
//
// A **singleton**: no id, no list, no pagination. These values are load-bearing
// — `commission.defaultRate` prices every order at award time,
// `general.payoutMinAmount` gates payout requests, `features.*` are the flags
// behind `useFeatureFlag` — so they are cached briefly and read through
// accessors that always have an answer.

import { REJECTION_REASONS } from '@/constants/policy'
import { ROLES } from '@/constants/roles'

import { apiClient } from './api/apiClient'
import { auditService } from './auditService'

const SETTINGS_PATH = '/platformSettings'

/** `entityType` every `settings.*` audit entry points at (contract §6.26). */
export const SETTINGS_ENTITY_TYPE = 'platform_settings'

/** `entityId` for the singleton — it has no id of its own (seed validator §425). */
export const SETTINGS_ENTITY_ID = 'platformSettings'

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
  // No `enabled` here: Prompt 35 made `features.affiliateProgram` the program's
  // only switch (see the seed's migration note and contract §6.27).
  affiliate: Object.freeze({
    commissionRate: 0.1,
    attributionDays: 30,
    payoutMinAmount: 25,
  }),
  moderation: Object.freeze({
    autoApproveDeliveries: true,
    reviewSlaDays: 2,
    customRejectionReasons: Object.freeze([]),
  }),
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

  /**
   * The rejection reasons a reviewer may pick from (Prompt 30's decision
   * dialog): the canonical codes in `src/constants/policy.js` first, then any
   * `{ code, label }` a super admin has appended in platform settings.
   *
   * **Constants stay canonical.** Prompt 03 owns the built-in codes — the
   * moderation service, the creator-facing banners, and the seed all read them
   * from there. Settings can only *add*, never rename or remove, so a stored
   * `reasonCode` always resolves to the same meaning it had when it was written
   * (contract §6.27).
   *
   * Never throws: an unreachable API resolves to the canonical list alone.
   *
   * @returns {Promise<Array<{code: string, label: string, description?: string,
   *   isCustom?: boolean}>>}
   */
  async getRejectionReasons() {
    let custom = []
    try {
      const settings = await loadSettings(false)
      custom = settings?.moderation?.customRejectionReasons ?? []
    } catch {
      custom = []
    }

    const canonical = REJECTION_REASONS.map((reason) => ({ ...reason, isCustom: false }))
    const known = new Set(canonical.map((reason) => reason.code))

    return [
      ...canonical,
      ...custom
        .filter((reason) => reason?.code && reason?.label && !known.has(reason.code))
        .map((reason) => ({ code: reason.code, label: reason.label, isCustom: true })),
    ]
  },

  /**
   * **Saves configuration and records who changed what** — the write behind
   * Prompt 35's settings screen, and the only one product code should call.
   *
   * Three things happen that `updateSettings` alone does not do:
   *
   *   1. `updatedAt` / `updatedById` are stamped, so the singleton says when it
   *      last moved and who moved it (contract §6.27).
   *   2. The cache is **invalidated** rather than refreshed. Every consumer —
   *      the commission calculator, the payout gate, the nav's feature flags —
   *      re-reads on its next call, so a saved rate is in effect immediately
   *      rather than up to {@link SETTINGS_CACHE_MS} later.
   *   3. A `settings.update` audit entry carries the field-level diff in
   *      `meta.changes`, which is what makes a configuration change reviewable
   *      after the fact (00 §14).
   *
   * The audit write is best-effort: a saved setting must not be rolled back
   * because the trail entry failed, and a missing entry is visible in the log.
   *
   * @param {object} patch complete sub-objects for every section being changed
   *   (see {@link updateSettings} for why they must be complete)
   * @param {object} [options]
   * @param {object} [options.actor] the signed-in super admin, `{ id, role }`
   * @param {Array<{key: string, label?: string, from: *, to: *}>} [options.changes]
   *   the diff the screen computed and showed in its confirmation dialog —
   *   stored verbatim so the audit entry says exactly what the reader approved
   * @returns {Promise<object>} the updated settings
   * @throws {ApiError} when the `PATCH` fails — nothing is invalidated or logged
   */
  async saveSettings(patch, { actor, changes } = {}) {
    const updated = await this.updateSettings({
      ...patch,
      updatedAt: new Date().toISOString(),
      ...(actor?.id ? { updatedById: actor.id } : {}),
    })

    this.invalidate()

    if (actor?.id) {
      try {
        await auditService.log({
          actorId: actor.id,
          actorRole: actor.role ?? ROLES.SUPER_ADMIN,
          action: 'settings.update',
          entityType: SETTINGS_ENTITY_TYPE,
          entityId: SETTINGS_ENTITY_ID,
          meta: {
            sections: Object.keys(patch ?? {}),
            changes: (changes ?? []).map(({ key, label, from, to }) => ({
              key,
              ...(label ? { label } : {}),
              from,
              to,
            })),
          },
        })
      } catch {
        // The setting is saved; the trail entry is not worth undoing it for.
      }
    }

    return updated
  },
})

export default settingsService
