# Prompt 34 — Affiliate Program (Buyer Experience + Admin Management)

> **Before you start:** Read `prompts/00-architecture-and-rules.md`, then inspect Prompts 01–33 output (referral capture hook in 09; AFFILIATE-HOOK marker in 17's releasePayment; feature flag from 23).

## 1. Objective

Build the affiliate program end-to-end: buyer enrollment + referral dashboard (link, stats, earnings, payouts), the referral capture → signup → conversion pipeline wired into existing auth/payment flows, and admin affiliate management (profiles, earnings approval, payout processing).

## 2. Context

Buyers refer new businesses; conversion = referred buyer's **first completed order** (release moment). Affiliate commission = configured % of the platform commission on that order (settings.affiliate). Feature-flagged (`features.affiliateProgram`); admin permission `affiliates.manage`.

## 3. What Already Exists

`/r/:code` path constant (08), `bb.referralCode` storage + `referredByCode` on register (09), AFFILIATE-HOOK comment in releasePayment (17), affiliate collections + AFFILIATE statuses (03/05), settings.affiliate (05), useFeatureFlag (23), settlement patterns (32), exportCsv.

## 4. What to Implement

1. **Referral capture route** — `ReferralRedirectPage` at `/r/:code` (public): validates code via `affiliateService.getByCode` (active profiles only); valid → store `{ code, at }` in `bb.referralCode` (attributionDays expiry from settings), increment profile `clicks` (fire-and-forget PATCH; mock-approximate, documented), redirect to `REGISTER` with welcome toast ("You've been invited to BetterBlue"); invalid/expired → silent redirect home. Registration (09) already persists `referredByCode` — extend `authService.register`: when code present + role buyer → create `affiliateReferrals` record (`pending`, referredUserId) + increment profile `signups` + clear storage (this replaces 09's marked hook comment — minimal edit).
2. **Conversion pipeline** — implement `affiliateService.processConversion(order)`: fires inside releasePayment at the AFFILIATE-HOOK point (one-line integration edit in 17's service, guarded by feature flag + try/catch so payment flow never breaks on affiliate failure — log warning): guards: order buyer has a `pending` referral, this is their **first** completed order (query count), program enabled; computes `amount = round2(commissionAmount × settings.affiliate.commissionRate)`; referral → `converted` (convertedOrderId/At); creates `affiliateEarnings` (`pending`); increments profile `conversions` + `pendingEarnings`; notify affiliate (`affiliate_conversion`).
3. `BuyerAffiliatePage` (`/buyer/affiliate`; flag-gated nav + AdminPageGuard-style FeatureGate — create tiny `FeatureGate` component): two states:
   - **Not enrolled** — value pitch card (how it works 3-steps: Share link → Business signs up → They complete first order → You earn {rate}% of platform commission), terms acknowledgment checkbox, Enroll CTA → `affiliateService.enroll(userId)` (creates profile w/ generated readable code e.g. `VERDE-K7`, status active) → dashboard state.
   - **Dashboard** — referral link card (full URL from window.origin + `/r/CODE`, copy button + toast, share menu: copy / mailto / LinkedIn+X share URLs — plain anchor links, professional copy); StatCardGrid: Clicks, Signups, Conversions, Pending / Approved / Paid earnings (currency trio — 2 rows mobile); referrals DataTable/cards (masked referred name "V… Kitchen" privacy style — document, signup date, StatusChip, converted date); earnings table (order ref opaque short-id, amount, StatusChip pending/approved/paid, dates); payout section: available = approved sum − paid; Request payout (reuses 25's WithdrawDialog pattern against `affiliateService.requestAffiliatePayout` with settings.affiliate.payoutMinAmount; **decision**: affiliate payouts recorded as `payouts` records with `source: 'affiliate'` — extends payout schema; update data-model + contract; processed via 32's queue with source chip); program terms collapsible.
4. `AdminAffiliatesPage` (`/admin/affiliates`) — tabs: **Affiliates** (profiles table: user EntityRefChip, code, status, clicks/signups/conversions, pending/approved/paid totals; actions: Suspend/Reactivate profile (confirm + reason → status; suspended code stops capturing — verify capture guard) ), **Earnings approval** (pending earnings queue: affiliate, order ref, amount, age; Approve (→ approved + move pending→approvedEarnings totals + notify) / Void (reason → void + adjust) — single + batch per 32 pattern), **Payouts** (affiliate-source payout requests via 32's queue components filtered `source: 'affiliate'` — reuse, link "Process in Settlements" or inline same actions; choose inline reuse for cohesion), **Program stats** header cards (total conversions, liability (pending+approved unpaid), paid out). Audit everything (`affiliate.*` actions).
5. navConfig: buyer Affiliate entry (flag-gated), admin Affiliates entry (28 gate); resolve landing/pricing affiliate teaser links (10/11) to buyer affiliate page (auth-aware).

## 5. Functional Requirements

Full pipeline live-verifiable: visit `/r/CODE` → register fresh buyer → referral pending + signup count → that buyer completes an order (accept flow) → release fires conversion → earnings pending + notification → admin approves → buyer requests payout → admin marks paid (32) → totals reconcile at every step; attribution expiry respected; second order produces no second conversion; flag off hides everything gracefully.

## 6. UI/UX Requirements

Referral link card is the hero (copy affordance prominent); stats trio clear; masked-privacy consistent; enrollment pitch professional (no MLM-vibes copy); admin queues follow 32's discipline.

## 7. Technical Requirements

Conversion integration = single guarded call in releasePayment (grep-verifiable minimal diff); all affiliate math in affiliateService via money.js; FeatureGate reusable; code generation collision-checked.

## 8. API Requirements

Contract additions: enroll/getByCode/processConversion/requestAffiliatePayout/approve-void composites; payout `source` field documented; Laravel notes (attribution cookie server-side, idempotent conversion).

## 9. Data Requirements

Seeds already include 3 affiliate profiles + referrals/earnings across states (05); add if missing: a convertible setup (referred buyer with an order ready to complete) for live pipeline testing (extend + reseed + report).

## 10. Files & Folders

Creates: `src/features/affiliate/pages/{BuyerAffiliatePage,ReferralRedirectPage}.jsx`, `src/features/affiliate/components/{EnrollCard,ReferralLinkCard,AffiliateStats,ReferralsTable,EarningsTable,AffiliatePayoutSection}.jsx`, `src/features/admin/affiliates/pages/AdminAffiliatesPage.jsx` + components, `src/components/FeatureGate.jsx`, affiliateService full implementation. Updates: authService (referral record), paymentService (hook call), payout schema docs, routes/navConfig, 10/11 teaser links, 32 queue source-awareness.

## 11. Responsive Requirements

360px: link card stacks with full-width copy button, stats 2×3, tables→cards; admin per 32 patterns.

## 12. Accessibility Requirements

Copy button announces success; share links labeled ("Share on LinkedIn"); masked names have full context for owner? (masked for privacy — aria matches visual); earnings statuses text+tooltip.

## 13. Validation & Error Handling

Enroll terms required; payout bounds; invalid/suspended code capture rejected silently; conversion failures never break payments (verified by induced error test); duplicate-conversion guard.

## 14. Acceptance Criteria

- Live pipeline (§5) verified end-to-end with db inspection at each stage; reconciliation exact.
- Flag-off run: nav entries/pages/hook all inert; suspended affiliate code stops capturing.
- Admin approve/void/payout flows audited + notified; 32 reuse works with source chips.
- Lint + build clean.

## 15. Verification Steps

1. Reseed → full live pipeline run (two browser profiles or sequential logins) with 8-point db checklist.
2. Negative tests: expired attribution, second order, suspended code, flag off, induced conversion error during release.
3. 360px + copy/share a11y pass. `npm run lint && npm run build`.

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

releasePayment semantics beyond the guarded hook line (17), settlement machinery (32 — extend with source only), auth flow beyond the marked hook (09), `prompts/`.

## 18. Depends On

09 (capture), 17 (hook point), 25 (payout pattern), 28 (admin kit), 32 (settlement reuse), 23 (flags).

## 19. Final Checklist

- [ ] Capture → signup → conversion → approval → payout pipeline complete + live-verified
- [ ] Buyer enrollment + dashboard (link/stats/referrals/earnings/payout)
- [ ] Admin management (profiles/earnings/payouts/stats) with audit
- [ ] Flag + guards + payment-safety verified; docs updated
- [ ] Lint + build clean; report written
