# Prompt 32 — Admin Finance: Payments, Settlements & Commissions

> **Before you start:** Read `prompts/00-architecture-and-rules.md`, `docs/payments.md`, then inspect Prompts 01–31 output (paymentService ledger from 17; creator payout requests from 25).

## 1. Objective

Build the admin finance suite: platform transaction ledger, escrow monitor (held payments with aging), refund oversight, creator settlement processing (payout queue → processing → paid/rejected), and commission records with period summaries.

## 2. Context

Money truth lives in the 17 ledger; this prompt surfaces and operates it. Settlements complete the payout lifecycle started in 25 (creator sees status changes + notifications). Permissions: `payments.manage`, `settlements.process`.

## 3. What Already Exists

paymentService (+ transactions, refunds, payout records) (17/25), PAYOUT machine (03), exportCsv (03), admin kit (28), seeded finance spread (05), `payout_processed` type reserved? (03 has `affiliate_payout` + payout events — verify `payout_processed` exists in 03's list; it does).

## 4. What to Implement

1. **Service** (`paymentService` admin extensions): `adminListTransactions(params)` (type/date/user filters + search by order id); `getEscrowOverview()` — held payments w/ order+parties+heldAt+age, totals `{ heldTotal, heldCount, agingBuckets }`; `getFinanceSummary(period)` — `{ chargeVolume, released, refunded, commissionRevenue, payoutsPaid }` by month; `processPayout(payoutId, { action: 'approve'|'reject', reason?, actor })` — machine transitions: approve → `processing` (processedAt path starts) then **explicit second step** `markPayoutPaid(payoutId)` → `paid` + transaction `payout` (creator, −amount from available; per 25's accounting) + notify creator (`payout_processed`) ; reject → `rejected` + reason + notify; all audited (`payout.approve|payout.paid|payout.reject`); `adminRefundOrder(orderId, { amount?, reason, actor })` thin wrapper over refundPayment for finance-context use (full/partial; audit `payment.refund`).
2. `AdminPaymentsPage` (`/admin/payments`) — tabs:
   - **Overview** — StatCardGrid (This month: charge volume, commission revenue, refunded, payouts paid) + ThemedBarChart revenue by month + escrow snapshot card (held total/count → Escrow tab).
   - **Escrow** — held payments DataTable: order EntityRefChip, buyer/creator, amount, heldAt + AgeBadge (aging buckets legend), linked dispute chip when disputed (→ P33 gated); row actions: View order (31), Refund (dialog: full/partial amount input ≤ held, mandatory reason, strong confirm; via adminRefundOrder) — annotated "Prefer dispute resolution for contested orders".
   - **Transactions** — full ledger DataTable (date, type chip, description, order ref, user, signed amount, running period totals footer); filters type/date/search; CSV export; pagination.
3. `AdminSettlementsPage` (`/admin/settlements`) — queue tabs: Requested / Processing / Completed / Rejected; rows: creator EntityRefChip (+ payout method masked from profile), amount, requested AgeBadge, status; actions: Requested → Approve (confirm; → processing) / Reject (dialog reason → notify); Processing → Mark paid (confirm "Funds transferred outside BetterBlue" — mock honesty; → paid + ledger + notify); batch selection for Approve (checkbox rows + bulk bar; sequential processing w/ progress + per-item failure report); summary cards (pending total, processed this month); export.
4. `AdminCommissionsPage` (`/admin/commissions`) — commissions DataTable (order ref, date, base amount, rate chip, commission amount); period filter (month select) + summary cards (period commission total, avg rate, orders count); rate-config pointer card ("Rates configured in Platform Settings" → P35 gated link); export.
5. navConfig: enable Payments/Settlements/Commissions (28 gates); Overview pendingSettlements card links resolve; 25's creator payout statuses now progress end-to-end.

## 5. Functional Requirements

Escrow list = exactly held payments; aging correct; refund from escrow tab updates ledger/order/notifications per 17 semantics; settlement full cycle (request 25 → approve → paid) updates creator's Payouts tab + available math + notification; commission summaries reconcile with seeded commissions; every action audited.

## 6. UI/UX Requirements

Financial clarity (tabular numerals, totals footers, signed coloring per 25 conventions); queue discipline (oldest first default); batch bar sticky; mock-honesty copy on mark-paid.

## 7. Technical Requirements

All math/aggregation service-side; money via money.js; no component-level ledger writes; batch ops sequential with abort-safe reporting (no Promise.all silent failures).

## 8. API Requirements

Contract additions: admin finance composites (escrow overview, finance summary, processPayout two-step, adminRefund); Laravel notes (DB transactions, idempotency keys for payouts).

## 9. Data Requirements

Seeds: ≥ 6 held payments with age spread (incl. >7d), payout queue across states, 6-month finance history, commissions matching orders (verify; extend + reseed + report).

## 10. Files & Folders

Creates: `src/features/admin/finance/pages/{AdminPaymentsPage,AdminSettlementsPage,AdminCommissionsPage}.jsx`, `src/features/admin/finance/components/{FinanceSummaryCards,EscrowTable,RefundDialog,LedgerTable,SettlementQueue,BatchActionBar,CommissionsTable}.jsx`, paymentService admin extensions. Updates: adminRoutes, navConfig, 28 gates, contract doc.

## 11. Responsive Requirements

Tables→cards 360px (money prominent); batch bar above bottom nav; charts stack.

## 12. Accessibility Requirements

Amounts with text context; batch checkboxes labeled per creator; refund dialog consequence-explicit + amount validation announced; totals footers as table footers (scope).

## 13. Validation & Error Handling

Partial refund bounds (0 < x ≤ held); reject reason required; batch partial-failure surfaced per item; stale payout state → conflict toast + refetch.

## 14. Acceptance Criteria

- End-to-end settlement verified cross-role (creator 25 view updates each step + notification + ledger row on paid; available math correct).
- Escrow refund (full + partial) ledger-verified; commission period summary reconciles (documented spot-check).
- Batch approve with one induced failure reports correctly; permissions (`payments.manage` vs `settlements.process`) gate tabs/pages appropriately.
- Lint + build clean.

## 15. Verification Steps

1. Reseed → settlement cycle with creator-side checks at each transition.
2. Partial refund on seeded held order → 17-semantics ledger inspection.
3. Reconcile commissions month vs db; export CSVs; 360px + keyboard pass.
4. `npm run lint && npm run build`.

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

Ledger semantics (17), creator earnings math (25 — integrate), PAYOUT machine, `prompts/`.

## 18. Depends On

17 (ledger), 25 (payout requests), 28 (kit), 31 (order links).

## 19. Final Checklist

- [ ] Payments (overview/escrow/ledger) + refund oversight
- [ ] Settlements queue full lifecycle + batch + creator-side propagation
- [ ] Commissions records + summaries + config pointer
- [ ] All audited; contract updated; lint + build clean
- [ ] Report written
