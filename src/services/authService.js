// Authentication — `docs/api-contract.md` §2, 00 §14.
//
// **This module is the entire mock-auth surface of BetterBlue.** JSON Server
// cannot authenticate, so the four contract operations are simulated over
// `/users` while keeping the exact signatures Laravel will implement:
//
//   login({ email, password })  → { token, user }
//   register({ role, name, … }) → { token, user }
//   me()                        → { user }
//   logout()                    → void
//
// Every shortcut below is marked `MOCK-AUTH:` with the line that replaces it.
// On migration day each function body becomes one `apiClient.post('/auth/…')`
// call and **nothing else in the app changes** — not `AuthContext`, not the
// guards, not the request interceptor (contract §2.4).
//
// SECURITY: none of this is access control. The password comparison, the status
// gate, and the self-registerable-role check all run in the browser, where a
// determined visitor can skip them. They exist so the real flows are exercised
// from day one; the Laravel API must enforce all three independently
// (00 §11/§14, contract §9.1).

import { appConfig } from '@/config/appConfig'
import { avatarDataUri } from '@/constants/images'
import { NOTIFICATION_CATEGORY } from '@/constants/notificationTypes'
import { ROLES } from '@/constants/roles'
import { ACCOUNT_STATUS, STATUS_META } from '@/constants/statuses'
import { getItem, removeItem, setItem } from '@/utils/storage'

import { apiClient, AUTH_STORAGE_KEY } from './api/apiClient'
import { API_ERROR_CODE, createApiError } from './api/apiError'
import { buildListParams, parseListResponse } from './api/listAdapter'
import { buyerProfileService } from './buyerProfileService'
import { creatorProfileService } from './creatorProfileService'
import { userService } from './userService'

/**
 * Storage key holding the affiliate code captured by the `/r/:code` landing
 * route — `bb.referralCode`. Prompt 32 writes it; registration reads it once
 * and records it on the account as `referredByCode` (contract §2.1).
 */
export const REFERRAL_STORAGE_KEY = 'referralCode'

/** Roles a visitor may create for themselves (contract §2.1). */
export const SELF_REGISTERABLE_ROLES = Object.freeze([ROLES.BUYER, ROLES.CREATOR])

/** One message for both "no such account" and "wrong password" — see `login`. */
const CREDENTIALS_MESSAGE = 'Incorrect email or password'

/** Marks the mock token so it is obvious in devtools that it proves nothing. */
const MOCK_TOKEN_PREFIX = 'MOCK-AUTH'

/**
 * Shortest password the platform accepts — the floor `changePassword` enforces,
 * and the number the account screens phrase their rules around. The sign-up
 * form applies the same minimum plus "one letter and one digit"; the API is the
 * authority on all of it (contract §9.5).
 */
export const PASSWORD_MIN_LENGTH = 8

/** Sign-in identifiers are compared case-insensitively and stored lowercased. */
const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase()

/* -------------------------------------------------------------------------- */
/* Session storage                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The persisted session — `{ token, user }` under `bb.auth`, the same key the
 * request interceptor reads the bearer token from (`apiClient`).
 *
 * @returns {{token: string, user: object}|null} the stored session, or `null`
 */
export function readStoredSession() {
  const session = getItem(AUTH_STORAGE_KEY)
  if (!session || typeof session !== 'object') return null
  if (typeof session.token !== 'string' || !session.user?.id) return null
  return session
}

/** Writes `{ token, user }` to `bb.auth`. */
function storeSession(session) {
  setItem(AUTH_STORAGE_KEY, session)
  return session
}

/** Removes `bb.auth`. Safe to call when there is no session. */
export function clearStoredSession() {
  removeItem(AUTH_STORAGE_KEY)
}

/* -------------------------------------------------------------------------- */
/* Mock primitives                                                            */
/* -------------------------------------------------------------------------- */

/**
 * MOCK-AUTH: mints the fake bearer token. It is `MOCK-AUTH.<base64 claims>` so
 * a developer reading localStorage can see who is signed in — it is **not** a
 * JWT and the client never decodes it. Role, permissions, and account status
 * come from the `user` object, refreshed by `me()` (contract §2.2).
 *
 * Laravel returns a real Sanctum token here and this function disappears.
 */
