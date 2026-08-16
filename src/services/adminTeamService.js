// The admin team — `docs/api-contract.md` §6.2 (admin composites), §6.26.
//
// Prompt 29 built the account directory and deliberately left team members
// read-only there: managing colleagues is a different job with a different
// permission, and a users screen that could suspend an admin would be a second,
// weaker door into the same room. This service is that room.
//
// **Every rule about who may act on whom lives here** (§7), in
// {@link canManageAdmin}: a screen asks it to decide what to render, and the
// same rule is re-checked inside each mutation, so a screen that gets it wrong
// still cannot write. Three protections, and none of them is cosmetic:
//
//   1. **Nobody edits or suspends themselves.** The one account guaranteed to
//      be able to undo a mistake is the one making it; locking yourself out of
//      the console is unrecoverable without database access.
//   2. **Super admins are not managed from here.** v1 ships exactly one, seeded
//      (`super@betterblue.test`), and there is no screen that creates, edits, or
//      suspends one — see the note on {@link SUPER_ADMIN_POLICY}.
//   3. **Nothing is ever deleted.** A suspended admin keeps their account, their
//      permission array, and every audit line they wrote — the trail is what
//      makes an offboarding reviewable a year later (00 §9, contract §6.26).
//
// SECURITY: none of this is access control (00 §11, §14). It runs in the
// browser, where a determined visitor can skip it. The Laravel API must enforce
// every rule independently — in particular the permission array itself, which
// is the whole of admin authorisation.

import { AUDIT_ACTION } from '@/constants/auditActions'
import { avatarDataUri } from '@/constants/images'
import { NOTIFICATION_CATEGORY, NOTIFICATION_TYPE } from '@/constants/notificationTypes'
import { PERMISSION_VALUES } from '@/constants/permissions'
import { ROLES } from '@/constants/roles'
import { ACCOUNT_STATUS } from '@/constants/statuses'
import { email as emailRule } from '@/utils/validators'

import { API_ERROR_CODE, createApiError } from './api/apiError'
import { auditService } from './auditService'
import { notificationService } from './notificationService'
import { userService } from './userService'

/** The two roles that reach the console — the rows this service lists. */
export const TEAM_ROLES = Object.freeze([ROLES.ADMIN, ROLES.SUPER_ADMIN])

/**
 * The statuses a super admin may put a team member in.
 *
 * `blacklisted` is missing on purpose: it is a marketplace judgement about a
 * buyer or a creator ("this person may not trade here"), and applying it to a
 * colleague would say something the record does not mean. `deactivated` is
 * missing for the reason it is missing from `ADMIN_SETTABLE_STATUSES` — it means
 * "they closed their own account".
 */
export const ADMIN_SETTABLE_TEAM_STATUSES = Object.freeze([
  ACCOUNT_STATUS.ACTIVE,
  ACCOUNT_STATUS.SUSPENDED,
])

/**
 * **v1 has no super-admin management, by decision.**
 *
 * There is exactly one super admin, created by the seed. Nothing in the console
 * creates a second, changes the one there is, or suspends it — the role is
 * defined as the account that can always get back in, and an interface that can
 * take that away is an interface that can lock everybody out of their own
 * platform. Promoting somebody is therefore a deliberate, out-of-band act
 * (a migration, or a Laravel console command) rather than a button.
 *
 * Documented rather than merely absent, so the next prompt reads a decision
 * instead of a gap.
 */
export const SUPER_ADMIN_POLICY = Object.freeze({
  managedInApp: false,
  reason:
    'BetterBlue ships with a single super admin. Creating, editing, or suspending one is done outside the console so the platform can never be locked out of itself.',
})

/** Shortest reason recorded against a suspension — a sentence, not a shrug. */
export const TEAM_REASON_MIN_LENGTH = 10

/** Longest reason — it is quoted to the team member verbatim. */
export const TEAM_REASON_MAX_LENGTH = 500

/** Every temporary password starts with this, so one is recognisable on sight. */
export const TEMP_PASSWORD_PREFIX = 'BB-Temp-'

/** Characters in the random half — no `O`/`0`, `I`/`1`, or `S`/`5` to misread. */
const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRTUVWXYZ2346789'

/** How many of them. Four is readable aloud and typed once. */
const TEMP_PASSWORD_LENGTH = 4

/** Ceiling on one team read. The team is a team, not a collection. */
const TEAM_LIMIT = 100

