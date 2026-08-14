# Prompt 22 — Creator Portfolio Management & Moderation Submission

> **Before you start:** Read `prompts/00-architecture-and-rules.md` (especially §1 content policy, CONTENT_STATUS machine §9), then inspect Prompts 01–21 output.

## 1. Objective

Build the creator's portfolio manager at `/creator/portfolio`: create/edit portfolio items with mock media upload, submit them into the moderation lifecycle (draft → submitted → under_review → approved/published | rejected | revision_required), manage visibility, and handle rejection/resubmission — feeding both the public profile (13) and the admin moderation queue (30).

## 2. Context

Portfolio items require **pre-publication moderation** (00 §8-adjacent policy): only `published` items appear publicly. Every submission creates/updates a `moderationReviews` record the admin queue consumes. Status transitions strictly follow the CONTENT_STATUS machine.

## 3. What Already Exists

CONTENT_STATUS + machine + REJECTION_REASONS (03), portfolioService + moderationService baselines (07), uploadService (07), MediaLightbox/StatusChip/EmptyState/ConfirmDialog (04), public gallery consuming published items (13), seeded items across statuses (05).

## 4. What to Implement

1. **Service workflow** (`portfolioService` extensions): `createItem(creatorId, payload)` (status `draft`), `updateItem`, `submitForReview(itemId)` — guards machine (`draft|rejected|revision_required → submitted`); sets status `submitted`, creates or updates linked moderationReview (status `submitted`, history append, submittedAt), notify—none (creator's own action), toast handled by UI; `archiveItem` (guards from `published|rejected|draft`), `setVisibility(itemId, 'public'|'unlisted')` (published items only; unlisted = hidden from public gallery but shareable-by-link later — for now just excluded from public queries; document). Note: admin decisions (approve→published etc.) arrive in Prompt 30 via moderationService — this prompt only reads those outcomes.
2. `CreatorPortfolioPage` — header: PageHeader + "Add item" primary; **status summary chips** row (counts: Published, In review (submitted+under_review), Needs changes (revision_required), Rejected, Drafts, Archived) acting as filters; grid of `PortfolioManageCard`s (thumbnail w/ type badge, title, category, StatusChip, visibility icon (public/unlisted) on published, updated date; kebab: Edit, Submit for review (state-gated), Visibility toggle, Archive, View public (published only)); rejected/revision cards show reason banner (reasonCode label + reviewer notes from moderationReview) + "Fix & resubmit" primary action; EmptyState per filter (fresh: "Show buyers what you create — add your first sample").
3. `PortfolioItemDialog` (create/edit; ResponsiveDialog full-screen mobile) — fields: media upload (FormFileField single; image or video ≤ 25MB mock; preview player/img; replace action), title (8–80), description (30–600, professional guidance placeholder), category (API select), content type (auto from file, editable), tags (ListEntryInput ≤ 6), brand-credit optional ("Created for: e.g. local juice bar campaign"); footer: Save draft / Save & submit for review (runs both service calls); edit on published item → confirm warning ("Editing re-submits this item for review; it stays live until re-approved"? **Decision — keep simpler rule:** editing a published item moves it to `submitted` and unpublishes until approval; confirm dialog states this clearly; document the policy in payments-style note within moderation section of docs? Add to `docs/data-model.md` moderation notes).
4. **Submission feedback** — after submit: toast "Submitted for review — typically reviewed within {settings.moderation.reviewSlaDays} days"; card shows In review state; content-policy inline reminder link in dialog footer ("All items must meet the Content Policy").
5. **Public propagation checks** — published + public items appear on public profile/gallery + discovery strips; anything else never leaks (verify queries in portfolioService.listPublished handle visibility).
6. navConfig append: Portfolio (badge: revision_required + rejected count); route registered; Overview (21) QuickAction TODO resolved.

## 5. Functional Requirements

Full lifecycle works with machine guards (attempt invalid transition → friendly error); moderationReviews records created/updated with history entries; rejection info surfaces accurately from seeded rejected items; resubmission resets to submitted + updates moderation record; archived items hidden publicly, restorable? (archived → no restore in v1; document).

## 6. UI/UX Requirements

Grid matches public gallery aesthetic (13) with management chrome; status colors from STATUS_META; dialog polished on mobile (media preview above fields, sticky footer actions); upload progress indicator (mock latency visible).

## 7. Technical Requirements

All transitions service-side with assertTransition; moderation record writes inside portfolioService.submitForReview (single orchestration point); no admin-only logic here.

## 8. API Requirements

Per contract (portfolioItems CRUD + moderationReviews create/patch); update contract composite table with `submitForReview`.

## 9. Data Requirements

Seeds already span all statuses incl. reasoned rejections (verify richness: at least 1 revision_required with notes; extend + reseed + report if not).

## 10. Files & Folders

Creates: `src/features/portfolio/pages/CreatorPortfolioPage.jsx`, `src/features/portfolio/components/{PortfolioManageCard,PortfolioItemDialog,StatusSummaryChips,RejectionBanner,VisibilityToggle}.jsx`, portfolioService extensions. Updates: creatorRoutes, navConfig, 21 TODO, docs note on edit-republish policy.

## 11. Responsive Requirements

360px: 2-col grid, full-screen dialog, chips scroll; 900+: 3–4 col; kebab menus touch-friendly.

## 12. Accessibility Requirements

Cards labeled (title + status); kebab `aria-label`; dialog focus trap + labeled media input; status chips text not color-only; rejection banners `role="status"`.

## 13. Validation & Error Handling

Field rules above; upload type/size errors inline; submit-for-review failure keeps draft state + toast; machine-violation errors humanized.

## 14. Acceptance Criteria

- Create → draft → submit → appears in moderation collection (db verify) with history; seeded approval visible as Published and public; rejected → fix → resubmit works.
- Edit-published policy enforced as decided + documented; visibility toggle affects public gallery.
- Badge counts correct; lint + build clean.

## 15. Verification Steps

1. Reseed → full lifecycle walk with db inspection at each transition.
2. Public leak check: unlisted/rejected/archived absent from public profile + discovery strip.
3. 360px + keyboard dialog pass; upload error cases.
4. `npm run lint && npm run build`.

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

CONTENT_STATUS machine (03), public gallery components (13) beyond consuming fixes, admin moderation scope (30), `prompts/`.

## 18. Depends On

13, 14, 21 (03/04/07 foundations).

## 19. Final Checklist

- [ ] Portfolio manager with status filters, cards, kebab actions, badges
- [ ] Item dialog (upload, fields, draft/submit) + edit-republish policy
- [ ] Moderation records + history written on submission/resubmission
- [ ] Public propagation + leak checks pass
- [ ] Lint + build clean; report written
