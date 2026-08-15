# BetterBlue Data Model

The mock database lives in `server/db.json` and is served by JSON Server on
port 4000. It is **generated** — never hand-edit it. Change a module under
`scripts/seed-data/` and run `npm run seed`.

This document is the reference for every collection: what it is for, its
fields, how it links to the rest of the model, and how it maps onto MySQL when
the Laravel backend replaces JSON Server (00 §15).

---

## 1. Regenerating the database

```bash
npm run seed              # validate, then write server/db.json
node scripts/seed-db.js --check   # validate only, write nothing
```

The seed is **deterministic**: it contains no `Date.now()` and no
`Math.random()`, and every timestamp is derived from a fixed anchor
(`SEED_ANCHOR` in `scripts/seed-utils.js`, currently `2026-08-14T09:00:00Z`).
Two consecutive runs produce byte-identical output, so `server/db.json` is
committed and diffs cleanly. Bumping `SEED_ANCHOR` re-ages the whole dataset —
that is the intended way to move the data window forward.

If any integrity check fails, the script prints every problem and exits
non-zero **without writing the file**.

### Seed layout

| File | Produces |
|---|---|
| `scripts/seed-db.js` | Assembly, derived aggregates, integrity validation, file output |
| `scripts/seed-utils.js` | Shared date/money/id helpers and seed-local enum-likes |
| `scripts/seed-data/users.js` | `users` |
| `scripts/seed-data/profiles.js` | `buyerProfiles`, `creatorProfiles` |
| `scripts/seed-data/categories.js` | `categories` |
| `scripts/seed-data/portfolio.js` | `portfolioItems` |
| `scripts/seed-data/requests.js` | `contentRequests` (+ the history engagement table) |
| `scripts/seed-data/proposals.js` | `proposals` |
| `scripts/seed-data/orders.js` | `orders`, `deliveries`, `revisions` |
| `scripts/seed-data/finance.js` | `payments`, `transactions`, `commissions`, `payouts` |
| `scripts/seed-data/disputes.js` | `disputes`, `disputeMessages` |
| `scripts/seed-data/reviews.js` | `reviews` |
| `scripts/seed-data/notifications.js` | `notifications` |
| `scripts/seed-data/moderation.js` | `moderationReviews`, `reports` |
| `scripts/seed-data/support.js` | `supportTickets` |
| `scripts/seed-data/affiliate.js` | `affiliateProfiles`, `affiliateReferrals`, `affiliateEarnings` |
| `scripts/seed-data/audit.js` | `auditLogs` |
| `scripts/seed-data/settings.js` | `platformSettings` |

Every status, role, permission, category, notification type, and rejection
reason is **imported from `src/constants/`** — the seed adapts to the
constants, never the other way round.

---

## 2. Demo accounts

Password for **every** seeded account: `Password123!`

| Role | Email | Person | What they can demonstrate |
|---|---|---|---|
| Buyer | `buyer@betterblue.test` | Nora Whitfield, Verde Kitchen | An open brief with 4 proposals, an order awaiting revision, completed orders, reviews, and five months of payments behind the spend chart |
| Buyer (fresh account) | `newbuyer@betterblue.test` | Ruth Alvarez, Harbor Lane Bakery | The first-run state: no briefs, no orders, no notifications, and a profile with only a company name — the dashboard shows its onboarding checklist instead of stats |
| Creator | `creator@betterblue.test` | Ava Martinez | A shortlisted proposal, an in-progress order, a revision request, released payments, a paid payout, an affiliate profile with earnings |
| Admin | `admin@betterblue.test` | Maya Chen | Moderation queue, two live disputes, support tickets, user management, audit log |
| Super admin | `super@betterblue.test` | Elena Marsh | Everything above plus the admin team, permissions, and platform settings |

`MOCK-AUTH`: passwords are stored in **plain text** because JSON Server cannot
authenticate. `authService` compares them client-side (00 §14). None of these
values is a secret, and the Laravel backend replaces the column with a hashed
credential and real sessions.

---

## 3. Conventions

### Identifiers

Opaque strings with an entity prefix (00 §8): `usr_`, `bpr_`, `cpr_`, `pfi_`,
`cat_`, `req_`, `prp_`, `ord_`, `dlv_`, `rev_`, `pay_`, `txn_`, `com_`, `pyo_`,
`dsp_`, `dmsg_`, `rvw_`, `ntf_`, `mod_`, `rpt_`, `tkt_`, `aff_`, `ref_`,
`aer_`, `aud_`. Two embedded records also carry ids: delivery files (`dfl_`)
and dispute evidence (`evd_`).

Seeded ids are readable on purpose (`usr_creator_ava`, `ord_007`). Records
created at runtime get theirs from `src/utils/id.js`, which the Laravel backend
replaces with server-side generation.

### Which id does a foreign key point at?

This is the one place the model needs care, because creators have both an
account and a profile:

- **`portfolioItems.creatorId` → `creatorProfiles.id`.** Portfolio work belongs
  to the marketplace profile that displays it.
- **`contentRequests.invitedCreatorId` → `creatorProfiles.id`** (Prompt 16).
  It is copied from the storefront the buyer clicked "Start a request" on, so
  it names the profile, not the account. See §5 `contentRequests`.
