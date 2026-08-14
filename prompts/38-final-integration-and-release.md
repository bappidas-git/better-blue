# Prompt 38 — Final Integration, Release Build & Migration Documentation

> **Before you start:** Read `prompts/00-architecture-and-rules.md`. Prompts 01–37 are complete and hardened. This prompt certifies the whole system, produces the release build, and finalizes documentation — including the Laravel migration guide.

## 1. Objective

Run full end-to-end certification of every workflow across all four roles, verify the route/role matrix and JSON Server integration, produce a clean production build, and finalize all project documentation (root README, E2E walkthrough script, Laravel/MySQL migration guide, docs index).

## 2. Context

Last prompt. Output = a client-ready prototype: `npm install && npm run seed && npm run dev:all` on Node 18.19.0 gives a complete, professional BetterBlue marketplace, with documentation that lets a backend developer replace JSON Server with Laravel/MySQL confidently.

## 3. What Already Exists

The complete hardened application (01–37) + docs (api-contract, data-model, payments, notifications-audit, qa-checklist).

## 4. What to Implement

1. **`docs/e2e-walkthrough.md`** — scripted certification scenario (write it, then execute it fully, checking off):
   1. `npm run seed` fresh; `npm run dev:all`.
   2. **Public**: landing (API sections live), discovery filters, creator profile, request board, info pages, report-content entry.
   3. **Buyer journey**: register fresh buyer (via seeded affiliate link `/r/CODE` for later verification) → complete profile → create request (full wizard + draft resume) → login demo creator (second browser/profile) → submit proposal → buyer: shortlist/compare/accept → checkout declined card → retry success (escrow held) → creator delivers → buyer requests revision → creator redelivers → buyer accepts (release + commission) → buyer reviews creator (public aggregate updates) → affiliate conversion recorded (first completed order).
   4. **Disputes**: second seeded order → buyer raises dispute → creator replies → admin assigns, requests info, resolves partial refund → both parties see outcome; ledger verified.
   5. **Creator finance**: earnings reconcile → withdraw → admin settlements approve → paid → creator sees payout + notification.
   6. **Moderation**: creator adds portfolio item → admin approves (public) + rejects another (creator sees reason) → deliverable spot-review; report handled.
   7. **Admin ops**: user suspend/reactivate cycle, announcement broadcast, support reply, escrow/commissions review.
   8. **Super admin**: commission rate change (verify live effect on new proposal preview), category add + use, feature flag off/on (affiliate), create limited admin → verify permission reality → audit explorer shows the session's trail.
   9. **Notifications**: bell/page/preferences suppression test across the above.
   Record every step's result; **fix anything that fails and re-run that section**.
2. **Route × role verification matrix** — final table in walkthrough doc: every path in `paths.js` × {guest, buyer, creator, admin, limited-admin, super_admin} → expected outcome (render/redirect/guard-block), executed via spot-checks per row group; all pass.
3. **JSON Server integration verification** — `npm run smoke:api` + `npm run smoke:workflow` green on fresh seed; verify reseed idempotence; confirm `server/db.json` untouched by builds.
4. **Production build certification** — `npm run build` clean → `npm run preview`: full smoke of key flows against preview build (SPA deep links, lazy chunks load, env correctness); document build output summary (chunk sizes) in walkthrough; verify no dev-only surfaces leak (`/dev/design` gated out, demo-account panel + test-card panel hidden when `VITE_ENABLE_DEV_PAGES=false` — test a prod-flag build).
5. **`docs/laravel-migration-guide.md`** — the handoff document: architecture recap (what's mock, where isolated); step-by-step swap plan: (1) implement contract endpoints (link api-contract sections + composite-op table → recommended Laravel routes/controllers), (2) MySQL schema from data-model.md (tables/FKs/indexes/enums DDL sketch), (3) auth swap (Sanctum tokens ↔ authService functions 1:1), (4) listAdapter laravel branch (exact param/meta mapping to implement), (5) uploads (real storage ↔ uploadService shape), (6) payment provider (real gateway behind paymentProvider interface + webhook → escrow transitions; server-side money authority), (7) id generation moves server-side, (8) server-side jobs (auto-accept, attribution expiry, notification fan-out, audit immutability), (9) authorization enforcement warning (frontend guards UX-only — full endpoint-permission table), (10) env changes (`VITE_API_BASE_URL`, `VITE_API_PROVIDER=laravel`) + what must NOT change (constants/status values shared); migration test plan (run e2e-walkthrough against Laravel).
6. **Root `README.md` final** — polished: product summary (professional commercial UGC marketplace), feature list by role, tech stack, Node 18.19.0 + install/run/seed instructions, demo accounts table, scripts table, project structure overview, docs index (links to all docs/), screenshots placeholder section, license/ownership note.
7. **Docs index** — `docs/README.md` linking all documents with one-line purposes.
8. **Release tidy** — version `1.0.0` in package.json; final `npm run lint`/`build`; remove any residual console.log noise (grep, excluding intentional dev warnings); confirm `.env.example` accurate; final professional-content spot sweep.

## 5. Functional Requirements

Every walkthrough step passes on the final build; fixes made during certification re-verified; no regressions vs 37's qa-checklist.

## 6. UI/UX Requirements

No changes beyond certification fixes.

## 7. Technical Requirements

Fixes minimal-diff; documentation accurate to the code as-built (verify every documented command/path by running/checking it).

## 8. API Requirements

Contract doc final-checked against implemented services (drift fixed in doc or code, reported).

## 9. Data Requirements

Final seed regenerated + committed; demo accounts verified.

## 10. Files & Folders

Creates: `docs/e2e-walkthrough.md`, `docs/laravel-migration-guide.md`, `docs/README.md`. Updates: root `README.md`, `package.json` (version), certification fixes.

## 11. Responsive Requirements

Preview-build spot-checks include 360px on 5 key flows.

## 12. Accessibility Requirements

No regressions (37's results stand); walkthrough includes one keyboard-only buyer flow re-run.

## 13. Validation & Error Handling

Certification includes one kill-API resilience re-check on the preview build.

## 14. Acceptance Criteria

- e2e-walkthrough fully executed with all steps checked; route×role matrix all-pass; smokes green; reseed idempotent.
- Production preview certified incl. prod-flag build hiding dev surfaces.
- Migration guide complete + accurate; README/docs index final; version 1.0.0; lint+build clean.
- Final report: project summary, everything changed in this prompt, known limitations list (honest: mock auth, client-side orchestration, no real-time, no email), recommended next steps.

## 15. Verification Steps

The walkthrough (§4.1–4.4) **is** the verification — executed in full, twice where fixes occurred. Finish with: fresh-clone simulation (`rm -rf node_modules && npm install && npm run seed && npm run dev:all` on Node 18.19.0) → 10-minute spot tour.

## 16. Constraints

Execution protocol per 00 §16: inspect first · minimal diffs · JS/JSX only · no new dependencies · Node 18.19.0 · keep everything green · exhaustive final report.

## 17. Do NOT Change

Feature scope, architecture, seeds beyond regeneration, `prompts/`.

## 18. Depends On

All of 01–37.

## 19. Final Checklist

- [ ] e2e-walkthrough written + fully executed (all roles, all workflows) with fixes re-verified
- [ ] Route×role matrix all-pass; smokes green; fresh-clone install certified on Node 18.19.0
- [ ] Production build + prod-flag build certified
- [ ] laravel-migration-guide + README + docs index finalized; version 1.0.0
- [ ] Final report with known limitations + next steps written
