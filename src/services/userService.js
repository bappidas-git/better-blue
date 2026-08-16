// Accounts — `docs/api-contract.md` §6.2.
//
// Members reach each other through `creatorProfiles` / `buyerProfiles`; this
// service backs the admin directory, self-service profile edits, and the
// account lookups other services need.
//
// Prompt 29 added the admin half: the directory query, the per-account bundle
// the detail screen reads, and the four governed account actions. **Every rule
// about who may act on whom lives here** (§7) — a component asks
// `canAdminManageAccount` to decide what to render, and the same rule is
// re-checked inside the mutation, so a screen that gets it wrong still cannot
// write. Neither is access control: the Laravel API must enforce all of it
// independently (00 §11, §14).

import dayjs from 'dayjs'

import { NOTIFICATION_TYPE } from '@/constants/notificationTypes'
import { ROLES } from '@/constants/roles'
import { ACCOUNT_STATUS, STATUS_META } from '@/constants/statuses'
import { ID_PREFIX } from '@/utils/id'

import { API_ERROR_CODE, createApiError } from './api/apiError'
import { createCrudService } from './api/crudFactory'
import { auditService } from './auditService'
import { buyerProfileService } from './buyerProfileService'
import { creatorProfileService } from './creatorProfileService'
import { ACTIVE_DISPUTE_STATUSES, disputeService } from './disputeService'
import { notificationService } from './notificationService'
import { orderService } from './orderService'
import { paymentService } from './paymentService'
import { portfolioService } from './portfolioService'
import { reportService } from './reportService'
import { requestService } from './requestService'

const users = createCrudService('users', { idPrefix: ID_PREFIX.USER })

/**
 * MOCK-AUTH: JSON Server serialises `users.password` on every response
 * (contract §6.2, §9.4). Nothing above the services layer may ever see it, so
 * it is dropped here on the way out. `authService` (Prompt 09) reads the
 * credential record through `apiClient` directly for the mock sign-in check —
 * it is the one module that needs the field, and the only one.
 *
 * Laravel never serialises the column at all and this function disappears.
 */
function withoutCredentials(user) {
  if (!user || typeof user !== 'object') return user
  const safe = { ...user }
  delete safe.password
  return safe
}

/* -------------------------------------------------------------------------- */
/* Admin account management — the rules                                       */
/* -------------------------------------------------------------------------- */

/**
 * Whose accounts this screen may act on. Admin and super-admin accounts are
 * deliberately **not** here: the team is managed on its own screen with its own
 * permission (`admins.manage`, Prompt 36), and a users directory that could
 * suspend a colleague would be a second, weaker door into the same room.
 *
 * The directory still *lists* team members — an admin needs to know who is on
 * the team — but their rows are read-only.
 */
export const ADMIN_MANAGEABLE_ROLES = Object.freeze([ROLES.BUYER, ROLES.CREATOR])

/**
 * The statuses an admin may set, out of the four in `ACCOUNT_STATUS` (00 §9).
 *
 * `deactivated` is missing on purpose: it means "this member closed their own
 * account" and is written only by the danger zone in Settings, with
 * `meta.selfService = true` on its audit line (contract §6.26). An admin
 * putting somebody into that state would be recording something that did not
 * happen.
 */
export const ADMIN_SETTABLE_STATUSES = Object.freeze([
  ACCOUNT_STATUS.ACTIVE,
  ACCOUNT_STATUS.SUSPENDED,
  ACCOUNT_STATUS.BLACKLISTED,
])

/** Statuses that stop an account working, and therefore demand a reason. */
const RESTRICTING_STATUSES = Object.freeze([
  ACCOUNT_STATUS.SUSPENDED,
  ACCOUNT_STATUS.BLACKLISTED,
])

/** Shortest reason we will record. Long enough to be a sentence, not a shrug. */
export const STATUS_REASON_MIN_LENGTH = 10

/** Longest reason — it is quoted to the member verbatim in their notification. */
export const STATUS_REASON_MAX_LENGTH = 500

/**
 * Audit verbs for account actions, from the contract's vocabulary (§6.26).
 * `user.verify` is the seeded spelling for the creator badge — extend the
 * vocabulary, never rename it.
 */
export const USER_AUDIT_ACTION = Object.freeze({
  SUSPEND: 'user.suspend',
  BLACKLIST: 'user.blacklist',
  REACTIVATE: 'user.reactivate',
  VERIFY: 'user.verify',
})