- **Every other `creatorId` and every `buyerId` → `users.id`** (proposals,
  orders, reviews, payouts, disputes, moderation reviews, affiliate records).
  Those flows involve accounts: authentication, notifications, money, and
  enforcement all address the account, not the storefront.
- `reports.subjectId` is polymorphic and *does* point at `creatorProfiles.id`
  when `subjectType` is `creator_profile`, because a report is about the public
  listing.

The integrity validator enforces every one of these, so a mistake fails the
seed rather than reaching the app.

### Money

Decimal numbers plus a `currency` field, always `"USD"` in this prototype.
Formatting happens only through `formatCurrency`. The commission rule (00 §9)
holds for every order:

```
commissionAmount = round(price × commissionRate, 2)
creatorEarnings  = price − commissionAmount
```

### Dates

ISO 8601 strings, formatted through the dayjs helpers in `formatters.js`.

**Lifecycle timestamps are always present and `null` until the event happens**
(`activatedAt`, `deliveredAt`, `completedAt`, `cancelledAt`, `submittedAt`,
`publishedAt`, `respondedAt`, `heldAt`, `releasedAt`, `refundedAt`,
`processedAt`, `resolvedAt`, `reviewedAt`, `convertedAt`, `approvedAt`,
`paidAt`). They map to nullable `DATETIME` columns, and UI code can rely on the
key existing.

**Other optional fields are omitted entirely when they do not apply**
(`rejectionReason`, `assignedAdminId`, `resolution`, `failureReason`,
`refundedAmount`, `videoDurationSec`, `payoutMethod`, `permissions`,
`referredByCode`, `entityType`/`entityId`, `reasonCode`, `notes`, …).

Every timestamp sits inside the last ~120 days and never in the future. The one
exception is a *target* date rather than an event: `contentRequests.deadline`
and `orders.deliveryDueAt` may be in the future.

### Enum-likes not yet in `src/constants`

Prompt 05 may not modify `src/constants` (§17), so a few small string sets are
owned by `scripts/seed-utils.js` and documented here. A later prompt that needs
them in the app should promote them into `src/constants` and re-point the seed —
which is what Prompt 16 did with `ORIENTATION` and `BUDGET_TYPE`: both now live
in `src/constants/statuses.js` (with `STATUS_META` entries) and `seed-utils.js`
re-exports them, so the seed's imports did not change. What is left:

| Constant | Values | Used by |
|---|---|---|
| `MEDIA_TYPE` | `image`, `video` | `portfolioItems.mediaType`, delivery files, dispute evidence |
| `VISIBILITY` | `public`, `unlisted` | `portfolioItems.visibility` |
| `REPORT_REASON` | `prohibited_content`, `intellectual_property`, `misleading_claims`, `spam`, `other` | `reports.reason` |

`MODERATION_SUBJECT`, `REPORT_SUBJECT`, and `ENTITY_TYPE` (the polymorphic
link targets used by notifications, audit logs, moderation reviews, and
reports) live in the same module.

---

## 4. What the integrity validator checks

`scripts/seed-db.js` refuses to write a dataset that does not hold together:

1. **Shape** — every collection is a non-empty array (`platformSettings` is a
   singleton object), every id is unique and carries the right prefix.
2. **Foreign keys** — 52 declared relations plus polymorphic
   `entityType`/`subjectType` references and nested author ids
   (`moderationReviews.history[].byId`, `supportTickets.replies[].byId`,
   `disputes.resolution.resolvedById`).
3. **Enums** — every status-like field is a member of its enum in
   `src/constants/statuses.js`; admin permissions exist in `permissions.js`;
   only admins carry a `permissions` array.
4. **Money** — the commission rule above; one commission row per released
   order; payment amounts equal their order price; refunds never exceed the
   charge; the per-order ledger nets to the platform's commission; no account
   ever holds a negative balance; a payout never exceeds the balance earned by
   the time it was requested; affiliate commission equals the configured share
   of the platform commission.
5. **Chronology** — everything inside the seed window and not in the future;
   accounts exist before anything they touch; request → proposal → order →
   delivery → completion ordering; notifications and audit entries never
   predate what they point at.
6. **Workflow coherence** — every `ORDER_STATUS` and `REQUEST_STATUS` is
   represented; one accepted proposal per awarded brief; one order per brief;
   payment status matches order status; disputes belong to a party on the
   order; resolved disputes carry a resolution and vice versa; reviews only
   exist on completed orders; demo accounts exist and can sign in.
7. **Content policy** — a term sweep over every string, so a careless edit
   cannot introduce content that breaches 00 §1.

### Derived aggregates

These are **computed during the seed**, never hand-written, so they cannot
contradict the underlying rows:

| Field | Derived from |
|---|---|
| `contentRequests.proposalsCount` | count of proposals on the request |
| `contentRequests.awardedProposalId` | the accepted proposal, else `null` |
| `creatorProfiles.ratingAvg` / `ratingCount` | reviews for that creator (avg to 1 decimal) |
| `creatorProfiles.completedOrders` | orders with status `completed` |
| `buyerProfiles.totalSpent` | payments held/released/partially-refunded, net of refunds |
| `transactions.balanceAfter` | running BetterBlue balance for creators and affiliates |
| `affiliateProfiles.pendingEarnings` / `approvedEarnings` / `paidEarnings` | affiliate earnings by status |

