// Escrow payments and the ledger — `docs/api-contract.md` §6.12, §6.13.
//
// Baseline reads only. The escrow workflow — funding an order, releasing to the
// creator, refunding — arrives in Prompt 17 together with the dummy payment
// provider in `services/payments/`.

import { ID_PREFIX } from '@/utils/id'

import { createCrudService } from './api/crudFactory'
import { SORT_ORDER } from './api/listAdapter'

const payments = createCrudService('payments', { idPrefix: ID_PREFIX.PAYMENT })
const transactions = createCrudService('transactions', { idPrefix: ID_PREFIX.TRANSACTION })

export const paymentService = Object.freeze({
  /**
   * Payment history (buyer's own, or admin-wide).
   *
   * @param {import('./api/listAdapter').ListParams} [params] filters: `orderId`,
   *   `buyerId`, `status`, `createdAt_gte`/`createdAt_lte`,
   *   `amount_gte`/`amount_lte`; sorts: `createdAt`, `amount`
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  list: (params = {}) => payments.list({ sort: 'createdAt', order: SORT_ORDER.DESC, ...params }),

  /**
   * @param {string} id `pay_…`
   * @returns {Promise<object>} the payment
   * @throws {ApiError} `not_found`
   */
  getById: (id) => payments.getById(id),

  /**
   * The payment behind an order. There is one per order plus retries, so the
   * most recent attempt is the live one.
   *
   * @param {string} orderId `ord_…`
   * @returns {Promise<object|null>} the payment, or `null` before the order is funded
   */
  async getByOrderId(orderId) {
    if (!orderId) return null
    const { items } = await payments.list({
      page: 1,
      limit: 1,
      sort: 'createdAt',
      order: SORT_ORDER.DESC,
      filters: { orderId },
    })
    return items[0] ?? null
  },

  /**
   * The ledger (contract §6.13). `amount` is signed from the perspective of
   * `userId`: money leaving is negative, money arriving is positive.
   *
   * Append-only — there is no create, update, or delete. Rows are written by
   * the escrow workflow as a side effect of money actually moving.
   *
   * @param {import('./api/listAdapter').ListParams} [params] filters: `userId`,
   *   `orderId`, `paymentId`, `payoutId`, `type`,
   *   `createdAt_gte`/`createdAt_lte`; sort: `createdAt`
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  listTransactions: (params = {}) =>
    transactions.list({ sort: 'createdAt', order: SORT_ORDER.DESC, ...params }),

  /**
   * One ledger line.
   *
   * @param {string} id `txn_…`
   * @returns {Promise<object>} the transaction
   * @throws {ApiError} `not_found`
   */
  getTransactionById: (id) => transactions.getById(id),

  // —— workflow operations (added by later prompts) ——
  // initiateOrderPayment / releasePayment / refundPayment — Prompt 17
  // (payments & escrow), contract §7 operations 2–4. Each writes the payment,
  // the ledger rows, the commission record, and the notifications together.
})

export default paymentService
