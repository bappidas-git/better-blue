// Error normalisation — `docs/api-contract.md` §3, 00 §10.
//
// Every failure the app can see — an axios transport error, a bare JSON Server
// 404, a Laravel error envelope, or a guard we enforce client-side — becomes
// one `ApiError`. Nothing outside this folder ever inspects an axios error, a
// response body, or an HTTP status, so error handling in features is a switch
// on `error.code` and nothing more.

import { env } from '@/config/env'

/**
 * The closed set of error codes (contract §3.2). Eight are server-emitted; the
 * ninth, `NETWORK_ERROR`, is synthesised client-side when no response arrived
 * at all and is never sent by any backend.
 */
export const API_ERROR_CODE = Object.freeze({
  VALIDATION_FAILED: 'validation_failed',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  CONFLICT: 'conflict',
  PAYMENT_FAILED: 'payment_failed',
  RATE_LIMITED: 'rate_limited',
  SERVER_ERROR: 'server_error',
  NETWORK_ERROR: 'network_error',
})

/**
 * HTTP status → code. `413` folds into `validation_failed` (contract §5.1) and
 * `400` joins `422` because a provider may use either for a bad body.
 */
const STATUS_CODES = Object.freeze({
  400: API_ERROR_CODE.VALIDATION_FAILED,
  401: API_ERROR_CODE.UNAUTHORIZED,
  402: API_ERROR_CODE.PAYMENT_FAILED,
  403: API_ERROR_CODE.FORBIDDEN,
  404: API_ERROR_CODE.NOT_FOUND,
  409: API_ERROR_CODE.CONFLICT,
  413: API_ERROR_CODE.VALIDATION_FAILED,
  422: API_ERROR_CODE.VALIDATION_FAILED,
  429: API_ERROR_CODE.RATE_LIMITED,
})

/**
 * Fallback copy per code — one plain sentence, safe to render (contract §3.1).
 * A server-supplied `message` always wins over these.
 */
const DEFAULT_MESSAGES = Object.freeze({
  [API_ERROR_CODE.VALIDATION_FAILED]: 'Some fields need your attention.',
  [API_ERROR_CODE.UNAUTHORIZED]: 'Please sign in to continue.',
  [API_ERROR_CODE.FORBIDDEN]: 'You do not have access to do that.',
  [API_ERROR_CODE.NOT_FOUND]: 'We could not find what you were looking for.',
  [API_ERROR_CODE.CONFLICT]: 'That action conflicts with the current state of this record.',
  [API_ERROR_CODE.PAYMENT_FAILED]: 'The payment could not be completed.',
  [API_ERROR_CODE.RATE_LIMITED]: 'Too many requests — please wait a moment and try again.',
  [API_ERROR_CODE.SERVER_ERROR]: 'Something went wrong on our side. Please try again.',
  [API_ERROR_CODE.NETWORK_ERROR]: 'We could not reach BetterBlue. Check your connection and try again.',
})

// The dev hint is the single most useful error message in this project: a
// blank list page almost always means the mock API is not running.
const NETWORK_MESSAGE_DEV =
  'Can’t reach the BetterBlue API — is `npm run api` running?'

/**
 * The only error type the app sees.
 *
 * @property {number} status HTTP status, or `0` when no response arrived
 * @property {string} code one of `API_ERROR_CODE`
 * @property {string} message one sentence, safe to display
 * @property {object|undefined} details field errors or code-specific context
 */
export class ApiError extends Error {
  /**
   * @param {object} [init]
   * @param {number} [init.status=0]
   * @param {string} [init.code='server_error']
   * @param {string} [init.message] defaults to the copy for `code`
   * @param {object} [init.details]
   * @param {unknown} [init.cause] the original failure, kept for debugging
   */
  constructor({ status = 0, code = API_ERROR_CODE.SERVER_ERROR, message, details, cause } = {}) {
    super(message || DEFAULT_MESSAGES[code] || DEFAULT_MESSAGES[API_ERROR_CODE.SERVER_ERROR])
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    // Non-enumerable so `cause` never lands in a toast, a log line, or JSON.
    Object.defineProperty(this, 'cause', { value: cause, enumerable: false, writable: true })
  }
}

/** True when `value` is an `ApiError` — safe across module instances. */
export function isApiError(value) {
  return value instanceof ApiError || (Boolean(value) && value.name === 'ApiError')
}

/**
 * Builds an `ApiError` for a failure we detect client-side — an illegal status
 * transition, an ownership check, a rejected upload. Contract §3.4: these carry
 * the *same* codes the real backend will return, so when Laravel starts
 * enforcing them for real no call site changes.
 *
 * @param {string} code one of `API_ERROR_CODE`
 * @param {string} [message] display copy; defaults to the copy for `code`
 * @param {object} [details] field errors or code-specific context
 * @param {number} [status=0] HTTP status to report; `0` marks "never sent"
 * @returns {ApiError}
 */
export function createApiError(code, message, details, status = 0) {
  return new ApiError({ status, code, message, details })
}

/** Reads a contract-shaped `{ error: { code, message, details } }` envelope. */
function readEnvelope(data) {
  if (!data || typeof data !== 'object') return null
  const envelope = data.error
  if (!envelope || typeof envelope !== 'object') return null
  const code = Object.values(API_ERROR_CODE).includes(envelope.code) ? envelope.code : null
  if (!code) return null
  return {
    code,
    message: typeof envelope.message === 'string' ? envelope.message : undefined,
    details: envelope.details && typeof envelope.details === 'object' ? envelope.details : undefined,
  }
}

/** `true` for the axios failures that never produced a response. */
function isTransportFailure(error) {
  return !error?.response
}

/**
 * Normalises **any** failure into an `ApiError` (contract §3.4). Safe to call
 * with an axios error, an `ApiError` (returned unchanged), or anything else.
 *
 * @param {unknown} error the raw failure, usually an axios error
 * @returns {ApiError}
 */
export function toApiError(error) {
  if (isApiError(error)) return error

  if (isTransportFailure(error)) {
    // Offline, DNS failure, CORS, or the 15s timeout — no status exists.
    return new ApiError({
      status: 0,
      code: API_ERROR_CODE.NETWORK_ERROR,
      message: env.isDev ? NETWORK_MESSAGE_DEV : undefined,
      cause: error,
    })
  }

  const { status, data } = error.response
  const envelope = readEnvelope(data)

  if (envelope) {
    // A real backend answered in the contract envelope — trust it verbatim.
    return new ApiError({ status, ...envelope, cause: error })
  }

  let code = STATUS_CODES[status] ?? API_ERROR_CODE.SERVER_ERROR

  // Contract §3.4: a create that collides on `id` answers `500` with no
  // envelope, and a duplicate is the only way a create fails that way. A real
  // backend always sends the envelope above, so this branch is unreachable
  // once one is in place.
  const method = String(error.config?.method ?? '').toLowerCase()
  if (status === 500 && method === 'post') code = API_ERROR_CODE.CONFLICT

  return new ApiError({ status, code, cause: error })
}
