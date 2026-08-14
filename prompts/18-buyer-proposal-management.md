# Prompt 18 — Buyer Requests & Proposal Management

> **Before you start:** Read `prompts/00-architecture-and-rules.md`, then inspect Prompts 01–17 output (especially requestService, proposalService, orderService.acceptProposal).

## 1. Objective

Build buyer request management (`/buyer/requests` list + request detail with proposals) and the proposal decision experience: review, shortlist, decline, side-by-side compare, and accept → order creation → hand-off to checkout.

## 2. Context

Seeds guarantee open requests with multiple proposals for the demo buyer, so this is fully testable before creator UI exists (23). Accept uses `orderService.acceptProposal` (17) and navigates to `buyerCheckout(orderId)` — create a minimal checkout stub page this prompt (order summary + "Payment step arrives in the next stage"), fully replaced in Prompt 19.

## 3. What Already Exists

Wizard creating requests + drafts (16), `acceptProposal` (17), DataTable/SideSheet/ResponsiveDialog/StatusChip/EmptyState (04), usePaginatedQuery (07), dashboard framework (14).

## 4. What to Implement

1. `BuyerRequestsPage` — status tabs (All / Drafts / Open / Awarded / Completed / Cancelled+Closed) with counts; list as responsive cards (title, StatusChip, category chip, budget display, deadline w/ relative + overdue tone, proposalsCount with "n new" accent, created date, kebab menu); toolbar: SearchInput + SortSelect (Newest, Deadline, Most proposals); pagination; EmptyStates per tab (drafts tab links wizard resume; open tab "Post your first request" CTA); actions: Edit draft (→ wizard `?draft=`), Publish draft (validate completeness via service, confirm), Close (open→closed, confirm + reason optional), Cancel (confirm `requireReason`), Delete draft (confirm). All via `requestService` methods (add `publishDraft`, `closeRequest`, `cancelRequest` with transitions + notifications to proposers on close/cancel).
2. `BuyerRequestDetailPage` — header (title, StatusChip, meta, actions per state); tabs: **Details** (full brief rendered: specs grid via KeyValueList, usage rights, guidelines, dos/don'ts, reference images strip w/ lightbox), **Proposals (n)**, **Activity** (timeline from request events — derive: created/published/proposals received count summary/awarded/closed; simple derived list).
3. **Proposals tab** — proposal cards: creator summary (UserAvatar, name → public profile link (new tab icon), rating, completed orders), price (prominent), delivery days, revisions included, cover message (3-line clamp → expand), sample thumbnails (from sampleItemIds, lightbox), status chip (submitted/shortlisted/declined/withdrawn), actions: Shortlist toggle (star), View details (SideSheet: full message, samples gallery, creator mini-profile with link, stats), Decline (confirm + optional reason → status + notify creator), **Accept** (primary; on shortlisted/submitted). Sort proposals: Shortlisted first / Price / Rating / Delivery. Filter chips: All / Shortlisted.
4. **Compare mode** — "Compare" toggle → checkboxes on cards (2–3 selectable) → sticky "Compare (n)" bar → `ResponsiveDialog` full-width: side-by-side columns (mobile: horizontal snap-scroll columns) comparing price, delivery, revisions, rating, completed orders, response time, sample strip, message excerpt; per-column Accept/Shortlist actions.
5. **Accept flow** — confirm dialog explaining escrow ("You'll fund $X now; BetterBlue holds it until you approve the final content. Other proposals will be declined."); on confirm → `acceptProposal` → success toast → navigate `buyerCheckout(orderId)` (stub `CheckoutStubPage` this prompt: DashboardPage with order summary card via `orderService.getWithRelations` + info alert "Secure payment arrives in the next release step" — marked `// TEMP: replaced in Prompt 19`); request moves to `awarded` everywhere; declined proposers notified (17 handles).
6. Normalize Prompt-16 TODOs: wizard success → `buyerRequestDetail(id)`; Overview stat links → requests tabs; navConfig append "My Requests" (badge: open requests with new proposals — simple count via service; acceptable approximation documented).
7. Register routes: `BUYER_REQUESTS`, `buyerRequestDetail`, `buyerCheckout` (stub).

## 5. Functional Requirements

Tab counts accurate; state-dependent action availability (edit only drafts; close only open; accept only on open request's active proposals); accept idempotence guard (already-awarded request hides accept, service double-guards); all mutations toast + refetch; deep links work.

## 6. UI/UX Requirements

List pattern per 00 §12; proposal cards scannable (price + rating visual hierarchy); compare feels premium (aligned rows, highlight best price/delivery subtly); mobile: cards, sheet details, snap compare; StickyActionBar for compare trigger.

## 7. Technical Requirements

New service methods in requestService only; page components consume hooks; compare selection state feature-local; no status literals.

## 8. API Requirements

Per contract; proposals filtered `?requestId=`; sample items batch-fetched via portfolioService (service-side).

## 9. Data Requirements

Seeds: demo buyer has ≥ 1 open request with 3–4 varied proposals (incl. shortlisted) + drafts + awarded/completed examples (verify; extend seeds if gaps, reseed, report).

## 10. Files & Folders

Creates: `src/features/requests/pages/{BuyerRequestsPage,BuyerRequestDetailPage}.jsx`, `src/features/proposals/components/{ProposalCard,ProposalDetailSheet,CompareBar,CompareDialog,DeclineDialog,AcceptConfirmDialog}.jsx`, `src/features/checkout/pages/CheckoutStubPage.jsx` (TEMP), requestService additions. Updates: buyerRoutes, navConfig, wizard/Overview link normalization.

## 11. Responsive Requirements

360px: card lists, sheet detail, snap-scroll compare columns (min-width 280px each), sticky compare bar above bottom nav; desktop: comfortable 2-col proposal grid in tab.

## 12. Accessibility Requirements

Tabs keyboard/ARIA per MUI; kebab menus labeled; compare checkboxes labeled per creator; dialogs trap focus; decline/accept confirms read consequences; proposal card headings hierarchy.

## 13. Validation & Error Handling

Accept failure (state conflict e.g. stale tab) → specific toast + refetch; publish-draft validation lists missing fields; all lists have loading/empty/error+retry.

## 14. Acceptance Criteria

- Demo buyer: full journey — review proposals, shortlist, compare 3, decline one (with reason), accept one → lands on checkout stub with correct order summary; request `awarded`; other proposals `declined`; notifications written.
- Draft publish/close/cancel flows work with guards; tab counts match db.
- Lint + build clean.

## 15. Verification Steps

1. Reseed → demo-buyer journey above; verify db side-effects (order pending_payment, proposal statuses, notifications).
2. Stale-state test: accept same proposal from a second tab → friendly conflict handling.
3. 360px pass (cards, sheet, compare snap); keyboard pass on compare + dialogs.
4. `npm run lint && npm run build`.

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

`acceptProposal` semantics (17), wizard internals beyond navigation TODOs, `prompts/`.

## 18. Depends On

14, 15, 16, 17 (04/07 foundations).

## 19. Final Checklist

- [ ] Requests list with tabs/counts/actions + detail with 3 tabs
- [ ] Proposal review: cards, sheet, shortlist, decline, compare (2–3), accept → checkout stub
- [ ] 16's navigation TODOs normalized; navConfig/routes appended
- [ ] Seeds provide full demo journey; a11y + mobile verified
- [ ] Lint + build clean; report written
