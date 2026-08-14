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
  (error) => Promise.reject(toApiError(error))
)

export default apiClient