const nowIso = () => new Date().toISOString()

/** The shared email rule (Prompt 03), applied server-side as well as in the form. */
const isEmailUsable = (value) => emailRule()(value) === undefined

/** All notification categories on — the default a new account starts with. */
const defaultNotificationPrefs = () =>
  Object.fromEntries(
    Object.values(NOTIFICATION_CATEGORY).map((category) => [category, { inApp: true }])
  )

const forbidden = (message) => createApiError(API_ERROR_CODE.FORBIDDEN, message, undefined, 403)

const invalidInput = (message, details) =>
  createApiError(API_ERROR_CODE.VALIDATION_FAILED, message, details, 422)

/** Runs one aggregate and reports `null` rather than failing the whole list. */
const quietly = (load) => load().catch(() => null)

/**
 * MOCK-AUTH: mints the one-time password a new admin signs in with, in the
 * readable `BB-Temp-XKZ4` shape — it is read off a screen and typed into
 * another one, so it avoids the character pairs people mistype.
 *
 * It is shown **once**, in the dialog that follows creation, and is never
 * retrievable afterwards: nothing stores it outside `users.password`, which no
 * service response carries (`withoutCredentials`).
 *
 * **Laravel:** there is no temporary password at all. `POST /admin/admins`
 * creates the account with no credential and emails a signed invitation link;
 * the invitee sets their own password, and this function disappears with the
 * dialog that displays it.
 */
export function generateTempPassword() {
  let suffix = ''
  for (let index = 0; index < TEMP_PASSWORD_LENGTH; index += 1) {
    suffix += TEMP_PASSWORD_ALPHABET[Math.floor(Math.random() * TEMP_PASSWORD_ALPHABET.length)]
  }
  return `${TEMP_PASSWORD_PREFIX}${suffix}`
}

/**
 * **May `actor` act on `target`?** One rule, read by the UI to decide what to
 * render and by every mutation below to decide whether to write.
 *
 * Returns a reason rather than a bare `false` so a hidden or disabled control
 * can explain itself — "not allowed" and "broken" look identical otherwise.
 *
 * @param {object|null} target the team member being acted on
 * @param {object|null} actor the signed-in super admin
 * @returns {{allowed: boolean, reason: string|null}}
 */
export function canManageAdmin(target, actor) {
  if (!target) return { allowed: false, reason: 'This account could not be loaded.' }

  if (actor?.id && actor.id === target.id) {
    return {
      allowed: false,
      reason:
        'You cannot change your own permissions or suspend yourself. Ask another super admin.',
    }
  }

  if (target.role === ROLES.SUPER_ADMIN) {
    return { allowed: false, reason: `Super admin accounts are not managed here. ${SUPER_ADMIN_POLICY.reason}` }
  }

  if (target.role !== ROLES.ADMIN) {
    return {
      allowed: false,
      reason: 'That is not an admin account. Buyers and creators are managed in the users directory.',
    }
  }

  return { allowed: true, reason: null }
}

/** The same rule, as a throw — the half the mutations run. */
function assertCanManage(target, actor) {
  assertTeamManager(actor)
  const { allowed, reason } = canManageAdmin(target, actor)
  if (!allowed) throw forbidden(reason)
}

/**
 * Who may use this service at all. Super admins only, matching the route gate on
 * the Platform section (`SuperAdminRoute`, Prompt 35) — the check is repeated
 * here because a route that declines to render is not a protected resource.
 */
function assertTeamManager(actor) {
  if (actor?.role !== ROLES.SUPER_ADMIN) {
    throw forbidden('Managing the admin team is limited to super admins.')
  }
}

/** Trimmed reason, or `undefined` — never an empty string on the record. */
function normalizeReason(reason) {
  const text = String(reason ?? '').trim()
  return text.length > 0 ? text.slice(0, TEAM_REASON_MAX_LENGTH) : undefined
}

/**
 * A clean permission array: known keys only, de-duplicated, in the canonical
 * order of `PERMISSION_VALUES` so two identical grants are byte-identical and a
 * diff never reports a reordering as a change.
 */
function normalizePermissions(permissions) {
  const wanted = new Set(Array.isArray(permissions) ? permissions : [])
  return PERMISSION_VALUES.filter((key) => wanted.has(key))
}