**Unread notification counts are deliberately not stored.** The app derives
them with `GET /notifications?userId=<id>&read=false`; denormalising a counter
the UI mutates on every "mark as read" would just be a second source of truth.
The seed reports the totals in its summary.

---

## 5. Collections

Sizes below are what the current seed produces.

### `users` — 24

Every account: 1 super admin, 3 admins, 8 buyers, 12 creators.

| Field | Type | Notes |
|---|---|---|
| `id` | string | `usr_…` |
| `email` | string | unique; the sign-in identifier |
| `password` | string | **MOCK-AUTH plain text** — see §2 |
| `role` | enum | `ROLES`: `buyer` \| `creator` \| `admin` \| `super_admin` |
| `accountStatus` | enum | `ACCOUNT_STATUS`; accounts are never deleted (00 §9) |
| `name` | string | person's name — the business name lives on `buyerProfiles` |
| `avatarUrl` | string | initials SVG data URI from `constants/images.js` |
| `phone` | string? | optional |
| `createdAt`, `lastLoginAt` | datetime | |
| `notificationPrefs` | object | `{ [NOTIFICATION_CATEGORY]: { inApp: bool } }`, all 7 categories |
| `permissions` | string[]? | **admins only**; keys from `permissions.js` |
| `referredByCode` | string? | the affiliate code that brought them in |

**MySQL** `users` — `id CHAR(36) PK`, `email VARCHAR(191) UNIQUE`,
`password VARCHAR(255)` (hashed), `role`/`account_status` as `ENUM` or a lookup
table, `notification_prefs JSON`, `referred_by_code VARCHAR(32)` indexed.
Admin permissions become a pivot table `admin_permissions(user_id, permission)`
rather than a JSON column, so they can be queried and constrained.

### `buyerProfiles` — 8

The business behind a buyer account.

| Field | Type | Notes |
|---|---|---|
| `id` | string | `bpr_…` |
| `userId` | FK → `users.id` | one profile per buyer |
| `companyName`, `industry`, `website`, `bio`, `location` | string | |
| `logoUrl` | string | initials SVG data URI |
| `totalSpent` | decimal | **derived** |
| `createdAt` | datetime | |

**MySQL** `buyer_profiles` — `user_id` UNIQUE FK `ON DELETE CASCADE`,
`total_spent DECIMAL(12,2)`. `totalSpent` is a cache: recompute it from
`payments` rather than trusting the column.

### `creatorProfiles` — 12

The creator's storefront: what they sell, where, and how well it has gone.

| Field | Type | Notes |
|---|---|---|
| `id` | string | `cpr_…` |
| `userId` | FK → `users.id` | one profile per creator |
| `displayName`, `tagline`, `bio`, `location` | string | |
| `categories` | string[] | FKs → `categories.id` |
| `contentTypes` | enum[] | `CONTENT_TYPE` |
| `startingPrice` | decimal | + `currency` |
| `languages` | string[] | |
| `responseTimeHours` | int | |
| `availability`, `featured`, `verified` | bool | |
| `ratingAvg`, `ratingCount`, `completedOrders` | number | **derived** |
| `payoutMethod` | object? | `{ type: 'bank', accountName, accountMasked }` — masked tail only, never an account number |
| `createdAt` | datetime | |

**MySQL** `creator_profiles` — `user_id` UNIQUE FK; `categories` becomes
`creator_profile_categories(creator_profile_id, category_id)` and
`contentTypes` becomes `creator_profile_content_types`; `rating_avg
DECIMAL(2,1)`, `starting_price DECIMAL(10,2)`. Payout details move to a
`payout_methods` table under the account, encrypted at rest. Index
`(featured, rating_avg DESC)` for the discovery grid.

### `portfolioItems` — 68

Creator sample work. 52 published, plus submitted / under review / changes
requested / rejected items for the moderation queue, one restricted item (acted
on after a member report), one archived, and two private drafts.

| Field | Type | Notes |
|---|---|---|
| `id` | string | `pfi_…` |
| `creatorId` | FK → **`creatorProfiles.id`** | see §3 |
| `title`, `description` | string | |
| `categoryId` | FK → `categories.id` | |
| `contentType` | enum | `CONTENT_TYPE` |
| `tags` | string[] | |
| `mediaUrl`, `thumbnailUrl` | string | seeded picsum URLs keyed on the item id |
| `mediaType` | enum | `MEDIA_TYPE` |
| `status` | enum | `CONTENT_STATUS` |
| `visibility` | enum | `VISIBILITY` |
| `rejectionReason` | string? | present only on rejected items |
| `submittedAt` | datetime | `null` while a draft |
| `publishedAt` | datetime | `null` until published |
| `createdAt` | datetime | |

**MySQL** `portfolio_items` — FK to `creator_profiles`; `tags` becomes
`portfolio_item_tags`; index `(status, published_at DESC)` for the public grid
and `(creator_profile_id, status)` for the creator's own list.

### `categories` — 12

Generated from `src/constants/categoriesFallback.js`, so the API, the offline
fallback, and `CATEGORY_ID` can never drift.

