// The admin console's shared kit — Prompt 28 §4.4.
//
//   import { AdminPageGuard, AgeBadge, EntityRefChip } from '@/features/admin/shared'
//
// Five pieces, each answering something every admin screen from Prompt 29 on
// runs into:
//
//   AdminListPage   the list pattern, wired — use it or copy it (see its header)
//   AdminPageGuard  page-level permission gating that never renders a blank page
//   SuperAdminRoute route-level gating for the Platform section (Prompt 35)
//   AgeBadge        how long something has been waiting, tinted by how much that matters
//   EntityRefChip   a reference to another record, with its route in one place
//
// Nothing else belongs here. A component used by exactly one admin feature
// lives in that feature's `components/` folder — this barrel is for what more
// than one screen shares (00 §5).

export { default as AdminListPage } from './AdminListPage'
export { default as AdminPageGuard, AdminAccessNotice } from './AdminPageGuard'
export { default as SuperAdminRoute, SuperAdminNotice } from './SuperAdminRoute'
export { default as AgeBadge } from './AgeBadge'
export { default as EntityRefChip } from './EntityRefChip'
export { ENTITY_TYPE_OPTIONS, getEntityMeta, resolveEntityPath } from './entityRefs'
