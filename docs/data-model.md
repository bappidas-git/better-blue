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
| `scripts/seed-data/requests.js` | `contentRequests` (+ the history engagement table, feed tags, and the headline offer) |
| `scripts/seed-data/feedReplies.js` | `feedReplies` |
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
| Creator | `creator@betterblue.test` | Ava Martinez | A shortlisted proposal, an in-progress order, a revision request to answer, a delivery awaiting the buyer's review, released payments, a paid payout, an affiliate profile with earnings |
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
- **`feedReplies.creatorId` → `creatorProfiles.id`** (Storefront V2). A reply is
  written *from* a storefront — the buyer clicks through to the profile, not to
  an account — so it names the profile, like portfolio work does. The messages
  inside it are the other way round: `feedReplies.messages[].authorId` →
  `users.id`, because a message is written by a person.
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
which is what Prompt 16 did with `ORIENTATION` and `BUDGET_TYPE`, and Prompt 22
with `VISIBILITY` and `MODERATION_SUBJECT` (the portfolio manager switches the
first and writes records discriminated by the second): all four now live in
`src/constants/statuses.js` and `seed-utils.js` re-exports them, so the seed's
imports did not change. What is left:

| Constant | Values | Used by |
|---|---|---|
| `MEDIA_TYPE` | `image`, `video` | `portfolioItems.mediaType`, delivery files, dispute evidence |
| `REPORT_REASON` | `prohibited_content`, `intellectual_property`, `misleading_claims`, `spam`, `other` | `reports.reason` |

`REPORT_SUBJECT` and `ENTITY_TYPE` (the polymorphic link targets used by
notifications, audit logs, and reports) live in the same module.

`VISIBILITY` carries `STATUS_META` entries; `MODERATION_SUBJECT` deliberately
does not — it discriminates a record rather than describing a status, and never
renders through `StatusChip`.

---

## 4. What the integrity validator checks

`scripts/seed-db.js` refuses to write a dataset that does not hold together:

1. **Shape** — every collection is a non-empty array (`platformSettings` is a
   singleton object), every id is unique and carries the right prefix.
2. **Foreign keys** — 55 declared relations plus polymorphic
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
7. **Feeds, replies, and levels** (Storefront V2) — every feed carries 3–6
   kebab-case tags with no repeats; `offerPrice` equals the budget it is derived
   from and is absent only on a draft; `repliesCount` equals the number of
   `feedReplies` pointing at the feed; all three deal statuses are represented;
   one reply per creator per feed, opened by the creator, two-sided, 2–6
   messages, each authored by the right account and dated after the feed was
   published and after the storefront existed; the demo creator has at least two
   threads; every creator's `deliveriesCount` and `totalEarned` sit at or above
   what the orders and the ledger actually contain, `contributionCounts` at or
   above their published portfolio, and `level` matches
   `getCreatorLevel` — with all three levels and several online creators present.
8. **Content policy** — a term sweep over every string, so a careless edit
   cannot introduce content that breaches 00 §1.

### Derived aggregates

These are **computed during the seed**, never hand-written, so they cannot
contradict the underlying rows:

| Field | Derived from |
|---|---|
| `contentRequests.proposalsCount` | count of proposals on the request |
| `contentRequests.awardedProposalId` | the accepted proposal, else `null` |
| `contentRequests.repliesCount` | count of `feedReplies` on the feed |
| `contentRequests.offerPrice` | `budgetMax ?? budgetMin` — the headline offer |
| `creatorProfiles.ratingAvg` / `ratingCount` | reviews for that creator (avg to 1 decimal) |
| `creatorProfiles.completedOrders` | orders with status `completed` |
| `creatorProfiles.deliveriesCount` | `completedOrders` + the carried-over record (below) |
| `creatorProfiles.totalEarned` | `release` + `commission` ledger rows + the carried-over record |
| `creatorProfiles.contributionCounts` | published portfolio items by media type + the carried-over record |
| `creatorProfiles.level` | `getCreatorLevel({ deliveriesCount, totalEarned })` |
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

