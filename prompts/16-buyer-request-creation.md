# Prompt 16 — Content Request Creation (Buyer)

> **Before you start:** Read `prompts/00-architecture-and-rules.md` (especially §1 content rules, §12 forms), then inspect Prompts 01–15 output.

## 1. Objective

Build the buyer's multi-step Content Request wizard at `/buyer/requests/new`: a polished, mobile-first, validated 4-step flow (Basics → Specifications → Budget & timeline → Review) with draft persistence and content-policy acknowledgment, creating `open` requests via the service layer.

## 2. Context

The request is the marketplace's seed object — creators browse and propose on it (Prompt 23). The wizard must produce records exactly matching the data model (05) so downstream flows work. Request listing/management arrives in Prompt 18; after submit, navigate to `BUYER_REQUESTS` if registered, else to buyer Overview with a success toast (decide by checking route registration at implementation time; leave TODO for 18 to normalize).

## 3. What Already Exists

Form system (`useForm`, Form fields, CurrencyField, FormDateField, FormFileField) (04), `requestService` CRUD (07), categories API, upload mock, StickyActionBar, buyer dashboard (15), USAGE_RIGHTS/CONTENT_TYPE constants (03).

## 4. What to Implement

1. `RequestWizardPage` (`src/features/requests/pages/`) — MUI Stepper (horizontal labels ≥ md; mobile: compact progress header "Step 2 of 4 — Specifications" + linear progress); step content animated (Framer slide/fade 200ms, direction-aware); Back/Next/Submit in StickyActionBar (mobile) / inline footer (desktop); step state machine in feature hook `useRequestWizard` (values via one `useForm`-per-step or single form with per-step validation groups — choose one, keep clean; document choice).
2. **Step 1 — Basics:** title (10–90 chars, counter, professional placeholder "e.g. 15 lifestyle photos for our new eco water bottle"), category (FormSelect from API), content type (CONTENT_TYPE choice cards with icons: Photos / Videos / Photo + Video bundle), description (60–2000 chars, guidance helper text listing what to include: product, audience, style, setting).
3. **Step 2 — Specifications:** quantity (stepper input 1–50), video duration seconds (visible when type includes video; select 15/30/60/90), orientation (chips: Portrait/Landscape/Square/Any), usage rights (radio cards from USAGE_RIGHTS with plain-language descriptions), brand guidelines (multiline, optional), do's (optional, chips-style multi-entry input — simple text list add/remove), don'ts (same), reference files (FormFileField multi ≤ 5, images only, via uploadService on submit — store returned file objects in `referenceUrls` as objects per data model? Data model says `referenceUrls[]` — align: store uploaded file objects' urls; keep metadata objects if model allows; follow data-model.md exactly and report if you adjust it).
4. **Step 3 — Budget & timeline:** budget type toggle (Fixed / Range), CurrencyField(s) (min $25; range: max > min), deadline (FormDateField, ≥ 3 days out, helper shows relative "in 12 days"), expected proposals note (static informational card: "Most requests receive 3–6 proposals in 48h").
5. **Step 4 — Review & submit:** read-only summary cards per step with "Edit" jump links; content-policy acknowledgment checkbox (required; links ContentPolicy) with professional copy ("This request complies with the BetterBlue Content Policy — commercial marketing content only"); Submit → `requestService.createRequest(payload)` (service method: uploads references, creates record status `open`, publishedAt now, proposalsCount 0, audit-free (buyer action), toast "Request published", navigate per §2 decision). Also "Save as draft" (any step, minimal validation: title only) → status `draft` via `requestService.saveDraft`; wizard supports `?draft=<id>` resume (loads draft into state).
6. **Draft autosave** — debounced (2s after change) silent save once a draft exists; "Saved" micro-indicator; drafts listed properly in Prompt 18 (until then reachable by URL — note in report).
7. Optional `?creator=` param (from Prompt 13 CTA) — stores `invitedCreatorId` hint on the request (data-model addition: document + update data-model.md + contract; used by Prompt 23 to badge "Invited" on that creator's board).
8. Wire entry points: buyer Overview QuickAction + navConfig "New request" (update 15's TODOs); route registration.

## 5. Functional Requirements

Per-step validation gates Next; jump-links from Review re-validate; refresh mid-wizard with a draft resumes cleanly; created record passes data-model shape (verify against seeds' request shape); video-only fields hidden/cleared for photo type; range budget stored min/max, fixed stores both equal.

## 6. UI/UX Requirements

Feels native on mobile: full-height steps, sticky actions, no keyboard-obscured inputs (scroll into view on focus); choice cards with selected ring; premium spacing; progress always visible; success moment (brief check animation on submit, reduced-motion safe).

## 7. Technical Requirements

All submit/draft logic in `requestService` (uploads + record shape centralized); wizard state in feature hook, presentational steps dumb; no route-string literals; TODO comments where Prompt 18 will adjust navigation.

## 8. API Requirements

`POST /contentRequests` per contract (+ uploads); draft PATCH; document `invitedCreatorId` addition in contract + data model.

## 9. Data Requirements

None required beyond writes; keep seed shape authoritative.

## 10. Files & Folders

Creates: `src/features/requests/pages/RequestWizardPage.jsx`, `src/features/requests/components/wizard/{StepBasics,StepSpecs,StepBudget,StepReview,WizardProgress,ChoiceCardGroup,ListEntryInput}.jsx`, `src/features/requests/hooks/useRequestWizard.js`, service methods (`createRequest`, `saveDraft`, `getDraft`). Updates: `buyerRoutes.jsx`, navConfig/Overview links (15 TODOs), docs (contract/data-model for invitedCreatorId).

## 11. Responsive Requirements

360px: single column, sticky actions, compact progress; 768+: centered 720px card; date picker usable on touch; chips wrap.

## 12. Accessibility Requirements

Stepper announces current step (`aria-current="step"`); choice cards = radiogroup keyboard semantics; per-step focus moves to step heading; counters via `aria-describedby`; policy checkbox properly labeled with link.

## 13. Validation & Error Handling

All rules above with inline messages; submit failure keeps state + error toast; upload failure per-file inline with remove/retry; draft-save failure silent-retry once then subtle warning.

## 14. Acceptance Criteria

- Complete wizard creates a valid `open` request visible via API; draft save/resume works incl. refresh; policy checkbox gates submit.
- Photo-type flow never shows video fields; range/fixed budget both store correctly.
- Mobile 360px run-through is smooth (no obscured inputs, sticky actions).
- Lint + build clean.

## 15. Verification Steps

1. Full happy path (bundle type, range budget, 2 reference files) → inspect db record shape vs data-model.md.
2. Draft: save at step 2 → refresh → resume → submit.
3. Validation matrix per step (short title, past deadline, max<min, unchecked policy).
4. 360px + keyboard-only run. `npm run lint && npm run build`.

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

Data-model field names (extend only with documentation), form components' APIs, `prompts/`.

## 18. Depends On

04, 07, 14, 15 (03 constants; 13 optional `?creator=` source).

## 19. Final Checklist

- [ ] 4-step wizard with per-step validation, animations, sticky mobile actions
- [ ] Draft save/autosave/resume; policy acknowledgment gate
- [ ] Service-centralized submit incl. uploads; record shape verified
- [ ] invitedCreatorId documented in contract + data model
- [ ] Lint + build clean; report written
