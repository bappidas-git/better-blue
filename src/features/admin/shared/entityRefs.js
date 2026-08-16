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

import { paths } from '@/routes/paths'

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
 * Every type the console knows, as `{ value, label }` — the entity filter on the
 * audit explorer (Prompt 36) is built from this rather than from a second list
 * that would drift out of step with `ENTITY_META`.
 */
export const ENTITY_TYPE_OPTIONS = Object.freeze(
  Object.entries(ENTITY_META).map(([value, meta]) =>
    Object.freeze({ value, label: meta.label })
  )
)

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
 * ║ that builds its screen uncomments it. Prompt 29 added the `paths` import  ║
 * ║ with the first live case, so uncommenting a line is now the whole change. ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * @param {string} type entity type
 * @param {string} id the record's id
 * @returns {string|undefined} a route path, or `undefined` while unbuilt
 */
export function resolveEntityPath(type, id) {
  if (!type || !id) return undefined

  switch (type) {
    case 'user':
      return paths.adminUserDetail(id)
    // `creator_profile` and `buyer_profile` stay commented, and not because the
    // screen is missing: their ids are `cpr_…` / `bpr_…`, and
    // `/admin/users/:userId` takes a `usr_…`. Linking them needs a profile → owner
    // lookup, which a chip cannot do synchronously. Prompt 29 left them off
    // rather than shipping a link to a 404; a caller that already knows the
    // owner should pass `type="user"` with the `usr_…` instead.
    // case 'creator_profile':   return paths.adminUserDetail(ownerIdOf(id))
    // case 'buyer_profile':     return paths.adminUserDetail(ownerIdOf(id))
    case 'moderation_review':
      return paths.adminModerationDetail(id)
    // Prompt 30 mounted the reports **queue**, not a per-report route: a report
    // is read in a side sheet on that screen, so the chip points at the list.
    case 'report':
      return paths.ADMIN_REPORTS
    // `portfolio_item` stays unlinked for the reason `creator_profile` does: the
    // console browses *cases*, not items, and `/admin/moderation/:id` takes a
    // `mod_…`. A caller holding the case should pass `type="moderation_review"`.
    // case 'portfolio_item':
    // Prompt 31. Requests and tickets are read in a side sheet on their queue
    // screen rather than at a route of their own, so both chips point at the
    // list — the same shape `report` takes. Orders do have a detail route.
    case 'request':
      return paths.ADMIN_REQUESTS
    case 'order':
      return paths.adminOrderDetail(id)
    case 'support_ticket':
      return `${paths.ADMIN_SUPPORT}?ticket=${encodeURIComponent(id)}`
    // Prompt 32. Neither record has a route of its own: a payment is read in
    // the escrow monitor or the ledger, and a payout in the settlement queue,
    // so both chips point at the screen that lists them — the same shape
    // `report` and `request` take. The ledger's own tab is where a `pay_…`
    // actually resolves, which is why the payment chip lands on the tab strip
    // rather than deep-linking to a row that may be forty pages down.
    case 'payment':
      return paths.ADMIN_PAYMENTS
    case 'payout':
      return paths.ADMIN_SETTLEMENTS
    // Prompt 33. A case does have a route of its own — the workspace where it
    // is decided — so this chip deep-links rather than landing on the queue.
    case 'dispute':
      return paths.adminDisputeDetail(id)
    // Prompt 36 uncommented the last four, which is the whole of this file's
    // comment gate resolved: every screen they point at now exists. Affiliates
    // and settings have no per-record route — a profile and an earning are read
    // on the affiliate console, and the settings singleton *is* its screen — so
    // all four land on the list that holds them, the shape `report` and
    // `request` already take.
    case 'affiliate_profile':
    case 'affiliate_earning':
      return paths.ADMIN_AFFILIATES
    case 'category':
      return paths.ADMIN_CATEGORIES
    case 'platform_settings':
      return paths.ADMIN_SETTINGS
    default:
      return undefined
  }
}