### `users` — 30

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

### `buyerProfiles` — 12

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
| `isOnline` | bool | Storefront V2 — see below |
| `ratingAvg`, `ratingCount`, `completedOrders` | number | **derived** |
| `deliveriesCount` | int | **derived** — Storefront V2 |
| `totalEarned` | decimal | **derived** — lifetime earnings net of commission |
| `contributionCounts` | object | **derived** — `{ images, videos }` |
| `level` | 1 \| 2 \| 3 | **derived** — `src/constants/creatorLevels.js` |
| `payoutMethod` | object? | `{ type: 'bank', accountName, accountMasked }` — masked tail only, never an account number |
| `createdAt` | datetime | |

The last five were **added by Storefront V2** (`prompts-v2/03`) and are additive:
nothing that read a creator profile before now reads them, and the dashboard,
discovery, and admin screens are unchanged.

- `level` is not stored independently of the figures behind it.
  `getCreatorLevel({ deliveriesCount, totalEarned })` is the single rule —
  **Level 3** at ≥25 deliveries *and* ≥$10,000 earned, **Level 2** at ≥10 *and*
  ≥$2,000, **Level 1** otherwise — and the seed calls the same function the app
  does, so the two cannot disagree. Both figures have to be met: forty cheap
  deliveries and one five-figure commission are each half of what Level 3
  claims.
- `isOnline` is a **seeded flag, not a live session** (`MOCK-PRESENCE`). There
  is no presence channel in the prototype, so `OnlineDot` renders a state
  rather than tracking one. Laravel would drive the same field from a heartbeat
  and nothing above the field changes.
- `deliveriesCount`, `totalEarned`, and `contributionCounts` are each **what
  this database contains plus the record the creator carried over when they
  joined** (`CREATOR_CARRIED_OVER` in `scripts/seed-data/profiles.js`). The
  seeded marketplace is four months old, so nobody in it has 25 deliveries and
  every creator would sit at Level 1 with nothing to show. The padding is
  declared in one table, and the validator asserts that every published total
  stays at or above the orders, the ledger, and the portfolio it is built on —
  so the figures can be generous but never contradict the data. A real backend
  has no equivalent: the totals are the sum of the real rows, and that table
  has nothing to migrate.

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
| `brandCredit` | string? | "Created for: …" — optional, added by Prompt 22 |
| `rejectionReason` | string? | present only on rejected items; cleared on re-submission |
| `submittedAt` | datetime | `null` while a draft; re-stamped on every submission |
| `publishedAt` | datetime | `null` until published |
| `createdAt` | datetime | |
| `updatedAt` | datetime? | last owner edit — written by Prompt 22's operations only, so seeded rows omit it |

**MySQL** `portfolio_items` — FK to `creator_profiles`; `tags` becomes
`portfolio_item_tags`; index `(status, published_at DESC)` for the public grid
and `(creator_profile_id, status)` for the creator's own list.

#### Moderation notes (Prompt 22)

Four decisions govern the owner's half of the lifecycle. All four are enforced
in `portfolioService` against `CONTENT_STATUS_MACHINE` — never in a component —
and the reviewer's half (`approved`, `rejected`, `revision_required`,
`published`, `restricted`) stays with `moderationService` and the admin console.

- **Edit-republish.** Editing a **published** item moves it to `submitted` and
  **unpublishes it immediately**: it leaves the public profile and discovery
  now, and returns only when a reviewer approves it again. The alternative —
  leaving the old version live while the edit is reviewed — would mean the
  public profile showing content that no longer matches the record under
  review, so the machine carries a `published → submitted` edge and the UI
  confirms the consequence in plain words before saving. `publishedAt` is
  deliberately **not** cleared: it is the record of when the piece was last
  live, and only `status` decides what is public.
- **Archiving is final.** `archived` is a terminal state — there is no restore
  in v1. Archiving is offered from `draft`, `rejected`, `published`, and
  `restricted`, and confirmed as irreversible. An item in review cannot be
  archived out from under the reviewer.
