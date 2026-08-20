# Storefront V2 — Prompt 05 of 10 — Home: Latest Feeds & Top Creators Sections

> **Read first:** `prompts/00-architecture-and-rules.md`, `docs/theme-v2.md`. Inspect the current HomePage composition (post V2-04), `FeedCard`, `feedService`, `creatorMetaService` (V2-03) before changing anything.

## Objective

Insert two new social-media-style sections on the home page directly after "How it works": **Latest Feeds** (10 newest feeds as FeedCards) and **Top Creators** (full-width row cards with a works slider) — and remove the old grid-style Featured Creators section they replace.

## Scope guard

- Landing page composition + two new landing components only. All data via existing V2-03 services.

## Changes

1. **Section order after this prompt:** Hero → How it works → **Latest Feeds** → **Top Creators** → (audience/"Built for both sides", stats, testimonials, final CTA — untouched until V2-06).
2. **Latest Feeds section** (`src/features/landing/components/LatestFeedsSection.jsx`):
   - Section header (eyebrow "LIVE ON THE BOARD" style + heading + "View all feeds →" link to `FEEDS`).
   - Single centered column (~680px) of the latest **10** feeds via `feedService.getLatestFeeds(10)`, rendered with the canonical `FeedCard` (V2-03) — social-timeline feel, staggered `FadeInView` reveals.
   - Whole-card click (and Details) → `feedDetail(id)`; Reply button: logged-in creator → also navigates to `feedDetail(id)` (composer lives there, V2-08); everyone else → `RoleGateDialog` (requiredRole `creator`).
   - States: 4 skeleton cards while loading; quiet fallback if the API fails (section renders nothing but page never crashes); EmptyState if zero feeds.
3. **Top Creators section** (`src/features/landing/components/TopCreatorsSection.jsx`):
   - Section header + "See all creators →" link to `CREATORS`.
   - `creatorMetaService.getTopCreators(4)` rendered as **one full-width card per row** (max-width ~880px centered), each card three-zone:
     - **Top:** large `UserAvatar` + display name (link → profile) + verified badge + `CreatorLevelBadge` + `OnlineDot` when online + tagline.
     - **Middle — works slider:** horizontal scroll-snap strip of that creator's published portfolio thumbnails (6–10 items, fixed aspect tiles, `loading="lazy"`); desktop: prev/next arrow buttons scrolling the strip; mobile: native swipe with snap; subtle edge-fade masks. Pure CSS scroll-snap — **no new dependencies, no heavy carousel logic**.
     - **Bottom:** stat row — rating (`RatingStars` + count), deliveries count, contribution counts (`112+ Images · 67 Videos`, reuse V2-04's formatter — lift it to a shared util if needed), starting price, location; right-aligned "View profile" ghost button.
   - Hover: card lift + glow per theme; reveals staggered.
4. **Remove the old FeaturedCreators grid section** from HomePage (superseded by Top Creators); delete the component if now unused.
5. Both sections themed per theme-v2 (glass cards, AmbientGlow allowed behind section headers, restrained glows).

## Do NOT

- Modify FeedCard itself (consume as-is; report gaps instead); touch sections below Top Creators (V2-06); reintroduce categories anywhere; add dependencies; edit `prompts/`.

## Verify

1. Order of sections correct; exactly 10 latest feeds shown matching db order; card click → details route; Reply gate fires for guest/buyer and navigates for the demo creator.
2. Top creators ranked per V2-03 rule; slider swipes at 360px and arrow-scrolls at desktop; all links land correctly.
3. Keyboard pass: slider arrows + card links reachable; images have alt text; reduced-motion: reveals static, slider still scrollable.
4. Section-level failure tolerance (stop API → page still renders elsewhere); `npm run lint && npm run build`.

## Git & PR (required output)

1. Branch: `git checkout -b feat/storefront-v2-05-home-feeds-creators`.
2. Commit: `feat(landing): latest-feeds and top-creators social sections (v2 - 05)`.
3. Push + `gh pr create --title "Storefront V2 — 05: Home latest feeds & top creators" --body "<summary + verification>"`.
4. **End your final message with the PR URL** (or branch + summary if gh/remote unavailable).

## Done checklist

- [ ] Latest Feeds (10, FeedCard column) with gating + states, placed after How it works
- [ ] Top Creators full-width row cards (avatar top / works slider middle / stats bottom)
- [ ] Old featured-creators grid removed clean
- [ ] A11y + mobile + reduced-motion verified; lint + build clean
- [ ] PR opened and URL reported
