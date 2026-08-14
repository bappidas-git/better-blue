# Prompt 21 — Creator Dashboard: Overview, Profile & Settings

> **Before you start:** Read `prompts/00-architecture-and-rules.md`, then inspect Prompts 01–20 output (mirror the buyer pattern from Prompt 15 — reuse, don't reinvent).

## 1. Objective

Build the creator dashboard Overview (stats, earnings sparkline, matching-requests teaser, activity, onboarding checklist), creator Profile management (the marketplace-facing profile), and creator Settings.

## 2. Context

The creator profile edited here is what buyers see on Prompts 12/13 surfaces — edits must propagate. Portfolio/requests/orders/earnings pages arrive in Prompts 22–25; follow the same append-links-when-routes-exist discipline as 15.

## 3. What Already Exists

Dashboard framework + widgets (14), buyer pattern reference (15) incl. `useUnsavedChanges`, creatorProfileService (07), earnings summary service (17), seeded creator data (05).

## 4. What to Implement

1. `creatorDashboardService` — `getOverview(creatorUserId)`: `{ openMatchingRequests (open requests in creator's categories count), activeProposals, activeOrders, earningsSummary (from paymentService.getEarningsSummary), earningsByMonth[6], recentActivity, profileCompleteness, portfolioCounts { published, inReview } }`; future `GET /creator/overview` noted.
2. `CreatorOverviewPage` (replaces placeholder) — WelcomeBanner; StatCardGrid: Matching open requests (→ browse, TODO until 23), Active proposals (TODO until 23), Active orders (TODO until 24), Available to withdraw (currency; → earnings TODO until 25); ChartCard ThemedLineChart "Earnings — last 6 months" (gradient area); `ActivityFeed`; QuickActions: Browse requests (TODO-gated), Add portfolio item (TODO until 22), Edit profile.
3. **Onboarding checklist card** (reuse `OnboardingChecklist` from 15 — generalize it if buyer-specific): Complete profile (≥ 80% completeness) → Add 3 portfolio items → Submit first proposal; progress from data; visible until all done, then collapses to dismissed state (storage).
4. **Availability toggle** — prominent Overview card + topbar-adjacent switch: "Accepting new requests" → PATCHes profile availability; off state shows explainer (hidden from discovery); confirm when turning off with active orders (informational).
5. `CreatorProfilePage` — cards: Identity (avatar mock-upload w/ preview, display name, tagline 80 chars w/ counter, location, languages multi-select from fixed list), Expertise (categories multi-select ≤ 4 from API, content types offered checkboxes, starting price CurrencyField ≥ $25), About (bio 200–1200 w/ counter + writing tips helper), Payout method (bank account mock: account holder, masked account number input — stores masked form only, sort/routing mock field; clearly labeled demo; used by payouts in 25), Public preview link ("View public profile" → `creatorProfile(profileId)` new tab). Save per 15 pattern (changed-only PATCH, unsaved guard, sticky mobile save, completeness meter live, `refreshUser` for avatar/name).
6. `CreatorSettingsPage` — Account (email read-only, password change mock), Preferences (notification slot per 15 pattern — Prompt 27 fills), Danger zone (deactivate per 15; warn about active orders: blocked when active orders exist — check via service, explain "Complete or resolve active orders first").
7. **Verification badge display** — profile shows `verified` status chip (read-only; admin grants in Prompt 29; tooltip "Verified by BetterBlue Trust & Safety").
8. navConfig creator entries: Overview, Profile, Settings (+ later prompts append); routes registered.

## 5. Functional Requirements

Overview numbers match db for demo creator; profile edits propagate to discovery card + public profile (verify live); availability off hides from discovery (12's filter); completeness formula documented (fields weighted; same helper style as buyer's); deactivation guard on active orders works.

## 6. UI/UX Requirements

Mirror 15's quality; earnings chart currency ticks; availability switch prominent with clear state color (success tint when on); payout method card visually secure-feeling (lock icon, masked display).

## 7. Technical Requirements

Aggregations in creatorDashboardService; shared onboarding component generalized (props-driven steps) — refactor 15's usage without behavior change; forms via useForm; masked account handling never stores raw beyond mock necessity (store masked only; document).

## 8. API Requirements

Existing CRUD + earnings summary; contract table addition for `/creator/overview`.

## 9. Data Requirements

Demo creator seeded with: matching open requests ≥ 3, proposals, active orders, 6 months earnings history, incomplete-profile secondary creator for onboarding demo (verify seeds; extend + reseed + report if gaps).

## 10. Files & Folders

Creates: `src/services/creatorDashboardService.js`, `src/features/dashboard/pages/CreatorOverviewPage.jsx`, `src/features/creatorAccount/pages/{CreatorProfilePage,CreatorSettingsPage}.jsx` + local components (AvailabilityCard, PayoutMethodCard, ExpertiseForm…). Updates: creatorRoutes, navConfig, OnboardingChecklist generalization (touch 15 usage minimally).

## 11. Responsive Requirements

Per 15: 2×2 stats mobile, sticky save, 360/1280 verified.

## 12. Accessibility Requirements

Availability switch labeled with state; completeness meter text; chart aria summaries; multi-selects keyboard operable; masked input described.

## 13. Validation & Error Handling

Starting price min, tagline/bio lengths, categories ≤ 4, payout fields format checks; partial widget failure isolation; save errors preserve input.

## 14. Acceptance Criteria

- Demo creator overview accurate; onboarding variant on secondary creator; availability toggle round-trips to discovery visibility.
- Profile edit → visible on public surfaces; payout method saved masked; deactivation blocked with active orders, allowed otherwise.
- Lint + build clean.

## 15. Verification Steps

1. Verify each stat vs db; toggle availability → check /creators exclusion → re-enable.
2. Edit tagline/price → confirm on discovery card + public profile.
3. Deactivation guard both branches (active vs none — use two seeded creators).
4. 360px + keyboard pass. `npm run lint && npm run build`.

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

Buyer pages beyond OnboardingChecklist generalization, discovery/profile internals (12/13), `prompts/`.

## 18. Depends On

14, 15 (pattern), 17 (earnings), 07 (05 seeds; 12/13 for propagation checks).

## 19. Final Checklist

- [ ] creatorDashboardService + Overview with all widgets + onboarding
- [ ] Availability toggle wired to discovery visibility
- [ ] Profile (identity/expertise/about/payout) + Settings complete with guards
- [ ] Propagation to public surfaces verified; navConfig/routes appended
- [ ] Lint + build clean; report written