- **Re-submission resets the case.** Submitting again re-opens the *existing*
  `moderationReviews` record rather than creating a second one: `reviewerId`,
  `notes`, `reasonCode`, and `reviewedAt` are cleared, `submittedAt` is
  re-stamped, and a `history` entry records who moved it and from where. The
  item's own `rejectionReason` is cleared at the same time, so a creator never
  reads a decision about a submission they have already replaced.
- **Visibility is not moderation.** `unlisted` keeps an item approved and
  published while excluding it from every public query
  (`portfolioService.listPublished` filters `status: published` **and**
  `visibility: public`). Only published items can be switched; an unpublished
  item is already invisible. Share-by-link can be built on top of the same
  stored value later without touching the enum.

### `categories` — 12

Generated from `src/constants/categoriesFallback.js`, so the API, the offline
fallback, and `CATEGORY_ID` can never drift.

| Field | Type | Notes |
|---|---|---|
| `id` | string | `cat_…` |
| `name`, `slug`, `icon` | string | `icon` is an Iconify `tabler:*` name |
| `active` | bool | |
| `sortOrder` | int | display order = array order in the constants file |

Editable from `/admin/categories` (Prompt 35, super admin only): add, rename,
re-icon, re-slug, reorder, and deactivate. **Never deleted** — deactivating is
the whole removal story, so no record can be orphaned; a deactivated category
stops being offered in new briefs, profiles, and filters and keeps rendering on
everything already tagged with it. Reordering swaps `sortOrder` with the
neighbour rather than renumbering the list, so an interrupted move leaves a
duplicate `sortOrder` (which still sorts sensibly) rather than a hole.

Categories added after the seed get a generated `cat_…` id from
`utils/id.js` rather than a hand-written one, so `CATEGORY_ID` in
`categoriesFallback.js` covers the seeded twelve only — as it always has.

**MySQL** `categories` — `slug VARCHAR(64) UNIQUE`, index `(active, sort_order)`.

### `contentRequests` — 65

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
| `offerPrice` | decimal? | **derived** — the headline offer; see below |
| `tags` | string[] | 3–6 kebab-case slugs; see below |
| `deadline` | datetime | **may be in the future** |
| `invitedCreatorId` | FK? → `creatorProfiles.id` | optional; see below |
| `status` | enum | `REQUEST_STATUS` |
| `proposalsCount` | int | **derived** |
| `repliesCount` | int | **derived** — `feedReplies` on this feed |
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

`offerPrice`, `tags`, and `repliesCount` were **added by Storefront V2**
(`prompts-v2/03`), which renders a `contentRequests` row as a *feed*. The
collection was not renamed and the record is not reshaped — `/feeds/:feedId`
carries a `req_…` and every existing consumer reads exactly what it read
before.

- **`offerPrice`** is derived from the budget rather than stored beside it, so
  the two cannot disagree: a `fixed` brief offers its one price, and a `range`
  brief offers the **top** of the range, which is the figure a creator decides
  whether to answer. It is absent on a draft that has not answered the budget
  question — an absent offer, never `$0` — and present on everything else. The
  wizard, the buyer's request list, and the admin console keep reading
  `budgetMin`/`budgetMax`.
- **`tags`** are lowercase kebab-case slugs (`product-photo`, `social-media`),
  rendered as stored — the convention creators recognise from every other
  marketplace, so there is no display-name lookup behind them. Note this differs
  from `portfolioItems.tags`, which are free-text words (`food styling`); those
  are a creator's own labels on their own work and were never a filter
  vocabulary. Scenario feeds carry hand-written tags; the archive derives four
  from content type, category, and placement.
- **`requestStatus` → deal status.** The storefront shows three states rather
  than six: `open` → **open**, `awarded`/`closed`/`cancelled` → **closed**,
  `completed` → **delivered**. That projection lives in
  `src/constants/feedStatus.js` and is presentation only — the stored status is
  untouched, and the state machine, the dashboard, and the admin console are
  unaffected. A `draft` has no deal status because it never reaches a feed
  surface.

