# Prompt 36 — Super Admin: Admin Management, Roles & Permissions, Audit Logs

> **Before you start:** Read `prompts/00-architecture-and-rules.md` (RBAC §11, security §14), then inspect Prompts 01–35 output (permission matrix from 03 governs everything here).

## 1. Objective

Complete platform governance: admin account management (create, permission assignment, suspend), a roles & permissions matrix view, self-protection rules, and the full audit log explorer — the accountability layer over everything Prompts 28–35 recorded.

## 2. Context

Roles are fixed (buyer/creator/admin/super_admin — 00 §9); granularity comes from per-admin permission arrays (03). Every admin action so far wrote auditLogs; this prompt makes that trail explorable. Super-admin-only (route-level, per 35's pattern).

## 3. What Already Exists

PERMISSION keys/groups/meta + hasPermission (03), seeded admins with varied permission sets (05), permission-filtered nav + AdminPageGuard (28/14), auditService.log usage across 29–35, user directory treating team as read-only (29), exportCsv.

## 4. What to Implement

1. **Service** (`adminTeamService` new): `listAdmins()` (admin+super_admin users w/ aggregates: last active, actions-this-month from audit); `createAdmin({ name, email, permissions, actor })` — validates unique email, creates user role `admin` w/ permission array + generated temp password (readable format `BB-Temp-XXXX`) **displayed exactly once** in success dialog (mock; Laravel: invite email note); audit `admin.create`; `updateAdminPermissions(userId, { permissions, actor })` — guards below; audit with before/after; `setAdminStatus(userId, { status: active|suspended, reason, actor })` — audit + force-logout effect via 09 revalidation; **protection rules** (service-enforced + UI-hidden): cannot modify/suspend self; cannot modify/suspend super_admins (no super-admin management in v1 — exactly one seeded; document); suspended admins keep records.
2. `AdminAdminsPage` (`/admin/admins`) — team table: admin (avatar/name/email), role chip (Admin/Super Admin), StatusChip, permission summary (count chip "7 permissions" + hover/tap popover listing), last active, actions-this-month; actions (non-super rows only): Edit permissions, Suspend/Reactivate (confirm `requireReason`); header "Add admin" → `CreateAdminDialog`: details + **permission picker** (grouped checkboxes by PERMISSION_GROUPS with group select-all, meta descriptions, live summary count) + create → temp-password success dialog (copy button, "shown only once" warning); Edit permissions → same picker prefilled + diff summary on confirm.
3. `AdminRolesPage` (`/admin/roles`) — documentation-grade matrix view: role cards (four roles: description, capability summary from ROLE_META); **permission matrix table**: rows = permission keys (grouped, with meta descriptions), columns = Admin (configurable ✓/—) / Super Admin (always ✓); per-admin comparison selector (pick ≤ 3 admins → their columns appear with ✓/—); read-only explainer ("Roles are fixed; tailor individual admin permissions from Admin Management"); export matrix CSV.
4. `AdminAuditPage` (`/admin/audit-logs`) — explorer: DataTable (timestamp, actor (EntityRefChip → 29 detail; system actions labeled), action chip (namespaced e.g. `dispute.resolve`), entity (EntityRefChip type-aware → gated links to relevant admin pages), summary line from meta); filters: actor select (admins), action-namespace select (built from distinct prefixes: user/moderation/dispute/payment/payout/settings/category/admin/announcement/affiliate/order/support), entity type, date range; search (entity id); detail `SideSheet`: full meta pretty-rendered (KeyValueList + nested JSON block styled readably, old→new diffs highlighted when present), related-entity links, actor context; pagination (50/page), CSV export; **retention note** card (mock keeps all; Laravel retention policy note).
5. **Coverage audit** — sweep 28–35 features for un-audited admin mutations; fix gaps (add auditService.log calls; list in report); ensure every audit action string is namespaced consistently (constants file `src/constants/auditActions.js` — create + refactor existing literals to it; minimal mechanical diff across services).
6. navConfig: enable Admins/Roles/Audit logs (28's Platform group — all comment-gates now resolved; verify none remain); 29's team-tab rows link here.

## 5. Functional Requirements

Create-admin round-trip: new admin logs in with temp password, sees permission-filtered nav exactly matching assignment, AdminPageGuard blocks direct URLs outside grants; permission edit takes effect on target's next boot/revalidation (document timing); suspend blocks login; matrix reflects reality (spot-check vs hasPermission behavior); audit explorer filters/links/diffs correct against seeded + freshly generated entries.

## 6. UI/UX Requirements

Governance clarity: picker scannable (groups, descriptions, counts); matrix print-worthy; audit explorer investigator-friendly (dense, filterable, linkable); temp-password moment unmistakable.

## 7. Technical Requirements

Protection rules service-enforced (UI hiding is convenience only); auditActions constants adopted everywhere (grep: no raw action literals); no role invention.

## 8. API Requirements

Contract additions (admin team composites, audit query params); Laravel warnings: server-side permission enforcement, audit immutability (no PATCH/DELETE on auditLogs — verify mock code never mutates them).

## 9. Data Requirements

Seeds: admins with distinct permission subsets (05), rich audit history (05 + everything generated in 28–35 testing); extend seeds if matrix demo needs more variety (+ reseed + report).

## 10. Files & Folders

Creates: `src/services/adminTeamService.js`, `src/constants/auditActions.js`, `src/features/admin/team/pages/{AdminAdminsPage,AdminRolesPage}.jsx`, `src/features/admin/audit/pages/AdminAuditPage.jsx`, components (PermissionPicker, CreateAdminDialog, TempPasswordDialog, PermissionMatrix, AuditDetailSheet, AuditFilters). Updates: services refactored to auditActions, routes/navConfig, contract doc.

## 11. Responsive Requirements

Picker single-column mobile w/ sticky confirm; matrix horizontal-scrolls gracefully (sticky first column) on small screens; audit table→cards.

## 12. Accessibility Requirements

Picker checkboxes grouped with fieldset/legend; matrix table headers/scope; temp password in selectable field with copy announcement; audit rows readable summaries (not raw JSON in list).

## 13. Validation & Error Handling

Email uniqueness; ≥ 1 permission required to create; self/super protection errors humanized if forced; audit meta rendering never crashes on odd shapes (defensive rendering).

## 14. Acceptance Criteria

- Created limited admin experiences exact permission-filtered reality (nav + direct URLs + action buttons across 29–34 features spot-checked).
- Protection rules hold (self, super) at UI + service; suspend blocks login; permission edit propagates.
- Audit explorer: filter matrix works, diffs render, entity links resolve, export correct; no un-audited admin mutation remains (sweep documented).
- Lint + build clean.

## 15. Verification Steps

1. Create admin with only `moderation.review` → login → verify nav/URL/action reality across areas.
2. Edit their permissions (+`disputes.resolve`) → revalidate → verify delta; suspend → login blocked; reactivate.
3. Audit explorer against known recent actions (from step 1–2) incl. diff rendering + links.
4. Sweep report review; 360px matrix/picker pass. `npm run lint && npm run build`.

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

Fixed role set (03), hasPermission semantics, auditLogs immutability, 29's user-management scope, `prompts/`.

## 18. Depends On

28 (kit/nav), 29 (user patterns/links), 03 (permissions), 35 (super-admin route pattern), audit emitters 29–35.

## 19. Final Checklist

- [ ] Admin CRUD (create w/ temp password, permissions editor, suspend) with protection rules
- [ ] Roles & permission matrix (+ per-admin comparison, export)
- [ ] Audit explorer (filters/detail/diffs/links/export) + auditActions refactor + coverage sweep
- [ ] Permission reality verified with a freshly created limited admin
- [ ] Lint + build clean; report written