| Field | Type | Notes |
|---|---|---|
| `id` | string | `cat_…` |
| `name`, `slug`, `icon` | string | `icon` is an Iconify `tabler:*` name |
| `active` | bool | |
| `sortOrder` | int | display order = array order in the constants file |

**MySQL** `categories` — `slug VARCHAR(64) UNIQUE`, index `(active, sort_order)`.

### `contentRequests` — 54

Buyer briefs. 24 hand-written scenario briefs cover every `REQUEST_STATUS` and
host the 14 scenario orders; 30 archived briefs back the completed engagement
history (see §6).

| Field | Type | Notes |
|---|---|---|
| `id` | string | `req_…` |
| `buyerId` | FK → `users.id` | |
| `title`, `description` | string | |
| `categoryId` | FK → `categories.id` | |
| `contentType` | enum | `CONTENT_TYPE` |
| `quantity` | int | deliverables requested |
| `videoDurationSec` | int? | video and bundle briefs only |
| `orientation` | enum | `ORIENTATION` |
| `usageRights` | enum | `USAGE_RIGHTS` |
| `brandGuidelines`, `dos`, `donts` | string | free text, one paragraph each |
| `referenceUrls` | string[] | |
| `budgetType` | enum | `BUDGET_TYPE`; `fixed` sets `budgetMin === budgetMax` |
| `budgetMin`, `budgetMax` | decimal | + `currency` |
| `deadline` | datetime | **may be in the future** |
| `invitedCreatorId` | FK? → `creatorProfiles.id` | optional; see below |
| `status` | enum | `REQUEST_STATUS` |
| `proposalsCount` | int | **derived** |
| `awardedProposalId` | FK? → `proposals.id` | **derived**; `null` until awarded |
| `createdAt` | datetime | |
| `publishedAt` | datetime | `null` while a draft |
| `closedAt` | datetime? | set by `closeRequest`; absent otherwise |
| `cancelledAt` | datetime? | set by `cancelRequest`; absent otherwise |
| `closureReason` | string? | the buyer's note, shared with the proposers |

`closedAt`, `cancelledAt`, and `closureReason` were **added in Prompt 18**
(request management) and are absent on every seeded brief. Only
`requestService.closeRequest` and `requestService.cancelRequest` write them,
and the request's Activity timeline is the only thing that reads them — it is
derived from timestamps rather than from an event log, so a brief that ended
before these fields existed simply shows the event undated.

**Drafts may be incomplete.** A brief written by the wizard but never finished
leaves the unanswered fields **absent** — `contentType`, `usageRights`,
`orientation`, `budgetType`, and the budget and deadline can all be missing on
a `draft`, and on nothing else (the seed's integrity check enforces exactly
that). `requestService.missingPublishFields` reads those gaps to tell the buyer
what is still needed before the draft can go live. `req_008` in the seed is
deliberately half-written so that path is demonstrable.

`invitedCreatorId` was **added in Prompt 16** (request wizard). It records the
creator a buyer arrived from — the "Start a request" CTA on a public profile
carries `?creator=cpr_…` into the form — and is absent on every seeded brief.
Note it points at `creatorProfiles.id`, not `users.id`, because it comes from
the storefront being viewed; that makes it the second exception to the rule
above, alongside `portfolioItems.creatorId`. It is a **hint, not an award**: the
brief still goes to the whole marketplace, and Prompt 23 uses it only to badge
that creator's proposal as "Invited".

**MySQL** `content_requests` — `reference_urls` becomes
`content_request_references`; index `(status, published_at DESC)` for the board
and `(buyer_id, status)` for "my requests". `awarded_proposal_id` and
`invited_creator_id` are nullable FKs; add `awarded_proposal_id` after
`proposals` exists to avoid a circular constraint at migration time.

### `proposals` — 94

Creator offers. Live briefs carry 2–4 each (submitted / shortlisted / declined
/ withdrawn), the closed brief carries expired offers, and every order has the
accepted offer that created it plus the offers that lost.

| Field | Type | Notes |
|---|---|---|
| `id` | string | `prp_…` |
| `requestId` | FK → `contentRequests.id` | |
| `creatorId` | FK → `users.id` | |
| `coverMessage` | string | |
| `price` | decimal | + `currency`; becomes `orders.price` when accepted |
| `deliveryDays`, `revisionsIncluded` | int | the terms offered |
| `sampleItemIds` | string[] | FKs → `portfolioItems.id`, published items only |
| `status` | enum | `PROPOSAL_STATUS` |
| `createdAt` | datetime | |
| `respondedAt` | datetime | when the buyer acted; `null` while `submitted` |

**MySQL** `proposals` — UNIQUE `(request_id, creator_id)` so a creator cannot
propose twice; `sample_item_ids` becomes `proposal_samples`; index
`(creator_id, status)`.

### `orders` — 42

The funded engagement. **One order = one request + one accepted proposal**
(00 §8) — there is deliberately no `orderItems` table.

