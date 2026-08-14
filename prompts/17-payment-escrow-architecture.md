# Prompt 17 — Payment & Escrow Architecture (Service Layer)

> **Before you start:** Read `prompts/00-architecture-and-rules.md` (especially §9 state machines, §10 services, §15 migration), `docs/api-contract.md` composite-operations table, then inspect Prompts 01–16 output.

## 1. Objective

Implement the complete payment business layer — provider abstraction with `DummyPaymentProvider`, escrow lifecycle (initiate → held → released/refunded), commission calculation from platform settings, transaction ledger writing, payout requests — plus `docs/payments.md` and a workflow smoke test. **No buyer-facing UI in this prompt** (Prompt 19 builds checkout on top of this).

## 2. Context

This is the architecture the client will keep when swapping in a real payment provider: UI and business logic must never know provider details (Requirement 13). Order state transitions here follow the machines from Prompt 03 strictly.

## 3. What Already Exists

`paymentService` baseline + transactions listing (07), state machines + PAYMENT/ORDER/TRANSACTION constants (03), settingsService with commission config (07), orders/payments/transactions/commissions/payouts seeded (05), `notificationService.notify` + `auditService.log` (07).

## 4. What to Implement

1. **Provider abstraction** (`src/services/payments/`):
   - `paymentProvider.js` — provider interface documentation (JSDoc typedef): `createPayment({ amount, currency, method }) → { providerRef, status: 'processing' }`, `confirmPayment(providerRef) → { status: 'succeeded'|'failed', failureReason? }`, `refund(providerRef, amount) → { status: 'refunded' }`; `getPaymentProvider()` factory switching on a `paymentProvider` key in platformSettings (default `dummy`) — commented slot for `FutureRealPaymentProvider`.
   - `dummyPaymentProvider.js` — deterministic simulation: 1200ms processing latency; test-card rules documented: number ending `0002` → declined (`card_declined`), ending `9995` → insufficient funds, anything else valid-Luhn-ish 16-digit → success; exports `DUMMY_TEST_CARDS` for the checkout UI/dev panel.
2. **`paymentService` workflow methods** (extend existing service; signatures locked for Laravel swap):
   - `initiateOrderPayment(orderId, { method }) → payment` — guards: order status `pending_payment`, no existing held payment; creates payment `initiated`→`processing` (provider call), on success → `held` (heldAt), transaction `charge` (buyer, −amount), order → `in_progress` (assertTransition; activatedAt), notify creator (`order_paid`), notify buyer receipt; on failure → payment `failed` + failureReason, order unchanged; returns final payment.
   - `releasePayment(orderId, { reason = 'buyer_accepted', actor }) → { payment, commission }` — guards: payment `held`, order transitioning to `completed` handled by caller (orderService) — this method: computes commission via `computeCommission`, payment → `released` (releasedAt), writes transactions: `release` (creator, +creatorEarnings), `commission` (platform, +commissionAmount), creates `commissions` record, updates order money fields if unset, notify creator (`payment_released`), audit when actor is admin. **Affiliate hook:** marked extension point comment `// AFFILIATE-HOOK (Prompt 34): processConversion(order)`.
   - `refundPayment(orderId, { amount = full, reason, actor }) → payment` — guards `held`; full → `refunded` + transaction `refund` (buyer +amount); partial → `partially_refunded` + transactions `partial_refund` (buyer +part) and `release` (creator +remainder minus commission on remainder — document the chosen partial-commission policy: commission applies to the creator-kept portion); notify both; audit.
   - `computeCommission(amount, { categoryId, creatorId }) → { rate, amount }` — settings default rate + category override (+ marked slot for per-creator override, Prompt 35 config); round half-up 2dp; pure + exported for UI display.
   - `getEarningsSummary(creatorId) → { held, available, paidOut, lifetime }` — derived from payments/transactions/payouts (documented single Laravel endpoint later).
   - `requestPayout(creatorId, { amount }) → payout` — guards: amount ≥ settings payoutMinAmount and ≤ available; creates payout `requested`; transaction written only on paid (Prompt 32 admin processes); notify creator confirmation.