**MySQL** `content_requests` — `reference_urls` becomes
`content_request_references`; index `(status, published_at DESC)` for the board
and `(buyer_id, status)` for "my requests". `awarded_proposal_id` and
`invited_creator_id` are nullable FKs; add `awarded_proposal_id` after
`proposals` exists to avoid a circular constraint at migration time. `tags`
becomes `content_request_tags`; index `(status, replies_count DESC)` and
`(status, offer_price)` for the feed board's sorts.

### `feedReplies` — 31

The private conversation a creator opens under a feed (Storefront V2). Thirty-one
threads: two to five on each of the nine open feeds, plus two on a feed that has
since been awarded and two on one that has been delivered — because a reply and
a deal status are independent, and a thread outlives the deal.

**A reply is not a proposal.** This is the distinction the collection exists to
keep:

| | `proposals` | `feedReplies` |
|---|---|---|
| What it is | A priced, formal offer | An informal message thread |
| Carries | Price, timeline, deliverables, samples | Messages, nothing else |
| Status | A `PROPOSAL_STATUS` state machine | None |
| Leads to | Award → order → escrow → delivery | Nothing — it is a conversation |
| Who can read it | The buyer, and the creator who sent it | The buyer, and the creator who wrote it |
| Service | `proposalService` | `feedService` |

Neither collection reads the other and neither validates against the other. A
creator may reply to a feed, propose on it, both, or neither, and deleting a
reply does not touch a proposal. Prompts 18 and 23 are untouched by any of this.

| Field | Type | Notes |
|---|---|---|
| `id` | string | `frp_…` |
| `feedId` | FK → `contentRequests.id` | the feed being answered |
| `creatorId` | FK → `creatorProfiles.id` | **the profile**, not the account — see §3 |
| `buyerId` | FK → `users.id` | the account that posted the feed |
| `messages` | object[] | see below; 2–6 in the seed, unbounded in the app |
| `createdAt` | datetime | the first message |
| `updatedAt` | datetime | the most recent message |

`messages[]` is embedded rather than its own collection (contract §1.4), like
`deliveries.files`: `{ id: 'frm_…', authorRole: 'creator'|'buyer', authorId
(→ users.id), body, at }`. The first message of a thread is always the
creator's — a reply is something a creator starts.

**One reply per creator per feed.** `feedService.createReply` refuses a second
one with `conflict`; the seed validator enforces the same rule; MySQL enforces
it with a unique index.

**Privacy.** A thread belongs to exactly two people. Every read in
`feedService` (`getMyReply`, `listMyReplies`) carries `creatorId` as a *query
filter*, not as a post-fetch check, so the provider never returns another
creator's thread. As with every ownership check in this prototype that is
**UX only** (00 §11) — the Laravel API must scope the same queries to the
signed-in creator, because anything the browser filters, the browser can
unfilter.

**Deletion is hard**, unlike everything else in BetterBlue, where removal is a
status transition (contract §1.7). A withdrawn conversation should leave nothing
behind, and no order, payment, or audit record depends on one. `deleteMyReply`
removes the row and decrements the feed's `repliesCount`, which frees the
creator to reply again later.

**MySQL** `feed_replies` — `UNIQUE (feed_id, creator_id)`, index
`(creator_id, updated_at DESC)` for the creator's conversation list and
`(feed_id)` for the counter. `messages` becomes `feed_reply_messages
(id, feed_reply_id, author_role, author_id, body, created_at)` with
`ON DELETE CASCADE`, and the count on `content_requests.replies_count` is
maintained in the same transaction as the insert.

### `proposals` — 116

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

### `orders` — 51

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

### `deliveries` — 44

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

### `payments` — 53

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

### `transactions` — 119

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

### `commissions` — 33

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

### `payouts` — 10

