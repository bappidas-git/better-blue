# Prompt 19 — Checkout & Payment Experience (Buyer)

> **Before you start:** Read `prompts/00-architecture-and-rules.md`, `docs/payments.md`, then inspect Prompts 01–18 output (especially paymentService and the checkout stub).

## 1. Objective

Replace the checkout stub with the real buyer payment experience: secure-feeling checkout page (summary + dummy card form), processing/success/failure states driven by the payment architecture, escrow messaging, receipts, and the buyer Payments & Transactions history page.

## 2. Context

`initiateOrderPayment` (17) does all business work; this prompt is pure experience. The dummy provider must be swappable — the UI only knows "a payment method form" and provider-agnostic statuses. Test cards from `DUMMY_TEST_CARDS` power both demo and failure testing.

## 3. What Already Exists

Payment/escrow services + test cards + money utils (17), checkout stub + accept flow navigation (18), `orderService.getWithRelations` (07), StatusChip/StickyActionBar/ResponsiveDialog (04).

## 4. What to Implement

1. `CheckoutPage` (`src/features/checkout/pages/`, replaces stub) — guards: order exists, buyer owns it, status `pending_payment` (else redirect to order detail/orders with info toast). Layout: two-column ≥ md (left: payment form; right: sticky order summary), stacked mobile (summary collapsible accordion on top, form below, pay button in StickyActionBar).
2. **Order summary card** — request title, creator (avatar+name), content type/quantity chips, delivery time ("X days after payment"), revisions included; price breakdown: order total (prominent), escrow note row ("Held securely until you approve delivery" + shield icon), info tooltip on commission ("Creator receives total minus platform commission — no extra buyer fees"); terms line linking Terms + Content Policy.
3. **Payment form** (`DummyCardForm`) — fields: cardholder name, card number (auto-format 4-4-4-4, brand icon detection visa/mc by prefix, inputmode numeric), expiry (MM/YY auto-slash, future-date validation), CVV (3–4, password-style toggle); **DEV-only test-card helper panel** (collapsible, from `DUMMY_TEST_CARDS`: one-click fill success/declined/insufficient) gated by `env.enableDevPages`; "Pay $X securely" gradient button with lock icon; small print "Demo payment — no real charge" (env-gated copy acceptable; keep professional).
4. **Processing state** — on submit: full-card overlay (spinner + "Processing payment… don't close this window"), calls `initiateOrderPayment(orderId, { method: { brand, last4 } })`; minimum 800ms perceived duration.
5. **Result states** (same route, state-driven):
   - Success: check animation (Framer scale/opacity, reduced-motion static), "Payment held in escrow", summary (amount, payment id, order id, method last4), what-happens-next steps (creator notified → produces → you review), CTAs: View order (→ `buyerOrderDetail(orderId)` — registered in Prompt 20; this prompt registers the path with a minimal `OrderDetailStubPage` marked TEMP if 20 not yet run — mirror the 18/19 stub pattern), Back to requests.
   - Failure: error card (provider failureReason mapped to friendly copy via a message map), Retry (returns to form, card cleared, name kept), "Use a different card", support link; order remains `pending_payment`.
6. **Abandonment handling** — leaving checkout keeps order `pending_payment`: add resume affordances: banner on `BuyerRequestsPage` awarded tab items with unpaid orders ("Complete payment") + Overview activity note (implement banner via small `UnpaidOrderBanner` queried on requests page; documented).
7. `BuyerPaymentsPage` (`/buyer/payments`) — tabs: **Payments** (per-order payment cards: order title link, amount, method last4, StatusChip held/released/refunded/failed/partially_refunded, date; filter by status; receipt action → `ReceiptSheet` (SideSheet: full breakdown, ids, timestamps, transactions related to that payment)), **Transactions** (DataTable: date, description, type chip, signed amount colored, running context; filters: type, date range (FormDateField pair); mobile cards; CSV export via `exportCsv`). Data: `paymentService.listByBuyer`, `listTransactions({ userId })`.
8. navConfig append: Payments; routes: `BUYER_PAYMENTS`, checkout replacement, order-detail stub if needed.