function mintToken(user) {
  const claims = JSON.stringify({
    sub: user.id,
    role: user.role,
    iat: new Date().toISOString(),
  })
  try {
    return `${MOCK_TOKEN_PREFIX}.${window.btoa(claims)}`
  } catch {
    // No `btoa` (non-browser runtime) — the token only has to be opaque.
    return `${MOCK_TOKEN_PREFIX}.${user.id}`
  }
}

/**
 * MOCK-AUTH: JSON Server serialises `users.password` on every response
 * (contract §9.4). This is the one module allowed to read that field, and this
 * is where it stops — nothing it returns carries a credential into
 * `AuthContext`, React state, or storage.
 *
 * Laravel's API Resource never serialises the column and this disappears.
 */
function withoutPassword(user) {
  if (!user || typeof user !== 'object') return user
  const safe = { ...user }
  delete safe.password
  return safe
}

/**
 * MOCK-AUTH: the credential lookup. `userService.findByEmail` strips
 * `password`, so sign-in has to read the raw record through `apiClient` — going
 * through `listAdapter` keeps even this call provider-agnostic (00 §10).
 *
 * The exact-match query is the fast path; every seeded and registered address
 * is stored lowercased, so it hits. The `search` fallback covers a record that
 * was written with different casing, which keeps the "case-insensitive"
 * promise true rather than incidental.
 *
 * Laravel does `User::whereRaw('LOWER(email) = ?', …)` in one indexed query.
 */
async function findCredentialRecord(email) {
  const normalized = normalizeEmail(email)
  if (!normalized) return null

  const exact = await apiClient.get('/users', {
    params: buildListParams({ page: 1, limit: 1, filters: { email: normalized } }),
  })
  const [match] = parseListResponse(exact).items
  if (match) return match

  const fuzzy = await apiClient.get('/users', {
    params: buildListParams({ page: 1, limit: 20, search: normalized }),
  })
  return (
    parseListResponse(fuzzy).items.find(
      (candidate) => normalizeEmail(candidate.email) === normalized
    ) ?? null
  )
}

/**
 * The account-status gate (contract §2.3). Non-`active` accounts cannot sign in
 * and their existing sessions are revoked on the next `me()`.
 *
 * `details.accountStatus` is what lets the client render the right status
 * screen instead of a generic error, and the copy comes from `STATUS_META` so
 * it stays identical on both sides of the migration.
 *
 * @throws {ApiError} `forbidden` when the account is not `active`
 */
function assertAccountActive(user) {
  const status = user?.accountStatus
  if (status === ACCOUNT_STATUS.ACTIVE) return

  throw createApiError(
    API_ERROR_CODE.FORBIDDEN,
    STATUS_META[status]?.description ??
      'Access to this account is restricted. Contact support if you think this is a mistake.',
    { accountStatus: status },
    403
  )
}

/** All seven notification categories on — the default for a new account. */
function defaultNotificationPrefs() {
  return Object.fromEntries(
    Object.values(NOTIFICATION_CATEGORY).map((category) => [category, { inApp: true }])
  )
}

/**
 * Creates the profile row that belongs with a new account, so a member is never
 * left without one (contract §2.1). Buyers get the business record, creators
 * get the storefront; both are skeletons the member completes later.
 */
function createProfileFor(user, { companyName, displayName }) {
  if (user.role === ROLES.BUYER) {
    return buyerProfileService.create({
      userId: user.id,
      companyName,
      logoUrl: avatarDataUri(companyName),
      // Derived and read-only — seeded at zero, recomputed from `payments`.
      totalSpent: 0,
    })
  }

  return creatorProfileService.create({
    userId: user.id,
    displayName,
    // The storefront starts empty: categories, content types, pricing, and the
    // rest are filled in on the creator's profile screen (Prompt 20). It is
    // listed as available from day one so a new creator is discoverable while
    // they build it out.
    categories: [],
    contentTypes: [],
    languages: [],
    startingPrice: 0,
    currency: appConfig.defaultCurrency,
    responseTimeHours: 24,
    availability: true,
    featured: false,
    verified: false,
    // Derived and read-only — recomputed from reviews and completed orders.
    ratingAvg: 0,
    ratingCount: 0,
    completedOrders: 0,
  })
}