/** Validates a grant: at least one permission, and nothing we do not recognise. */
function assertUsablePermissions(permissions) {
  const list = Array.isArray(permissions) ? permissions : []
  const unknown = list.filter((key) => !PERMISSION_VALUES.includes(key))

  if (unknown.length > 0) {
    throw invalidInput('We do not recognise one of those permissions.', {
      permissions: [`Unknown: ${unknown.join(', ')}.`],
    })
  }

  const normalized = normalizePermissions(list)
  if (normalized.length === 0) {
    throw invalidInput('Grant at least one permission.', {
      permissions: [
        'An admin with no permissions can sign in and see nothing — decide what this person does before creating the account.',
      ],
    })
  }

  return normalized
}

/** `{ added, removed }` between two grants, both in canonical order. */
export function diffPermissions(before = [], after = []) {
  const from = new Set(before)
  const to = new Set(after)
  return {
    added: PERMISSION_VALUES.filter((key) => to.has(key) && !from.has(key)),
    removed: PERMISSION_VALUES.filter((key) => from.has(key) && !to.has(key)),
  }
}

/** Best-effort audit — a team change is recorded, never blocked by recording. */
async function auditQuietly(actor, entry) {
  if (!actor?.id) return null
  try {
    return await auditService.log({
      actorId: actor.id,
      actorRole: actor.role ?? ROLES.SUPER_ADMIN,
      entityType: 'user',
      ...entry,
    })
  } catch {
    // The change has already happened; refusing to acknowledge it because the
    // trail write failed would leave the screen lying about what it did.
    return null
  }
}

/**
 * Start of the current calendar month, ISO — the window "actions this month"
 * counts over. A month rather than a rolling 30 days because that is the period
 * a team lead actually reviews against.
 */
function startOfMonthIso() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}

