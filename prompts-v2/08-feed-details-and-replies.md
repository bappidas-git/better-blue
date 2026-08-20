# Storefront V2 — Prompt 08 of 10 — Feed Details Page & Private Creator Replies

> **Read first:** `prompts/00-architecture-and-rules.md`, `docs/theme-v2.md`. Inspect `feedService` reply methods + `feedReplies` seeds (V2-03), the current `/feeds/:id` page (V2-02 rename), and `RoleGateDialog` before changing anything.

## Objective

Rebuild the feed details page (`/feeds/:id`) social-style and implement the **private reply & conversation** experience: any visitor sees the feed + reply count; a logged-in creator can reply, hold a private conversation with the buyer, and delete their own reply — and can never see any other creator's reply.

## Scope guard

- Public feed details page + reply UI + `feedService` usage only. The buyer's side of these conversations is out of scope for this series (note it honestly in the PR body); proposals/dashboards untouched.

## Changes

1. **`FeedDetailPage` layout (centered ~760px column):**
   - Back link ("← Feeds", preserves feeds filter state via history when available).
   - Feed card (expanded, not clamped): buyer avatar + company + posted time + `FeedDealChip`; full heading (h1) + full description (paragraphs preserved); tags chips; **offer price** in a prominent glass stat strip (price + replies count + deadline if present).
   - Buyer mini-card (company name, member-since, total feeds posted — light service lookup).
   - States: skeleton page, not-found → NotFound, closed/delivered feeds show a status banner ("This deal is closed" / "Delivered") and disable new replies.
2. **Reply area (below the feed) — strictly viewer-aware:**
   - **Guest / buyer / admin:** gate card — "Replies are private between each creator and the buyer" + reply count + **Reply** button → `RoleGateDialog` (`creator`). Never render any thread content.
   - **Logged-in creator, no reply yet (feed open):** composer card — multiline (10–1000 chars, counter, professional placeholder), submit → `feedService.createReply` → toast + thread renders; honor `state.intent='reply'` from V2-07 (scroll to + focus composer).
   - **Logged-in creator with a reply:** **"Your conversation with {buyer}"** thread card: messages chronological (creator right-aligned gradient-tint bubbles, buyer left glass bubbles, relative times, `role="log"`); composer at bottom (`addReplyMessage`, optimistic append w/ rollback on failure); header shows reply date + **Delete reply** (kebab) → confirm dialog (danger: "This permanently removes your reply and conversation") → `deleteMyReply` → count decrements, composer state returns.
   - **Privacy checks in UI + service:** only `getMyReply(feedId, currentCreatorId)` is ever called; no API path fetches all replies from this page; document (JSDoc + PR body) that Laravel must enforce this server-side.
3. **Reply count** shown publicly updates after create/delete (refetch feed).
4. **Wire-up:** FeedCard Reply buttons (home V2-05 + feeds V2-07) land here with intent state and behave per matrix; direct URL access works for all roles.
5. Themed per theme-v2 (glass thread card, subtle glow on composer focus); mobile: full-width column, sticky composer above bottom of viewport while thread focused (keyboard-safe).

## Do NOT

- Render other creators' replies anywhere (including counts-by-creator breakdowns); build buyer-side conversation UI; touch proposals; add dependencies; edit `prompts/`.

## Verify

1. Matrix at a seeded open feed: guest/buyer → gate card + dialog; demo creator (no reply) → composer → submit → thread + count+1 in db; second seeded creator login → sees ONLY their own thread (never the demo creator's) — the core privacy test.
2. Conversation: send 2 messages (optimistic render), reload persists; delete reply → confirm → db record gone + count−1 → composer returns.
3. Closed/delivered feed: banner shown, composer/gate disabled appropriately; not-found route handled.
4. Mobile 360px thread + composer pass (keyboard doesn't cover input); `role="log"`/labels/focus states; `npm run lint && npm run build`; reseed after testing.

## Git & PR (required output)

1. Branch: `git checkout -b feat/storefront-v2-08-feed-details-replies`.
2. Commit: `feat(feeds): social feed details with private creator reply & conversation (v2 - 08)`.
3. Push + `gh pr create --title "Storefront V2 — 08: Feed details & private replies" --body "<summary + privacy notes + verification>"`.
4. **End your final message with the PR URL** (or branch + summary if gh/remote unavailable).

## Done checklist

- [ ] Details layout (expanded feed, price strip, buyer card, status banners, states)
- [ ] Viewer-aware reply area: gate / composer / private thread / delete — full matrix verified
- [ ] Cross-creator privacy test passed; counts stay consistent
- [ ] Mobile + a11y pass; lint + build clean; PR opened and URL reported