Settlements to a bank account, covering every `PAYOUT_STATUS` (`requested`,
`processing`, `paid`, `rejected`). Since Prompt 34 the collection holds **two
kinds** of settlement, told apart by `source`: creator earnings, and affiliate
commission.

| Field | Type | Notes |
|---|---|---|
| `id` | string | `pyo_…` |
| `source` | enum | `PAYOUT_SOURCE` — `creator` (seeded rows, and the default when absent) or `affiliate` |
| `creatorId` | FK → `users.id` | the recipient of a `creator` payout; **absent** on an affiliate one |
| `userId` | FK → `users.id` | the recipient of an `affiliate` payout; absent on a creator one |
| `affiliateId` | FK → `affiliateProfiles.id` | `affiliate` payouts only |
| `amount` | decimal | + `currency`; never below the applicable payout minimum — `general.payoutMinAmount` for a creator, `affiliate.payoutMinAmount` for an affiliate |
| `method` | object? | `{ type: 'bank', accountName, accountMasked }` snapshot; `null` when the member has no payout details (a buyer-only affiliate) |
| `status` | enum | `PAYOUT_STATUS` |
| `requestedAt` | datetime | |
| `processedAt` | datetime | `null` while `requested` |
| `rejectedReason` | string? | present on rejected payouts |

Only a `paid` payout writes a `payout` transaction — that is the moment money
leaves the balance. A `paid` **affiliate** payout additionally moves every
`approved` `affiliateEarnings` row behind it to `paid` and writes one
`affiliate_commission` credit per row, which net the pair to zero on the
member's ledger.

**Two recipient columns, not one.** Every creator-scoped read in the product
filters on `creatorId`; an affiliate settlement must never be picked up by a
creator's balance, earnings screen, or payout history — including for the
members who are both, which several seeded accounts are.

**MySQL** `payouts` — index `(creator_id, status)` and `(affiliate_id, status)`;
a `CHECK` that exactly one of `creator_id` / `user_id` is set, matched to
`source`. The method snapshot is kept on the row so a later change to the
member's bank details cannot rewrite a historical settlement.

### `disputes` — 9

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

### `disputeMessages` — 33

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

### `reviews` — 31

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

### `notifications` — 74

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

Storefront V2 added one type, `feed_reply_received`, emitted by
`feedService.createReply` when a creator opens a thread on one of the buyer's
feeds. It is deliberately **not** `proposal_received`: telling a buyer they have
an offer to review when what arrived is a message would be wrong. It is filed
under the existing "Requests & proposals" preference category, so no new toggle
row appears, and it carries `entityType: 'request'` with the feed's `req_…`.
**Honest limitation:** there is no buyer-facing screen for the thread itself
yet — V2-08 builds the creator's side — so the notification lands the buyer on
the brief, which is the nearest true destination and never a dead link. No
notification of this type is seeded; it only exists at runtime.

**MySQL** `notifications` — index `(user_id, read, created_at DESC)`, which is
the exact query the bell menu runs. `entity_type` + `entity_id` is a
polymorphic pair (Laravel `morphTo`).

### `moderationReviews` — 26

One record per piece of content in the review pipeline: everything not a
private draft or owner-archived, the most recently published items (decided
history), and five deliverables pulled out of auto-approval — three of them
undecided, so Prompt 30's Deliverables tab has a queue to work rather than a
single row.

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

A case is created by `portfolioService.submitForReview` on a creator's **first**
submission and re-opened on every one after it (see the portfolio moderation
notes above), so there is exactly one case per portfolio item and its `history`
is the whole story of that item's reviews.

Deliveries work differently, because a delivered version is never resubmitted —
answering a revision produces a *new* version (§9 state machines). So
`deliveryService.submitDelivery` **creates one case per version** and never
re-opens one, and `platformSettings.moderation.autoApproveDeliveries` decides
what state that case opens in: `true` (the seeded default) opens it already
`approved`, with `reviewedAt` stamped and a system `history` entry saying so, so
Trust & Safety spot-checks rather than queues everything the marketplace
produces; `false` opens it at `submitted`, and it is worked like any other case.
Either way there is a record, so a deliverable is never content nobody can
account for. Full sequence: `docs/api-contract.md` §7 operation 5.