| Field | Type | Notes |
|---|---|---|
| `id` | string | `ord_…` |
| `requestId`, `proposalId` | FK | one order per request |
| `buyerId`, `creatorId` | FK → `users.id` | |
| `title`, `categoryId`, `contentType` | — | copied from the request at award time, so later edits cannot rewrite history |
| `price` | decimal | + `currency`; equals the accepted proposal price |
| `commissionRate` | decimal | from `platformSettings.commission` at award time |
| `commissionAmount`, `creatorEarnings` | decimal | see the money rule in §3 |
| `revisionsIncluded`, `revisionsUsed` | int | `revisionsUsed` equals the number of revision records |
| `deliveryDueAt` | datetime | **may be in the future** |
| `status` | enum | `ORDER_STATUS` |
| `activatedAt` | datetime | funded; `null` while `pending_payment`/`cancelled` |
| `deliveredAt` | datetime | latest delivery |
| `completedAt` | datetime | accepted |
| `cancelledAt` | datetime | terminated without completion — set for `cancelled` **and** `refunded` |
| `createdAt` | datetime | the moment the proposal was accepted |

**MySQL** `orders` — `request_id` UNIQUE; `commission_rate DECIMAL(5,4)`, money
`DECIMAL(10,2)`; index `(buyer_id, status)`, `(creator_id, status)`,
`(status, delivery_due_at)` for the overdue view.

### `deliveries` — 37

One record per delivered **version**. Asking for changes closes that version at
`revision_requested`; the next submission is a new record (Prompt 03's
documented decision in `stateMachines.js`).

| Field | Type | Notes |
|---|---|---|
| `id` | string | `dlv_…` |
| `orderId` | FK | |
| `version` | int | 1-based, per order |
| `message` | string | the creator's handover note |
| `files` | object[] | `{ id (dfl_…), name, url, thumbnailUrl, mediaType, sizeKb }` |
| `status` | enum | `DELIVERY_STATUS` |
| `revisionId` | FK? → `revisions.id` | the revision this version answers |
| `submittedAt` | datetime | |
| `respondedAt` | datetime | `null` while awaiting the buyer |

**MySQL** `deliveries` — UNIQUE `(order_id, version)`; `files` becomes a
`delivery_files` table (`id`, `delivery_id`, `name`, `path`, `thumbnail_path`,
`media_type`, `size_kb`). Real uploads replace the seeded URLs; the mock upload
service is isolated behind `uploadService` (00 §15).

### `revisions` — 3

A buyer's request for changes against a specific delivery.

| Field | Type | Notes |
|---|---|---|
| `id` | string | `rev_…` |
| `orderId`, `deliveryId` | FK | |
| `requestedById` | FK → `users.id` | always the order's buyer |
| `notes` | string | what needs to change |
| `createdAt` | datetime | |
| `resolvedAt` | datetime | `null` while the creator is still working |

**MySQL** `revisions` — index `(order_id, created_at)`.

### `payments` — 43

Buyer payments into escrow. One per order, plus retries: the `pending_payment`
order carries a `failed` attempt and a `processing` retry.

| Field | Type | Notes |
|---|---|---|
| `id` | string | `pay_…` |
| `orderId`, `buyerId` | FK | |
| `amount` | decimal | equals `orders.price` |
| `provider` | string | `dummy` — payments are mocked (00 §15) |
| `method` | object | `{ brand: 'visa', last4 }` |
| `status` | enum | `PAYMENT_STATUS` |
| `heldAt`, `releasedAt`, `refundedAt` | datetime | escrow milestones |
| `refundedAmount` | decimal? | present on refunded / partially refunded payments |
| `failureReason` | string? | present on failed payments |
| `createdAt` | datetime | |

Status is bound to the order: `held` while work is under way or disputed,
`released` on completion, `partially_refunded` after a partial-refund
resolution, `refunded` after a full refund.

**MySQL** `payments` — index `(order_id, status)`; add the real provider's
`provider_reference` column when the dummy provider is replaced. Never store a
full card number — `method` keeps a brand and a masked tail only.

### `transactions` — 106

The ledger. `amount` is **signed from the perspective of `userId`**: money
leaving that account is negative, money arriving is positive.

| Field | Type | Notes |
|---|---|---|
| `id` | string | `txn_…`, numbered in chronological order |
| `type` | enum | `TRANSACTION_TYPE` |
| `orderId`, `paymentId`, `payoutId` | FK? | whichever applies |
| `userId` | FK → `users.id` | the payer or beneficiary |
| `amount` | decimal | signed |
| `description` | string | human-readable ledger line |
| `balanceAfter` | decimal? | **derived**; `null` for rows that do not move a BetterBlue balance |
| `createdAt` | datetime | |

Per order:

| Order status | Rows |
|---|---|
| `pending_payment`, `cancelled` | none — nothing was ever collected |
| `in_progress`, `delivered`, `revision_requested`, `disputed` | `charge` (buyer, −price) |
| `completed` | `charge`, `release` (creator, +settled base), `commission` (creator, −fee) |
| `completed` after a partial refund | the above plus `partial_refund` (buyer, +refund) |
| `refunded` | `charge`, `refund` (buyer, +price) |

`release + commission` nets to the creator's earnings, and the whole set nets
to the commission BetterBlue retained. Only `release`, `commission`, `payout`,
and `affiliate_commission` move a platform balance — a buyer's `charge` settles
against their card, which is why `balanceAfter` is `null` on those rows.

