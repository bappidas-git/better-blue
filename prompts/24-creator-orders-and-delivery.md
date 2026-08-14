# Prompt 24 — Creator Orders & Delivery Workspace

> **Before you start:** Read `prompts/00-architecture-and-rules.md` (state machines §9), then inspect Prompts 01–23 output (especially 20's buyer order surfaces and shared timeline/delivery components).

## 1. Objective

Build the creator's order fulfillment experience: orders list, order workspace (brief, timeline, earnings), deliverable composer (mock uploads, versioned submissions), and revision handling — completing the two-sided order loop.

## 2. Context

Creator submits deliveries → buyer reviews (20). `submitDelivery` also enters the delivery-moderation pipeline per platform policy (`autoApproveDeliveries` default true → spot-review only; Prompt 30 consumes). Reuse 20's components wherever sensible (timeline, file grids, version display) — extract shared pieces rather than duplicating.

## 3. What Already Exists

Buyer order detail + DeliverySection/FileGridItem/version components (20), `getOrderTimeline` (20), deliveryService/revisionService (07/20), uploadService (07), order stub possibly from 23, seeded active creator orders (05).

## 4. What to Implement

1. **Service workflow** — `deliveryService.submitDelivery(orderId, { message, files, revisionId? })` (extend): guards order `in_progress|revision_requested` + actor is order creator; version = priorCount+1; uploads via uploadService; creates delivery `submitted`; order → `delivered` (assertTransition; deliveredAt updated); links revisionId when answering a revision (marks revision resolvedAt); **moderation entry**: creates moderationReviews record (subjectType `delivery`; status per settings.moderation.autoApproveDeliveries: true → `approved` with system history note, false → `submitted`); notify buyer (`delivery_submitted`); returns bundle.
2. **Shared extraction** — generalize 20's delivery-version display + file grid into `src/features/deliveries/components/` (DeliveryVersionList, DeliveryFilesGrid) consumed by both buyer (refactor 20 minimally) and creator surfaces.
3. `CreatorOrdersPage` (`/creator/orders`) — tabs: Active (in_progress + revision_requested with accent) / Delivered (awaiting buyer) / Completed / Cancelled+Refunded / Disputed; cards: title, buyer (company), StatusChip, **earnings** (net after commission, prominent) + gross subline, due date relative w/ overdue tone, per-status action hint ("Revision requested — respond" / "Submit delivery"); search+sort; badges.
4. `CreatorOrderDetailPage` (`/creator/orders/:id`, replaces any stub) — header (title, StatusChip, due countdown chip — overdue error tone, buyer card); sections/tabs:
   - **Brief** — `RequestBriefView` (23's shared component) + fulfillment checklist rendered from specs (quantity/type/orientation/usage rights as check-annotated list — informational).
   - **Delivery** — the workspace: when `in_progress`/`revision_requested`: `DeliveryComposer` card — message to buyer (20–600), files (FormFileField multi ≤ 10, images/videos ≤ 100MB each mock, previews grid w/ per-file remove; upload on submit w/ per-file progress), revision context banner when answering revision (buyer's notes quoted), Submit delivery button (confirm dialog: "Buyer will be notified and review your work — make sure it matches the brief") → service → success + status change; when `delivered`: waiting state (submitted version summary + "Buyer review by {auto-accept date}"); version history via shared DeliveryVersionList (all versions + buyer responses/revision notes inline).
   - **Timeline** — shared TimelineList via getOrderTimeline.
   - **Earnings** — card: gross, commission ({rate}% = $X), **net to you $Y**, escrow state (held → released on acceptance; released shows releasedAt + link to earnings page TODO until 25).
5. **Revision flow** — revision_requested state surfaces buyer notes prominently (banner + Delivery tab context); respond = new delivery version linked to revision; revisions counter ("Revision 1 of 2 used") mirrors buyer view.
6. **Overdue handling** — overdue orders flagged in list/detail (error-toned chip "Due 2 days ago"); informational only (no auto-penalty; documented).
7. navConfig append: Orders (badge: revision_requested + in_progress-due-soon count — keep simple: active count); resolve 21/23 TODO links; routes registered (replace 23's stub if present).

## 5. Functional Requirements

Submit delivery updates order/delivery/moderation/notifications correctly (db-verified); buyer instantly sees v-next (20); revision answering links records + resolves revision; guards prevent submitting on wrong states (completed/disputed → composer absent); earnings math matches order snapshot fields.

## 6. UI/UX Requirements

Workspace feel: brief always at hand, composer focused, sticky submit on mobile; upload progress per file (mock latency visible); countdown chips; celebratory-but-restrained submit success; premium consistency with buyer views.

## 7. Technical Requirements

All transitions service-side; shared components extracted with zero buyer-behavior change; no duplicated file-grid/version code (grep check); composer state feature-local hook `useDeliveryComposer`.

## 8. API Requirements

Composite `submitDelivery` per contract (update table if needed); moderation-entry behavior documented in contract + payments/moderation docs cross-ref.

## 9. Data Requirements

Seeds: creator demo has in_progress order (fresh), revision_requested order (with buyer notes + v1), delivered order (waiting) (verify; extend + reseed + report).

## 10. Files & Folders

Creates: `src/features/orders/pages/{CreatorOrdersPage,CreatorOrderDetailPage}.jsx`, `src/features/deliveries/components/{DeliveryComposer,DeliveryVersionList (extracted),DeliveryFilesGrid (extracted),RevisionContextBanner,EarningsCard,FulfillmentChecklist}.jsx`, `src/features/deliveries/hooks/useDeliveryComposer.js`, service extensions. Updates: 20's buyer components to consume extractions (minimal diff), creatorRoutes, navConfig, TODOs from 21/23.

## 11. Responsive Requirements

360px: stacked workspace, sticky submit, 2-col file previews; desktop: brief/meta side column ≥ lg; countdown chips wrap safely.

## 12. Accessibility Requirements

Composer labeled inputs + per-file remove labels; progress announced (`aria-live` polite on upload status); revision banner `role="status"`; confirm dialogs consequence copy; checklist semantic list.

## 13. Validation & Error Handling

Message/file rules; per-file upload failure inline retry/remove without losing others; submit conflict (buyer disputed meanwhile) → refetch toast; empty-file submit blocked.

## 14. Acceptance Criteria

- Cross-role loop closes on seeds: creator submits v1 → buyer requests revision (20) → creator sees notes, submits v2 → buyer accepts → creator sees completed + released earnings state.
- Moderation records written per settings flag (verify both flag values by temporary settings edit + reseed).
- Shared extractions leave buyer views pixel-behavior identical; badges/TODOs resolved.
- Lint + build clean.

## 15. Verification Steps

1. Reseed → full two-sided loop (switch demo accounts) with db inspection each step.
2. Settings flag flip test for delivery moderation entries (then reseed).
3. Upload edge cases (oversize, wrong type, partial failure); 360px + keyboard composer pass.
4. `npm run lint && npm run build`.

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

Buyer review actions/semantics (20), acceptDelivery/releasePayment chain (17/20), state machines, `prompts/`.

## 18. Depends On

20 (components + buyer loop), 23 (brief view, stub), 17 (earnings), 22 (moderation pattern context).

## 19. Final Checklist

- [ ] Orders list + workspace detail (brief/delivery/timeline/earnings)
- [ ] Composer with versioning, revision answering, moderation entry, notifications
- [ ] Shared delivery components extracted; buyer views unaffected
- [ ] Two-sided loop verified end-to-end; lint + build clean
- [ ] Report written
