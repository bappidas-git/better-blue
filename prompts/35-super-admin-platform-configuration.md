# Prompt 35 — Super Admin: Platform Configuration & Categories

> **Before you start:** Read `prompts/00-architecture-and-rules.md` (RBAC §11), then inspect Prompts 01–34 output (settingsService consumers across 17/23/25/30/32/34).

## 1. Objective

Build super-admin platform configuration: General, Commission, Affiliate, Moderation, and Feature-flag settings (all live-consumed by existing features), plus full category management — with validation, confirmation, audit, and cache invalidation so changes take effect immediately.

## 2. Context

Everything here edits the `platformSettings` singleton + `categories` collection that the whole app already reads through `settingsService`/`categoryService` caches. Routes are super_admin-only (`RoleRoute(['super_admin'])` at route level — stricter than permission gating; admins never see these).

## 3. What Already Exists

platformSettings schema + seeds (05), settingsService with cache+invalidate (07), consumers: commission (17/23/25), autoAcceptDays (20), payout minimums (25/34), moderation flags/SLA (24/30), feature flags (23/34), categoriesFallback + categoryService cache (03/07), admin kit (28), Platform nav group placeholder (28).

## 4. What to Implement

1. `AdminSettingsPage` (`/admin/settings`) — sub-navigation (tabs desktop / segmented list mobile; URL-synced): **General · Commissions · Affiliate · Moderation · Features**. Shared mechanics: per-section `useForm` from current settings, dirty-state save bar (Save / Discard, sticky mobile), save → confirm dialog summarizing changed keys (old → new) → `settingsService.updateSettings(patch)` (extend: PATCHes singleton, calls `invalidate()`, audit `settings.update` with diff meta, toast) → refetch; per-field validation; every field has helper text explaining its live effect + "Used by" hint.
2. **General** — platformName (read-mostly, 3–40), supportEmail (email), currency (select USD only + "More currencies later" note — display-only consistency), autoAcceptDays (2–14 int; helper: affects buyer review window display 20), payoutMinAmount ($10–$500; consumed by 25).
3. **Commissions** — defaultRate (percent input 5–40% stored decimal; live example line "On a $400 order: BetterBlue $80 · Creator $320" recomputed as typed); **category overrides table**: rows per category (name, override % or "Default" chip, edit/clear inline) → stored `categoryOverrides { catId: rate }`; validation same bounds; note card: rate changes affect **future** acceptances only (17 froze commissionRate on order snapshot — surface this truth); per-creator override slot noted as future (17's marked slot — keep note visible).
4. **Affiliate** — enabled toggle (mirrors features.affiliateProgram? **single source**: keep `affiliate.enabled` authoritative and have 34's flag checks read it — reconcile: useFeatureFlag reads features.*; resolve by making features.affiliateProgram the only switch and removing/ignoring affiliate.enabled — **choose features.* as single source**, migrate seed field, document), commissionRate (5–50% of platform commission; example line), attributionDays (7–90), payoutMinAmount; liability warning when lowering rate? (info note only).
5. **Moderation** — autoApproveDeliveries toggle (helper: off = every delivery queued; consumed 24/30), reviewSlaDays (1–7; drives AgeBadge tones 30), rejectionReasons manager (list editor over settings copy of codes? **REJECTION_REASONS live in constants (03) — decision: constants stay canonical for codes; settings stores optional custom additions `{ code, label }` appended in 30's selects; implement additions editor with slug-generated codes; document**).
6. **Features** — toggle list from `features` (affiliateProgram, publicRequestBoard, reviews, disputes) each with scope description + consumer list + confirm-on-disable (danger-flavored: "Hides X across the app immediately"); verify each toggle's live effect (23/34 use flags; reviews/disputes flags: wire `useFeatureFlag` gates into 20's review prompts + 26's raise-dispute entry points **now** if not already flag-aware — minimal guarded edits, report).
7. `AdminCategoriesPage` (`/admin/categories`) — table/cards: icon preview (iconify name), name, slug (auto from name, editable, unique), active toggle, sortOrder (up/down buttons), usage counts (creators tagged / requests — service-computed); Add/Edit dialog (name 3–30, slug, icon text field with live Iconify preview + suggestion hint list, active); **Deactivate** guard: category in use → warn with counts ("Existing content keeps it; hidden from new selections") — deactivation only, no deletion (documented); changes → `categoryService.invalidate()` + audit `category.*`; consumers (12/16/22/23 selects) show active-only — verify live.
8. navConfig: enable Settings + Categories (28's Platform group); 32's commissions pointer link resolves; route-level super_admin guard verified (admin direct-URL → role-home redirect per 09 guards... admin IS allowed at `/admin` — use `RoleRoute(['super_admin'])` nested wrapper → non-super admin hitting settings → AdminPageGuard-style "Super admin only" card; implement consistently).

## 5. Functional Requirements

Every setting change takes effect app-wide without reload beyond cache invalidation (spot-verify: commission example on Pricing page 11 + proposal earnings preview 23; autoApprove flip changes 24's moderation entries; flag off hides affiliate nav live); category lifecycle respected by all selects; audits carry old→new diffs.

## 6. UI/UX Requirements

Configuration-grade clarity: grouped cards, helper text everywhere, changed-field highlighting in confirm summary, danger flavor on feature disables; no accidental-save paths (dirty bar + confirm).

## 7. Technical Requirements

All writes through settingsService/categoryService (invalidate correctness); percent inputs store decimals via money-safe conversion; single-source flag resolution implemented + documented in data-model/contract; no consumer hardcodes remain (grep `0.2`/`autoAccept` literals).

## 8. API Requirements

`PATCH /platformSettings` + categories CRUD per contract; contract updated for flag single-sourcing + custom rejection additions.

## 9. Data Requirements

Seed migration for flag single-source (05 seed-data edit + reseed); usage counts computed live.

## 10. Files & Folders

Creates: `src/features/admin/settings/pages/{AdminSettingsPage,AdminCategoriesPage}.jsx`, `src/features/admin/settings/components/{SettingsSectionNav,GeneralSection,CommissionsSection,AffiliateSection,ModerationSection,FeaturesSection,CategoryDialog,SettingsSaveBar,ChangeSummaryDialog}.jsx`, service extensions. Updates: seeds (flag migration), 20/26 flag gates if missing, routes/navConfig, docs.

## 11. Responsive Requirements

Sections single-column mobile with sticky save; overrides table→cards; category reorder touch-friendly.

## 12. Accessibility Requirements

Percent inputs labeled with unit; toggles state-labeled; confirm summary readable list; icon preview has text name; reorder buttons labeled ("Move Food & Beverage up").

## 13. Validation & Error Handling

All bounds enforced inline; slug uniqueness; save failure keeps dirty state; partial consumer verification failures reported.

## 14. Acceptance Criteria

- Change matrix verified live: default rate → Pricing/proposal preview; category override → earnings preview in that category; autoApprove → 24 behavior; SLA → 30 badges; each feature flag → its surfaces; category deactivate → absent from 16/22/23 selects, present on old records.
- Non-super admin blocked from all pages here; audits with diffs present; caches invalidate (no stale reads after save).
- Lint + build clean.

## 15. Verification Steps

1. Reseed → run the full change matrix (revert via reseed at end).
2. Admin (non-super) direct-URL block test; audit-log inspection for diffs.
3. Categories lifecycle incl. in-use deactivation + consumer checks.
4. 360px + keyboard pass on forms/dialogs. `npm run lint && npm run build`.

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

Order-snapshot commission semantics (17), constants-canonical rejection codes (03 — additions only), consumer service APIs, `prompts/`.

## 18. Depends On

28 (kit/nav), consumers 17/20/23/24/25/26/30/32/34 (live-effect verification), 05 (seed migration).

## 19. Final Checklist

- [ ] Five settings sections + confirm-diff-save + audit + invalidation
- [ ] Flag single-sourcing resolved + documented; all four flags live-effective
- [ ] Categories CRUD/deactivate/reorder with consumer propagation
- [ ] Super-admin-only enforcement; change matrix verified
- [ ] Lint + build clean; report written