**MySQL** `transactions` — append-only; index `(user_id, created_at)` for the
earnings statement and `(order_id)` for the order ledger. `balance_after` is a
convenience cache; the balance of record is `SUM(amount)` over the account.

### `commissions` — 31

BetterBlue's fee, written when escrow is released. Exactly one per released
order.

| Field | Type | Notes |
|---|---|---|
| `id` | string | `com_…` |
| `orderId` | FK | |
| `rate` | decimal | matches `orders.commissionRate` |
| `baseAmount` | decimal | the amount actually settled: `price − refunded` |
| `amount` | decimal | `round(baseAmount × rate, 2)` |
| `createdAt` | datetime | the release moment |

`baseAmount` differs from `orders.price` only when a dispute returned part of
the payment: the order keeps the agreed terms, and the commission follows the
money that actually changed hands.

**MySQL** `commissions` — `order_id` UNIQUE; index `(created_at)` for revenue
reporting.

### `payouts` — 4

Creator settlements to a bank account, covering every `PAYOUT_STATUS`
(`requested`, `processing`, `paid`, `rejected`).

| Field | Type | Notes |
|---|---|---|
| `id` | string | `pyo_…` |
| `creatorId` | FK → `users.id` | |
| `amount` | decimal | + `currency`; never below `platformSettings.general.payoutMinAmount` |
| `method` | object | `{ type: 'bank', accountName, accountMasked }` snapshot |
| `status` | enum | `PAYOUT_STATUS` |
| `requestedAt` | datetime | |
| `processedAt` | datetime | `null` while `requested` |
| `rejectedReason` | string? | present on rejected payouts |

Only a `paid` payout writes a `payout` transaction — that is the moment money
leaves the balance.

**MySQL** `payouts` — index `(creator_id, status)`; the method snapshot is kept
on the row so a later change to the creator's bank details cannot rewrite a
historical settlement.

### `disputes` — 5

Trust & Safety casework: one just opened and untriaged, one under review with
an admin assigned, two resolved (a full refund and a partial refund), and one
closed in the creator's favour. All three `DISPUTE_RESOLUTION` outcomes appear.

| Field | Type | Notes |
|---|---|---|
| `id` | string | `dsp_…` |
| `orderId` | FK | |
| `raisedById`, `againstId` | FK → `users.id` | both must be parties to the order |
| `category` | enum | `DISPUTE_CATEGORY` |
| `description` | string | the opening statement |
| `evidence` | object[] | `{ id (evd_…), name, url, thumbnailUrl, mediaType, sizeKb }` |
| `status` | enum | `DISPUTE_STATUS` |
| `assignedAdminId` | FK? → `users.id` | absent until triaged |
| `resolution` | object? | `{ outcome, amountRefunded?, note, resolvedById, resolvedAt }` |
| `createdAt`, `updatedAt` | datetime | |

`resolution.amountRefunded` always matches the payment's `refundedAmount`, and
is omitted for a `release_payment` outcome.

**MySQL** `disputes` — index `(status, created_at)` for the queue and
`(assigned_admin_id, status)` for "my cases"; `evidence` becomes
`dispute_evidence`; the resolution becomes columns on the row
(`resolution_outcome`, `resolution_amount`, `resolution_note`, `resolved_by`,
`resolved_at`) or its own `dispute_resolutions` table.

### `disputeMessages` — 18

The case thread.

| Field | Type | Notes |
|---|---|---|
| `id` | string | `dmsg_…` |
| `disputeId` | FK | |
| `authorId` | FK → `users.id` | |
| `authorRole` | enum | `ROLES`, denormalised for rendering |
| `body` | string | |
| `attachments` | object[] | same file shape as evidence |
| `internal` | bool | **admin-only note** — never render to a buyer or creator |
| `createdAt` | datetime | |

**MySQL** `dispute_messages` — index `(dispute_id, created_at)`. `internal`
must be filtered **server-side**; hiding it in the client is not access control
(00 §11).

### `reviews` — 29

The buyer's rating of a completed engagement. One review per order, and only on
completed orders. Two archived orders were never reviewed, which is why a
creator's `ratingCount` can legitimately trail their `completedOrders`.

| Field | Type | Notes |
|---|---|---|
| `id` | string | `rvw_…` |
| `orderId`, `requestId` | FK | must agree with each other |
| `buyerId`, `creatorId` | FK → `users.id` | must match the order |
| `rating` | int | 1–5 |
| `comment` | string | |
| `createdAt` | datetime | after `orders.completedAt` |

**MySQL** `reviews` — `order_id` UNIQUE (one review per order); index
`(creator_id, created_at DESC)`; `rating TINYINT` with a `CHECK` between 1
and 5.

### `notifications` — 41

The in-app bell feed, generated from events that exist in the data.

| Field | Type | Notes |
|---|---|---|
| `id` | string | `ntf_…` |
| `userId` | FK → `users.id` | recipient |
| `type` | enum | `NOTIFICATION_TYPE` |
| `title`, `body` | string | |
| `entityType`, `entityId` | polymorphic? | the deep link; both omitted for a general announcement |
| `read` | bool | |
| `createdAt` | datetime | never before the event it announces |

**MySQL** `notifications` — index `(user_id, read, created_at DESC)`, which is
the exact query the bell menu runs. `entity_type` + `entity_id` is a
polymorphic pair (Laravel `morphTo`).

