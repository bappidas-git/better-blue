// Filter data for the notification centre — the plain values behind the chip
// row on the page and the preference rows in settings.
//
// Separate from `CategoryFilterChips.jsx` so a module that only wants the list
// of categories a role can receive does not have to import a component to get
// it (and so both files stay fast-refresh friendly).

import {
  NOTIFICATION_CATEGORY,
  NOTIFICATION_CATEGORY_ORDER,
} from '@/constants/notificationTypes'
import { ROLES } from '@/constants/roles'

/** `null` is the "All" chip — no category filter at all. */
export const ALL_CATEGORIES = null

/**
 * Short chip labels. Deliberately terser than the settings-screen labels in
 * `NOTIFICATION_CATEGORY_META`: a scrolling chip row needs one word, a
 * preference row needs a sentence.
 */
export const CATEGORY_CHIP_LABEL = Object.freeze({
  [NOTIFICATION_CATEGORY.MARKETPLACE]: 'Marketplace',
  [NOTIFICATION_CATEGORY.ORDERS]: 'Orders',
  [NOTIFICATION_CATEGORY.PAYMENTS]: 'Payments',
  [NOTIFICATION_CATEGORY.DISPUTES]: 'Disputes',
  [NOTIFICATION_CATEGORY.MODERATION]: 'Content reviews',
  [NOTIFICATION_CATEGORY.AFFILIATE]: 'Affiliate',
  [NOTIFICATION_CATEGORY.SYSTEM]: 'System',
})

/**
 * Categories a role can ever receive, in reading order.
 *
 * Only moderation is restricted: a content review decision goes to whoever
 * submitted the content and to the Trust & Safety team, so a buyer filtering by
 * it — or being offered a switch for it — would only ever see an empty list.
 *
 * @param {string} role a `ROLES` value
 * @returns {string[]} `NOTIFICATION_CATEGORY` values
 */
export function categoriesForRole(role) {
  const isBuyer = role === ROLES.BUYER
  return NOTIFICATION_CATEGORY_ORDER.filter(
    (category) => !(isBuyer && category === NOTIFICATION_CATEGORY.MODERATION)
  )
}
