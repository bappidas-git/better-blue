# Prompt 12 — Creator Discovery (Browse, Search, Filter)

> **Before you start:** Read `prompts/00-architecture-and-rules.md` (especially §12 list-page pattern), then inspect Prompts 01–11 output.

## 1. Objective

Build the public creator marketplace at `/creators`: searchable, filterable, sortable, paginated creator discovery with URL-synced state, premium creator cards, and a fully mobile-native filter experience.

## 2. Context

This is the primary buyer entry point and the flagship list page — it sets the pattern quality for every list that follows. Only `active`, available creators with published presence appear.

## 3. What Already Exists

`creatorProfileService.search` + `usePaginatedQuery` (07), `SearchInput`/`FilterChipGroup`/`SortSelect`/`PaginationControl`/`EmptyState`/skeletons (04), categories API (07), paths (08).

## 4. What to Implement

1. `CreatorsPage` (`src/features/discovery/pages/`) — layout: PageHeader ("Find creators", subtitle, result count) → toolbar → content grid → pagination. Desktop ≥ lg: left filter rail (sticky, 280px). Mobile/tablet: horizontal `FilterChipGroup` summary row + "Filters" button opening `SideSheet` (full-screen mobile) with the full filter form + result-count "Show X creators" apply button.
2. **Filters** (all URL-synced): category (multi, from API), content type (photo/video/bundle chips), price range (MUI Slider over `startingPrice`, $0–$2000 with "$2000+" cap), minimum rating (star selector 3+/4+/4.5+), availability toggle (default on). Sort: Recommended (featured first — seed `featured` + rating composite; document mock sort note), Top rated, Price low→high, Price high→low, Newest. Search: name/tagline via `q`.
3. **URL state** — `useSearchParams` two-way sync (filters/sort/search/page); shareable/reload-safe; back/forward respected; "Clear all" chip when any filter active. Implement as reusable feature hook `useDiscoveryParams` (pattern reused by Prompt 23 request board — keep generic enough to lift later; note in report).
4. `CreatorCard` — avatar (UserAvatar lg), display name + verified badge (iconify check, `aria-label="Verified creator"`), tagline (2-line clamp), category chips (max 2 + "+n"), RatingStars + count, completed orders, "From $X" price, 3-thumb portfolio strip (published items — fetched batch: extend search to include `portfolioPreview` via service-level parallel fetch with modest concurrency; skeleton strip while loading), hover: lift + strip slide (Framer), entire card links to `creatorProfile(id)`. Card grid: 1/2/3/4 cols (xs/sm/lg/xl) via `StaggerList` entrance.
5. **States** — skeleton grid (8 CardSkeletons) on load; `EmptyState` ("No creators match — try removing filters" + Clear all action); `ErrorState` with retry; count text live-updates.
6. Route registration + TopNav "Find Creators" link verification; category tiles on landing already deep-link here with `?category=` — verify they preselect the filter.

## 5. Functional Requirements

Filters combine correctly (AND semantics; category multi = OR within); price cap includes 2000+; suspended/unavailable creators excluded server-query-side (`accountStatus` via user join is mock-awkward — filter on creatorProfile `availability` + a seeded `profileStatus` mirror field if needed; keep exclusion logic in the service, document approach); pagination resets to 1 on filter change; result count accurate from `total`.

## 6. UI/UX Requirements

List-page pattern per 00 §12; cards premium minimal; filter rail quiet (no boxed-in look); sticky mobile "Filters (n)" affordance showing active count; snap feel on sheet; no jank while typing (debounced search preserves focus).

## 7. Technical Requirements

All querying through `creatorProfileService.search` (adapter params only); portfolio-preview enrichment inside the service (documented as future single Laravel endpoint `GET /creators?include=preview`); `useDiscoveryParams` owns URL logic (components stay declarative).

## 8. API Requirements

Per contract discovery section: filters map to `categoryIds` contains (mock: client-side refine where JSON Server can't express array-contains — do it inside the service on the fetched page with over-fetch factor, documented), ranges `startingPrice_gte/_lte`, `ratingAvg_gte`, sort mapping. Report any contract addition made.

## 9. Data Requirements

Seeds provide ≥ 12 creators across categories/prices/ratings so every filter shows differentiated results.

## 10. Files & Folders

Creates: `src/features/discovery/pages/CreatorsPage.jsx`, `src/features/discovery/components/{CreatorCard,FilterRail,FilterSheet,ActiveFilterChips,PortfolioStrip}.jsx`, `src/features/discovery/hooks/useDiscoveryParams.js`. Updates: `publicRoutes.jsx`, service enrichment.

## 11. Responsive Requirements

360px: single column cards, sheet filters, chip row scrolls; 768: 2 cols; 1200+: rail + 3–4 cols; slider touch-friendly.

## 12. Accessibility Requirements

Filter controls labeled; result count `aria-live="polite"`; card is one link with descriptive accessible name (name + rating + price); sheet focus trap; slider keyboard operable with value text.

## 13. Validation & Error Handling

Malformed URL params sanitized (bad category id ignored, NaN prices reset); empty/error/retry states; API-down → ErrorState.

## 14. Acceptance Criteria

- Every filter/sort/search provably changes results against seeds; URL round-trip (copy URL → new tab → identical state).
- Landing category deep-link preselects; back/forward navigates filter history.
- 360px experience feels app-native (sheet apply flow); skeletons match card layout.
- Lint + build clean; no literal status/path strings.

## 15. Verification Steps

1. Matrix-test filters (each alone + combined) against known seeds; verify counts.
2. URL copy/paste + back/forward test.
3. Mobile sheet pass at 360px; keyboard pass on rail + slider.
4. Kill API mid-browse → ErrorState → restart → Retry works. `npm run lint && npm run build`.

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

listAdapter contract, component library, seeds (unless a filter has zero demo coverage — then extend seed-data + reseed + report), `prompts/`.

## 18. Depends On

04, 07, 08 (10/11 for entry links).

## 19. Final Checklist

- [ ] Full filter/sort/search/pagination with URL sync via useDiscoveryParams
- [ ] CreatorCard with portfolio strip + all states (loading/empty/error)
- [ ] Mobile sheet filters + desktop rail; a11y verified
- [ ] Service-level query mapping documented (incl. mock refinements)
- [ ] Lint + build clean; report written
