# BetterBlue — Laravel / MySQL Migration Guide

> **Audience:** the backend developer replacing JSON Server with a Laravel API.
> **Promise:** every mock behaviour in this codebase is isolated behind a named
> module and marked in the source. This document tells you which modules, in
> what order, and what "done" looks like for each one.
>
> **Companion documents.** This guide is the *plan*; the specifications live
> next to it and are not repeated here.
> [`api-contract.md`](api-contract.md) is the wire contract (endpoints,
> envelopes, errors, every resource, every composite operation).
> [`data-model.md`](data-model.md) is the schema (collections, fields,
> relations, and the MySQL mapping per table).
> [`payments.md`](payments.md) is the money layer.
> [`e2e-walkthrough.md`](e2e-walkthrough.md) is the acceptance test you re-run
> against the new backend.

---

## Contents

1. [Architecture recap — what is mock, and where it is isolated](#1-architecture-recap)
2. [Step 1 — Implement the contract endpoints](#step-1--implement-the-contract-endpoints)
3. [Step 2 — The MySQL schema](#step-2--the-mysql-schema)
4. [Step 3 — Authentication (Sanctum ↔ `authService`)](#step-3--authentication)
5. [Step 4 — The `listAdapter` Laravel branch](#step-4--the-listadapter-laravel-branch)
6. [Step 5 — Uploads](#step-5--uploads)
7. [Step 6 — The payment provider](#step-6--the-payment-provider)
8. [Step 7 — Identifier generation moves server-side](#step-7--identifier-generation-moves-server-side)
9. [Step 8 — Server-side jobs](#step-8--server-side-jobs)
10. [Step 9 — Authorization: the frontend guards are UX only](#step-9--authorization)
11. [Step 10 — Environment changes, and what must not change](#step-10--environment-changes)
12. [Migration test plan](#migration-test-plan)
13. [Appendix — the `MOCK-*` marker index](#appendix--the-mock--marker-index)

---

## 1. Architecture recap

### What the frontend already gets right

Nothing above `src/services/` knows what a backend is. Components call hooks,
hooks call services, services call `apiClient`. The rules that make the swap
tractable were fixed in Prompt 01 and never relaxed:

| Rule | Where it is enforced | Why it matters on migration day |
|---|---|---|
| All HTTP goes through the services layer | `src/services/` — no component imports `axios` | You change services, not 300 components |
| One axios instance | `services/api/apiClient.js` | Base URL, auth header, and error normalisation change in one file |
| Provider quirks live in one module | `services/api/listAdapter.js` | `_page`, `_limit`, `X-Total-Count` appear nowhere else — grep to prove it |
| Statuses and roles come from constants | `src/constants/` | The enum values are the API's values; they do **not** change |
| Routes come from `paths.js` | `src/routes/paths.js` | URL structure is unaffected by the backend |
| Services expose intentions, not REST | `orderService.acceptProposal(…)` | The signature survives; only the body of the function changes |

### The seven isolation points

Everything mock in this application lives behind one of these. There is no
eighth.

| # | Concern | Module | What it does today | What it becomes |
|---|---|---|---|---|
| 1 | Base URL / provider | `src/config/env.js` | Reads `VITE_API_BASE_URL`, `VITE_API_PROVIDER` | Point at Laravel, flip the provider |
| 2 | List conventions | `src/services/api/listAdapter.js` | JSON Server query spellings | Laravel branch (already stubbed) |
| 3 | Authentication | `src/services/authService.js` | Plain-text compare, client-minted token | Sanctum calls, 1:1 by function |
| 4 | Payments | `src/services/payments/` | `dummyPaymentProvider` + test cards | Real gateway behind the same interface |
| 5 | Uploads | `src/services/uploadService.js` | Object URLs, no network | `POST /uploads` to real storage |
| 6 | Identifiers | `src/utils/id.js` | `generateId('ord')` in services | Server mints ids; the module is deleted |
| 7 | Orchestration | every `*Service.js` | N REST calls per business action | One endpoint per composite operation |

### What "client-side orchestration" means, concretely

`orderService.acceptProposal()` currently makes eight-plus HTTP calls: read the
proposal, read the request, guard the state, create the order, decline the
losing proposals, mark the request awarded, notify the creator, write an audit
row. If the browser dies between calls four and five, the data is inconsistent
and nothing rolls it back.

That is the single biggest correctness reason to migrate, and it is why
[api-contract §7](api-contract.md#7-composite-operations) exists: **48 composite
operations**, each already documented with its exact sequence and its
recommended Laravel endpoint. Implement each one as a single transactional
endpoint and the client-side sequence collapses into one call.

The source marks each of these with `MOCK-ATOMICITY` (7 sites) and
`MOCK-SEQUENCE` (3 sites).

---

## Step 1 — Implement the contract endpoints

**Read:** [`api-contract.md`](api-contract.md) §1 (conventions), §3 (errors),
§6 (all 27 resources), §7 (composite operations).

### 1a. Get the conventions right first

These are cheap to build in and expensive to retrofit:

- **Identifiers** are opaque prefixed strings (`ord_7f3a…`), never integers on
  the wire (§1.4). See [Step 7](#step-7--identifier-generation-moves-server-side).
- **Money** is a decimal number plus a `currency` field (§1.6). Store
  `DECIMAL(12,2)`, serialise as a number, never a formatted string.
- **Dates** are ISO 8601 UTC strings with milliseconds (§1.5) — Laravel's
  default `toJSON()` is compatible; pin it so a config change cannot alter it.
- **Errors** use the envelope in §3.1 and the canonical codes in §3.2. The
  client's `ApiError` (`services/api/apiError.js`) already parses exactly this
  shape, including `details` for per-field validation (§3.3).

### 1b. Resource endpoints

§6 documents all 27 collections: fields, types, relations, filters that must be
supported, and the sort fields each list is used with. Build them as standard
`apiResource` routes returning the list envelope from §4.2.

### 1c. Composite operations — the important half

§7.1 is a table of 48 operations with a recommended endpoint for each. The
highest-value ones, in the order worth building them:

| Priority | Operation | Endpoint | Why first |
|---|---|---|---|
| 1 | `acceptProposal` | `POST /proposals/:id/accept` | Creates the order; 8+ calls today |
| 2 | `initiateOrderPayment` | `POST /orders/:id/pay` | Money enters escrow; must be atomic |
| 3 | `releasePayment` | `POST /orders/:id/release` | Money leaves escrow + commission |
| 4 | `refundPayment` | `POST /payments/:id/refund` | Full and partial, with the retained-portion commission rule |
| 5 | `resolveDispute` | `POST /disputes/:id/resolve` | Branches onto 3 and 4; 8+ calls today |
| 6 | `submitDelivery` | `POST /orders/:id/deliveries` | Writes files + moves the order |
| 7 | `acceptDelivery` | `POST /deliveries/:id/accept` | Completes and releases in one step |
| 8 | `requestRevision` | `POST /deliveries/:id/revisions` | Moves delivery *and* order |
| 9 | `markPayoutPaid` | `POST /payouts/:id/paid` | The only step that writes a payout ledger row |
| 10 | `broadcastAnnouncement` | `POST /announcements` | 1 + N writes; obvious fan-out job |

Reads that exist purely so components never compute (`getOverview`,
`getEarningsBreakdown`, `getAdminOrderContext`, …) are lower risk but high
value: each replaces 8–12 round trips with one query.

**Wrap every composite in a database transaction.** The mock stack cannot, and
`docs/payments.md` §9.2 documents exactly which half-states are reachable today
because of it.

### 1d. What the mock stack cannot do — and you now can

[api-contract §1.9](api-contract.md#19-summary-of-what-the-mock-stack-cannot-do)
is the list. In short: transactions, real authentication, server-side
authorization, uniqueness constraints, joins, aggregates, atomic counters,
scheduled work, and webhooks.

---

## Step 2 — The MySQL schema

**Read:** [`data-model.md`](data-model.md) §5 (every collection, field by field)
and §3 (conventions, especially "Which id does a foreign key point at?").

### Table checklist

26 collections → 25 tables plus one settings row. `platformSettings` is a
singleton object, not a collection — a single-row table (or a key/value settings
table) is fine.

```
users                buyer_profiles       creator_profiles     portfolio_items
categories           content_requests     proposals            orders
deliveries           revisions            payments             transactions
commissions          payouts              disputes             dispute_messages
reviews              notifications        moderation_reviews   reports
support_tickets      affiliate_profiles   affiliate_referrals  affiliate_earnings
audit_logs           platform_settings
```

### The foreign-key trap

Creators have **two** identities. Get this wrong and the whole marketplace
mis-joins:

| Column | Points at | Reason |
|---|---|---|
| `portfolio_items.creator_id` | `creator_profiles.id` | Portfolio work belongs to the storefront that displays it |
| `content_requests.invited_creator_id` | `creator_profiles.id` | Copied from the storefront the buyer clicked |
| `reports.subject_id` (when `subject_type = 'creator_profile'`) | `creator_profiles.id` | A report is about the public listing |
| **every other `creator_id` and every `buyer_id`** | `users.id` | Auth, money, notifications and enforcement address the *account* |

The seed's integrity validator (`scripts/seed-db.js`) enforces all of these
today; port the same assertions as FK constraints.

### DDL sketch

Representative rather than exhaustive — `data-model.md` §5 has every column.

```sql
CREATE TABLE users (
  id                CHAR(28)     NOT NULL PRIMARY KEY,        -- 'usr_…'
  email             VARCHAR(255) NOT NULL,
  password          VARCHAR(255) NOT NULL,                    -- bcrypt/argon2
  role              ENUM('buyer','creator','admin','super_admin') NOT NULL,
  account_status    ENUM('active','suspended','blacklisted','deactivated')
                      NOT NULL DEFAULT 'active',
  name              VARCHAR(120) NOT NULL,
  avatar_url        TEXT         NULL,
  permissions       JSON         NULL,                        -- admins only
  notification_prefs JSON        NULL,
  last_login_at     TIMESTAMP(3) NULL,
  created_at        TIMESTAMP(3) NOT NULL,
  updated_at        TIMESTAMP(3) NULL,
  UNIQUE KEY uq_users_email (email),                          -- see note below
  KEY idx_users_role_status (role, account_status)
) ENGINE=InnoDB;

CREATE TABLE orders (
  id                CHAR(28)     NOT NULL PRIMARY KEY,        -- 'ord_…'
  request_id        CHAR(28)     NOT NULL,
  proposal_id       CHAR(28)     NOT NULL,
  buyer_id          CHAR(28)     NOT NULL,
  creator_id        CHAR(28)     NOT NULL,                    -- users.id
  title             VARCHAR(200) NOT NULL,
  category_id       CHAR(28)     NOT NULL,
  content_type      ENUM('photo','video','bundle') NOT NULL,
  price             DECIMAL(12,2) NOT NULL,
  currency          CHAR(3)      NOT NULL DEFAULT 'USD',
  commission_rate   DECIMAL(5,4) NOT NULL,                    -- 0.2000
  commission_amount DECIMAL(12,2) NOT NULL,
  creator_earnings  DECIMAL(12,2) NOT NULL,
  revisions_included TINYINT UNSIGNED NOT NULL DEFAULT 0,
  revisions_used     TINYINT UNSIGNED NOT NULL DEFAULT 0,
  status            ENUM('pending_payment','in_progress','delivered',
                         'revision_requested','completed','cancelled',
                         'disputed','refunded') NOT NULL,
  delivery_due_at   TIMESTAMP(3) NULL,
  activated_at      TIMESTAMP(3) NULL,
  delivered_at      TIMESTAMP(3) NULL,
  completed_at      TIMESTAMP(3) NULL,
  cancelled_at      TIMESTAMP(3) NULL,
  created_at        TIMESTAMP(3) NOT NULL,
  CONSTRAINT fk_orders_request  FOREIGN KEY (request_id)  REFERENCES content_requests(id),
  CONSTRAINT fk_orders_proposal FOREIGN KEY (proposal_id) REFERENCES proposals(id),
  CONSTRAINT fk_orders_buyer    FOREIGN KEY (buyer_id)    REFERENCES users(id),
  CONSTRAINT fk_orders_creator  FOREIGN KEY (creator_id)  REFERENCES users(id),
  UNIQUE KEY uq_orders_proposal (proposal_id),                -- one order per proposal
  KEY idx_orders_buyer_status (buyer_id, status, created_at),
  KEY idx_orders_creator_status (creator_id, status, created_at)
) ENGINE=InnoDB;

CREATE TABLE transactions (
  id             CHAR(28)      NOT NULL PRIMARY KEY,          -- 'txn_…'
  order_id       CHAR(28)      NULL,
  payout_id      CHAR(28)      NULL,
  user_id        CHAR(28)      NOT NULL,
  type           ENUM('charge','release','refund','partial_refund',
                      'commission','payout','affiliate_commission') NOT NULL,
  amount         DECIMAL(12,2) NOT NULL,                      -- signed
  currency       CHAR(3)       NOT NULL DEFAULT 'USD',
  balance_after  DECIMAL(12,2) NULL,                          -- creator rows only
  description    VARCHAR(255)  NULL,
  created_at     TIMESTAMP(3)  NOT NULL,
  KEY idx_txn_user_created (user_id, created_at),
  KEY idx_txn_order (order_id)
) ENGINE=InnoDB;
```

**Enums.** Use native MySQL `ENUM` columns (or `CHECK` constraints) whose
members are copied *verbatim* from `src/constants/statuses.js`. The complete
list is in [api-contract §8](api-contract.md#8-status-and-enum-reference) and
[00 §9](../prompts/00-architecture-and-rules.md). These strings are a shared
contract — see [Step 10](#what-must-not-change).

**Indexes worth having on day one:** every foreign key; `users.email` unique;
`(buyer_id, status, created_at)` and `(creator_id, status, created_at)` on
orders and proposals; `(user_id, read, created_at)` on notifications;
`(status, created_at)` on moderation_reviews, disputes and payouts;
`(entity_type, entity_id, created_at)` on audit_logs.

**`users.email` uniqueness** is currently enforced by a read-then-write race in
`authService.register` (`MOCK-UNIQUENESS`). The unique key above is the fix, and
it must return the contract's `conflict` code (§3.2), not a 500.

**Money precision.** JavaScript numbers are used throughout the prototype and
rounding is applied at every write (`docs/payments.md` §6). `DECIMAL(12,2)` in
MySQL plus the same rounding rule server-side keeps the ledger invariants in
§7 of that document intact.

---

## Step 3 — Authentication

**Read:** [api-contract §2](api-contract.md#2-authentication) — the target
contract (§2.1), the bearer format (§2.2), account-status rules (§2.3), what the
mock does (§2.4), and Sanctum notes (§2.5).

`authService` has exactly five functions, and they map 1:1 onto endpoints. This
is the whole of the auth migration:

| `authService` function | Endpoint | Today (`MOCK-AUTH`) | With Laravel |
|---|---|---|---|
| `login({ email, password })` | `POST /auth/login` | `GET /users?email=…`, compare plain text, mint a token in the browser | `Hash::check`, reject non-`active` **before** issuing, `$user->createToken('web')->plainTextToken` |
| `register({ role, name, email, password, … })` | `POST /auth/register` | 3 sequential writes with no transaction | One transaction: user + profile row + token |
| `me()` | `GET /auth/me` | Re-reads the user and re-checks status | `$request->user()`, re-checking `account_status` |
| `changePassword({ currentPassword, newPassword })` | `POST /auth/change-password` | Compares and PATCHes plain text | Verify + `Hash::make`, optionally revoke other tokens |
| `logout()` | `POST /auth/logout` | Clears localStorage only | `$request->user()->currentAccessToken()->delete()`, then clear |

### What does not change

- **The header.** `apiClient` already sends `Authorization: Bearer <token>` on
  every request, including to the mock API which ignores it. The wire format is
  correct today.
- **The session shape.** `{ token, user }` stored under `bb.auth`. Sanctum's
  plain-text token drops straight in.
- **The error contract.** `login` already throws `unauthorized` for both a wrong
  password and an unknown address — deliberately indistinguishable so the
  endpoint cannot enumerate accounts. Keep that.
- **Account-status refusal.** Suspended, blacklisted and deactivated accounts
  are refused at sign-in with a distinct `forbidden` + `details.accountStatus`,
  which the UI renders as a respectful status screen. Enforce it in middleware
  on *every* request, not just at login — a token minted before a suspension
  must stop working.

### What must be deleted

`mintToken()` and the plain-text `password` field. The mock token is
`btoa(JSON.stringify({ sub, role, iat }))` — it is not a credential, it is a
placeholder, and it is marked as such. Also add rate limiting
(`throttle:6,1` per IP + email) on login and register, which the client already
handles via the `rate_limited` code (§3.2).

---

## Step 4 — The `listAdapter` Laravel branch

**Read:** [api-contract §4](api-contract.md#4-lists-pagination-filtering-sorting-search),
especially §4.5.

`src/services/api/listAdapter.js` already has the branch written as a documented
stub with four `TODO(laravel)` markers. Switching `VITE_API_PROVIDER=laravel`
activates it. Your job is to make the backend match it.

### Exact parameter mapping to implement

| Client sends | Laravel receives | Requirement |
|---|---|---|
| `page` | `page` | 1-based, identical |
| `limit` | `per_page` | Cap at 100 server-side (the client already clamps) |
| `sort` | `sort` | **Validate against a per-resource allow-list** — never interpolate into SQL |
| `order` | `order` | `asc` \| `desc`, default `desc` |
| `search` | `search` | Scoped to the fields §6 lists for that resource — *not* every column |
| `<field>` | `<field>` | Equality. Repeated keys mean OR: `status=held&status=released` |
| `<field>_gte` / `<field>_lte` | same | Parse the suffix into `where(field, '>=', …)` |
| array membership | plain repeated filter | `categories=cat_food_beverage` resolved with `whereJsonContains` or a pivot join |

The client serialises repeated keys **without brackets** (`status=a&status=b`,
not `status[]=a`) — `apiClient` sets `paramsSerializer: { indexes: null }` for
exactly this. Laravel's request parsing needs to accept that form.

### Exact response envelope to emit

```json
{ "items": [ … ], "total": 128, "page": 2, "limit": 20 }
```

Laravel's `paginate()` emits `{ data, meta: { total, current_page, per_page } }`.
**Reshape it in an API Resource collection** so the wire format is the envelope
above. `parseLaravelResponse` is written as a pass-through with defensive
defaults on that assumption. If you ship the native paginator shape instead, map
it *in `listAdapter.js`* — never in a service, and never in a component.

### Two behaviours that must improve, not port

- `q` in JSON Server searches **every field**, so a buyer's `bio` matches a
  title search (`MOCK-SEARCH`). Scope `search` properly.
- `_sort` is a plain JS comparison: case-sensitive, `null` first ascending
  (`MOCK-SORT`). MySQL collation will differ, which is fine — but check the
  screens that depend on a stable order, which §6 documents per resource.

---

## Step 5 — Uploads

**Read:** [api-contract §5](api-contract.md#5-uploads).

`uploadService` exposes two functions and returns one shape. Keep both.

```js
uploadService.upload(file, { purpose })      // → { file: <FileRecord> }
uploadService.uploadFiles(files, { purpose }) // → <FileRecord>[]
```

```js
// The FileRecord the rest of the app stores and renders — do not change it.
{
  id: 'dfl_…',            // or 'evd_…' for dispute evidence
  name: 'cold-brew-hero.jpg',
  url: 'https://…',       // today: an object URL that dies with the tab
  thumbnailUrl: 'https://…',
  mediaType: 'image',     // 'image' | 'video'
  sizeKb: 2480,
}
```

Today (`MOCK-UPLOAD`, 7 sites) nothing leaves the browser: `upload` validates
type and size, waits a size-proportional fake latency, and mints an object URL.
Files do not survive a refresh, and videos get a placeholder poster
(`MOCK-MEDIA`).

### What to build

- `POST /uploads` — `multipart/form-data`, one file plus a `purpose` field. The
  five values are in `UPLOAD_PURPOSE`: `portfolio`, `delivery`,
  `dispute_evidence`, `profile_image`, `request_reference`. Returns the
  `FileRecord` above.
- Enforce the same limits server-side. They are declared in
  `UPLOAD_RULES` per purpose (accepted MIME types, max size, max count) and the
  client validates against them first for a fast error — but the client is not
  the authority.
- Generate a real `thumbnailUrl`: an image derivative, and a **video poster
  frame** (the placeholder exists only because the browser cannot make one).
- Store on S3-compatible storage or `storage/app/public` behind a signed URL.
  Deliverables are paid-for commercial content — they should not be publicly
  guessable.
- Scan or at minimum re-encode uploads. The Content Policy is enforced by human
  moderation in this product; malware is not.

The file id prefixes (`dfl_`, `evd_`) are minted by `uploadService` today and
move server-side with everything else — see the next step.

---

## Step 6 — The payment provider

**Read:** [`payments.md`](payments.md) — the whole document, especially §2 (the
interface), §10 (swapping in a real provider), and §5 (state tables).

### The interface stays

`src/services/payments/paymentProvider.js` defines it, and
`dummyPaymentProvider` implements it. A real provider implements the same three
methods:

```js
createPayment({ amount, currency, method })  // → { providerRef, status: 'processing' }
confirmPayment(providerRef)                  // → { status: 'succeeded'|'failed', failureCode?, failureReason? }
refund(providerRef, amount?)                 // → { status: 'refunded', amount }
```

**A provider never throws for a business outcome.** A decline is
`{ status: 'failed', failureCode }`. Exceptions are for transport and
configuration failures only. That distinction is what lets `paymentService`
treat "the bank said no" and "the network is down" as different things, and the
checkout UI already renders them differently.

### The rule that changes the architecture

> A live secret key must never reach the browser.

So the "real provider" module registered in the factory is **not** a gateway SDK
— it is a thin client for your Laravel endpoints. The factory comment says
exactly this. The flow becomes:

```
Browser ──POST /orders/:id/pay──► Laravel ──► Gateway
                                     ▲
Gateway ──webhook──► Laravel ────────┘   (authoritative settlement)
```

### Server-side money authority

Everything about the money must be decided by the server:

- **The amount** comes from the order, never from the request body. The client
  sends a card and an order id, nothing else.
- **The commission rate** is resolved from `platform_settings` at settlement
  time, with any category override, and stamped onto the order
  (`commission_rate`, `commission_amount`, `creator_earnings`).
- **Rounding** follows `docs/payments.md` §6.4 — round the commission to 2dp,
  derive earnings by subtraction, so the two can never disagree by a cent.
- **The partial-refund rule** (§6.5): commission is charged only on the portion
  the creator keeps. The certification run verifies this arithmetic explicitly.

### Webhooks → escrow transitions

The mock confirms synchronously; a real gateway does not. Map webhooks onto the
payment state machine in `payments.md` §5:

| Gateway event | Payment | Order |
|---|---|---|
| `payment_intent.processing` | `initiated` → `processing` | stays `pending_payment` |
| `payment_intent.succeeded` | `processing` → `held` | `pending_payment` → `in_progress` |
| `payment_intent.payment_failed` | `processing` → `failed` | stays `pending_payment` (buyer retries) |
| transfer/payout settled | `held` → `released` | → `completed` |
| refund succeeded | `held` → `refunded` / `partially_refunded` | → `refunded` / `completed` |

Make the webhook handler **idempotent** — gateways retry. Key on the provider's
event id, and use `payments.provider_ref` as the join back to your record.
[api-contract §1.8](api-contract.md#18-idempotency) covers the client side:
`Idempotency-Key` on the composite POSTs.

### Ledger invariants to enforce server-side

`payments.md` §7 lists them. The two that matter most: every settled order has
exactly one `charge`, one `release` and one `commission` row; and
`release − commission = creator_earnings` to the cent. The certification run
asserts both against the live API.

---

## Step 7 — Identifier generation moves server-side

`src/utils/id.js` mints ids in the browser (`MOCK-ID`, `MOCK-DATA`) because
JSON Server does not. The module documents its own deletion:

> when that swap happens, `generateId` calls disappear from the services and
> this module goes with them.

### What to do

1. **Server mints the id** in the create endpoint and returns it in the
   response body. Services already use the returned record rather than the one
   they sent, so this needs no component changes.
2. **Keep the prefixes.** `usr_`, `ord_`, `pay_`, `txn_` … The full table is in
   `id.js` and [00 §8](../prompts/00-architecture-and-rules.md). They are used in
   support conversations, in the audit log, and on screen (`Order reference
   ord_008`). A UUID with a prefix (`ord_` + ULID) keeps them sortable and
   opaque.
3. **Reject client-supplied ids.** JSON Server honours a `POST` body's `id`,
   which is how this works today.
   [api-contract §9.2](api-contract.md#92-never-trust-client-supplied-ids) says
   it plainly: strip `id` from every create payload server-side. A client that
   can choose an id can overwrite a record.
4. **Delete `generateId` from the services** once every create returns an id.
   Grep for `generateId(` — the call sites are all in `src/services/`.

---

## Step 8 — Server-side jobs

Four behaviours are approximated in the browser today because JSON Server has no
scheduler. Each becomes a queued job or a scheduled command.

### 8a. Auto-accept of deliveries

A delivered order auto-accepts after the window in
`platform_settings.general.autoAcceptWindow` — the buyer's order screen says so
("it accepts automatically on Aug 18, 2026"). Today nothing enforces it; the
date is computed and displayed, and acceptance only happens if someone clicks.

```php
// app/Console/Commands/AutoAcceptDeliveries.php — hourly
Order::where('status', OrderStatus::Delivered)
     ->where('delivered_at', '<=', now()->subDays($window))
     ->each(fn ($order) => app(OrderService::class)->complete($order, reason: 'auto_accepted'));
```

Use the **same** completion path as a buyer accepting, so the ledger rows are
byte-identical. `completeOrder` already takes a `reason`, and notifies the buyer
only when they did not do it themselves — keep that distinction.

### 8b. Affiliate attribution expiry

`affiliate_referrals` are captured `pending` and convert on the referred user's
first completed order. They expire after the window in
`platform_settings.affiliate` (`MOCK-ATTRIBUTION`, 2 sites). The contract notes
this should be "a scheduled job".

```php
AffiliateReferral::where('status', 'pending')
                 ->where('captured_at', '<=', now()->subDays($window))
                 ->update(['status' => 'expired']);
```

Also move the capture itself server-side: the referral code currently lives in
`localStorage` under `bb.referralCode` and is read at registration. A signed
cookie or a `?ref=` parameter resolved server-side is the real implementation.

### 8c. Notification fan-out

`broadcastAnnouncement` writes one notification **per recipient, sequentially**,
from the browser (`MOCK-FANOUT`, 5 sites) — because JSON Server drops one of two
concurrent POSTs. An announcement to every creator is N round trips and fails
halfway if the tab closes.

```php
BroadcastAnnouncement::dispatch($announcement);   // queued
// inside: chunk recipients, respect notification_prefs, insert in batches
```

Respect `users.notification_prefs` server-side. The categories and the
mandatory-category rule (account/announcement notifications cannot be muted
in-app) are implemented in `notificationService`; port both.

### 8d. Audit-log immutability

`audit_logs` are append-only by convention today — nothing stops a `PATCH`
(`MOCK-APPEND`, 4 sites). Make it structural:

- No update or delete endpoints. Ever.
- `REVOKE UPDATE, DELETE ON audit_logs` from the application database user.
- Write audit rows **inside** the same transaction as the action they record, so
  an action that rolls back leaves no trail claiming it happened.
- Consider a hash chain (`prev_hash`) if the client needs tamper evidence.

`docs/audit-log-coverage.md` lists every action that writes an audit row today —
port that coverage exactly, then add the ones the mock could not (login, token
issue, permission changes taking effect).

---

## Step 9 — Authorization

> ### ⚠️ The frontend guards are UX only.
>
> `src/routes/guards.jsx` says so in its own header comment, and
> [api-contract §9.1](api-contract.md#91-frontend-guards-are-ux-only) repeats
> it. Every check in `GuestRoute`, `ProtectedRoute`, `RoleRoute`,
> `PermissionGate` and `hasPermission()` runs **in the browser** and can be
> bypassed by anyone willing to open devtools.
>
> **A hidden button is not a permission. An unreachable route is not a protected
> resource.** With JSON Server, every record in the database is readable and
> writable by anyone who knows the URL — including `users` rows with their
> plain-text passwords.

The Laravel API must enforce every rule independently. The frontend guards then
become what they were always meant to be: a way to avoid showing people doors
they cannot open.

### Endpoint permission table

Roles: `buyer`, `creator`, `admin`, `super_admin`. Admins additionally carry a
`permissions` array; `super_admin` implicitly holds all of them. Permission keys
are defined in `src/constants/permissions.js`.

| Area | Endpoints | Who may call it |
|---|---|---|
| Public marketplace | `GET /creatorProfiles`, `GET /portfolioItems` (published only), `GET /categories`, `GET /contentRequests` (open only), `GET /reviews` | anyone, **unauthenticated** |
| Own account | `GET/PATCH /auth/me`, `POST /auth/change-password`, `GET/PATCH` own profile row | the owner |
| Buyer briefs | `POST /contentRequests`, `PATCH/DELETE` own, `POST /contentRequests/:id/close` | `buyer` **and** owner of the record |
| Proposals (write) | `POST /proposals`, `PATCH` own, withdraw | `creator` **and** author |
| Proposals (decide) | `POST /proposals/:id/accept`, `/decline`, `/shortlist` | `buyer` **and** owner of the parent request |
| Orders | `GET /orders/:id` | the buyer, the creator, or an admin with `orders.manage` |
| Pay | `POST /orders/:id/pay` | `buyer` **and** the order's buyer |
| Deliver | `POST /orders/:id/deliveries` | `creator` **and** the order's creator |
| Accept / revise | `POST /deliveries/:id/accept`, `/revisions` | `buyer` **and** the order's buyer |
| Disputes (open/post) | `POST /disputes`, `POST /disputes/:id/messages` | a party to the order |
| Disputes (decide) | `POST /disputes/:id/resolve`, `/escalate`, `/request-info`, assign, close | admin with `disputes.resolve` |
| Payouts (request) | `POST /payouts` | `creator`, own balance only |
| Payouts (settle) | `POST /payouts/:id/process`, `/paid` | admin with `settlements.process` |
| Payments / refunds | `POST /payments/:id/refund`, escrow + commission reads | admin with `payments.manage` |
| Moderation | claim, decide, deliverable review | admin with `moderation.review` / `content.manage` |
| Reports | `POST /reports` (anyone signed in); triage | admin with `reports.manage` |
| Users | list, detail, suspend, blacklist, reactivate | admin with `users.manage` |
| Support | list, reply | admin with `support.manage` |
| Announcements | `POST /announcements` | admin with `announcements.send` |
| Affiliates | approve/void earnings, profile status | admin with `affiliates.manage` |
| Categories | create, update, deactivate | **`super_admin` only** |
| Platform settings | `PATCH /platformSettings` | **`super_admin` only** |
| Admin team | create admin, change permissions | **`super_admin` only**, and never on your own account |
| Audit log | `GET /auditLogs` | **`super_admin` only** (`audit.view` gates the nav) |

Notice the pattern: **role alone is never sufficient** for record-scoped
actions. "A buyer may accept a proposal" is wrong; "the buyer who owns the
parent request may accept a proposal" is right. Laravel Policies are the natural
home for this — one policy per model, `authorize()` in every controller action.

Two further rules the mock cannot enforce:

- **Non-`active` accounts are refused everywhere**, not just at login.
- **Field-level authorization.** A buyer PATCHing their own profile must not be
  able to set `role`, `permissions`, or `account_status`. Use Form Requests with
  explicit allow-lists, never `$request->all()`.

---

## Step 10 — Environment changes

### What changes

```diff
# .env
-VITE_API_BASE_URL=http://localhost:4000
+VITE_API_BASE_URL=https://api.betterblue.example
-VITE_API_PROVIDER=json-server
+VITE_API_PROVIDER=laravel
 VITE_APP_NAME=BetterBlue
-VITE_ENABLE_DEV_PAGES=true
+VITE_ENABLE_DEV_PAGES=false
```

`VITE_ENABLE_DEV_PAGES=false` removes the developer surfaces from the build: the
`/dev/design` gallery, the demo-account panel on the sign-in screen, and the
test-card panel on checkout. This is verified as part of the release
certification — see `e2e-walkthrough.md` §12.

All four are read **only** through `src/config/env.js`. Nothing else in `src/`
touches `import.meta.env`.

### What must NOT change

These are a shared contract between the frontend and the API. Changing one on
the backend silently breaks screens on the frontend.

| Do not change | Where it lives | Why |
|---|---|---|
| **Status values** | `src/constants/statuses.js` | `'pending_payment'`, `'partially_refunded'`, `'awaiting_creator'` … are the wire values. `STATUS_META` maps each to a label, a tone and a description used by `StatusChip` everywhere |
| **State-machine edges** | `src/constants/stateMachines.js` | The client refuses illegal transitions before calling. If the server allows an edge the client does not, the UI will never offer it |
| **Role values** | `src/constants/roles.js` | `buyer`, `creator`, `admin`, `super_admin` — also the routing keys |
| **Permission keys** | `src/constants/permissions.js` | `users.manage`, `settlements.process` … stored in `users.permissions` |
| **Id prefixes** | `src/utils/id.js` | User-visible in references and support |
| **The error envelope and codes** | api-contract §3 | `ApiError` parses this shape; `details` drives inline field errors |
| **The list envelope** | api-contract §4.2 | `{ items, total, page, limit }` |
| **Notification types** | `src/constants/notificationTypes.js` | Drive icon, routing and preference category |
| **Field names on the wire** | api-contract §6 | The client reads `creatorEarnings`, not `creator_earnings` — use API Resources to camelCase, or change the services (not the components) |

That last one deserves emphasis: **this client speaks camelCase.** Laravel's
convention is snake_case columns. Do the conversion in API Resources so the wire
format matches §6 exactly. Do not do it in the client — you would touch every
service instead of one resource layer.

---

## Migration test plan

The acceptance test already exists and has been executed against the mock stack:
[`e2e-walkthrough.md`](e2e-walkthrough.md). Re-run it against Laravel.

### Phase 0 — Contract conformance

Point `scripts/smoke-api.mjs` at the new API:

```bash
node scripts/smoke-api.mjs --base https://api.betterblue.example
```

It checks list envelopes, pagination, filtering, sorting, item reads, 404s, the
settings singleton, and a write round-trip — using the exact query spellings the
list adapter builds. Anything it fails is a contract deviation, not a bug in the
test. Expect the scratch-record cleanup section to need adjusting once deletes
are real.

Then `scripts/smoke-workflow.mjs` for the escrow lifecycle: charge → held →
release → commission, a declined card, and a partial refund with the
retained-portion commission rule. **These two scripts are the fastest possible
signal that the backend matches the contract**, and they are dependency-free
Node.

### Phase 1 — Parity by section

Work through `e2e-walkthrough.md` §1–§9 in order. Each section states the
expected result of every step, so a difference is unambiguous. In particular:

| Section | What it proves about the backend |
|---|---|
| §2 Public | Unauthenticated reads, filters, and the request board |
| §3 Buyer journey | Registration, the composite `acceptProposal`, escrow, delivery, revision, release, review aggregates |
| §4 Disputes | The most write-heavy composite; ledger arithmetic on a partial refund |
| §5 Creator finance | Balance reconciliation against the ledger; the two-step payout |
| §6 Moderation | The content lifecycle and the creator-facing decision |
| §7 Admin ops | Suspension enforced at sign-in; fan-out; permission gates |
| §8 Super admin | Settings taking effect live; permission reality for a limited admin |
| §9 Notifications | Preference suppression |

### Phase 2 — What the mock could not test

These have no mock-era baseline, so write new tests:

1. **Authorization for real.** For every row of the [Step 9 table](#endpoint-permission-table),
   call the endpoint as the wrong role *and* as the right role but the wrong
   record owner. Both must be `403`. This is the single most important new test
   suite — it covers ground the prototype structurally could not.
2. **Transactions.** Kill the process mid-composite (or force a failure in the
   last write) and assert nothing partial persisted. `docs/payments.md` §9.2
   lists the half-states that are reachable today; none should be reachable
   after.
3. **Concurrency.** Two buyers accepting proposals on the same request; two
   admins resolving the same dispute; a creator delivering while the buyer
   cancels. The mock has no locking at all.
4. **Uniqueness.** Register the same email twice, concurrently. Expect one
   `conflict`.
5. **Webhooks.** Replay the same gateway event twice; assert one ledger row.
6. **Jobs.** Fast-forward the clock and assert auto-accept and attribution
   expiry fire exactly once.
7. **Token lifecycle.** Suspend an account that holds a live token; the next
   request must fail.

### Phase 3 — Cutover checklist

- [ ] `npm run smoke:api` and `npm run smoke:workflow` green against Laravel
- [ ] `e2e-walkthrough.md` §1–§9 re-executed, all steps passing
- [ ] Route × role matrix re-run (walkthrough §11) — now backed by real 403s
- [ ] Authorization suite from Phase 2 passing
- [ ] `VITE_API_PROVIDER=laravel`, `VITE_ENABLE_DEV_PAGES=false`
- [ ] `npm run build` clean; dev surfaces absent from the bundle
- [ ] `src/utils/id.js` deleted and `generateId` call sites removed
- [ ] `MOCK-AUTH` markers gone from `authService`
- [ ] Seeded demo data migrated or replaced; plain-text passwords **not** imported

---

## Appendix — the `MOCK-*` marker index

Every mock behaviour in `src/` carries a marker comment naming what it is and
what replaces it. **147 markers across 55 files.** Grep them as a work list:

```bash
grep -rn "MOCK-" src/ | less
```

| Marker | Count | What it marks | Resolved by |
|---|---|---|---|
| `MOCK-JOIN` | 38 | Related records fetched in a second call because JSON Server cannot join | Eager loading / API Resources |
| `MOCK-AUTH` | 23 | Plain-text passwords, browser-minted tokens, client-side status checks | [Step 3](#step-3--authentication) |
| `MOCK-AGGREGATE` | 19 | Counts and sums computed by fetching rows and reducing in JS | SQL aggregates |
| `MOCK-UPLOAD` / `MOCK-MEDIA` | 11 | No upload endpoint; object URLs; placeholder video posters | [Step 5](#step-5--uploads) |
| `MOCK-ATOMICITY` | 7 | Multi-write sequences with no transaction | [Step 1c](#1c-composite-operations--the-important-half) |
| `MOCK-FANOUT` | 5 | Sequential per-recipient writes | [Step 8c](#8c-notification-fan-out) |
| `MOCK-APPEND` | 4 | Append-only by convention, not by constraint | [Step 8d](#8d-audit-log-immutability) |
| `MOCK-SORT` / `MOCK-SEARCH` / `MOCK-FILTER` / `MOCK-QUERY` | 10 | JSON Server list semantics | [Step 4](#step-4--the-listadapter-laravel-branch) |
| `MOCK-SEQUENCE` | 3 | Ordering that a transaction would make irrelevant | [Step 1c](#1c-composite-operations--the-important-half) |
| `MOCK-GUARD` | 3 | A rule enforced client-side that the server must own | [Step 9](#step-9--authorization) |
| `MOCK-BULK` | 3 | N writes where one statement belongs | Batch updates |
| `MOCK-ATTRIBUTION` | 2 | Referral code in `localStorage` | [Step 8b](#8b-affiliate-attribution-expiry) |
| `MOCK-COUNT` | 2 | Non-atomic counters | `UPDATE … SET n = n + 1` |
| `MOCK-ID` / `MOCK-DATA` | 2 | Client-minted identifiers | [Step 7](#step-7--identifier-generation-moves-server-side) |
| `MOCK-UNIQUENESS` | 1 | Read-then-write uniqueness race | Unique index |
| `MOCK-DELETE` | 1 | JSON Server's cascade bug — a successful delete answers 500 | Real deletes |
| `MOCK-BALANCE` / `MOCK-DERIVED` / `MOCK-APPROXIMATE` | 3 | Values recomputed client-side that a view or column should own | SQL |
| others | ~10 | `MOCK-RATE`, `MOCK-PAYMENT`, `MOCK-TRANSFER`, `MOCK-VERSIONING`, `MOCK-MERGE`, `MOCK-LIMIT`, `MOCK-TIMESTAMP`, `MOCK-PAGINATION`, `MOCK-CAVEAT`, `MOCK-API` | see each site |

When a marker's replacement is in place, delete the marker with the code. The
grep count reaching zero is a meaningful definition of done.

---

## Related documents

- [`README.md`](README.md) — the documentation index
- [`api-contract.md`](api-contract.md) — the REST contract this frontend codes against
- [`data-model.md`](data-model.md) — collections, fields, relations, MySQL mapping
- [`payments.md`](payments.md) — escrow, commission, ledger invariants, provider swap
- [`e2e-walkthrough.md`](e2e-walkthrough.md) — the certification scenario to re-run
- [`notifications-audit.md`](notifications-audit.md) — notification emit coverage
- [`audit-log-coverage.md`](audit-log-coverage.md) — which actions write audit rows
- [`qa-checklist.md`](qa-checklist.md) — the accessibility and quality audit
- [`../prompts/00-architecture-and-rules.md`](../prompts/00-architecture-and-rules.md) — the permanent project rules
