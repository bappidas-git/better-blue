// The single axios instance — 00 §10, `docs/api-contract.md` §1.1/§2.2.
//
// This is the only module in the app that constructs an HTTP client. Features
// call services, services call `apiClient`, and nothing else imports axios.

import axios from 'axios'

import { env } from '@/config/env'
import { getItem } from '@/utils/storage'

import { toApiError } from './apiError'

/** Storage key holding the mock session — `bb.auth` in localStorage. */
export const AUTH_STORAGE_KEY = 'auth'

/** Request timeout. Long enough for `--delay 300`, short enough to fail fast. */
export const REQUEST_TIMEOUT_MS = 15000

/**
 * MOCK-API: how many times a *read* is retried after a transport failure.
 *
 * `json-server --watch` reloads whenever `db.json` changes — including when it
 * wrote the file itself — and for a few hundred milliseconds during that reload
 * the port refuses connections. A composite operation that writes several
 * records in a burst (resolving a dispute writes a payment, three ledger rows, a
 * commission and three notifications) reliably lands a later request inside that
 * window, and the whole operation fails halfway with the money already moved.
 *
 * That is a property of the dev server, not of the API, so it is absorbed here —
 * the one module that is allowed to know about the provider (00 §10). Laravel
 * does not restart between requests, and this loop simply never fires.
 *
 * **Reads only.** A GET can be repeated safely; a POST that died mid-flight may
 * or may not have been applied, and a second attempt would risk a duplicate
 * ledger row — worse than the failure it is papering over. Writes still surface
 * as `ApiError` for the caller to report.
 */
const READ_RETRY_LIMIT = 3
const READ_RETRY_DELAY_MS = 250

const IDEMPOTENT_METHODS = new Set(['get', 'head', 'options'])

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** True for a failure that never produced an HTTP response (contract §3.4). */
const isTransportFailure = (error) => Boolean(error) && !error.response && error.code !== 'ECONNABORTED'

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  // Repeated keys without brackets: `status=held&status=released`, which is the
  // contract's OR form (§4.1). Axios' default would emit `status[]=…`.
  paramsSerializer: { indexes: null },
})

apiClient.interceptors.request.use((config) => {
  // MOCK-AUTH: JSON Server cannot authenticate, so the token is minted by
  // `authService` and parked in localStorage. The header is attached here
  // regardless — the mock API ignores it, and Laravel/Sanctum will not, so the
  // wire format is already correct on migration day (contract §2.2/§2.4).
  const session = getItem(AUTH_STORAGE_KEY)
  const token = typeof session === 'string' ? session : session?.token

  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

apiClient.interceptors.response.use(
  // Successful responses pass through **whole**, not unwrapped to `.data`:
  // `listAdapter.parseListResponse` needs the headers (`X-Total-Count`) and the
  // request params to build the list envelope. Callers read `.data` themselves,
  // and never reach past it.
  (response) => response,
  // Every failure — transport, timeout, or HTTP — leaves as an `ApiError`.
  // Services below this line only ever catch `ApiError` (contract §3.4).
  async (error) => {
    const config = error?.config

    if (config && isTransportFailure(error) && IDEMPOTENT_METHODS.has((config.method ?? 'get').toLowerCase())) {
      config.retryCount = (config.retryCount ?? 0) + 1
      if (config.retryCount <= READ_RETRY_LIMIT) {
        await sleep(READ_RETRY_DELAY_MS * config.retryCount)
        return apiClient.request(config)
      }
    }

    return Promise.reject(toApiError(error))
  }
)

export default apiClient
