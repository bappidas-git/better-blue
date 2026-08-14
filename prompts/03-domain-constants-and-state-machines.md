# Prompt 03 — Domain Constants, Enums, Permissions & State Machines

> **Before you start:** Read `prompts/00-architecture-and-rules.md` (especially §8–§11), then inspect the current project (Prompts 01–02).

## 1. Objective

Create the domain backbone: every role, status, enum, status-metadata map, state-transition machine, permission matrix, notification type, category fallback list, content-policy constants, and core utility modules (`stateMachine`, `formatters`, `validators`, `id`, `storage`, `images`). No UI in this prompt.

## 2. Context

00 §34-style consistency demands that status strings never appear as literals in components or services. This prompt defines them once; every later prompt imports from here. The future Laravel backend will mirror these exact values.

## 3. What Already Exists

Prompts 01–02: project foundation, theme/tokens, motion presets, logo.

## 4. What to Implement

1. `src/constants/roles.js` — `ROLES` (`buyer`, `creator`, `admin`, `super_admin`), `ROLE_META` (label, description), `ROLE_HOME_PATH` map (per 00 §9), `ADMIN_ROLES` array.
2. `src/constants/statuses.js` — every enum from 00 §9 as frozen objects: `ACCOUNT_STATUS`, `REQUEST_STATUS`, `PROPOSAL_STATUS`, `ORDER_STATUS`, `PAYMENT_STATUS`, `TRANSACTION_TYPE`, `DELIVERY_STATUS`, `CONTENT_STATUS`, `DISPUTE_STATUS`, `DISPUTE_RESOLUTION`, `PAYOUT_STATUS`, `AFFILIATE_PROFILE_STATUS`, `REFERRAL_STATUS`, `AFFILIATE_EARNING_STATUS`, `CONTENT_TYPE`, `REPORT_STATUS` (`open`, `reviewed`, `actioned`, `dismissed`), `TICKET_STATUS` (`open`, `pending`, `resolved`, `closed`), `USAGE_RIGHTS` (`organic_social`, `paid_ads`, `website`, `full_commercial`), `DISPUTE_CATEGORY` (`quality_issue`, `non_delivery`, `scope_mismatch`, `late_delivery`, `payment_issue`, `policy_concern`, `other`).
3. `STATUS_META` in the same file: for **every** status value above, `{ label, tone, description }` where `tone ∈ neutral|info|warning|success|error|brand` (drives `StatusChip` in Prompt 04). Labels are human/professional ("Under Review", "Payment Held", "Revision Requested").
4. `src/constants/stateMachines.js` — transition maps exactly per 00 §9 for `ORDER_STATUS`, plus: `REQUEST_STATUS` (`draft→open|cancelled`; `open→awarded|closed|cancelled`; `awarded→completed|cancelled`; ), `PROPOSAL_STATUS` (`submitted→shortlisted|accepted|declined|withdrawn|expired`; `shortlisted→accepted|declined|withdrawn`), `PAYMENT_STATUS` (`initiated→processing|failed`; `processing→held|failed`; `held→released|refunded|partially_refunded`), `DELIVERY_STATUS`, `CONTENT_STATUS` (`draft→submitted`; `submitted→under_review`; `under_review→approved|rejected|revision_required`; `approved→published`; `revision_required→submitted`; `published→restricted|archived`; `rejected→submitted`; `restricted→published|archived`), `DISPUTE_STATUS` (`open→under_review`; `under_review→awaiting_buyer|awaiting_creator|escalated|resolved`; `awaiting_buyer/awaiting_creator→under_review|resolved`; `escalated→resolved`; `resolved→closed`), `PAYOUT_STATUS` (`requested→processing|rejected`; `processing→paid`).
5. `src/utils/stateMachine.js` — `canTransition(machine, from, to)`, `assertTransition(machine, from, to)` (throws descriptive Error), `nextStates(machine, from)`.
6. `src/constants/permissions.js` — permission keys per 00 §11 plus `requests.manage`, `orders.manage`, `reports.manage`, `support.manage`, `announcements.send`, `affiliates.manage`, `audit.view`, `categories.manage`; `PERMISSION_META` (label + description per key); `DEFAULT_ADMIN_PERMISSIONS` (sensible subset); `hasPermission(user, key)` (super_admin → always true; admin → checks `user.permissions`; others → false); `PERMISSION_GROUPS` for UI grouping (Users, Content, Marketplace, Finance, Disputes & Support, Platform).
7. `src/constants/notificationTypes.js` — `NOTIFICATION_TYPE` values: `proposal_received`, `proposal_shortlisted`, `proposal_accepted`, `proposal_declined`, `order_paid`, `delivery_submitted`, `revision_requested`, `delivery_accepted`, `order_completed`, `payment_released`, `payout_processed`, `dispute_opened`, `dispute_message`, `dispute_resolved`, `moderation_approved`, `moderation_rejected`, `moderation_revision`, `account_status_changed`, `affiliate_conversion`, `affiliate_payout`, `system_announcement`; `NOTIFICATION_META` per type: `{ label, icon (iconify name), tone, category }` with `category ∈ marketplace|orders|payments|disputes|moderation|affiliate|system` (used for preference toggles later).
8. `src/constants/policy.js` — Content Policy structured data: array of policy sections `{ id, title, summary, rules[] }` covering: professional commercial content only; prohibited content (nudity, sexually explicit content, sexual services or solicitation, escort-related services, illegal content, exploitative content, any inappropriate content involving minors); intellectual-property honesty; respectful conduct; accurate representations. Also `REJECTION_REASONS` array `{ code, label, description }` (e.g. `policy_prohibited_content`, `low_production_quality`, `mismatch_with_brief`, `ip_violation`, `metadata_incomplete`, `other`) used by moderation. Tone: professional trust-and-safety language (00 §1).
9. `src/constants/images.js` — centralized imagery helpers: `imageUrl(seed, w, h)` → picsum seeded URL; `avatarDataUri(name, tint?)` → deterministic initials-avatar SVG data-URI using palette tints; `CATEGORY_IMAGE_SEEDS` map. All future imagery flows through this module.
10. `src/constants/categoriesFallback.js` — the 12 categories from 00 §1-adjacent list (Food & Beverage, Fashion & Apparel, Beauty & Skincare, Fitness & Wellness, Travel & Hospitality, Technology & SaaS, E-commerce Products, Home & Lifestyle, Automotive, Education & Coaching, Real Estate, Events & Entertainment) as `{ id: 'cat_…', name, slug, icon }` — used as offline fallback and by the seed script.
11. `src/constants/index.js` — barrel re-export.
12. Utilities: `src/utils/formatters.js` (`formatCurrency(amount, currency='USD')`, `formatDate`, `formatDateTime`, `formatRelativeTime` (dayjs), `formatNumberCompact`, `formatPercent`, `truncate`), `src/utils/validators.js` (`required`, `email`, `minLength`, `maxLength`, `min`, `max`, `url`, `pattern`, `oneOf`, `compose(...rules)` — each returns `undefined | message`), `src/utils/id.js` (`generateId(prefix)` → `prefix_` + timestamp36 + random36, commented `MOCK-DATA:` per 00 §8), `src/utils/storage.js` (namespaced localStorage helpers `bb.` prefix, JSON-safe, try/catch), `src/utils/exportCsv.js` (`exportRowsAsCsv(filename, columns, rows)` — client-side blob download; used by admin prompts).

