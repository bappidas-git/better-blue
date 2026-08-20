# Storefront V2 — Prompt 10 of 10 — Wallet Page & Final Storefront QA Sweep

> **Read first:** `prompts/00-architecture-and-rules.md`, `docs/theme-v2.md`. Inspect the Wallet stub (V2-02), `settingsService`, and the full storefront as it stands after V2-01…09 before changing anything.

## Objective

Replace the Wallet stub with a full explainer page describing BetterBlue's wallet-based purchasing flow (with a concrete worked example), then run a final storefront-wide QA/consistency sweep across everything this V2 series changed.

## Scope guard

- Wallet is an **informational storefront page** — do not build wallet functionality, balances, or payment changes; the existing checkout/escrow logic is untouched. QA sweep fixes are storefront-only, minimal-diff.

## Part A — Wallet page (`/wallet`, replaces the V2-02 stub)

1. **Hero block:** AmbientGlow backdrop, eyebrow "WALLET", heading (e.g. "One wallet. Every order."), short intro: buyers fund a BetterBlue Wallet and every order is paid from that balance.
2. **"How the wallet works" steps (4 glass step cards):** ① Log in as a buyer → ② Choose what to order from a creator → ③ Pay from your Wallet — if the balance is short, you receive a **payment link** to recharge → ④ Recharge via the payment link and the order is funded (escrow protection applies as everywhere on BetterBlue).
3. **Worked example card (concrete numbers, `formatCurrency`):** wallet balance $150 → order total $400 → shortfall $250 → payment link issued for the recharge (example: recharge $300) → new balance $450 → order funded $400 → remaining balance $50; render as a mini statement/ledger-style table with a highlighted "payment link" step. Include a short professional note that on this demonstration build payments are simulated and no real money moves.
4. **Supporting sections:** "Why a wallet" trio (one balance across orders · faster checkout · every top-up and charge in one statement); mini-FAQ accordion (When do I recharge? What is a payment link? Is my money protected? — answers consistent with the escrow story on How-it-works/Pricing); final CTA band — **Register as a Buyer** (`?role=buyer`) + secondary "See pricing".
5. Fully responsive/social-styled (single column mobile, step cards stack, table → stacked rows at 360px), `useDocumentTitle('Wallet')`, FadeInView reveals, AA contrast.

## Part B — Final storefront QA sweep (fix everything found; log results in `docs/qa-storefront-v2.md`)

1. **Naming sweep:** grep storefront features for leftover user-visible "Request(s)"/"Browse Requests" (should read Feeds/feed); confirm `/requests*` redirects still work; nav/footer/menu labels final.
2. **Category sweep:** no category chips, filters, links, or fetches anywhere on public pages (network-tab check on home/feeds/creators/details); db/admin untouched.
3. **Theme consistency:** every public page + auth pages + all V2 dialogs (RoleGate, SendMessage, Promote, delete-reply confirm) on dark tokens; glow/glass discipline; no light-theme remnants; logged-in shells spot-check still legible (fix only breakages).
4. **Gating matrix re-run:** Reply (guest/buyer/creator), Send Message (guest/creator/buyer), Promote (guest/non-enrolled/enrolled) — all correct incl. `?role=` register preselect round-trips and login redirect-back.
5. **Responsive + a11y + motion:** 360/768/1280 pass on Home, Feeds, Feed details, Creators, Wallet, How-it-works, Pricing (no horizontal scroll, sticky bars behave, sliders swipe); keyboard pass on filter bars, sliders, dialogs, composer; reduced-motion full pass (animated gradients/reveals static, nothing invisible); images lazy + alt.
6. **Perf/console:** no fetch loops (network idle per page), infinite scrolls stable, console clean across a full click-through; `npm run lint` (0 warnings) + `npm run build` + `npm run smoke:api` green; reseed → spot-check counts still consistent (repliesCount ↔ feedReplies).

## Do NOT

- Build real wallet/balance functionality; touch checkout/escrow/dashboards/admin; change V2 features beyond fixes; add dependencies; edit `prompts/`.

## Verify

Part A checks embedded above; Part B **is** the verification — complete every sweep, fix findings, and record each check + result in `docs/qa-storefront-v2.md`.

## Git & PR (required output)

1. Branch: `git checkout -b feat/storefront-v2-10-wallet-final-qa`.
2. Commit: `feat(wallet): wallet explainer page + storefront v2 final QA sweep (v2 - 10)`.
3. Push + `gh pr create --title "Storefront V2 — 10: Wallet page & final QA" --body "<summary + QA results + verification>"`.
4. **End your final message with the PR URL** (or branch + summary if gh/remote unavailable).

## Done checklist

- [ ] Wallet page: hero, 4-step flow, worked example with payment-link recharge math, FAQ, CTAs — responsive + themed
- [ ] Naming/category/theme sweeps clean; gating matrices re-verified
- [ ] Responsive + a11y + reduced-motion + console/perf passes done; qa-storefront-v2.md written
- [ ] Lint (0 warnings) + build + smoke green on fresh seed
- [ ] PR opened and URL reported
