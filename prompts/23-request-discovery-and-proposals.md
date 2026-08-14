# Prompt 23 — Request Discovery & Proposal Submission (Creator + Public Board)

> **Before you start:** Read `prompts/00-architecture-and-rules.md`, then inspect Prompts 01–22 output (reuse the discovery patterns from Prompt 12 — `useDiscoveryParams` etc.).

## 1. Objective

Build the request board: public `/requests` browse + `/requests/:id` detail (auth-gated actions), the creator's in-dashboard browse view, the proposal submission flow (pricing, delivery, samples), and creator proposal management at `/creator/proposals`.

## 2. Context

This completes the marketplace's supply side: creators discover open briefs and propose; buyers already receive/act on proposals (18). The public board is feature-flagged (`features.publicRequestBoard`) and shows limited info to guests with sign-in gates.

## 3. What Already Exists

Discovery patterns + `useDiscoveryParams` (12 — lift to shared location now), requestService.listOpen, proposalService (+ `hasCreatorProposed`) (07), published-portfolio picker source (22), buyer proposal handling (18), `useFeatureFlag` hook — **create it now** in `src/hooks/` reading settingsService features (documented; Prompt 35 adds admin UI).

## 4. What to Implement

1. **Lift `useDiscoveryParams`** from `features/discovery` to `src/hooks/useListParams.js` (generalized; discovery re-exports/consumes — no behavior change, minimal diff).
2. `RequestBoardPage` (`/requests`, public route; flag-gated → flag off: friendly "Board unavailable" for guests, creators redirected to dashboard browse) — list pattern: search (title/description), filters: category (multi), content type, budget (min slider), deadline window (7/14/30 days chips), sort (Newest / Budget high→low / Deadline soonest); `RequestBoardCard`: title, category + type chips, budget display ("$300–$500" or fixed), deadline relative, proposals count ("4 proposals"), buyer company (name + logo — public info), posted relative time, "Invited" badge when `invitedCreatorId` matches viewing creator; guests see cards fully but CTAs gated.
3. `RequestBoardDetailPage` (`/requests/:id`) — full brief (reuse buyer detail's brief renderer from 18 — extract shared `RequestBriefView` component into `features/requests/components/` consumed by both; refactor 18's page minimally), buyer card (company, member since, completed orders count), meta sidebar (budget, deadline, quantity, usage rights), proposals count; **action panel by viewer**: guest → "Sign in as a creator to propose" (login redirect w/ state); buyer → view-only note; creator: Propose CTA (gated: profile completeness ≥ 60% + not already proposed via `hasCreatorProposed` → "Proposal submitted" chip + link, availability on, request open) with gate explainer tooltips.
4. `ProposalDialog` (ResponsiveDialog, from board detail) — cover message (60–1200, guidance placeholder), price (CurrencyField; helper compares to budget: within/above range hint tone), delivery days (select 3/5/7/10/14/21), revisions included (select 1/2/3), samples picker (grid of own **published** items, select ≤ 3, thumbnails w/ check overlay; link "Add portfolio items" when < 3 published), **earnings preview** line (live: "You'll receive ≈ $X after {rate}% platform commission" via computeCommission), content-policy + terms confirm checkbox; submit → `proposalService.submitProposal` (extend: guards [request open, no duplicate, creator active/available], creates submitted proposal, increments request.proposalsCount, notify buyer `proposal_received`) → success state in dialog (check + "The buyer has been notified") → card CTA becomes submitted-state.
5. `CreatorBrowsePage` (`/creator/browse`) — same board inside DashboardLayout (shared components; dashboard chrome; default filter = creator's categories with "All categories" toggle); "Invited to you" filter chip when invites exist.
6. `CreatorProposalsPage` (`/creator/proposals`) — tabs: Active (submitted+shortlisted) / Accepted / Declined / Withdrawn+Expired, counts; cards: request title (→ board detail), buyer, your price + earnings-after-commission subline, delivery days, status chip (shortlisted gets accent "Shortlisted by buyer"), submitted date; actions: Edit (submitted only — reopens dialog prefilled, PATCH), Withdraw (confirm `requireReason=false`, status withdrawn, notify buyer), View request; accepted card links to the created order (route exists from 24 — this is written before 24 executes: link to `creatorOrderDetail(orderId)`; register order stub if 24 absent following the established stub pattern — or defer link enablement to 24; choose stub pattern for consistency and mark TEMP).
7. navConfig creator append: Browse requests, My proposals (badge: shortlisted count); resolve 21's TODOs (stats/QuickActions links); public TopNav "Browse Requests" now resolves (flag-aware hide).

## 5. Functional Requirements

Duplicate proposals impossible (UI + service); board excludes non-open requests; filters/sort/URL sync per 12 quality; earnings preview matches computeCommission; edit allowed only while submitted; withdraw updates buyer's view (18) correctly; invited badge shows for the targeted creator only.

## 6. UI/UX Requirements

Board matches discovery polish; proposal dialog = flagship form (mobile full-screen, sticky submit, progress-feel); samples picker delightful (tap-select, 3-max counter); gate explainers helpful never scolding.

## 7. Technical Requirements

Shared components extracted cleanly (RequestBriefView, board card reused public/dashboard); flags via useFeatureFlag only; service guards centralized.

## 8. API Requirements

Per contract; submitProposal composite documented; proposalsCount increment noted as mock-side (Laravel: DB trigger/endpoint).

## 9. Data Requirements

Seeds: open requests across categories/budgets (≥ 8 open), one invite targeting demo creator, demo creator has published samples ≥ 3 (verify; extend + reseed + report).

## 10. Files & Folders

Creates: `src/features/requests/pages/{RequestBoardPage,RequestBoardDetailPage,CreatorBrowsePage}.jsx`, `src/features/requests/components/{RequestBoardCard,RequestBriefView (extracted),BoardFilters}.jsx`, `src/features/proposals/pages/CreatorProposalsPage.jsx`, `src/features/proposals/components/{ProposalDialog,SamplesPicker,EarningsPreview,ProposalListCard}.jsx`, `src/hooks/{useListParams,useFeatureFlag}.js`, service extensions. Updates: publicRoutes/creatorRoutes/navConfig, 18's detail refactor (brief extraction), 21 TODOs, contract doc.

## 11. Responsive Requirements

360px: board cards single-col, dialog full-screen sticky-submit, samples 3-col grid; desktop: rail filters per 12; verify keyboard slider/selects.

## 12. Accessibility Requirements

Gate CTAs explain via text (not tooltip-only — visible helper line); dialog labeled fields + counter announcements; samples picker checkboxes semantics; invited badge has accessible text.

## 13. Validation & Error Handling

All field rules; price > 0 required (allow above-budget with warning hint, non-blocking); submit conflict (request closed meanwhile) → friendly refetch toast; flag-off routing safe.

## 14. Acceptance Criteria

- Demo creator: browse (dashboard + public) → open invited request → submit proposal (3 samples) → visible instantly in buyer's proposals tab (18) with correct data; duplicate blocked; edit + withdraw round-trip.
- Guest gating + login-redirect-return works to the same request.
- Earnings preview math verified vs settings; badges/counts correct.
- Lint + build clean.

## 15. Verification Steps

1. Reseed → full cross-role loop (creator submit → buyer sees → shortlist → creator sees shortlisted badge).
2. Guards matrix: duplicate, closed request, low-completeness creator, availability off, buyer viewer, guest.
3. URL-sync + 360px + keyboard dialog passes.
4. `npm run lint && npm run build`.

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

Buyer proposal actions (18), computeCommission (17), discovery page behavior (12 — only the hook lift), `prompts/`.

## 18. Depends On

12 (patterns), 17 (commission), 18 (buyer side), 21, 22 (samples).

## 19. Final Checklist

- [ ] Public board + detail with viewer-aware gating + flag
- [ ] Creator browse (dashboard) + proposal dialog with samples/earnings preview
- [ ] My Proposals with edit/withdraw + statuses; cross-role loop verified
- [ ] Shared extractions (brief view, list params) done cleanly
- [ ] Lint + build clean; report written