## 5. Functional Requirements

Everything exported, frozen (`Object.freeze`), tree-shakeable, side-effect free. `STATUS_META` covers 100% of enum values (write a tiny dev-time completeness check that warns in console if a value lacks meta — run once at import in dev only).

## 6. UI/UX Requirements

None (no UI). Labels/descriptions written in polished product English — they surface verbatim in the UI later.

## 7. Technical Requirements

Plain JS modules; no React imports except none; dayjs only inside formatters; no circular imports (constants must not import from services/components).

## 8. API Requirements

None.

## 9. Data Requirements

Category IDs here must match the seed script (Prompt 05) — Prompt 05 imports this fallback list.

## 10. Files & Folders

Creates: `src/constants/{roles,statuses,stateMachines,permissions,notificationTypes,policy,images,categoriesFallback,index}.js`, `src/utils/{stateMachine,formatters,validators,id,storage,exportCsv}.js`.

## 11. Responsive Requirements

N/A.

## 12. Accessibility Requirements

N/A (labels here enable accessible UI later).

## 13. Validation & Error Handling

`assertTransition` throws with message naming machine/from/to; validators return user-friendly messages; storage helpers never throw.

## 14. Acceptance Criteria

- Importing any constant module in App and logging it works; dev completeness check reports no missing STATUS_META.
- `canTransition(ORDER_MACHINE, 'delivered', 'completed') === true`; `assertTransition(..., 'completed', 'in_progress')` throws.
- `formatCurrency(1250)` → `$1,250.00`; `avatarDataUri('Ava Martinez')` renders as an image in the dev gallery (add a small "Domain" section to DevDesignPage showing StatusChip-precursor swatches per tone, a generated avatar, and a picsum image — verifies image helpers).
- Lint + build clean.

## 15. Verification Steps

1. Add the temporary "Domain" section to the dev gallery and visually verify avatar + image helpers.
2. In dev console, exercise `canTransition`/`assertTransition` happy/sad paths.
3. `npm run lint && npm run build`.

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

`prompts/`, theme files (except the small dev-gallery addition), config files, dependency set.

## 18. Depends On

01, 02.

## 19. Final Checklist

- [ ] Every enum from 00 §9 defined + frozen + STATUS_META complete
- [ ] All transition maps implemented + stateMachine utils tested manually
- [ ] Permission matrix + hasPermission + groups defined
- [ ] Notification types with meta/categories defined
- [ ] Content policy + rejection reasons written professionally (00 §1 compliant)
- [ ] Image helpers centralized; utilities created; lint + build clean
- [ ] Report written
