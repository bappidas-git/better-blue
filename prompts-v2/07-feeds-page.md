# Storefront V2 — Prompt 07 of 10 — Feeds Page (Social Timeline, Infinite Scroll, Filters)

> **Read first:** `prompts/00-architecture-and-rules.md`, `docs/theme-v2.md`. Inspect the current `/feeds` page (renamed board from V2-02), `FeedCard`, `feedService` sorts/filters (V2-03) before changing anything.

## Objective

Rebuild `/feeds` as a social-media-style timeline: single centered column of FeedCards with **infinite scroll**, the specified filters (Latest / Most replies / Deals open / Closed & delivered), price sorting (low↔high) plus an "Open deals only" toggle, creator-gated replies, and a flagship mobile experience.

## Scope guard

- The public Feeds page only (replace the old grid/filter-rail board layout entirely). Category filters must NOT reappear. Buyer dashboards and the old shared components used elsewhere stay untouched.

## Changes

1. **Layout (`FeedsPage`):** page header (title "Feeds" + short intro + live count "X feeds"); sticky filter bar under the top nav (translucent dark, blur); centered timeline column (~680px) of `FeedCard`s, one per row, staggered entrance; back-to-top floating button after ~2 screens.
2. **Filter bar:**
   - Primary filter chips (single-select): **Latest** (default, createdAt desc) · **Most replies** (repliesCount desc) · **Open deals** (dealStatus open) · **Closed & delivered** (closed + delivered).
   - **Price sort** select: None · Price: Low to High · Price: High to Low (applies `offerPrice` sort within the active filter; selecting a price sort while "Latest/Most replies" is active switches the ordering to price — make the interplay explicit in the UI state).
   - **"Open deals only"** switch: constrains any view to open feeds (redundant-safe with the Open chip; disabled+on while that chip is active).
   - All state URL-synced (reuse `useListParams`); "Clear" affordance; result count updates live; mobile: chips in a horizontal snap-scroll row, sort+toggle inside a compact "Filters" bottom sheet (reuse SideSheet pattern).
3. **Infinite scroll:** implement `src/hooks/useInfiniteList.js` — wraps the paginated service (`feedService.listFeeds`) accumulating pages; IntersectionObserver sentinel triggers next page; loading row (2 skeleton FeedCards); "You're all caught up" end-cap; error row with Retry (keeps loaded items); filter/sort change resets the list; preserves scroll on back-navigation where feasible (bfcache-friendly, best-effort — document).
4. **Card actions:** Details button + whole-card click → `feedDetail(id)`. **Reply** button visible to everyone: logged-in creator → `feedDetail(id)` (composer there, V2-08; pass `state.intent='reply'` so V2-08 can focus the composer); guest/buyer/admin → `RoleGateDialog` (`requiredRole: 'creator'`, action "reply to this feed").
5. **States:** initial load = 4 skeleton cards; empty filter result = EmptyState ("No feeds match — try a different filter" + Clear); API-down = ErrorState + retry. Deal-status chips on cards must visibly differ (open glow / closed neutral / delivered info).
6. Remove now-unused board-era components (filter rail, request board cards) if nothing else imports them.

## Do NOT

- Reintroduce category/content-type filters; alter `FeedCard` internals (consume; report gaps); build the details page (V2-08); add dependencies; edit `prompts/`.

## Verify

1. Each filter/sort provably reorders/limits results against seeds (spot-check ids); URL round-trip (copy → new tab → same state); infinite scroll loads all pages then end-cap; filter change resets cleanly.
2. Reply gating matrix: guest → dialog; buyer → dialog; demo creator → navigates with intent state.
3. Mobile 360px: sticky chip row + bottom-sheet filters + smooth scrolling (no jank, images lazy); keyboard: chips/sort/toggle/cards all operable; `aria-live` count announcement.
4. `npm run lint && npm run build`; kill-API mid-scroll → error row + successful retry.

## Git & PR (required output)

1. Branch: `git checkout -b feat/storefront-v2-07-feeds-page`.
2. Commit: `feat(feeds): social timeline with infinite scroll, deal filters, price sort, reply gating (v2 - 07)`.
3. Push + `gh pr create --title "Storefront V2 — 07: Feeds page" --body "<summary + verification>"`.
4. **End your final message with the PR URL** (or branch + summary if gh/remote unavailable).

## Done checklist

- [ ] Timeline layout + sticky filter bar + infinite scroll (useInfiniteList) with all states
- [ ] Latest / Most replies / Open / Closed & delivered + price sort + open-only toggle, URL-synced
- [ ] Reply gating matrix verified; details navigation works
- [ ] Mobile-first social UX at 360px + a11y pass; lint + build clean
- [ ] PR opened and URL reported
