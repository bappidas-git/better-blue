# Prompt 37 — Quality Hardening Pass (Validation, A11y, Responsive, Performance, Motion, Security)

> **Before you start:** Read `prompts/00-architecture-and-rules.md` in full — this prompt enforces it everywhere. The complete application (Prompts 01–36) exists; this is a systematic audit-and-fix pass, not a feature prompt.

## 1. Objective

Audit the entire application against the 00-rules and fix every gap: forms/validation, error handling, loading/empty states, responsive behavior, accessibility, performance, animation discipline, and security-minded frontend practices — producing `docs/qa-checklist.md` with evidenced results.

## 2. Context

After 36 prompts of incremental building, drift is likely despite the rules. This pass makes the app release-grade before final integration (38). Fix issues as found; only defer with explicit justification in the report.

## 3. What Already Exists

Everything (01–36). `docs/` contains contract/data-model/payments/notifications-audit docs.

## 4. What to Implement

Work through these audits **in order**, fixing as you go, recording each check + result + fix in `docs/qa-checklist.md` (table per section):

1. **Forms & validation audit** — enumerate every form (auth ×3, buyer profile/settings, request wizard ×4 steps, proposal, checkout, revision/accept dialogs, review, portfolio item, delivery composer, dispute create/message, contact, withdraw ×2, admin dialogs: status/reason, moderation decisions, resolve, announcements, settings ×5, categories, create-admin). For each verify: client rules fire inline on blur+submit, first-invalid focus, submit disabled while pending, server-error surfaced, success feedback, no data loss on failure. Fix gaps.
2. **Error-handling audit** — kill JSON Server and walk each major route: every data surface must show `ErrorState` with working Retry (no blank screens/spinners-forever/console crashes); 401 revalidation path logs out gracefully; ErrorBoundary catches a forced render error on 3 sampled routes. Standardize any ad-hoc error UI found.
3. **Loading & empty audit** — route-by-route table: skeleton present + layout-matched (no jump), empty states per 00 §12 with actionable CTAs, no flash-of-empty before load. Fix.
4. **Responsive QA matrix** — all routes × {360, 600, 900, 1280, 1536}: no horizontal scroll, no overlap with bottom nav/sticky bars, tables→cards verified, dialogs→sheets verified, touch targets ≥ 44px, text truncation graceful. Document per-route; fix.
5. **Accessibility pass** — landmarks + single-h1 per page; heading hierarchy; every input labeled; icon-buttons aria-labeled (grep sweep `IconButton` without label); dialog traps/Escape/focus-return sampled ×6; keyboard-only journey: register→request→accept→pay→review (buyer) and propose→deliver (creator) completable; `:focus-visible` visible on samples; alt text sweep; color-contrast check of token combinations (document any AA fixes into theme); `aria-live` on toasts/counts verified; reduced-motion full-app sweep (landing GSAP, transitions, count-ups static; nothing stuck at opacity-0).
6. **Performance pass** — verify every route lazy (bundle inspection via `npm run build` output: reasonable chunking; GSAP/Recharts not in entry chunk); memoize verified-hot lists (discovery grid, tables, thread) where profiling shows re-render waste (no premature abstraction); images `loading="lazy"` + dimensions sweep; `useApiQuery` dependency arrays sane (no fetch loops — network tab idle check per route); dev console: zero warnings/errors across full click-through; remove dead code/unused imports (lint `no-unused-vars` at error already — sweep leftovers).
7. **Animation discipline** — durations ≤ tokens, transform/opacity only (grep animated properties), no scroll-jack, hover states consistent, entrance animations don't delay interactivity; kill any accidental double-animation (Framer+GSAP overlap).
8. **Security-minded frontend** — grep sweeps: no secrets/credentials outside env + seeds (demo passwords documented-only), no `dangerouslySetInnerHTML`, no `eval`/`new Function`, no raw `fetch`/`axios` outside api layer, no route literals outside paths.js, no status literals outside constants (spot greps: `"pending"`, `"approved"`, `'/buyer/'`); destructive-action confirm sweep (every remove/cancel/suspend/blacklist/refund/resolve confirmed per 00 §12); role-guard matrix test: for each role visit each foreign area root + 2 deep URLs (guards redirect correctly; PermissionGate blocks limited admin); uploaded-file metadata rendering escapes/limits filenames; document (again, in qa-checklist) that frontend guards are UX-only — Laravel must enforce.
9. **Copy & content sweep** — professional tone everywhere (no lorem ipsum, no placeholder-y "TODO" strings user-visible, no stray dev copy); terminology consistent with 00 glossary (Creator/Buyer/Content Request/Deliverable...); 100% business-safe content re-verified (images seeds, sample text).
10. **TEMP/TODO sweep** — grep `TEMP:`/`TODO`/comment-gated links from prompts 10–36; every remaining one must be resolved now or justified in report (stubs should all be gone by 36 — verify).

## 5. Functional Requirements

App behavior unchanged except fixes; all flows from prior prompts still pass their acceptance criteria (spot-run the big ones: marketplace loop, disputes, settlements, affiliate pipeline).

## 6. UI/UX Requirements

Fixes must follow existing patterns (00 §12) — no new visual language introduced during hardening.

## 7. Technical Requirements

Fixes additive/minimal; refactors only where an audit demands (documented); qa-checklist evidences everything (check, method, result, fix commit-note).

## 8. API Requirements

None new; error-path behaviors per contract.

## 9. Data Requirements

Reseed before/after; seeds untouched except documented gap fixes.

## 10. Files & Folders

Creates: `docs/qa-checklist.md`. Updates: fixes across `src/` as audits dictate (list every touched file in report, grouped by audit section).

## 11. Responsive Requirements

Section 4 matrix IS the requirement — completed and documented.

## 12. Accessibility Requirements

Section 5 pass IS the requirement — completed and documented.

## 13. Validation & Error Handling

Sections 1–3 completed with all gaps fixed.

## 14. Acceptance Criteria

- `docs/qa-checklist.md` complete: every audit section with per-item results; zero unfixed criticals; deferrals justified.
- Full click-through of all four roles with dev console clean; kill-API resilience on 10 sampled routes; keyboard journeys completable; reduced-motion sweep clean.
- All grep sweeps return clean (or documented exceptions); `npm run lint` (0 warnings), `npm run build`, `npm run smoke:api`, `npm run smoke:workflow` all pass.

## 15. Verification Steps

1. Execute audits 1–10 in order, fixing inline, logging to qa-checklist.
2. Re-run the three big cross-role flows end-to-end after fixes.
3. Final: lint + build + both smokes + console-clean click-through.

## 16. Constraints

Execution protocol per 00 §16: inspect first · minimal diffs · reuse patterns · JS/JSX only · no new dependencies · Node 18.19.0 · keep app functional · report changes/assumptions/issues (grouped by audit).

## 17. Do NOT Change

Feature behavior/scope, service semantics, seeds (beyond documented fixes), visual identity, `prompts/`.

## 18. Depends On

All of 01–36 (final-form app required).

## 19. Final Checklist

- [ ] All 10 audits executed with documented evidence + fixes
- [ ] Grep sweeps clean (secrets, literals, raw fetch, dangerous APIs, TEMP/TODO)
- [ ] Role-guard matrix + keyboard journeys + reduced-motion + kill-API passes
- [ ] Lint (0 warnings) + build + smokes green; console clean
- [ ] qa-checklist.md complete; report written