### `moderationReviews` — 23

One record per piece of content in the review pipeline: everything not a
private draft or owner-archived, the most recently published items (decided
history), and two deliverables pulled out of auto-approval.

| Field | Type | Notes |
|---|---|---|
| `id` | string | `mod_…` |
| `subjectType` | enum | `portfolio_item` \| `delivery` |
| `subjectId` | polymorphic FK | resolves against the matching collection |
| `creatorId` | FK → `users.id` | the account notified of the decision |
| `status` | enum | `CONTENT_STATUS` subset: `submitted`, `under_review`, `approved`, `rejected`, `revision_required`, `restricted` |
| `reviewerId` | FK? → `users.id` | absent while unclaimed |
| `notes` | string? | the decision note shown to the creator |
| `reasonCode` | enum? | `REJECTION_REASON_CODE` from `constants/policy.js` |
| `history` | object[] | `{ at, byId, fromStatus, toStatus, note? }` — appended on every transition |
| `submittedAt` | datetime | |
| `reviewedAt` | datetime | `null` while open — this is what the queue filters on |

**MySQL** `moderation_reviews` — index `(status, submitted_at)` for the queue
and `(subject_type, subject_id)`; `history` becomes
`moderation_review_events`, which is the auditable form.

### `reports` — 4

Member reports, covering every `REPORT_STATUS`.

| Field | Type | Notes |
|---|---|---|
| `id` | string | `rpt_…` |
| `reporterId` | FK? → `users.id` | absent when reported by a signed-out visitor |
| `subjectType` | enum | `portfolio_item` \| `creator_profile` \| `request` |
| `subjectId` | polymorphic FK | |
| `reason` | enum | `REPORT_REASON` |
| `details` | string | |
| `status` | enum | `REPORT_STATUS` |
| `handledById` | FK? → `users.id` | |
| `createdAt` | datetime | |

**MySQL** `reports` — index `(status, created_at)` and
`(subject_type, subject_id)`.

### `supportTickets` — 4

The support inbox, covering every `TICKET_STATUS`.

| Field | Type | Notes |
|---|---|---|
| `id` | string | `tkt_…` |
| `name`, `email` | string | stored on the ticket: a signed-out visitor has no account to read them from |
| `userId` | FK? → `users.id` | present when the member was signed in |
| `subject`, `body` | string | |
| `status` | enum | `TICKET_STATUS` |
| `replies` | object[] | `{ byId, body, at }` |
| `createdAt` | datetime | |

**MySQL** `support_tickets` + `support_ticket_replies`; index
`(status, created_at)`.

### `affiliateProfiles` — 3

Enrolled referrers: one active with earnings across every state, one active
whose referral never converted, one suspended.

| Field | Type | Notes |
|---|---|---|
| `id` | string | `aff_…` |
| `userId` | FK → `users.id` | any role may enrol |
| `code` | string | the referral code; matches `users.referredByCode` |
| `status` | enum | `AFFILIATE_PROFILE_STATUS` |
| `clicks`, `signups`, `conversions` | int | `signups` = referrals, `conversions` = converted referrals |
| `pendingEarnings`, `approvedEarnings`, `paidEarnings` | decimal | **derived** |
| `enrolledAt` | datetime | before any referral it owns |

**MySQL** `affiliate_profiles` — `user_id` UNIQUE, `code VARCHAR(32) UNIQUE`;
the earnings columns are caches over `affiliate_earnings`.

### `affiliateReferrals` — 4

| Field | Type | Notes |
|---|---|---|
| `id` | string | `ref_…` |
| `affiliateId` | FK → `affiliateProfiles.id` | |
| `referredUserId` | FK → `users.id` | never the affiliate themselves |
| `status` | enum | `REFERRAL_STATUS` |
| `convertedOrderId` | FK? → `orders.id` | present exactly when `converted` |
| `createdAt` | datetime | the referred account's signup |
| `convertedAt` | datetime | `null` until conversion |

A referral converts when the referred account's first qualifying order
completes inside `platformSettings.affiliate.attributionDays` (30). Past that
window it expires.

**MySQL** `affiliate_referrals` — UNIQUE `referred_user_id` (an account is
referred once); index `(affiliate_id, status)`.

### `affiliateEarnings` — 4

Commission accrued per qualifying order, covering every
`AFFILIATE_EARNING_STATUS`.

| Field | Type | Notes |
|---|---|---|
| `id` | string | `aer_…` |
| `affiliateId`, `referralId`, `orderId` | FK | |
| `amount` | decimal | `round(commission.amount × affiliate.commissionRate, 2)` |
| `status` | enum | `AFFILIATE_EARNING_STATUS` |
| `createdAt` | datetime | the order's completion |
| `approvedAt`, `paidAt` | datetime | `null` until reached |

Commission is a share of **the platform commission BetterBlue actually
earned**, never a share of the creator's earnings — so a refund reduces it
automatically. Only a `paid` earning writes an `affiliate_commission`
transaction.

**MySQL** `affiliate_earnings` — UNIQUE `(affiliate_id, order_id)`; index
`(status)` for the payout run.

### `auditLogs` — 49

