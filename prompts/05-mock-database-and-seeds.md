# Prompt 05 — Mock Database: Data Model & Seed System

> **Before you start:** Read `prompts/00-architecture-and-rules.md` (especially §1 content rules, §8 domain model, §9 enums), then inspect Prompts 01–04 output.

## 1. Objective

Design the complete `server/db.json` data model and build a deterministic Node seed system (`npm run seed`) that generates rich, realistic, **business-safe** data for every collection, plus `docs/data-model.md` documenting each entity and its future MySQL mapping.

## 2. Context

JSON Server serves this database as the REST backend for the whole prototype. The structure must be normalized enough to map cleanly onto Laravel/MySQL later. Seed data powers every subsequent feature prompt and must let each role's flows be tested immediately (e.g., buyer flows need seeded proposals from creators before creator UI exists).

## 3. What Already Exists

Constants/enums/state machines (03) — the seed script **must import status values and category list from `src/constants/`** (plain JS modules; import via relative paths from scripts) so data and app never drift. Placeholder `server/db.json` (01).

## 4. What to Implement

1. `scripts/seed-data/` modules, one per domain, exporting plain arrays/factories: `users.js`, `profiles.js`, `categories.js`, `portfolio.js`, `requests.js`, `proposals.js`, `orders.js` (also deliveries/revisions), `finance.js` (payments/transactions/commissions/payouts), `disputes.js`, `reviews.js`, `notifications.js`, `moderation.js` (moderationReviews/reports), `support.js`, `affiliate.js`, `audit.js`, `settings.js`.
2. `scripts/seed-db.js` — assembles all collections, validates referential integrity (every FK resolves; statuses ∈ enums; every order's payment/transaction chain consistent), computes derived aggregates (creator `ratingAvg`/`ratingCount`/`completedOrders`, request `proposalsCount`, unread notification counts), then writes pretty-printed `server/db.json`. Deterministic — no randomness; re-running produces identical output. Exit non-zero with a clear message on any integrity failure.
3. **Entity schemas** (document in `docs/data-model.md`; implement in seeds) — field lists per collection:
   - `users`: id, email, password (plain — `MOCK-AUTH` comment; documented), role, accountStatus, name, avatarUrl, phone?, createdAt, lastLoginAt, notificationPrefs `{ categoryKey: { inApp: bool } }`, permissions[] (admins only), referredByCode?.
   - `buyerProfiles`: id, userId, companyName, industry, website, bio, location, logoUrl, totalSpent, createdAt.
   - `creatorProfiles`: id, userId, displayName, tagline, bio, categories[] (catIds), contentTypes[], startingPrice, currency, location, languages[], responseTimeHours, availability (bool), featured (bool), verified (bool), ratingAvg, ratingCount, completedOrders, payoutMethod `{ type:'bank', accountName, accountMasked }`?, createdAt.
   - `portfolioItems`: id, creatorId (creatorProfile id), title, description, categoryId, contentType, tags[], mediaUrl, thumbnailUrl, mediaType, status (CONTENT_STATUS), visibility (`public`/`unlisted`), rejectionReason?, submittedAt, publishedAt?, createdAt.
   - `categories`: id, name, slug, icon, active, sortOrder (from `categoriesFallback.js`).
   - `contentRequests`: id, buyerId, title, description, categoryId, contentType, quantity, videoDurationSec?, orientation (`portrait|landscape|square|any`), usageRights, brandGuidelines, dos, donts, referenceUrls[], budgetType (`fixed|range`), budgetMin, budgetMax, currency, deadline, status, proposalsCount, awardedProposalId?, createdAt, publishedAt?.
   - `proposals`: id, requestId, creatorId, coverMessage, price, currency, deliveryDays, revisionsIncluded, sampleItemIds[] (portfolio refs), status, createdAt, respondedAt?.
   - `orders`: id, requestId, proposalId, buyerId, creatorId, title, categoryId, contentType, price, currency, commissionRate, commissionAmount, creatorEarnings, revisionsIncluded, revisionsUsed, deliveryDueAt, status, activatedAt?, deliveredAt?, completedAt?, cancelledAt?, createdAt.
   - `deliveries`: id, orderId, version, message, files[] `{ id, name, url, thumbnailUrl?, mediaType, sizeKb }`, status, revisionId? (which revision it answers), submittedAt, respondedAt?.
   - `revisions`: id, orderId, deliveryId, requestedById, notes, createdAt, resolvedAt?.
   - `payments`: id, orderId, buyerId, amount, currency, provider (`dummy`), method `{ brand:'visa', last4 }`, status (PAYMENT_STATUS), heldAt?, releasedAt?, refundedAt?, refundedAmount?, failureReason?, createdAt.
   - `transactions`: id, type (TRANSACTION_TYPE), orderId?, paymentId?, payoutId?, userId (beneficiary/payer), amount (signed), currency, description, balanceAfter?, createdAt.
   - `commissions`: id, orderId, rate, baseAmount, amount, currency, createdAt.
   - `payouts`: id, creatorId, amount, currency, method summary, status, requestedAt, processedAt?, rejectedReason?.
   - `disputes`: id, orderId, raisedById, againstId, category, description, evidence[] (file metadata), status, assignedAdminId?, resolution? `{ outcome, amountRefunded?, note, resolvedById, resolvedAt }`, createdAt, updatedAt.
   - `disputeMessages`: id, disputeId, authorId, authorRole, body, attachments[], internal (bool — admin-only note), createdAt.
   - `reviews`: id, orderId, requestId, buyerId, creatorId, rating (1–5), comment, createdAt.
   - `notifications`: id, userId, type, title, body, entityType?, entityId?, read, createdAt.
   - `moderationReviews`: id, subjectType (`portfolio_item|delivery`), subjectId, creatorId, status (CONTENT_STATUS subset), reviewerId?, notes?, reasonCode?, history[] `{ at, byId, fromStatus, toStatus, note? }`, submittedAt, reviewedAt?.
   - `reports`: id, reporterId?, subjectType (`portfolio_item|creator_profile|request`), subjectId, reason, details, status, handledById?, createdAt.
   - `supportTickets`: id, name, email, userId?, subject, body, status, replies[] `{ byId, body, at }`, createdAt.
   - `affiliateProfiles`: id, userId, code, status, clicks, signups, conversions, pendingEarnings, approvedEarnings, paidEarnings, enrolledAt.
   - `affiliateReferrals`: id, affiliateId, referredUserId, status, convertedOrderId?, createdAt, convertedAt?.
   - `affiliateEarnings`: id, affiliateId, referralId, orderId, amount, currency, status, createdAt, approvedAt?, paidAt?.
   - `auditLogs`: id, actorId, actorRole, action (dot-namespaced e.g. `user.suspend`, `moderation.approve`, `dispute.resolve`, `settings.update`), entityType, entityId, meta (object), createdAt.
   - `platformSettings`: singleton object — general `{ platformName, supportEmail, currency, autoAcceptDays: 5, payoutMinAmount: 50 }`, commission `{ defaultRate: 0.2, categoryOverrides: {} }`, affiliate `{ enabled: true, commissionRate: 0.1, attributionDays: 30, payoutMinAmount: 25 }`, moderation `{ autoApproveDeliveries: true, reviewSlaDays: 2, rejectionReasons: [...codes] }`, features `{ affiliateProgram: true, publicRequestBoard: true, reviews: true, disputes: true }`.
4. **Seed volumes & scenarios** (deterministic, professional): 1 super admin, 3 admins (varied permission subsets), 8 buyers (realistic businesses: "Verde Kitchen", "Nimbus Fitness", "Atlas Travel Co", "Bloom Beauty", "Craftware Tools", "UrbanNest Interiors", "Pulse SaaS", "Cocoa & Co"), 12 creators (varied categories/prices/ratings, 3 featured, 1 suspended, 1 pending portfolio approvals); ~60 portfolio items (mostly published; several submitted/under_review/rejected/revision_required for the moderation queue); 12 categories; 16 requests across all statuses; ~32 proposals (each open request 2–4, incl. shortlisted/declined/withdrawn); 14 orders covering **every** ORDER_STATUS incl. one pending_payment, several in_progress/delivered/revision_requested, completed with released payments, one disputed, one refunded, one cancelled; matching deliveries/revisions; full payment+transaction+commission chains consistent with order states; 3 payouts (requested/processing/paid); 5 disputes across statuses with message threads (incl. internal admin notes); ~25 reviews consistent with creator aggregates; notifications for demo users (mixed read/unread); 10+ moderation queue entries; 4 reports; 4 support tickets; 3 affiliate profiles with referrals/earnings across states; ~40 audit logs; settings singleton.
5. **Demo accounts** (fixed emails/passwords, documented in root README + docs): `buyer@betterblue.test`, `creator@betterblue.test`, `admin@betterblue.test`, `super@betterblue.test` — password `Password123!` — plus note that all seeded users share it.
6. Update npm script `seed` if needed; run `npm run seed`; commit generated `server/db.json`.
7. `docs/data-model.md` — every collection: purpose, fields table, relations, status enum reference, MySQL mapping notes (types, indexes, FK constraints), plus decisions: no orderItems (single-item orders), settings singleton → key-value table in MySQL, plain-text passwords are MOCK-AUTH only.

## 5. Functional Requirements

`GET http://localhost:4000/<collection>` works for every collection; `GET /platformSettings` returns the singleton; filtered queries (`/proposals?requestId=req_…`) return coherent linked data; every demo account can drive its role's flows with meaningful data on first login.

## 6. UI/UX Requirements

N/A (data only) — but all names/titles/descriptions must read like a real professional marketplace (00 §1/§22): e.g. request "15 lifestyle photos for eco water-bottle launch", portfolio "30-second smoothie promo reel for a juice bar". Zero adult/sexualized/suggestive content anywhere.

## 7. Technical Requirements

Plain Node 18 (CommonJS or ESM consistently — scripts may use `.js` with `require` or align with package `"type"`; keep consistent with Prompt 01 setup); no dependencies; imports enum values from `src/constants` (ensure import style compatibility — if the app is ESM, make scripts ESM too); pretty-print 2-space JSON; images via the same picsum-seed pattern as `constants/images.js`.

## 8. API Requirements

Collections named exactly per 00 §8 — these become JSON Server routes and the basis of the API contract (Prompt 06).

## 9. Data Requirements

Everything in section 4. Integrity rule: for each order, `commissionAmount = round(price × commissionRate, 2)` and `creatorEarnings = price − commissionAmount`; transaction rows must sum consistently; timestamps chronologically sane (created < activated < delivered < completed) and within the last ~120 days.

## 10. Files & Folders

Creates: `scripts/seed-db.js`, `scripts/seed-data/*.js` (16 modules), `server/db.json` (generated), `docs/data-model.md`. Updates: root `README.md` (demo accounts + seed instructions).

## 11. Responsive Requirements

N/A.

## 12. Accessibility Requirements

N/A.

## 13. Validation & Error Handling

Seed integrity validator (FKs, enums, money math, chronology) with actionable failure messages; `npm run seed` idempotent.

## 14. Acceptance Criteria

- `npm run seed` regenerates byte-identical `server/db.json` on consecutive runs.
- Integrity validator passes; intentionally breaking an FK locally fails loudly (then revert).
- `npm run api` serves all collections; spot-check 6 endpoints incl. `?requestId=` filter and `/platformSettings`.
- All content professional/business-safe; demo accounts documented; lint (scripts covered by override) + build clean.

## 15. Verification Steps

1. `npm run seed` twice → `git diff server/db.json` empty the second time.
2. Start `npm run api`; curl/browse: `/users?role=creator`, `/contentRequests?status=open`, `/proposals?requestId=<seeded>`, `/orders?status=disputed`, `/moderationReviews?status=submitted`, `/platformSettings`.
3. Skim db.json for content-policy compliance (professional copy only).
4. `npm run lint && npm run build`.

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only (scripts are plain JS) · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

`src/constants` values (seed adapts to constants, never the reverse), app source besides README, `prompts/`.

## 18. Depends On

01, 03 (04 not required).

## 19. Final Checklist

- [ ] All 26 collections seeded per schemas; volumes/scenarios covered incl. every order status
- [ ] Deterministic + integrity-validated seed; db.json committed
- [ ] Demo accounts seeded + documented
- [ ] docs/data-model.md complete with MySQL mapping notes
- [ ] 100% business-safe content; lint + build clean; report written
