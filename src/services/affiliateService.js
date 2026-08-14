// The referral program — `docs/api-contract.md` §6.23–§6.25.
//
// Baseline reads only. Enrolment and conversion (contract §7 operations 9 and
// 10) arrive with the affiliate feature in Prompt 22.

import { ID_PREFIX } from '@/utils/id'

import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'

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

  // —— workflow operations (added by later prompts) ——
  // enrollAffiliate — Prompt 22 (affiliate), contract §7 operation 9.
  // processConversion — Prompt 22, run when a referred account's first
  // qualifying order completes inside the attribution window.
  // approveEarning / voidEarning — Prompt 31 (admin finance).
})

export default affiliateService