/** Which verb each destination status is recorded under. */
const AUDIT_ACTION_BY_STATUS = Object.freeze({
  [ACCOUNT_STATUS.SUSPENDED]: USER_AUDIT_ACTION.SUSPEND,
  [ACCOUNT_STATUS.BLACKLISTED]: USER_AUDIT_ACTION.BLACKLIST,
  [ACCOUNT_STATUS.ACTIVE]: USER_AUDIT_ACTION.REACTIVATE,
})

/**
 * What the member is told, per destination status.
 *
 * Written to be read by somebody who has just lost access and does not yet know
 * why: what happened, what it means, and what they can do next. `account_status_changed`
 * ignores notification preferences for exactly this reason
 * (`MANDATORY_NOTIFICATION_TYPES`) — telling them is the fair thing regardless.
 */
const STATUS_NOTIFICATION = Object.freeze({
  [ACCOUNT_STATUS.SUSPENDED]: Object.freeze({
    title: 'Your account has been suspended',
    body:
      'Your BetterBlue account is temporarily restricted while our Trust & Safety team completes a review. You cannot sign in or trade, and your public content is hidden, until it is lifted.',
  }),
  [ACCOUNT_STATUS.BLACKLISTED]: Object.freeze({
    title: 'Your account has been closed',
    body:
      'Following a Trust & Safety review, your BetterBlue account has been closed and can no longer be used. Your records are retained. If you believe this is a mistake, reply to this notice through support.',
  }),
  [ACCOUNT_STATUS.ACTIVE]: Object.freeze({
    title: 'Your account has been reinstated',
    body:
      'Your BetterBlue account is active again. You can sign in, and your public profile and content are visible once more. Thank you for your patience while we reviewed it.',
  }),
})

const forbidden = (message) =>
  createApiError(API_ERROR_CODE.FORBIDDEN, message, undefined, 403)

/**
 * **May `actor` act on `target`?** One rule, read by the UI to decide what to
 * render and by the mutation to decide whether to write (§7).
 *
 * Returns a reason rather than a bare `false` so a disabled control can say
 * why — an admin who cannot see the difference between "not allowed" and
 * "broken" files a bug about the second one.
 *
 * @param {object|null} target the account being acted on
 * @param {object|null} actor the signed-in admin
 * @returns {{allowed: boolean, reason: string|null}}
 */
export function canAdminManageAccount(target, actor) {
  if (!target) return { allowed: false, reason: 'This account could not be loaded.' }

  if (actor?.id && actor.id === target.id) {
    return {
      allowed: false,
      reason: 'You cannot change the status of your own account.',
    }
  }

  if (!ADMIN_MANAGEABLE_ROLES.includes(target.role)) {
    return {
      allowed: false,
      reason:
        'Team accounts are managed on the Admin team screen, not here. Ask a super admin.',
    }
  }

  return { allowed: true, reason: null }
}

/** The same rule, as a throw — the half the mutation runs. */
function assertAdminCanManage(target, actor) {
  const { allowed, reason } = canAdminManageAccount(target, actor)
  if (!allowed) throw forbidden(reason)
}

/** Trimmed reason, or `undefined` — never an empty string on the record. */
function normalizeReason(reason) {
  const text = String(reason ?? '').trim()
  return text.length > 0 ? text.slice(0, STATUS_REASON_MAX_LENGTH) : undefined
}

/**
 * Turns a date-only filter (`2026-08-01`) into the instant that bounds it.
 * `createdAt` is a full ISO timestamp, so `createdAt_lte=2026-08-01` compares
 * as a string and silently drops everything that happened *on* the 1st.
 */
function dayBoundary(value, edge) {
  if (!value) return undefined
  const day = dayjs(value)
  if (!day.isValid()) return undefined
  return (edge === 'end' ? day.endOf('day') : day.startOf('day')).toISOString()
}

/* -------------------------------------------------------------------------- */
/* Admin account management — aggregates                                      */
/* -------------------------------------------------------------------------- */

/** A count query: one row fetched, read for its `total` (never for its item). */
const COUNT_PARAMS = Object.freeze({ page: 1, limit: 1 })

/**
 * Ceiling on the id lists gathered to answer "who reported this member" — the
 * provider's page ceiling (contract §4.1). Comfortably above any seeded
 * account; Laravel answers the whole question with one join.
 */
const SUBJECT_LIMIT = 100

