# Prompt 28 — Admin Foundation & Overview Dashboard

> **Before you start:** Read `prompts/00-architecture-and-rules.md` (RBAC §11), then inspect Prompts 01–27 output (DashboardLayout already supports admin nav filtering by permission; admin login works since 09).

## 1. Objective

Stand up the admin area: admin navigation structure (grouped, permission-filtered), the admin Overview dashboard with platform KPIs/charts/attention queues, admin-grade table conventions, and shared admin utilities that Prompts 29–36 build on.

## 2. Context

Admins and super admins share `/admin` (00 §9); super-admin-only entries appear via `roles: ['super_admin']` in navConfig (pages arrive 35/36). Overview aggregates are computed client-side from multiple endpoints (mock) — documented as future `GET /admin/overview`.

## 3. What Already Exists

RoleRoute guarding `/admin` (09), DashboardLayout with grouped nav + permission filtering (14), PermissionGate + hasPermission (03/09), widget kit (14), notifications page shared (27), seeded admins with varied permissions + rich marketplace data (05).

## 4. What to Implement

1. **navConfig admin structure** (append full skeleton now; entries whose pages arrive later stay commented-out with their prompt number — uncommented by those prompts): groups — Overview; Marketplace (Requests P31, Orders P31, Disputes P33); Users (Users P29); Trust & Safety (Moderation P30, Reports P30); Finance (Payments P32, Settlements P32, Commissions P32); Communication (Announcements P31, Support P31, Notifications — enable now via 27's shared page); Platform [super_admin] (Admins P36, Roles P36, Settings P35, Categories P35, Audit logs P36); Affiliates (P34, permission `affiliates.manage`). This prompt enables: Overview + Notifications.
2. `adminService` (extend placeholder from 07) — `getOverviewStats()`: parallel aggregation: `{ gmvThisMonth (sum charge transactions), commissionRevenueThisMonth, activeOrders, newUsersThisWeek, openDisputes, moderationQueueSize (submitted+under_review), pendingSettlements (requested payouts), ordersByWeek[8], revenueByMonth[6], categoryDistribution (orders by category top 6) }` — each metric's derivation JSDoc'd; `getAttentionQueues()`: `{ oldestOpenDisputes[3], oldestModerationItems[3], overdueOrders[3] }`.
3. `AdminOverviewPage` (replaces placeholder) — KPI StatCardGrid (GMV, Commission revenue, Active orders, New users, Open disputes, Moderation queue — 6 cards, 2×3/3×2 responsive; disputes/moderation cards deep-link once routes exist — comment-gated like nav); charts row: ThemedLineChart "Orders per week", ThemedBarChart "Commission revenue by month", ThemedDonutChart "Orders by category"; **Attention section**: three queue cards (Oldest open disputes / Moderation waiting / Overdue orders) each listing 3 items with age badges + view-all links (comment-gated until target prompts); recent audit activity feed (auditService.list latest 8, rendered via ActivityFeed-style list with actor + action + entity + time).
4. **Admin shared kit** (`src/features/admin/shared/`): `AdminListPage` pattern helper (composition guide, not abstraction-for-abstraction — a documented example component wiring PageHeader+toolbar+DataTable+usePaginatedQuery that 29–36 copy), `EntityRefChip` (small chip linking to an entity: order/user/request — type-aware icon + label, used across admin), `AgeBadge` (relative-age with SLA tone: >Xd warning/error), `AdminPageGuard` (wraps PermissionGate for page-level: no permission → friendly "You don't have access to this area" card — never blank).
5. **Admin visual touches** — admin topbar shows role chip (Admin / Super Admin); Overview WelcomeBanner variant with platform-status line ("All systems normal — 3 items need attention").
6. Routes: `ADMIN` index → Overview; `ADMIN_NOTIFICATIONS` → shared notifications page (27); verify limited-permission seeded admin sees reduced nav + AdminPageGuard on direct URL access to unauthorized pages (test with a comment-enabled stub? — no stubs: guard verified fully when 29+ land; this prompt: verify nav filtering only + guard component unit-demo in dev gallery).

## 5. Functional Requirements

Overview numbers reconcile with db (document derivations vs seed expectations); charts render seeded history; attention queues show genuinely oldest items; audit feed live; permission-filtered nav proven with seeded limited admin; super-admin group hidden from plain admins.

## 6. UI/UX Requirements

Denser than buyer/creator but same design language; KPI cards with compact currency (formatNumberCompact for large); attention cards action-oriented (age-tinted); charts consistent heights (280).

## 7. Technical Requirements

All aggregation in adminService (JSDoc per metric: formula + Laravel endpoint note); no admin page fetches raw collections directly for stats; shared kit exported from `features/admin/shared/index.js`.

## 8. API Requirements

Existing endpoints; contract table additions: `/admin/overview`, `/admin/attention`.

## 9. Data Requirements

Seeds provide non-trivial history (8 weeks orders, 6 months revenue, queues non-empty) (verify; extend + reseed + report).

## 10. Files & Folders

Creates: `src/features/admin/overview/pages/AdminOverviewPage.jsx`, `src/features/admin/overview/components/{KpiGrid,AttentionQueues,AuditFeed}.jsx`, `src/features/admin/shared/{AdminListPage.jsx,EntityRefChip.jsx,AgeBadge.jsx,AdminPageGuard.jsx,index.js}`, adminService extensions. Updates: navConfig (full admin skeleton), adminRoutes, dev gallery (AdminPageGuard demo).

## 11. Responsive Requirements

Admin remains fully usable at 360px (KPIs 2-col, charts stack, queues stack; bottom nav shows Overview/Notifications/More per MORE_NAV_KEYS); desktop 1280+ optimal.

## 12. Accessibility Requirements

KPI cards labeled with metric+value; charts aria summaries; queue items linkified with descriptive names; role chip text.

## 13. Validation & Error Handling

Per-widget failure isolation (metric card error state + retry); empty queues → positive empty state ("Nothing needs attention").

## 14. Acceptance Criteria

- Overview renders all KPIs/charts/queues/audit against seeds with documented reconciliation for 3 spot-checked metrics.
- Limited admin: reduced nav; super admin: full incl. Platform group placeholder-commented (visible only entries with pages: Overview/Notifications).
- Lint + build clean.

## 15. Verification Steps

1. Login super@ + limited admin → nav diff; direct-URL guard demo in gallery.
2. Reconcile GMV/openDisputes/queueSize vs filtered db queries.
3. 360px + 1280px passes; chart aria check.
4. `npm run lint && npm run build`.

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

DashboardLayout internals (consume), guard logic (09), notifications page (reuse), `prompts/`.

## 18. Depends On

09, 14, 27 (05/07 foundations).

## 19. Final Checklist

- [ ] Admin nav skeleton (groups, permissions, super-admin gating, comment-gated future entries)
- [ ] adminService aggregations + Overview (KPIs/charts/attention/audit)
- [ ] Shared admin kit (AdminListPage pattern, EntityRefChip, AgeBadge, AdminPageGuard)
- [ ] Permission-filtered nav verified with seeded admins
- [ ] Lint + build clean; report written
