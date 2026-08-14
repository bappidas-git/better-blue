# Prompt 30 — Admin Content Moderation (Queue, Review, Reports)

> **Before you start:** Read `prompts/00-architecture-and-rules.md` (§1 positioning, CONTENT_STATUS machine §9), then inspect Prompts 01–29 output (creator submission pipeline from 22/24 feeds this queue).

## 1. Objective

Build the trust-and-safety workspace: moderation queue (portfolio items + deliverables), the review detail interface (preview, metadata, policy reference, decisions with reasons), user-submitted reports handling, and the public "Report" entry points — completing the moderation lifecycle started in Prompt 22.

## 2. Context

Moderation is a normal professional marketplace safety system (00 §1) — the UI/copy must reflect that. Decisions drive CONTENT_STATUS transitions on the subject items and notify creators. Permission: `moderation.review` (reports: `reports.manage`).

## 3. What Already Exists

moderationReviews + reports collections seeded (05), submission writers (22 portfolio, 24 deliveries), CONTENT_STATUS machine + REJECTION_REASONS (03), policy constants + page (03/11), MediaLightbox (04), admin kit (28), `moderation_*` notification types (03/27 audit rows marked "arrives P30").

## 4. What to Implement

1. **Service workflow** (`moderationService` extensions): `claimForReview(reviewId, { reviewerId })` — `submitted → under_review` + reviewerId + history; `decide(reviewId, { decision: 'approve'|'reject'|'request_changes'|'restrict', notes, reasonCode?, actor })` — orchestrates: moderation record status (approve→`approved`, reject→`rejected` (reasonCode required), request_changes→`revision_required`, restrict→`restricted`), history append; **subject side-effects**: portfolio item status via machine (approved→`published` with publishedAt; rejected/revision_required mirror; restrict on published items); delivery subjects: record-only status (delivery stays buyer-visible; restrict → flag delivery file entry `restricted: true` + documented policy: restricted deliverables hidden from public reuse but order flow unaffected — keep simple, document); notify creator (`moderation_approved|moderation_rejected|moderation_revision` with reason label + notes); audit `moderation.<decision>`; `getQueueCounts()` for tab badges.
2. `AdminModerationPage` (`/admin/moderation`) — tabs: **Portfolio items** / **Deliverables** / **Reports** (counts); toolbar: status filter (submitted/under_review default-on; approved/rejected/etc. for history), category, date range, search (title/creator); queue as media-forward cards (thumbnail, title, creator (EntityRefChip → P29 user detail), category + type chips, StatusChip, submitted AgeBadge (SLA tone vs settings.reviewSlaDays), reviewer avatar when claimed); sort: Oldest first (default — queue discipline) / Newest; pagination; EmptyState positive ("Queue clear").
3. `AdminModerationDetailPage` (`/admin/moderation/:id`) — three-zone layout (desktop: preview left 60%, context right; mobile stacked):
   - **Preview** — MediaLightbox-grade viewer inline (image zoom-fit / video player); deliverables: file list with per-file preview switching.
   - **Context panel** — subject metadata (title, description, tags, category, type, submitted date), creator card (name, verified, prior stats: approved count / rejection count — service-computed, link to P29 detail), linked order card for deliveries (EntityRefChip), **policy reference** collapsible (renders `constants/policy.js` sections — same source as public page), **history** TimelineList (all state changes w/ actors/notes).
   - **Decision bar** (sticky bottom) — Claim (when submitted, sets under_review) → then: Approve (light confirm), Request changes (dialog: notes required 20–500), Reject (dialog: reasonCode select from REJECTION_REASONS + notes required + consequence copy), Restrict (published/approved subjects only; dialog w/ reason); post-decision → success toast + auto-advance to next queue item (queue-order aware; "Back to queue" alternative).