The seeded delivery cases are the five pulled out of auto-approval by hand,
which is what the flag's `false` branch looks like in the queue.

#### Moderation decisions (Prompt 30)

`moderationService.decide` is the only writer of a decision, and it propagates
that decision differently per subject type — the asymmetry is deliberate and
worth stating here rather than only in the service:

- **Portfolio items mirror the case.** `approve` walks the item
  `under_review → approved → published` and stamps `publishedAt` (an item that
  has been live before keeps its original date — a re-review should not
  re-order a storefront nobody re-arranged). `reject` and `request_changes`
  mirror the status and write the reviewer's note to `rejectionReason`, which is
  what the creator reads in their portfolio manager. `restrict` walks
  `published → restricted`, and `portfolioService.listPublished` does the rest:
  the item leaves the public profile and discovery at once.
- **Deliveries are record-only.** `deliveries.status` belongs to the *buyer's*
  review (`submitted → revision_requested → accepted`) and a content review
  never touches it. A buyer who has been sent work does not lose it because
  Trust & Safety is still reading, and a decision here never requests a revision
  on the buyer's behalf. The decision lives on the case.
- **A restricted deliverable is flagged, not withdrawn.** `restrict` on a
  delivery sets `restricted: true` on each entry in `deliveries.files[]` and
  stamps `restrictedAt`. The buyer who commissioned the work keeps it and the
  order flow is unaffected; the flag is what keeps the file out of any *reuse*
  surface — showcases, marketing, and the path a creator can take to republish a
  delivery as portfolio work. Kept deliberately simple in v1: nothing reads the
  flag yet, and a later prompt can act on it without revisiting this decision.

**MySQL** — `files` becomes a `delivery_files` table with a `restricted_at`
column, so the flag is a nullable timestamp rather than a boolean, and "when"
survives alongside "whether".

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
| `handledAt` | datetime? | when the outcome was recorded (Prompt 30) |
| `resolutionNote` | string? | what the admin concluded — stored, never sent to the reporter (Prompt 30) |
| `createdAt` | datetime | |

`REPORT_SUBJECT` and `REPORT_REASON` moved from `scripts/seed-utils.js` into
`src/constants/reports.js` in Prompt 30 — the same promotion `VISIBILITY` and
`MODERATION_SUBJECT` made in Prompt 22, and for the same reason: the app now
needs them (the public report dialog offers the reasons, the admin queue prints
them). The seed re-exports from the constants module, so the two cannot drift.

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
| `clicks`, `signups`, `conversions` | int | `signups` = referrals, `conversions` = converted referrals. `clicks` is **approximate** — see below |
| `pendingEarnings`, `approvedEarnings`, `paidEarnings` | decimal | **derived** — recomputed from the earnings rows on every write, never incremented |
| `enrolledAt` | datetime | before any referral it owns |
| `suspendedAt`, `suspendedReason` | datetime?, string? | written on suspension, cleared on reactivation |

`clicks` is read-then-written from the browser, so two visits in the same second
can overwrite one another and a refresh counts twice. Nothing in the product
takes a decision on it; Laravel replaces it with an atomic increment.

**MySQL** `affiliate_profiles` — `user_id` UNIQUE, `code VARCHAR(32) UNIQUE`;
the earnings columns are caches over `affiliate_earnings`.

### `affiliateReferrals` — 5

| Field | Type | Notes |
|---|---|---|
| `id` | string | `ref_…` |
| `affiliateId` | FK → `affiliateProfiles.id` | |
| `referredUserId` | FK → `users.id` | never the affiliate themselves |
| `status` | enum | `REFERRAL_STATUS` |
| `convertedOrderId` | FK? → `orders.id` | present exactly when `converted` |
| `createdAt` | datetime | the referred account's signup |
| `capturedAt` | datetime? | when the link was clicked, on rows created from a live capture — what the attribution window is measured from |
| `convertedAt` | datetime | `null` until conversion |