/** Runs one aggregate and reports `null` rather than failing the whole bundle. */
const quietly = (load) => load().catch(() => null)

/**
 * How many orders this member is on — as the buyer or as the creator, depending
 * which they are.
 *
 * **Laravel:** `SELECT COUNT(*) FROM orders WHERE buyer_id = ?` (or `creator_id`).
 */
async function countOrdersFor(user) {
  const key = user.role === ROLES.CREATOR ? 'creatorId' : 'buyerId'
  const { total } = await orderService.list({ ...COUNT_PARAMS, filters: { [key]: user.id } })
  return total
}

/**
 * Open disputes this member is party to, on either side.
 *
 * MOCK-QUERY: `raisedById` and `againstId` are separate fields with no `OR`
 * between them in JSON Server, so `disputeService.listByUser` merges two reads
 * client-side and its `total` is the merged, de-duplicated count — which is
 * exactly the number wanted here.
 */
async function countOpenDisputesFor(user) {
  const { total } = await disputeService.listByUser(user.id, {
    page: 1,
    limit: SUBJECT_LIMIT,
    filters: { status: [...ACTIVE_DISPUTE_STATUSES] },
  })
  return total
}

/**
 * Reports filed **against** this member.
 *
 * `reports.subjectId` points at the thing reported, not at its owner
 * (contract §6.21): a creator is reached through their storefront and their
 * portfolio items, a buyer through their briefs. So the subject ids are
 * gathered first, then matched in one repeated-`subjectId` read.
 *
 * MOCK-JOIN: two round trips and a bounded id list. **Laravel:**
 * `reports JOIN portfolio_items … WHERE owner_id = ?` in one query.
 */
async function countReportsAgainst(user, profile) {
  const subjectIds = []

  if (user.role === ROLES.CREATOR) {
    if (profile?.id) subjectIds.push(profile.id)
    if (profile?.id) {
      const { items } = await portfolioService
        .list({ page: 1, limit: SUBJECT_LIMIT, filters: { creatorId: profile.id } })
        .catch(() => ({ items: [] }))
      items.forEach((item) => subjectIds.push(item.id))
    }
  } else {
    const { items } = await requestService
      .list({ page: 1, limit: SUBJECT_LIMIT, filters: { buyerId: user.id } })
      .catch(() => ({ items: [] }))
    items.forEach((request) => subjectIds.push(request.id))
  }

  if (subjectIds.length === 0) return { count: 0, items: [] }

  const { items, total } = await reportService.list({
    page: 1,
    limit: SUBJECT_LIMIT,
    filters: { subjectId: subjectIds },
  })
  return { count: total, items }
}

/**
 * MOCK-JOIN: attaches each row's marketplace profile to a page of accounts.
 *
 * The directory's key-stat column is `buyerProfiles.totalSpent` for a buyer and
 * `creatorProfiles.completedOrders` for a creator, and the public-profile link
 * on a creator row needs their `cpr_…` — none of which live on `users`, and
 * JSON Server cannot join (contract §6.3, §6.4). So one batched read per role
 * present on the page, keyed back onto the rows by `userId`.
 *
 * Fails **open**: a directory without its key-stat column is still a directory,
 * and an admin who cannot see the account list cannot do their job at all.
 *
 * **Laravel:** `GET /users?include=profile` — one query with two left joins.
 */
async function withProfiles(result) {
  const byRole = { [ROLES.BUYER]: [], [ROLES.CREATOR]: [] }
  result.items.forEach((user) => {
    if (byRole[user.role]) byRole[user.role].push(user.id)
  })

  const [buyers, creators] = await Promise.all([
    byRole[ROLES.BUYER].length > 0
      ? buyerProfileService
          .list({ page: 1, limit: SUBJECT_LIMIT, filters: { userId: byRole[ROLES.BUYER] } })
          .then((page) => page.items)
          .catch(() => [])
      : [],
    byRole[ROLES.CREATOR].length > 0
      ? creatorProfileService
          .list({ page: 1, limit: SUBJECT_LIMIT, filters: { userId: byRole[ROLES.CREATOR] } })
          .then((page) => page.items)
          .catch(() => [])
      : [],
  ])

  const byUserId = new Map(
    [...buyers, ...creators].map((profile) => [profile.userId, profile])
  )

  return {
    ...result,
    items: result.items.map((user) => ({ ...user, profile: byUserId.get(user.id) ?? null })),
  }
}