4. **Reports tab + handling** — reports list (reporter (or "Guest"), subject EntityRefChip (portfolio item/creator profile/request), reason, details clamp, StatusChip, AgeBadge); report detail SideSheet: full details + subject preview + actions: Dismiss (note optional), Action → contextual: portfolio subject → open its moderation record (create one `submitted` if none — service `ensureReviewForSubject`), creator subject → link to P29 user detail (suspend path), request subject → link to P31 (comment-gated until then); resolution sets report `reviewed|actioned|dismissed` + handledById + audit.
5. **Public report entry points** — add "Report" affordances: public creator profile (13) overflow menu + portfolio lightbox item action → `ReportDialog` (reason select [policy concern, inappropriate content, misleading, IP concern, other], details optional 0–500, submits via reportService — guest allowed w/o reporterId); professional copy ("Thanks — our Trust & Safety team will review"); rate-limit-feel: one report per subject per session (storage guard; documented).
6. navConfig: enable Moderation + Reports entries (28 gates); Overview moderation card + attention queue links resolve; 27's audit rows for moderation types now emit — update `docs/notifications-audit.md`.

## 5. Functional Requirements

Full lifecycle vs seeds: claim → decide each branch with correct subject transitions (rejected portfolio item shows reason to creator (22); approved becomes public (13)); auto-advance respects filters; SLA badges accurate; reports flow creates/links moderation records; queue counts/badges live.

## 6. UI/UX Requirements

Calm reviewer-focused workspace; media dominates; decisions one-tap-with-confirm; professional trust-and-safety tone everywhere (no sensational styling); auto-advance keeps reviewers in flow.

## 7. Technical Requirements

All transitions via machines in service; subject side-effects centralized in `decide`; policy text single-sourced; reviewer stats computed service-side.

## 8. API Requirements

Composite ops documented (claim/decide/ensureReviewForSubject); Laravel authorization warning reiterated.

## 9. Data Requirements

Seeds: queue depth ≥ 6 portfolio + ≥ 3 deliveries across submitted/under_review + decided history examples + 4 reports across subject types (verify; extend + reseed + report).

## 10. Files & Folders

Creates: `src/features/admin/moderation/pages/{AdminModerationPage,AdminModerationDetailPage}.jsx`, `src/features/admin/moderation/components/{QueueCard,SubjectPreview,ContextPanel,PolicyReference,DecisionBar,DecisionDialogs,ReportsTab,ReportDetailSheet}.jsx`, `src/features/reports/components/ReportDialog.jsx` (public-facing), service extensions. Updates: 13 (report entries), adminRoutes, navConfig, 28 gates, notifications audit doc.

## 11. Responsive Requirements

Detail stacks on mobile (preview → context → sticky decision bar); queue cards single-col 360px; dialogs full-screen mobile.

## 12. Accessibility Requirements

Preview alt/labels; decision bar buttons labeled with consequence; policy collapsible keyboard; history semantic; report dialog labeled; auto-advance announces new item (focus to title).

## 13. Validation & Error Handling

Reason/notes requirements enforced; decide on stale state → conflict toast + refetch; media load failure → filename fallback; queue standard states.

## 14. Acceptance Criteria

- Each decision branch verified end-to-end incl. creator-side visibility (22) and public publication (13); notifications + audit written.
- Reports: dismiss + action paths work incl. ensureReviewForSubject; public report entries create records.
- SLA badges match settings; auto-advance works; permission gating (`moderation.review`) proven.
- Lint + build clean.

## 15. Verification Steps

1. Reseed → approve/reject/request-changes/restrict cycle with db + cross-surface checks (creator portfolio, public profile).
2. Report round-trip: guest reports from public profile → admin actions it → moderation record linked.
3. Queue filters/sort/auto-advance; 360px + keyboard decision pass.
4. `npm run lint && npm run build`.

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

CONTENT_STATUS machine, creator submission flows (22/24 — consume their records), policy constants structure, `prompts/`.

## 18. Depends On

22, 24 (pipelines), 28 (kit), 29 (user links), 13 (report entries), 27 (notifications).

## 19. Final Checklist

- [ ] Queue (3 tabs, filters, SLA badges, counts) + review detail (preview/context/policy/history)
- [ ] Claim + 4 decision branches with side-effects, notifications, audit, auto-advance
- [ ] Reports pipeline + public report entry points
- [ ] Cross-surface effects verified; lint + build clean
- [ ] Report written