/* -------------------------------------------------------------------------- */
/* The four operations                                                        */
/* -------------------------------------------------------------------------- */

export const authService = Object.freeze({
  /**
   * `POST /auth/login` (contract §2.1).
   *
   * MOCK-AUTH: `GET /users?email=…` → compare the plain-text password → check
   * `accountStatus` → mint a token → stamp `lastLoginAt` → strip `password`.
   *
   * A wrong password and an unregistered address produce the **same**
   * `unauthorized` error, so the response cannot be used to discover which
   * addresses have accounts.
   *
   * @param {object} credentials
   * @param {string} credentials.email sign-in address, matched case-insensitively
   * @param {string} credentials.password plain-text password
   * @returns {Promise<{token: string, user: object}>} the signed-in session
   * @throws {ApiError} `unauthorized` (bad credentials) · `forbidden` with
   *   `details.accountStatus` (suspended/blacklisted/deactivated)
   */
  async login({ email, password } = {}) {
    const record = await findCredentialRecord(email)

    // MOCK-AUTH: plain-text comparison. Laravel does `Hash::check($password,
    // $user->password)` against a hashed column (contract §2.5).
    if (!record || record.password !== password) {
      throw createApiError(API_ERROR_CODE.UNAUTHORIZED, CREDENTIALS_MESSAGE, undefined, 401)
    }

    // Credentials first, status second: an attacker guessing passwords against
    // a suspended account must not learn that the password was right.
    assertAccountActive(record)

    // MOCK-AUTH: `PATCH /users/:id` for the sign-in timestamp — Laravel writes
    // it in the same transaction that issues the token. A failure here must not
    // fail the sign-in, so the unpatched record is used instead.
    let user = withoutPassword(record)
    try {
      user = await userService.update(record.id, { lastLoginAt: new Date().toISOString() })
    } catch {
      // Non-fatal: the person is signed in either way.
    }

    return storeSession({ token: mintToken(user), user })
  },

  /**
   * `POST /auth/register` (contract §2.1) — creates a `buyer` or `creator`
   * account, its profile row, and signs it in.
   *
   * MOCK-AUTH: `GET /users?email=…` for uniqueness → `POST /users` →
   * `POST /buyerProfiles` or `POST /creatorProfiles` → mint a token. Laravel
   * does all of it in one transaction, which is why a mid-sequence failure here
   * can leave an account without a profile — a limitation the real backend
   * removes rather than one the client should paper over.
   *
   * @param {object} payload
   * @param {'buyer'|'creator'} payload.role the account type — `admin` and
   *   `super_admin` are never self-registerable
   * @param {string} payload.name the person's name
   * @param {string} payload.email sign-in address, stored lowercased
   * @param {string} payload.password plain-text password (MOCK-AUTH)
   * @param {string} [payload.companyName] business name — buyers
   * @param {string} [payload.displayName] storefront name — creators
   * @returns {Promise<{token: string, user: object}>} the signed-in session
   * @throws {ApiError} `validation_failed` (unsupported role) · `conflict`
   *   (email already registered)
   */
  async register({ role, name, email, password, companyName, displayName } = {}) {
    if (!SELF_REGISTERABLE_ROLES.includes(role)) {
      throw createApiError(
        API_ERROR_CODE.VALIDATION_FAILED,
        'Choose whether you are joining as a business or as a creator.',
        { role: ['Only buyer and creator accounts can be created here.'] },
        422
      )
    }

    const normalizedEmail = normalizeEmail(email)
    if (await findCredentialRecord(normalizedEmail)) {
      throw createApiError(
        API_ERROR_CODE.CONFLICT,
        'That email address is already registered. Try signing in instead.',
        { email: ['This email address is already registered.'] },
        409
      )
    }

    // The affiliate code captured by the `/r/:code` landing route (Prompt 32).
    // Recording it on the account is the whole of attribution for now.
    const referredByCode = getItem(REFERRAL_STORAGE_KEY) || undefined

    const created = await userService.create({
      email: normalizedEmail,
      // MOCK-AUTH: stored in plain text because JSON Server has nothing to hash
      // with, and the seeded accounts are stored the same way. Laravel hashes on
      // the way in and never serialises the column back out.
      password,
      role,
      accountStatus: ACCOUNT_STATUS.ACTIVE,
      name: String(name ?? '').trim(),
      avatarUrl: avatarDataUri(name),
      lastLoginAt: new Date().toISOString(),
      notificationPrefs: defaultNotificationPrefs(),
      ...(referredByCode ? { referredByCode } : null),
    })

    await createProfileFor(created, { companyName, displayName })

    // TODO(Prompt 34): when `referredByCode` matches an active affiliate, the
    // backend also writes a `pending` affiliateReferrals row (contract §2.1,
    // §7 `processConversion`). The code is recorded on the account today so no
    // attribution is lost before that lands.

    const user = withoutPassword(created)
    return storeSession({ token: mintToken(user), user })
  },

  /**
   * `GET /auth/me` (contract §2.1) — revalidates the stored session on boot,
   * which is how a suspension takes effect without waiting for the next
   * sign-in.
   *
   * MOCK-AUTH: there is no token to validate, so the stored user id is
   * re-fetched and re-checked. Laravel resolves the account **from the bearer
   * token** and ignores anything the client remembers.
   *
   * @returns {Promise<{user: object}>} the current account
   * @throws {ApiError} `unauthorized` (no session) · `forbidden` with
   *   `details.accountStatus` · `not_found` (the account is gone)
   */
  async me() {
    const session = readStoredSession()
    if (!session) {
      throw createApiError(API_ERROR_CODE.UNAUTHORIZED, undefined, undefined, 401)
    }

    const user = await userService.getById(session.user.id)
    assertAccountActive(user)

    // Keep the persisted copy in step with the server on every boot.
    storeSession({ token: session.token, user })
    return { user }
  },

  /**
   * `POST /auth/password` — the signed-in member changes their own password
   * (Prompt 15, buyer settings; the creator and admin screens reuse it).
   *
   * MOCK-AUTH: re-reads the credential record for the stored session, compares
   * the current password in plain text, and `PATCH`es the new one. Laravel
   * validates `current_password` against the hash, hashes the replacement, and
   * revokes the member's other tokens in the same request — none of which this
   * can do. The session survives the change here, exactly as it will there for
   * the token that made the request.
   *
   * SECURITY: like every other check in this module, this one runs in the
   * browser and proves nothing (00 §14). The API must verify the current
   * password itself and must never accept a new one it did not hash.
   *
   * @param {object} payload
   * @param {string} payload.currentPassword the password on file
   * @param {string} payload.newPassword its replacement
   * @returns {Promise<{user: object}>} the account, without credentials
   * @throws {ApiError} `unauthorized` (no session) · `validation_failed`
   *   (wrong current password, or a replacement that fails the length rule)
   */
  async changePassword({ currentPassword, newPassword } = {}) {
    const session = readStoredSession()
    if (!session) {
      throw createApiError(API_ERROR_CODE.UNAUTHORIZED, undefined, undefined, 401)
    }

    if (String(newPassword ?? '').length < PASSWORD_MIN_LENGTH) {
      throw createApiError(
        API_ERROR_CODE.VALIDATION_FAILED,
        'That password is too short.',
        { newPassword: [`Use at least ${PASSWORD_MIN_LENGTH} characters.`] },
        422
      )
    }

    const record = await findCredentialRecord(session.user.email)
    if (!record || record.password !== currentPassword) {
      throw createApiError(
        API_ERROR_CODE.VALIDATION_FAILED,
        'That is not your current password.',
        { currentPassword: ['Enter your current password.'] },
        422
      )
    }

    const user = await userService.update(record.id, { password: newPassword })

    // Keep the persisted copy in step — `userService` strips the credential, so
    // nothing about the new password is written to storage.
    storeSession({ token: session.token, user })
    return { user }
  },

  /**
   * `POST /auth/logout` (contract §2.1).
   *
   * MOCK-AUTH: there is no token to revoke, so this only clears storage and
   * resolves — no request is made. Laravel deletes the current access token.
   *
   * @returns {Promise<void>}
   */
  async logout() {
    clearStoredSession()
  },
})

export default authService
