// The referral program — `docs/api-contract.md` §6.23–§6.25 and §7 operations
// 9, 10, and 13–16.
//
// **Every number the affiliate program produces is computed here.** The pages
// under `src/features/affiliate` and `src/features/admin/affiliates` render what
// this module returns and do no money arithmetic of their own (00 §10 / §12);
// all of it goes through `utils/money.js`, so a commission share computed today
// is the number Laravel's `round($x, 2)` computes later (contract §1.6).
//
// The program has five moments, and each one is a function below:
//
//   1. capture      `/r/:code` stores the code in `bb.referralCode`
//   2. signup       registration turns a stored code into a `pending` referral
//   3. conversion   the referred account's first completed order accrues
//                   commission — fired from `paymentService`'s AFFILIATE-HOOK
//   4. approval     an admin approves (or voids) the accrued commission
//   5. settlement   the affiliate requests a payout, finance pays it, and the
//                   approved earnings behind it become `paid`
//
// GUARDS: enrolment, capture, and conversion are all gated on the program being
// switched on (`platformSettings.affiliate.enabled` **and**
// `features.affiliateProgram`) and on the affiliate profile being `active`. A
// suspended affiliate stops capturing and stops accruing; nothing already
// earned is taken away by the suspension itself (that is what voiding is for).
//
// SECURITY: like everything else in `src/services`, these checks run in the
// browser and are UX (00 §11 / §14). The Laravel API must enforce ownership,
// the flag, the attribution window, and — above all — the *idempotency* of a
// conversion independently.

import { NOTIFICATION_TYPE } from '@/constants/notificationTypes'
import { ROLES } from '@/constants/roles'
import {
  AFFILIATE_EARNING_STATUS,
  AFFILIATE_PROFILE_STATUS,
  ORDER_STATUS,
  PAYOUT_SOURCE,
  PAYOUT_STATUS,
  REFERRAL_STATUS,
  TRANSACTION_TYPE,
} from '@/constants/statuses'
import { appConfig } from '@/config/appConfig'
import { formatCurrency } from '@/utils/formatters'
import { ID_PREFIX } from '@/utils/id'
import { applyRate, round2, subtractMoney, sumMoney, toAmount } from '@/utils/money'
import { getItem, removeItem, setItem } from '@/utils/storage'

import { API_ERROR_CODE, createApiError } from './api/apiError'
import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'
import { auditService } from './auditService'
import { notificationService } from './notificationService'
import { payoutService } from './payoutService'
import { settingsService, SETTINGS_FALLBACK } from './settingsService'
import { userService } from './userService'

const affiliateProfiles = createCrudService('affiliateProfiles', {
  idPrefix: ID_PREFIX.AFFILIATE_PROFILE,
  // Affiliates are stamped `enrolledAt`, not `createdAt` (contract §6.23).
  timestampField: 'enrolledAt',
})
const affiliateReferrals = createCrudService('affiliateReferrals', {
  idPrefix: ID_PREFIX.AFFILIATE_REFERRAL,
})
const affiliateEarnings = createCrudService('affiliateEarnings', {
  idPrefix: ID_PREFIX.AFFILIATE_EARNING,
})

/** Read-only companions: the platform commission a share is taken of, and the orders that qualify. */
const commissions = createCrudService('commissions', { idPrefix: ID_PREFIX.COMMISSION })
const orders = createCrudService('orders', { idPrefix: ID_PREFIX.ORDER })
const transactions = createCrudService('transactions', { idPrefix: ID_PREFIX.TRANSACTION })

/**
 * Storage key holding the affiliate code captured by the `/r/:code` landing
 * route — `bb.referralCode`.
 *
 * Owned here rather than in `authService` (which re-exports it, so the name it
 * has published since Prompt 09 keeps working) because capture, expiry, and
 * clearing are all affiliate rules: registration only *reads* the code.
 */
export const REFERRAL_STORAGE_KEY = 'referralCode'

/** Rows one client-side fold may walk. Far beyond any seeded affiliate. */
const FOLD_LIMIT = 100

/** Codes are `WORD-XX`: readable on a phone call, and short enough for a bio. */
const CODE_SUFFIX_ALPHABET = 'ACDEFHJKLMNPRTVWXY3479'
const CODE_MAX_WORD_LENGTH = 10
const CODE_ATTEMPTS = 6

const nowIso = () => new Date().toISOString()

/* -------------------------------------------------------------------------- */
/* Program configuration                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The affiliate block of `platformSettings`, plus whether the program is live.
 *
 * Never throws: an unreachable settings endpoint falls back to the bundled
 * defaults, exactly as `settingsService.getFeature` does — a rate that resolved
 * to `undefined` would silently accrue zero-value commission.
 *
 * @returns {Promise<{enabled: boolean, commissionRate: number, attributionDays: number,
 *   payoutMinAmount: number, currency: string}>}
 */
export async function getProgramSettings() {
  let settings
  try {
    settings = await settingsService.getSettings()
  } catch {
    settings = SETTINGS_FALLBACK
  }

  const affiliate = settings?.affiliate ?? SETTINGS_FALLBACK.affiliate
  const flagged = settings?.features?.affiliateProgram
  const numberOr = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback)

  return {
    // Two switches, both of which must be on: `affiliate.enabled` is the
    // program's own, `features.affiliateProgram` is the platform flag every
    // affiliate surface is gated behind (contract §6.23).
    enabled: affiliate?.enabled !== false && flagged !== false,
    commissionRate: numberOr(affiliate?.commissionRate, SETTINGS_FALLBACK.affiliate.commissionRate),
    attributionDays: numberOr(affiliate?.attributionDays, SETTINGS_FALLBACK.affiliate.attributionDays),
    payoutMinAmount: numberOr(affiliate?.payoutMinAmount, SETTINGS_FALLBACK.affiliate.payoutMinAmount),
    currency: settings?.general?.currency ?? appConfig.defaultCurrency,
  }
}

/* -------------------------------------------------------------------------- */
/* Attribution capture (`bb.referralCode`)                                    */
/* -------------------------------------------------------------------------- */

