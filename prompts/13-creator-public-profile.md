# Prompt 13 — Creator Public Profile & Portfolio View

> **Before you start:** Read `prompts/00-architecture-and-rules.md`, then inspect Prompts 01–12 output (especially discovery cards linking to `creatorProfile(id)`).

## 1. Objective

Build the public creator profile at `/creators/:id`: hero header, about, published portfolio gallery with lightbox, reviews with rating breakdown, and buyer CTAs — the page where buyers decide.

## 2. Context

Discovery (12) links here; landing featured cards (10) can now point here too (fix the TODO). Only **published** portfolio items are visible; unavailable/suspended creators degrade gracefully.

## 3. What Already Exists

`creatorProfileService.getByUserId`/detail fetch, `portfolioService.listPublished`, `reviewService.listByCreator` (07), `MediaLightbox`, `RatingStars`, `UserAvatar`, `KeyValueList`, skeletons (04), auth context (09).

## 4. What to Implement

1. `CreatorProfilePage` (`src/features/creatorProfile/pages/`) — fetch profile by id (`creatorProfileService.getById` — add if missing) + parallel published portfolio + reviews page 1.
2. **Header** — subtle gradient-tint banner (token, low opacity), overlapping large avatar, display name + verified badge, tagline, meta row (location, response time "Responds in ~Xh", member-since), category chips, stats strip (RatingStars + avg + count, completed orders, starting price); actions: primary "Start a request" (buyer → `BUYER_REQUEST_NEW` with `?creator=` hint param; guest → register with redirect state; creator-role viewer → hidden), secondary "Share" (clipboard copy + toast). Mobile: actions in `StickyActionBar`.
3. **About section** — bio (rich paragraphs, "read more" clamp past 6 lines), `KeyValueList` details (languages, content types offered, location, member since), "What I create" chips.
4. **Portfolio gallery** — responsive masonry-feel grid (CSS columns or row-based grid 2/3/4 cols; keep simple/perform-ant), item card: thumbnail (lazy), hover overlay (title + type icon), video items show duration-style play badge; filter chips: All / Photo / Video + category sub-filter when >8 items; click → `MediaLightbox` (full item: media, title, description, category, tags) with prev/next through the filtered set; empty portfolio → tasteful EmptyState ("Portfolio coming soon").
5. **Reviews section** — summary card (big avg, stars, count, 5→1 distribution bars computed from fetched breakdown — service helper `reviewService.getBreakdown(creatorId)`), list of review cards (buyer name + company, stars, date, comment; paginated "Load more" 5-at-a-time), empty state ("No reviews yet").
6. **Unavailable states** — profile not found → NotFound; creator suspended/blacklisted (service exposes profileStatus per Prompt 12 approach) → respectful "This creator is currently unavailable" screen with Browse CTA; availability=false → banner "Not accepting new requests right now" + primary CTA disabled with tooltip.
7. Fix landing FeaturedCreators links to real profile routes (remove Prompt 10 TODO); register route; `useDocumentTitle(displayName)`.

## 5. Functional Requirements

All data API-driven; lightbox navigates within current filter; share copies canonical URL; CTA routing varies correctly by auth state/role; breadcrumb/back returns to discovery preserving its URL state (use history back when `state.fromDiscovery`, else link).

## 6. UI/UX Requirements

Premium editorial feel; header composition polished at all sizes; gallery gaps consistent (8–12px); FadeInView section reveals; hover states subtle; sticky mobile CTA never overlaps content (safe-area padding).

## 7. Technical Requirements

Feature-local components; zero business logic in page (services/hooks only); reviews pagination via existing hooks; no layout shift on media load (aspect-ratio boxes).

## 8. API Requirements

`GET /creatorProfiles/:id`, published portfolio filter, reviews by creator with paging (per contract); report any additions to contract doc.

## 9. Data Requirements

Seeds: every featured creator has ≥ 6 published items + ≥ 3 reviews (extend seed-data if not, reseed, report).

## 10. Files & Folders

Creates: `src/features/creatorProfile/pages/CreatorProfilePage.jsx`, `components/{ProfileHeader,AboutSection,PortfolioGallery,PortfolioFilterBar,ReviewsSummary,ReviewList,UnavailableProfile}.jsx`. Updates: landing FeaturedCreators links, `publicRoutes.jsx`, reviewService (breakdown helper).

## 11. Responsive Requirements

360px: stacked header, 2-col gallery, sticky CTA bar; 768: 3-col; 1200: 4-col + inline actions; lightbox swipe-friendly (basic touch prev/next acceptable).

## 12. Accessibility Requirements

h1 = creator name; gallery items are buttons with accessible names (title + type); lightbox keyboard (←/→/Esc) + focus trap + alt text; rating bars have text equivalents ("12 five-star reviews"); sticky bar doesn't trap focus.

## 13. Validation & Error Handling

Not-found/suspended/unavailable branches; partial failures isolated (reviews fail → section error + retry, rest of page fine); skeleton full-page layout on first load.

## 14. Acceptance Criteria

- Deep-link from discovery + landing works; back preserves discovery filters.
- Lightbox full keyboard pass; filters drive gallery + lightbox set.
- Guest/buyer/creator CTA variants verified; suspended seeded creator shows unavailable screen.
- Lint + build clean.

## 15. Verification Steps

1. Visit 3 seeded creators (rich, sparse-portfolio, suspended) — verify branches.
2. Keyboard-only lightbox + CTA pass; 360px sticky-bar check.
3. Reviews "Load more" against a creator with >5 reviews.
4. `npm run lint && npm run build`.

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

Discovery URL behavior, MediaLightbox API (extend via props only if essential), `prompts/`.

## 18. Depends On

04, 07, 08, 12 (10 for link fix, 09 for auth-aware CTA).

## 19. Final Checklist

- [ ] Header/About/Gallery/Reviews/Unavailable all built API-driven
- [ ] Lightbox + filters + pagination working with full a11y
- [ ] Auth-aware CTA matrix verified; landing links fixed
- [ ] Seeds guarantee demo richness; lint + build clean
- [ ] Report written