export const adminTeamService = Object.freeze({
  /**
   * **The admin team, with the two figures that say whether an account is still
   * in use**: when they last signed in, and how much they have done this month.
   *
   * MOCK-AGGREGATE: the action count is one counted read per team member (a row
   * fetched purely for its `X-Total-Count`), fanned out client-side. Each count
   * is its own failure boundary and resolves to `null` rather than `0` — "no
   * actions" and "we could not count them" are different sentences (§13).
   *
   * **Future endpoint:** `GET /admin/admins` returning this exact shape with the
   * counts computed in one grouped query, gated on `admins.manage`.
   *
   * @param {object} [params]
   * @param {string} [params.search] matches name and email
   * @returns {Promise<{items: object[], total: number}>} super admins first,
   *   then admins by name; each row carries `actionsThisMonth` and `permissions`
   */
  async listAdmins({ search } = {}) {
    const { items, total } = await userService.list({
      page: 1,
      limit: TEAM_LIMIT,
      sort: 'name',
      order: 'asc',
      search,
      filters: { role: [...TEAM_ROLES] },
    })

    const since = startOfMonthIso()
    const counts = await Promise.all(
      items.map((member) =>
        quietly(async () => {
          const { total: actions } = await auditService.list({
            page: 1,
            limit: 1,
            filters: { actorId: member.id, createdAt_gte: since },
          })
          return actions
        })
      )
    )

    const rows = items.map((member, index) => ({
      ...member,
      permissions: Array.isArray(member.permissions) ? member.permissions : [],
      actionsThisMonth: counts[index],
      lastActiveAt: member.lastLoginAt ?? null,
    }))

    // Super admins lead: the account that owns the platform is the one a reader
    // is looking for when they open this screen.
    rows.sort((a, b) => {
      const byRole = Number(b.role === ROLES.SUPER_ADMIN) - Number(a.role === ROLES.SUPER_ADMIN)
      return byRole !== 0 ? byRole : String(a.name).localeCompare(String(b.name))
    })

    return { items: rows, total }
  },

  /**
   * **Creates an admin account and returns its one-time password** (contract
   * §6.2, §7 operation 32).
   *
   * The password comes back **once**, in the result of this call, and is never
   * readable again: `userService` strips `password` from every response, and no
   * screen re-fetches it. That is the whole reason the success dialog is a
   * dialog rather than a toast.
   *
   * MOCK-SEQUENCE: uniqueness check → `POST /users` → `POST /auditLogs`. Laravel
   * does the first two in one transaction and sends an invitation email instead
   * of a password (see {@link generateTempPassword}).
   *
   * @param {object} payload
   * @param {string} payload.name the person's name
   * @param {string} payload.email their sign-in address, stored lowercased
   * @param {string[]} payload.permissions at least one `PERMISSIONS` key
   * @param {object} payload.actor the signed-in super admin (`id`, `role`)
   * @returns {Promise<{user: object, tempPassword: string}>}
   * @throws {ApiError} `forbidden` (not a super admin) · `validation_failed`
   *   (missing name, unusable email, empty or unknown permissions) · `conflict`
   *   (the address is already registered)
   */
  async createAdmin({ name, email, permissions, actor } = {}) {
    assertTeamManager(actor)

    const cleanName = String(name ?? '').trim()
    if (cleanName.length < 2) {
      throw invalidInput('Give the new admin a name.', {
        name: ['Their name appears on every action they take.'],
      })
    }

    const cleanEmail = String(email ?? '').trim().toLowerCase()
    if (!cleanEmail || !isEmailUsable(cleanEmail)) {
      throw invalidInput('That does not look like an email address.', {
        email: ['They sign in with it, so it has to be one they can read.'],
      })
    }

    const grant = assertUsablePermissions(permissions)

    // Uniqueness is the API's job to enforce for real — a `UNIQUE` index on
    // `users.email` — but checking here turns a 500 into a message under the
    // field the reader can act on.
    const existing = await userService.findByEmail(cleanEmail)
    if (existing) {
      throw createApiError(
        API_ERROR_CODE.CONFLICT,
        'That email address already has a BetterBlue account.',
        { email: ['Use another address, or find the existing account in the users directory.'] },
        409
      )
    }

    const tempPassword = generateTempPassword()

    const created = await userService.create({
      name: cleanName,
      email: cleanEmail,
      role: ROLES.ADMIN,
      accountStatus: ACCOUNT_STATUS.ACTIVE,
      // MOCK-AUTH: stored in plain text, exactly as the seeded accounts are —
      // JSON Server has nothing to hash with (contract §2.4). Laravel hashes the
      // invitation the member sets and never serialises the column back out.
      password: tempPassword,
      permissions: grant,
      avatarUrl: avatarDataUri(cleanName),
      // Never signed in yet — the team table reads this to say so, rather than
      // showing a join date and implying activity that has not happened.
      lastLoginAt: null,
      notificationPrefs: defaultNotificationPrefs(),
    })

    await auditQuietly(actor, {
      action: AUDIT_ACTION.ADMIN_CREATE,
      entityId: created.id,
      meta: {
        name: created.name,
        email: created.email,
        role: created.role,
        permissionCount: grant.length,
        permissions: grant,
      },
    })

    return { user: created, tempPassword }
  },

  /**
   * **Replaces an admin's permission array** (contract §6.2).
   *
   * A whole-array replacement rather than a patch of deltas, because the array
   * *is* the grant: sending "add disputes.resolve" leaves two clients able to
   * disagree about what the other did, and the audit line would record an
   * intention rather than a state. The diff is computed here and stored on the
   * entry, so the trail carries both the change and the result.
   *
   * **When it takes effect.** The target's `user` object is refreshed on their
   * next `GET /auth/me` — app boot or session revalidation — because that is
   * where `AuthContext` gets `permissions` from (Prompt 09). A signed-in admin
   * therefore keeps the nav they loaded with until they reload; nothing they do
   * in the meantime bypasses anything, since the API is the authority on every
   * request. Documented in the dialog's confirmation copy so the reader knows.
   *
   * @param {string} userId `usr_…` — an admin, never a super admin, never you
   * @param {object} payload
   * @param {string[]} payload.permissions the complete new grant
   * @param {object} payload.actor the signed-in super admin
   * @returns {Promise<object>} the updated account
   * @throws {ApiError} `forbidden` (self, super admin, not a super admin) ·
   *   `validation_failed` · `not_found`
   */
  async updateAdminPermissions(userId, { permissions, actor } = {}) {
    const target = await userService.getById(userId)
    assertCanManage(target, actor)

    const next = assertUsablePermissions(permissions)
    const previous = normalizePermissions(target.permissions)
    const { added, removed } = diffPermissions(previous, next)

    // Nothing to write and nothing to record. Reachable only by a race — the
    // dialog's save button is disabled while the grant is unchanged — and
    // returning the account is kinder there than an error about a no-op.
    if (added.length === 0 && removed.length === 0) return target

    const updated = await userService.update(userId, { permissions: next })

    await auditQuietly(actor, {
      action: AUDIT_ACTION.ADMIN_PERMISSIONS_UPDATE,
      entityId: userId,
      meta: {
        name: target.name,
        added,
        removed,
        // Before and after in full: the diff says what moved, these say what the
        // account could do on either side of it, which is the question somebody
        // reading this entry in six months is actually asking.
        from: previous,
        to: next,
      },
    })

    await quietly(() =>
      notificationService.notify({
        userId,
        type: NOTIFICATION_TYPE.ACCOUNT_STATUS_CHANGED,
        title: 'Your admin permissions have changed',
        body: `A super admin updated what you can work on in the console. ${
          added.length > 0 ? `${added.length} added. ` : ''
        }${removed.length > 0 ? `${removed.length} removed. ` : ''}Sign out and back in to see the change.`,
        entityType: 'user',
        entityId: userId,
      })
    )

    return updated
  },

  /**
   * **Suspends or reinstates a team member** (contract §6.2, §2.3).
   *
   * Suspension is how somebody is offboarded: the account stops working
   * immediately at sign-in and on the next session revalidation
   * (`authService.assertAccountActive`, Prompt 09), and **everything they did
   * stays** — their audit lines, their name on every decision, their permission
   * array ready for the day they come back. There is no delete, here or in the
   * contract.
   *
   * MOCK-SEQUENCE: `PATCH /users/:id` → `POST /auditLogs` → notify. Laravel does
   * all three in one transaction and revokes the member's tokens inside it,
   * which is the one thing this cannot do — hence "next boot" rather than
   * "immediately" for a session that is already open.
   *
   * @param {string} userId `usr_…`
   * @param {object} payload
   * @param {string} payload.status `active` or `suspended`
   * @param {string} [payload.reason] required to suspend; quoted to them verbatim
   * @param {object} payload.actor the signed-in super admin
   * @returns {Promise<object>} the updated account
   * @throws {ApiError} `forbidden` · `validation_failed` · `conflict` (already
   *   in that status) · `not_found`
   */
  async setAdminStatus(userId, { status, reason, actor } = {}) {
    if (!ADMIN_SETTABLE_TEAM_STATUSES.includes(status)) {
      throw invalidInput('That is not a status a team account can be put in.', {
        status: [`Choose one of: ${ADMIN_SETTABLE_TEAM_STATUSES.join(', ')}.`],
      })
    }

    const target = await userService.getById(userId)
    assertCanManage(target, actor)

    if (target.accountStatus === status) {
      throw createApiError(
        API_ERROR_CODE.CONFLICT,
        status === ACCOUNT_STATUS.SUSPENDED
          ? 'This account is already suspended.'
          : 'This account is already active.',
        undefined,
        409
      )
    }

    const suspending = status === ACCOUNT_STATUS.SUSPENDED
    const note = normalizeReason(reason)
    if (suspending && (!note || note.length < TEAM_REASON_MIN_LENGTH)) {
      throw invalidInput('Record why this account is being suspended.', {
        reason: [
          `Write at least ${TEAM_REASON_MIN_LENGTH} characters — they read this, and so does the next super admin who opens the account.`,
        ],
      })
    }

    const updated = await userService.update(userId, {
      accountStatus: status,
      // Cleared on reinstatement rather than left behind: a stale suspension
      // reason on an active account is worse than none.
      statusReason: note ?? null,
      statusChangedAt: nowIso(),
      statusChangedById: actor?.id ?? null,
    })

    await auditQuietly(actor, {
      action: suspending ? AUDIT_ACTION.ADMIN_SUSPEND : AUDIT_ACTION.ADMIN_REACTIVATE,
      entityId: userId,
      meta: {
        name: target.name,
        fromStatus: target.accountStatus,
        toStatus: status,
        ...(note ? { reason: note } : {}),
        // What they could do at the moment access was taken away. The array is
        // untouched on the account; recording it here means the trail answers
        // "what did we just switch off?" without a second lookup.
        permissions: normalizePermissions(target.permissions),
      },
    })

    await quietly(() =>
      notificationService.notify({
        userId,
        type: NOTIFICATION_TYPE.ACCOUNT_STATUS_CHANGED,
        title: suspending
          ? 'Your BetterBlue admin access has been suspended'
          : 'Your BetterBlue admin access has been restored',
        body: suspending
          ? `You can no longer sign in to the admin console. Reason given: ${note}`
          : 'You can sign in to the admin console again. Your permissions are unchanged.',
        entityType: 'user',
        entityId: userId,
      })
    )

    return updated
  },
})

export default adminTeamService
