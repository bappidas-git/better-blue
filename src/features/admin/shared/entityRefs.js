// The admin console's entity vocabulary: what each kind of record is called,
// what it looks like, and where it lives.
//
// Split out of `EntityRefChip.jsx` so the chip stays a component module (the
// `react-refresh` rule the project lints with, same reason `motionPresets.js`
// sits beside the motion components) — and because the route map is the part
// Prompts 29–36 actually edit.
//
// `type` values are the `auditLogs.entityType` vocabulary (contract §6.26) plus
// the collections the console browses, so an audit row can be rendered by
// passing its own fields straight through.

/**
 * Icon and human label per entity type. An unknown type still resolves — to a
 * neutral icon and its own raw value — because an audit trail written by a
 * future prompt must never be able to blank a row.
 */
const ENTITY_META = Object.freeze({
  user: { icon: 'solar:user-linear', label: 'Member' },
  creator_profile: { icon: 'solar:user-id-linear', label: 'Creator' },
  buyer_profile: { icon: 'solar:buildings-3-linear', label: 'Buyer' },
  request: { icon: 'solar:clipboard-list-linear', label: 'Request' },
  proposal: { icon: 'solar:document-add-linear', label: 'Proposal' },
  order: { icon: 'solar:box-linear', label: 'Order' },
  delivery: { icon: 'solar:gallery-send-linear', label: 'Delivery' },
  payment: { icon: 'solar:card-linear', label: 'Payment' },
  payout: { icon: 'solar:wallet-money-linear', label: 'Settlement' },
  dispute: { icon: 'solar:shield-warning-linear', label: 'Dispute' },
  portfolio_item: { icon: 'solar:gallery-linear', label: 'Portfolio item' },
  moderation_review: { icon: 'tabler:shield-check', label: 'Review case' },
  report: { icon: 'solar:flag-linear', label: 'Report' },
  support_ticket: { icon: 'solar:chat-round-line-linear', label: 'Ticket' },
  category: { icon: 'solar:widget-4-linear', label: 'Category' },
  affiliate_profile: { icon: 'solar:users-group-rounded-linear', label: 'Affiliate' },
  affiliate_earning: { icon: 'solar:hand-money-linear', label: 'Affiliate earning' },
  platform_settings: { icon: 'solar:settings-linear', label: 'Platform settings' },
})

const FALLBACK_META = Object.freeze({ icon: 'solar:widget-2-linear', label: 'Record' })

/**
 * Icon and label for `type`, never `undefined`.
 *
 * @param {string} [type] an entity type
 * @returns {{icon: string, label: string}}
 */
export function getEntityMeta(type) {
  return ENTITY_META[type] ?? { ...FALLBACK_META, label: type ? String(type) : FALLBACK_META.label }
}

/**
 * Where a reference of each type leads, inside the admin console.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║ COMMENT-GATED, like `routes/navConfig.jsx`. A chip that links to a route  ║
 * ║ nobody has built lands on the dashboard 404, which is worse than a chip   ║
 * ║ that does not link at all — so each line stays commented until the prompt ║
 * ║ that builds its screen uncomments it. Uncommenting also needs             ║
 * ║ `import { paths } from '@/routes/paths'` at the top of this file (no line ║
 * ║ needs it today, and an unused import fails `npm run lint`).               ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * @param {string} type entity type
 * @param {string} id the record's id
 * @returns {string|undefined} a route path, or `undefined` while unbuilt
 */
// eslint-disable-next-line no-unused-vars -- `id` is read by every commented branch below.
export function resolveEntityPath(type, id) {
  if (!type || !id) return undefined

  switch (type) {
    // case 'user':              return paths.adminUserDetail(id)          // Prompt 29
    // case 'creator_profile':   return paths.adminUserDetail(id)          // Prompt 29
    // case 'buyer_profile':     return paths.adminUserDetail(id)          // Prompt 29
    // case 'portfolio_item':                                              // Prompt 30
    // case 'moderation_review': return paths.adminModerationDetail(id)    // Prompt 30
    // case 'report':            return paths.ADMIN_REPORTS                // Prompt 30
    // case 'request':           return paths.ADMIN_REQUESTS               // Prompt 31
    // case 'order':             return paths.adminOrderDetail(id)         // Prompt 31
    // case 'support_ticket':    return paths.ADMIN_SUPPORT                // Prompt 31
    // case 'payment':           return paths.ADMIN_PAYMENTS               // Prompt 32
    // case 'payout':            return paths.ADMIN_SETTLEMENTS            // Prompt 32
    // case 'dispute':           return paths.adminDisputeDetail(id)       // Prompt 33
    // case 'affiliate_profile':                                           // Prompt 34
    // case 'affiliate_earning': return paths.ADMIN_AFFILIATES             // Prompt 34
    // case 'category':          return paths.ADMIN_CATEGORIES             // Prompt 35
    // case 'platform_settings': return paths.ADMIN_SETTINGS               // Prompt 35
    default:
      return undefined
  }
}