## 5. Functional Requirements

Success path: order → `in_progress`, payment `held`, charge transaction — verified in UI (order stub/detail shows new status); declined/insufficient cards produce distinct friendly failures; retry works; guards prevent paying twice (revisit checkout on paid order → redirect with toast); receipts show accurate ledger rows.

## 6. UI/UX Requirements

Trustworthy premium checkout (clean, focused, no distractions — hide dashboard chrome? Keep DashboardLayout but visually calm card); large tap targets; card inputs with proper `inputmode`/`autocomplete` (cc-name, cc-number, cc-exp, cc-csc); processing overlay blocks double-submit; success moment delightful but restrained.

## 7. Technical Requirements

UI imports only `paymentService` + `DUMMY_TEST_CARDS` (never provider modules — grep-verified); card formatting utils feature-local (`cardUtils.js`); failure-message map feature-local; no money math in components (`money.js`/computed fields from service).

## 8. API Requirements

Composite op per contract (initiateOrderPayment mock sequence); payments/transactions queries per contract.

## 9. Data Requirements

Seeded unpaid order exists for instant testing (05/18 guarantee via demo journey; verify).

## 10. Files & Folders

Creates: `src/features/checkout/pages/CheckoutPage.jsx`, `src/features/checkout/components/{OrderSummaryCard,DummyCardForm,TestCardPanel,ProcessingOverlay,PaymentSuccess,PaymentFailure}.jsx`, `src/features/checkout/cardUtils.js`, `src/features/payments/pages/BuyerPaymentsPage.jsx`, `src/features/payments/components/{PaymentCard,ReceiptSheet,TransactionsTable}.jsx`, order-detail stub if 20 absent. Updates: buyerRoutes, navConfig, requests-page unpaid banner.

## 11. Responsive Requirements

360px: stacked, collapsible summary, sticky Pay bar, numeric keyboards; 900+: two-column with sticky summary; receipt sheet full-screen mobile.

## 12. Accessibility Requirements

Card fields labeled + autocomplete attrs; formatting preserves caret sanely; errors inline `role="alert"`; processing overlay `aria-busy` + focus held; success heading focused on arrival; transactions table headers/scope correct, mobile cards readable order.

## 13. Validation & Error Handling

Luhn-style/length/expiry/CVV client validation before provider call; provider failures mapped (card_declined → "Your card was declined…"); network failure during processing → safe "We couldn't confirm — check your orders before retrying" message (mock caveat documented); double-submit impossible.

## 14. Acceptance Criteria

- Success, declined, insufficient flows all correct incl. db side-effects and distinct UI; pay-twice guard works; abandonment banner appears and resumes.
- Payments page: statuses/filters/receipt/CSV export correct against seeds + new payment.
- Grep: no provider import outside services; lint + build clean.

## 15. Verification Steps

1. Reseed → accept flow (18) → checkout success card → verify order/payment/transactions in db + UI.
2. Repeat with `0002` and `9995` cards → failures + retry → success.
3. Revisit paid checkout URL → redirect; abandon flow → banner → resume.
4. Payments/Transactions filters + export; 360px + keyboard + autocomplete pass. `npm run lint && npm run build`.

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

paymentService semantics (17), accept flow (18), `prompts/`.

## 18. Depends On

17, 18 (04/07/14 foundations).

## 19. Final Checklist

- [ ] Checkout with summary, dummy card form, test-card dev panel, processing/success/failure
- [ ] Escrow messaging + guards + abandonment resume
- [ ] Buyer Payments + Transactions pages with receipts/filters/export
- [ ] A11y (autocomplete, alerts, focus) + mobile verified
- [ ] Lint + build clean; report written
