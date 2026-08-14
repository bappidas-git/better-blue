# Prompt 25 — Creator Earnings, Transactions & Payouts

> **Before you start:** Read `prompts/00-architecture-and-rules.md`, `docs/payments.md`, then inspect Prompts 01–24 output (especially paymentService earnings/payout methods from 17).

## 1. Objective

Build the creator's financial center at `/creator/earnings`: earnings summary (held/available/paid-out/lifetime), monthly chart, per-order commission breakdowns, transaction history, and the payout request flow with history.

## 2. Context

All money logic exists (17): `getEarningsSummary`, `requestPayout`, transactions ledger. This prompt is the experience layer; admin settlement processing arrives in Prompt 32 (payout stays `requested` until then — expected and displayed honestly).

## 3. What Already Exists

paymentService (earnings/payout/transactions) (17), payout method on profile (21), ThemedLineChart/StatCard/DataTable/exportCsv (04/14/03), released/held seeded orders + payouts across statuses (05).

## 4. What to Implement

1. `CreatorEarningsPage` — tabs: **Overview**, **Transactions**, **Payouts** (URL-synced tab param).
2. **Overview tab** — summary StatCardGrid: In escrow (held; tooltip "Released when buyers approve"), Available to withdraw (accent card + primary "Withdraw" button), Paid out, Lifetime earnings; ChartCard ThemedLineChart monthly net earnings (12 months, gradient area, currency ticks); **Earnings by order** list: completed/active orders with money columns — DataTable (desktop) / cards (mobile): order title link, completed date, gross, commission ({rate}% chip + amount), **net**, escrow StatusChip (held/released); footer totals row; info callout explaining commission with Pricing-page link.
3. **Transactions tab** — DataTable/cards via `paymentService.listTransactions({ userId })`: date, description, type chip (release/commission/payout/refund-adjustment tones), signed amount (+green/−neutral), related order link; filters: type multi, date range; CSV export button (exportCsv); pagination.
4. **Payouts tab** — payout method summary card (masked account from profile; "Update" → profile payout section link; missing method → warning card gating withdrawals); payout history list: amount, requested date, StatusChip (requested/processing/paid/rejected w/ reason tooltip), processed date; EmptyState ("No payouts yet — release earnings by completing orders").
5. **Withdraw flow** — `WithdrawDialog` (from Available card / Payouts tab): shows available balance, amount CurrencyField (max = available; "Withdraw all" chip; min = settings.payoutMinAmount with helper), method summary, confirm → `paymentService.requestPayout` → success state ("Payout requested — processed by our team, typically within 3 business days") + history refresh + available recomputed (requested amount deducted from available in summary math — ensure getEarningsSummary accounts for pending payout requests; adjust service if not, report); guards: no method → gated with CTA to profile; below minimum → inline error; zero available → disabled with tooltip.
6. **Held-earnings explainer** — collapsible "How payouts work" (escrow → release on approval → withdraw → processed) with mini step visual.
7. navConfig append: Earnings (badge none); resolve 21/24 TODO links (released earnings → here); routes registered.

## 5. Functional Requirements

Summary math provably consistent: held = held payments' creatorEarnings; available = released − (paid + pending payout requests); lifetime = all released; chart aggregates by month via dayjs; withdraw writes payout `requested` + notification; double-withdraw of same funds impossible (available recompute + service guard).

## 6. UI/UX Requirements

Financial-grade clarity: big honest numbers, tabular numerals (font-variant-numeric), consistent currency formatting, no ambiguous labels; Withdraw = calm confident primary; mobile cards impeccable.

## 7. Technical Requirements

Zero money math in components (service-computed view models; extend paymentService with `getEarningsBreakdown(creatorId)` returning per-order rows + monthly series); memoized heavy lists.

## 8. API Requirements

Per contract; add `getEarningsBreakdown` to composite table (Laravel: `/creator/earnings` endpoint).

## 9. Data Requirements

Seeds: demo creator has held + released + paid mixture, 12-month spread, payouts in ≥ 3 states incl. rejected-with-reason (verify; extend + reseed + report).

## 10. Files & Folders

Creates: `src/features/earnings/pages/CreatorEarningsPage.jsx`, `src/features/earnings/components/{EarningsSummaryCards,EarningsByOrderTable,TransactionsTab,PayoutsTab,PayoutMethodCard,WithdrawDialog,PayoutExplainer}.jsx`, paymentService extension. Updates: creatorRoutes, navConfig, 21/24 TODOs.

## 11. Responsive Requirements

360px: stat cards 2×2, tables→cards, dialog full-screen, chart 240px; desktop: totals-footer table; tab bar scrollable if needed.

## 12. Accessibility Requirements

Currency values with clear text context; chart aria summary ("Net earnings by month, peaking $840 in June"); dialog labeled + max/min announced; status chips text+tooltip not color-only.

## 13. Validation & Error Handling

Amount bounds inline; method-missing gate; request failure keeps dialog + toast; tabs isolated loading/error/empty.

## 14. Acceptance Criteria

- All four summary numbers reconcile against db for demo creator (manual ledger check documented in report); breakdown rows match orders; chart matches monthly sums.
- Withdraw happy path + all guard branches verified; pending request reduces available.
- CSV export correct; TODOs from 21/24 resolved; lint + build clean.

## 15. Verification Steps

1. Reseed → reconcile summary vs filtered db queries (held/released/paid/pending).
2. Withdraw full available → verify payout record + recomputed summary + notification; attempt second withdraw → guarded.
3. Filters/export on transactions; 360px + keyboard pass.
4. `npm run lint && npm run build`.

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

Ledger semantics/transaction writing (17), payout method storage (21), `prompts/`.

## 18. Depends On

17, 21, 24 (04/14 foundations).

## 19. Final Checklist

- [ ] Overview/Transactions/Payouts tabs complete with reconciling math
- [ ] Withdraw flow with all guards + pending-payout accounting
- [ ] Per-order commission breakdown + chart + CSV export
- [ ] Financial a11y + mobile polish verified
- [ ] Lint + build clean; report written
