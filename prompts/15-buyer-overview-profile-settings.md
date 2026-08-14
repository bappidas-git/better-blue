# Prompt 15 — Buyer Dashboard: Overview, Profile & Settings

> **Before you start:** Read `prompts/00-architecture-and-rules.md`, then inspect Prompts 01–14 output (especially DashboardLayout/DashboardPage/widget kit and navConfig rules).

## 1. Objective

Build the buyer dashboard Overview (API-driven stats, spend chart, activity, quick actions, fresh-account onboarding), the buyer Profile management page, and buyer Settings — establishing the pattern every role dashboard follows.

## 2. Context

First real dashboard content. Requests/orders/payments pages arrive in Prompts 16–20; Overview links to them via paths (registered routes may still 404 until then — instead, quick actions/links for not-yet-built pages must be included only when their route exists; add remaining links in later prompts per navConfig append rule).

## 3. What Already Exists

Dashboard framework + widget kit (14), buyer seeded data (05), services (07), `useForm` + Form fields + upload mock (04/07), AuthContext (09).

## 4. What to Implement

1. `buyerDashboardService` (`src/services/`) — `getOverview(buyerId)`: parallel-fetches and computes `{ activeRequests, proposalsAwaiting (submitted+shortlisted on open requests), activeOrders, totalSpent, spendByMonth[6], recentActivity (latest 8 notifications) }`; documented as future `GET /buyer/overview` Laravel endpoint.
2. `BuyerOverviewPage` (`src/features/dashboard/pages/`, replaces placeholder) — `WelcomeBanner`; `StatCardGrid`: Active requests, Proposals to review, Active orders, Total spent (currency) — each links to its section **once that route exists** (this prompt: link only Profile/Settings; Prompts 16–20 update these links as pages land — leave marked TODOs); `ChartCard` + `ThemedBarChart` "Spend — last 6 months"; `ActivityFeed` (recent activity; item click → notifications page later, no-op tooltip for now); `QuickActions`: New request (TODO-link until 16), Browse creators (`CREATORS`), Get support (`CONTACT`).
3. **Fresh-buyer onboarding state** — when zero requests/orders: replace stats emphasis with a 3-step onboarding card (Complete your profile → Post your first request → Review proposals) with progress derived from data (profile completeness, request count); register a new demo-friendly seeded "fresh buyer" account if none exists (extend seeds, reseed, document credentials).
4. `BuyerProfilePage` — sections in cards: Company identity (logo mock-upload via FormFileField+uploadService with preview + remove, company name, industry select from fixed professional list, website URL, location), About (bio 600 chars with counter), Contact (name — updates users.name, phone). Save via `buyerProfileService.update` + `userService.update` (only changed records), success toast, `refreshUser` when user fields change. Profile completeness meter (computed %, shown here + used by onboarding).
5. `BuyerSettingsPage` — Account card: email (read-only + "contact support to change"), password change (current+new+confirm — mock validation against stored user, `MOCK-AUTH` comment; toast on success); Preferences card: placeholder note "Notification preferences arrive with the notification center" (Prompt 27 replaces — leave marked slot component `SettingsNotificationSlot`); Danger zone: Deactivate account (confirm dialog `requireReason`, sets accountStatus `deactivated`, audit-logs `user.deactivate` self-action, logs out with respectful toast).
6. navConfig: append buyer entries — Overview (exists), Profile, Settings (+ badgeKey none). Bottom-nav order: Overview, (Requests/Orders arrive later), Profile, More.
7. Register routes `BUYER_PROFILE`, `BUYER_SETTINGS` in `buyerRoutes.jsx`.

## 5. Functional Requirements

Overview numbers provably match seeded db for demo buyer; chart shows real monthly aggregation (dayjs grouping); profile saves persist (reload-proof) and completeness updates live; deactivate flow: cannot log back in (status screen from 09) — reseed to restore.

## 6. UI/UX Requirements

Widget-kit look per 14; forms in max-720px column of cards; sticky save bar on mobile (StickyActionBar with Save/Discard when dirty); dirty-state guard (confirm on route change with unsaved edits — implement small `useUnsavedChanges` hook with router blocker; keep simple).

## 7. Technical Requirements

All aggregation in `buyerDashboardService` (not the page); forms via `useForm`; only changed fields PATCHed; hook `useUnsavedChanges` placed in `src/hooks/` for reuse.

## 8. API Requirements

Existing CRUD per contract; note `GET /buyer/overview` future endpoint in service JSDoc (contract already lists composite ops — add this one to the contract table).

## 9. Data Requirements

Demo buyer has ≥ 4 months of payment history for the chart (verify seeds; extend if needed + reseed + report).

## 10. Files & Folders

Creates: `src/services/buyerDashboardService.js`, `src/features/dashboard/pages/BuyerOverviewPage.jsx`, `src/features/dashboard/components/OnboardingChecklist.jsx`, `src/features/buyerAccount/pages/{BuyerProfilePage,BuyerSettingsPage}.jsx` + local components, `src/hooks/useUnsavedChanges.js`. Updates: `buyerRoutes.jsx`, `navConfig.jsx`, seeds if needed.

## 11. Responsive Requirements

Stats 2×2 on mobile; chart height 240/300; forms single column mobile with sticky save; verify 360/1280.

## 12. Accessibility Requirements

Stat links descriptive ("3 active requests — view requests"); chart `ariaLabel` summaries; file upload keyboard operable + change/remove labeled; danger zone clearly headed; completeness meter has text %.

## 13. Validation & Error Handling

Profile: URL validator, required company name, image type/size limits with inline errors; settings: password rules + mismatch; overview partial-failure isolation (one widget errors → its card shows retry, rest fine).

## 14. Acceptance Criteria

- Overview matches db math for demo buyer; fresh buyer sees onboarding variant.
- Profile edit round-trip (incl. logo mock upload + avatar propagation in topbar via refreshUser); completeness reacts.
- Password change + deactivate flows work per spec; unsaved-changes guard fires.
- Lint + build clean.

## 15. Verification Steps

1. Demo buyer: verify each stat against filtered db queries; chart sanity.
2. Fresh buyer: onboarding variant + progress changes after profile save.
3. Full profile/settings form passes (validation, save, reload, mobile sticky bar, unsaved guard).
4. Deactivate → login blocked → reseed. `npm run lint && npm run build`.

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

Dashboard framework internals (consume only), auth flows (09), `prompts/`.

## 18. Depends On

07, 09, 14 (05 seeds).

## 19. Final Checklist

- [ ] buyerDashboardService aggregation + Overview page with all widgets
- [ ] Onboarding fresh-state + seeded fresh buyer
- [ ] Profile + Settings complete (upload, completeness, password, deactivate, unsaved guard)
- [ ] navConfig/routes appended correctly; TODO links documented
- [ ] Lint + build clean; report written