The immutable record of administrative action. Buyer and creator activity is
not duplicated here — it lives in its own collections.

| Field | Type | Notes |
|---|---|---|
| `id` | string | `aud_…` |
| `actorId` | FK → `users.id` | always an admin or super admin |
| `actorRole` | enum | `ROLES`, denormalised so the entry survives a role change |
| `action` | string | dot-namespaced `domain.verb` — `user.suspend`, `moderation.approve`, `dispute.resolve`, `payout.mark_paid`, `settings.update`, … |
| `entityType`, `entityId` | polymorphic | what was acted on |
| `meta` | object | the detail behind the action (`{ fromStatus, toStatus, reason }`, `{ amount }`, `{ added, removed }`, …) |
| `createdAt` | datetime | |

**MySQL** `audit_logs` — append-only, no `UPDATE`/`DELETE` grants; `meta JSON`;
index `(actor_id, created_at DESC)`, `(entity_type, entity_id)`, and
`(action, created_at DESC)`. Partition or archive by month once it grows.

### `platformSettings` — singleton

Served as a JSON Server **singular route**: the value is an object, so
`GET /platformSettings` returns the record and `PATCH /platformSettings`
updates it.

```jsonc
{
  "general":    { "platformName", "supportEmail", "currency", "autoAcceptDays": 5, "payoutMinAmount": 50 },
  "commission": { "defaultRate": 0.2, "categoryOverrides": {} },
  "affiliate":  { "enabled": true, "commissionRate": 0.1, "attributionDays": 30, "payoutMinAmount": 25 },
  "moderation": { "autoApproveDeliveries": true, "reviewSlaDays": 2, "rejectionReasons": [...codes] },
  "features":   { "affiliateProgram": true, "publicRequestBoard": true, "reviews": true, "disputes": true },
  "updatedAt":  "…",
  "updatedById": "usr_super"
}
```

`updatedAt` / `updatedById` are additions to the Prompt 05 field list so the
`settings.update` audit entries have something to point at.

These values drive the seeded money math: the order factory reads
`commission.defaultRate`, the affiliate factory reads
`affiliate.commissionRate`, and the validator re-derives every commission from
them.

**MySQL** — do **not** create a one-row wide table. Use a key-value settings
table and hydrate it into the same nested shape in the API layer:

```sql
CREATE TABLE platform_settings (
  `key`       VARCHAR(100) PRIMARY KEY,   -- 'commission.defaultRate'
  `value`     JSON NOT NULL,
  updated_by  CHAR(36) NULL,
  updated_at  TIMESTAMP NOT NULL
);
```

New settings then ship without a migration, and each key carries its own audit
trail.

---

## 6. Design decisions

**No `orderItems` (00 §8).** One order is one request plus one accepted
proposal. Quantity lives on the request (`quantity`, `videoDurationSec`), and
what actually arrived lives on the delivery's `files`. Multi-item baskets would
add a join table to every order query for a marketplace that does not sell
baskets. The validator enforces one order per request; if bundled orders are
ever needed, add `order_items` then rather than modelling for it now.

**Settings are a singleton in JSON, key-value in MySQL.** JSON Server needs an
object to serve a singular route; MySQL should not have a one-row table with a
column per setting. The API layer hydrates key-value rows into the nested
object, so nothing above the services layer changes.

**Plain-text passwords are MOCK-AUTH only.** JSON Server cannot authenticate,
so `authService` compares credentials client-side and every seeded account
shares `Password123!`. This is confined to `authService` + `apiClient`, marked
`MOCK-AUTH:` in the source, and replaced wholesale by Laravel authentication
(00 §14). No seeded credential is a secret.

**A creator has both an account and a profile.** Portfolio work belongs to the
profile; money, enforcement, and messaging address the account. §3 lists which
foreign key points where, and the validator enforces it.

**The dataset has two layers.** The *scenario* layer is hand-written to cover
every status and edge case — every `ORDER_STATUS`, all three dispute
resolutions, a failed payment and its retry, a partial refund. The *history*
layer is 28 completed engagements expanded from a compact table, which is what
gives creators believable `ratingAvg` / `completedOrders`, buyers a real
`totalSpent`, and the finance console enough volume to be worth looking at.
Both layers use the same factories, so history rows are as valid as scenario
rows.

**Aggregates are derived, never authored.** Anything that could contradict the
underlying rows is recomputed during the seed (§4). Denormalised columns
survive into MySQL as caches, and the source of truth stays the rows they were
computed from.

**Unread counts are not stored.** The UI marks notifications read constantly; a
stored counter would be a second source of truth that drifts on the first
missed update. `GET /notifications?userId=…&read=false` answers the question
directly, and MySQL indexes `(user_id, read, created_at)` for it.

**Money is settled, not just agreed.** `orders.commissionAmount` always follows
the 00 §9 rule against the agreed price, while `commissions.baseAmount` follows
the money that actually moved. They differ only on the partially refunded
order, and the validator checks both.

---

## 7. Related documents

- `prompts/00-architecture-and-rules.md` — domain model (§8), enums and state
  machines (§9), migration principles (§15)
- `docs/api-contract.md` — the REST contract these collections expose
- `docs/laravel-migration-guide.md` — the swap from JSON Server to Laravel
