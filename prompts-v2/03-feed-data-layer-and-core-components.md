# Storefront V2 — Prompt 03 of 10 — Feed Data Layer, FeedCard & Role-Gate System

> **Read first:** `prompts/00-architecture-and-rules.md`, `docs/theme-v2.md`, `docs/data-model.md`. Inspect `scripts/seed-data/`, `requestService`, `creatorProfileService`, and the existing request-card components before changing anything.

## Objective

Build the data + component foundation the new social-style storefront needs: seed extensions (feed fields, reply threads, creator levels/online/contribution stats), a `feedService`/`creatorMetaService` layer, the canonical **FeedCard** component, deal-status mapping, level badges, and the reusable **RoleGateDialog** — all consumed by V2 prompts 04–10.

## Scope guard

- Data/service/component layer + seeds only; no page rewrites yet. **Do not rename or break existing collections/services** — extend them. Admin/dashboards must keep working unchanged (new fields are additive).

## Changes

1. **Seed extensions (`scripts/seed-data/` + `npm run seed`; update `docs/data-model.md`):**
   - `contentRequests` (feeds): add `tags` (3–6 professional tags per request, e.g. `["product-photo", "lifestyle", "social-media"]`), `offerPrice` (single number; set from the existing budget so old fields remain valid), `repliesCount` (int, matching seeded replies below).
   - New collection **`feedReplies`**: `{ id: 'frp_…', feedId (requestId), creatorId (creatorProfile id), buyerId, messages: [{ id, authorRole: 'creator'|'buyer', authorId, body, at }], createdAt, updatedAt }`. One reply per creator per feed. Seed 2–5 replies for most open feeds (counts must equal `repliesCount`), with 2–6 message two-sided conversations (professional copy), including several for the demo creator so their thread renders.
   - `creatorProfiles`: add `isOnline` (bool; several true incl. demo creator), `deliveriesCount` (consistent with completed orders, some padded higher), `totalEarned` (consistent with ledger scale), `contributionCounts: { images, videos }` (derived from portfolio + padding, e.g. `{ images: 112, videos: 67 }`), `level` (1|2|3 — computed in seed by rule below).
   - Ensure the deal-status spread exists: open feeds, awarded/closed feeds, completed ("delivered") feeds.
2. **Level rule (single source):** `src/constants/creatorLevels.js` — `getCreatorLevel({ deliveriesCount, totalEarned })`: Level 3 = ≥25 deliveries AND ≥$10,000 earned; Level 2 = ≥10 AND ≥$2,000; else Level 1. Export `CREATOR_LEVEL_META` `{ 1: { label: 'Level 1', tone }, 2: …, 3: … }`. Seed script uses this same function.
3. **Deal-status mapping:** `src/constants/feedStatus.js` — `FEED_DEAL_STATUS` (`open`, `closed`, `delivered`) + `getFeedDealStatus(request)`: request `open` → `open`; `awarded`/`closed`/`cancelled` → `closed`; `completed` → `delivered`; + `FEED_DEAL_META` (label, tone: open=success glow, closed=neutral, delivered=info).
4. **Services:**
   - `src/services/feedService.js` — storefront façade over `requestService`/`feedReplies` (documented: collection names unchanged for Laravel/admin compatibility): `listFeeds({ page, limit, sort, filters })` supporting sorts `latest` (createdAt desc), `mostReplies` (repliesCount desc), `priceAsc`/`priceDesc` (offerPrice), and filters `dealStatus` (client-derived statuses `closed` need service-side mapping — implement: open/completed via status queries; closed via status-in-set, document approach), `openOnly`; `getFeed(id)` (feed + buyer profile summary); `getLatestFeeds(10)`; `getMyReply(feedId, creatorId)`; `createReply(feedId, { creatorId, body })` (creates thread with first message, increments `repliesCount`, notifies buyer via existing `notificationService.notify` with a professional message); `addReplyMessage(replyId, { authorRole, authorId, body })`; `deleteMyReply(replyId, { creatorId })` (ownership guard, hard delete + decrement `repliesCount`). **Privacy rule enforced in service:** reply queries always filter by `creatorId` — a creator can never fetch others' replies (JSDoc: Laravel must enforce server-side).
   - `src/services/creatorMetaService.js` — `getTopCreators(limit)` (rank: level desc → ratingAvg desc → deliveriesCount desc; includes published portfolio thumbnails for sliders), `getFeaturedWithContributions(limit)` (featured creators + contributionCounts, for the hero).
5. **Components (dark/social style per theme-v2):**
   - `src/features/feeds/components/FeedCard.jsx` — glass card, one per row (max-width ~680px in feed columns): header = buyer avatar + company name + posted relative time + `FeedDealChip` (from meta); body = heading (bold, 2-line clamp), description (3-line clamp), tags as small chips (wrap, max ~5 + "+n"); footer = **offer price** prominent (gradient text, `formatCurrency`), replies count with icon ("40 Replies"), actions: `Reply` (primary small) + `Details` (ghost). Props: `feed`, `onReply`, `detailTo`. Hover: lift + glow (theme). Fully keyboard/AA accessible.
   - `src/features/feeds/components/FeedDealChip.jsx`, `src/components/data-display/CreatorLevelBadge.jsx` (badge w/ subtle tier glow; L3 strongest), `src/components/data-display/OnlineDot.jsx` (green pulse dot + "Online now" accessible label; static under reduced motion).
   - `src/components/feedback/RoleGateDialog.jsx` — reusable gate: props `{ open, onClose, requiredRole: 'creator'|'buyer', action }` → themed dialog (lock icon, message like "Log in or register as a Creator to reply to this feed"), CTAs: **Register as a Creator/Buyer** (→ `REGISTER` with `?role=` param) + **Log in** (→ `LOGIN` with redirect state back to current page); ResponsiveDialog-based (sheet on mobile).
6. **Dev gallery** — add a "V2" tab demonstrating FeedCard (all deal statuses), level badges, online dot, RoleGateDialog.

## Do NOT

- Rewire pages yet (04–10 consume these); rename collections/services; touch admin; break proposals flow (replies are a separate system from proposals — document that in `docs/data-model.md`); add dependencies; edit `prompts/`.

## Verify

1. `npm run seed` deterministic; `repliesCount` totals match `feedReplies`; demo creator has ≥2 seeded reply threads; levels/online/contributions present and consistent.
2. `feedService` exercised from the dev gallery or console: list sorts/filters, `getMyReply` privacy (query for another creator returns nothing), create/delete reply round-trip against a scratch feed (then reseed).
3. Dev gallery V2 tab renders all new components (360px + desktop, reduced-motion).
4. `npm run lint && npm run build`; existing pages unaffected (spot-check board + buyer dashboard).

## Git & PR (required output)

1. Branch: `git checkout -b feat/storefront-v2-03-feed-data-core`.
2. Commit: `feat(feeds): feed/reply data layer, creator levels, FeedCard + RoleGateDialog (v2 - 03)`.
3. Push + `gh pr create --title "Storefront V2 — 03: Feed data layer & core components" --body "<summary + verification>"`.
4. **End your final message with the PR URL** (or branch + summary if gh/remote unavailable).

## Done checklist

- [ ] Seeds extended (tags/offerPrice/repliesCount/feedReplies/creator meta) + docs updated
- [ ] feedService + creatorMetaService with privacy guards + notifications
- [ ] FeedCard, deal chip, level badge, online dot, RoleGateDialog built + gallery demo
- [ ] Reply round-trip + privacy verified; lint + build clean; reseed committed
- [ ] PR opened and URL reported
