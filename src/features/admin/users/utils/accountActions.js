// What an admin can do to an account, and how each choice reads — Prompt 29
// §4.4.
//
// One descriptor per action, shared by the directory's row kebab and the detail
// page's button row, so the two can never offer a different set. The `when`
// predicate is the *state* rule (you cannot suspend an already-suspended
// account); `canAdminManageAccount` is the *target* rule (you cannot act on
// yourself, or on a colleague). Both are advisory: `userService` re-checks them
// before it writes (00 §11).
//
// It lives outside the components for the reason `motionPresets.js` does — a
// `.jsx` file that exports something other than components loses fast refresh,
// which the project lints for.

import { ACCOUNT_STATUS } from '@/constants/statuses'
import { canAdminManageAccount } from '@/services/userService'

/**
 * The three status actions, in menu order.
 *
 * @type {ReadonlyArray<{key: string, label: string, shortLabel: string,
 *   icon: string, color: string, danger: boolean, when: (user: object) => boolean}>}
 */
export const ACCOUNT_ACTIONS = Object.freeze([
  Object.freeze({
    key: ACCOUNT_STATUS.SUSPENDED,
    label: 'Suspend account',
    shortLabel: 'Suspend',
    icon: 'solar:pause-circle-linear',
    color: 'warning',
    danger: false,
    /** Suspension is for accounts that currently work. */
    when: (user) => user.accountStatus === ACCOUNT_STATUS.ACTIVE,
  }),
  Object.freeze({
    key: ACCOUNT_STATUS.BLACKLISTED,
    label: 'Blacklist account',
    shortLabel: 'Blacklist',
    icon: 'solar:forbidden-circle-linear',
    color: 'error',
    danger: true,
    when: (user) => user.accountStatus !== ACCOUNT_STATUS.BLACKLISTED,
  }),
  Object.freeze({
    key: ACCOUNT_STATUS.ACTIVE,
    label: 'Reactivate account',
    shortLabel: 'Reactivate',
    icon: 'solar:play-circle-linear',
    color: 'primary',
    danger: false,
    when: (user) => user.accountStatus !== ACCOUNT_STATUS.ACTIVE,
  }),
])

/**
 * The actions available on one account, given who is asking.
 *
 * @param {object|null} user the account
 * @param {object|null} actor the signed-in admin — pass `null` to render a view
 *   read-only regardless of the account
 * @returns {Array<object>} descriptors from {@link ACCOUNT_ACTIONS}
 */
export function actionsFor(user, actor) {
  if (!user || !canAdminManageAccount(user, actor).allowed) return []
  return ACCOUNT_ACTIONS.filter((action) => action.when(user))
}

/**
 * The `useConfirm` options for the verified-badge toggle — a light confirm, not
 * a form, because nothing about the account's access changes.
 *
 * @param {object} user the creator
 * @param {boolean} next the badge state being moved to
 * @returns {object} options for `useConfirm()`
 */
export function verifyConfirmOptions(user, next) {
  return next
    ? {
        title: 'Verify this creator?',
        message: `A verified badge appears on ${user?.name ?? 'this creator'}’s storefront and on their discovery card, telling buyers our team has checked who they are. Only grant it once you have.`,
        confirmLabel: 'Verify creator',
        tone: 'primary',
        icon: 'solar:verified-check-linear',
      }
    : {
        title: 'Remove the verified badge?',
        message: `The badge disappears from ${user?.name ?? 'this creator'}’s storefront and discovery card straight away. Their account is otherwise unaffected — this is not a suspension.`,
        confirmLabel: 'Remove badge',
        tone: 'danger',
        icon: 'solar:verified-check-linear',
      }
}
