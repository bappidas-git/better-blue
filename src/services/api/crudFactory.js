// Baseline REST verbs for one collection — `docs/api-contract.md` §1.7.
//
// Every domain service is built on one of these plus its own intention-named
// helpers. Keeping the five verbs in one place means the id/timestamp injection
// that JSON Server forces on us (below) lives in exactly one file, and deleting
// it on migration day is a one-line change.

import { generateId } from '@/utils/id'

import { apiClient } from './apiClient'
import { buildListParams, parseListResponse } from './listAdapter'

/** Percent-encodes an id so an odd character cannot break out of the path. */
const toPath = (collection, id) => `${collection}/${encodeURIComponent(String(id ?? ''))}`

/**
 * @typedef {object} CrudService
 * @property {string} resourcePath the collection path, e.g. `/orders`
 * @property {(params?: import('./listAdapter').ListParams) => Promise<import('./listAdapter').ListResult>} list
 * @property {(id: string) => Promise<object>} getById
 * @property {(payload: object) => Promise<object>} create
 * @property {(id: string, patch: object) => Promise<object>} update
 * @property {(id: string) => Promise<void>} remove
 */

/**
 * Builds the five REST verbs for a collection. Each returns parsed data or
 * throws an `ApiError` — no axios response ever escapes.
 *
 * @param {string} resourcePath collection name or path, e.g. `'orders'`
 * @param {object} [options]
 * @param {string} [options.idPrefix] entity prefix from `ID_PREFIX`, used by
 *   `create` to mint the client-side id
 * @param {string|null} [options.timestampField='createdAt'] creation timestamp
 *   `create` fills in; `null` for collections that name it differently
 *   (`payouts.requestedAt`) or do not carry one (`categories`)
 * @returns {CrudService}
 */
export function createCrudService(resourcePath, { idPrefix, timestampField = 'createdAt' } = {}) {
  const collection = `/${String(resourcePath).replace(/^\/+/, '')}`

  return Object.freeze({
    resourcePath: collection,

    /**
     * @param {import('./listAdapter').ListParams} [params]
     * @returns {Promise<import('./listAdapter').ListResult>} `{ items, total, page, limit }`
     */
    async list(params = {}) {
      const response = await apiClient.get(collection, { params: buildListParams(params) })
      return parseListResponse(response)
    },

    /**
     * @param {string} id opaque record id
     * @returns {Promise<object>} the record
     * @throws {ApiError} `not_found` when there is no such record
     */
    async getById(id) {
      const response = await apiClient.get(toPath(collection, id))
      return response.data
    },

    /**
     * @param {object} payload the record to create; an explicit `id` or
     *   timestamp in the payload always wins over the injected one
     * @returns {Promise<object>} the created record
     */
    async create(payload = {}) {
      // MOCK-ID: JSON Server mints its own prefix-less id when a POST body has
      // none (contract §1.4), so the client generates a domain id and sends it.
      // MOCK-TIMESTAMP: nothing server-side stamps a creation time either.
      //
      // Both are the single largest "wrong on purpose" in the mock stack. The
      // Laravel backend generates the id, stamps the timestamp, and **ignores**
      // whatever the client sends — at which point these two lines are deleted
      // and no call site changes.
      const body = { id: generateId(idPrefix), ...payload }
      if (timestampField && body[timestampField] === undefined) {
        body[timestampField] = new Date().toISOString()
      }

      const response = await apiClient.post(collection, body)
      return response.data
    },

    /**
     * Partial update — send only the fields that changed. `PUT` is not part of
     * this contract (§1.7).
     *
     * @param {string} id opaque record id
     * @param {object} patch changed fields only
     * @returns {Promise<object>} the updated record
     */
    async update(id, patch) {
      const response = await apiClient.patch(toPath(collection, id), patch)
      return response.data
    },

    /**
     * **Nothing in BetterBlue calls this.** Removal is always a status
     * transition (contract §1.7), so `DELETE` has no product call site — the
     * verb exists here only to keep the factory complete.
     *
     * MOCK-DELETE: JSON Server's cascade pass walks `platformSettings`, which
     * has no ids, and throws. The record *is* removed and the response is still
     * `500`, so this always rejects with `server_error`. Verified against
     * `json-server 0.17.4`.
     *
     * @param {string} id opaque record id
     * @returns {Promise<void>}
     */
    async remove(id) {
      await apiClient.delete(toPath(collection, id))
    },
  })
}

export default createCrudService