/**
 * Stores a captured referral code with the moment it was captured, so the
 * attribution window can be judged at signup rather than trusted forever.
 *
 * MOCK-ATTRIBUTION: a real implementation sets a signed, `HttpOnly`, `SameSite=Lax`
 * cookie server-side on `GET /r/{code}` with `Max-Age = attributionDays × 86400`,
 * and reads it during registration where the browser cannot forge it. This is
 * `localStorage` because the prototype has no server to set a cookie — which
 * also means it is per-browser, survives no device switch, and is trivially
 * editable. All three are documented in `docs/api-contract.md` §7 operation 10.
 *
 * @param {string} code the affiliate code from the link
 * @returns {boolean} whether it was persisted
 */
export function captureReferralCode(code) {
  const value = String(code ?? '').trim()
  if (!value) return false
  return setItem(REFERRAL_STORAGE_KEY, { code: value, at: nowIso() })
}

/**
 * The captured code, or `null` when there is none or the attribution window has
 * closed. An expired capture is cleared on read so it cannot come back.
 *
 * Accepts the bare-string shape Prompt 09 wrote (`"AVA-STUDIO"`) as well as the
 * `{ code, at }` record written since — an upgrade must not silently drop the
 * attribution of somebody mid-signup. A legacy string has no capture time, so
 * it is treated as captured now.
 *
 * @param {number} attributionDays window length, from {@link getProgramSettings}
 * @returns {{code: string, at: string|null, expired: boolean}|null}
 */
export function readCapturedReferral(attributionDays) {
  const stored = getItem(REFERRAL_STORAGE_KEY)
  if (!stored) return null

  const record =
    typeof stored === 'string' ? { code: stored, at: null } : { code: stored.code, at: stored.at ?? null }
  if (!record.code) {
    removeItem(REFERRAL_STORAGE_KEY)
    return null
  }

  const days = Number(attributionDays)
  const capturedAt = record.at ? Date.parse(record.at) : NaN
  const expired =
    Number.isFinite(days) && Number.isFinite(capturedAt)
      ? Date.now() - capturedAt > days * 24 * 60 * 60 * 1000
      : false

  if (expired) {
    removeItem(REFERRAL_STORAGE_KEY)
    return { ...record, expired: true }
  }

  return { ...record, expired: false }
}

/** Forgets the captured code — called once it has been recorded on an account. */
export function clearCapturedReferral() {
  return removeItem(REFERRAL_STORAGE_KEY)
}

/* -------------------------------------------------------------------------- */
/* Internal helpers                                                           */
/* -------------------------------------------------------------------------- */

/** Best-effort audit — an admin action is recorded, never blocked by recording. */
async function auditQuietly(actor, entry) {
  if (!actor?.id) return null
  try {
    return await auditService.log({ actorId: actor.id, actorRole: actor.role, ...entry })
  } catch {
    return null
  }
}

/** Best-effort notify — a bell item must never fail the money it describes. */
async function notifyQuietly(payload) {
  try {
    return await notificationService.notify(payload)
  } catch {
    return null
  }
}

/**
 * A readable code from a display name: the first usable word, upper-cased and
 * ASCII-folded, plus a two-character suffix — `Verde Kitchen` → `VERDE-K7`.
 * Names that fold away to nothing (non-Latin scripts, punctuation only) fall
 * back to `BLUE`, so every member gets a code they can read out loud.
 */
function buildCode(name) {
  const word = String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean)
    .find((candidate) => candidate.length >= 3)

  const stem = (word ?? 'BLUE').slice(0, CODE_MAX_WORD_LENGTH)
  const pick = () => CODE_SUFFIX_ALPHABET[Math.floor(Math.random() * CODE_SUFFIX_ALPHABET.length)]
  return `${stem}-${pick()}${pick()}`
}

/** The sum of one affiliate's earnings in each status — the profile's three totals. */
function totalsFromEarnings(rows = []) {
  const sumOf = (status) =>
    sumMoney(rows.filter((row) => row.status === status).map((row) => row.amount))

  return {
    pendingEarnings: sumOf(AFFILIATE_EARNING_STATUS.PENDING),
    approvedEarnings: sumOf(AFFILIATE_EARNING_STATUS.APPROVED),
    paidEarnings: sumOf(AFFILIATE_EARNING_STATUS.PAID),
  }
}

/**
 * Recomputes an affiliate's three earnings totals **from the earnings rows**
 * and patches the profile.
 *
 * Deliberately a recompute rather than an increment (contract §7 operation 10's
 * Laravel note says the same): a `PATCH` that adds to a number it read a moment
 * ago is a lost update waiting to happen, and these three fields are the ones a
 * member reconciles against their own table. Costs one extra list call per
 * write, on a collection that holds a handful of rows per affiliate.
 *
 * @param {string} affiliateId `aff_…`
 * @param {object} [extra] additional profile fields to patch in the same write
 * @returns {Promise<object>} the updated profile
 */
async function syncProfileTotals(affiliateId, extra = {}) {
  const { items } = await affiliateEarnings.list({
    page: 1,
    limit: FOLD_LIMIT,
    filters: { affiliateId },
  })
  return affiliateProfiles.update(affiliateId, { ...totalsFromEarnings(items), ...extra })
}

/** Names keyed by user id, for the tables that show who somebody is. */
async function namesById(userIds = []) {
  const unique = [...new Set(userIds.filter(Boolean))]
  if (unique.length === 0) return new Map()
  try {
    const people = await userService.listByIds(unique)
    return new Map(people.map((person) => [person.id, person]))
  } catch {
    return new Map()
  }
}

/* -------------------------------------------------------------------------- */
/* Service                                                                    */
/* -------------------------------------------------------------------------- */

