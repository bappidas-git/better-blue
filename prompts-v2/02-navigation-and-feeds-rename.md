# Storefront V2 — Prompt 02 of 10 — Navigation Menu & "Feeds" Rename

> **Read first:** `prompts/00-architecture-and-rules.md` + `docs/theme-v2.md` (from V2-01). Inspect `src/routes/paths.js`, route configs, `PublicTopNav`, `PublicFooter`, and everywhere the storefront says "Requests" before changing anything.

## Objective

Restructure the public navigation to **Home, Feeds, Creators, How it Works, Pricing, Wallet**, rename the request board to **Feeds** across the entire storefront (routes + labels), and stub the Wallet page — without touching the underlying data model, services, or any dashboard/admin functionality.

## Scope guard

- Storefront (public pages) only. **Do not rename db collections, service modules, or dashboard/admin labels/routes** — `contentRequests`, `requestService`, buyer "My Requests", and all admin pages stay exactly as they are. "Feeds" is presentation-level naming for the public surface.
- Keep every existing route working (redirects, not deletions).

## Changes

1. **Routes (`src/routes/paths.js` + `publicRoutes.jsx`):**
   - Add `FEEDS = '/feeds'` and `feedDetail(id) = '/feeds/:id'`; add `WALLET = '/wallet'`.
   - Point the existing public request-board page components at the new `/feeds` paths.
   - Add redirect routes: `/requests` → `/feeds`, `/requests/:id` → `/feeds/:id` (Navigate with param passthrough) so old links/bookmarks and any dashboard links keep working.
   - Keep old path constants exported as deprecated aliases (commented `// V2: alias`) so non-storefront imports don't break.
2. **Public top nav (`PublicTopNav`)** — menu items in order: **Home** (`/`), **Feeds** (`/feeds`), **Creators** (`/creators`), **How it Works**, **Pricing**, **Wallet** (`/wallet`). Same items in the mobile drawer. Active states work for nested routes (`/feeds/abc` highlights Feeds). Auth area (Log in / Join / avatar menu) unchanged. Apply V2-01 styling: translucent dark bar, gradient active accent.
3. **Footer (`PublicFooter`)** — Marketplace column: Home, Feeds, Creators, Wallet; other columns unchanged except any "Browse Requests"/"Find Creators" labels → "Feeds"/"Creators".
4. **Label sweep (storefront only)** — replace user-visible "Requests"/"Browse Requests"/"Buyer Requests"/"content requests" wording on: the board page (header "Open content requests" → "Latest feeds" with matching intro copy), landing sections/CTAs that link to the board, how-it-works/pricing/FAQ/policy pages' link labels (keep their body copy otherwise intact this prompt), empty states, and document titles. Grep for `Request` within storefront feature folders (`landing`, `staticPages`, `discovery`, `requests` public pages) and update **labels only**, not identifiers.
5. **Wallet stub page** — `src/features/wallet/pages/WalletPage.jsx`: themed placeholder (PageHeader "Wallet" + one glass card: "Wallet — coming in this release series", marked `// TEMP: replaced in V2-10`), registered at `/wallet`, `useDocumentTitle('Wallet')`. This exists only so the nav never 404s.
6. **Board page naming** — rename public page components/files where they are storefront-owned (`RequestBoardPage` → `FeedsPage`, `RequestBoardDetailPage` → `FeedDetailPage`) with imports updated; internal service calls (`requestService.listOpen` etc.) stay untouched. If any shared component is also used by dashboards (e.g. `RequestBriefView`), do NOT rename it.

## Do NOT

- Change feed card design/behavior yet (V2-03/07), remove categories yet (V2-03/04), touch admin/dashboard navs, alter services/db, add dependencies, edit `prompts/`.

## Verify

1. Nav shows the six items (desktop + mobile drawer) with correct active states; Wallet renders the stub.
2. `/requests` and `/requests/:id` (use a seeded id) redirect to `/feeds` equivalents; deep-link `/feeds/:id` works.
3. Grep check: no user-visible "Browse Requests"/"Open content requests" remains on public pages; dashboards still say "My Requests" (untouched).
4. `npm run lint && npm run build`; quick 360px pass on nav/drawer.

## Git & PR (required output)

1. Branch from latest default: `git checkout -b feat/storefront-v2-02-nav-feeds-rename`.
2. Commit: `feat(storefront): new nav (Home/Feeds/Creators/How it Works/Pricing/Wallet) + Feeds rename with redirects (v2 - 02)`.
3. Push + `gh pr create --title "Storefront V2 — 02: Navigation & Feeds rename" --body "<summary + verification>"`.
4. **End your final message with the PR URL** (or branch + summary if gh/remote unavailable).

## Done checklist

- [ ] Six-item nav (desktop + mobile) + footer updated, themed per V2-01
- [ ] `/feeds` routes live; old `/requests*` redirect; alias constants kept
- [ ] Storefront label sweep done; dashboards/admin untouched
- [ ] Wallet stub mounted; lint + build clean
- [ ] PR opened and URL reported
