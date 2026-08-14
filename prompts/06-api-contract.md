# Prompt 06 — API Contract Documentation

> **Before you start:** Read `prompts/00-architecture-and-rules.md` (especially §8, §10, §15), then inspect Prompts 01–05 output (particularly `docs/data-model.md` and `server/db.json`).

## 1. Objective

Write `docs/api-contract.md`: the complete REST API contract the frontend codes against — conventions, auth, errors, pagination, and per-resource endpoints with request/response examples — including the JSON-Server-mapping table for today and Laravel implementation notes for later.

## 2. Context

This is a documentation-only prompt (Requirement: the future Laravel developer must be able to build the real backend from this document alone, and Prompt 07 implements the client strictly against it). Clean REST design wins over mirroring db.json.

## 3. What Already Exists

Data model + seeds (05), enums (03). No API client yet.

## 4. What to Implement

Author `docs/api-contract.md` with these sections:

1. **Conventions** — base URL from env; JSON everywhere; resource naming (kebab/camel decision: use camelCase collection paths matching JSON Server today, with a note that Laravel will expose identical paths); ISO 8601 dates; opaque string IDs; standard verbs (GET list/detail, POST create, PATCH partial update, DELETE where allowed); idempotency notes.
2. **Authentication** — target contract: `POST /auth/login {email, password}` → `{ token, user }`; `POST /auth/register` → same; `GET /auth/me` → `{ user }`; `POST /auth/logout`. `Authorization: Bearer <token>` on all protected calls. Documented mock reality: JSON Server can't do this — the client's `authService` simulates these three operations over `/users` (per 00 §14) while preserving the exact same function signatures; Laravel (Sanctum) replaces it 1:1. Account-status rules (suspended/blacklisted → 403 with code).
3. **Error envelope** — `{ "error": { "code", "message", "details?" } }` with canonical codes (`validation_failed`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `payment_failed`, `rate_limited`, `server_error`) + HTTP status mapping. Note that the client normalizes any provider's failure into `ApiError` with these codes.
4. **List envelope, pagination, filtering, sorting** — standard params `page`, `limit`, `sort`, `order` (`asc|desc`), `search`, plus documented per-resource filters (exact-match `field=value`, ranges `field_gte/_lte`); standard response `{ items, total, page, limit }`. **JSON Server mapping table**: `page→_page`, `limit→_limit`, `sort→_sort`, `order→_order`, `search→q`, ranges pass-through; total from `X-Total-Count`; raw array normalized by the client's listAdapter. Laravel note: `page/per_page` + `meta.total` — adapter swap only.
5. **Uploads** — target: `POST /uploads` multipart → `{ file: { id, name, url, thumbnailUrl?, mediaType, sizeKb } }`; mock reality: `uploadService` simulates latency and returns placeholder URLs with real metadata; same return shape.
6. **Per-resource endpoint reference** — for each: purpose, auth/role, params/filters, request body, response example (trimmed real seed shapes), error cases. Cover: auth; users (+ `PATCH /users/:id` self-update; admin status actions); buyerProfiles; creatorProfiles (+ discovery listing `GET /creatorProfiles?availability=true&status…` with filters category/price range/rating/sort); portfolioItems; categories; contentRequests; proposals; orders; deliveries; revisions; payments; transactions; commissions; payouts; disputes; disputeMessages; reviews; notifications (+ mark-read pattern `PATCH /notifications/:id {read:true}`); moderationReviews (+ decision `PATCH` with status/notes/reasonCode/history append); reports; supportTickets; affiliateProfiles/affiliateReferrals/affiliateEarnings; auditLogs; platformSettings (`GET`, `PATCH` super-admin).
7. **Composite operations** — table of intention-level operations (acceptProposal, initiateOrderPayment, releasePayment, refundPayment, submitDelivery, acceptDelivery, requestRevision, resolveDispute, enrollAffiliate, processConversion, requestPayout, broadcastAnnouncement) listing: the sequence of REST calls the mock client performs today vs. the single dedicated Laravel endpoint recommended for tomorrow (e.g. `POST /orders/:id/release`). This is the heart of the migration story.
8. **Status & enum reference** — pointer to `src/constants` as source of truth + full value lists (roles, all statuses) so backend devs implement identical states.
9. **Security notes** — frontend guards are UX-only; Laravel must enforce authorization on every endpoint; never trust client-supplied ids/amounts; recompute money server-side.

## 5. Functional Requirements

Every collection in db.json is covered; every workflow the app will perform maps to documented endpoints; examples validate against seeded shapes.

## 6. UI/UX Requirements

N/A. Document formatting: clean Markdown, per-resource `###` sections, tables for params, fenced JSON examples.

## 7. Technical Requirements

Documentation only — **no application code changes** in this prompt.

## 8. API Requirements

Self-referential (this defines them).

## 9. Data Requirements

Examples must use realistic seeded data (copy/trim from db.json).

## 10. Files & Folders

Creates: `docs/api-contract.md`. Updates: root README (link to the contract).

## 11–12. Responsive / Accessibility

N/A.

## 13. Validation & Error Handling

Contract defines the validation error shape (`details: { field: message }`) that forms will surface.

## 14. Acceptance Criteria

- All 26 collections + auth + uploads documented with at least one request/response example each.
- Composite-operations table covers all 12 listed operations with mock-vs-Laravel columns.
- JSON Server mapping table complete; error codes table complete; no contradiction with `docs/data-model.md` or constants.

## 15. Verification Steps

1. Cross-check the contract's resource list against `server/db.json` keys — zero missing/extra.
2. Validate 3 sample responses against actual `curl` output shapes (modulo envelope normalization note).
3. `npm run lint && npm run build` still clean (nothing should have changed).

## 16. Constraints

Execution protocol per 00 §16 applies; this prompt is docs-only — do not modify `src/`.

## 17. Do NOT Change

Any application source, seeds, `prompts/`.

## 18. Depends On

03, 05.

## 19. Final Checklist

- [ ] Conventions/auth/errors/pagination/uploads sections complete
- [ ] Every resource + composite operation documented with examples
- [ ] JSON Server mapping + Laravel notes complete
- [ ] Consistent with data-model.md and constants; README linked
- [ ] Report written
