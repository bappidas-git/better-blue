// Audit action vocabulary — `docs/api-contract.md` §6.26, 00 §2.5.
//
// Every `auditService.log({ action })` call in the app reads its verb from
// here, and so does every seeded entry (`scripts/seed-data/audit.js`). Before
// Prompt 36 the strings were written inline in eleven services, which is how a
// filter select ends up missing a verb nobody remembered existed — the audit
// explorer builds its namespace filter out of this object, so a verb that is
// not here cannot be filtered for.
//
// Rules, from the contract:
//
//   - `domain.verb`, dot-namespaced, lowercase, `snake_case` inside a segment.
//   - **Extend, never rename.** A renamed verb silently orphans every entry
//     already written under the old spelling, and the trail is append-only —
//     there is no migration to run on it.
//   - The namespace is the part before the first dot and is what the console
//     groups by, so a new verb belongs in an existing namespace wherever one
//     fits.
//
// This module is imported by the plain-Node seed scripts as well as the app, so
// it must stay dependency-free — no `@/` alias, no imports at all.

export const AUDIT_ACTION = Object.freeze({
  /* Admin team (Prompt 36) -------------------------------------------------- */
  ADMIN_CREATE: 'admin.create',
  ADMIN_PERMISSIONS_UPDATE: 'admin.permissions.update',
  ADMIN_SUSPEND: 'admin.suspend',
  ADMIN_REACTIVATE: 'admin.reactivate',

  /* Affiliate programme (Prompt 34) ---------------------------------------- */
  AFFILIATE_EARNING_APPROVE: 'affiliate.earning.approve',
  AFFILIATE_EARNING_VOID: 'affiliate.earning.void',
  AFFILIATE_SUSPEND: 'affiliate.suspend',
  AFFILIATE_REACTIVATE: 'affiliate.reactivate',

  /* Communications (Prompt 31) --------------------------------------------- */
  ANNOUNCEMENT_SEND: 'announcement.send',

  /* Taxonomy (Prompt 35) ---------------------------------------------------- */
  CATEGORY_CREATE: 'category.create',
  CATEGORY_UPDATE: 'category.update',
  CATEGORY_ACTIVATE: 'category.activate',
  CATEGORY_DEACTIVATE: 'category.deactivate',
  CATEGORY_REORDER: 'category.reorder',

  /* Published content (Prompt 30) ------------------------------------------- */
  CONTENT_RESTRICT: 'content.restrict',

  /* Editorial (seeded) ------------------------------------------------------ */
  CREATOR_FEATURE: 'creator.feature',

  /* Disputes (Prompt 33) ---------------------------------------------------- */
  DISPUTE_OPEN: 'dispute.open',
  DISPUTE_ASSIGN: 'dispute.assign',
  DISPUTE_REQUEST_INFO: 'dispute.request_info',
  DISPUTE_ESCALATE: 'dispute.escalate',
  DISPUTE_RESOLVE: 'dispute.resolve',
  DISPUTE_CLOSE: 'dispute.close',

  /* Content review (Prompt 30) ---------------------------------------------- */
  MODERATION_OPEN: 'moderation.open',
  MODERATION_CLAIM: 'moderation.claim',
  MODERATION_APPROVE: 'moderation.approve',
  MODERATION_REQUEST_CHANGES: 'moderation.request_changes',
  MODERATION_REJECT: 'moderation.reject',
  MODERATION_RESTRICT: 'moderation.restrict',

  /* Marketplace operations (Prompt 31) -------------------------------------- */
  ORDER_CANCEL: 'order.cancel',
  ORDER_NOTE: 'order.note',
  REQUEST_CLOSE: 'request.close',

  /* Money (Prompt 32) ------------------------------------------------------- */
  PAYMENT_RELEASE: 'payment.release',
  PAYMENT_REFUND: 'payment.refund',
  PAYOUT_PROCESS: 'payout.process',
  PAYOUT_REJECT: 'payout.reject',
  PAYOUT_MARK_PAID: 'payout.mark_paid',

  /* Member reports (Prompt 30) ---------------------------------------------- */
  REPORT_REVIEW: 'report.review',
  REPORT_ACTION: 'report.action',
  REPORT_DISMISS: 'report.dismiss',

  /* Platform configuration (Prompt 35) -------------------------------------- */
  SETTINGS_UPDATE: 'settings.update',

  /* Support (Prompt 31) ----------------------------------------------------- */
  TICKET_REPLY: 'ticket.reply',
  TICKET_RESOLVE: 'ticket.resolve',
  TICKET_CLOSE: 'ticket.close',
  TICKET_REOPEN: 'ticket.reopen',

  /* Accounts (Prompt 29) ---------------------------------------------------- */
  USER_SUSPEND: 'user.suspend',
  USER_BLACKLIST: 'user.blacklist',
  USER_REACTIVATE: 'user.reactivate',
  USER_VERIFY: 'user.verify',
  /** The one verb a **member** writes about themselves (`meta.selfService`). */
  USER_DEACTIVATE: 'user.deactivate',
})

/** Every action string, in declaration order. */
export const AUDIT_ACTION_VALUES = Object.freeze(Object.values(AUDIT_ACTION))

/**
 * The namespace of an action — everything before the first dot.
 * `'admin.permissions.update'` → `'admin'`, `''` → `''`.
 */
export function auditNamespace(action) {
  return String(action ?? '').split('.')[0]
}

/**
 * Human label per namespace, for the explorer's filter and its group headings.
 *
 * `ticket` reads as "Support" because that is what the console calls the
 * screen — the namespace is the record's, the label is the reader's.
 */
export const AUDIT_NAMESPACE_META = Object.freeze({
  admin: Object.freeze({ label: 'Admin team' }),
  affiliate: Object.freeze({ label: 'Affiliates' }),
  announcement: Object.freeze({ label: 'Announcements' }),
  category: Object.freeze({ label: 'Categories' }),
  content: Object.freeze({ label: 'Published content' }),
  creator: Object.freeze({ label: 'Creators' }),
  dispute: Object.freeze({ label: 'Disputes' }),
  moderation: Object.freeze({ label: 'Moderation' }),
  order: Object.freeze({ label: 'Orders' }),
  payment: Object.freeze({ label: 'Payments' }),
  payout: Object.freeze({ label: 'Settlements' }),
  report: Object.freeze({ label: 'Reports' }),
  request: Object.freeze({ label: 'Requests' }),
  settings: Object.freeze({ label: 'Settings' }),
  ticket: Object.freeze({ label: 'Support' }),
  user: Object.freeze({ label: 'Accounts' }),
})

/**
 * Every namespace in the vocabulary with the actions it owns — derived from
 * {@link AUDIT_ACTION} rather than listed by hand, so adding a verb above adds
 * it to the filter with no second edit.
 *
 * @type {ReadonlyArray<{id: string, label: string, actions: string[]}>}
 */
export const AUDIT_NAMESPACES = Object.freeze(
  [...new Set(AUDIT_ACTION_VALUES.map(auditNamespace))]
    .map((id) =>
      Object.freeze({
        id,
        label: AUDIT_NAMESPACE_META[id]?.label ?? id,
        actions: Object.freeze(
          AUDIT_ACTION_VALUES.filter((action) => auditNamespace(action) === id)
        ),
      })
    )
    .sort((a, b) => a.label.localeCompare(b.label))
)

/** The actions in a namespace — `[]` for one the vocabulary does not have. */
export function auditActionsIn(namespace) {
  return AUDIT_NAMESPACES.find((entry) => entry.id === namespace)?.actions ?? []
}

export default AUDIT_ACTION