export const affiliateService = Object.freeze({
  /**
   * The affiliate roster (admin).
   *
   * @param {import('./api/listAdapter').ListParams} [params] filters: `userId`,
   *   `code`, `status`; sorts: `enrolledAt`, `conversions`, `paidEarnings`
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  list: (params = {}) => affiliateProfiles.list({ sort: 'enrolledAt', order: SORT_ORDER.DESC, ...params }),

  /**
   * @param {string} id `aff_…`
   * @returns {Promise<object>} the affiliate account
   * @throws {ApiError} `not_found`
   */
  getById: (id) => affiliateProfiles.getById(id),

  /**
   * "Am I enrolled?" — the check every affiliate surface starts from.
   *
   * @param {string} userId `usr_…`
   * @returns {Promise<object|null>} the affiliate account, or `null` when not enrolled
   */
  async getByUserId(userId) {
    if (!userId) return null
    const { items } = await affiliateProfiles.list({ page: 1, limit: 1, filters: { userId } })
    return items[0] ?? null
  },

  /**
   * Attribution lookup — resolves a referral code from a signup link.
   *
   * @param {string} code the affiliate code, e.g. `'AVA-STUDIO'`
   * @returns {Promise<object|null>} the affiliate account, or `null` when unknown
   */
  async getByCode(code) {
    if (!code) return null
    const { items } = await affiliateProfiles.list({ page: 1, limit: 1, filters: { code } })
    return items[0] ?? null
  },

  /**
   * The affiliate behind a code **only if it can still capture**: the program
   * is on and the profile is `active`. A suspended code resolves to `null`, and
   * every capture path treats that exactly like an unknown one — silently
   * (§13: an invalid link is not an error the visitor caused).
   *
   * @param {string} code
   * @returns {Promise<object|null>}
   */
  async getCapturableByCode(code) {
    const trimmed = String(code ?? '').trim()
    if (!trimmed) return null

    const { enabled } = await getProgramSettings()
    if (!enabled) return null

    const profile = await affiliateService.getByCode(trimmed)
    return profile?.status === AFFILIATE_PROFILE_STATUS.ACTIVE ? profile : null
  },

  /**
   * One row per referred account.
   *
   * @param {string} affiliateId `aff_…`
   * @param {import('./api/listAdapter').ListParams} [params] filters:
   *   `referredUserId`, `status`, `convertedOrderId`; sort: `createdAt`
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  listReferrals(affiliateId, params = {}) {
    return affiliateReferrals.list({
      sort: 'createdAt',
      order: SORT_ORDER.DESC,
      ...params,
      filters: { ...params.filters, affiliateId },
    })
  },

  /**
   * Commission accrued per qualifying order — a share of the platform
   * commission BetterBlue actually earned, never of the creator's earnings
   * (contract §6.25).
   *
   * @param {string} affiliateId `aff_…`
   * @param {import('./api/listAdapter').ListParams} [params] filters:
   *   `referralId`, `orderId`, `status`, `createdAt_gte`/`createdAt_lte`;
   *   sorts: `createdAt`, `amount`
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  listEarnings(affiliateId, params = {}) {
    return affiliateEarnings.list({
      sort: 'createdAt',
      order: SORT_ORDER.DESC,
      ...params,
      filters: { ...params.filters, affiliateId },
    })
  },

  /**
   * An affiliate's settlement requests — `payouts` rows with
   * `source: 'affiliate'` (contract §6.15).
   *
   * @param {string} affiliateId `aff_…`
   * @param {import('./api/listAdapter').ListParams} [params]
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  listPayouts(affiliateId, params = {}) {
    if (!affiliateId) return Promise.resolve({ items: [], total: 0, page: 1, limit: 0 })
    return payoutService.list({
      ...params,
      filters: { ...params.filters, affiliateId, source: PAYOUT_SOURCE.AFFILIATE },
    })
  },

  /* ---------------------------------------------------------------------- */
  /* 1–2. Enrolment and capture                                             */
  /* ---------------------------------------------------------------------- */

  /**
   * **A member joins the referral program** (contract §7 operation 9).
   *
   * MOCK-UNIQUENESS: the code is generated in the browser and checked with a
   * lookup, which is a *best-effort* guarantee — two enrolments a millisecond
   * apart can still collide, and no amount of client-side checking fixes that.
   * Laravel generates it inside the transaction with `code UNIQUE` and
   * `user_id UNIQUE` doing the actual work.
   *
   * @param {string} userId `usr_…`
   * @param {object} [options]
   * @param {string} [options.name] display name the code is built from
   * @returns {Promise<object>} the new affiliate account
   * @throws {ApiError} `forbidden` (program switched off) · `conflict` (already
   *   enrolled) · `server_error` (no free code after several attempts)
   */
  async enroll(userId, { name } = {}) {
    if (!userId) {
      throw createApiError(
        API_ERROR_CODE.VALIDATION_FAILED,
        'We could not tell which account to enrol.',
        undefined,
        422
      )
    }

    const { enabled } = await getProgramSettings()
    if (!enabled) {
      throw createApiError(
        API_ERROR_CODE.FORBIDDEN,
        'The referral program is not accepting new members right now.',
        undefined,
        403
      )
    }

    const existing = await affiliateService.getByUserId(userId)
    if (existing) {
      throw createApiError(
        API_ERROR_CODE.CONFLICT,
        'You are already part of the referral program.',
        undefined,
        409
      )
    }

    let code = null
    for (let attempt = 0; attempt < CODE_ATTEMPTS && !code; attempt += 1) {
      const candidate = buildCode(attempt < CODE_ATTEMPTS - 2 ? name : null)
      // Sequential by necessity — each candidate is only worth checking if the
      // one before it was taken.
      // eslint-disable-next-line no-await-in-loop
      const taken = await affiliateService.getByCode(candidate)
      if (!taken) code = candidate
    }

    if (!code) {
      throw createApiError(
        API_ERROR_CODE.SERVER_ERROR,
        'We could not generate a referral code for you. Please try again.',
        undefined,
        500
      )
    }

    return affiliateProfiles.create({
      userId,
      code,
      status: AFFILIATE_PROFILE_STATUS.ACTIVE,
      clicks: 0,
      signups: 0,
      conversions: 0,
      pendingEarnings: 0,
      approvedEarnings: 0,
      paidEarnings: 0,
    })
  },

  /**
   * Counts a visit to `/r/:code`.
   *
   * MOCK-APPROXIMATE: read-then-increment from the browser, so two visitors in
   * the same second can overwrite each other's count, and a refresh counts
   * twice. Clicks are a vanity metric here, not money — no decision anywhere in
   * the product is taken on this number, which is why an approximate one is
   * acceptable. Laravel replaces it with an atomic `increment('clicks')` (or a
   * `referral_clicks` table when the program needs real analytics).
   *
   * Resolves to `null` on any failure: a landing page must never fail because a
   * counter did not move.
   *
   * @param {object} profile the affiliate account being visited
   * @returns {Promise<object|null>}
   */
  async recordClick(profile) {
    if (!profile?.id) return null
    try {
      return await affiliateProfiles.update(profile.id, {
        clicks: Math.max(0, Number(profile.clicks) || 0) + 1,
      })
    } catch {
      return null
    }
  },

  /**
   * **Turns a captured code into a `pending` referral** — the signup half of
   * attribution, called by `authService.register` (contract §2.1).
   *
   * Buyers only: the program pays out on the platform commission of a *purchase*,
   * so a referred creator is recorded on the account (`users.referredByCode`)
   * but accrues nothing. Self-referral is refused (contract §6.24).
   *
   * Resolves to `null` for every "nothing to do" case and never throws — a
   * registration that has already created an account must not fail because the
   * referral behind it could not be written.
   *
   * @param {object} payload
   * @param {string} payload.code the captured affiliate code
   * @param {string} payload.referredUserId the account that just signed up
   * @param {string} payload.role that account's role
   * @param {string} [payload.capturedAt] when the code was captured
   * @returns {Promise<object|null>} the referral row, or `null`
   */
  async recordReferral({ code, referredUserId, role, capturedAt } = {}) {
    try {
      if (!code || !referredUserId || role !== ROLES.BUYER) return null

      const profile = await affiliateService.getCapturableByCode(code)
      if (!profile || profile.userId === referredUserId) return null

      // An account is referred once (contract §6.24). Re-registering with the
      // same browser must not create a second row.
      const { items: already } = await affiliateReferrals.list({
        page: 1,
        limit: 1,
        filters: { referredUserId },
      })
      if (already.length > 0) return null

      const referral = await affiliateReferrals.create({
        affiliateId: profile.id,
        referredUserId,
        status: REFERRAL_STATUS.PENDING,
        convertedOrderId: null,
        convertedAt: null,
        // The capture time is what the attribution window is measured from, so
        // a code stored three weeks ago does not restart its clock at signup.
        ...(capturedAt ? { capturedAt } : null),
      })

      await affiliateProfiles.update(profile.id, {
        signups: Math.max(0, Number(profile.signups) || 0) + 1,
      })

      return referral
    } catch {
      return null
    }
  },

  /* ---------------------------------------------------------------------- */
  /* 3. Conversion — the AFFILIATE-HOOK in paymentService                   */
  /* ---------------------------------------------------------------------- */

  /**
   * **Attributes a completed order to the referrer who brought the buyer in**
   * (contract §7 operation 10).
   *
   * Called from the single `AFFILIATE-HOOK` line in `paymentService.settleEscrow`,
   * after the money has settled. Everything that could possibly go wrong is
   * handled *here* so that call site stays one line and the settlement path
   * gains no failure mode: **this function never throws and never rejects.** A
   * problem resolves to `null` and is logged as a warning — a referral is worth
   * exactly nothing next to a payment that has already moved.
   *
   * Guards, in order: program on · buyer has a `pending` referral · still
   * inside the attribution window · this is the buyer's **first** completed
   * order · nothing already accrued for this order · the referrer is still
   * `active`.
   *
   * @param {object} order the order that just settled
   * @param {object} [options]
   * @param {number} [options.commissionAmount] the platform commission that was
   *   just written — passed in by the hook so the share is taken from the exact
   *   number that settled rather than a re-read of it
   * @returns {Promise<{referral: object, earning: object, profile: object}|null>}
   *   the conversion, or `null` when nothing converted
   */
  async processConversion(order, { commissionAmount } = {}) {
    try {
      const buyerId = order?.buyerId
      if (!order?.id || !buyerId) return null

      const { enabled, commissionRate } = await getProgramSettings()
      if (!enabled) return null

      // The referral this buyer arrived through, if any.
      const { items: referrals } = await affiliateReferrals.list({
        page: 1,
        limit: 1,
        filters: { referredUserId: buyerId, status: REFERRAL_STATUS.PENDING },
      })
      const referral = referrals[0]
      if (!referral) return null

      const profile = await affiliateProfiles.getById(referral.affiliateId).catch(() => null)
      if (!profile || profile.status !== AFFILIATE_PROFILE_STATUS.ACTIVE) return null

      // Attribution window — measured from the click where we have it, and from
      // the signup otherwise (contract §6.24). Past it, the referral expires
      // here rather than waiting for a sweep that this stack has no scheduler
      // for.
      const { attributionDays } = await getProgramSettings()
      const startedAt = Date.parse(referral.capturedAt ?? referral.createdAt ?? '')
      if (
        Number.isFinite(startedAt) &&
        Date.now() - startedAt > Number(attributionDays) * 24 * 60 * 60 * 1000
      ) {
        await affiliateReferrals.update(referral.id, { status: REFERRAL_STATUS.EXPIRED })
        return null
      }

      // **First completed order only.** The hook fires before the order itself
      // is stamped `completed` (`orderService.completeOrder` releases, then
      // completes), so the count deliberately looks at *other* orders and this
      // one's own id is excluded either way.
      const { items: completed } = await orders.list({
        page: 1,
        limit: 5,
        filters: { buyerId, status: ORDER_STATUS.COMPLETED },
      })
      if (completed.some((row) => row.id !== order.id)) return null

      // Belt and braces against a double fire: one earning per order, ever.
      const { items: alreadyAccrued } = await affiliateEarnings.list({
        page: 1,
        limit: 1,
        filters: { orderId: order.id },
      })
      if (alreadyAccrued.length > 0) return null

      const platformCommission = Number.isFinite(Number(commissionAmount))
        ? Number(commissionAmount)
        : await commissions
            .list({ page: 1, limit: 1, filters: { orderId: order.id } })
            .then(({ items }) => Number(items[0]?.amount) || 0)
            .catch(() => 0)

      const amount = applyRate(platformCommission, commissionRate)
      const currency = order.currency ?? appConfig.defaultCurrency
      const convertedAt = nowIso()

      const converted = await affiliateReferrals.update(referral.id, {
        status: REFERRAL_STATUS.CONVERTED,
        convertedOrderId: order.id,
        convertedAt,
      })

      const earning = await affiliateEarnings.create({
        affiliateId: profile.id,
        referralId: referral.id,
        orderId: order.id,
        amount,
        currency,
        status: AFFILIATE_EARNING_STATUS.PENDING,
        approvedAt: null,
        paidAt: null,
      })

      const updatedProfile = await syncProfileTotals(profile.id, {
        conversions: Math.max(0, Number(profile.conversions) || 0) + 1,
      })

      await notifyQuietly({
        userId: profile.userId,
        type: NOTIFICATION_TYPE.AFFILIATE_CONVERSION,
        title: 'A referral converted',
        body:
          `Someone you referred completed their first order, and ${formatCurrency(amount, currency)} ` +
          'of referral commission has been added to your account. It is reviewed by our team before ' +
          'it can be paid out.',
        entityType: 'affiliate_earning',
        entityId: earning.id,
      })

      return { referral: converted, earning, profile: updatedProfile }
    } catch (failure) {
      // The one place in the product where a swallowed error is the correct
      // behaviour, so it is at least said out loud (§13).
      // eslint-disable-next-line no-console
      console.warn('[affiliate] conversion could not be recorded', failure)
      return null
    }
  },

  /* ---------------------------------------------------------------------- */
  /* 4. Approval                                                            */
  /* ---------------------------------------------------------------------- */

  /**
   * **Approves accrued commission** — it becomes payable (admin
   * `affiliates.manage`).
   *
   * @param {string} earningId `aer_…`
   * @param {object} [options]
   * @param {{id: string, role: string}} [options.actor] the acting admin
   * @returns {Promise<object>} the approved earning
   * @throws {ApiError} `conflict` when it is no longer `pending`
   */
  async approveEarning(earningId, { actor } = {}) {
    const earning = await affiliateEarnings.getById(earningId)

    if (earning.status !== AFFILIATE_EARNING_STATUS.PENDING) {
      throw createApiError(
        API_ERROR_CODE.CONFLICT,
        'That commission has already been worked — reload the queue.',
        { status: earning.status },
        409
      )
    }

    const updated = await affiliateEarnings.update(earningId, {
      status: AFFILIATE_EARNING_STATUS.APPROVED,
      approvedAt: nowIso(),
    })

    const profile = await syncProfileTotals(earning.affiliateId).catch(() => null)

    if (profile?.userId) {
      await notifyQuietly({
        userId: profile.userId,
        type: NOTIFICATION_TYPE.AFFILIATE_CONVERSION,
        title: 'Referral commission approved',
        body:
          `${formatCurrency(earning.amount, earning.currency)} of referral commission has been ` +
          'approved and is ready to be paid out. Request a payout from your affiliate dashboard ' +
          'whenever you are ready.',
        entityType: 'affiliate_earning',
        entityId: earning.id,
      })
    }

    await auditQuietly(actor, {
      action: 'affiliate.earning.approve',
      entityType: 'affiliate_earning',
      entityId: earning.id,
      meta: {
        affiliateId: earning.affiliateId,
        orderId: earning.orderId,
        amount: earning.amount,
        fromStatus: earning.status,
        toStatus: AFFILIATE_EARNING_STATUS.APPROVED,
      },
    })

    return updated
  },

  /**
   * **Voids accrued commission** — it is cancelled and excluded from every
   * total (admin `affiliates.manage`). The reason is required and audited: a
   * commission somebody could see yesterday and cannot see today needs an
   * explanation attached to it.
   *
   * @param {string} earningId `aer_…`
   * @param {object} options
   * @param {string} options.reason why it was voided
   * @param {{id: string, role: string}} [options.actor] the acting admin
   * @returns {Promise<object>} the voided earning
   * @throws {ApiError} `validation_failed` (no reason) · `conflict` (already
   *   paid or already void)
   */
  async voidEarning(earningId, { reason, actor } = {}) {
    const trimmedReason = String(reason ?? '').trim()
    if (!trimmedReason) {
      throw createApiError(
        API_ERROR_CODE.VALIDATION_FAILED,
        'Say why this commission is being voided.',
        { reason: 'A reason is required — the affiliate is told what it says.' },
        422
      )
    }

    const earning = await affiliateEarnings.getById(earningId)

    // Paid money cannot be un-paid by an edit, and voiding a void is a no-op
    // somebody would read as a second action.
    if (
      earning.status === AFFILIATE_EARNING_STATUS.PAID ||
      earning.status === AFFILIATE_EARNING_STATUS.VOID
    ) {
      throw createApiError(
        API_ERROR_CODE.CONFLICT,
        earning.status === AFFILIATE_EARNING_STATUS.PAID
          ? 'That commission has already been paid out and cannot be voided.'
          : 'That commission is already void.',
        { status: earning.status },
        409
      )
    }

    const updated = await affiliateEarnings.update(earningId, {
      status: AFFILIATE_EARNING_STATUS.VOID,
      voidedAt: nowIso(),
      voidReason: trimmedReason,
    })

    const profile = await syncProfileTotals(earning.affiliateId).catch(() => null)

    if (profile?.userId) {
      await notifyQuietly({
        userId: profile.userId,
        type: NOTIFICATION_TYPE.AFFILIATE_CONVERSION,
        title: 'Referral commission voided',
        body:
          `${formatCurrency(earning.amount, earning.currency)} of referral commission has been ` +
          `voided and removed from your balance. ${trimmedReason}`,
        entityType: 'affiliate_earning',
        entityId: earning.id,
      })
    }

    await auditQuietly(actor, {
      action: 'affiliate.earning.void',
      entityType: 'affiliate_earning',
      entityId: earning.id,
      meta: {
        affiliateId: earning.affiliateId,
        orderId: earning.orderId,
        amount: earning.amount,
        fromStatus: earning.status,
        toStatus: AFFILIATE_EARNING_STATUS.VOID,
        reason: trimmedReason,
      },
    })

    return updated
  },

  /**
   * **Suspends or reactivates an affiliate account** (admin `affiliates.manage`).
   *
   * A suspended code stops capturing and stops accruing immediately
   * ({@link getCapturableByCode}); commission already earned is untouched —
   * taking that away is {@link voidEarning}'s job, and conflating the two would
   * make a suspension irreversible in practice.
   *
   * @param {string} affiliateId `aff_…`
   * @param {object} options
   * @param {'active'|'suspended'} options.status the new profile status
   * @param {string} [options.reason] required when suspending
   * @param {{id: string, role: string}} [options.actor] the acting admin
   * @returns {Promise<object>} the updated affiliate account
   * @throws {ApiError} `validation_failed` · `conflict` (already in that status)
   */
  async setProfileStatus(affiliateId, { status, reason, actor } = {}) {
    const isSuspending = status === AFFILIATE_PROFILE_STATUS.SUSPENDED
    if (!isSuspending && status !== AFFILIATE_PROFILE_STATUS.ACTIVE) {
      throw createApiError(
        API_ERROR_CODE.VALIDATION_FAILED,
        'An affiliate account is either active or suspended.',
        { status: 'Choose active or suspended.' },
        422
      )
    }

    const trimmedReason = String(reason ?? '').trim()
    if (isSuspending && !trimmedReason) {
      throw createApiError(
        API_ERROR_CODE.VALIDATION_FAILED,
        'Say why this affiliate account is being suspended.',
        { reason: 'A reason is required — it is recorded on the audit trail.' },
        422
      )
    }

    const profile = await affiliateProfiles.getById(affiliateId)
    if (profile.status === status) {
      throw createApiError(
        API_ERROR_CODE.CONFLICT,
        'That affiliate account has already been moved — reload the list.',
        { status: profile.status },
        409
      )
    }

    const updated = await affiliateProfiles.update(affiliateId, {
      status,
      ...(isSuspending
        ? { suspendedAt: nowIso(), suspendedReason: trimmedReason }
        : { suspendedAt: null, suspendedReason: null }),
    })

    await notifyQuietly({
      userId: profile.userId,
      type: NOTIFICATION_TYPE.AFFILIATE_CONVERSION,
      title: isSuspending ? 'Referral link paused' : 'Referral link reactivated',
      body: isSuspending
        ? `Your referral link has been paused and is no longer recording signups. ${trimmedReason} ` +
          'Commission you have already earned is unaffected.'
        : 'Your referral link is active again and is recording signups as normal.',
      entityType: 'affiliate_profile',
      entityId: profile.id,
    })

    await auditQuietly(actor, {
      action: isSuspending ? 'affiliate.suspend' : 'affiliate.reactivate',
      entityType: 'affiliate_profile',
      entityId: profile.id,
      meta: {
        userId: profile.userId,
        code: profile.code,
        fromStatus: profile.status,
        toStatus: status,
        ...(isSuspending ? { reason: trimmedReason } : null),
      },
    })

    return updated
  },

  /* ---------------------------------------------------------------------- */
  /* 5. Settlement                                                          */
  /* ---------------------------------------------------------------------- */

  /**
   * What an affiliate can currently ask to be paid, and why.
   *
   * `available` is the sum of their **approved** commission less anything
   * already in flight — an affiliate who asked for their balance yesterday
   * cannot ask for it again today. `pending` commission is not available: it has
   * not been reviewed yet, and showing it as withdrawable would be a promise the
   * approval queue has not made.
   *
   * @param {string} affiliateId `aff_…`
   * @param {object} [options]
   * @param {string} [options.userId] the member behind the account — resolves
   *   the payout details the request dialog names as the destination
   * @returns {Promise<{available: number, approved: number, pending: number, paid: number,
   *   inFlight: number, minimum: number, currency: string, canRequest: boolean,
   *   method: object|null}>}
   */
  async getPayoutBalance(affiliateId, { userId } = {}) {
    const { payoutMinAmount, currency } = await getProgramSettings()
    const empty = {
      available: 0,
      approved: 0,
      pending: 0,
      paid: 0,
      inFlight: 0,
      minimum: payoutMinAmount,
      currency,
      canRequest: false,
      method: null,
    }
    if (!affiliateId) return empty

    const [earnings, payouts, method] = await Promise.all([
      affiliateEarnings.list({ page: 1, limit: FOLD_LIMIT, filters: { affiliateId } }),
      affiliateService.listPayouts(affiliateId, { page: 1, limit: FOLD_LIMIT }),
      // A buyer-only affiliate has no payout details at all, which is a fact the
      // dialog states rather than a failure — hence the `null` fallback.
      userId ? affiliateService.resolvePayoutMethod(userId).catch(() => null) : null,
    ])

    const totals = totalsFromEarnings(earnings.items)
    const inFlight = sumMoney(
      payouts.items
        .filter(
          (payout) =>
            payout.status === PAYOUT_STATUS.REQUESTED || payout.status === PAYOUT_STATUS.PROCESSING
        )
        .map((payout) => payout.amount)
    )
    const available = Math.max(0, subtractMoney(totals.approvedEarnings, inFlight))

    return {
      available,
      approved: totals.approvedEarnings,
      pending: totals.pendingEarnings,
      paid: totals.paidEarnings,
      inFlight,
      minimum: payoutMinAmount,
      currency: earnings.items[0]?.currency ?? currency,
      canRequest: available > 0 && available >= payoutMinAmount,
      method,
    }
  },

  /**
   * **An affiliate asks for their approved commission** (contract §7 operation
   * 13). Written as a `payouts` row with `source: 'affiliate'`, so referral
   * settlements move through the finance queue Prompt 32 already built rather
   * than a second one nobody would remember to check.
   *
   * **The request is always the whole approved balance.** Unlike a creator's
   * ledger balance — a single fungible number a creator can take any slice of —
   * affiliate commission is a set of discrete, individually approved records
   * that each settle whole. A part-payment would leave a payout that no set of
   * earnings adds up to, and the affiliate's own table would stop reconciling
   * with the total above it. `amount` is accepted for API symmetry and must
   * match; the balance is re-derived here either way and is the authority.
   *
   * @param {string} userId `usr_…` — the member, not the affiliate profile
   * @param {object} [options]
   * @param {number} [options.amount] must equal the available balance when given
   * @returns {Promise<object>} the created payout request
   * @throws {ApiError} `not_found` (not enrolled) · `forbidden` (suspended) ·
   *   `validation_failed` (nothing approved, below the minimum, wrong amount)
   */
  async requestAffiliatePayout(userId, { amount } = {}) {
    const profile = await affiliateService.getByUserId(userId)
    if (!profile) {
      throw createApiError(
        API_ERROR_CODE.NOT_FOUND,
        'You are not enrolled in the referral program.',
        undefined,
        404
      )
    }

    if (profile.status !== AFFILIATE_PROFILE_STATUS.ACTIVE) {
      throw createApiError(
        API_ERROR_CODE.FORBIDDEN,
        'Payouts are paused while your affiliate account is suspended.',
        undefined,
        403
      )
    }

    const balance = await affiliateService.getPayoutBalance(profile.id)

    if (balance.available <= 0) {
      throw createApiError(
        API_ERROR_CODE.VALIDATION_FAILED,
        'You have no approved commission to pay out yet.',
        {
          amount:
            balance.pending > 0
              ? `${formatCurrency(balance.pending, balance.currency)} is still waiting to be reviewed.`
              : 'Commission becomes available once our team has approved it.',
        },
        422
      )
    }

    if (balance.available < balance.minimum) {
      throw createApiError(
        API_ERROR_CODE.VALIDATION_FAILED,
        'That is below the affiliate payout minimum.',
        {
          amount: `The minimum affiliate payout is ${formatCurrency(balance.minimum, balance.currency)}. You have ${formatCurrency(balance.available, balance.currency)} approved.`,
          minimum: balance.minimum,
        },
        422
      )
    }

    const requested = toAmount(amount)
    if (requested !== null && requested !== balance.available) {
      throw createApiError(
        API_ERROR_CODE.VALIDATION_FAILED,
        'An affiliate payout settles your whole approved balance.',
        {
          amount: `Request ${formatCurrency(balance.available, balance.currency)} — approved commission is paid out in full.`,
          available: balance.available,
        },
        422
      )
    }

    // The member's payout details, when the account has any. A buyer-only
    // affiliate has none — the finance team confirms where to send it, which is
    // what the dialog says. Laravel makes payout details a precondition.
    const method = await affiliateService
      .resolvePayoutMethod(userId)
      .catch(() => null)

    const payout = await payoutService.create({
      source: PAYOUT_SOURCE.AFFILIATE,
      userId,
      affiliateId: profile.id,
      amount: balance.available,
      currency: balance.currency,
      method,
      status: PAYOUT_STATUS.REQUESTED,
      processedAt: null,
    })

    await notifyQuietly({
      userId,
      type: NOTIFICATION_TYPE.AFFILIATE_PAYOUT,
      title: 'Affiliate payout requested',
      body:
        `${formatCurrency(balance.available, balance.currency)} of referral commission has been ` +
        'requested. Our finance team reviews affiliate payouts before the money is sent.',
      entityType: 'payout',
      entityId: payout.id,
    })

    return payout
  },

  /**
   * The payout details to snapshot onto an affiliate settlement, or `null`.
   *
   * Split out so the import of `creatorProfileService` stays lazy: most
   * affiliates are buyers, who have no payout method to look up at all.
   *
   * @param {string} userId `usr_…`
   * @returns {Promise<object|null>}
   */
  async resolvePayoutMethod(userId) {
    const { creatorProfileService } = await import('./creatorProfileService')
    const profile = await creatorProfileService.getByUserId(userId).catch(() => null)
    return profile?.payoutMethod ?? null
  },

  /**
   * **Settles the earnings behind a paid affiliate payout** — called from
   * `paymentService.markPayoutPaid` once the transfer is confirmed.
   *
   * Every `approved` earning the affiliate holds becomes `paid` (the payout is
   * always the whole approved balance, so "which ones" is never ambiguous), each
   * one writes its `affiliate_commission` ledger row — the same row the seed
   * writes for historic paid commission — and the profile's totals are
   * recomputed. The matching negative `payout` row is written by
   * `markPayoutPaid` itself, so the pair nets to zero on the member's ledger.
   *
   * Never throws: the payout is already paid by the time this runs, and an
   * accounting tidy-up must not turn a completed transfer into an error. A
   * failure is logged and leaves the earnings approved, which an admin can
   * re-run by re-confirming.
   *
   * @param {object} payout the `paid` payout row
   * @returns {Promise<{settled: object[], profile: object}|null>}
   */
  async settleAffiliatePayout(payout) {
    try {
      if (payout?.source !== PAYOUT_SOURCE.AFFILIATE || !payout.affiliateId) return null

      const { items } = await affiliateEarnings.list({
        page: 1,
        limit: FOLD_LIMIT,
        sort: 'createdAt',
        order: SORT_ORDER.ASC,
        filters: { affiliateId: payout.affiliateId, status: AFFILIATE_EARNING_STATUS.APPROVED },
      })
      if (items.length === 0) return null

      const profile = await affiliateProfiles.getById(payout.affiliateId).catch(() => null)
      const paidAt = payout.processedAt ?? nowIso()
      const settled = []

      for (const earning of items) {
        // Sequential: JSON Server rewrites the whole of db.json on every write,
        // and concurrent writes silently lose one another (see
        // `notificationService.notifyAdmins`).
        // eslint-disable-next-line no-await-in-loop
        settled.push(
          await affiliateEarnings.update(earning.id, {
            status: AFFILIATE_EARNING_STATUS.PAID,
            paidAt,
          })
        )

        if (profile?.userId) {
          // eslint-disable-next-line no-await-in-loop
          await transactions
            .create({
              type: TRANSACTION_TYPE.AFFILIATE_COMMISSION,
              userId: profile.userId,
              orderId: earning.orderId,
              amount: round2(earning.amount),
              currency: earning.currency ?? appConfig.defaultCurrency,
              description: `Affiliate commission for referral code ${profile.code}`,
              payoutId: payout.id,
            })
            .catch(() => null)
        }
      }

      const updatedProfile = await syncProfileTotals(payout.affiliateId)

      // No notification here on purpose: `markPayoutPaid` sends the "Payout
      // sent" message for every settlement it confirms, whatever its source,
      // and a second bell item for one transfer reads as two payments.

      return { settled, profile: updatedProfile }
    } catch (failure) {
      // eslint-disable-next-line no-console
      console.warn('[affiliate] payout settlement could not be recorded', failure)
      return null
    }
  },

  /* ---------------------------------------------------------------------- */
  /* Folds for the screens                                                  */
  /* ---------------------------------------------------------------------- */

  /**
   * **Everything one affiliate's dashboard needs**, in one call: the profile,
   * their referrals and earnings with the names and order references resolved,
   * the payout balance, and their settlement history.
   *
   * Returns `{ profile: null }` for a member who has not enrolled — the pitch
   * card's state, not an error.
   *
   * @param {string} userId `usr_…`
   * @returns {Promise<object>}
   */
  async getDashboard(userId) {
    const profile = await affiliateService.getByUserId(userId)
    if (!profile) return { profile: null }

    const [referrals, earnings, balance, payouts] = await Promise.all([
      affiliateService.listReferrals(profile.id, { page: 1, limit: FOLD_LIMIT }),
      affiliateService.listEarnings(profile.id, { page: 1, limit: FOLD_LIMIT }),
      affiliateService.getPayoutBalance(profile.id, { userId: profile.userId }),
      affiliateService.listPayouts(profile.id, { page: 1, limit: FOLD_LIMIT }),
    ])

    const people = await namesById(referrals.items.map((referral) => referral.referredUserId))

    return {
      profile,
      balance,
      referrals: referrals.items.map((referral) => ({
        ...referral,
        // PRIVACY: the referrer sees *that* somebody signed up, never who. The
        // name is masked here — in the service, so no screen can accidentally
        // render the whole of it — and the mask is what assistive tech reads
        // too (§12: the aria text matches the visual).
        referredName: maskName(people.get(referral.referredUserId)?.name),
      })),
      earnings: earnings.items,
      payouts: payouts.items,
    }
  },

  /**
   * The affiliate roster with each account's member resolved (admin).
   *
   * @param {import('./api/listAdapter').ListParams} [params]
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  async adminListProfiles(params = {}) {
    const result = await affiliateService.list(params)
    if (result.items.length === 0) return result

    const people = await namesById(result.items.map((profile) => profile.userId))
    return {
      ...result,
      items: result.items.map((profile) => ({ ...profile, user: people.get(profile.userId) ?? null })),
    }
  },

  /**
   * The commission approval queue — earnings in one status, oldest first, with
   * the affiliate account and its member attached (admin).
   *
   * @param {object} [options]
   * @param {string} [options.status='pending'] an `AFFILIATE_EARNING_STATUS`
   * @param {number} [options.page=1]
   * @param {number} [options.limit=20]
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  async adminListEarnings({ status = AFFILIATE_EARNING_STATUS.PENDING, page = 1, limit = 20 } = {}) {
    const result = await affiliateEarnings.list({
      page,
      limit,
      sort: 'createdAt',
      // Oldest first: the top of an approval queue is whoever has waited longest.
      order: status === AFFILIATE_EARNING_STATUS.PENDING ? SORT_ORDER.ASC : SORT_ORDER.DESC,
      filters: status ? { status } : {},
    })
    if (result.items.length === 0) return result

    const profiles = await Promise.all(
      [...new Set(result.items.map((earning) => earning.affiliateId))].map((id) =>
        affiliateProfiles.getById(id).catch(() => null)
      )
    )
    const profileById = new Map(profiles.filter(Boolean).map((profile) => [profile.id, profile]))
    const people = await namesById([...profileById.values()].map((profile) => profile.userId))

    return {
      ...result,
      items: result.items.map((earning) => {
        const profile = profileById.get(earning.affiliateId) ?? null
        return {
          ...earning,
          affiliate: profile,
          user: profile ? (people.get(profile.userId) ?? null) : null,
        }
      }),
    }
  },

  /**
   * **Program health in four numbers** — the header of the admin console.
   *
   * `liability` is what BetterBlue owes the program right now: commission that
   * is accrued or approved and has not been paid. It is the number that belongs
   * on a finance screen, so it is computed rather than left to be eyeballed from
   * two columns.
   *
   * MOCK-AGGREGATE: folded from up to {@link FOLD_LIMIT} rows in the browser,
   * like every other platform-wide total in this stack. Laravel answers it with
   * one `GROUP BY`.
   *
   * @returns {Promise<{affiliates: number, activeAffiliates: number, conversions: number,
   *   liability: number, paidOut: number, pending: number, approved: number, currency: string}>}
   */
  async getProgramStats() {
    const { currency } = await getProgramSettings()

    const [profiles, earnings] = await Promise.all([
      affiliateProfiles.list({ page: 1, limit: FOLD_LIMIT }),
      affiliateEarnings.list({ page: 1, limit: FOLD_LIMIT }),
    ])

    const totals = totalsFromEarnings(earnings.items)

    return {
      affiliates: profiles.total ?? profiles.items.length,
      activeAffiliates: profiles.items.filter(
        (profile) => profile.status === AFFILIATE_PROFILE_STATUS.ACTIVE
      ).length,
      conversions: profiles.items.reduce(
        (total, profile) => total + (Number(profile.conversions) || 0),
        0
      ),
      pending: totals.pendingEarnings,
      approved: totals.approvedEarnings,
      liability: sumMoney([totals.pendingEarnings, totals.approvedEarnings]),
      paidOut: totals.paidEarnings,
      currency: earnings.items[0]?.currency ?? currency,
    }
  },
})

/**
 * A referred member's name, masked to its shape: `Verde Kitchen` → `V… Kitchen`.
 *
 * PRIVACY: an affiliate is told that a referral converted, not who it was — the
 * referred business never agreed to be named to the person who shared a link.
 * Enough survives to tell two referrals apart in a table; not enough to identify
 * anyone. Kept beside the service that applies it so a screen cannot opt out.
 *
 * @param {string} [name]
 * @returns {string} the masked name, or `'A BetterBlue member'`
 */
export function maskName(name) {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) return 'A BetterBlue member'
  if (parts.length === 1) return `${parts[0].slice(0, 1)}…`
  return `${parts[0].slice(0, 1)}… ${parts[parts.length - 1]}`
}

/** A short, opaque reference for an order — what an affiliate sees instead of an id. */
export function shortRef(id) {
  const value = String(id ?? '')
  if (!value) return '—'
  const [, tail = value] = value.split('_')
  return `#${tail.slice(-6).toUpperCase()}`
}

export default affiliateService
