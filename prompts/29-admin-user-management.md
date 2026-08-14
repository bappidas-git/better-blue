# Prompt 29 — Admin User Management (Users, Creators, Buyers, Account Actions)

> **Before you start:** Read `prompts/00-architecture-and-rules.md` (RBAC §11, security §14), then inspect Prompts 01–28 output (admin shared kit from 28).

## 1. Objective

Build admin user management: searchable/filterable user directory with role presets, rich user detail view (role-specific), and governed account actions — suspend, blacklist, reactivate, verify creator — all confirmed, reasoned, audited, and notified.

## 2. Context

Blacklist/suspend are account **statuses** (never deletion — 00 §9). Status changes take effect through 09's revalidation (suspended users force-logged-out on next check, blocked at login) and 12/13's public exclusions. Permission: `users.manage` (AdminPageGuard).

## 3. What Already Exists

ACCOUNT_STATUS + meta (03), guard/revalidation behavior (09), discovery/profile exclusions (12/13/21), admin kit + nav placeholders (28), auditService/notifyAdmins (07/26), `account_status_changed` notification type (03), DataTable/exportCsv (04/03).

## 4. What to Implement

1. **Service** (`userService` admin extensions): `adminListUsers(params)` (role/status filters, search name/email, joined-range, sort); `adminGetUserBundle(userId)` — user + role profile + aggregates `{ ordersCount, totalSpent|totalEarned, openDisputes, reportsAgainst, lastLoginAt }`; `adminSetAccountStatus(userId, { status, reason, actor })` — guards: not self, not super_admin target (only super admin may act on admins — and admin management itself is Prompt 36; here restrict targets to buyer/creator), valid status value; PATCHes status + `statusReason`/`statusChangedAt`; audit `user.suspend|user.blacklist|user.reactivate` with reason meta; notify target (`account_status_changed`, respectful copy per status); creator side-effects: suspended/blacklisted creator's availability forced off (mirror field per 12's exclusion approach — apply whatever mechanism 12 implemented; verify exclusion actually triggers); `adminSetCreatorVerified(profileId, { verified, actor })` — toggles badge + audit `creator.verify`.
2. `AdminUsersPage` (`/admin/users`) — role preset tabs: All / Buyers / Creators / Team (admin+super_admin — **read-only rows here**, managed in P36); filters: account status, joined date range; SearchInput (name/email); DataTable columns: user (avatar+name+email), role chip, StatusChip (account), joined, last active, key stat (orders/spent for buyers, orders/earned for creators), actions kebab; mobile `renderMobileCard`; CSV export; pagination/sort.
3. `AdminUserDetailPage` (`/admin/users/:id`) — header: avatar, name, email copy, role + StatusChip (+ statusReason banner when suspended/blacklisted: reason, date, actor), quick external links (creator → public profile; buyer → —); action buttons (state-aware): Suspend / Blacklist / Reactivate / Verify creator toggle; tabs:
   - **Profile** — role-specific KeyValueList (company/industry/website | tagline/categories/pricing) + completeness.
   - **Activity** — aggregates cards + recent orders list (EntityRefChip rows, links to P31 admin order pages — comment-gated until then, plain text meanwhile), recent disputes, reports **against** this user (from reports collection; links gated until P30).
   - **Moderation history** (creators) — their moderationReviews summary rows (statuses + dates; links gated until P30).
   - **Audit trail** — auditLogs filtered to this entity (TimelineList).
4. **Action dialogs** — Suspend: confirm `requireReason` (reason mandatory, consequence copy: "User can't sign in or transact until reactivated; their public content is hidden"); Blacklist: stronger confirm (danger tone, mandatory reason, copy notes permanence-by-policy + audit); Reactivate: confirm + optional note; Verify: light confirm. All → service → toast → refetch; buttons permission-gated (`users.manage`) + hidden for invalid targets (self, team members).
5. **Effect verification hooks** — after suspending seeded creator: discovery excludes them (12), public profile shows unavailable (13), login blocked (09) — this prompt must verify and fix any gap in those integrations (report fixes).
6. navConfig: enable Users entry (28's comment); routes registered; Overview attention/new-users cards can now deep-link (resolve 28's comment-gates for users).

## 5. Functional Requirements

Directory filters/search/sort/export correct; bundle aggregates match db; status actions round-trip with audit+notification records; suspended creator end-to-end exclusion verified; verify badge propagates to public surfaces (12/13 card badge).

## 6. UI/UX Requirements

Admin-grade density with 28's kit; status banners prominent but professional; danger actions visually distinct; detail scannable (aggregates as small StatCards).

## 7. Technical Requirements

All admin ops in userService with guards; no direct PATCHes from components; permission checks on actions (PermissionGate) and page (AdminPageGuard); target-restriction rules centralized in service.

## 8. API Requirements

Per contract (admin listing params; status PATCH semantics documented incl. Laravel authorization warning).

## 9. Data Requirements

Seeds: users across statuses (active majority, 1 suspended creator w/ reason, 1 blacklisted buyer, deactivated example), reports-against linkage, varied joined dates (verify; extend + reseed + report).

## 10. Files & Folders

Creates: `src/features/admin/users/pages/{AdminUsersPage,AdminUserDetailPage}.jsx`, `src/features/admin/users/components/{UserTable,UserStatusBanner,AccountActionDialogs,UserAggregates,RoleProfilePanel}.jsx`, userService admin extensions. Updates: adminRoutes, navConfig (enable), 28 link gates, any 09/12/13 integration fixes.

## 11. Responsive Requirements

360px: table→cards, detail tabs scroll, action buttons stack in StickyActionBar; desktop: full table density.

## 12. Accessibility Requirements

Kebabs labeled per user; status not color-only; reason dialogs labeled + described consequences; tabs ARIA; copy-email button feedback.

## 13. Validation & Error Handling

Reason min-length (10); invalid-target attempts impossible via UI + service error fallback; action failure → toast + state unchanged; list/detail standard states.

## 14. Acceptance Criteria

- Suspend seeded creator → all three exclusion effects verified live → reactivate restores.
- Blacklist buyer → login blocked with correct screen (09) + audit/notification records exact.
- Verify toggle propagates to discovery/profile badges; team rows read-only; limited admin without `users.manage` blocked by AdminPageGuard.
- Lint + build clean.

## 15. Verification Steps

1. Reseed → full suspend/reactivate cycle with cross-surface checks (login, discovery, public profile).
2. Blacklist cycle + db inspection (status, reason, audit, notification).
3. Filters/search/export matrix; permission-blocked admin direct-URL test.
4. 360px + keyboard dialog pass. `npm run lint && npm run build`.

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

Auth/revalidation logic (09 — integrate, don't rewrite), ACCOUNT_STATUS values, admin management scope (P36), `prompts/`.

## 18. Depends On

28 (kit/nav), 09 (status enforcement), 12/13 (exclusions), 26/27 (notify infra).

## 19. Final Checklist

- [ ] Directory (tabs/filters/search/export) + detail (profile/activity/moderation/audit)
- [ ] Suspend/blacklist/reactivate/verify with reasons, audit, notifications, guards
- [ ] Cross-surface enforcement verified (login/discovery/profile)
- [ ] Permission gating proven; lint + build clean
- [ ] Report written