3. **`orderService` workflow methods** (extend): `acceptProposal(proposalId, { buyerId }) → order` — guards: proposal `submitted|shortlisted`, request `open`, actor is request owner; creates order `pending_payment` from proposal+request snapshot (title, price, commissionRate frozen at acceptance via computeCommission, revisionsIncluded, deliveryDueAt = now+deliveryDays **set on activation instead** — store deliveryDays, compute due at payment), proposal → `accepted`, other proposals → `declined` (+ notifications), request → `awarded` (awardedProposalId), notify creator (`proposal_accepted`); `cancelOrder(orderId, { byRole, reason })` — allowed from `pending_payment` (no refund) or by admin from active states (refund path via paymentService), transitions + notify + audit.
4. **Ledger consistency rule** — every money movement = exactly one transactions record; helper `writeTransaction` internal; description strings from a template map (constants file `src/constants/transactionTemplates.js`).
5. `docs/payments.md` — architecture doc: provider interface, dummy behavior/test cards, escrow lifecycle diagram (text/ASCII), state tables, commission policy (incl. partial-refund policy), payout flow, ledger invariants, **real-provider swap guide** (implement interface, settings switch, webhook notes for Laravel).
6. `scripts/smoke-workflow.mjs` (+ `npm run smoke:workflow`) — against running API: seeds-safe scenario: pick seeded `pending_payment` order (or create via acceptProposal on a seeded open request) → initiate payment (success card) → assert order `in_progress`, payment `held`, charge transaction; → releasePayment → assert released + release/commission transactions + commissions record + math (rate from settings); → separate order: initiate with declined card → assert `failed` + order unchanged; → refund path on another held order → assert refund records. Cleanup or reseed instruction printed.

## 5. Functional Requirements

All guards enforce state machines (`assertTransition`) and ownership; every mutation notifies per notificationTypes; money math exact to 2dp; provider swap = one settings value + one module; no UI regressions (nothing user-visible changes this prompt).

## 6. UI/UX Requirements

None (service layer). Dev gallery: add small "Payments" dev-tab panel listing DUMMY_TEST_CARDS and a button running computeCommission against live settings (verification aid).

## 7. Technical Requirements

Provider modules never imported outside `paymentService`; services throw `ApiError`-style errors with codes (`invalid_state`, `payment_failed`, `insufficient_funds` mapped from provider, `payout_below_minimum`); JSDoc on every method incl. Laravel endpoint note; no floating-point drift (use cent-safe rounding helper in formatters or `Math.round(x*100)/100` consistently via a `money.js` util — create `src/utils/money.js` with `round2`, `toCents/fromCents` and use it everywhere money is computed).

## 8. API Requirements

REST calls per contract; composite operations match the contract's mock-sequence column exactly (update contract if implementation reveals a better sequence — report).

## 9. Data Requirements

Smoke test relies on seeded scenario orders (05 guarantees pending_payment + held orders exist); reseed restores.

## 10. Files & Folders

Creates: `src/services/payments/{paymentProvider,dummyPaymentProvider,index}.js`, `src/utils/money.js`, `src/constants/transactionTemplates.js`, `docs/payments.md`, `scripts/smoke-workflow.mjs`. Updates: `paymentService.js`, `orderService.js` (workflow sections), `package.json` (smoke:workflow), dev gallery panel, contract doc if needed.

## 11–12. Responsive / Accessibility

N/A (no UI beyond dev panel).

## 13. Validation & Error Handling

Every workflow method validates state/ownership/amounts before any write; partial-failure strategy documented (mock has no transactions — write in safe order: provider → payment → order → ledger → notifications; on mid-sequence failure, report inconsistency loudly in the thrown error; Laravel note: wrap in DB transaction).

## 14. Acceptance Criteria

- `npm run smoke:workflow` passes end-to-end (success, decline, release incl. commission math vs settings, refund) against fresh seeds.
- Grep: no provider imports outside paymentService; all money math through `money.js`.
- docs/payments.md complete incl. swap guide; lint + build clean; app unaffected visually.

## 15. Verification Steps

1. `npm run seed && npm run api` → `npm run smoke:workflow` (twice, reseeding between).
2. Manually verify a release's records in db.json (payment, 2–3 transactions, commission, notifications).
3. Dev panel commission check vs settings override (temporarily set a category override in db, verify, reseed).
4. `npm run lint && npm run build`.

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

State-machine definitions (03), existing service signatures from 07, seeds (beyond documented scenario needs), `prompts/`.

## 18. Depends On

03, 05, 07 (16 for acceptProposal context; runs before 18/19 which consume it).

## 19. Final Checklist

- [ ] Provider abstraction + dummy provider + factory settings switch
- [ ] initiate/release/refund/computeCommission/earnings/payout + acceptProposal/cancelOrder implemented with guards, ledger, notifications, audit
- [ ] money.js used everywhere; transaction templates centralized
- [ ] docs/payments.md + smoke:workflow passing
- [ ] Lint + build clean; report written
