# Prompt 33 — Admin Dispute Resolution

> **Before you start:** Read `prompts/00-architecture-and-rules.md` (DISPUTE machine §9), `docs/payments.md`, then inspect Prompts 01–32 output (party dispute system from 26; escrow ops from 17/32).

## 1. Objective

Build the admin dispute workspace: triage queue with assignment, full-context resolution workspace (thread participation, internal notes, party info requests, escalation), and binding resolution execution (release / full refund / partial refund) wired through the payment layer with complete audit trail.

## 2. Context

This completes the dispute lifecycle from 26. Resolution is the one place admins move held money by policy: outcomes map to order/payment transitions per machines (disputed → completed|refunded|cancelled). Permission: `disputes.resolve`.

## 3. What Already Exists

Party dispute UI + thread + `postMessage` w/ internal support (26), notifyAdmins (26), DISPUTE machine + DISPUTE_RESOLUTION (03), releasePayment/refundPayment (17), admin kit (28), order admin detail (31), escrow monitor (32), seeded disputes incl. escalated + resolved exemplars (05).

## 4. What to Implement

1. **Service workflow** (`disputeService` admin extensions): `assign(disputeId, { adminId })` — sets assignedAdminId, `open → under_review`, audit; `requestInfo(disputeId, { from: 'buyer'|'creator', message, actor })` — posts public message + status → `awaiting_buyer|awaiting_creator`, notify that party (`dispute_message` w/ action-needed flavor); `escalate(disputeId, { note, actor })` — → `escalated` + internal note + notifyAdmins; `resolve(disputeId, { outcome (DISPUTE_RESOLUTION), amountRefunded?, note, actor })` — guards: assigned or escalated state ∈ resolvable, note required; **execution mapping**: `release_payment` → releasePayment(order, actor admin) + order `disputed→completed`; `full_refund` → refundPayment full + order `disputed→refunded`; `partial_refund` → refundPayment partial (amount validated 0<x<held) + order `disputed→completed` (partial keeps engagement — per 17's partial policy; document); writes `resolution {}` on dispute → `resolved`; notify both parties (`dispute_resolved` w/ outcome summary); audit `dispute.resolve` w/ full meta; `close(disputeId)` — `resolved → closed` (manual or noted-as-future-auto after N days).
2. `AdminDisputesPage` (`/admin/disputes`) — queue tabs: Unassigned (open) / Mine (assigned to me, active) / Awaiting parties / Escalated / Resolved+Closed, with counts; rows/cards: dispute id short, order EntityRefChip (+ amount held), parties (avatars pair), category chip, StatusChip, AgeBadge (SLA tone), assignee avatar, last activity; filters (category/date), search; sort oldest-first default; "Assign to me" quick action on unassigned rows.
3. `AdminDisputeDetailPage` (`/admin/disputes/:id`) — workspace layout (desktop: main thread + right context rail; mobile stacked):
   - **Context rail** — order money card (price, commission preview, payment held status + link to 31 order detail), parties cards (user bundles: prior disputes count, orders count — links to 29), category + description + evidence grid (26 components reused), dispute TimelineList (from history/audit), prior-disputes-between-parties note when > 0.
   - **Thread** — 26's thread components in admin mode: internal notes **visible** with "Internal" chip + amber tint; composer with mode toggle (Reply to parties / Internal note — distinct styling + explicit send labels), attachments.
   - **Action bar** (sticky) — state-aware: Assign to me / Request info (dialog: target party + message) / Escalate (dialog: internal note) / **Resolve** (primary).
4. `ResolveDialog` — structured decision flow: outcome radio cards (Release payment to creator / Refund buyer in full / Partial refund) each with consequence copy + money preview (release: creator receives $net; full refund: buyer receives $X, creator $0; partial: amount slider+CurrencyField with live split preview "Buyer $A · Creator $B (after commission on retained $C)" via computeCommission — reuse 17's partial math, no local math); resolution note (30–1000, becomes party-visible summary); final confirm step restating outcome ("This is binding and executes immediately"); execute → success state + thread system-message appended ("BetterBlue resolved this dispute: …") — implement as a real message from actor with resolution summary.
5. **Cross-surface completion** — party dispute detail (26) shows resolution card correctly for newly resolved (verify live); order surfaces (20/24/31) reflect final order status + payment; 32's escrow disputed-chips now link here; 28 Overview dispute cards/attention links resolve; navConfig enable Disputes.
6. **Queue hygiene** — resolved tab shows outcome chips; closed via Close action (confirm) from resolved.

## 5. Functional Requirements

Full lifecycle on seeds: assign → request info (party sees action-needed 26) → party replies (status back to under_review per 26) → resolve each outcome type on three different seeded disputes → verify ledgers (17 semantics), order statuses, both parties' notifications + resolution cards, audit meta completeness; escalation notifies admins; unresolvable states hide Resolve.

## 6. UI/UX Requirements

Judicial calm: neutral palette, explicit consequence copy, two-step confirm on resolve; internal vs public composer modes unmistakable (color + label + icon); money previews exact.

## 7. Technical Requirements

Resolution execution exclusively via paymentService (grep: no money writes here); machine guards on every transition; thread components shared with 26 (admin-mode props, no fork).

## 8. API Requirements

Composite ops documented (assign/requestInfo/escalate/resolve/close) with Laravel transactional + authorization warnings.

## 9. Data Requirements

Seeds: ≥ 1 dispute per resolvable path ready (held payments present), unassigned + escalated examples (verify; extend + reseed + report).

## 10. Files & Folders

Creates: `src/features/admin/disputes/pages/{AdminDisputesPage,AdminDisputeDetailPage}.jsx`, `src/features/admin/disputes/components/{DisputeQueueRow,ContextRail,AdminThreadComposer,RequestInfoDialog,EscalateDialog,ResolveDialog,OutcomePreview}.jsx`, disputeService admin extensions. Updates: adminRoutes, navConfig, 28/32 link gates, contract doc.

## 11. Responsive Requirements

Workspace stacks mobile (rail collapses to accordion above thread); resolve dialog full-screen mobile with sticky confirm; queue cards 360px.

## 12. Accessibility Requirements

Composer mode toggle announced ("Internal note mode"); resolve flow stepwise focus + consequence text read; internal chips text-labeled; money previews as text; thread log semantics per 26.

## 13. Validation & Error Handling

Partial bounds + note requirements; resolve on stale/concurrent state → conflict + refetch; payment-layer failure mid-resolution surfaces loudly with inconsistency guidance (mock caveat per 17 §13).

## 14. Acceptance Criteria

- Three outcome paths executed and verified end-to-end (ledger, order, dispute, parties' UI, notifications, audit).
- Request-info ping-pong works cross-role; escalate notifies; internal notes never leak to parties (26 filter re-verified post-integration).
- Queue tabs/counts/assignment correct; permission gating proven; lint + build clean.

## 15. Verification Steps

1. Reseed → full lifecycle per §5 with db inspection at every step (3 outcome runs).
2. Cross-role: party experiences (26) checked after each admin action.
3. Leak test internal notes as buyer/creator; 360px workspace pass.
4. `npm run lint && npm run build`.

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

Payment semantics (17), party dispute UX (26 — admin-mode props only), machines, `prompts/`.

## 18. Depends On

26 (party system), 17 (money), 28 (kit), 31/32 (links), 29 (party bundles).

## 19. Final Checklist

- [ ] Queue (tabs/assignment/SLA) + workspace (rail/thread/actions)
- [ ] Request-info/escalate/resolve(3 outcomes)/close with full execution + audit
- [ ] Money previews via computeCommission; no local money math
- [ ] Cross-surface + leak verifications pass; lint + build clean
- [ ] Report written