A referral converts when the referred account's **first** qualifying order
completes inside `platformSettings.affiliate.attributionDays` (30), measured
from `capturedAt` where there is one and `createdAt` otherwise. Past that
window it expires. Only buyers get a referral row: commission comes out of the
platform commission on a purchase, so a referred creator is recorded on the
account (`users.referredByCode`) but accrues nothing.

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
| `voidedAt`, `voidReason` | datetime?, string? | present on a `void` earning; the reason is shown to the affiliate verbatim |

Commission is a share of **the platform commission BetterBlue actually
earned**, never a share of the creator's earnings — so a refund reduces it
automatically. Only a `paid` earning writes an `affiliate_commission`
transaction.

**MySQL** `affiliate_earnings` — UNIQUE `(affiliate_id, order_id)`; index
`(status)` for the payout run.

### `auditLogs` — 55

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
  "affiliate":  { "commissionRate": 0.1, "attributionDays": 30, "payoutMinAmount": 25 },
  "moderation": { "autoApproveDeliveries": true, "reviewSlaDays": 2,
                  "rejectionReasons": [...codes], "customRejectionReasons": [] },
  "features":   { "affiliateProgram": true, "publicRequestBoard": true, "reviews": true, "disputes": true },
  "updatedAt":  "…",
  "updatedById": "usr_super"
}
```

`updatedAt` / `updatedById` are additions to the Prompt 05 field list so the
`settings.update` audit entries have something to point at.

**Prompt 35 migration — two shape changes.** Both are seed-level, so
`npm run seed` is the whole migration:

1. **`affiliate.enabled` removed.** The referral program had two switches, this
   one and `features.affiliateProgram`, which is one decision with two answers
   that could disagree. The feature flag is now the only control;
   `affiliate` holds only the program's numbers. An `affiliate.enabled` left in
   an older `db.json` is ignored rather than honoured (contract §6.23/§6.27).
2. **`moderation.customRejectionReasons` added**, an array of `{ code, label }`.
   `src/constants/policy.js` stays canonical for the six built-in rejection
   codes — they are neither renameable nor removable, because a `reasonCode`
   stored on a decided case must keep its meaning. Settings may only *append*,
   with codes generated from the label under a `custom_` prefix so a collision
   with a built-in code cannot happen. `moderation.rejectionReasons` is
   unchanged: it stays the seeded mirror of the canonical codes.

Every write goes through `settingsService.saveSettings`, which stamps
`updatedAt`/`updatedById`, drops the settings cache so consumers re-read
immediately, and records a `settings.update` audit entry whose `meta.changes`
carries the field-level `from → to` the admin approved.

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

**Replies and proposals are separate systems.** Storefront V2 added a
conversation to the public feed and deliberately did not run it through
`proposals`. A proposal is a priced offer with a state machine, an award, an
order, and escrow behind it; a reply is a message. Overloading one collection to
mean both would have put "I might be interested" and "here is my quote for
$900" under the same status, the same notification, and the same buyer inbox.
The `feedReplies` section in §5 sets the two side by side.

**A feed is a content request.** The V2 storefront renames nothing: `/feeds`
lists `contentRequests`, `:feedId` is a `req_…`, and `feedService` is a façade
over `requestService`. What V2 added is three additive fields and one
presentation-layer projection (six request statuses shown as three deal
statuses). That is what keeps the buyer dashboard, the admin console, and the
Laravel migration reading the records they already read.

**Storefront figures are padded, and say so.** `deliveriesCount`, `totalEarned`,
and `contributionCounts` add a declared carried-over record to what the database
holds, because a four-month-old marketplace cannot demonstrate a level system
honestly and inventing the whole figure would have been worse. The padding lives
in one table, the validator asserts every total stays at or above the real rows,
and the mechanism has no counterpart to migrate.

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