/** Lifetime money: what a buyer has committed, or what a creator has earned. */
async function loadMoneyFor(user, profile) {
  if (user.role === ROLES.CREATOR) {
    const summary = await paymentService.getEarningsSummary(user.id)
    return { totalEarned: summary.lifetime, totalSpent: null, currency: summary.currency }
  }
  return { totalEarned: null, totalSpent: profile?.totalSpent ?? 0, currency: undefined }
}

export const userService = Object.freeze({
  /**
   * The user directory (admin).
   *
   * @param {import('./api/listAdapter').ListParams} [params] filters:
   *   `role`, `accountStatus`, `email`, `referredByCode`,
   *   `createdAt_gte`/`createdAt_lte`; sorts: `createdAt`, `lastLoginAt`, `name`
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  async list(params = {}) {
    const result = await users.list(params)
    return { ...result, items: result.items.map(withoutCredentials) }
  },

  /**
   * One account.
   *
   * @param {string} id `usr_…`
   * @returns {Promise<object>} the account, without credentials
   * @throws {ApiError} `not_found`
   */
  async getById(id) {
    return withoutCredentials(await users.getById(id))
  },

  /**
   * Sign-in identifier lookup — email is unique across the platform.
   *
   * @param {string} email exact address
   * @returns {Promise<object|null>} the account, or `null` when unregistered
   */
  async findByEmail(email) {
    if (!email) return null
    const { items } = await users.list({ page: 1, limit: 1, filters: { email } })
    return items.length > 0 ? withoutCredentials(items[0]) : null
  },

  /**
   * Fetches several accounts in one round trip — repeated `id` params are OR'd
   * (contract §4.1). Used wherever a list needs its records' owners.
   *
   * @param {string[]} ids up to 100 account ids
   * @returns {Promise<object[]>} the accounts that exist, in server order
   */
  async listByIds(ids = []) {
    const unique = [...new Set(ids.filter(Boolean))]
    if (unique.length === 0) return []
    const { items } = await users.list({ page: 1, limit: 100, filters: { id: unique } })
    return items.map(withoutCredentials)
  },

  /**
   * Self-update (`name`, `phone`, `avatarUrl`, `notificationPrefs`) or an admin
   * status action (`accountStatus`).
   *
   * `notificationPrefs` is a whole-object replacement — send all seven
   * categories (contract §6.2).
   *
   * @param {string} id `usr_…`
   * @param {object} patch changed fields only
   * @returns {Promise<object>} the updated account
   */
  async update(id, patch) {
    return withoutCredentials(await users.update(id, patch))
  },

  /**
   * Creates an admin account (super admin only — `buyer`/`creator` accounts are
   * created by registration in `authService`).
   *
   * @param {object} payload the new account
   * @returns {Promise<object>} the created account
   */
  async create(payload) {
    return withoutCredentials(await users.create(payload))
  },

  /* ------------------------------------------------------------------------ */
  /* Admin console (Prompt 29)                                                */
  /* ------------------------------------------------------------------------ */

  /**
   * The admin users directory (contract §6.2), in the vocabulary the screen
   * uses rather than the adapter's.
   *
   * The joined-date bounds are the reason this is not just `list`: a date-only
   * value has to be widened to the day it means before it can be compared with
   * an ISO timestamp, and getting that wrong silently drops a day of signups.
   *
   * Each row carries its marketplace `profile` (see {@link withProfiles}) so the
   * table's key-stat column and the CSV export read the same numbers.
   *
   * @param {object} [params]
   * @param {number} [params.page=1]
   * @param {number} [params.limit=20]
   * @param {string} [params.sort='createdAt'] `createdAt` | `lastLoginAt` | `name`
   * @param {'asc'|'desc'} [params.order='desc']
   * @param {string} [params.search] matches name and email
   * @param {string|string[]} [params.role] one or several `ROLES` values
   * @param {string|string[]} [params.accountStatus] one or several `ACCOUNT_STATUS` values
   * @param {string} [params.joinedFrom] date-only or ISO — inclusive lower bound
   * @param {string} [params.joinedTo] date-only or ISO — inclusive upper bound
   * @returns {Promise<import('./api/listAdapter').ListResult>}
   */
  async adminListUsers({
    page,
    limit,
    sort = 'createdAt',
    order = 'desc',
    search,
    role,
    accountStatus,
    joinedFrom,
    joinedTo,
  } = {}) {
    const filters = {}
    if (role) filters.role = role
    if (accountStatus) filters.accountStatus = accountStatus

    const from = dayBoundary(joinedFrom, 'start')
    const to = dayBoundary(joinedTo, 'end')
    if (from) filters.createdAt_gte = from
    if (to) filters.createdAt_lte = to

    return withProfiles(await userService.list({ page, limit, sort, order, search, filters }))
  },

  /**
   * Everything the account detail screen shows, in one call: the account, the
   * profile behind it, and the five figures that say how much of the
   * marketplace this member has touched.
   *
   * MOCK-AGGREGATE: six reads fanned out client-side. Each aggregate is its own
   * failure boundary and resolves to `null` on failure — a member whose dispute
   * count cannot be read still has a page (§13). `null` is never rendered as
   * zero: "no reports" and "we could not count the reports" are different
   * sentences.
   *
   * **Future endpoint:** `GET /admin/users/:id` returning this exact object,
   * gated on `users.manage`.
   *
   * @param {string} userId `usr_…`
   * @returns {Promise<{user: object, profile: object|null, aggregates: object}>}
   * @throws {ApiError} `not_found` — the account itself is the payload
   */
  async adminGetUserBundle(userId) {
    const user = await userService.getById(userId)

    // Team accounts have no marketplace profile and no marketplace activity;
    // the bundle still resolves so the read-only detail page can render.
    const isMember = ADMIN_MANAGEABLE_ROLES.includes(user.role)

    const profile = isMember
      ? await quietly(() =>
          user.role === ROLES.CREATOR
            ? creatorProfileService.getByUserId(user.id)
            : buyerProfileService.getByUserId(user.id)
        )
      : null

    if (!isMember) {
      return {
        user,
        profile: null,
        aggregates: {
          ordersCount: 0,
          totalSpent: null,
          totalEarned: null,
          currency: undefined,
          openDisputes: 0,
          reportsAgainst: 0,
          reports: [],
          lastLoginAt: user.lastLoginAt ?? null,
        },
      }
    }

    const [orders, money, disputes, reports] = await Promise.all([
      quietly(() => countOrdersFor(user)),
      quietly(() => loadMoneyFor(user, profile)),
      quietly(() => countOpenDisputesFor(user)),
      quietly(() => countReportsAgainst(user, profile)),
    ])

    return {
      user,
      profile,
      aggregates: {
        ordersCount: orders,
        totalSpent: money?.totalSpent ?? null,
        totalEarned: money?.totalEarned ?? null,
        currency: money?.currency,
        openDisputes: disputes,
        reportsAgainst: reports?.count ?? null,
        reports: reports?.items ?? [],
        lastLoginAt: user.lastLoginAt ?? null,
      },
    }
  },

  /**
   * **Suspend, blacklist, or reinstate an account** (contract §6.2, §7).
   *
   * One function for all three because they are one decision with three
   * destinations, and splitting them would mean three copies of the same
   * guards. The verb is derived from the destination status, so the audit trail
   * still reads `user.suspend` / `user.blacklist` / `user.reactivate`.
   *
   * Accounts are **never deleted** (00 §9). Enforcement of the new status is
   * somebody else's job by design, and all three places already do it:
   *
   * - sign-in and session revalidation — `authService.assertAccountActive` (09)
   * - the discovery grid — `creatorProfileService.search` drops profiles whose
   *   owner is not `active` (12)
   * - the public storefront — `getPublicProfile` returns `profileStatus`, and
   *   the profile page renders the unavailable screen for anything but `active` (13)
   *
   * All three read `users.accountStatus` directly, so there is **no mirror
   * field to keep in step** and, in particular, the creator's own `availability`
   * switch is left alone: it is their setting, and flipping it here would
   * silently rewrite a preference we could not restore on reinstatement.
   *
   * MOCK-SEQUENCE: the PATCH, the audit line, and the notification are three
   * requests here; Laravel does all three in one transaction (and revokes the
   * member's tokens in it, which this cannot). The status change is the part
   * that must not be undone by a later failure, so it goes first and the two
   * side effects are best-effort after it.
   *
   * @param {string} userId `usr_…` — a buyer or creator, never a team member
   * @param {object} payload
   * @param {string} payload.status an `ADMIN_SETTABLE_STATUSES` value
   * @param {string} [payload.reason] required for `suspended`/`blacklisted`,
   *   optional note on `active`; quoted to the member verbatim
   * @param {object} payload.actor the signed-in admin (`id`, `role`)
   * @returns {Promise<object>} the updated account
   * @throws {ApiError} `validation_failed` (unknown status, missing or too-short
   *   reason) · `forbidden` (self, or a team member) · `conflict` (already in
   *   that status) · `not_found`
   */
  async adminSetAccountStatus(userId, { status, reason, actor } = {}) {
    if (!ADMIN_SETTABLE_STATUSES.includes(status)) {
      throw createApiError(
        API_ERROR_CODE.VALIDATION_FAILED,
        'That is not a status an admin can set.',
        {
          status: [
            `Choose one of: ${ADMIN_SETTABLE_STATUSES.join(', ')}. A member deactivates their own account from Settings.`,
          ],
        },
        422
      )
    }

    const target = await userService.getById(userId)
    assertAdminCanManage(target, actor)

    if (target.accountStatus === status) {
      throw createApiError(
        API_ERROR_CODE.CONFLICT,
        `This account is already ${STATUS_META[status]?.label?.toLowerCase() ?? status}.`,
        undefined,
        409
      )
    }

    const note = normalizeReason(reason)
    const needsReason = RESTRICTING_STATUSES.includes(status)
    if (needsReason && (!note || note.length < STATUS_REASON_MIN_LENGTH)) {
      throw createApiError(
        API_ERROR_CODE.VALIDATION_FAILED,
        'Record why this account is being restricted.',
        {
          reason: [
            `Write at least ${STATUS_REASON_MIN_LENGTH} characters — the member reads this, and so does the next admin who opens the account.`,
          ],
        },
        422
      )
    }

    const changedAt = new Date().toISOString()
    const updated = await userService.update(userId, {
      accountStatus: status,
      // Cleared rather than left behind on reinstatement when no note is given:
      // a stale suspension reason on an active account is worse than none.
      statusReason: note ?? null,
      statusChangedAt: changedAt,
      statusChangedById: actor?.id ?? null,
    })

    if (actor?.id) {
      try {
        await auditService.log({
          actorId: actor.id,
          actorRole: actor.role ?? ROLES.ADMIN,
          action: AUDIT_ACTION_BY_STATUS[status],
          entityType: 'user',
          entityId: userId,
          meta: {
            fromStatus: target.accountStatus,
            toStatus: status,
            ...(note ? { reason: note } : {}),
          },
        })
      } catch {
        // An unwritten audit line must not undo a status change that happened.
      }
    }

    const copy = STATUS_NOTIFICATION[status]
    // "Reason given" is the right word for a restriction and the wrong one for a
    // reinstatement — nobody needs a reason for good news, they need the note.
    const prefix = needsReason ? 'Reason given' : 'Note from our team'
    try {
      await notificationService.notify({
        userId,
        type: NOTIFICATION_TYPE.ACCOUNT_STATUS_CHANGED,
        title: copy.title,
        body: note ? `${copy.body} ${prefix}: ${note}` : copy.body,
        entityType: 'user',
        entityId: userId,
      })
    } catch {
      // Best effort, like every other emit (00 §10).
    }

    return updated
  },

  /**
   * **Toggles a creator's verified badge.**
   *
   * The badge is a Trust & Safety statement — "we have checked who this is" —
   * so it is granted here rather than claimed on the creator's own profile
   * screen, and it propagates straight to the discovery cards and the public
   * storefront, which both read `creatorProfiles.verified`.
   *
   * Recorded as `user.verify` against the **account**, not the profile, so the
   * account's audit trail shows it beside its status history (contract §6.26).
   *
   * @param {string} profileId `cpr_…`
   * @param {object} payload
   * @param {boolean} payload.verified the new badge state
   * @param {object} payload.actor the signed-in admin (`id`, `role`)
   * @returns {Promise<object>} the updated storefront
   * @throws {ApiError} `not_found`
   */
  async adminSetCreatorVerified(profileId, { verified, actor } = {}) {
    const next = Boolean(verified)
    const updated = await creatorProfileService.update(profileId, { verified: next })

    if (actor?.id) {
      try {
        await auditService.log({
          actorId: actor.id,
          actorRole: actor.role ?? ROLES.ADMIN,
          action: USER_AUDIT_ACTION.VERIFY,
          entityType: 'user',
          entityId: updated.userId,
          meta: { verified: next, profileId },
        })
      } catch {
        // As above — the badge changed either way.
      }
    }

    return updated
  },
})

export default userService
