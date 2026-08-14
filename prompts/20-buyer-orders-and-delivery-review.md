# Prompt 20 — Buyer Orders, Delivery Review & Creator Reviews

> **Before you start:** Read `prompts/00-architecture-and-rules.md` (state machines §9), then inspect Prompts 01–19 output.

## 1. Objective

Build the buyer order experience: orders list, rich order detail with timeline, deliverable review (view files, request revisions within limits, accept), acceptance → payment release chain, and post-completion creator reviews.

## 2. Context

Closes the buyer's core loop. Acceptance triggers `deliveryService.acceptDelivery` → `orderService.completeOrder` → `paymentService.releasePayment` (17). Revisions are bounded by `revisionsIncluded`. Seeds provide orders in every state for immediate testing; creator-side delivery UI arrives in Prompt 24.

## 3. What Already Exists

Payment chain (17/19), `orderService.getWithRelations`, delivery/revision services baseline (07), TimelineList/MediaLightbox/StatusChip/ConfirmDialog (04), order-detail stub possibly from 19.

## 4. What to Implement

1. **Service workflow methods** (extend; per contract composite table): `deliveryService.acceptDelivery(deliveryId, { actorId })` — guards delivery `submitted` + order `delivered`; delivery → `accepted`, calls `orderService.completeOrder(orderId)` (order → `completed`, completedAt) which calls `paymentService.releasePayment`; notify creator (`delivery_accepted`, `order_completed`); returns updated bundle. `revisionService.requestRevision(deliveryId, { notes, actorId })` — guards order `delivered` + `revisionsUsed < revisionsIncluded`; creates revision record, delivery → `revision_requested`, order → `revision_requested`, increments revisionsUsed, notify creator. `orderService.getOrderTimeline(orderId)` — composes chronological events from order/payments/deliveries/revisions/disputes (type, title, description, at, tone) — single source for buyer/creator/admin timelines.
2. `BuyerOrdersPage` (`/buyer/orders`, replaces any stub) — tabs: Active (pending_payment + in_progress + delivered + revision_requested) / Completed / Cancelled+Refunded / Disputed, with counts; order cards: title, creator (avatar+name), StatusChip, price, due date (relative, overdue tone), progress hint line per status ("Awaiting your review" accent when delivered), unpaid orders show "Complete payment" CTA (→ checkout); search + sort (Newest/Due soonest/Price); pagination.
3. `BuyerOrderDetailPage` (`/buyer/orders/:id`, replaces stub) — header: title, StatusChip, order id copy button, creator card (link to profile), actions per state; layout tabs or sections: **Overview** (brief summary from request snapshot: specs KeyValueList, usage rights, budget→price, revisions used "1 of 2"), **Deliverables**, **Timeline** (TimelineList from service), **Payment** (payment status card, breakdown, receipt link to payments page).
4. **Deliverables section** — delivery versions newest-first: version header (v2 · date · StatusChip), creator message, files grid (thumbnail cards: image preview / video poster+play; click → MediaLightbox with download link (mock URL); file name/type/size caption); when order `delivered`: prominent review action card — "Review delivery: Accept content / Request changes (n left)". Accept → confirm dialog (consequence copy: releases $X to creator, completes order; irreversible) → chain → success state (celebratory but restrained; prompts review — see 6). Request changes → `ResponsiveDialog` form (notes 30–1000 required, references what's wrong professionally; shows revisions remaining; disabled + explainer when exhausted: "Revision limit reached — contact the creator via a dispute if the delivery doesn't match the brief") → service → toast + status updates. When `revision_requested`: waiting card showing your notes. When completed: static accepted summary.
5. **Auto-accept messaging** — info row on delivered state: "Auto-accepts on {date}" computed from settings.autoAcceptDays after deliveredAt (display only — no timer job; documented as Laravel scheduled job later).
6. **Review flow** (`src/features/reviews/`) — after completion (post-accept success state + banner on completed orders without a review): `ReviewDialog` — RatingStars input (required), comment (20–600, professional placeholder), submit via `reviewService.submitReview(orderId, …)` (extend: guards one-per-order + only completed + buyer-owned; writes review; recomputes + PATCHes creator aggregates ratingAvg/ratingCount — documented mock-side aggregation); success toast; completed order card/detail then shows your review (stars + comment, read-only).
7. **Dispute affordance placeholder** — actions menu includes "Report an issue" only when Prompt 26 has landed; this prompt: leave a marked slot (`// DISPUTE-SLOT (Prompt 26)`) — no dead button.
8. navConfig: Orders (badge: orders awaiting review count); Overview (15) stat links normalized; routes registered.

## 5. Functional Requirements

Acceptance chain updates order/payment/transactions/notifications correctly (verify vs 17 smoke expectations); revision limits enforced UI+service; timeline shows real composed events chronologically; review one-per-order enforced; aggregates update creator profile (visible on public profile 13).

## 6. UI/UX Requirements

Order detail = the workspace feel: clear state banner ("Delivered — review within 5 days"), scannable sections, mobile StickyActionBar for the primary review actions; lightbox for media; premium restraint throughout.

## 7. Technical Requirements

All transitions in services with `assertTransition`; timeline composition service-side; review aggregation service-side; components dumb.

## 8. API Requirements

Per contract composite ops (acceptDelivery, requestRevision, submitReview added to contract table if missing — update doc).

## 9. Data Requirements

Seeds cover: delivered order awaiting review (with 2 files incl. 1 video), revision_requested order, completed order without review, completed with review, unpaid order (verify; extend seeds + reseed + report if gaps).

## 10. Files & Folders

Creates: `src/features/orders/pages/{BuyerOrdersPage,BuyerOrderDetailPage}.jsx`, `src/features/orders/components/{OrderCard,OrderStateBanner,DeliverySection,DeliveryVersion,FileGridItem,ReviewActionsCard,RequestRevisionDialog,AcceptDeliveryDialog,PaymentSummaryCard}.jsx`, `src/features/reviews/components/{ReviewDialog,ReviewDisplay}.jsx`, service extensions (delivery/revision/order/review). Updates: buyerRoutes (replace stubs), navConfig, 19 banner links, contract doc.

## 11. Responsive Requirements

360px: card tabs scroll, detail sections stack, files 2-col grid, sticky review actions; desktop: two-column detail (main + side meta) ≥ lg.

## 12. Accessibility Requirements

State banner `role="status"`; files keyboard-openable with names; dialogs trap focus + consequence copy read by SR; rating input keyboard; revision counter announced; timeline semantic list.

## 13. Validation & Error Handling

Revision notes length; accept on stale state → conflict toast + refetch; media load failure → placeholder tile with filename; all lists/details loading/empty/error.

## 14. Acceptance Criteria

- Full loop on seeds: delivered order → request revision (limit decrements) → (simulate creator redelivery by db edit or seeded v2) → accept → order completed + payment released + creator notified → review submitted → public profile aggregate changed.
- Exhausted-revisions state correct; auto-accept date shown; unpaid CTA works; timeline accurate.
- Lint + build clean.

## 15. Verification Steps

1. Reseed → walk §14 loop verifying db side-effects at each step.
2. Edge tests: second review attempt blocked; revision at limit; stale accept from second tab.
3. 360px + keyboard pass (review actions, dialogs, lightbox).
4. `npm run lint && npm run build`.

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

releasePayment internals (17), checkout (19), state machines, `prompts/`.

## 18. Depends On

17, 19 (04/07/14 foundations; 13 for aggregate visibility).

## 19. Final Checklist

- [ ] Orders list + detail with Overview/Deliverables/Timeline/Payment
- [ ] Accept chain + revision flow with limits; auto-accept messaging
- [ ] Review system end-to-end incl. aggregates on public profile
- [ ] Dispute slot marked for 26; navConfig/routes/badges done
- [ ] Lint + build clean; report written
