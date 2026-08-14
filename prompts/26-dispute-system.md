# Prompt 26 — Dispute System (Buyer & Creator)

> **Before you start:** Read `prompts/00-architecture-and-rules.md` (DISPUTE machine §9), then inspect Prompts 01–25 output (order details 20/24 contain marked DISPUTE-SLOTs).

## 1. Objective

Build the party-facing dispute system: raising disputes from eligible orders (category, description, evidence), the dispute detail thread (messages + attachments, status-aware), dispute lists in both dashboards, and all service workflow — admin resolution arrives in Prompt 33.

## 2. Context

Disputes freeze the order (`disputed`) while payment stays `held`. Both parties + admins converse on a thread; `internal: true` messages are admin-only (client filters them for parties AND the Laravel note documents server-side enforcement). Resolution outcomes (release/full/partial refund) are executed by admins later — party UI must render seeded resolved examples correctly now.

## 3. What Already Exists

DISPUTE_STATUS/CATEGORY machines + meta (03), disputeService baseline (07), uploadService, TimelineList/SideSheet/ResponsiveDialog (04), order surfaces with slots (20/24), seeded disputes across statuses incl. resolved + internal notes (05).

## 4. What to Implement

1. **Service workflow** (`disputeService` extensions): `createDispute(orderId, { raisedById, category, description, evidenceFiles })` — guards: order ∈ `in_progress|delivered|revision_requested|completed` (completed within X days? keep simple: allow completed ≤ 14 days; document), no existing open dispute on order, actor is party; uploads evidence; creates dispute `open` (againstId = other party); order → `disputed` (assertTransition; from completed too — machine allows? **Machine (03) lacks completed→disputed: follow the machine — restrict to active states only and drop the completed-window idea; report this simplification**); notify other party + create admin notification (notify all admins with `disputes.resolve` permission — helper `notifyAdmins(permission, payload)` added to notificationService); audit `dispute.open`. `postMessage(disputeId, { authorId, body, attachments })` — guards dispute not closed; party messages set status ping-pong: if status `awaiting_buyer` and buyer posts → `under_review` (same for creator); notify other party + assigned admin. `listForUser(userId)` with role-aware query.
2. `DisputesListPage` — **shared feature component** mounted at both `/buyer/disputes` and `/creator/disputes` (role from auth): tabs Open (open/under_review/awaiting_*/escalated) / Resolved / Closed; cards: order title + link, other party, category chip, StatusChip, "Action needed" accent when awaiting-you, last-activity relative time, unread-ish indicator (last message not yours); EmptyState ("No disputes — hopefully it stays that way") ; search.
3. `DisputeDetailPage` (shared; `/buyer/disputes/:id`, `/creator/disputes/:id`) — header: category label, StatusChip, order summary card (title, price, current order status, link); **status banner** state-aware ("Awaiting your response" warning tone / "Our team is reviewing" info / resolved summary); **resolution card** when resolved: outcome label (release/full refund/partial with amounts from resolution object), note, date — rendered from seeded examples; **thread**: chronological messages (author avatar+name+role chip (BetterBlue Support for admins), body, attachments as file chips → lightbox/download, relative time; own messages right-aligned accent; internal messages **never rendered** for parties — filter in service `listMessages(disputeId, { viewerRole })`); composer (multiline + attach ≤ 3 + send; disabled with explainer on resolved/closed); evidence section (initial evidence files grid).
4. **Raise-dispute entry** — fill the 20/24 slots: order detail actions menu "Report an issue" (eligible states only) → `RaiseDisputeDialog`: category select (DISPUTE_CATEGORY with descriptions), description (60–2000, guidance "Describe what doesn't match the order terms…"), evidence upload (≤ 5 files), consequence note ("This pauses the order while our team reviews — most issues resolve within a few days"), submit → navigate to dispute detail + toast.
5. **Order-surface integration** — disputed orders: banner on order detail (both roles) "This order is under dispute — view dispute" link; order actions locked while disputed (accept/revise/deliver hidden — verify 20/24 states handle `disputed`).
6. navConfig append both roles: Disputes (badge: awaiting-you count); routes registered.

## 5. Functional Requirements

Create → order disputed + notifications (party + admins) + audit; thread round-trip between demo buyer/creator works with status ping-pong; internal seeded messages invisible to parties (verify against seeds); resolved seeded dispute renders outcome correctly; composer disabled post-resolution; eligibility guards exact.

## 6. UI/UX Requirements

Calm, procedural-justice tone (never alarming): neutral colors + clear process copy; thread readable (max-width bubbles, dates grouped); mobile: full-height thread with sticky composer above bottom nav.

## 7. Technical Requirements

Shared pages parameterized by role (no duplicated buyer/creator code — single feature module); message filtering service-side; all transitions via machine; notifyAdmins helper reusable (33 uses it too).

## 8. API Requirements

Composite ops documented (createDispute, postMessage w/ status effects); internal-message enforcement noted as Laravel server-side requirement.

## 9. Data Requirements

Seeds provide: awaiting_buyer + awaiting_creator examples (badge/banner demo), escalated, resolved (each outcome type at least once), internal notes present (verify; extend + reseed + report).

## 10. Files & Folders

Creates: `src/features/disputes/pages/{DisputesListPage,DisputeDetailPage}.jsx`, `src/features/disputes/components/{DisputeCard,DisputeStatusBanner,ResolutionCard,DisputeThread,MessageBubble,MessageComposer,RaiseDisputeDialog,EvidenceGrid}.jsx`, disputeService extensions + notifyAdmins. Updates: 20/24 slots + disputed-state locks, buyer/creator routes, navConfig, contract doc.

## 11. Responsive Requirements

360px: thread full-height, sticky composer, attachment chips wrap; desktop: two-column (thread + meta sidebar) ≥ lg.

## 12. Accessibility Requirements

Thread as log (`role="log"` aria-live polite for new messages), messages labeled by author; banner `role="status"`; dialog labeled; attachments accessible names; composer disabled state explained in text.

## 13. Validation & Error Handling

Description length; ineligible order → action hidden + service double-guard; send failure keeps draft; upload errors per-file; list/detail loading/empty/error.

## 14. Acceptance Criteria

- Cross-role loop: buyer raises on delivered order → order disputed + locked, creator notified, creator replies → buyer badge/status updates → both see thread; internal seeded notes hidden; resolved rendering correct.
- Eligibility matrix verified (pending_payment/cancelled/completed → no action; active states → action).
- Lint + build clean.

## 15. Verification Steps

1. Reseed → full cross-role loop with db inspection (dispute, order status, notifications incl. admins, audit).
2. Seeded-state gallery: open each seeded dispute status as both roles (banners/badges).
3. Internal-note leak check as both parties; 360px thread + keyboard pass.
4. `npm run lint && npm run build`.

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

Dispute machine (03 — restrict eligibility to it), payment semantics (resolution execution is Prompt 33), order flows beyond disputed-locks, `prompts/`.

## 18. Depends On

20, 24 (slots + order states), 17 (held context), 04/07/14.

## 19. Final Checklist

- [ ] createDispute/postMessage with guards, machine, notifications (incl. notifyAdmins), audit
- [ ] Shared list + detail (banner/resolution/thread/composer) for both roles
- [ ] Order-surface integration + locks; internal messages filtered
- [ ] Seeded status gallery verified; lint + build clean
- [ ] Report written
