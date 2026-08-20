# Storefront V2 — Prompt 09 of 10 — Creators Page (Social Cards, Levels, Gated Messaging, Affiliate CTA)

> **Read first:** `prompts/00-architecture-and-rules.md`, `docs/theme-v2.md`. Inspect the current `/creators` discovery page, `creatorMetaService`/levels/OnlineDot (V2-03), `useInfiniteList` (V2-07), `RoleGateDialog`, and the affiliate service before changing anything.

## Objective

Rebuild `/creators` in the same social style as Feeds: full-width creator cards in a single column with **infinite scroll**, level/online-driven filters (no category filters), buyer-gated **Send Message**, and a per-creator **affiliate promotion CTA** — mobile-first.

## Scope guard

- Public creators page only (replaces the old grid + category filter rail). Creator public profile page stays as-is except link targets. Dashboards/admin untouched.

## Changes

1. **Layout (`CreatorsPage`):** header (title "Creators" + count) + sticky filter bar + centered column (~760px) of `CreatorSocialCard`s (one per row, staggered reveal) + infinite scroll via `useInfiniteList` (extend `creatorMetaService.listCreators({ page, limit, sort, filters })` mapping to the discovery query, active/available creators only).
2. **Filters (URL-synced chips + sort; NO categories):**
   - **Online now** (isOnline), **Level 1 / Level 2 / Level 3** (multi-select level chips), and your added best-practice filters: **Top rated** (ratingAvg ≥ 4.5), **New creators** (joined ≤ 60 days), **Verified**.
   - Sort select: Recommended (level → rating → deliveries, default) · Highest deliveries · Top rated · Price: Low to High · Price: High to Low · Newest.
   - Mobile: chip row snap-scroll + "Filters" bottom sheet (V2-07 pattern); Clear-all; live count.
3. **`CreatorSocialCard`** (`src/features/discovery/components/`):
   - **Top:** avatar (OnlineDot overlay when online) + display name (link → profile) + verified badge + `CreatorLevelBadge` + tagline + location.
   - **Middle:** works slider — reuse/extract the V2-05 scroll-snap works strip into a shared component (`WorksSlider`) used by both Top Creators (refactor that usage, zero behavior change) and this card.
   - **Bottom:** stats row (rating + count, deliveries, contribution counts, "From $X") + actions: **View profile** (ghost, → profile), **Send Message** (primary), **Promote** (share icon — affiliate CTA).
4. **Send Message (visible to all):** logged-in **buyer** → `SendMessageDialog`: creator summary + message field (20–600) → `directMessagesService` (new small service + `directMessages` seed collection `{ id: 'dm_…', buyerId, creatorId, body, createdAt }`) + notify creator via existing notificationService (professional copy) → success toast. Anyone else (guest/creator/admin) → `RoleGateDialog` (`requiredRole: 'buyer'`, action "send a message to this creator"). Document honestly (PR body): creator-side inbox UI is future work; message lands in db + notification.
5. **Affiliate "Promote" CTA (visible to all):** logged-in buyer **with** an affiliate profile → `PromoteCreatorDialog`: explainer line + their referral link with creator attribution `origin + /r/{CODE}?creator={creatorProfileId}` + copy button (toast) + the existing share links pattern; buyer **without** affiliate profile → same dialog in enroll state ("Join the affiliate program to promote creators") with CTA → `/buyer/affiliate`; guest/creator → `RoleGateDialog` (`buyer`). Verify `/r/:code` route tolerates the extra `?creator=` param (capture flow unchanged; param stored alongside the code in the referral storage for future attribution — one-line addition, documented).
6. **States:** skeletons (3 card skeletons incl. slider strip), empty-filter EmptyState + Clear, error+retry, end-cap. Old category rail/grid components removed if unused elsewhere (the generic `CreatorCard` may still be used by other pages — check before deleting).

## Do NOT

- Reintroduce category filters; change the profile page or affiliate program mechanics (beyond the tolerant `?creator=` param); build a creator inbox; add dependencies; edit `prompts/`.

## Verify

1. Filters/sorts provably reshape results against seeds (online, each level, top rated, new, verified; each sort); URL round-trip; infinite scroll to end-cap.
2. Send Message matrix: guest → gate; creator → gate; demo buyer → dialog → record in `directMessages` + creator notification in db; validation errors inline.
3. Promote matrix: enrolled seeded affiliate buyer → link contains their code + `?creator=`, copy works; non-enrolled buyer → enroll state; guest → gate. `/r/CODE?creator=…` still redirects to register and stores the code.
4. WorksSlider refactor leaves the home Top Creators section pixel-behavior identical; 360px + keyboard + reduced-motion passes; `npm run lint && npm run build`; reseed after tests.

## Git & PR (required output)

1. Branch: `git checkout -b feat/storefront-v2-09-creators-page`.
2. Commit: `feat(creators): social creator cards with levels, gated messaging, affiliate promote (v2 - 09)`.
3. Push + `gh pr create --title "Storefront V2 — 09: Creators page" --body "<summary + verification>"`.
4. **End your final message with the PR URL** (or branch + summary if gh/remote unavailable).

## Done checklist

- [ ] Social single-column creators page with infinite scroll + all filters/sorts (no categories)
- [ ] CreatorSocialCard (avatar/level/online top · WorksSlider middle · stats+actions bottom)
- [ ] Send Message + Promote flows with full role matrices + db side-effects
- [ ] Shared WorksSlider refactor safe; mobile/a11y verified; lint + build clean
- [ ] PR opened and URL reported
