# BetterBlue API Contract

This is the REST contract the BetterBlue frontend codes against. It has two
audiences and one purpose:

- **Today** — Prompt 07 implements `src/services/` strictly against this
  document. Nothing above the services layer knows how the data arrives.
- **Tomorrow** — a Laravel/MySQL backend replaces the mock stack. This document
  is written so that backend can be built **from this file alone**, without
  reading any frontend code.

The mock stack is JSON Server 0.17.4 over `server/db.json`. JSON Server cannot
authenticate, cannot enforce authorization, cannot validate, cannot join, and
cannot run a transaction. Rather than let those limits leak into the product,
this contract describes the **target API** first, then records exactly how the
mock era approximates it and where the seam is. Every such note is marked:

> **Mock reality** — what JSON Server actually does today, and which module owns
> the difference.

> **Laravel** — what the real backend should do instead.

Related: [`docs/data-model.md`](data-model.md) (collections, fields, MySQL
mapping) · [`prompts/00-architecture-and-rules.md`](../prompts/00-architecture-and-rules.md)
(§8 domain model, §9 enums, §10 API layer rules, §15 migration principles).

---

## Contents

1. [Conventions](#1-conventions)
2. [Authentication](#2-authentication)
3. [Errors](#3-errors)
4. [Lists: pagination, filtering, sorting, search](#4-lists-pagination-filtering-sorting-search)
5. [Uploads](#5-uploads)
6. [Resource reference](#6-resource-reference)
7. [Composite operations](#7-composite-operations)
8. [Status and enum reference](#8-status-and-enum-reference)
9. [Security notes](#9-security-notes)

---

## 1. Conventions

### 1.1 Base URL

The base URL comes from the environment and is read **only** through
`src/config/env.js` (00 §4):

```
VITE_API_BASE_URL=http://localhost:4000     # mock era
VITE_API_PROVIDER=json-server
```

Every path in this document is relative to that base. There is no version
segment in the path; versioning, if it is ever needed, belongs in the base URL.

> **Laravel** — mount the same paths under `/api` and point the client at
> `https://api.betterblue.example/api`. Because the paths are identical, moving
> backends is a `.env` change plus the list adapter swap (§4.5). No component,
> hook, page, or route changes.

### 1.2 Media types

| Direction | Header |
|---|---|
| Every request | `Accept: application/json` |
| Requests with a body | `Content-Type: application/json` |
| `POST /uploads` only | `Content-Type: multipart/form-data` |
| Every response | `Content-Type: application/json; charset=utf-8` |

Responses are always JSON — including errors. A body is never empty except on
`204 No Content`.

### 1.3 Resource naming

Collection paths are **camelCase plurals** matching the collection names in
`server/db.json` and `docs/data-model.md`:

| Path | Path | Path |
|---|---|---|
| `/users` | `/payments` | `/reports` |
| `/buyerProfiles` | `/transactions` | `/supportTickets` |
| `/creatorProfiles` | `/commissions` | `/affiliateProfiles` |
| `/portfolioItems` | `/payouts` | `/affiliateReferrals` |
| `/categories` | `/disputes` | `/affiliateEarnings` |
| `/contentRequests` | `/disputeMessages` | `/auditLogs` |
| `/proposals` | `/reviews` | `/platformSettings` |
| `/orders` | `/notifications` | `/auth/*` |
| `/deliveries` | `/moderationReviews` | `/uploads` |
| `/revisions` | | |

**This is a decision, not an accident.** Kebab-case (`/creator-profiles`) is the
more common REST convention, but JSON Server derives its routes from the keys of
`db.json`, so the mock era serves camelCase whatever we prefer. Choosing
kebab-case for the target would mean either a rewrite of every service at
migration time or an alias layer that exists only to paper over a cosmetic
choice. **Laravel must expose these exact camelCase paths** — declare them
explicitly in `routes/api.php` rather than relying on `Route::apiResource`
pluralisation, which would emit snake_case.

Sub-resources use the same style: `/orders/:id/deliveries`,
`/disputes/:id/messages`.

### 1.4 Identifiers

IDs are **opaque prefixed strings** (00 §8) — never integers, never sequential,
never meaningful to the client:

`usr_` `bpr_` `cpr_` `pfi_` `cat_` `req_` `prp_` `ord_` `dlv_` `rev_` `pay_`
`txn_` `com_` `pyo_` `dsp_` `dmsg_` `rvw_` `ntf_` `mod_` `rpt_` `tkt_` `aff_`
`ref_` `aer_` `aud_` — plus `dfl_` (delivery files) and `evd_` (dispute
evidence) on embedded records.

Treat every id as an opaque token: do not parse it, do not sort by it, do not
infer ordering or ownership from it.

> **Mock reality** — JSON Server assigns its own id when a `POST` body has none,
> and the id it invents does not carry our prefix (an observed example:
> `"id": "7kZHi6t"`). So every create in the mock era generates its id
> client-side via `src/utils/id.js` (`generateId('ord')`) and sends it in the
> body. This is confined to the services layer and is the single largest
> "wrong on purpose" in the mock stack.

> **Laravel** — the server generates ids and **ignores any client-supplied
> `id`**. Accepting one would let a caller overwrite an existing record or
> collide deliberately. `POST` bodies documented below still show `id` for the
> mock era; the real backend must strip it.

### 1.5 Dates

ISO 8601, UTC, millisecond precision, `Z` suffix: `"2026-08-08T20:20:00.000Z"`.

Two rules, carried over from `docs/data-model.md` §3:

- **Lifecycle timestamps are always present and `null` until the event
  happens** — `activatedAt`, `deliveredAt`, `completedAt`, `cancelledAt`,
  `submittedAt`, `publishedAt`, `respondedAt`, `heldAt`, `releasedAt`,
  `refundedAt`, `processedAt`, `resolvedAt`, `reviewedAt`, `convertedAt`,
  `approvedAt`, `paidAt`. The client may rely on the key existing.
- **Other optional fields are omitted entirely** when they do not apply —
  `rejectionReason`, `assignedAdminId`, `resolution`, `failureReason`,
  `refundedAmount`, `permissions`, `referredByCode`, `reasonCode`, `notes`, …

Clients format dates only through the dayjs helpers in `utils/formatters.js`.
They never parse them by hand and never send a locale-formatted date.

### 1.6 Money

Money is a **JSON number** with a sibling `currency` field, always `"USD"` in
this prototype:

```json
{ "price": 940, "currency": "USD", "commissionRate": 0.2, "commissionAmount": 188 }
```

Rates are decimal fractions (`0.2` = 20%), not percentages. The commission rule
(00 §9) holds everywhere:

```
commissionAmount = round(price × commissionRate, 2)
creatorEarnings  = price − commissionAmount
```

> **Laravel** — store as `DECIMAL(10,2)` (rates `DECIMAL(5,4)`) and serialise as
> numbers. **Never trust a client-supplied amount**: recompute `price`,
> `commissionAmount`, `creatorEarnings`, refunds, and payout balances
> server-side from the accepted proposal and `platformSettings` (§9).

### 1.7 Verbs and status codes

| Verb | Use | Success |
|---|---|---|
| `GET` (collection) | List, with the params in §4 | `200` |
| `GET` (item) | Fetch one record by id | `200` |
| `POST` (collection) | Create | `201` + the created record |
| `POST` (action path) | Composite operation, e.g. `/orders/:id/release` | `200` + affected records |
| `PATCH` | **Partial** update — send only changed fields | `200` + the updated record |
| `DELETE` | Not used — see below | `204` |

**`PUT` is not part of this contract.** Full-replacement semantics would drop
any field the client did not happen to know about, which is exactly the failure
mode a long-lived record like `orders` cannot afford. Every update is a `PATCH`.

**`DELETE` is not part of this contract either.** Nothing in BetterBlue is hard
deleted — removal is always a status transition, so history, money, and audit
trails stay intact:

| "Delete" in the UI | Actually | Status |
|---|---|---|
| Close an account | `PATCH /users/:id` | `accountStatus: deactivated` |
| Ban an account | `PATCH /users/:id` | `accountStatus: blacklisted` |
| Remove a portfolio item | `PATCH /portfolioItems/:id` | `status: archived` |
| Cancel a brief | `PATCH /contentRequests/:id` | `status: cancelled` |
| Withdraw a proposal | `PATCH /proposals/:id` | `status: withdrawn` |
| Cancel an order | `POST /orders/:id/cancel` | `status: cancelled` |

> **Mock reality** — `DELETE` is not merely unused, it is *broken* here. JSON
> Server's cascade-delete pass walks every top-level key of `db.json` as though
> it were a collection; `platformSettings` is a singleton object whose nested
> values have no `id`, so the pass throws. The observed result is the worst
> possible one: **the record is removed and the response is `500`**. One more
> reason the client never issues `DELETE`.

> **Laravel** — implement soft deletes only if a genuine need appears. Reserve
> hard `DELETE` for records with no financial or moderation consequence, and
> never expose it for `users`, `orders`, `payments`, `transactions`,
> `commissions`, or `auditLogs`.

### 1.8 Idempotency

`GET`, `PATCH`, and `DELETE` are idempotent by construction. `POST` is not.

The dangerous cases are the money-moving ones: a double-submitted checkout must
not charge twice, and a retried release must not pay a creator twice.

> **Laravel** — accept an `Idempotency-Key: <uuid>` request header on
> `POST /orders/:id/pay`, `POST /orders/:id/release`,
> `POST /payments/:id/refund`, and `POST /payouts`. Store the key with the
> resulting response for 24h; a repeat of the same key returns the stored
> response instead of acting again. Also enforce the invariants that make
> double-execution impossible at the data layer: `orders.request_id UNIQUE`,
> `commissions.order_id UNIQUE`, `reviews.order_id UNIQUE`,
> `affiliate_earnings (affiliate_id, order_id) UNIQUE`, and a status guard in a
> transaction (`SELECT … FOR UPDATE`).

> **Mock reality** — there is no idempotency key. The client's best effort is a
> read-before-write guard (`GET /commissions?orderId=…` before creating one) and
> disabling the submit button while a mutation is in flight. Both are racy by
> construction; the mock stack has no transaction to make them safe. This is
> documented rather than solved, because solving it needs a server.

### 1.9 Summary of what the mock stack cannot do

| Capability | Mock era | Owned by | Laravel |
|---|---|---|---|
| Authentication | Simulated client-side | `authService` | Sanctum tokens |
| Authorization | Not enforced at all | route guards (UX only) | Policies + middleware |
| Validation | None — anything is accepted | form validators (UX only) | Form Requests |
| Multi-step atomicity | Sequential calls, no rollback | service functions | DB transactions |
| Joins / eager loading | Extra round trips (`_embed` is banned by 00 §10) | service functions | Eloquent relations |
| Server-side computation | Client computes and sends | service functions | Server computes, ignores client |
| Error envelope | Bare `{}` bodies | `apiError.js` normalises | Real envelope (§3) |
| Uploads | Simulated, placeholder URLs | `uploadService` | Real storage |
| Payments | Dummy provider | `services/payments/` | Real PSP |
| ID generation | Client-side | `utils/id.js` | Server-side |

---

## 2. Authentication

### 2.1 Target contract

Five endpoints. These signatures are what `authService` exposes and what
Laravel must implement — they do not change at migration.

#### `POST /auth/login`

Public. Exchanges credentials for a token.

```json
{ "email": "creator@betterblue.test", "password": "Password123!" }
```

`200 OK`

```json
{
  "token": "1|K3xq9fT2nR7wLm4pVbY8sZcD6hJ0aQeU",
  "user": {
    "id": "usr_creator_ava",
    "email": "creator@betterblue.test",
    "role": "creator",
    "accountStatus": "active",
    "name": "Ava Martinez",
    "avatarUrl": "data:image/svg+xml;charset=utf-8,%3Csvg…",
    "phone": "+1 512 555 0110",
    "createdAt": "2026-04-23T10:15:00.000Z",
    "lastLoginAt": "2026-08-14T08:30:00.000Z",
    "notificationPrefs": {
      "marketplace": { "inApp": true },
      "orders": { "inApp": true },
      "payments": { "inApp": true },
      "disputes": { "inApp": true },
      "moderation": { "inApp": true },
      "affiliate": { "inApp": true },
      "system": { "inApp": true }
    }
  }
}
```

The `user` object **never contains `password`** — see §9.

#### `POST /auth/register`

Public. Creates a `buyer` or `creator` account and signs it in. Returns the same
`{ token, user }` shape as login.

```json
{
  "name": "Nora Whitfield",
  "email": "nora@verdekitchen.test",
  "password": "Password123!",
  "role": "buyer",
  "referredByCode": "AVA-STUDIO"
}
```

- `role` must be `buyer` or `creator`. **`admin` and `super_admin` are never
  self-registerable** — a super admin creates those accounts (§6.2).
- `referredByCode` is optional; when present and it matches an active affiliate,
  the server records a `pending` referral (§7, `processConversion`).
- Registering also creates the matching profile row — `buyerProfiles` for a
  buyer, `creatorProfiles` for a creator — so a new account is never left
  without a profile.

`409 conflict` when the email is already registered.

#### `GET /auth/me`

Authenticated. Revalidates the token and returns the current user. The client
calls this on boot and after a tab regains focus, which is how a suspension
takes effect without waiting for the next sign-in.

`200 OK` → `{ "user": { … } }`

#### `POST /auth/password`

Authenticated. The signed-in member changes their own password (the account
settings screen).

```json
{ "currentPassword": "Password123!", "newPassword": "…" }
```

`200 OK` → `{ "user": { … } }`. A wrong current password is `422`
`validation_failed` with `details.currentPassword`; a replacement that fails the
strength rule is `422` with `details.newPassword`.

> **Laravel** — verify against the hash, hash the replacement, and revoke the
> member's **other** tokens in the same transaction, leaving the token that made
> the request alive so the member stays signed in where they are.

#### `POST /auth/logout`

Authenticated. Revokes the current token. `204 No Content`.

### 2.2 Bearer token

Every protected call carries:

```
Authorization: Bearer <token>
```

`services/api/apiClient.js` attaches this in a request interceptor from the
token in `utils/storage.js`; no other module touches the header. A `401` in a
response interceptor clears the stored session and redirects to sign-in.

The token is opaque to the client. It is **not** a JWT to be decoded for claims
— role and permissions come from the `user` object, refreshed by `GET /auth/me`.

### 2.3 Account status rules

`ACCOUNT_STATUS` gates access at the API, not just in the UI:

| `accountStatus` | Sign in? | Existing token | Response |
|---|---|---|---|
| `active` | Yes | Valid | — |
| `suspended` | **No** | **Revoked** | `403` `forbidden` |
| `blacklisted` | **No** | **Revoked** | `403` `forbidden` |
| `deactivated` | **No** | **Revoked** | `403` `forbidden` |

`POST /auth/login` and `GET /auth/me` both return:

```json
{
  "error": {
    "code": "forbidden",
    "message": "Access is temporarily restricted while our Trust & Safety team completes a review.",
    "details": { "accountStatus": "suspended" }
  }
}
```

`details.accountStatus` is what lets the client render the right status screen
(00 §11) instead of a generic error. The `message` values come from
`STATUS_META[accountStatus].description` in `src/constants/statuses.js`, so the
copy stays identical on both sides.

> **Laravel** — when an admin suspends or blacklists an account, delete that
> user's tokens in the same transaction. Do not rely on the client noticing.

### 2.4 Mock reality — `MOCK-AUTH`

JSON Server has no auth. `authService` simulates all five operations over
`/users`, **preserving the exact function signatures above** (00 §14):

| Function | What it actually does |
|---|---|
| `login({ email, password })` | `GET /users?email=<email>` → compare `password` in plain text → check `accountStatus` → mint a fake token → strip `password` → return `{ token, user }` |
| `register({ … })` | `GET /users?email=…` (uniqueness) → `POST /users` with a client-generated `usr_…` id → `POST /buyerProfiles` or `POST /creatorProfiles` → return `{ token, user }` |
| `me()` | `GET /users/:id` for the stored id → re-check `accountStatus` → strip `password` → return `{ user }` |
| `changePassword({ currentPassword, newPassword })` | `GET /users?email=…` → compare `password` in plain text → `PATCH /users/:id` with the new one → strip `password` → return `{ user }`. No other session can be revoked, because none exists |
| `logout()` | Clear local storage. Resolves. No request. |

Rules that keep this contained:

- Every line of it is marked `MOCK-AUTH:` in the source.
- The fake token is a random opaque string. It is never validated, because there
  is nothing to validate it against. It exists so the interceptor, the storage
  layer, and the sign-out path are all real code exercised from day one.
- `password` is **stripped in `authService`** and never enters `AuthContext`,
  React state, or storage. JSON Server *does* return it on `/users` (verified) —
  containing that leak is `authService`'s job (§9).
- Seeded passwords are plain text and every demo account shares
  `Password123!`. None of them is a secret.

> **Laravel** — replace `authService`'s four function bodies with real HTTP
> calls to the four endpoints in §2.1. **Nothing else in the app changes**: the
> signatures, the returned shapes, `AuthContext`, the guards, and the
> interceptor all stay as they are. That 1:1 swap is the whole point of the
> indirection.

### 2.5 Laravel implementation notes (Sanctum)

- `laravel/sanctum` with API tokens (not SPA cookie mode) matches the
  `Authorization: Bearer` header this client already sends.
- `POST /auth/login` → verify with `Hash::check`, reject non-`active`
  statuses **before** issuing a token, then
  `$user->createToken('web')->plainTextToken`.
- `POST /auth/logout` → `$request->user()->currentAccessToken()->delete()`.
- `GET /auth/me` → `$request->user()`, re-checking `account_status`.
- Protect everything else with `auth:sanctum`, plus a middleware that rejects
  non-`active` accounts on every request.
- Rate-limit `POST /auth/login` and `POST /auth/register`
  (`throttle:6,1` per IP + email) and return `429` `rate_limited` (§3.2).
- Use an API Resource for the user so `password` and `remember_token` are
  structurally impossible to serialise.

---

## 3. Errors

### 3.1 Envelope

Every non-2xx response has exactly this shape:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Some fields need your attention.",
    "details": { "price": "Enter an amount of at least $25." }
  }
}
```

| Field | Type | Notes |
|---|---|---|
| `code` | string | One of the canonical codes below. Stable, machine-readable — branch on this, never on `message`. |
| `message` | string | One sentence, safe to show a member. Never contains a stack trace, SQL, a file path, or an internal id. |
| `details` | object? | Omitted unless the code defines a shape for it. |

### 3.2 Canonical codes

| `code` | HTTP | When | `details` |
|---|---|---|---|
| `validation_failed` | `422` | A field is missing, malformed, or out of range | `{ [field]: message }` |
| `unauthorized` | `401` | No token, expired token, or bad credentials | — |
| `forbidden` | `403` | Authenticated but not allowed: wrong role, missing permission, not the owner, or a blocked account status | `{ accountStatus }` on status blocks; `{ permission }` on permission blocks |
| `not_found` | `404` | No such record, or one the caller may not see | — |
| `conflict` | `409` | The request contradicts current state: duplicate email, an illegal status transition, a second review on one order | `{ from, to }` on transition conflicts |
| `payment_failed` | `402` | The payment provider declined or errored | `{ reason }` |
| `rate_limited` | `429` | Too many requests | `{ retryAfterSeconds }` |
| `server_error` | `500` | Anything unhandled | — |

This list is **closed for the server**. New failure modes map onto an existing
code rather than adding a ninth, so the client's error handling never needs a
default branch it cannot reason about.

One code exists **only on the client**, and no backend ever sends it:

| `code` | HTTP | When | `details` |
|---|---|---|---|
| `network_error` | — (`status: 0`) | No response arrived at all: offline, DNS failure, timeout, CORS | — |

Two deliberate consequences:

- **`404` hides existence.** A buyer requesting another buyer's order gets
  `404`, not `403`. Returning `403` would confirm the record exists. `403` is
  reserved for resources the caller can legitimately see but not act on.
- **Transport failures are their own code, not a fake `500`.** When no HTTP
  response arrives, `apiError.js` synthesises `network_error` with `status: 0`.
  Folding it into `server_error` would make the two most common failures in
  development — "the API is down" and "the API broke" — indistinguishable, and
  the recovery differs: one is "start `npm run api`", the other is "retry".
  In development the message says so outright: *"Can't reach the BetterBlue API
  — is `npm run api` running?"* Everything else still branches on the eight
  server codes above.

### 3.3 Validation details

`details` maps **field name → one human sentence**, ready to render under the
input:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Some fields need your attention.",
    "details": {
      "price": "Enter an amount of at least $25.",
      "deliveryDays": "Delivery must be between 1 and 60 days.",
      "coverMessage": "Tell the buyer how you would approach this brief."
    }
  }
}
```

- Keys are the request-body field names, camelCase, exactly as sent.
- Nested fields use dots: `"method.last4"`.
- One message per field — the first failure, not an array.

`useForm` (00 §12) maps `details` straight onto its field-error state and
focuses the first invalid field. Forms validate client-side too, but that is
UX: the server's answer is authoritative and always rendered when it disagrees.

> **Laravel** — a Form Request produces
> `{"message": …, "errors": {"price": ["…"]}}`. Convert it in the exception
> handler: take `errors`, keep the first string of each array, and emit the
> envelope above. Do not ship Laravel's native shape — the client would need
> two parsers.

### 3.4 Client normalisation — `ApiError`

`services/api/apiError.js` turns **any** provider failure into one class, and
this is the only error type the rest of the app ever sees (00 §10):

```js
ApiError {
  status,    // number — HTTP status, or 0 when no response arrived
  code,      // string — one of the eight canonical codes, or `network_error`
  message,   // string — safe to display
  details,   // object | undefined
}
```

Status codes map to codes as follows. `400` and `413` are not in the table above
— no endpoint in this contract returns them — but a proxy or a provider might,
so the client folds both into `validation_failed` rather than reporting a
`server_error` a member cannot act on:

| Status | `code` |
|---|---|
| `400`, `413`, `422` | `validation_failed` |
| `401` | `unauthorized` |
| `402` | `payment_failed` |
| `403` | `forbidden` |
| `404` | `not_found` |
| `409` | `conflict` |
| `429` | `rate_limited` |
| any other non-2xx | `server_error` |
| no response | `network_error` (`status: 0`) |

A response body carrying the §3.1 envelope always wins over this table — that is
what makes the client Laravel-ready before Laravel exists.

The mock era needs this badly, because JSON Server's failures carry no envelope
at all. Verified behaviour and how it is normalised:

| Observed from JSON Server | Normalised to |
|---|---|
| `404` with body `{}` | `ApiError { status: 404, code: 'not_found' }` |
| `500` on `POST` with a duplicate `id` | `ApiError { status: 500, code: 'conflict' }` — the only cause of a 500 on create here |
| `500` on `DELETE` (the `platformSettings` cascade bug, §1.7) | `ApiError { status: 500, code: 'server_error' }` — and the client never issues `DELETE` |
| Any other non-2xx | `ApiError { status, code: 'server_error' }` |
| No response (offline, timeout, CORS) | `ApiError { status: 0, code: 'network_error' }` |
| `401` (Laravel era) | `ApiError { status: 401, code: 'unauthorized' }` → interceptor clears the session |

Client-side guards that the real backend will enforce — an illegal status
transition caught by `utils/stateMachine.js#assertTransition`, a permission
check, an ownership check — **throw the same `ApiError`** with the same codes
(`conflict`, `forbidden`). So when Laravel starts returning them for real, the
UI already handles them and no call site changes.

---

## 4. Lists: pagination, filtering, sorting, search

### 4.1 Standard parameters

Every collection `GET` accepts the same five parameters, plus its own filters.

| Param | Type | Default | Notes |
|---|---|---|---|
| `page` | int ≥ 1 | `1` | 1-based |
| `limit` | int 1–100 | `12` (`appConfig.defaultPageSize`) | |
| `sort` | string | per resource | A field name. Only documented fields are sortable. |
| `order` | `asc` \| `desc` | `desc` | |
| `search` | string | — | Free text across that resource's searchable fields |

Filters are additional named params, documented per resource in §6:

| Form | Meaning | Example |
|---|---|---|
| `field=value` | Exact match | `status=open` |
| `field=a&field=b` | Match **any** listed value (OR) | `status=held&status=released` |
| `field_gte=` / `field_lte=` | Inclusive range — numbers and dates | `price_gte=500&price_lte=1200` |

Unknown params are ignored, never an error. Filters combine with AND; repeated
values of one filter combine with OR.

### 4.2 Standard response envelope

Every list response — from every provider, forever:

```json
{
  "items": [ … ],
  "total": 46,
  "page": 1,
  "limit": 12
}
```

`total` is the count **after filters, before pagination** — it is what drives
`PaginationControl` and "46 briefs" counters. `items` is `[]` when nothing
matches; an empty result is `200`, never `404`.

### 4.3 JSON Server mapping

`services/api/listAdapter.js` is the **only** module in the codebase that knows
any of this (00 §10). Every row below was verified against a running
`json-server 0.17.4` on this `db.json`.

| Contract | JSON Server | Notes |
|---|---|---|
| `page` | `_page` | 1-based in both |
| `limit` | `_limit` | |
| `sort` | `_sort` | Multi-field: `_sort=a,b` with `_order=desc,asc` |
| `order` | `_order` | |
| `search` | `q` | Full-text across all fields of the record |
| `field=value` | `field=value` | Pass-through |
| `field=a&field=b` | `field=a&field=b` | Pass-through — OR semantics confirmed |
| `field_gte` / `field_lte` | `field_gte` / `field_lte` | Pass-through — same spelling |
| `total` | `X-Total-Count` response header | See the caveat below |
| `{ items, total, page, limit }` | A **bare JSON array** | The adapter builds the envelope |

Three findings that the adapter has to own:

**1. `X-Total-Count` is conditional.** It is present when `_page` or `_limit` is
sent, and **absent** when neither is. Verified:

```
GET /creatorProfiles?_page=1&_limit=2   → X-Total-Count: 12   + Link header
GET /creatorProfiles?_limit=2           → X-Total-Count: 12
GET /categories                         → (no X-Total-Count)
```

The adapter always sends `_page` and `_limit`, and falls back to
`items.length` if the header is missing, so `total` is never `undefined`.

**2. The header is readable only because JSON Server exposes it.** It sets
`Access-Control-Expose-Headers: X-Total-Count, Link`. Without that, browser
JavaScript could not read a cross-origin response header at all and every list
would report `total: 0`. **Laravel must not forget the equivalent** if it ever
returns counts in headers — though it should return `meta.total` in the body
instead (§4.5).

**3. Array-membership filters need `_like`.** JSON Server compares scalars, so
filtering an array field by equality silently returns nothing:

```
GET /creatorProfiles?categories=cat_food_beverage        → 0 results
GET /creatorProfiles?categories_like=cat_food_beverage   → 1 result  ✓
```

So the contract's `category=cat_food_beverage` maps to `categories_like=…` for
`creatorProfiles.categories`, `portfolioItems.tags`, and
`proposals.sampleItemIds`. `_like` is a **regex substring match**, so it can
over-match on values that are prefixes of one another — safe for our
`cat_…`/`pfi_…` ids, which are unique and non-overlapping, but not a general
solution. `_like` is an adapter-internal detail and never appears in a service
call site.

Also available in JSON Server but **not** part of this contract: `_start`/
`_end` (use `page`/`limit`), `_ne`, and `_embed`/`_expand` (explicitly banned by
00 §10 — they have no Laravel equivalent and would hide N+1 problems until
migration day).

### 4.4 Example — the discovery grid, end to end

Contract call:

```
GET /creatorProfiles?availability=true&category=cat_food_beverage
    &priceMin=300&priceMax=500&ratingMin=4.5&sort=ratingAvg&order=desc&page=1&limit=2
```

What the adapter sends:

```
GET /creatorProfiles?availability=true&categories_like=cat_food_beverage
    &startingPrice_gte=300&startingPrice_lte=500&ratingAvg_gte=4.5
    &_sort=ratingAvg&_order=desc&_page=1&_limit=2
```

What JSON Server returns — a bare array plus `X-Total-Count: 10`:

```json
[
  { "id": "cpr_ava", "displayName": "Ava Martinez", "startingPrice": 320, "ratingAvg": 5, … }
]
```

What the app sees:

```json
{ "items": [ { "id": "cpr_ava", … } ], "total": 10, "page": 1, "limit": 2 }
```

### 4.5 Laravel mapping

| Contract | Laravel |
|---|---|
| `page` | `page` — identical |
| `limit` | `per_page` |
| `sort` / `order` | `sort` / `order` (validate against an allow-list per resource) |
| `search` | `search` — a scoped `LIKE`/full-text query, **not** every column |
| `field_gte` / `field_lte` | `field_gte` / `field_lte` — parse the suffix into `where(…, '>=', …)` |
| Response | `{ items, total, page, limit }` |

Laravel's `paginate()` emits `{ data, meta: { total, current_page, per_page } }`.
Reshape it in an API Resource collection so the wire format is the envelope in
§4.2 — the client should never learn a second shape.

**The migration is: change the base URL, and swap `listAdapter.js`.** Both the
param mapping and the response normalisation live in that one file. Nothing
else in the codebase reads `_page`, `X-Total-Count`, or `meta.total`.

### 4.6 Sorting and search caveats in the mock era

- `q` searches **every field** of a record, including ones a member should not
  be searching (a buyer's `bio` matches when they searched for a title). It is
  good enough for a prototype and wrong for production. Laravel must scope
  `search` to the fields listed per resource in §6.
- `_sort` is a plain JS comparison, so it is case-sensitive on strings and puts
  `null` first on ascending sorts. Where a sort must be stable, resources below
  document a secondary sort field.

---

## 5. Uploads

### 5.1 Target contract

#### `POST /uploads`

Authenticated. `Content-Type: multipart/form-data`.

| Part | Type | Notes |
|---|---|---|
| `file` | binary | Required |
| `purpose` | string | `portfolio` \| `delivery` \| `dispute_evidence` \| `profile_image` \| `request_reference` — drives storage path and limits |

`201 Created`

```json
{
  "file": {
    "id": "dfl_a7Kq2Xm",
    "name": "texture-and-swatch-photography-v1-01.jpg",
    "url": "https://picsum.photos/seed/dfl-a7kq2xm/1600/900",
    "thumbnailUrl": "https://picsum.photos/seed/dfl-a7kq2xm/400/300",
    "mediaType": "image",
    "sizeKb": 2400
  }
}
```

This is the **same file object** that is stored inline on `deliveries.files` and
`disputes[].evidence` (`docs/data-model.md`), so the caller can put the response
straight into the record it is building. `id` carries the `dfl_` prefix for
delivery files and `evd_` for dispute evidence.

| Field | Notes |
|---|---|
| `name` | The original filename, sanitised for display (§9) |
| `url` | Full-size asset |
| `thumbnailUrl` | Optional — omitted when the type has no preview |
| `mediaType` | `image` \| `video` |
| `sizeKb` | Integer kilobytes |

Errors: `422` `validation_failed` with `details.file` (type or size);
`403` `forbidden` (blocked account); `413` is normalised to `422` by the client.

Uploading is a **separate step from the record it belongs to**. The caller
uploads each file, collects the returned file objects, and then submits them in
the delivery or dispute body. That keeps the JSON endpoints JSON-only and lets
an upload be retried without resubmitting the parent record.

### 5.2 Mock reality

`uploadService.upload(file, { purpose })` simulates the endpoint entirely
client-side:

- Simulates network latency so real loading and progress states get exercised.
- Reads **real metadata from the real `File` object** — `name`, `size` → `sizeKb`,
  `type` → `mediaType`. Only the bytes are fictional.
- Returns a stable placeholder `url`/`thumbnailUrl` from
  `src/constants/images.js` (`https://picsum.photos/seed/<id>/…`), seeded on the
  generated file id, so the same upload always renders the same image.
- Enforces the same type and size rules the server will, and rejects with the
  same `ApiError { code: 'validation_failed', details: { file } }`. Limits are
  per `purpose` (`UPLOAD_RULES` in `src/services/uploadService.js`).
- **Returns the identical `{ file: … }` shape.**

A `video` upload has no real asset to point at, so its `url` is one shared
placeholder built through `constants/images.js`; `thumbnailUrl` is still seeded
per file, so a delivery of three clips shows three distinct posters.

**Batch helper.** Uploading is per-file at the endpoint, but every caller
attaches a *set* of files, so `uploadService.uploadFiles(files, { kind })`
wraps `upload` and resolves to the `file[]` array itself — ready to drop into
`deliveries.files` or `disputes[].evidence`. It validates the whole selection
before waiting on any of it and rejects the batch if any file fails, so a
half-attached delivery is never possible. `kind` is an alias of `purpose`. On
migration it becomes N parallel `POST /uploads` calls, or one multi-part
endpoint — either way its signature holds.

No bytes leave the browser and nothing is persisted; a page reload loses the
"file" while the record still references its URL. That is an accepted prototype
limitation.

> **Laravel** — store on S3 or a local disk, generate a thumbnail for images and
> a poster frame for video, and return the same shape. Then replace
> `uploadService.upload`'s body with a real multipart `POST /uploads` — nothing
> that calls it changes. Validate the MIME type server-side by sniffing content,
> never by trusting the client's `type`, and store outside the web root with
> signed URLs.

---

## 6. Resource reference

**How to read these.** Each resource lists its endpoints, its filters, an
example request and response drawn from real seeded data, and its error cases.

Access column vocabulary:

| Term | Means |
|---|---|
| **Public** | No token required |
| **Auth** | Any signed-in, `active` account |
| **Owner** | The buyer or creator the record belongs to |
| **Party** | Either party to the order the record belongs to |
| **Admin** | `admin` holding the named permission, or `super_admin` |

Every access rule below is a **server** requirement. The frontend guards mirror
them for UX only (§9).

---

### 6.1 `auth`

Full contract in §2. Endpoint summary:

| Method | Path | Access | Purpose |
|---|---|---|---|
| `POST` | `/auth/login` | Public | `{ token, user }` |
| `POST` | `/auth/register` | Public | Create a `buyer`/`creator` + profile, `{ token, user }` |
| `GET` | `/auth/me` | Auth | Revalidate, `{ user }` |
| `POST` | `/auth/logout` | Auth | Revoke the token, `204` |

**Request** — `POST /auth/login`

```json
{ "email": "creator@betterblue.test", "password": "Password123!" }
```

**Response** `200 OK` (trimmed — the full `user` shape is in §2.1)

```json
{
  "token": "1|K3xq9fT2nR7wLm4pVbY8sZcD6hJ0aQeU",
  "user": {
    "id": "usr_creator_ava",
    "email": "creator@betterblue.test",
    "role": "creator",
    "accountStatus": "active",
    "name": "Ava Martinez",
    "createdAt": "2026-04-23T10:15:00.000Z",
    "lastLoginAt": "2026-08-14T08:30:00.000Z"
  }
}
```

Errors: `401` `unauthorized` (bad credentials) · `403` `forbidden` +
`details.accountStatus` (suspended/blacklisted/deactivated) · `409` `conflict`
(email taken) · `422` `validation_failed` · `429` `rate_limited`.

---

### 6.2 `users`

Accounts of all four roles. Accounts are never deleted — suspension and
blacklisting are statuses (00 §9).

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/users` | Admin `users.manage` | The user directory |
| `GET` | `/users/:id` | Self · Admin `users.manage` | One account |
| `PATCH` | `/users/:id` | **Self** (profile fields) | Self-update |
| `PATCH` | `/users/:id` | Admin `users.manage` | Status actions |
| `POST` | `/users` | Admin `admins.manage` | Create an admin account |

Members reach other members through `creatorProfiles` / `buyerProfiles`, never
through `/users` — which is why the directory is admin-only.

**Filters**

| Param | Notes |
|---|---|
| `role` | `buyer` \| `creator` \| `admin` \| `super_admin`; repeatable |
| `accountStatus` | Repeatable |
| `email` | Exact match — the sign-in identifier lookup |
| `referredByCode` | Affiliate attribution |
| `createdAt_gte` / `createdAt_lte` | Signup window |
| `search` | `name`, `email` |
| `sort` | `createdAt` (default, `desc`), `lastLoginAt`, `name` |

**Self-update** — `PATCH /users/:id`

```json
{ "name": "Ava Martinez", "phone": "+1 512 555 0110",
  "notificationPrefs": { "marketplace": { "inApp": false } } }
```

Only `name`, `phone`, `avatarUrl`, and `notificationPrefs` are self-editable.
A member changing their own `role`, `accountStatus`, or `permissions` is
`403` `forbidden` — see §9.

`notificationPrefs` is a whole-object replacement: send all seven categories
(`marketplace`, `orders`, `payments`, `disputes`, `moderation`, `affiliate`,
`system`), not a partial patch. See §1.7 on nested-object merge behaviour.

**Admin status actions** — `PATCH /users/:id`

```json
{ "accountStatus": "suspended",
  "statusReason": "Licensing review following an upheld report.",
  "statusChangedAt": "2026-08-16T02:25:30.506Z",
  "statusChangedById": "usr_admin_maya" }
```

Legal targets: `active`, `suspended`, `blacklisted`, `deactivated`. Every status
change also writes an audit entry (`user.suspend`, `user.blacklist`,
`user.reactivate`) and notifies the member (`account_status_changed`) — see §7.

`statusReason`, `statusChangedAt`, and `statusChangedById` are written with the
status and read back by the admin account screen's banner. They are **absent**
on an account that has never left `active`, not present and empty. The reason is
mandatory (min 10 characters) for `suspended` and `blacklisted`, optional for
`active`, and is quoted to the member verbatim in their notification.

**Target rules (admin console, Prompt 29).** `users.manage` may set a status on
**buyer and creator accounts only**, and never on the caller's own account.
Admin and super-admin accounts are managed through `admins.manage` (§6.2 team
operations, Prompt 36) — a `users.manage` holder attempting one is `403`.
`deactivated` is not an admin-settable target at all: it means "the member
closed their own account" and is written only by self-service (§9, and the
`user.deactivate` audit verb with `meta.selfService = true`).

> **Laravel authorization** — the frontend hides the controls for an invalid
> target and the client service re-checks before it calls, but **neither is
> access control**. The API must independently verify (a) the caller holds
> `users.manage`, (b) `:id` is not the caller, (c) `:id` is a buyer or creator,
> and (d) the requested status is one of the three admin-settable values, and
> must reject anything else with `403` regardless of what the client sent.
> A Policy (`UserPolicy@changeStatus`) plus a Form Request enum rule is the
> shape; do not rely on the payload's shape as a proxy for the caller's rights.

**Response** `200 OK` (`GET /users/usr_creator_ava`, `password` stripped)

```json
{
  "id": "usr_creator_ava",
  "email": "creator@betterblue.test",
  "role": "creator",
  "accountStatus": "active",
  "name": "Ava Martinez",
  "avatarUrl": "data:image/svg+xml;charset=utf-8,%3Csvg…",
  "phone": "+1 512 555 0110",
  "createdAt": "2026-04-23T10:15:00.000Z",
  "lastLoginAt": "2026-08-14T08:30:00.000Z",
  "notificationPrefs": { "marketplace": { "inApp": true }, "orders": { "inApp": true }, "payments": { "inApp": true }, "disputes": { "inApp": true }, "moderation": { "inApp": true }, "affiliate": { "inApp": true }, "system": { "inApp": true } }
}
```

An admin record additionally carries `permissions` (keys from
`src/constants/permissions.js`); non-admins omit the field entirely.

> **Laravel** — `POST /users/:id/suspend`, `/blacklist`, `/reactivate` are
> better than a raw `PATCH` of `accountStatus`: they can require a reason, write
> the audit entry, revoke tokens, and notify in one transaction. Keep `PATCH
> /users/:id` for self-update only, with a Form Request that allows exactly the
> four self-editable fields.

> **Mock reality** — JSON Server returns `password` on every `/users` response
> (verified). `authService` strips it; no other module may call `/users`
> directly for account data. See §9.

Errors: `403` `forbidden` (editing another account, or escalating your own
role) · `404` `not_found` · `409` `conflict` (email taken) · `422`.

---

### 6.3 `buyerProfiles`

The business behind a buyer account. One per buyer.

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/buyerProfiles` | Auth | Lookup by `userId` |
| `GET` | `/buyerProfiles/:id` | Auth | One business profile |
| `POST` | `/buyerProfiles` | Auth (registration) | Created with the account |
| `PATCH` | `/buyerProfiles/:id` | Owner · Admin `users.manage` | Edit business details |

**Filters** — `userId` (exact) · `industry` · `search` (`companyName`,
`industry`, `bio`) · `sort`: `createdAt` (default), `totalSpent`.

**Response** `200 OK`

```json
{
  "id": "bpr_verde",
  "userId": "usr_buyer_verde",
  "companyName": "Verde Kitchen",
  "industry": "Food & Beverage",
  "website": "https://verdekitchen.test",
  "bio": "A plant-forward restaurant group with six locations across the Pacific Northwest…",
  "location": "Portland, OR, United States",
  "logoUrl": "data:image/svg+xml;charset=utf-8,%3Csvg…",
  "totalSpent": 2640,
  "createdAt": "2026-04-22T10:40:00.000Z"
}
```

`totalSpent` is **derived, read-only** — payments held/released/partially
refunded, net of refunds. A client `PATCH` of it must be rejected; Laravel
recomputes it from `payments`.

Errors: `403` (not the owner) · `404` · `422`.

---

### 6.4 `creatorProfiles`

The creator's public storefront, and the resource behind the discovery grid.

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/creatorProfiles` | **Public** | Discovery listing |
| `GET` | `/creatorProfiles/:id` | **Public** | Public profile page |
| `POST` | `/creatorProfiles` | Auth (registration) | Created with the account |
| `PATCH` | `/creatorProfiles/:id` | Owner | Edit the storefront |
| `PATCH` | `/creatorProfiles/:id` | Admin `users.manage` | `verified`, `featured` |

**Discovery filters**

| Param | Maps to | Notes |
|---|---|---|
| `availability` | `availability=true` | Accepting work |
| `category` | `categories` (array membership) | Repeatable for OR |
| `contentType` | `contentTypes` (array membership) | `photo` \| `video` \| `bundle` |
| `priceMin` / `priceMax` | `startingPrice_gte` / `_lte` | |
| `ratingMin` | `ratingAvg_gte` | e.g. `4.5` |
| `verified` / `featured` | booleans | |
| `search` | `displayName`, `tagline`, `bio`, `location` | |
| `sort` | `recommended` (default), `ratingAvg`, `startingPrice`, `completedOrders`, `responseTimeHours`, `createdAt` | |

**`sort=recommended`** *(added by Prompt 12)* — the discovery grid's default
ordering: `featured` storefronts first, then a rating composite that weights
`ratingAvg` by `ratingCount` against a marketplace prior, so a lone five-star
review does not outrank a 4.7 earned over thirty orders. Clients send the token,
never the columns behind it.

> **Mock reality** — the contract's list parameters carry a single `order`
> (§4.1), so a two-column ordering in independent directions is unreachable
> through the adapter. The page is fetched ordered by `featured` — which decides
> *which* records land on the page — and the composite is applied to the page in
> `creatorProfileService`. Within a featured group the composite therefore orders
> each page internally rather than across page boundaries.

> **Laravel** — `ORDER BY featured DESC, recommendation_score DESC`, ideally
> against a stored `recommendation_score` column refreshed on review write. The
> client-side pass is deleted.

**`include=preview`** *(reserved by Prompt 12)* — the discovery card shows three
published portfolio thumbnails per creator.

> **Mock reality** — JSON Server has no `include`, so
> `creatorProfileService.listPortfolioPreviews(ids)` issues one
> `GET /portfolioItems?creatorId=…&status=published&_limit=3` per creator, at
> most four in flight. It is a separate call from the search rather than part of
> it, so the grid paints before the thumbnails resolve.

> **Laravel** — `GET /creators?include=preview` returns each item with a
> `portfolioPreview` array, resolved by an eager-loaded
> `hasMany … where status = 'published' limit 3`. One request, one round trip.

**Discovery request**

```
GET /creatorProfiles?availability=true&category=cat_food_beverage
    &priceMin=300&priceMax=500&ratingMin=4.5
    &sort=ratingAvg&order=desc&page=1&limit=12
```

`200 OK`

```json
{
  "items": [
    {
      "id": "cpr_ava",
      "userId": "usr_creator_ava",
      "displayName": "Ava Martinez",
      "tagline": "Food and product content that makes people hungry to buy",
      "bio": "I shoot menu, packaging, and lifestyle content for restaurants and food brands…",
      "categories": ["cat_food_beverage", "cat_ecommerce_products"],
      "contentTypes": ["photo", "video", "bundle"],
      "startingPrice": 320,
      "currency": "USD",
      "location": "Austin, TX, United States",
      "languages": ["English", "Spanish"],
      "responseTimeHours": 4,
      "availability": true,
      "featured": true,
      "verified": true,
      "ratingAvg": 5,
      "ratingCount": 2,
      "completedOrders": 3,
      "createdAt": "2026-04-23T11:05:00.000Z"
    }
  ],
  "total": 10,
  "page": 1,
  "limit": 12
}
```

`ratingAvg`, `ratingCount`, and `completedOrders` are **derived, read-only**.

**Two fields need care.**

**`payoutMethod`** — `{ type: 'bank', accountName, accountMasked }` — is
**private to the owner and to finance admins**. It appears on the record in
`db.json` and JSON Server has no way to withhold it, so today it is simply not
rendered on public surfaces. That is not access control.

> **Laravel** — the public profile resource must not serialise `payoutMethod`
> at all. Move payout details to a separate `payout_methods` table under the
> account, encrypted at rest, exposed only through the owner's settings
> endpoint. Never return a full account number — only `accountMasked`.

**Account status is not on the profile.** A suspended creator's storefront must
disappear from discovery, but `accountStatus` lives on `users` and JSON Server
cannot join.

> **Mock reality** — the discovery service fetches the page, then issues one
> batched `GET /users?id=usr_a&id=usr_b&…` (repeated-param OR, verified) and
> drops profiles whose owner is not `active`. It costs a second round trip and
> makes `total` approximate on pages where a profile is dropped.

> **Laravel** — one query:
> `join users … where users.account_status = 'active'`. The extra call and the
> approximate `total` both disappear. This is the clearest example of a mock
> workaround the real backend deletes outright.

**`profileStatus` on the single profile** *(added by Prompt 13)* — the same
problem, one record at a time. `GET /creatorProfiles/:id` serves the public
profile page, which has to distinguish three states: live, *paused* (the creator
set `availability: false` and gets a banner plus a disabled CTA), and *not
public at all* (the account is `suspended`, `blacklisted`, or `deactivated`, and
the visitor gets a respectful unavailable screen). Only the last one needs the
account, so the response carries `profileStatus` — an `ACCOUNT_STATUS` value
describing the owner.

```
GET /creatorProfiles/cpr_ava   →   { …, "availability": true, "profileStatus": "active" }
```

> **Mock reality** — `creatorProfileService.getPublicProfile(id)` issues a
> second `GET /users/:id` and copies `accountStatus` onto the record. It fails
> **open** (`active`) when that lookup fails, exactly as the grid's filter does:
> an unreachable users endpoint is not evidence of a suspension, and hiding a
> working storefront over it is the worse error. This is presentation, not
> enforcement — see §9.1.

> **Laravel** — serialise `profile_status` from the joined account on the public
> profile resource (or 404 the suspended ones, if product prefers that), and the
> second request disappears.

Errors: `403` (editing another creator's profile, or a non-admin setting
`verified`/`featured`) · `404` · `422`.

---

### 6.5 `portfolioItems`

Creator sample work. Published items are public; everything else is the owner's
and the moderation queue's.

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/portfolioItems` | **Public** (published only) · Owner · Admin | Portfolio grid |
| `GET` | `/portfolioItems/:id` | Public if published, else Owner/Admin | Item detail |
| `POST` | `/portfolioItems` | Owner (creator) | Add work |
| `PATCH` | `/portfolioItems/:id` | Owner | Edit, archive, change visibility |
| `POST` | `/portfolioItems/:id/submit` | Owner | **Composite** — submit for review (§7) |
| `PATCH` | `/portfolioItems/:id` | Admin `content.manage` | Restrict / unrestrict |

**Filters** — `creatorId` (→ `creatorProfiles.id`, **not** `users.id` — see
`docs/data-model.md` §3) · `categoryId` · `contentType` · `status` (repeatable) ·
`visibility` · `tag` (array membership on `tags`) · `search` (`title`,
`description`, `tags`) · `sort`: `publishedAt` (default `desc`), `createdAt`,
`title`.

**Create** — `POST /portfolioItems`

```json
{
  "id": "pfi_9Kq2Xma",
  "creatorId": "cpr_ava",
  "title": "Seasonal menu photography for a farm-to-table dinner service",
  "description": "Eighteen plated dishes shot across one service…",
  "categoryId": "cat_food_beverage",
  "contentType": "photo",
  "tags": ["restaurant", "menu", "food styling", "seasonal"],
  "mediaUrl": "https://picsum.photos/seed/pfi-9kq2xma/1200/675",
  "thumbnailUrl": "https://picsum.photos/seed/pfi-9kq2xma/400/300",
  "mediaType": "image",
  "status": "draft",
  "visibility": "public",
  "submittedAt": null,
  "publishedAt": null,
  "createdAt": "2026-08-14T09:00:00.000Z"
}
```

`mediaUrl` / `thumbnailUrl` come from `POST /uploads` (§5).

**Response** `201 Created` — the created record. A published item:

```json
{
  "id": "pfi_001",
  "creatorId": "cpr_ava",
  "title": "Seasonal menu photography for a farm-to-table dinner service",
  "categoryId": "cat_food_beverage",
  "contentType": "photo",
  "tags": ["restaurant", "menu", "food styling", "seasonal"],
  "mediaUrl": "https://picsum.photos/seed/pfi-001/1200/675",
  "thumbnailUrl": "https://picsum.photos/seed/pfi-001/400/300",
  "mediaType": "image",
  "status": "published",
  "visibility": "public",
  "submittedAt": "2026-05-13T12:20:00.000Z",
  "publishedAt": "2026-05-14T12:20:00.000Z",
  "createdAt": "2026-05-12T12:20:00.000Z"
}
```

A rejected item additionally carries `rejectionReason` (a string shown to the
creator); items that were never rejected omit the field. Items created or edited
through the portfolio manager also carry an optional `brandCredit` ("Created
for: …") and an `updatedAt` stamp.

**Submitting for review** moves `status` to `submitted` **and** opens or
re-opens the item's `moderationReviews` record (§6.20) — one intention, two
writes, so it is composite operation 19 in §7 rather than a bare `PATCH`.
`status` follows `CONTENT_STATUS_MACHINE` (§8) — an illegal jump is `409`
`conflict` with `details: { from, to }`.

**Owner transitions** (Prompt 22, all guarded by the same machine):
`draft|rejected|revision_required → submitted`, `published → submitted`
(the **edit-republish policy** — editing live work unpublishes it until it is
approved again), and `draft|rejected|published|restricted → archived`, which is
terminal. `visibility` is a separate `PATCH` and is only accepted on a
`published` item; it is not a moderation state.

> **The public grid is `status: published` AND `visibility: public`.** Both
> halves are required — an `unlisted` item is approved and published but must
> not appear on the public profile, in discovery previews, or in search.

Errors: `403` (not the owner; or a creator setting `status` to a
moderator-only value such as `approved`/`published`/`restricted`) · `404` · `409`
(illegal transition) · `422`.

> **Laravel** — `status` transitions driven by moderation
> (`approved`, `rejected`, `revision_required`, `published`, `restricted`) must
> be settable **only** through the moderation endpoints (§6.20), never by the
> owner. The owner may move `draft → submitted` and `published → archived`.

---

### 6.6 `categories`

Marketplace taxonomy. Small, cacheable, and mostly read.

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/categories` | **Public** | All categories |
| `GET` | `/categories/:id` | **Public** | One category |
| `POST` | `/categories` | Admin `categories.manage` | Add |
| `PATCH` | `/categories/:id` | Admin `categories.manage` | Rename, reorder, deactivate |

**Filters** — `active` · `slug` (exact) · `sort`: `sortOrder` (default `asc`).

`GET /categories?active=true&sort=sortOrder&order=asc`

`200 OK`

```json
{
  "items": [
    { "id": "cat_food_beverage", "name": "Food & Beverage", "slug": "food-beverage", "icon": "tabler:tools-kitchen-2", "active": true, "sortOrder": 1 },
    { "id": "cat_fashion_apparel", "name": "Fashion & Apparel", "slug": "fashion-apparel", "icon": "tabler:shirt", "active": true, "sortOrder": 2 }
  ],
  "total": 12,
  "page": 1,
  "limit": 12
}
```

The full set of 12 ids is generated from
`src/constants/categoriesFallback.js`, which is also what
`categoryService.listActive()` falls back to when the request fails — so the
API, the offline fallback, and `CATEGORY_ID` can never drift.

Categories are **deactivated, never deleted** (`active: false`): existing
requests, orders, and portfolio items keep pointing at them.

Errors: `403` · `404` · `409` `conflict` (duplicate `slug`) · `422`.

---

### 6.7 `contentRequests`

Buyer briefs — the demand side of the marketplace.

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/contentRequests` | **Public** (`open` only) · Owner · Creator · Admin | The request board |
| `GET` | `/contentRequests/:id` | Public if `open`, else Owner/Admin | Brief detail |
| `POST` | `/contentRequests` | Buyer | Create a brief (starts as `draft`) |
| `PATCH` | `/contentRequests/:id` | Owner (buyer) | Edit, publish, cancel |
| `PATCH` | `/contentRequests/:id` | Admin `requests.manage` | Close a non-compliant brief |

**Filters**

| Param | Notes |
|---|---|
| `buyerId` | "My requests" |
| `status` | Repeatable. The public board is `status=open`. |
| `categoryId` | Repeatable |
| `contentType` | `photo` \| `video` \| `bundle` |
| `usageRights` | `USAGE_RIGHTS` |
| `budgetMin_gte` / `budgetMax_lte` | Budget window |
| `deadline_gte` / `deadline_lte` | Deadline window |
| `search` | `title`, `description` |
| `sort` | `publishedAt` (default `desc`), `createdAt`, `deadline`, `budgetMax`, `proposalsCount` |

**Create** — `POST /contentRequests`

```json
{
  "id": "req_3Xm9Kqa",
  "buyerId": "usr_buyer_verde",
  "title": "20 seasonal menu photos for our autumn dinner service",
  "description": "We are refreshing the autumn menu across all six locations…",
  "categoryId": "cat_food_beverage",
  "contentType": "photo",
  "quantity": 20,
  "orientation": "any",
  "usageRights": "full_commercial",
  "brandGuidelines": "Warm, natural light with visible texture…",
  "dos": "Shoot each dish overhead and at 45 degrees…",
  "donts": "No stock props we do not own…",
  "referenceUrls": ["https://verdekitchen.test/press/autumn-menu-brief"],
  "budgetType": "range",
  "budgetMin": 600,
  "budgetMax": 900,
  "currency": "USD",
  "deadline": "2026-09-01T17:00:00.000Z",
  "invitedCreatorId": null,
  "status": "draft",
  "proposalsCount": 0,
  "awardedProposalId": null,
  "createdAt": "2026-08-05T13:30:00.000Z",
  "publishedAt": null
}
```

`videoDurationSec` is required for `video` and `bundle` briefs and omitted for
`photo`. `budgetType: "fixed"` requires `budgetMin === budgetMax`.

**`invitedCreatorId`** (added in Prompt 16) — nullable FK → `creatorProfiles.id`,
set when a buyer reaches the request form from a creator's public profile
(`/buyer/requests/new?creator=cpr_…`). It is a **hint, not an award**: the brief
is still published to the whole marketplace and every creator may propose on it.
Prompt 23 reads it in two places: it badges the brief **"Invited"** for that one
creator on the request board, and it backs the board's "Invited to you" filter
(`invitedCreatorId=cpr_…`). Omitted entirely when there is no hint. Reference
images are uploaded first (§5.1, `purpose: request_reference`) and their URLs
submitted in `referenceUrls`.

> **Composite read — the request board (Prompt 23).**
> `requestService.listBoard(params)` returns open briefs each joined to a
> **public** `buyer` summary: `{ userId, name, companyName, logoUrl, industry,
> location, bio, website, memberSince }`. Nothing private crosses that boundary —
> no email, no phone, no `totalSpent`.
> `requestService.getBoardRequest(id)` returns `{ request, buyer }` for one
> brief, with `buyer.completedOrders` added.
> **Mock reality:** two extra requests for a page (accounts by id, profiles by
> `userId`), plus one more for the detail page's completed-order count, because
> `_embed`/`_expand` are banned (00 §10). A failed join degrades to `buyer:
> null` rather than failing the board.
> **Laravel:** `GET /contentRequests?status=open&include=buyer`, with
> `completedOrders` served from a counter cache on the buyer profile.

`proposalsCount` is maintained by `proposalService.submitProposal` — see §7,
operation 20, for why that is a client-side write today and a counter cache
tomorrow.

**Response** `200 OK` (`GET /contentRequests/req_001`, published and live)

```json
{
  "id": "req_001",
  "buyerId": "usr_buyer_verde",
  "title": "20 seasonal menu photos for our autumn dinner service",
  "categoryId": "cat_food_beverage",
  "contentType": "photo",
  "quantity": 20,
  "orientation": "any",
  "usageRights": "full_commercial",
  "budgetType": "range",
  "budgetMin": 600,
  "budgetMax": 900,
  "currency": "USD",
  "deadline": "2026-09-01T17:00:00.000Z",
  "status": "open",
  "proposalsCount": 4,
  "awardedProposalId": null,
  "createdAt": "2026-08-05T13:30:00.000Z",
  "publishedAt": "2026-08-05T19:30:00.000Z"
}
```

`proposalsCount` and `awardedProposalId` are **derived, read-only**.

> **Mock reality** — nothing recalculates `proposalsCount`, so
> `proposalService.submitProposal` `PATCH`es it (read, +1, write). Two
> creators submitting at the same moment lose a count.

> **Laravel** — expose it as a `withCount('proposals')` attribute, or maintain
> it in the same transaction that inserts the proposal. Never let the client
> send it.

Status follows `REQUEST_STATUS_MACHINE` (§8). Publishing is
`PATCH { status: "open", publishedAt }`; awarding happens inside
`acceptProposal` (§7), not by a direct `PATCH`.

**Ending a brief (Prompt 18).** Three owner actions live behind
`requestService` and are each a `PATCH` in the mock:

| Function | Mock | Future endpoint |
|---|---|---|
| `publishDraft(id)` | `PATCH { status: "open", publishedAt }` | `POST /contentRequests/:id/publish` |
| `closeRequest(id, { reason })` | `PATCH { status: "closed", closedAt, closureReason }` + decline every live offer | `POST /contentRequests/:id/close` |
| `cancelRequest(id, { reason })` | `PATCH { status: "cancelled", cancelledAt, closureReason }` + decline every live offer | `POST /contentRequests/:id/cancel` |

`closedAt`, `cancelledAt`, and `closureReason` are **written only by these two
operations** and are absent on every other brief (`docs/data-model.md` §5).
`publishDraft` refuses an incomplete draft with `422` and
`details.missing: string[]` — the field labels still blank — so the client can
name them rather than say "invalid". `cancelRequest` refuses an `awarded`
brief with `409`: unpicking an award is `orderService.cancelOrder` (§7).

Both close and cancel fold over the brief's `submitted`/`shortlisted` offers,
declining each and notifying its creator. **Mock reality:** that is one `PATCH`
plus one notification per offer, sequentially and without a transaction; a
Laravel implementation does the whole fold in the same transaction as the
status change.

Errors: `403` (not the owner) · `404` (a `draft` requested by anyone but its
owner) · `409` (illegal transition; editing an `awarded` brief) · `422`.

---

### 6.8 `proposals`

Creator offers on a brief. **A creator may propose once per request.**

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/proposals` | Request owner · Proposing creator · Admin | Proposals on a brief / my proposals |
| `GET` | `/proposals/:id` | Owner · Request owner · Admin | One offer |
| `POST` | `/proposals` | Creator | Submit an offer — **composite**, §7 op 20 |
| `PATCH` | `/proposals/:id` | Owner (creator) | Edit (while `submitted`) |
| `POST` | `/proposals/:id/withdraw` | Owner (creator) | Withdraw |
| `PATCH` | `/proposals/:id` | Request owner (buyer) | Shortlist, decline |
| `POST` | `/proposals/:id/accept` | Request owner (buyer) | **Composite** — §7 |

Proposals are **never public**: only the buyer who posted the brief and the
creator who sent the offer may read one.

**Shortlisting is a toggle (Prompt 18).** The buyer's proposal board stars and
un-stars an offer, so `PROPOSAL_STATUS_MACHINE` carries both
`submitted → shortlisted` and `shortlisted → submitted`; un-starring also
clears `respondedAt`, because an un-starred offer is undecided again. Only
starring notifies the creator. Declining is one-way and terminal.

> **Composite read** — `proposalService.listForRequestReview(requestId)` returns
> the brief's offers each joined to its `creator` (account + storefront: rating,
> completed orders, response time) and its `samples` (the `portfolioItems`
> behind `sampleItemIds`). **Mock reality:** three requests — the offers, then
> the accounts/storefronts and the sample items by id, in parallel — because
> `_embed`/`_expand` are banned and the board sorts by creator rating, a column
> that is not on the offer. **Laravel:** one request,
> `GET /proposals?requestId=…&include=creator,samples`, sorted server-side.

> **Composite read — "My proposals" (Prompt 23).**
> `proposalService.listForCreator(creatorId, params)` returns a creator's own
> offers, each joined to the `request` it answers and a public `buyer` summary
> (`{ userId, name, companyName, logoUrl }`) — a proposal card is unreadable
> without the brief's title. **Mock reality:** three extra requests (briefs by
> id, then accounts and business profiles for whoever posted them, in
> parallel); a failed join degrades to `request: null` rather than failing the
> list. **Laravel:** `GET /proposals?creatorId=…&include=request.buyer`.
>
> Two aggregates ride alongside it: `countsByStatus(creatorId)` (the tab counts
> — one folded page today, `GROUP BY status` tomorrow) and
> `countShortlisted(creatorId)` (the nav badge, one `COUNT(*)` either way).

**Field rules** — the numbers the proposal dialog, the service, and the future
Laravel validator all quote (exported from `proposalService`):

| Field | Rule |
|---|---|
| `coverMessage` | 60–1200 characters |
| `price` | > 0. **Above the brief's budget is allowed** — warned about, never blocked; the buyer decides |
| `deliveryDays` | one of `3, 5, 7, 10, 14, 21` |
| `revisionsIncluded` | one of `1, 2, 3` |
| `sampleItemIds` | 0–3 **published** `pfi_…` items owned by the proposing creator |

**Filters** — `requestId` · `creatorId` (→ `users.id`) · `status` (repeatable) ·
`price_gte` / `price_lte` · `sort`: `createdAt` (default `desc`), `price`,
`deliveryDays`.

**Create** — `POST /proposals`

```json
{
  "id": "prp_7Kq9Xma",
  "requestId": "req_001",
  "creatorId": "usr_creator_yuki",
  "coverMessage": "My work is mostly interiors and tableware, which means I light for texture…",
  "price": 700,
  "currency": "USD",
  "deliveryDays": 12,
  "revisionsIncluded": 1,
  "sampleItemIds": ["pfi_033", "pfi_034"],
  "status": "submitted",
  "createdAt": "2026-08-07T19:30:00.000Z",
  "respondedAt": null
}
```

`sampleItemIds` must reference **published** portfolio items belonging to the
proposing creator.

**Response** `201 Created` — the created record. An accepted offer:

```json
{
  "id": "prp_019",
  "requestId": "req_009",
  "creatorId": "usr_creator_ava",
  "coverMessage": "Gifting sets live or die on texture, so I would shoot close and warm…",
  "price": 940,
  "currency": "USD",
  "deliveryDays": 10,
  "revisionsIncluded": 2,
  "sampleItemIds": ["pfi_005", "pfi_001"],
  "status": "accepted",
  "createdAt": "2026-07-24T19:30:00.000Z",
  "respondedAt": "2026-08-08T15:20:00.000Z"
}
```

**Buyer decisions** — `PATCH /proposals/:id`

```json
{ "status": "shortlisted", "respondedAt": "2026-08-08T15:20:00.000Z" }
```

`shortlisted` and `declined` are plain `PATCH`es. **`accepted` is not** — it
creates an order, declines the losing offers, and awards the brief, so it goes
through the composite operation in §7.

**Creator decisions (Prompt 23)** — `proposalService.editProposal(id, patch)`
is a plain `PATCH` and is refused unless the offer is still `submitted`: once
the buyer has shortlisted it they are comparing against numbers they were
shown, and once it is decided there is nothing left to edit. Editing does not
notify. `withdrawProposal(id)` moves `submitted|shortlisted → withdrawn`,
stamps `respondedAt`, and notifies the buyer; `proposalsCount` is **not**
decremented, because the brief did receive that many offers.

Errors: `403` (not a party) · `404` · `409` `conflict` (a second proposal from
the same creator on the same request; acting on a closed brief; an illegal
transition) · `422` (`price` outside the brief's budget range).

> **Laravel** — `UNIQUE (request_id, creator_id)` turns the duplicate-proposal
> race into a database guarantee. Validate `price` against the brief's
> `budgetMin`/`budgetMax` server-side.

---

### 6.9 `orders`

The funded engagement, and the spine of the whole workflow.
**One order = one request + one accepted proposal** (00 §8) — there is
deliberately no `orderItems`.

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/orders` | Party · Admin `orders.manage` | My orders |
| `GET` | `/orders/:id` | Party · Admin | Order detail |
| `POST` | `/orders` | — | **Never called directly.** Orders are created by `acceptProposal` (§7) |
| `POST` | `/orders/:id/pay` | Buyer | **Composite** — fund the order (§7) |
| `POST` | `/orders/:id/release` | Buyer / system | **Composite** — release escrow (§7) |
| `POST` | `/orders/:id/cancel` | Party · Admin `orders.manage` | Cancel before delivery |

**Clients never `PATCH` `orders.status` directly.** Every transition is a side
effect of a composite operation, because each one also moves money, writes
transactions, and notifies. The status machine is enforced in one place.

**Filters**

| Param | Notes |
|---|---|
| `buyerId` / `creatorId` | → `users.id` |
| `status` | Repeatable — e.g. active work is `status=in_progress&status=delivered&status=revision_requested` |
| `categoryId`, `contentType` | |
| `price_gte` / `price_lte` | |
| `createdAt_gte` / `createdAt_lte` | |
| `deliveryDueAt_lte` | Overdue view, combined with an open `status` |
| `search` | `title` |
| `sort` | `createdAt` (default `desc`), `deliveryDueAt`, `price`, `completedAt` |

**Response** `200 OK` — `GET /orders/ord_002` (verified against the live mock API)

```json
{
  "id": "ord_002",
  "requestId": "req_009",
  "proposalId": "prp_019",
  "buyerId": "usr_buyer_cocoa",
  "creatorId": "usr_creator_ava",
  "title": "15 lifestyle photos for a single-origin gift box launch",
  "categoryId": "cat_ecommerce_products",
  "contentType": "photo",
  "price": 940,
  "currency": "USD",
  "commissionRate": 0.2,
  "commissionAmount": 188,
  "creatorEarnings": 752,
  "revisionsIncluded": 2,
  "revisionsUsed": 0,
  "deliveryDueAt": "2026-08-18T20:20:00.000Z",
  "status": "in_progress",
  "activatedAt": "2026-08-08T20:20:00.000Z",
  "deliveredAt": null,
  "completedAt": null,
  "cancelledAt": null,
  "createdAt": "2026-08-08T15:20:00.000Z"
}
```

`title`, `categoryId`, and `contentType` are **copied from the request at award
time** so a later edit to the brief cannot rewrite history. `commissionRate` is
copied from `platformSettings.commission.defaultRate` at the same moment, so a
rate change never repricessettled work.

Orders created by `acceptProposal` also carry **`deliveryDays`** — the agreed
turnaround from the proposal — and start with `deliveryDueAt: null`. The clock
starts at funding, so `POST /orders/:id/pay` computes
`deliveryDueAt = heldAt + deliveryDays` (§7 operations 1–2). Seeded orders
predate the field and keep the due date they were generated with; both shapes
read the same way, because consumers only ever read `deliveryDueAt`.

`cancelledAt` is set for both `cancelled` **and** `refunded` orders.

**Cancel** — `POST /orders/:id/cancel`

```json
{ "reason": "The campaign was pulled from the schedule." }
```

Allowed from `pending_payment`, `in_progress`, `revision_requested`, and
`disputed`. A funded order being cancelled also refunds the payment (§7).

Errors: `403` (not a party) · `404` · `409` (illegal transition, e.g. paying an
order that is not `pending_payment`) · `422`.

---

### 6.10 `deliveries`

One record per delivered **version**. Asking for changes closes that version at
`revision_requested`; the creator's next submission is a **new record** — a
documented decision in `src/constants/stateMachines.js`, which is why
`DELIVERY_STATUS_MACHINE` has no `revision_requested → submitted` edge.

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/deliveries` | Party · Admin | Versions on an order |
| `GET` | `/deliveries/:id` | Party · Admin | One version |
| `POST` | `/orders/:id/deliveries` | Creator | **Composite** — submit work (§7) |
| `POST` | `/deliveries/:id/accept` | Buyer | **Composite** — accept and release (§7) |
| `POST` | `/deliveries/:id/revisions` | Buyer | **Composite** — request changes (§7) |

**Filters** — `orderId` · `status` · `sort`: `version` (default `desc`),
`submittedAt`.

**Response** `200 OK`

```json
{
  "id": "dlv_001",
  "orderId": "ord_004",
  "version": 1,
  "message": "All eight shades delivered: swatches on four skin tones, one macro frame per shade…",
  "files": [
    {
      "id": "dfl_001",
      "name": "texture-and-swatch-photography-v1-01.jpg",
      "url": "https://picsum.photos/seed/dfl-001/1600/900",
      "thumbnailUrl": "https://picsum.photos/seed/dfl-001/400/300",
      "mediaType": "image",
      "sizeKb": 2400
    }
  ],
  "status": "submitted",
  "revisionId": null,
  "submittedAt": "2026-08-10T14:45:00.000Z",
  "respondedAt": null
}
```

`version` is 1-based per order. `revisionId` points at the revision this version
answers, and is `null` on the first delivery.

`files[]` entries come from `POST /uploads` (§5) and are stored inline.

> **Laravel** — `UNIQUE (order_id, version)` and compute `version` server-side
> as `max(version) + 1` inside the transaction. A client-computed version is a
> race. `files` becomes a `delivery_files` table.

Errors: `403` (not the order's creator) · `404` · `409` (order not
`in_progress`/`revision_requested`) · `422` (no files).

---

### 6.11 `revisions`

A buyer's request for changes against a specific delivery.

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/revisions` | Party · Admin | Revisions on an order |
| `GET` | `/revisions/:id` | Party · Admin | One revision |
| `POST` | `/deliveries/:id/revisions` | Buyer | **Composite** — §7 |

**Filters** — `orderId` · `deliveryId` · `sort`: `createdAt` (default `desc`).

**Request** — `POST /deliveries/dlv_003/revisions`

```json
{ "notes": "These look great overall. Two changes before we publish: the plating reel runs 27 seconds, so it needs a trim to under 25, and the dish caption on the dining room reel reads \"Autumn Squash\" — it should be \"Roast Squash & Sage\" to match the printed menu." }
```

**Response** `201 Created`

```json
{
  "id": "rev_001",
  "orderId": "ord_006",
  "deliveryId": "dlv_003",
  "requestedById": "usr_buyer_verde",
  "notes": "These look great overall. Two changes before we publish…",
  "createdAt": "2026-08-03T10:30:00.000Z",
  "resolvedAt": null
}
```

`requestedById` is always the order's buyer — the server derives it from the
session and **ignores any client-supplied value** (§9). `resolvedAt` is set when
the creator submits the answering delivery.

Errors: `403` (not the order's buyer) · `404` · `409` `conflict` when
`revisionsUsed >= revisionsIncluded`, with
`details: { revisionsUsed, revisionsIncluded }` so the UI can explain the limit
rather than just refusing.

---

### 6.12 `payments`

Buyer payments into escrow. One per order, plus retries.

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/payments` | Buyer (own) · Admin `payments.manage` | Payment history |
| `GET` | `/payments/:id` | Buyer (own) · Admin | One payment |
| `POST` | `/orders/:id/pay` | Buyer | **Composite** — §7 |
| `POST` | `/payments/:id/refund` | Admin `payments.manage` | **Composite** — §7 |

Creators never read `payments` — their view of the money is `transactions`
(§6.13) and `orders.creatorEarnings`.

**Filters** — `orderId` · `buyerId` · `status` (repeatable) ·
`createdAt_gte` / `createdAt_lte` · `amount_gte` / `amount_lte` ·
`sort`: `createdAt` (default `desc`), `amount`.

**Response** `200 OK` — held in escrow

```json
{
  "id": "pay_003",
  "orderId": "ord_002",
  "buyerId": "usr_buyer_cocoa",
  "amount": 940,
  "currency": "USD",
  "provider": "dummy",
  "method": { "brand": "visa", "last4": "1156" },
  "status": "held",
  "heldAt": "2026-08-08T20:20:00.000Z",
  "releasedAt": null,
  "refundedAt": null,
  "createdAt": "2026-08-08T15:20:00.000Z"
}
```

A **failed** attempt carries `failureReason`:

```json
{
  "id": "pay_001",
  "orderId": "ord_001",
  "status": "failed",
  "heldAt": null,
  "releasedAt": null,
  "refundedAt": null,
  "failureReason": "The card was declined by the issuing bank. No funds were taken."
}
```

A **partially refunded** payment carries `refundedAmount`:

```json
{
  "id": "pay_012",
  "orderId": "ord_011",
  "amount": 820,
  "status": "partially_refunded",
  "heldAt": "2026-07-07T19:20:00.000Z",
  "releasedAt": "2026-07-27T16:10:00.000Z",
  "refundedAt": "2026-07-27T16:10:00.000Z",
  "refundedAmount": 205
}
```

Payment status is bound to order status: `held` while work is under way or
disputed, `released` on completion, `partially_refunded` after a partial-refund
resolution, `refunded` after a full refund.

`method` keeps a **brand and a masked tail only**. A full card number is never
sent to this API, never stored, and never logged — see §9.

Errors: `402` `payment_failed` with `details.reason` (declined) · `403` · `404` ·
`409` (order not `pending_payment`; refunding a payment that is not `held`) ·
`422`.

---

### 6.13 `transactions`

The ledger. **`amount` is signed from the perspective of `userId`**: money
leaving that account is negative, money arriving is positive. Append-only.

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/transactions` | Own · Admin `payments.manage` | Earnings statement, order ledger |
| `GET` | `/transactions/:id` | Own · Admin | One line |

There is **no `POST`, `PATCH`, or `DELETE`**. Transactions are written by the
composite operations in §7 as a side effect of money actually moving.

**Filters** — `userId` · `orderId` · `paymentId` · `payoutId` · `type`
(repeatable) · `createdAt_gte` / `createdAt_lte` · `sort`: `createdAt` (default
`desc`).

**Response** `200 OK`

```json
{
  "items": [
    {
      "id": "txn_004",
      "type": "release",
      "orderId": "ord_015",
      "paymentId": "pay_016",
      "userId": "usr_creator_ava",
      "amount": 640,
      "currency": "USD",
      "description": "Escrow released for “Menu photography for the summer small-plates menu”",
      "balanceAfter": 640,
      "createdAt": "2026-05-15T16:10:00.000Z"
    },
    {
      "id": "txn_001",
      "type": "charge",
      "orderId": "ord_015",
      "paymentId": "pay_016",
      "userId": "usr_buyer_verde",
      "amount": -640,
      "currency": "USD",
      "description": "Escrow charge for “Menu photography for the summer small-plates menu”",
      "balanceAfter": null,
      "createdAt": "2026-05-06T18:20:00.000Z"
    }
  ],
  "total": 94,
  "page": 1,
  "limit": 12
}
```

Rows written per order:

| Order status | Rows |
|---|---|
| `pending_payment`, `cancelled` | none — nothing was collected |
| `in_progress`, `delivered`, `revision_requested`, `disputed` | `charge` (buyer, −price) |
| `completed` | `charge`, `release` (creator, +settled base), `commission` (creator, −fee) |
| `completed` after a partial refund | the above plus `partial_refund` (buyer, +refund) |
| `refunded` | `charge`, `refund` (buyer, +price) |

`balanceAfter` is `null` on rows that do not move a BetterBlue balance — a
buyer's `charge` settles against their card. Only `release`, `commission`,
`payout`, and `affiliate_commission` move a platform balance.

> **Mock reality** — `balanceAfter` is derived, and JSON Server derives nothing.
> The client computes it by fetching that user's prior transactions
> (`GET /transactions?userId=…&_sort=createdAt&_order=desc&_limit=1`) and adding
> the new amount. Two concurrent writes would produce two rows with the same
> `balanceAfter`.

> **Laravel** — compute `balance_after` inside the same transaction, and treat
> `SUM(amount)` over the account as the balance of record. Grant no `UPDATE` or
> `DELETE` on this table.

---

### 6.14 `commissions`

BetterBlue's fee, written when escrow is released. **Exactly one per released
order.**

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/commissions` | Admin `payments.manage` | Revenue reporting |
| `GET` | `/commissions/:id` | Admin | One fee record |

Written by `releasePayment` (§7); no client-facing write endpoint.

**Filters** — `orderId` · `createdAt_gte` / `createdAt_lte` ·
`sort`: `createdAt` (default `desc`), `amount`.

**Response** `200 OK`

```json
{
  "id": "com_001",
  "orderId": "ord_010",
  "rate": 0.2,
  "baseAmount": 1020,
  "amount": 204,
  "currency": "USD",
  "createdAt": "2026-07-14T16:10:00.000Z"
}
```

`baseAmount` is **the amount actually settled** (`price − refunded`), which
differs from `orders.price` only when a dispute returned part of the payment:
the order keeps the agreed terms, and the commission follows the money that
changed hands. `amount = round(baseAmount × rate, 2)`.

> **Laravel** — `order_id UNIQUE`. That single constraint makes a double
> release structurally impossible, which matters more than any client guard.

---

### 6.15 `payouts`

Creator settlements to a bank account.

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/payouts` | Own (creator) · Admin `settlements.process` | Payout history / the settlement queue |
| `GET` | `/payouts/:id` | Own · Admin | One settlement |
| `POST` | `/payouts` | Creator | **Composite** — request a payout (§7) |
| `PATCH` | `/payouts/:id` | Admin `settlements.process` | Advance the status |

**Filters** — `creatorId` · `status` (repeatable) · `requestedAt_gte` /
`requestedAt_lte` · `sort`: `requestedAt` (default `desc`), `amount`.

**Request** — `POST /payouts`

```json
{ "amount": 900 }
```

The client sends **only the amount**. The server derives `creatorId` from the
session, snapshots the payout method, and validates the amount against the
available balance and `platformSettings.general.payoutMinAmount` (50).

**Response** `201 Created`

```json
{
  "id": "pyo_004",
  "creatorId": "usr_creator_isla",
  "amount": 900,
  "currency": "USD",
  "method": { "type": "bank", "accountName": "Isla Bergstrom", "accountMasked": "**** 2287" },
  "status": "requested",
  "requestedAt": "2026-08-12T09:40:00.000Z",
  "processedAt": null
}
```

**Admin transitions** — `PATCH /payouts/:id`, following `PAYOUT_STATUS_MACHINE`
(§8): `requested → processing | rejected`, `processing → paid`.

```json
{ "status": "paid", "processedAt": "2026-07-24T11:00:00.000Z" }
```

A `rejected` payout carries `rejectedReason`. **Only a `paid` payout writes a
`payout` transaction** — that is the moment money leaves the balance.

`method` is a **snapshot** kept on the row, so a later change to the creator's
bank details cannot rewrite a historical settlement.

Errors: `403` · `404` · `409` (illegal transition) · `422` `validation_failed`
with `details.amount` when the amount exceeds the available balance or falls
below the minimum.

---

### 6.16 `disputes`

Trust & Safety casework on an order.

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/disputes` | Party · Admin `disputes.resolve` | My disputes / the case queue |
| `GET` | `/disputes/:id` | Party · Admin | Case detail |
| `POST` | `/disputes` | Party | Open a case |
| `PATCH` | `/disputes/:id` | Admin `disputes.resolve` | Assign, move status, close |
| `POST` | `/disputes/:id/resolve` | Admin `disputes.resolve` | **Composite** — §7 operation 8 |
| `POST` | `/disputes/:id/request-info` | Admin `disputes.resolve` | **Composite** — §7 operation 40 |
| `POST` | `/disputes/:id/escalate` | Admin `disputes.resolve` | **Composite** — §7 operation 41 |
| `GET` | `/admin/disputes` | Admin `disputes.resolve` | The queue, joined — §7 operation 36 |
| `GET` | `/admin/disputes/summary` | Admin `disputes.resolve` | Per-tab counts — §7 operation 37 |
| `GET` | `/admin/disputes/:id` | Admin `disputes.resolve` | The workspace — §7 operation 38 |

**Filters** — `orderId` · `raisedById` · `againstId` · `assignedAdminId` ·
`status` (repeatable) · `category` · `createdAt_gte` / `createdAt_lte` ·
`search` (`description`) · `sort`: `createdAt` (default `desc`), `updatedAt`.

**Create** — `POST /disputes`

```json
{
  "id": "dsp_9Kq2Xma",
  "orderId": "ord_009",
  "againstId": "usr_creator_noah",
  "category": "scope_mismatch",
  "description": "We ordered an overview film plus three attachment shorts and received the overview plus two shorts…",
  "evidence": [
    { "id": "evd_002", "name": "dispute-evidence-02.jpg", "url": "https://picsum.photos/seed/evd-002/800/600", "thumbnailUrl": "https://picsum.photos/seed/evd-002/400/300", "mediaType": "image", "sizeKb": 820 }
  ]
}
```

`raisedById` comes from the session. Both parties must be parties to the order.
Opening a dispute moves the order to `disputed` and holds the payment.

**Response** `200 OK` — a resolved case

```json
{
  "id": "dsp_003",
  "orderId": "ord_014",
  "raisedById": "usr_buyer_bloom",
  "againstId": "usr_creator_chloe",
  "category": "non_delivery",
  "description": "No files were ever submitted and the creator has not responded to the order thread for two weeks…",
  "evidence": [ { "id": "evd_004", "name": "dispute-evidence-04.jpg", "url": "https://picsum.photos/seed/evd-004/800/600", "thumbnailUrl": "https://picsum.photos/seed/evd-004/400/300", "mediaType": "image", "sizeKb": 820 } ],
  "status": "resolved",
  "assignedAdminId": "usr_admin_maya",
  "resolution": {
    "outcome": "full_refund",
    "amountRefunded": 610,
    "note": "No deliverables were submitted and the creator did not respond to either party inside the review window…",
    "resolvedById": "usr_admin_maya",
    "resolvedAt": "2026-07-12T16:10:00.000Z"
  },
  "createdAt": "2026-07-05T09:25:00.000Z",
  "updatedAt": "2026-07-12T16:40:00.000Z"
}
```

`assignedAdminId` is **absent until triaged**; `resolution` is **absent until
resolved**. `resolution.amountRefunded` always matches the payment's
`refundedAmount` and is omitted for a `release_payment` outcome.

Status follows `DISPUTE_STATUS_MACHINE` (§8). Two consequences the admin console
depends on, and which the API must enforce independently of it:

- **`open` has no `resolved` edge.** A case must be picked up before it can be
  decided, so `POST /disputes/:id/resolve` on an untriaged case is `409` even
  from an admin who holds `disputes.resolve`.
- **There is no `awaiting_buyer → awaiting_creator` edge.** A case can be owed
  by one party at a time; operation 40 is `409` on a case already parked on the
  other.

> **Authorization is server-side.** Every write above moves held money or
> changes what two members are told about their money. The console hides the
> actions an admin cannot take and refuses the typed URL with an explanation
> (§9.1), and neither of those is access control: Laravel must check
> `disputes.resolve` on each endpoint and scope reads to a case the caller is a
> party to or cleared for.

Errors: `403` (not a party; missing `disputes.resolve`) · `404` · `409` (a
second open dispute on one order; illegal transition; no escrow held) · `422`.

---

### 6.17 `disputeMessages`

The case thread. **Contains admin-only internal notes.**

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/disputes/:id/messages` | Party (public only) · Admin (all) | The thread |
| `POST` | `/disputes/:id/messages` | Party · Admin | Post a message |

**Filters** — `disputeId` · `internal` · `sort`: `createdAt` (default `asc` —
a thread reads oldest-first).

**Create**

```json
{ "body": "Opening this because we are three weeks past the delivery date with no files and no update…", "attachments": [] }
```

`authorId` and `authorRole` come from the session. `internal: true` is
**accepted only from an admin**.

**Response** `201 Created`

```json
{
  "id": "dmsg_001",
  "disputeId": "dsp_001",
  "authorId": "usr_buyer_pulse",
  "authorRole": "buyer",
  "body": "Opening this because we are three weeks past the delivery date with no files and no update…",
  "attachments": [],
  "internal": false,
  "createdAt": "2026-08-08T11:15:00.000Z"
}
```

> **`internal` must be filtered server-side.** An internal note reads like this:
> *"Internal: order thread confirms the creator flagged the missing part on the
> shoot day… Holding for the buyer to confirm the part date before proposing a
> partial release."* Sending that to a buyer would be a serious breach.

> **Mock reality** — JSON Server returns every message, so the client requests
> `?internal=false` for non-admins and filters defensively again before
> rendering. **This is not access control** (00 §11): the data is on the wire
> and visible in devtools. It is the single most important thing on this page
> for the Laravel developer to get right.

> **Laravel** — scope the query by the caller's role:
> `when(!$user->isAdmin(), fn($q) => $q->where('internal', false))`. Never rely
> on a client-supplied filter to withhold data.

Errors: `403` (not a party; a non-admin sending `internal: true`) · `404` · `422`.

---

### 6.18 `reviews`

The buyer's rating of a completed engagement. **One review per order, and only
on completed orders.**

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/reviews` | **Public** | Reviews on a creator's profile |
| `GET` | `/reviews/:id` | **Public** | One review |
| `POST` | `/reviews` | Buyer (of a completed order) | Leave a review |

Reviews are not editable or deletable — a public rating that could be revised
after the fact is not a rating.

**Filters** — `creatorId` · `buyerId` · `orderId` · `rating` (repeatable) ·
`rating_gte` · `search` (`comment`) · `sort`: `createdAt` (default `desc`),
`rating`.

**Create** — `POST /reviews`

```json
{
  "id": "rvw_2Xm9Kqa",
  "orderId": "ord_016",
  "rating": 5,
  "comment": "Liam wrote to our release notes, not just to the camera. The walkthrough needed one small wording change and nothing else, and the open-caption version was ready the same day."
}
```

`buyerId`, `creatorId`, and `requestId` are derived from the order server-side.

**Response** `201 Created`

```json
{
  "id": "rvw_001",
  "orderId": "ord_016",
  "requestId": "req_024",
  "buyerId": "usr_buyer_pulse",
  "creatorId": "usr_creator_liam",
  "rating": 5,
  "comment": "Liam wrote to our release notes, not just to the camera…",
  "createdAt": "2026-05-22T16:10:00.000Z"
}
```

`rating` is an integer 1–5.

Creating a review updates the creator's derived `ratingAvg` / `ratingCount`.

> **Mock reality** — nothing recalculates them, so `reviewService` reads the
> creator's reviews, recomputes the average to one decimal, and `PATCH`es
> `creatorProfiles`. Reviewing is not atomic with the aggregate update.

> **Laravel** — `reviews.order_id UNIQUE`, `rating TINYINT CHECK BETWEEN 1 AND
> 5`, and recompute the aggregate in the same transaction (or as a queued
> listener). A creator's `ratingCount` legitimately trails `completedOrders` —
> not every completed order gets reviewed.

**Rating breakdown** *(added by Prompt 13)* — the public profile's summary card
shows the 5→1 distribution, not just the average: it is what tells a buyer
whether a 4.5 is "consistently good" or "mostly great with two bad days".

```
GET /reviews/breakdown?creatorId=usr_creator_ava
```

`200 OK`

```json
{
  "total": 6,
  "average": 4.5,
  "distribution": { "5": 4, "4": 1, "3": 1, "2": 0, "1": 0 }
}
```

> **Mock reality** — JSON Server cannot group, so `reviewService.getBreakdown`
> pages the creator's ratings in (100 at a time, five pages at most) and tallies
> them client-side. Past 500 ratings the distribution describes the newest ones
> rather than all of them, which the return value flags as `isPartial` instead
> of implying an exactness it does not have.

> **Laravel** — one query:
> `SELECT rating, COUNT(*) FROM reviews WHERE creator_id = ? GROUP BY rating`.
> Exact, uncapped, and the paging loop is deleted.

**`include=buyer`** *(reserved by Prompt 13)* — a public review card names the
business that left it.

> **Mock reality** — `reviewService.listByCreatorWithBuyers` follows the page
> with two batched lookups (`GET /users?id=…` and `GET /buyerProfiles?userId=…`)
> and attaches `buyer: { name, companyName }` to each review. If either fails
> the reviews still render, attributed to "Verified buyer".

> **Laravel** — eager-load the buyer and its business profile on the review
> resource; one round trip, and the two follow-ups disappear.

Errors: `403` (not the order's buyer) · `404` · `409` `conflict` (order not
`completed`; already reviewed) · `422`.

---

### 6.19 `notifications`

The in-app bell feed.

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/notifications` | Own only | The feed and the unread count |
| `PATCH` | `/notifications/:id` | Own only | Mark one as read |
| `POST` | `/notifications/read-all` | Own only | Mark everything as read |

There is no client-facing `POST` for a single notification — notifications are
emitted by workflow operations via `notificationService.notify(…)` (00 §10).

A member may **only** read their own notifications. `userId` is derived from the
session; a `userId` filter naming someone else is `403`.

**Filters** — `read` · `type` (repeatable) · `entityType` ·
`createdAt_gte` / `createdAt_lte` · `sort`: `createdAt` (default `desc`).

**Unread count** — the app derives it rather than storing it
(`docs/data-model.md` §4), because a counter the UI mutates on every
"mark as read" is a second source of truth that drifts on the first missed
update:

```
GET /notifications?read=false&page=1&limit=1     → total is the unread count
```

**Response** `200 OK` — verified against the live mock API

```json
{
  "items": [
    {
      "id": "ntf_002",
      "userId": "usr_buyer_verde",
      "type": "proposal_received",
      "title": "New proposal from Noah Feldman",
      "body": "Your autumn menu brief has three proposals waiting. The newest quotes $640 with a 7-day turnaround.",
      "entityType": "request",
      "entityId": "req_001",
      "read": false,
      "createdAt": "2026-08-08T20:15:00.000Z"
    }
  ],
  "total": 2,
  "page": 1,
  "limit": 12
}
```

`entityType` + `entityId` form the deep link. **Both are omitted** for a general
announcement, which has nowhere to navigate:

```json
{
  "id": "ntf_005",
  "userId": "usr_buyer_verde",
  "type": "system_announcement",
  "title": "Escrow protection now covers revisions",
  "body": "Payments stay held until you accept a delivery, including while a revision is in progress…",
  "read": false,
  "createdAt": "2026-08-05T20:15:00.000Z"
}
```

**Mark as read** — `PATCH /notifications/ntf_002`

```json
{ "read": true }
```

`200 OK` → the updated record.

> **Mock reality** — "mark all as read" is N sequential `PATCH`es, one per
> unread row. It is visibly slow with 17 unread and would be unacceptable at
> scale.

> **Laravel** — `POST /notifications/read-all` → one
> `UPDATE … SET read = 1 WHERE user_id = ? AND read = 0`, returning
> `{ "updated": 17 }`. Index `(user_id, read, created_at DESC)` — the exact
> query the bell menu runs.

`type` values and their categories are in `src/constants/notificationTypes.js`
(§8). Respect `users.notificationPrefs[category].inApp` when emitting.

---

### 6.20 `moderationReviews`

One record per piece of content in the review pipeline — the Trust & Safety
queue.

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/moderationReviews` | Admin `moderation.review` · Owner (own submissions) | The queue |
| `GET` | `/moderationReviews/:id` | Admin · Owner | One case |
| `POST` | `/moderationReviews` | System (on submit) | Enqueue |
| `PATCH` | `/moderationReviews/:id` | Admin `moderation.review` | Claim a case |
| `POST` | `/moderationReviews/:id/decision` | Admin `moderation.review` | **Decision** — below |

**Filters** — `status` (repeatable) · `subjectType` (`portfolio_item` \|
`delivery`) · `subjectId` · `creatorId` (→ `users.id`) · `reviewerId` ·
`reasonCode` · `submittedAt_gte` / `submittedAt_lte` ·
`sort`: `submittedAt` (default `asc` — oldest first, the queue order).

**The open queue** is `reviewedAt = null`:

```
GET /moderationReviews?status=submitted&status=under_review&sort=submittedAt&order=asc
```

**Response** `200 OK` — an open case

```json
{
  "id": "mod_001",
  "subjectType": "portfolio_item",
  "subjectId": "pfi_010",
  "creatorId": "usr_creator_liam",
  "status": "under_review",
  "reviewerId": "usr_admin_priya",
  "history": [
    { "at": "2026-07-27T12:20:00.000Z", "byId": "usr_creator_liam", "fromStatus": "draft", "toStatus": "submitted", "note": "Submitted for review by the creator." },
    { "at": "2026-07-27T18:20:00.000Z", "byId": "usr_admin_priya", "fromStatus": "submitted", "toStatus": "under_review", "note": "Picked up from the review queue." }
  ],
  "submittedAt": "2026-07-27T12:20:00.000Z",
  "reviewedAt": null
}
```

`reviewerId` is absent while unclaimed. `status` uses the `CONTENT_STATUS`
subset `submitted`, `under_review`, `approved`, `rejected`, `revision_required`,
`restricted`.

**Recording a decision**

```
POST /moderationReviews/mod_003/decision
```

```json
{
  "status": "revision_required",
  "reasonCode": "low_production_quality",
  "notes": "Close, but the submission needs changes before it can be published. Details sent to the creator."
}
```

`reasonCode` comes from `REJECTION_REASON_CODE` in `src/constants/policy.js` and
is **required** for `rejected`, `revision_required`, and `restricted`.

`200 OK`

```json
{
  "id": "mod_003",
  "subjectType": "portfolio_item",
  "subjectId": "pfi_020",
  "creatorId": "usr_creator_diego",
  "status": "revision_required",
  "reviewerId": "usr_admin_priya",
  "notes": "Close, but the submission needs changes before it can be published. Details sent to the creator.",
  "reasonCode": "low_production_quality",
  "history": [
    { "at": "2026-07-28T12:20:00.000Z", "byId": "usr_creator_diego", "fromStatus": "draft", "toStatus": "submitted", "note": "Submitted for review by the creator." },
    { "at": "2026-07-28T18:20:00.000Z", "byId": "usr_admin_priya", "fromStatus": "submitted", "toStatus": "under_review", "note": "Picked up from the review queue." },
    { "at": "2026-07-29T00:20:00.000Z", "byId": "usr_admin_priya", "fromStatus": "under_review", "toStatus": "revision_required", "note": "Close, but the submission needs changes before it can be published. Details sent to the creator." }
  ],
  "submittedAt": "2026-07-28T12:20:00.000Z",
  "reviewedAt": "2026-07-29T00:20:00.000Z"
}
```

A decision does four things: sets `status` + `reviewedAt`, **appends** a
`history` entry, propagates the outcome to the subject (an approved portfolio
item becomes `published`), and notifies the creator
(`moderation_approved` / `moderation_rejected` / `moderation_revision`).

> **Mock reality** — JSON Server cannot append to an array. The client `GET`s
> the record, pushes the new entry client-side, and `PATCH`es the **whole
> `history` array** back. Two reviewers acting at once lose one entry.

> **Laravel** — `history` becomes a `moderation_review_events` table and the
> decision is an `INSERT`, which is both concurrency-safe and the auditable
> form. Claiming a case should be a conditional update
> (`WHERE reviewer_id IS NULL`) so two reviewers cannot claim the same item.

Errors: `403` · `404` · `409` (illegal `CONTENT_STATUS` transition; case already
decided) · `422` (missing `reasonCode` on a negative decision).

---

### 6.21 `reports`

Member reports about content, profiles, or requests.

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/reports` | Admin `reports.manage` | The report queue |
| `GET` | `/reports/:id` | Admin | One report |
| `POST` | `/reports` | **Public** | Report something |
| `PATCH` | `/reports/:id` | Admin `reports.manage` | Record the outcome |

`POST /reports` is public because a signed-out visitor must be able to report
content — that is why `reporterId` is optional.

**Filters** — `status` (repeatable) · `subjectType` · `subjectId` ·
`reason` · `handledById` · `createdAt_gte` / `createdAt_lte` ·
`sort`: `createdAt` (default `desc`).

**Create** — `POST /reports`

```json
{
  "id": "rpt_7Kq9Xma",
  "subjectType": "portfolio_item",
  "subjectId": "pfi_051",
  "reason": "intellectual_property",
  "details": "Two shots in this submission look like they come from a production company showreel we licensed last year. Worth checking who holds the rights before it goes live."
}
```

`subjectType` ∈ `portfolio_item` \| `creator_profile` \| `request`.
`reason` ∈ `prohibited_content` \| `intellectual_property` \|
`misleading_claims` \| `spam` \| `other`.

**`subjectId` resolves against different collections per `subjectType`** — and
for `creator_profile` it points at `creatorProfiles.id`, **not** `users.id`,
because a report is about the public listing (`docs/data-model.md` §3).

**Response** `201 Created`

```json
{
  "id": "rpt_001",
  "reporterId": "usr_buyer_pulse",
  "subjectType": "portfolio_item",
  "subjectId": "pfi_051",
  "reason": "intellectual_property",
  "details": "Two shots in this submission look like they come from a production company showreel…",
  "status": "open",
  "createdAt": "2026-08-11T14:10:00.000Z"
}
```

`reporterId` is set from the session when signed in and **omitted entirely** for
an anonymous report. `handledById` is omitted until an admin acts.

**Outcome** — `PATCH /reports/:id` with `status` ∈ `reviewed` \| `actioned` \|
`dismissed`, plus `handledById`. Actioning a report typically also restricts the
subject (§6.5) and writes an audit entry (`report.action` / `report.dismiss`).

> **Laravel** — rate-limit anonymous `POST /reports` hard (per IP) and return
> `429` `rate_limited`. A public write endpoint with no auth is the obvious
> abuse target in this API.

Errors: `403` · `404` · `422`.

---

### 6.22 `supportTickets`

The support inbox. Reachable by signed-out visitors, so contact details live on
the ticket.

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/supportTickets` | Admin `support.manage` · Own | The inbox |
| `GET` | `/supportTickets/:id` | Admin · Own | One ticket |
| `POST` | `/supportTickets` | **Public** | Contact support |
| `PATCH` | `/supportTickets/:id` | Admin `support.manage` | Change status |
| `POST` | `/supportTickets/:id/replies` | Admin `support.manage` | Reply |

**Filters** — `status` (repeatable) · `userId` · `email` ·
`createdAt_gte` / `createdAt_lte` · `search` (`subject`, `body`) ·
`sort`: `createdAt` (default `desc`).

**Create** — `POST /supportTickets`

```json
{
  "id": "tkt_9Kq2Xma",
  "name": "Owen Bailey",
  "email": "owen.bailey@craftwaretools.test",
  "subject": "Can our dispute be held open while we wait for a part?",
  "body": "We have an open dispute about a missing demonstration film. The part needed to film it is on back order…"
}
```

`name` and `email` are stored **on the ticket** — a signed-out visitor has no
account to read them from. `userId` is attached from the session when present.

**Response** `200 OK` — with a reply

```json
{
  "id": "tkt_002",
  "name": "Owen Bailey",
  "email": "owen.bailey@craftwaretools.test",
  "userId": "usr_buyer_craftware",
  "subject": "Can our dispute be held open while we wait for a part?",
  "body": "We have an open dispute about a missing demonstration film…",
  "status": "pending",
  "replies": [
    {
      "byId": "usr_admin_maya",
      "body": "Yes — a case can stay open while both parties are working towards delivery, and the payment stays held in escrow the whole time. Could you confirm the expected date for the part so I can note it on the case?",
      "at": "2026-08-04T10:05:00.000Z"
    }
  ],
  "createdAt": "2026-08-03T10:05:00.000Z"
}
```

`status` ∈ `open` \| `pending` \| `resolved` \| `closed`.

> **Mock reality** — replying is the same read-modify-write whole-array `PATCH`
> as moderation history (§6.20), with the same lost-update risk.

> **Laravel** — `support_ticket_replies` as its own table; replying is an
> `INSERT`. Rate-limit the public `POST` and validate `email`.

Errors: `403` · `404` · `422`.

---

### 6.23 `affiliateProfiles`

Enrolled referrers. Any role may enrol.

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/affiliateProfiles` | Own · Admin `affiliates.manage` | My affiliate account / the roster |
| `GET` | `/affiliateProfiles/:id` | Own · Admin | One account |
| `POST` | `/affiliate/enroll` | Auth | **Composite** — join the program (§7) |
| `PATCH` | `/affiliateProfiles/:id` | Admin `affiliates.manage` | Suspend / reactivate |

**Filters** — `userId` · `code` (exact — attribution lookup) · `status` ·
`sort`: `enrolledAt` (default `desc`), `conversions`, `paidEarnings`.

**Response** `200 OK`

```json
{
  "id": "aff_001",
  "userId": "usr_creator_ava",
  "code": "AVA-STUDIO",
  "status": "active",
  "clicks": 214,
  "signups": 2,
  "conversions": 1,
  "pendingEarnings": 10,
  "approvedEarnings": 15,
  "paidEarnings": 9.6,
  "enrolledAt": "2026-04-24T12:00:00.000Z"
}
```

`code` matches `users.referredByCode` and is unique across the platform.
`signups` = referrals, `conversions` = converted referrals. The three earnings
fields are **derived** from `affiliateEarnings` by status.

The program is gated by `platformSettings.affiliate.enabled` and
`platformSettings.features.affiliateProgram`.

> **Laravel** — `user_id UNIQUE`, `code UNIQUE`. Generate the code server-side;
> a client-generated code cannot be made unique without a race (§7).

Errors: `403` · `404` · `409` (already enrolled; duplicate code) · `422`.

---

### 6.24 `affiliateReferrals`

One row per referred account.

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/affiliateReferrals` | Own affiliate · Admin `affiliates.manage` | My referrals |
| `GET` | `/affiliateReferrals/:id` | Own · Admin | One referral |

Created during registration when `referredByCode` matches an active affiliate;
converted by `processConversion` (§7). No client-facing write endpoint.

**Filters** — `affiliateId` · `referredUserId` · `status` (repeatable) ·
`convertedOrderId` · `sort`: `createdAt` (default `desc`).

**Response** `200 OK`

```json
{
  "id": "ref_001",
  "affiliateId": "aff_001",
  "referredUserId": "usr_buyer_craftware",
  "status": "converted",
  "convertedOrderId": "ord_020",
  "createdAt": "2026-04-26T10:15:00.000Z",
  "convertedAt": "2026-05-28T16:10:00.000Z"
}
```

A referral converts when the referred account's first qualifying order completes
inside `platformSettings.affiliate.attributionDays` (30). Past that window it
`expired`. `convertedOrderId` is present exactly when `status` is `converted`.

An affiliate can never refer themselves.

> **Laravel** — `referred_user_id UNIQUE` (an account is referred once), and run
> the expiry sweep as a scheduled job rather than lazily on read.

---

### 6.25 `affiliateEarnings`

Commission accrued per qualifying order.

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/affiliateEarnings` | Own affiliate · Admin `affiliates.manage` | My earnings |
| `GET` | `/affiliateEarnings/:id` | Own · Admin | One earning |
| `PATCH` | `/affiliateEarnings/:id` | Admin `affiliates.manage` | Approve / void |

**Filters** — `affiliateId` · `referralId` · `orderId` · `status` (repeatable) ·
`createdAt_gte` / `createdAt_lte` · `sort`: `createdAt` (default `desc`),
`amount`.

**Response** `200 OK`

```json
{
  "id": "aer_001",
  "affiliateId": "aff_001",
  "referralId": "ref_001",
  "orderId": "ord_020",
  "amount": 9.6,
  "currency": "USD",
  "status": "paid",
  "createdAt": "2026-05-28T16:10:00.000Z",
  "approvedAt": "2026-05-31T16:10:00.000Z",
  "paidAt": "2026-06-09T16:10:00.000Z"
}
```

```
amount = round(commissions.amount × platformSettings.affiliate.commissionRate, 2)
```

Commission is a share of **the platform commission BetterBlue actually earned**,
never a share of the creator's earnings — so a refund reduces it automatically.

`status` ∈ `pending` → `approved` → `paid`, or `void`. **Only a `paid` earning
writes an `affiliate_commission` transaction.**

Admin transitions write `affiliate.earning.approve` / `affiliate.earning.void`
audit entries.

> **Laravel** — `UNIQUE (affiliate_id, order_id)`. Recompute `amount` from the
> commission row; never accept it from a client.

Errors: `403` · `404` · `409` (illegal transition) · `422`.

---

### 6.26 `auditLogs`

The immutable record of administrative action. Buyer and creator activity is not
duplicated here — it lives in its own collections.

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/auditLogs` | Admin `audit.view` | Browse the trail |
| `GET` | `/auditLogs/:id` | Admin `audit.view` | One entry |

**Append-only.** No `PATCH`, no `DELETE` — for anyone, at any permission level.
Entries are written as a side effect of the admin actions in §7.

**Filters** — `actorId` · `action` (repeatable) · `entityType` · `entityId` ·
`createdAt_gte` / `createdAt_lte` · `search` (`action`) ·
`sort`: `createdAt` (default `desc`).

**Response** `200 OK`

```json
{
  "id": "aud_006",
  "actorId": "usr_admin_maya",
  "actorRole": "admin",
  "action": "user.verify",
  "entityType": "user",
  "entityId": "usr_creator_ava",
  "meta": { "verified": true, "evidence": "business registration and portfolio review" },
  "createdAt": "2026-04-26T15:45:00.000Z"
}
```

`action` is dot-namespaced `domain.verb`. The seeded vocabulary — extend it,
do not rename it:

```
admin.create · admin.permissions.update · affiliate.earning.approve
affiliate.earning.void · affiliate.suspend · announcement.send
category.update · content.restrict · creator.feature · dispute.assign
dispute.close · dispute.escalate · dispute.open · dispute.request_info
dispute.resolve · moderation.approve · moderation.reject
moderation.request_changes · order.cancel · order.note · payment.refund
payout.mark_paid · payout.process · payout.reject · report.action
report.dismiss · report.review · request.close · settings.update
ticket.close · ticket.reopen · ticket.reply · ticket.resolve · user.blacklist
user.deactivate · user.reactivate · user.suspend · user.verify
```

Prompt 33 completed the `dispute.*` family. `dispute.assign`, `dispute.close`,
and `dispute.resolve` were seeded and are now written by the console;
`dispute.escalate` and `dispute.request_info` are new, and `dispute.open` is the
second verb a **member** writes about their own action (see `user.deactivate`
below) — a frozen order and held money have to be accountable whoever caused it.

`dispute.resolve` carries the fullest `meta` in the vocabulary, because it is
the entry somebody reconstructs a money decision from months later:
`{ orderId, paymentId, outcome, amountRefunded, heldAmount, settledAmount,
commissionRate, commissionAmount, creatorEarnings, currency, fromStatus,
toStatus, orderFromStatus, orderToStatus, note }`. Like `order.note`, it stores
the *content* of the decision (`meta.note`) rather than a description of it —
here because the note is also what both parties were shown, and the trail is
where the two are reconciled. `dispute.escalate` stores its internal note the
same way, and **that one is admin-only**: it is the reason the workspace
timeline marks audit-derived rows `Internal`.

Prompt 31 added `order.note`, `ticket.resolve`, and `ticket.reopen`, and made
`request.close` and `announcement.send` reachable from the console rather than
seed-only. `order.note` is the odd one: it is the only verb whose `meta` carries
the *content* of the action rather than a description of it (`meta.note`),
because the audit trail **is** the storage for internal order notes — there is no
`orderNotes` collection, for the same reason there is no `announcements` one
(operation 12). `ticket.resolve` and `ticket.reopen` extend the ticket family
rather than renaming `ticket.close`/`ticket.reply`, which the seed already
carries.

`user.blacklist` and `user.reactivate` were added by Prompt 29 alongside the
`user.suspend` the seed already carried — the three account-status verbs are one
family, and `user.verify` (unchanged) is what the creator badge toggle writes,
against the **account**, with `meta = { verified, profileId }`.

`user.deactivate` is the one entry a **member** writes about themselves: closing
your own account from Settings is recorded so support can see who left, when,
and why (`meta.selfService = true`). Ordinary buyer and creator activity is
still not audited here.

`actorRole` is denormalised so the entry survives a role change. `meta` carries
the detail behind the action (`{ fromStatus, toStatus, reason }`, `{ amount }`,
`{ added, removed }`, …).

> **Laravel** — grant no `UPDATE`/`DELETE` on this table at the database-user
> level, not just in application code. `meta JSON`; index
> `(actor_id, created_at DESC)`, `(entity_type, entity_id)`,
> `(action, created_at DESC)`. Partition or archive by month once it grows.

---

### 6.27 `platformSettings`

A **singleton**, not a collection: no id, no list, no pagination.

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/platformSettings` | Auth (public subset) · Admin (all) | Read configuration |
| `PATCH` | `/platformSettings` | **`super_admin`** (or `settings.manage`) | Update configuration |

**Response** `200 OK` — verified against the live mock API

```json
{
  "general": {
    "platformName": "BetterBlue",
    "supportEmail": "support@betterblue.test",
    "currency": "USD",
    "autoAcceptDays": 5,
    "payoutMinAmount": 50
  },
  "commission": { "defaultRate": 0.2, "categoryOverrides": {} },
  "affiliate": { "enabled": true, "commissionRate": 0.1, "attributionDays": 30, "payoutMinAmount": 25 },
  "moderation": {
    "autoApproveDeliveries": true,
    "reviewSlaDays": 2,
    "rejectionReasons": ["policy_prohibited_content", "low_production_quality", "mismatch_with_brief", "ip_violation", "metadata_incomplete", "other"]
  },
  "features": { "affiliateProgram": true, "publicRequestBoard": true, "reviews": true, "disputes": true },
  "updatedAt": "2026-08-02T09:45:00.000Z",
  "updatedById": "usr_super"
}
```

These values are load-bearing: `commission.defaultRate` prices every order at
award time, `affiliate.commissionRate` sizes every affiliate earning,
`general.payoutMinAmount` gates payout requests, `general.autoAcceptDays` drives
auto-acceptance, and `features.*` are the feature flags behind
`useFeatureFlag`.

**Optional key — `paymentProvider`** (Prompt 17). Selects the payment provider
implementation (`"dummy"`, and later the real processor's key). It is **absent
from the seeded settings on purpose**: `getPaymentProvider()` defaults to
`"dummy"`, so the prototype needs no configuration, and switching processors is
one `PATCH` away rather than a deploy (`docs/payments.md` §10). An unrecognised
value falls back to `dummy` rather than failing a payment. Admin-only, like the
rest of the non-public settings.

**Update** — `PATCH /platformSettings`

```json
{ "commission": { "defaultRate": 0.18, "categoryOverrides": {} } }
```

Every update also writes a `settings.update` audit entry with the before/after
in `meta`, and sets `updatedAt` / `updatedById`.

> **Mock reality — a real trap.** JSON Server merges a singular-route `PATCH`
> at the **top level only**: sending `{ "commission": { "defaultRate": 0.18 } }`
> replaces the entire `commission` object and **silently drops
> `categoryOverrides`**. Verified: patching a partial `general` block kept
> `commission` intact but replaced `general` wholesale. So `settingsService`
> always sends the **complete sub-object**, as above.

> **Laravel** — do not create a one-row wide table. Use a key-value table
> (`key` = `'commission.defaultRate'`, `value JSON`, `updated_by`,
> `updated_at`) and hydrate it into this nested shape in the API layer. New
> settings then ship without a migration and each key carries its own audit
> trail. A true deep merge on `PATCH` also removes the trap above.

> **Security** — the public/authenticated read should expose only what the UI
> needs (`general.platformName`, `features.*`, `general.currency`).
> `commission`, `affiliate` rates, and `moderation` internals are admin-only.
> JSON Server returns the whole object to anyone; Laravel must not.

Errors: `403` (not a super admin) · `422`.

---

## 7. Composite operations

This is the heart of the migration story.

Every row below is **one intention** the product has — accepting a proposal,
releasing a payment — expressed as an intention-named service function (00 §10).
Under JSON Server the function orchestrates a sequence of REST calls from the
browser. Under Laravel it becomes **one request** to one endpoint that does the
same work inside a database transaction.

**The function signature never changes.** That is the whole design: migrating
means rewriting the body of twelve functions, not rewriting the app.

Two properties of every mock sequence are worth stating plainly, because they
are the reason these belong on the server:

- **Not atomic.** A failure at step 5 of 8 leaves the data half-updated with no
  rollback. Services attempt best-effort compensation and surface an error, but
  the mock stack genuinely cannot guarantee consistency.
- **Not authoritative.** Every amount, status, and id is computed in the browser
  and trusted by the server. In production, all of it must be recomputed
  server-side (§9).

### 7.1 Summary

| # | Operation | Service | Mock calls | Laravel endpoint |
|---|---|---|---|---|
| 1 | `acceptProposal` | `orderService` | 8+ | `POST /proposals/:id/accept` |
| 2 | `initiateOrderPayment` | `paymentService` | 7 | `POST /orders/:id/pay` |
| 3 | `releasePayment` | `paymentService` | 9+ | `POST /orders/:id/release` |
| 4 | `refundPayment` | `paymentService` | 7 | `POST /payments/:id/refund` |
| 5 | `submitDelivery` | `deliveryService` | 6+ | `POST /orders/:id/deliveries` |
| 6 | `acceptDelivery` | `deliveryService` | 3 + complete | `POST /deliveries/:id/accept` |
| 6a | `completeOrder` | `orderService` | 3 + release | *(inside operation 6)* |
| 7 | `requestRevision` | `revisionService` | 6 | `POST /deliveries/:id/revisions` |
| 8 | `resolveDispute` | `disputeService` | 8+ | `POST /disputes/:id/resolve` |
| 9 | `enrollAffiliate` | `affiliateService` | 3 | `POST /affiliate/enroll` |
| 10 | `processConversion` | `affiliateService` | 9 | internal (order-completed handler) |
| 11 | `requestPayout` | `payoutService` | 4 | `POST /payouts` |
| 12 | `broadcastAnnouncement` | `notificationService` | 1 + N | `POST /announcements` |
| 13 | `getStats` | `landingService` | 4 | `GET /stats/landing` |
| 14 | `getOverview` | `buyerDashboardService` | 8 | `GET /buyer/overview` |
| 15 | `cancelOrder` | `orderService` | 3 + refund | `POST /orders/:id/cancel` |
| 16 | `submitReview` | `reviewService` | 5 | `POST /reviews` |
| 17 | `getOrderTimeline` | `orderService` | 5 | `GET /orders/:id/timeline` |
| 18 | `getOverview` | `creatorDashboardService` | 11 | `GET /creator/overview` |
| 19 | `submitForReview` | `portfolioService` | 4 | `POST /portfolioItems/:id/submit` |
| 20 | `submitProposal` | `proposalService` | 6 | `POST /proposals` |
| 21 | `getEarningsBreakdown` | `paymentService` | 6 | `GET /creator/earnings` |
| 22 | `createDispute` | `disputeService` | 6 + N | `POST /disputes` |
| 23 | `postMessage` | `disputeService` | 5 + N | `POST /disputes/:id/messages` |
| 24 | `getOverviewStats` | `adminService` | 9 | `GET /admin/overview` |
| 25 | `getAttentionQueues` | `adminService` | 5 | `GET /admin/attention` |
| 26 | `claimForReview` | `moderationService` | 3 | `PATCH /moderationReviews/:id` |
| 27 | `decide` | `moderationService` | 5 | `POST /moderationReviews/:id/decision` |
| 28 | `actionReport` | `reportService` | 5 | `POST /reports/:id/action` |
| 29 | `adminCloseRequest` | `requestService` | 4 + 2N | `POST /admin/contentRequests/:id/close` |
| 30 | `getAdminOrderContext` | `orderService` | 11 | `GET /admin/orders/:id` |
| 31 | `replyToTicket` | `supportService` | 3 | `POST /admin/supportTickets/:id/replies` |
| 32 | `processPayout` | `paymentService` | 4 | `POST /payouts/:id/process` |
| 33 | `markPayoutPaid` | `paymentService` | 5 | `POST /payouts/:id/paid` |
| 34 | `getEscrowOverview` | `paymentService` | 4+ | `GET /admin/escrow` |
| 35 | `getFinanceSummary` | `paymentService` | 3+ | `GET /admin/finance/summary` |
| 36 | `adminListQueue` | `disputeService` | 4 | `GET /admin/disputes` |
| 37 | `getQueueCounts` | `disputeService` | 5 | `GET /admin/disputes/summary` |
| 38 | `getAdminCaseContext` | `disputeService` | 12 | `GET /admin/disputes/:id` |
| 39 | `assign` | `disputeService` | 3 | `PATCH /disputes/:id` |
| 40 | `requestInfo` | `disputeService` | 5 | `POST /disputes/:id/request-info` |
| 41 | `escalate` | `disputeService` | 5 + N | `POST /disputes/:id/escalate` |
| 42 | `close` | `disputeService` | 3 | `PATCH /disputes/:id` |
| 43 | `previewSettlement` | `paymentService` | 3 | `GET /orders/:id/settlement-preview` |

Operations 16 and 17 were added by Prompt 20 (the buyer's order workspace), and
operation 18 by Prompt 21 (the creator's) — the mirror of operation 14, section
for section. Operation 19 arrived with Prompt 22 (the portfolio manager): it is
the smallest composite in the table and the only one that writes across the
creator/moderation boundary.
Operation 7 lives in `revisionService` rather than `deliveryService`: it *creates
a revision* and moves the delivery and the order as side effects, so it belongs
with the record it writes. Operation 6a was split out of operation 6 for the same
reason in reverse — completing an order is reached from two places (a buyer
accepting, and Trust & Safety resolving a dispute in the creator's favour), and
only the first of those goes through a delivery. Operation 20 arrived with
Prompt 23 (the request board and the creator's proposal flow): it is the supply
side's entry point, and the only composite whose sequence is mostly *guards*.
Operation 21 arrived with Prompt 25 (the creator's earnings screen): like 14, 17,
and 18 it is a read that never writes, and it exists so that no component ever
holds a money calculation. Operations 22 and 23 arrived with Prompt 26 (the
party-facing dispute system) and are the two halves of a case before anyone
decides it: opening one freezes an order without moving a cent, and posting on
the thread moves the case's own status rather than the order's. The decision
itself stays operation 8. Operations 24 and 25 arrived with Prompt 28 (the admin
console's foundation): they are the platform-wide mirror of 14 and 18 — reads
that never write, and the reason no admin screen ever queries a collection to
compute a statistic. Operations 26–28 arrived with Prompt 30 (content
moderation) and close the loop operation 19 opened: 19 puts content in the
queue, 26 takes it off, 27 decides it and propagates that decision to the
content, the creator, and the audit trail, and 28 is how a member report becomes
a case in the first place. Operations 29–31 arrived with Prompt 31 (marketplace
operations), and operation 12 was implemented by the same prompt. All four are
the *admin* side of workflows that already existed: 29 is `closeRequest` (§7.2
operation not listed — a buyer action) told in BetterBlue's voice with an audit
entry and a notification for the buyer; 30 is the admin superset of the reads
behind the buyer's and creator's order screens; 31 is the only new conversation
in the console. **Admin cancellation of an order is deliberately not a new
operation** — it is operation 15 with `byRole: 'admin'`, which is what makes the
refund path identical whether the trigger is a dispute resolution or an
intervention. Operations 32–35 arrived with Prompt 32 (admin finance) and
complete the payout lifecycle operation 11 opened: 11 is a creator asking, 32 is
finance answering, and 33 is the **separate** moment money leaves the balance —
two steps because "we accept this request" and "the bank has sent it" are two
different facts, and only the second writes a ledger row (`docs/payments.md` §5).
34 and 35 are reads that never write, in the shape of 24 and 25. **Refunding
from the finance console is deliberately not a new operation** —
`adminRefundOrder` is a named wrapper over operation 4 that supplies the
`intervention` refund context and requires a reason; a second implementation of
a refund is the last thing this product needs.

Operations 36–43 arrived with Prompt 33 (the admin dispute console) and finish
the lifecycle operations 22 and 23 began: 22 opens a case, 23 carries the
conversation on it, and **operation 8 ends it**. 36–38 are reads in the shape of
30 and 34 — one composite per screen, so no component is left holding a query.
39–42 are the casework around the decision, and each is a *different fact* about
a case rather than a variation on one: picked up, waiting on a party, escalated,
filed away. They are separate operations for the same reason 32 and 33 are —
collapsing "we accept this" into "the bank has sent it" would have the platform
assert something it does not know. **Resolving is deliberately not a new money
operation:** operation 8 branches onto operations 3 and 4 and adds nothing of
its own, which is what makes a dispute resolved in the creator's favour settle
byte-for-byte like a buyer accepting a delivery, commission record included.
Operation 43 is the read behind that: it prices a settlement *before* it happens
using the same rate resolution and rounding, so the figures on the resolve
dialog and the ledger rows it predicts cannot drift.

### 7.2 The sequences

---

#### 1. `acceptProposal(proposalId)`

The buyer picks a winner. Creates the order.

**Mock — `POST /proposals/:id/accept` does not exist, so:**

1. `GET /proposals/:id` — load the offer
2. `GET /contentRequests/:requestId` — guard `status === 'open'`
3. `GET /platformSettings` — read `commission.defaultRate`
4. `PATCH /proposals/:id` → `{ status: 'accepted', respondedAt }`
5. `GET /proposals?requestId=:requestId` → `PATCH` each other offer to
   `{ status: 'declined', respondedAt }` (one call per losing offer)
6. `POST /orders` — client-generated `ord_…` id, `status: 'pending_payment'`,
   fields copied from the request, `commissionAmount` and `creatorEarnings`
   computed **in the browser**
7. `PATCH /contentRequests/:requestId` →
   `{ status: 'awarded', awardedProposalId }`
8. `POST /notifications` × (1 + losing offers) — `proposal_accepted`,
   `proposal_declined`

> **Implementation note (Prompt 17).** Step 6 stores the proposal's
> `deliveryDays` on the order and leaves `deliveryDueAt: null`. The delivery
> clock starts when the money does, so the due date is computed by
> `initiateOrderPayment` (operation 2) rather than at award time — an order that
> waits three days for payment does not lose three days of its turnaround. The
> rate in `commissionRate` comes from `paymentService.computeCommission`, which
> is the same function the release path uses.

**Laravel — `POST /proposals/:id/accept` → `{ order, proposal }`**

One transaction: lock the request, verify it is `open` and the caller owns it,
accept this proposal, decline the rest, insert the order with server-computed
money, award the request, dispatch notifications. `orders.request_id UNIQUE`
makes a double-accept impossible.

---

#### 2. `initiateOrderPayment(orderId, method)`

The buyer funds the order and work begins.

**Mock:**

1. `GET /orders/:id` — guard `status === 'pending_payment'`
2. `POST /payments` — `status: 'initiated'`, amount copied from the order
3. Charge the dummy provider in `services/payments/` (no HTTP — it resolves or
   rejects locally)
4. `PATCH /payments/:id` → `{ status: 'processing', providerRef }` → then
   `{ status: 'held', heldAt }` — or `{ status: 'failed', failureReason }`
5. `PATCH /orders/:id` → `{ status: 'in_progress', activatedAt }`, plus
   `deliveryDueAt = heldAt + deliveryDays` when the order carries one
6. `POST /transactions` — `type: 'charge'`, `userId: buyerId`,
   `amount: −price`, `balanceAfter: null`
7. `POST /notifications` × 2 — `order_paid` to the creator, and the buyer's
   receipt

On failure the sequence stops after step 4 and the order stays
`pending_payment`, which is why the seed contains a `failed` attempt **and** a
`processing` retry on `ord_001`.

> **Implementation note (Prompt 17).** The guard in step 1 refuses an order that
> already has a `held`, `released`, `refunded`, or `partially_refunded` payment —
> **not** one merely `processing`. An attempt whose tab was closed mid-charge
> would otherwise strand the order forever, and the seeded scenario above is
> exactly that shape. Preventing a genuine double charge is the idempotency key's
> job (§1.8), which only the real backend can honour. The steps are also ordered
> payment → order → ledger → notifications, so an interruption never leaves a
> ledger row for an order that did not start (`docs/payments.md` §9).

**Laravel — `POST /orders/:id/pay` → `{ order, payment }`**

```json
{ "method": { "brand": "visa", "last4": "1156" }, "idempotencyKey": "…" }
```

The amount is **not** in the request — the server reads it from the order.
Charge the PSP, then write payment + order + transaction in one transaction.
Declines return `402` `payment_failed` with `details.reason`.

---

#### 3. `releasePayment(orderId)`

Escrow moves to the creator, minus commission. The most consequential operation
in the product.

**Mock:**

1. `GET /orders/:id`
2. `GET /payments?orderId=:id&status=held` — find the escrowed payment
3. `PATCH /payments/:paymentId` → `{ status: 'released', releasedAt }`
4. `POST /commissions` — `rate`, `baseAmount` (`price − refunded`), `amount`
5. `GET /transactions?userId=:creatorId&_sort=createdAt&_order=desc&_limit=1` —
   read the prior balance so `balanceAfter` can be computed
6. `POST /transactions` × 2 — `release` (creator, `+baseAmount`) and
   `commission` (creator, `−fee`)
7. `PATCH /orders/:id` → `{ status: 'completed', completedAt }`
8. `PATCH /contentRequests/:requestId` → `{ status: 'completed' }`
9. `processConversion(orderId)` (operation 10) and `POST /notifications` —
   `payment_released`, `order_completed`

> **Implementation note (Prompt 17).** `paymentService.releasePayment` performs
> steps 1–6 and the `payment_released` notification — it moves **money** only.
> Steps 7, 8, and `order_completed` belong to the caller
> (`deliveryService.acceptDelivery`, `disputeService.resolveDispute`), because
> the same release finishes an accepted delivery, an auto-acceptance, and a
> dispute differently. Step 5's balance read is `writeTransaction`'s job, and the
> affiliate hook in step 9 is marked in place for Prompt 34.

**Laravel — `POST /orders/:id/release` → `{ order, payment, commission, transactions }`**

One transaction with `SELECT … FOR UPDATE` on the order, guarded by
`commissions.order_id UNIQUE`. Amounts recomputed from the order and the
payment; the affiliate conversion fires as a queued listener on an
`OrderCompleted` event rather than blocking the response.

---

#### 4. `refundPayment(orderId, { amount, reason })`

Full or partial return to the buyer, from a cancellation or a dispute.

**Mock:**

1. `GET /orders/:id` and `GET /payments?orderId=:id`
2. Refund via the dummy provider
3. `PATCH /payments/:paymentId` →
   `{ status: 'refunded' | 'partially_refunded', refundedAt, refundedAmount }`
4. `POST /transactions` — `type: 'refund' | 'partial_refund'`,
   `userId: buyerId`, `amount: +refund`
5. Full refund → `PATCH /orders/:id` `{ status: 'refunded', cancelledAt }`.
   Partial refund → the order continues to `completed`, with
   `commissions.baseAmount = price − refunded`
6. `POST /auditLogs` — `payment.refund`, `meta: { amount, reason }`
7. `POST /notifications` — both parties

> **Implementation note (Prompt 17).** A partial refund **settles in the same
> call**: `partially_refunded` is a terminal state in `PAYMENT_STATUS_MACHINE`,
> so the payment cannot later transition to `released`. It therefore ends
> carrying both `refundedAt` and `releasedAt`, with the `partial_refund`,
> `release`, and `commission` rows and the `commissions` record all written by
> `refundPayment` — matching the seeded partial-refund order exactly. Commission
> is charged only on the creator-kept portion (`docs/payments.md` §6). As with
> the release, the **order's** own transition belongs to the caller.

**Laravel — `POST /payments/:id/refund` → `{ payment, order, transactions }`**

```json
{ "amount": 205, "reason": "Partial refund per dispute resolution dsp_004." }
```

Validate `amount <= payment.amount − already_refunded` server-side; omitting
`amount` means a full refund.

---

#### 5. `submitDelivery(orderId, { message, files, revisionId })`

The creator hands over a version.

**Mock:**

1. `GET /orders/:id` — guard the order is `in_progress` or `revision_requested`
   and that the caller is its creator; validate `message` (20–600) and that at
   least one file is attached, **before** anything is uploaded
2. `uploadService.upload(file)` per file — simulated, no HTTP (§5). `files` may
   also arrive as file objects already uploaded by the caller, which is what the
   composer passes so it can show per-file progress and retry a single failure
3. `GET /deliveries?orderId=:id` — compute `version = max + 1` **in the browser**
4. `POST /deliveries` — `status: 'submitted'`, `submittedAt`, `revisionId` when
   answering a revision
5. `PATCH /orders/:id` → `{ status: 'delivered', deliveredAt }`
6. If answering a revision: `PATCH /revisions/:revisionId` → `{ resolvedAt }`
   (best effort)
7. `POST /moderationReviews` — `subjectType: 'delivery'`, `subjectId` the new
   version, `creatorId` the order's creator (best effort). **Every version gets
   a record**; `platformSettings.moderation.autoApproveDeliveries` decides what
   state it opens in:
   - `true` (the seeded default) → `status: 'approved'`, `reviewedAt` stamped,
     and a system entry in `history` saying it was auto-approved under the
     platform delivery policy. Trust & Safety spot-checks a decided record
     rather than working a queue of everything the marketplace produces, and
     Prompt 30's queue (`moderationService.listQueue`) does not show it
   - `false` → `status: 'submitted'`, `reviewedAt: null` — the case joins the
     open queue and is reviewed like a portfolio submission (operation §6.20)
8. `POST /notifications` — `delivery_submitted` to the buyer

> **Implementation note (Prompt 24).** Steps 4–8 have no transaction around them
> and run in that order deliberately: an interruption leaves work that is
> recorded but not yet announced, rather than an order marked `delivered` with
> nothing behind it. Steps 6, 7 and 8 are best effort — a delivery that reached
> the buyer must not be undone because a review row or a bell item failed to
> write. Both settings values are exercised by the same code path; only the
> `status`/`reviewedAt` pair differs.

**Returns:** `{ delivery, order, revision, moderationReview }` — `revision` and
`moderationReview` are `null` when there was none / the write failed.

**Laravel — `POST /orders/:id/deliveries` → `{ delivery, order }`**

Version computed server-side inside the transaction, enforced by
`UNIQUE (order_id, version)`. Files referenced by the ids returned from
`POST /uploads`. The moderation record is written by an `DeliverySubmitted`
event listener reading the same setting, so the policy lives in one place rather
than in every caller.

Errors: `422` (empty or short message, no files, more than 10 files, a rejected
file type or size) · `403` (not the order's creator) · `404` · `409` (the order
is not `in_progress` or `revision_requested`).

---

#### 6. `acceptDelivery(deliveryId)`

The buyer accepts. This is what completes an order and pays a creator.

**Mock:**

1. `GET /deliveries/:id` and `GET /orders/:orderId` — guard the version is
   `submitted` and the order is `delivered`
2. `PATCH /deliveries/:id` → `{ status: 'accepted', respondedAt }`
3. `completeOrder(orderId)` — operation 6a below
4. `POST /notifications` — `delivery_accepted` to the creator

Step 2 runs before step 3 deliberately: a version marked accepted with the money
still held is recoverable by hand, whereas money released against a version
nobody accepted is not.

**Laravel — `POST /deliveries/:id/accept` → `{ delivery, order, payment }`**

Accepting and releasing are the same transaction. There is no window in which a
delivery is accepted but the creator has not been paid.

Auto-acceptance after `platformSettings.general.autoAcceptDays` (5) is a
**scheduled job** server-side. Prompt 20's UI therefore *displays* the date the
job would fire (computed from `orders.deliveredAt`) and says so in words; nothing
in the mock stack runs on a timer.

Errors: `403` (not the order's buyer) · `404` · `409` (version already responded
to; order not `delivered`).

---

#### 6a. `completeOrder(orderId, { release = true })`

Closes an order and pays the creator. Reached from operation 6 (a buyer
accepting) and from operation 8 (a dispute resolved in the creator's favour,
which settles the money itself and so passes `release: false`).

**Mock:**

1. `GET /orders/:id` — validate the transition to `completed` **before** any
   money moves
2. `releasePayment(orderId)` — the entire operation 3 sequence, unless
   `release: false`
3. `PATCH /orders/:id` → `{ status: 'completed', completedAt }`
4. `PATCH /contentRequests/:requestId` → `{ status: 'completed' }` when the brief
   is still `awarded` (best effort)
5. `GET /orders?creatorId=…&status=completed` +
   `PATCH /creatorProfiles/:id` → `{ completedOrders }` (best effort)
6. `POST /notifications` — `order_completed` to the creator

Steps 4 and 5 are **best effort**: a settled payment must not be undone by a
stale brief or a derived counter. `completedOrders` is a MOCK-AGGREGATE in the
sense of §6.4 — nothing derives it server-side, so it is recomputed here exactly
as `seed-db.js` recomputes it.

**Laravel — folded into `POST /deliveries/:id/accept` and
`POST /disputes/:id/resolve`.** All six steps are one transaction, and
`completedOrders` becomes `withCount('completedOrders')` rather than a column.

Errors: `409` (order cannot reach `completed`; no escrow held).

---

#### 7. `requestRevision(deliveryId, { notes })`

The buyer asks for changes.

**Mock:**

1. `GET /deliveries/:id` and `GET /orders/:orderId`
2. Guard the order is `delivered` and `revisionsUsed < revisionsIncluded`
   **client-side**
3. `POST /revisions` — `orderId`, `deliveryId`, `requestedById`, `notes`
4. `PATCH /deliveries/:id` → `{ status: 'revision_requested', respondedAt }`
5. `PATCH /orders/:orderId` →
   `{ status: 'revision_requested', revisionsUsed: n + 1 }`
6. `POST /notifications` — `revision_requested` to the creator

Returns `{ revision, delivery, order }`. The guard failure carries
`details: { revisionsUsed, revisionsIncluded }` so the UI can explain the limit
and point at a dispute instead of merely refusing.

**Laravel — `POST /deliveries/:id/revisions` → `{ revision, delivery, order }`**

The revision-limit guard runs server-side and returns `409` `conflict` with
`details: { revisionsUsed, revisionsIncluded }`. `revisionsUsed` is incremented
atomically, not read-modify-written.

---

#### 8. `resolve(disputeId, { outcome, amountRefunded, note, actor })`

An admin issues a binding decision. Branches on `DISPUTE_RESOLUTION`. Implemented
by Prompt 33 (named `disputeService.resolve`).

**Guards, all of them before a cent moves:**

- `outcome` is a `DISPUTE_RESOLUTION` value — else `422`
- `note` is 30–1000 characters — else `422` with `details.note`. Both parties
  read it verbatim, so it is required rather than optional
- `dispute.status ∈ RESOLVABLE_DISPUTE_STATUSES` — the states with a `resolved`
  edge in `DISPUTE_STATUS_MACHINE` (§8.1), which excludes `open`
- the case is **assigned**, or `escalated` — an untriaged case is one nobody has
  read, and deciding it is `409`
- the order can still reach its ending (`disputed → completed | refunded`)
- a payment is actually `held` on the order — else `409`
- for `partial_refund`, `0 < amountRefunded < held`. Returning the *whole*
  escrow is a full refund, which ends the order differently, so it is `422`
  rather than silently reinterpreted

**Mock:**

1. `GET /disputes/:id`, `GET /orders/:orderId`, then operation 43 for the escrow
   and the split that will settle
2. Branch:
   - `release_payment` → operation 6a with `release: true` — the whole of
     operation 3, then `orders → completed`
   - `full_refund` → operation 4 for the full amount, then `PATCH /orders/:id` →
     `{ status: 'refunded', cancelledAt }`
   - `partial_refund` → operation 4 for `amountRefunded`, which settles the
     remainder in the same call with `commissions.baseAmount = price −
     amountRefunded`, then operation 6a with `release: false`
3. `PATCH /disputes/:id` →
   `{ status: 'resolved', resolution: { outcome, amountRefunded?, note, resolvedById, resolvedAt }, updatedAt }`
4. `POST /disputes/:id/messages` — the decision as a **real message from the
   reviewer**, public, opening `BetterBlue resolved this dispute: …` and
   carrying the note. The thread is the record of the case, and the decision is
   the last thing said on it
5. `POST /notifications` × 2 — `dispute_resolved` to both parties, sequentially
6. `POST /auditLogs` — `dispute.resolve`, with `meta` carrying the outcome, the
   amount refunded, the escrow, what settled, the rate, the commission, the
   creator's net, and both status transitions

That is up to twenty requests for one admin click, any of which can fail
independently. Ordering is the safest available: everything is validated, the
order's own transition is checked, then the money moves, then the case is
written. **A failure after step 2 throws `server_error` naming the step** and
what was already written (§3.2) — an escrow released against a case still
reading `under_review` is exactly the state somebody has to reconcile by hand,
and swallowing the error is how it goes unnoticed. Steps 4–6 are best effort.

**Why a partial refund completes the order.** It is the one outcome where both
sides got something: the buyer keeps deliverables and gets money back, the
creator is paid for what they did, and commission is charged only on what they
kept (`docs/payments.md` §6). `refunded` would assert the engagement never
happened and `cancelled` that it was called off — neither is true of work that
was delivered, kept, and partly paid for.

**Laravel — `POST /disputes/:id/resolve` → `{ dispute, order, payment }`**

```json
{ "outcome": "partial_refund", "amountRefunded": 205, "note": "…" }
```

One transaction covering the refund, the release, the commission, the ledger,
the dispute, the thread message, the audit entry, and both notifications, with
`SELECT … FOR UPDATE` on the order for its duration. `amountRefunded` is
required for `partial_refund`, rejected for `release_payment`, and validated
against the payment — never trusted from the client (§9.3). Authorization is
`disputes.resolve`, enforced server-side: the frontend hides the button, which
is not the same thing (§9.1).

---

#### 36–38. The admin console's reads

| # | Function | Mock sequence | Laravel |
|---|---|---|---|
| 36 | `adminListQueue(params)` | `GET /disputes` + `GET /orders?id=…` + `GET /users?id=…` + `GET /payments?orderId=…`, joined client-side | `GET /admin/disputes` with four eager loads |
| 37 | `getQueueCounts({ adminId })` | five `GET /disputes?…&_limit=1`, read for `X-Total-Count` | `GET /admin/disputes/summary` — one grouped count |
| 38 | `getAdminCaseContext(id)` | the case, its order, the payment, the ledger, both parties, both parties' case histories, both order counts, and the timeline | `GET /admin/disputes/:id` |

All three are **reads that never write**, in the shape of operations 24, 30 and
34. Every aggregate is its own failure boundary: a count that cannot be read
comes back `null`, never `0`, because "no prior disputes" and "we could not
count them" are different sentences and a screen must not say the first when it
means the second.

Operation 38's timeline is folded from `auditLogs` (§6.26) rather than from a
`disputeEvents` collection, for the reason `orderService.listAdminNotes` reads
notes off the trail: the record already exists, and a second copy of it is a
second thing to keep in step. **It is admin-only** — audit meta carries internal
notes.

Errors: `403` · `404`.

---

#### 39. `assign(disputeId, { adminId, actor })`

Triage. `PATCH /disputes/:id` → `{ assignedAdminId, updatedAt }`, plus
`status: 'under_review'` **only when the case is `open`** — reassigning one
already parked on a party must not clear the ball it is waiting on. Then
`POST /auditLogs` — `dispute.assign`, with `previousAdminId` so a hand-off is
legible.

Errors: `409` (the case is already decided) · `422` (no assignee) · `404`.

**Laravel — `PATCH /disputes/:id`**, one transaction with the audit entry, the
actor from the session, gated on `disputes.resolve`.

---

#### 40. `requestInfo(disputeId, { from, message, actor })`

The team asks one party for something.

**Mock:**

1. `GET /disputes/:id`, `GET /orders/:orderId`
2. `POST /disputeMessages` — **public**, `internal: false`
3. `PATCH /disputes/:id` → `{ status: 'awaiting_buyer' | 'awaiting_creator' }`
4. `POST /notifications` — `dispute_message` to **that party only**, worded as
   an action needed
5. `POST /auditLogs` — `dispute.request_info`

The message is public by design: a request made privately is a request the other
side cannot see was made, and in casework that is how an impartial decision
stops looking impartial. Only the party being asked is notified — a bell item
saying "we asked them something" is noise on a case they cannot act on. Their
reply moves the case back to `under_review` through operation 23, which is what
makes the ping-pong self-clearing.

`DISPUTE_STATUS_MACHINE` has **no** `awaiting_buyer → awaiting_creator` edge, so
a case already parked on one party cannot be handed to the other; the console
hides the action rather than offering one that fails.

Errors: `409` (no such transition from here) · `422` · `404`.

**Laravel — `POST /disputes/:id/request-info` → `{ dispute, message }`.**

---

#### 41. `escalate(disputeId, { note, actor })`

**Mock:**

1. `GET /disputes/:id`, `GET /orders/:orderId`
2. `POST /disputeMessages` — **`internal: true`**
3. `PATCH /disputes/:id` → `{ status: 'escalated' }`
4. `notifyAdmins('disputes.resolve')` — one notification per eligible admin,
   sequentially (see operation 22)
5. `POST /auditLogs` — `dispute.escalate`

The note is internal because escalation is a conversation between reviewers
about a decision neither party should be pre-empting. Both parties see the
*status* — Prompt 26's banner tells them a senior reviewer has it — and neither
sees a word of why.

Errors: `409` (only a case `under_review` can be escalated) · `422` · `404`.

**Laravel — `POST /disputes/:id/escalate` → `{ dispute }`.**

---

#### 42. `close(disputeId, { actor })`

`resolved → closed`, and nothing else: the money moved when the decision was
issued, and closing is bookkeeping. `PATCH /disputes/:id` plus
`POST /auditLogs` — `dispute.close`.

It is separate from operation 8 because the two are different facts — "we
decided this" and "nobody came back on it" — and collapsing them would file a
case away before either party had read the outcome.

AUTO-CLOSE-HOOK: the natural extension is a scheduled job closing resolved cases
after N days. That is server-side work and cannot live in a browser, so the
console offers the manual door and Prompt 26's party screens already read
`closed` exactly as they read `resolved`.

Errors: `409` (only a decided case can be closed) · `404`.

---

#### 43. `previewSettlement(orderId, { refundAmount, refundAll })`

What a settlement *would* do to an order's escrow. Writes nothing.

**Mock:** `GET /orders/:id`, `GET /payments?orderId=…&status=held`, and the
commission rate — the order's frozen `commissionRate` first, settings only for
an order that predates the field.

Returns `{ held, refundedAmount, baseAmount, rate, commissionAmount,
creatorEarnings, currency, payment }`. One `refundAmount` drives all three
dispute outcomes: `0` is a release, the whole held amount (`refundAll: true`) is
a full refund, and anything between is the partial split. An out-of-range amount
is **clamped, not rejected** — this prices a number somebody is still typing,
and operation 4 is where an impossible one is refused.

It exists so that nothing above the services layer performs money arithmetic
(the rule `getEarningsBreakdown` follows for the same reason): the figures on
the resolve dialog and the ledger rows they predict are two folds of one
calculation rather than two calculations.

**Laravel — `GET /orders/:id/settlement-preview?refundAmount=…`**, gated the same
way the operation it previews is, computed from the server's own records.

---

#### 9. `enrollAffiliate()`

A member joins the referral program.

**Mock:**

1. `GET /affiliateProfiles?userId=:id` — guard "not already enrolled"
2. Generate a code from the display name + `utils/id.js`, then
   `GET /affiliateProfiles?code=:code` — a **best-effort** uniqueness check
3. `POST /affiliateProfiles` — `status: 'active'`, counters at `0`

**Laravel — `POST /affiliate/enroll` → `{ affiliateProfile }`**

The **server** generates the code, with `code UNIQUE` and `user_id UNIQUE`
guaranteeing what step 2 can only hope for. Also gate on
`platformSettings.affiliate.enabled`.

---

#### 10. `processConversion(orderId)`

Fires when an order completes. Attributes the sale to a referrer.

**Mock:**

1. `GET /orders/:id` → `buyerId`
2. `GET /users/:buyerId` → `referredByCode`; stop if absent
3. `GET /affiliateProfiles?code=:code` → stop unless `status === 'active'`
4. `GET /affiliateReferrals?referredUserId=:buyerId` → guard `pending` and
   within `attributionDays` of `createdAt`
5. `GET /commissions?orderId=:id` → the platform commission actually earned
6. `GET /platformSettings` → `affiliate.commissionRate`
7. `PATCH /affiliateReferrals/:id` →
   `{ status: 'converted', convertedOrderId, convertedAt }`
8. `POST /affiliateEarnings` —
   `amount = round(commission.amount × rate, 2)`, `status: 'pending'`
9. `PATCH /affiliateProfiles/:id` → `{ conversions + 1, pendingEarnings + amount }`
   and `POST /notifications` — `affiliate_conversion`

**Laravel — internal.** No public endpoint: a queued listener on the
`OrderCompleted` event. `UNIQUE (affiliate_id, order_id)` prevents a double
accrual, and the derived totals on `affiliateProfiles` are recomputed rather
than incremented. Expose only `POST /affiliateReferrals/:id/convert` for an
admin correction.

---

#### 11. `requestPayout({ amount })`

A creator withdraws their balance.

**Mock:**

1. `GET /transactions?userId=:creatorId` — sum the ledger **in the browser** to
   get the available balance
2. `GET /platformSettings` → `general.payoutMinAmount` (50)
3. `GET /creatorProfiles?userId=:creatorId` → snapshot `payoutMethod`
4. `POST /payouts` — `status: 'requested'`, `requestedAt`, `processedAt: null`

The available balance is computed on the client and never checked by the
server — the clearest example of "never trust the client" in this API.

**Laravel — `POST /payouts` → `{ payout }`**

```json
{ "amount": 900 }
```

The server computes the balance as `SUM(transactions.amount)` for that account
minus payouts already in flight, enforces the minimum, snapshots the payout
method, and rejects an over-withdrawal with `422` `validation_failed` +
`details.amount`.

---

#### 12. `broadcastAnnouncement({ title, body, audience, actor, onProgress })`

An admin messages a segment of the platform. Implemented by Prompt 31.

**Mock:**

1. `GET /users?role=buyer&accountStatus=active&_page=N&_limit=100` per audience
   segment (paged — the client walks every page, up to a 1,000-recipient cap)
2. `POST /notifications` **per recipient**, sequentially — `type:
   'system_announcement'`, no `entityType`/`entityId`. `onProgress` is called
   after each write so a long send has a moving number
3. `POST /auditLogs` — `announcement.send`, `entityType: 'platform_settings'`,
   `meta: { title, body, audience, recipientCount, sent, failed }`

With 23 seeded members that is ~24 requests. At 10,000 users it is 10,000
requests from a browser tab — the operation that most obviously does not belong
on the client.

Returns `{ audience, title, recipientCount, sent, failed, audited }`. A recipient
whose write fails is counted in `failed` rather than aborting the run, and the
console reports "Sent 240/243" — retrying re-sends to the whole audience, so the
copy says so.

**Two decisions worth stating, because both are the kind somebody assumes
otherwise:**

- **`all` means every active buyer and creator, not every account.** The admin
  team sends announcements; it is not an audience for them. `countAudience(audience)`
  returns the same figure the send will write, and the confirmation dialog
  fetches it live rather than reusing the tile's.
- **There is no `announcements` collection, and the history is the audit trail.**
  An announcement is an event — sent once, never edited, never deleted — and
  `auditLogs` already has to record it, so a second table storing the same four
  fields would be a second source of truth for one sentence.
  `notificationService.listAnnouncements()` reads `announcement.send` entries
  back out and normalises their `meta` (the seeded entry spells its fields
  `subject`/`recipients`, so both spellings are read). Laravel may introduce a
  real `announcements` table when scheduling or drafts arrive; until then this
  is one source of truth, not a shortcut.

`system_announcement` is on `MANDATORY_NOTIFICATION_TYPES` (§6.19), so
preferences do not suppress it and `sent` equals `recipientCount` barring write
failures.

**Laravel — `POST /announcements` → `{ sent: 4821 }`**

```json
{ "title": "Escrow protection now covers revisions", "body": "…", "audience": "all" }
```

`audience` ∈ `all` \| `buyers` \| `creators`. One request; the server fans out
in a queued job and writes the audit entry once.

---

#### 13. `getStats()`

The four marketplace counts printed on the public landing page. The only
composite here that is a **read**, and the only one that never throws.

**Mock — nothing aggregates, so each count is its own request:**

1. `GET /creatorProfiles?_page=1&_limit=1` → `X-Total-Count` (creator storefronts)
2. `GET /categories?_page=1&_limit=100&active=true` → `items.length`, served from
   `categoryService`'s session cache when it is already warm
3. `GET /orders?_page=1&_limit=1&status=completed` → `X-Total-Count`
4. `GET /contentRequests?_page=1&_limit=1` → `X-Total-Count`

The four run in parallel and each is caught independently: a count that fails
resolves to `null` and the landing page drops that tile rather than the page.
The result is cached for the session, and only when every count succeeded — a
partial result would pin a missing tile until reload. Requesting one row purely
to read a header is wasteful but correct; it is also why this is the first
endpoint worth adding server-side.

**Laravel — `GET /stats/landing` → `{ creators, categories, completedOrders, contentRequests }`**

```json
{ "creators": 512, "categories": 12, "completedOrders": 8431, "contentRequests": 10277 }
```

Four `COUNT(*)` queries in one request, cached server-side (the numbers move
slowly and this is the most-requested route in the product). Public and
unauthenticated: it exposes nothing a visitor cannot already count by paging the
public collections.

#### 14. `getOverview(buyerId)`

Everything the buyer dashboard's overview screen prints: four figures, six
months of spend, and the latest activity. A **read**, and like `getStats` it
never throws.

**Mock — three independent sections, run in parallel:**

*Summary* (the stat band and the onboarding checklist's inputs)

1. `GET /contentRequests?buyerId=…&status=open&_page=1&_limit=100` → the open
   briefs, kept for their ids
2. `GET /contentRequests?buyerId=…&status=open&status=awarded&_page=1&_limit=1`
   → `X-Total-Count` (active requests)
3. `GET /contentRequests?buyerId=…&_page=1&_limit=1` → `X-Total-Count` (has this
   buyer ever posted?)
4. `GET /orders?buyerId=…&status=pending_payment&status=in_progress&status=delivered&status=revision_requested&status=disputed&_page=1&_limit=1`
   → `X-Total-Count` (active orders)
5. `GET /orders?buyerId=…&_page=1&_limit=1` → `X-Total-Count`
6. `GET /buyerProfiles?userId=…&_page=1&_limit=1` → the business profile, for the
   profile-completeness step
7. `GET /proposals?requestId=…&…&status=submitted&status=shortlisted&_page=1&_limit=1`
   → `X-Total-Count` (proposals awaiting a decision, scoped to the ids from 1;
   skipped entirely when the buyer has nothing open)

*Spend*

8. `GET /payments?buyerId=…&_page=1&_limit=100` → folded client-side: rows in
   `held`, `released`, or `partially_refunded` are summed net of
   `refundedAmount` for the lifetime total, and bucketed by `createdAt` month
   for the chart — the same rule that derives `buyerProfiles.totalSpent`

*Activity*

9. `GET /notifications?userId=…&_page=1&_limit=8&_sort=createdAt&_order=desc`

Each section is caught on its own: a failure nulls that section's fields and is
reported in `errors`, so one slow collection costs a single card its contents
rather than blanking the dashboard. The 100-row ceiling on steps 1 and 8 is a
provider limit (§4.1), not a product rule — on the server neither fold exists.

**Laravel — `GET /buyer/overview` → the same object for the authenticated buyer**

```json
{
  "activeRequests": 2, "proposalsAwaiting": 4, "activeOrders": 1,
  "requestsTotal": 8, "ordersTotal": 7, "totalSpent": 4200, "currency": "USD",
  "spendByMonth": [{ "key": "2026-03", "label": "Mar", "amount": 0 }],
  "recentActivity": [], "profile": { "id": "bpr_verde" }
}
```

Four `SELECT COUNT(*)`s, one `GROUP BY` over the month, and one indexed read of
the newest notifications — one round trip, cached briefly per buyer. The buyer
id is a **parameter in the mock only**, because the browser has no session to
resolve it from; the endpoint takes it from the bearer token and must ignore any
id the client sends (§9.2).

---

#### 15. `cancelOrder(orderId, { byRole, reason })`

An engagement ends early. Added in Prompt 17 alongside the escrow workflow,
because a cancellation is only safe once the refund path exists.

**Mock:**

1. `GET /orders/:id` — decide which of the two paths applies
2. Funded order (admin only) → the whole of operation 4 for the full amount
3. `PATCH /orders/:id` → `{ status: 'cancelled', cancelledAt }`
4. `POST /notifications` × 2 — `order_cancelled` to both parties
5. `POST /auditLogs` — `order.cancel`, `meta: { fromStatus, reason, refunded }`
   (admin actor only)

Two paths, deliberately different: from `pending_payment` **either party** may
walk away and nothing is refunded because nothing was collected; from
`in_progress`, `revision_requested`, or `disputed` **only an admin** may cancel,
and the escrow goes back to the buyer *first* — an order is never left cancelled
while BetterBlue still holds the money.

**Laravel — `POST /orders/:id/cancel` → `{ order, payment }`**

```json
{ "reason": "The campaign was pulled from the schedule." }
```

The refund and the cancellation are one transaction, and the role check is
server-side: a party cancelling a funded order is `403`, not a UI affordance
that happens to be hidden.

---

#### 16. `submitReview(orderId, { rating, comment })`

The buyer rates a finished engagement. Added by Prompt 20.

**Mock:**

1. `GET /orders/:id` — guard `status === 'completed'` and the caller owns it
2. `GET /reviews?orderId=:id&_limit=1` — guard "not already reviewed"
3. `POST /reviews` — `buyerId`, `creatorId`, and `requestId` derived from the
   order, never from the caller (§9.2)
4. `GET /reviews?creatorId=…&_limit=100` — fold the ratings
5. `PATCH /creatorProfiles/:id` → `{ ratingAvg, ratingCount }`

Steps 4–5 are the MOCK-AGGREGATE of §6.18 and are **best effort**: the rating is
the record and the aggregate is a cache of it, so a failure there leaves a real
review and a stale average that the next review repairs. `ratingCount` uses the
list's `total` (exact) while `ratingAvg` is folded from the newest capped page.

**Laravel — `POST /reviews` → `{ review }`.** `reviews.order_id UNIQUE` makes a
second review structurally impossible, and the aggregate is recomputed in the
same transaction (or by a queued listener).

Errors: `403` (not the order's buyer) · `404` · `409` (order not `completed`;
already reviewed) · `422` (rating outside 1–5).

---

#### 17. `getOrderTimeline(orderId)`

The history of one order, oldest first — the **single source** behind the
buyer's, the creator's, and the admin's timeline. Added by Prompt 20.

**Mock:**

1. `GET /orders/:id`
2. `GET /payments?orderId=…`, `GET /deliveries?orderId=…`,
   `GET /revisions?orderId=…`, `GET /disputes?orderId=…` — in parallel

There is no `events` collection and there does not need to be: every moment
worth showing already carries a timestamp on the record it belongs to, and
anything that has not happened yet has a `null` timestamp and produces no entry.
Each related read falls back to empty on failure — a missing dispute row must not
cost the reader the delivery history — while a missing order still `404`s.

**Response** — an array sorted ascending by `at`:

```json
[
  {
    "id": "payment_held:2026-08-03T19:20:00.000Z",
    "type": "payment_held",
    "title": "Payment held in escrow",
    "description": "$1,180.00 was taken and held by BetterBlue. Work could start.",
    "at": "2026-08-03T19:20:00.000Z",
    "tone": "success",
    "icon": "solar:lock-keyhole-linear"
  }
]
```

`type` values come from `ORDER_EVENT_TYPE` in `src/services/orderService.js`;
`tone` is a `STATUS_TONES` value, so the entries drop straight into
`TimelineList`.

**Laravel — `GET /orders/:id/timeline`** composed server-side from the same rows,
or from a real `order_events` table written by the workflow handlers.

---

#### 18. `getOverview(creatorUserId)`

The creator counterpart to operation 14: everything the creator dashboard's
overview screen prints — four figures, six months of earnings, the profile and
portfolio progress behind the onboarding checklist, and the latest activity. A
**read**, and like operation 14 it never throws. Added by Prompt 21.

**Mock — four independent sections, run in parallel:**

*Storefront* (the availability switch, the matching-brief tile, the completeness meter)

1. `GET /creatorProfiles?userId=…&_page=1&_limit=1` → the storefront
2. `GET /contentRequests?status=open&categoryId=…&categoryId=…&_page=1&_limit=1`
   → `X-Total-Count` (live briefs in this creator's categories; skipped entirely
   when the storefront has no categories yet)

*Pipeline* (the stat band, the portfolio step, the onboarding inputs) — chained
on step 1, because the portfolio counts are keyed by `cpr_…`

3. `GET /proposals?creatorId=…&status=submitted&status=shortlisted&_page=1&_limit=1`
   → `X-Total-Count`
4. `GET /proposals?creatorId=…&_page=1&_limit=1` → `X-Total-Count` (has this
   creator ever offered on anything?)
5. `GET /orders?creatorId=…&status=pending_payment&status=in_progress&status=delivered&status=revision_requested&status=disputed&_page=1&_limit=1`
   → `X-Total-Count`
6. `GET /orders?creatorId=…&_page=1&_limit=1` → `X-Total-Count`
7. `GET /portfolioItems?creatorId=cpr_…&status=published&_page=1&_limit=1` → `X-Total-Count`
8. `GET /portfolioItems?creatorId=cpr_…&status=submitted&status=under_review&_page=1&_limit=1`
   → `X-Total-Count`

*Earnings*

9. the whole of `getEarningsSummary` (§7.1 operation 11's read half) — held,
   available, paid out, lifetime, and the ledger balance
10. `GET /transactions?userId=…&_page=1&_limit=100` → folded client-side: rows of
    type `release` and `commission` are bucketed by `createdAt` month, and net to
    `orders.creatorEarnings` within each bucket because the commission rows are
    negative. `payout` and `affiliate_commission` are excluded: they move the
    balance without being earnings from marketplace work

*Activity*

11. `GET /notifications?userId=…&_page=1&_limit=8&_sort=createdAt&_order=desc`

Each section is caught on its own: a failure nulls that section's fields and is
reported in `errors`, so one slow collection costs a single card its contents
rather than blanking the dashboard. `profileCompleteness` is derived — no
request — from the storefront plus the signed-in account (the browser already
holds it, and `avatarUrl` is the one weighted field that lives on `users`); the
weights are documented on `CREATOR_PROFILE_FIELDS` in
`src/services/creatorProfileService.js`.

**Laravel — `GET /creator/overview` → the same object for the authenticated creator**

```json
{
  "openMatchingRequests": 3, "activeProposals": 3, "activeOrders": 3,
  "proposalsTotal": 15, "ordersTotal": 11, "currency": "USD",
  "earningsSummary": { "held": 1710, "available": 2464, "paidOut": 1200, "lifetime": 3664 },
  "earningsByMonth": [{ "key": "2026-03", "label": "Mar", "amount": 0 }],
  "portfolioCounts": { "published": 9, "inReview": 0 },
  "profileCompleteness": { "percent": 100, "completed": 18, "total": 18, "missing": [] },
  "recentActivity": [], "profile": { "id": "cpr_ava" }
}
```

Six `SELECT COUNT(*)`s, one `GROUP BY` over the month, the earnings summary's own
aggregates, and one indexed read of the newest notifications — one round trip,
cached briefly per creator. The creator id is a **parameter in the mock only**,
because the browser has no session to resolve it from; the endpoint takes it from
the bearer token and must ignore any id the client sends (§9.2).

---

#### 19. `submitForReview(itemId, { creatorUserId })`

A creator sends a piece of sample work into the Trust & Safety queue. One
intention, two records: the item's `status` and the moderation case behind it
have to move together or the queue and the portfolio disagree about what is
waiting.

**Mock — `POST /portfolioItems/:id/submit` does not exist, so:**

1. `GET /portfolioItems/:id` — guard `status → submitted` against
   `CONTENT_STATUS_MACHINE`; an illegal move is `409` `conflict`
2. `GET /moderationReviews?subjectType=portfolio_item&subjectId=:id&_limit=1` —
   has this been reviewed before?
3. **New case** — `POST /moderationReviews` with `status: 'submitted'`,
   `creatorId` (a **`usr_…`**, not the item's `cpr_…`), and a one-entry
   `history`
   **Existing case** — `PATCH /moderationReviews/:id` clearing `reviewerId`,
   `notes`, `reasonCode`, and `reviewedAt`, re-stamping `submittedAt`, and
   appending to `history`
4. `PATCH /portfolioItems/:id` → `{ status: 'submitted', submittedAt,
   updatedAt, rejectionReason: null }`

Step 4 is **last on purpose.** If the case cannot be written, the item stays
exactly where it was and the creator retries a submission — the opposite order
would leave a draft marked "submitted" against a queue that never received it.

MOCK-APPEND: step 3 re-sends the whole `history` array, because JSON Server
cannot append to one (§6.20). Two writers at once lose an entry.

No notification is emitted: the creator performed the action themselves, and the
reviewer's queue is a screen rather than a bell.

**Response** — `{ item, review }`, the two updated records.

> **Laravel** — one transaction: guard the transition, `updateOrCreate` the
> case, append a `moderation_review_events` row, save the item, return both.
> `creatorUserId` comes from the bearer token and any id in the body is ignored
> (§9.2); the owner must also be authorised against the item (§9.1).

---

#### 20. `submitProposal({ requestId, creatorId, coverMessage, price, deliveryDays, revisionsIncluded, sampleItemIds })`

A creator answers a brief. One intention, three records: the offer is written,
the brief's counter moves, and the buyer is told.

**Mock — `POST /proposals` exists, but the guards and the side effects do not,
so:**

1. `GET /contentRequests/:requestId` — refuse anything but `status: open` with
   `409 conflict`
2. `GET /proposals?requestId=…&creatorId=…&_limit=1` — the duplicate guard;
   a hit is `409 conflict`
3. `GET /users/:creatorId` and `GET /creatorProfiles?userId=…` in parallel —
   refuse a non-`active` account (`403 forbidden`) and a storefront with
   `availability: false` (`409 conflict`)
4. Field rules run in the browser (§6.8, "Field rules") → `422
   validation_failed` with the failing field in `details`
5. `POST /proposals` → `status: 'submitted'`, `respondedAt: null`
6. `PATCH /contentRequests/:requestId` → `{ proposalsCount: n + 1 }`
7. `POST /notifications` → `proposal_received` to the brief's `buyerId`

The guards run **before** anything is written, cheapest first: a closed brief
and a duplicate are far likelier than a suspended account, and both cost one
request each.

MOCK-GUARD: step 2 is a read-before-write, so two submissions racing each other
can both pass it. Laravel makes it `UNIQUE (request_id, creator_id)`.

MOCK-DERIVED: step 6 is a client-side counter update, and two creators
submitting at the same moment can lose a count. It is also **swallowed on
failure** — a card that says "3 proposals" when there are four is cosmetic, and
undoing a proposal that was accepted is not. Step 7 is swallowed for the same
reason.

The **profile-completeness gate** (≥ 60%) that the UI applies before opening the
dialog is deliberately *not* in this sequence: it is a marketplace-quality
nudge rather than an integrity rule, it is explained in visible helper text next
to the disabled button, and a creator who clears it mid-session should not have
to reload. Laravel may promote it to a server-side rule; the three guards above
must be server-side regardless.

**Response** — `201 Created`, the offer.

> **Laravel** — one transaction: authorise the creator from the bearer token
> (§9.2), lock the request row, insert the proposal against the unique
> constraint, bump the counter cache, and dispatch the notification from a
> model listener. `price` is validated but not clamped to the budget — an offer
> above it is legal and the buyer decides (§6.8).

---

#### 21. `getEarningsBreakdown(creatorId)`

Everything `/creator/earnings` prints: the four summary figures, one row per
order that carries money, the totals under them, and twelve months of net
earnings. A **read** — it writes nothing, and a screen can call it as often as
it likes. Added by Prompt 25.

Its reason for existing is the same one operation 18 has, stated more strictly:
**no component performs money arithmetic** (Prompt 25 §7). The three views on
that screen reconcile because they are folded from the same reads rather than
computed three times.

**Mock — `GET /creator/earnings` does not exist, so:**

1. the whole of `getEarningsSummary` (operation 11's read half) — three calls
   for `held`, `lifetime`, `balance`, `pendingPayouts`, `available`, `paidOut`
2. `GET /platformSettings` → `general.payoutMinAmount`, so the withdraw dialog's
   minimum comes from the same place `requestPayout` enforces it
3. `GET /orders?creatorId=…&status=in_progress&status=delivered&status=revision_requested&status=disputed&status=completed&_page=1&_limit=100`
   → one row each. `pending_payment`, `cancelled`, and `refunded` are excluded:
   nothing is, or ever will be, owed on them
4. `GET /transactions?userId=…&_page=1&_limit=100` → bucketed by `createdAt`
   month exactly as operation 18 does, at twelve buckets instead of six
5. `GET /payments?orderId=…&orderId=…&_page=1&_limit=100` → the escrow chip on
   each row. Derived from the payment rather than from the order status, because
   a completed order that was **partially refunded** is the one case where the
   two records disagree (§6.12)

Steps 1–4 run in parallel; step 5 is chained on step 3 because it is keyed by
the order ids it returns.

Each row's `net` is `orders.creator_earnings` — the figure frozen at award time
(§6.9), which is also what the `release`/`commission` ledger pair nets to — so
the table, the tiles, and the chart cannot disagree about the same money.

MOCK-AGGREGATE: the folds are capped at the provider's 100-row page ceiling
(§4.1). A creator past it would see a short list, so the response carries a
`truncated` flag rather than quietly presenting a partial breakdown as a
complete one.

**Laravel — `GET /creator/earnings` → the same object for the authenticated creator**

```json
{
  "currency": "USD", "payoutMinimum": 50, "truncated": false,
  "summary": { "held": 1824, "available": 2153.6, "paidOut": 1200, "lifetime": 3944,
               "pendingPayouts": 600, "balance": 2753.6 },
  "rows": [{ "orderId": "ord_044", "title": "Packaging stills…", "orderStatus": "completed",
             "escrowStatus": "released", "isSettled": true, "settledAt": "2026-08-06T…",
             "gross": 530, "commissionRate": 0.2, "commissionAmount": 106, "net": 424 }],
  "totals": { "count": 11, "gross": 7210, "commissionAmount": 1442, "net": 5768 },
  "monthly": [{ "key": "2026-08", "label": "Aug", "amount": 1448 }],
  "monthlyPeak": { "key": "2026-08", "label": "Aug", "amount": 1448 }
}
```

One `JOIN` for the rows, one `GROUP BY` over the month for the series, and the
summary's own aggregates — one round trip. The creator id is a **parameter in
the mock only**; the endpoint takes it from the bearer token and must ignore any
id the client sends (§9.2).

---

#### 22. `createDispute(orderId, { raisedById, category, description, evidenceFiles })`

A party stops the order and asks BetterBlue to decide. Added by Prompt 26.

The order freezes at `disputed`; the **payment does not move**. That is the whole
shape of this operation: escrow stays `held` and every route out of it —
release, full refund, partial refund — belongs to operation 8, which an admin
runs. Freezing is what makes that decision possible, because neither party can
accept, deliver, or cancel underneath it.

**Eligibility follows `ORDER_STATUS_MACHINE` and nothing else** (§8): a dispute
may be opened from `in_progress`, `delivered`, or `revision_requested`. There is
no `completed → disputed` edge, so a finished order cannot be disputed however
recently it completed — a problem found after accepting goes to support (§6.22).
One live case per order.

**Mock — `POST /disputes` exists, but the guards and the side effects do not,
so:**

1. `GET /orders/:orderId` — refuse a non-party with `403 forbidden`, and any
   status outside the three above with `409 conflict`
2. `GET /disputes?orderId=…&_page=1&_limit=100` — the one-live-case guard; a hit
   in `open`/`under_review`/`awaiting_*`/`escalated` is `409 conflict`
3. field rules run in the browser — `description` 60–2000 characters, `category`
   from `DISPUTE_CATEGORY` → `422 validation_failed` with the failing field
4. `POST /uploads` per evidence file, up to five (§5.1, purpose
   `dispute_evidence`)
5. `POST /disputes` → `status: 'open'`, `assignedAdminId: null`,
   `resolution: null`, `againstId` derived as the other party
6. `PATCH /orders/:orderId` → `{ status: 'disputed' }`
7. `POST /notifications` → `dispute_opened` to the other party
8. `POST /notifications` × N → `dispute_opened` to every admin holding
   `disputes.resolve` (`notificationService.notifyAdmins`)
9. `POST /auditLogs` → `dispute.open` with `{ orderId, category, fromStatus,
   toStatus }`

The guards and the validation run **before** anything is uploaded, so a rejected
description never costs the member a wait on files. Steps 7–9 are swallowed on
failure: a case nobody was told about is recoverable, a frozen order with no case
behind it is not.

MOCK-GUARD: step 2 is a read-before-write, so two tabs can both pass it. Laravel
makes it a partial unique index on `order_id` where the status is live.

MOCK-FANOUT: step 8 cannot be expressed as a query — JSON Server has no "users
holding permission X" — so the admin accounts are read and filtered client-side
with `hasPermission`, then written **one at a time**. Concurrent `POST`s are not
safe against a provider that rewrites its whole database file per write; two in
flight lose one. Laravel: `User::permission('disputes.resolve')->each(...)`.

**Response** — `201 Created`, `{ dispute, order }`.

> **Laravel** — one transaction: `raisedById` from the bearer token (§9.2), lock
> the order row, insert the dispute against the unique index, move the order, and
> dispatch the notifications and the audit entry from model listeners.

---

#### 23. `postMessage(disputeId, { authorId, body, attachments, internal })`

A message on the case thread, and the status ping-pong that goes with it. Added
by Prompt 26.

A case parked at `awaiting_buyer` returns to `under_review` the moment the buyer
answers — and the same for `awaiting_creator` — so the queue sorts itself and
neither party has to wonder whether their reply landed. A message from the side
that is *not* being waited on changes nothing: answering out of turn is allowed,
it just does not clear the other party's ball. An admin's message never moves the
status; admins move it explicitly (§6.16).

**Mock — `POST /disputes/:id/messages` does not exist, so:**

1. `GET /disputes/:disputeId` — refuse a non-party who is not an admin with
   `403 forbidden`; refuse `internal: true` from a non-admin with `403`; refuse
   `resolved`/`closed` with `409 conflict` (the thread is shut)
2. field rules in the browser — `body` 2–2000 characters → `422`
3. `POST /uploads` per attachment, up to three (§5.1, `dispute_evidence`)
4. `GET /orders/:orderId` — for the author's role when the caller did not supply
   one, and for the order title in the notification body
5. `POST /disputeMessages` → `{ authorId, authorRole, body, attachments,
   internal }`
6. `PATCH /disputes/:disputeId` → `{ updatedAt }`, plus
   `{ status: 'under_review' }` when the writer is the party being waited on
   (through `assertTransition`, §8)
7. `POST /notifications` → `dispute_message` to the other party and, when there
   is one, the assigned admin — sequentially, for the reason given under
   operation 22. An **internal** note emits nothing: telling a party that an
   internal note exists leaks half its content.

**Response** — `201 Created`, `{ message, dispute }`.

> **`internal` is a server-side rule, not a client one.** The write side must
> reject `internal: true` from anyone who is not an admin, and the read side must
> never return an internal note to a party (§6.17). The client filters twice —
> `?internal=false` in the query and again over the result before rendering — and
> **neither is access control**: under JSON Server the note is on the wire and
> visible in devtools. This is the single most important thing on the disputes
> feature for the Laravel developer to get right.

> **Laravel** — one transaction: author and role from the session, the status
> move guarded by the same machine, and the notifications dispatched from a
> model listener. Scope the thread read as
> `when(!$user->isAdmin(), fn($q) => $q->where('internal', false))`.

---

#### 24. `getOverviewStats()`

Everything the admin console's landing screen prints: six headline figures, a
weekly order series, a monthly commission series, and the category mix. A
**read**, and like operations 14 and 18 it never throws — each metric is its own
section, each failure lands in `errors`, and its field resolves to `null` so one
card can offer a retry while the other nine keep their numbers. Added by
Prompt 28.

**Mock — eight independent sections, run in parallel:**

*Money*

1. `GET /transactions?type=charge&createdAt_gte=<month start>&_page=1&_limit=100`
   → folded client-side: `gmvThisMonth = Σ |amount|`. Charge rows are signed
   negative from the buyer's perspective (§6.13), so they are summed as
   absolutes; GMV is what buyers *committed*, not what has since been released
   or refunded
2. `GET /commissions?createdAt_gte=<5 months back>&_page=1&_limit=100` → folded
   into six `YYYY-MM` buckets. `commissionRevenueThisMonth` is the **last
   bucket**, from the same rows, so the tile and the final bar cannot disagree.
   A commission is dated when escrow was released: revenue is recognised on
   settlement

*Volume and mix* — one read, two series, so the two charts are drawn from
identical rows

3. `GET /orders?createdAt_gte=<5 months back>&_page=1&_limit=100` → counted by
   the Monday of `createdAt` (eight buckets, zero-filled) and by `categoryId`
   (largest first, capped at six slices with an "Other" remainder)
4. `GET /categories?isActive=true` (cached by `categoryService`) — labels only;
   a failure costs the donut its names, not its data

*Counters* — each one row fetched, read for its `X-Total-Count`

5. `GET /orders?status=pending_payment&status=in_progress&status=delivered&status=revision_requested&status=disputed&_page=1&_limit=1`
6. `GET /users?createdAt_gte=<7 days back>&_page=1&_limit=1`
7. `GET /disputes?status=open&status=under_review&status=awaiting_buyer&status=awaiting_creator&status=escalated&_page=1&_limit=1`
8. `GET /moderationReviews?status=submitted&status=under_review&_page=1&_limit=1`
9. `GET /payouts?status=requested&_page=1&_limit=1` — `processing` is excluded
   deliberately: it is already somebody's job, and counting it would inflate a
   queue depth

**Laravel — `GET /admin/overview`**

```json
{
  "currency": "USD",
  "gmvThisMonth": 4140, "commissionRevenueThisMonth": 466,
  "activeOrders": 15, "newUsersThisWeek": 1,
  "openDisputes": 5, "moderationQueueSize": 9, "pendingSettlements": 1,
  "ordersByWeek": [{ "key": "2026-06-22", "label": "22 Jun", "orders": 4 }],
  "revenueByMonth": [{ "key": "2026-08", "label": "Aug", "amount": 466 }],
  "categoryDistribution": [{ "id": "cat_food_beverage", "name": "Food & Beverage", "value": 11 }]
}
```

Five `SELECT COUNT(*)`s, two `SUM`s, and two `GROUP BY`s — one round trip, cached
briefly for the whole team. No single permission gates it: the console's landing
screen is reachable by anyone who can reach `/admin`, and every figure on it is
an aggregate rather than a record. The 100-row page ceilings above are a **mock
limitation** (§4.1) — on a real marketplace those folds would silently truncate,
which is exactly why this is an endpoint rather than a habit.

The audit feed on the same screen (`adminService.getRecentAuditActivity`) is part
of this endpoint on the server: `GET /auditLogs?_page=1&_limit=8&_sort=createdAt&_order=desc`
plus one `GET /users?id=…` to resolve the actors, becoming an eager-loaded
relation. It is gated on `audit.view` there; the mock stack cannot enforce that
(§9.1).

---

#### 25. `getAttentionQueues({ limit = 3 })`

The three queues the console exists to keep empty, each returning its oldest
items — the people the platform has kept waiting longest. A **read**; never
throws, for the same reason as operation 24. Added by Prompt 28.

**Mock — three sections, run in parallel:**

*Disputes*

1. `GET /disputes?status=open&status=under_review&status=awaiting_buyer&status=awaiting_creator&status=escalated&_sort=createdAt&_order=asc&_page=1&_limit=3`
2. `GET /orders?id=…&_page=1&_limit=100` — the order titles, so a row reads
   "Tasting menu stills" rather than `ord_047`

*Moderation*

3. `GET /moderationReviews?status=submitted&status=under_review&_sort=submittedAt&_order=asc&_page=1&_limit=3`
   — already the order a reviewer works the queue in
4. `GET /users?id=…&_page=1&_limit=100` — the submitting creators' names

*Overdue orders*

5. `GET /orders?status=in_progress&status=revision_requested&deliveryDueAt_lte=<now>&_sort=deliveryDueAt&_order=asc&_page=1&_limit=3`
   — only the two states where a missed date means somebody is actually late. A
   `delivered` order past its date is waiting on the *buyer*; a `disputed` one is
   waiting on us

**Laravel — `GET /admin/attention?limit=3`** — three `ORDER BY … ASC LIMIT ?`
reads with their joins, returned together. Each list should be scoped to the
caller's permissions server-side (`disputes.resolve`, `moderation.review`,
`orders.manage`), returning an empty list rather than a `403` for a queue the
admin cannot work — the screen is shared, the rows are not.

---

#### 26. `claimForReview(reviewId, { actor })`

A reviewer takes a case off the queue. Added by Prompt 30.

**Mock:**

1. `GET /moderationReviews/:id` — guard `submitted → under_review`
   (`CONTENT_STATUS_MACHINE`); a case somebody else already claimed fails `409`
2. `PATCH /moderationReviews/:id` → `{ status: 'under_review', reviewerId, history }`
   (MOCK-APPEND: the whole array is re-sent, §6.20)
3. `PATCH /portfolioItems/:id` → `{ status: 'under_review' }` — **best effort**,
   so the creator's manager reads "with our team". Deliveries are not mirrored
   (see operation 27)

**Laravel** — a conditional `UPDATE … WHERE reviewer_id IS NULL`, so two
reviewers cannot claim the same case, plus the event row. `moderation.review`.

---

#### 27. `decide(reviewId, { decision, notes, reasonCode, actor })`

**The operation the whole console exists for.** `decision` is one of `approve`,
`reject`, `request_changes`, `restrict`; `notes` is required for all but the
first, and `reasonCode` (`REJECTION_REASON_CODE`) for `reject` and `restrict`.
Added by Prompt 30.

**Mock:**

1. `GET /moderationReviews/:id` + `GET /portfolioItems/:id` (or `/deliveries/:id`)
2. guard the transition — against the **case** for the three submission
   decisions, and against the **subject** for `restrict`, which acts on content
   that is already live
3. `PATCH /moderationReviews/:id` → `{ status, reviewerId, notes, reasonCode,
   reviewedAt, history }`
4. propagate to the subject — **not** best effort, because a case that says
   "approved" over content nobody can see is undetectable from the console:
   - *portfolio item* — `approve` walks `under_review → approved → published`
     and stamps `publishedAt`; `reject`/`request_changes` mirror the status and
     write `rejectionReason` (what the creator reads, Prompt 22); `restrict`
     walks `published → restricted`
   - *delivery* — **record-only.** `deliveries.status` belongs to the buyer's
     review (§6.10) and a content review never moves it: a buyer who has been
     sent work does not lose it because Trust & Safety is still reading.
     `restrict` flags each `files[]` entry `restricted: true`, which keeps the
     file out of reuse surfaces while leaving the order flow untouched
5. `POST /notifications` — `moderation_approved` / `moderation_rejected` /
   `moderation_revision` to the creator, carrying the reason label and the note
   (a restriction reuses `moderation_rejected`; there is no
   `moderation_restricted` type — 00 §9)
6. `POST /auditLogs` — `moderation.<decision>`

Steps 5 and 6 are best effort: neither a bell item nor an audit line may undo a
decision that has already been recorded.

**Laravel — `POST /moderationReviews/:id/decision`** — all six inside one
transaction, with `history` an `INSERT` into `moderation_review_events`. Gated on
`moderation.review`; `restrict` on already-published content is the case for
`content.manage`. Errors: `403` · `404` · `409` (illegal transition, or a case
decided while the reviewer was reading it) · `422` (missing reason or notes).

---

#### 28. `actionReport(reportId, { note, actor })`

A member report is upheld. For a reported **portfolio item** the content goes
into the review queue — its existing open case, or a new one opened for the
purpose (`ensureReviewForSubject`). Reported profiles and requests close here and
are acted on where they live (the account, Prompt 29; the request board,
Prompt 31). Added by Prompt 30.

**Mock:**

1. `GET /reports/:id`
2. `GET /moderationReviews?subjectType=portfolio_item&subjectId=…&_limit=1` —
   is it already in the queue?
3. `POST /moderationReviews` when it is not — `status: 'submitted'`, with a
   history entry naming the report as the reason it was opened
4. `PATCH /reports/:id` → `{ status: 'actioned', handledById, handledAt, resolutionNote }`
5. `POST /auditLogs` — `report.action` (`report.dismiss` for the other outcome)

**Laravel — `POST /reports/:id/action`** — one transaction, gated on
`reports.manage`. The upsert in steps 2–3 must be a unique-constrained
`INSERT … ON CONFLICT` rather than a read-then-write, or two admins triaging the
same content produce two cases for it.

---

#### 29. `adminCloseRequest(requestId, { reason, actor })`

BetterBlue closes a brief that the business itself has not withdrawn — a policy
breach, or a closure the buyer asked support for. `open` only; `reason` is
**required**. Added by Prompt 31.

**Mock:**

1. `GET /contentRequests/:id` — and the `open → closed` transition is asserted
   against `REQUEST_STATUS_MACHINE` before anything is written
2. `GET /proposals?requestId=…&status=submitted&status=shortlisted` — the offers
   still waiting
3. per live offer: `PATCH /proposals/:id` → `declined` **and** `POST
   /notifications` (`proposal_declined`), sequentially
4. `PATCH /contentRequests/:id` → `{ status: 'closed', closedAt, closureReason }`
5. `POST /notifications` — `request_closed` to the buyer, carrying the reason
6. `POST /auditLogs` — `request.close`,
   `meta: { fromStatus, reason, declinedProposals, buyerId }`

The buyer notification is the one thing the buyer-initiated `closeRequest` does
not send, and the reason it is a separate function: there, the buyer is the one
who clicked.

**There is no reopen.** `closed` is terminal in `REQUEST_STATUS_MACHINE` (§8),
and the console does not invent an edge for it — a business that still wants the
work posts the brief again, which is also the honest record, since every creator
who proposed the first time was told it was over.

**Laravel — `POST /admin/contentRequests/:id/close`** — one transaction, gated on
`requests.manage`, with the fan-out over the offers queued.

---

#### 30. `getAdminOrderContext(orderId)`

Everything the admin order screen renders. A **read**, and like operations 14,
17, 18, 21, 24, and 25 it never writes. Added by Prompt 31.

**Mock:** `getWithRelations` (6 calls — order, request, proposal, deliveries,
revisions, payment), then five more in parallel:

7. `GET /users?id=:buyerId&id=:creatorId` — both parties in one request
8. `GET /categories/:categoryId`
9. `GET /transactions?orderId=…` — the ledger, both sides of it
10. `GET /disputes?orderId=…` — the banner, if there is one
11. `getAdminOrderTimeline(orderId)` — operation 17 plus the internal notes

Each of the five extras fails soft into `null`/`[]`: the order is what the admin
came for, and a missing category must not blank the screen.

**Internal notes are a separate timeline function, not a flag.**
`getOrderTimeline` (operation 17) is what the buyer and the creator see, and the
safest guarantee that an internal note never reaches a party is for the function
they call to have no code path that can produce one. `getAdminOrderTimeline`
merges `auditLogs` entries with `action: 'order.note'` into it, marked
`internal: true`. A note is written by `orderService.addAdminNote` — one
`POST /auditLogs`, no notification, nothing patched on the order — because a note
is context for the next admin, not a message to anybody.

**Laravel — `GET /admin/orders/:id`** — the whole graph eager-loaded, gated on
`orders.manage`, with the internal notes serialised only for that audience.

---

#### 31. `replyToTicket(ticketId, { body, actor })` · `setTicketStatus(ticketId, { status, note, actor })`

The support console answers a ticket and moves it. Added by Prompt 31.

**Mock (reply):**

1. `GET /supportTickets/:id`
2. `PATCH /supportTickets/:id` → `{ replies: [...existing, { byId, body, at }], status: 'pending' }`
3. `POST /auditLogs` — `ticket.reply`, `meta: { status, fromStatus }`

`setTicketStatus` is the same three calls with `ticket.resolve`, `ticket.close`,
or `ticket.reopen` as the verb (extending the §6.26 vocabulary, which already
carries `ticket.reply` and `ticket.close`), appending the optional closing note
to the thread first.

MOCK-APPEND: `replies` is a whole-array read-modify-write, so two admins replying
at once lose one reply (§6.22).

**Tickets have no state machine** and deliberately so — 00 §9 defines none, a
support conversation genuinely goes back and forth, and reopening a ticket closed
too early is ordinary support work rather than an invented transition. What is
guarded is the *set*: anything outside `TICKET_STATUS` is refused.

> **HONEST LIMITATION, v1.** A reply is an **in-app admin-side record only**.
> There is no outbound email in the mock stack and members have no ticket screen
> — Prompt 11's contact form is write-only — so a reply is read by the next admin
> who opens the ticket and by nobody else. The console says this in the composer
> rather than letting somebody believe they have answered a member. Laravel
> closes it at both ends: a queued mailable to the address on the ticket, and a
> member-facing "my tickets" screen reading this same `replies` array.

**Laravel — `POST /admin/supportTickets/:id/replies`** and
`PATCH /admin/supportTickets/:id`, both gated on `support.manage`, with the reply
stored as a `ticket_replies` row rather than a JSON array.

---

#### 32. `processPayout(payoutId, { action, reason, actor })`

Finance accepts or refuses a creator's withdrawal. Added by Prompt 32, gated on
`settlements.process`.

**Mock:**

1. `GET /payouts/:id`
2. `PATCH /payouts/:id` → approve: `{ status: 'processing', processedAt }` ·
   reject: `{ status: 'rejected', processedAt, rejectedReason }`, both through
   `PAYOUT_STATUS_MACHINE`
3. `POST /notifications` — the beneficiary, `payout_processed`
4. `POST /auditLogs` — `payout.process` or `payout.reject`,
   `meta: { creatorId, amount, fromStatus, toStatus, reason? }` — the verbs the
   seed already uses, per the "extend, do not rename" rule in §6.26

**No ledger row, either way.** Approving states an intention; rejecting releases
a reservation. A rejected payout stops being subtracted from `available` simply
by leaving `requested`, so the creator's balance returns on the next read of
`getEarningsSummary` with nothing written to undo.

A rejection **requires** a reason (`validation_failed`, `details.reason`): the
creator reads it word for word on `/creator/earnings`, and an unexplained
"Rejected" chip against somebody's wages is the most alarming thing this product
could show.

**Laravel — `POST /payouts/:id/process` → `{ payout }`**

```json
{ "action": "reject", "reason": "The account name on file did not match the bank record." }
```

#### 33. `markPayoutPaid(payoutId, { actor })`

The second, separate step: finance confirms the transfer has actually gone out.
**This is the only place a `payout` ledger row is written** (§6.15,
`docs/payments.md` §5).

**Mock:**

1. `GET /payouts/:id`
2. `PATCH /payouts/:id` → `{ status: 'paid', processedAt }` (`processing → paid`)
3. `GET /transactions?userId=:creatorId` — the balance to carry forward
   (MOCK-BALANCE, §6.13)
4. `POST /transactions` — `type: 'payout'`, `userId: creatorId`,
   `amount: −payout.amount`, `payoutId`, `balanceAfter`
5. `POST /notifications` + `POST /auditLogs` — `payout.mark_paid`,
   `meta: { creatorId, amount, toStatus, transactionId }`

MOCK-TRANSFER: no bank is called and nothing outside BetterBlue is checked. The
admin is asserting that a transfer *they* made elsewhere has gone out, and the
confirmation dialog says exactly that — a prototype that implied it had moved
somebody's wages would be the wrong kind of demo.

A failure after step 2 throws `server_error` with `{ step, completed }`: the
payout is `paid` with no ledger row, which is a reconciliation a human has to
do, and swallowing it is how a balance silently stops adding up.

**Laravel — `POST /payouts/:id/paid` → `{ payout, transaction }`**, wrapped in
`DB::transaction()` with the idempotency key from §1.8 so a retried confirmation
cannot debit a balance twice.

#### 34. `getEscrowOverview()`

Every payment the platform is currently holding, with its age and its parties.

**Mock:**

1. `GET /payments?status=held&_sort=heldAt&_order=asc` — walked to exhaustion
   (see the MOCK-AGGREGATE note below)
2. `GET /orders?id=…` — batched over the page's order ids
3. `GET /disputes?orderId=…&status=…` — live cases only, so a resolved dispute
   does not flag a row
4. `GET /users?id=…` — both parties, batched

Returns the rows plus `{ heldTotal, heldCount, agingBuckets, truncated }`.
Buckets are 0–7 / 8–14 / 15–30 / over 30 days.

**Laravel — `GET /admin/escrow`**, one query with its joins and one `GROUP BY`
on the age buckets.

#### 35. `getFinanceSummary({ months = 6 })`

Five figures per calendar month: `chargeVolume`, `released`, `refunded`,
`commissionRevenue`, `payoutsPaid`.

**Mock:** three folds — `transactions` and `commissions` from the window start,
and `payouts?status=paid` — bucketed by `createdAt`, except payouts which are
dated by `processedAt` because that is when the money actually left.

`commissionRevenue` reads the **`commissions` collection**, not the ledger's
`commission` rows. They agree to the cent (one is the negation of the other), but
the ledger row is a debit against a *creator's* balance while the `commissions`
row is the platform's revenue record (`docs/payments.md` §7) — and reading the
revenue record is what makes this figure reconcile with operation 24's chart,
which reads the same collection.

**Laravel — `GET /admin/finance/summary?months=6`**, three
`GROUP BY DATE_FORMAT(…, '%Y-%m')` queries unioned.

> **MOCK-AGGREGATE — the finance folds walk pages.** These are the first reads in
> the product whose row count is not bounded by one member: a six-month ledger
> outgrows the provider's 100-row page ceiling (§4.1) on any real marketplace,
> and quietly summing the first page would print a number that is simply wrong.
> So each fold pages to exhaustion up to a 10-page cap and returns `truncated`
> when it stopped early — and every screen prints a warning band rather than a
> total it cannot stand behind.

---

### 7.3 Admin list parameters (Prompt 31)

The console's list screens call **service functions**, never a raw collection
(00 §10). Each takes the screen's vocabulary and maps it to the adapter's:

| Function | Service | Filters | Sorts |
|---|---|---|---|
| `adminListRequests` | `requestService` | `search`, `status[]`, `categoryId[]`, `createdFrom`, `createdTo` | `createdAt`, `publishedAt`, `deadline`, `budgetMax`, `proposalsCount` |
| `adminListOrders` | `orderService` | `search`, `status[]`, `paymentStatus[]`, `categoryId[]`, `createdFrom`, `createdTo` | `createdAt`, `deliveryDueAt`, `price` |
| `adminListTickets` | `supportService` | `search`, `status[]`, `createdFrom`, `createdTo` | `createdAt` |
| `adminListTransactions` | `paymentService` | `type[]`, `userId`, `orderId`, `search` (an order id), `from`, `to` | `createdAt` |
| `adminListSettlements` | `paymentService` | `status[]` | `requestedAt` |
| `adminListCommissions` | `paymentService` | `month` (`YYYY-MM`) | `createdAt` |
| `adminListQueue` | `disputeService` | `search`, `status[]`, `category[]`, `assignedAdminId`, `createdAt_gte`, `createdAt_lte` | `createdAt` (default **ascending**), `updatedAt` |

The three Prompt 32 rows join too: ledger rows carry `user` and `order`,
settlements carry `creator`, commissions carry `order`. `adminListSettlements`
defaults to **ascending** `requestedAt` — a payout queue is somebody waiting for
their own money, and the person kept waiting longest is the one to serve.

Prompt 33's `adminListQueue` joins `order`, `payment` (the `held` row, not
whichever came back first), `buyer`, `creator`, and `assignee`, and defaults to
ascending `createdAt` for the same reason settlements do: two people and their
money are frozen behind the oldest case, and a newest-first queue buries it. Its
"Unassigned" tab filters on `status: 'open'` rather than on an empty
`assignedAdminId` — `open` **is** the untriaged state, and JSON Server has no
reliable "field is empty" filter (a seeded case with the key absent and a
created one with it explicitly `null` would answer differently, §4.3).

`adminListTransactions({ search })` is an **exact order id**, not free text. The
ledger's `description` is copy the platform generated itself
(`constants/transactionTemplates.js`), so searching it finds phrasing rather than
records; the order is what a finance question is actually about.

All three take `page`, `limit`, and `order`, return the standard
`{ items, total, page, limit }`, and join their rows: requests carry `buyer`,
orders carry `buyer`/`creator`/`payment`, tickets carry `requester` (`null` for a
signed-out sender, which is normal rather than a failed join). Every join fails
soft — a row without a name still lists.

`createdFrom`/`createdTo` accept a date-only value and are widened to the day
they mean before being sent as `createdAt_gte`/`createdAt_lte`; getting that
wrong silently drops a day off either end of a filtered view.

> **MOCK-FILTER — `adminListOrders({ paymentStatus })`.** The payment status
> lives on another collection, and JSON Server cannot filter one collection by a
> field on another. So it is applied to the page that came back, **after** the
> join: `total` is the count *before* the filter and a page can legitimately look
> short. The result carries `filteredInPage: true` and the screen says this out
> loud rather than printing a count it cannot stand behind. In Laravel it is a
> join condition and the caveat disappears.

---

## 8. Status and enum reference

**`src/constants/` is the single source of truth.** The seed script imports
these same modules (`docs/data-model.md` §1), so the API, the database, and the
UI cannot drift. The values below are reproduced for a backend developer who is
implementing from this document alone — if they ever disagree with the code,
**the code wins**.

| Enum | Module | Values |
|---|---|---|
| `ROLES` | `roles.js` | `buyer` · `creator` · `admin` · `super_admin` |
| `ACCOUNT_STATUS` | `statuses.js` | `active` · `suspended` · `blacklisted` · `deactivated` |
| `REQUEST_STATUS` | `statuses.js` | `draft` · `open` · `awarded` · `completed` · `cancelled` · `closed` |
| `PROPOSAL_STATUS` | `statuses.js` | `submitted` · `shortlisted` · `accepted` · `declined` · `withdrawn` · `expired` |
| `ORDER_STATUS` | `statuses.js` | `pending_payment` · `in_progress` · `delivered` · `revision_requested` · `completed` · `cancelled` · `disputed` · `refunded` |
| `PAYMENT_STATUS` | `statuses.js` | `initiated` · `processing` · `held` · `released` · `refunded` · `partially_refunded` · `failed` |
| `TRANSACTION_TYPE` | `statuses.js` | `charge` · `release` · `refund` · `partial_refund` · `commission` · `payout` · `affiliate_commission` |
| `DELIVERY_STATUS` | `statuses.js` | `submitted` · `revision_requested` · `accepted` |
| `CONTENT_STATUS` | `statuses.js` | `draft` · `submitted` · `under_review` · `approved` · `rejected` · `revision_required` · `published` · `restricted` · `archived` |
| `DISPUTE_STATUS` | `statuses.js` | `open` · `under_review` · `awaiting_buyer` · `awaiting_creator` · `escalated` · `resolved` · `closed` |
| `DISPUTE_RESOLUTION` | `statuses.js` | `release_payment` · `full_refund` · `partial_refund` |
| `DISPUTE_CATEGORY` | `statuses.js` | `quality_issue` · `non_delivery` · `scope_mismatch` · `late_delivery` · `payment_issue` · `policy_concern` · `other` |
| `PAYOUT_STATUS` | `statuses.js` | `requested` · `processing` · `paid` · `rejected` |
| `AFFILIATE_PROFILE_STATUS` | `statuses.js` | `active` · `suspended` |
| `REFERRAL_STATUS` | `statuses.js` | `pending` · `converted` · `expired` |
| `AFFILIATE_EARNING_STATUS` | `statuses.js` | `pending` · `approved` · `paid` · `void` |
| `CONTENT_TYPE` | `statuses.js` | `photo` · `video` · `bundle` |
| `ORIENTATION` | `statuses.js` | `portrait` · `landscape` · `square` · `any` |
| `BUDGET_TYPE` | `statuses.js` | `fixed` · `range` |
| `REPORT_STATUS` | `statuses.js` | `open` · `reviewed` · `actioned` · `dismissed` |
| `TICKET_STATUS` | `statuses.js` | `open` · `pending` · `resolved` · `closed` |
| `USAGE_RIGHTS` | `statuses.js` | `organic_social` · `paid_ads` · `website` · `full_commercial` |
| `NOTIFICATION_CATEGORY` | `notificationTypes.js` | `marketplace` · `orders` · `payments` · `disputes` · `moderation` · `affiliate` · `system` |
| `REJECTION_REASON_CODE` | `policy.js` | `policy_prohibited_content` · `low_production_quality` · `mismatch_with_brief` · `ip_violation` · `metadata_incomplete` · `other` |
| `PERMISSIONS` | `permissions.js` | 16 keys — below |

**`NOTIFICATION_TYPE`** (`notificationTypes.js`) — 25 values:

```
proposal_received · proposal_shortlisted · proposal_accepted · proposal_declined
request_closed · order_paid · delivery_submitted · revision_requested
delivery_accepted · order_completed · order_cancelled · payment_released
payment_refunded · payout_requested · payout_processed · dispute_opened
dispute_message · dispute_resolved · moderation_approved · moderation_rejected
moderation_revision · account_status_changed · affiliate_conversion
affiliate_payout · system_announcement
```

`order_cancelled`, `payment_refunded`, and `payout_requested` were added in
Prompt 17: the escrow workflow ends an order three ways and only completion had
a type of its own. They carry no seeded rows — the seed predates them — and map
onto the existing `orders` and `payments` preference categories.

`request_closed` was added in Prompt 31 for operation 29: the proposers on an
administratively closed brief already had `proposal_declined`, but the **buyer**
had nothing — their brief would simply have stopped being open, with the reason
visible only to somebody who went looking. It sits in the `marketplace`
preference category, which is deliberate: this is news about their own brief, not
a platform announcement, and a buyer who has silenced marketplace notifications
still sees the status and the reason on the request itself.

**`PERMISSIONS`** (`permissions.js`) — `super_admin` implicitly holds all;
`admin` accounts carry a `permissions` array; buyers and creators hold none:

```
users.manage · admins.manage · moderation.review · content.manage
reports.manage · requests.manage · orders.manage · categories.manage
affiliates.manage · payments.manage · settlements.process · disputes.resolve
support.manage · settings.manage · announcements.send · audit.view
```

**Enum-likes owned by `scripts/seed-utils.js`** — not yet in `src/constants`
(`docs/data-model.md` §3); a later prompt should promote them. `ORIENTATION`
and `BUDGET_TYPE` took that path in Prompt 16, and `VISIBILITY` and
`MODERATION_SUBJECT` in Prompt 22; all four now live in `statuses.js` above,
with the seed re-exporting them.

| Constant | Values | Used by |
|---|---|---|
| `MEDIA_TYPE` | `image` · `video` | `portfolioItems.mediaType`, delivery files, dispute evidence |
| `REPORT_REASON` | `prohibited_content` · `intellectual_property` · `misleading_claims` · `spam` · `other` | `reports.reason` |
| `REPORT_SUBJECT` | `portfolio_item` · `creator_profile` · `request` | `reports.subjectType` |
| `ENTITY_TYPE` | `user` · `creator_profile` · `portfolio_item` · `category` · `request` · `proposal` · `order` · `delivery` · `revision` · `payment` · `payout` · `dispute` · `review` · `moderation_review` · `report` · `support_ticket` · `affiliate_profile` · `affiliate_earning` · `platform_settings` | polymorphic `entityType` on notifications and audit logs |

### 8.1 State machines

Transitions are defined in `src/constants/stateMachines.js` and enforced by
`utils/stateMachine.js#assertTransition(machine, from, to)` inside services.
**The UI never mutates a status directly.** A rejected transition is `409`
`conflict` with `details: { from, to }`.

```
REQUEST    draft → open|cancelled · open → awarded|closed|cancelled
           awarded → completed|cancelled · completed/cancelled/closed → ∅

PROPOSAL   submitted → shortlisted|accepted|declined|withdrawn|expired
           shortlisted → accepted|declined|withdrawn
           accepted/declined/withdrawn/expired → ∅

ORDER      pending_payment → in_progress|cancelled
           in_progress → delivered|disputed|cancelled
           delivered → revision_requested|completed|disputed
           revision_requested → delivered|disputed|cancelled
           disputed → completed|refunded|cancelled
           completed/cancelled/refunded → ∅

PAYMENT    initiated → processing|failed · processing → held|failed
           held → released|refunded|partially_refunded
           released/refunded/partially_refunded/failed → ∅

DELIVERY   submitted → revision_requested|accepted
           revision_requested → ∅   (the next version is a NEW record)
           accepted → ∅

CONTENT    draft → submitted|archived · submitted → under_review
           under_review → approved|rejected|revision_required
           approved → published · rejected → submitted|archived
           revision_required → submitted
           published → submitted|restricted|archived   (submitted = edit-republish)
           restricted → published|archived
           archived → ∅            (terminal — no restore in v1)

DISPUTE    open → under_review
           under_review → awaiting_buyer|awaiting_creator|escalated|resolved
           awaiting_buyer → under_review|resolved
           awaiting_creator → under_review|resolved
           escalated → resolved · resolved → closed · closed → ∅

PAYOUT     requested → processing|rejected · processing → paid
           paid/rejected → ∅
```

**Laravel must re-implement these maps server-side.** They are the difference
between a marketplace and a spreadsheet: without them a client could move a
`refunded` order back to `in_progress` and release a payment twice.

CONTENT's edges split by **who** may take them, and the API must enforce that
split even though one map describes both: the owner may take
`draft|rejected|revision_required|published → submitted` and
`draft|rejected|published|restricted → archived`, and everything else —
`under_review`, `approved`, `rejected`, `revision_required`, `published`,
`restricted` — is reachable only through the moderation endpoints (§6.5, §6.20).

Every status also has `{ label, tone, description }` in `STATUS_META`, which
powers `StatusChip` and — importantly for this contract — supplies the
`message` text for account-status errors (§2.3), so the copy is identical on
both sides of the wire.

---

## 9. Security notes

### 9.1 Frontend guards are UX only

`GuestRoute`, `ProtectedRoute`, `RoleRoute(roles)`, `PermissionGate`, and
`hasPermission()` exist to keep members out of screens that would confuse them.
**They are not access control.** Every one of them is JavaScript running on a
machine the attacker owns, reading a `user` object the attacker can edit in
devtools.

**The Laravel API must independently enforce authorization on every single
endpoint**, as if no frontend existed:

- Authenticate first (`auth:sanctum`), then reject non-`active` accounts.
- Authorize with Policies per model, not with `if` statements in controllers.
- Enforce **ownership**, not just role: "a creator" may submit a delivery; only
  **this order's** creator may submit **this** delivery.
- Return `404` rather than `403` when the caller should not know the record
  exists (§3.2).
- Filter collections by the caller. `GET /orders` returns *their* orders. A
  client-supplied `buyerId` filter naming someone else is `403`, never an
  unfiltered result.

Every "Access" cell in §6 is a server requirement. The frontend mirrors it.

### 9.2 Never trust client-supplied ids

Under JSON Server the client generates ids and sends them. **Laravel must
ignore a client-supplied `id`** and generate its own — otherwise a caller can
overwrite a record or collide deliberately.

The same applies to every field that identifies an actor or an owner. These are
derived from the session and **silently discarded** if a client sends them:

`buyerId` · `creatorId` · `userId` · `reporterId` · `raisedById` ·
`requestedById` · `authorId` · `authorRole` · `reviewerId` · `actorId` ·
`actorRole` · `resolvedById` · `handledById` · `updatedById`

A buyer who can set `requestedById` on a revision can attribute their own
request to someone else. A member who can set `authorRole: 'admin'` on a dispute
message can impersonate staff in a case thread.

### 9.3 Never trust client-supplied money

Recompute **server-side, every time**, from the accepted proposal and
`platformSettings`:

| Value | Recompute from |
|---|---|
| `orders.price` | `proposals.price` of the accepted offer |
| `orders.commissionRate` | `platformSettings.commission.defaultRate` at award time |
| `orders.commissionAmount` | `round(price × commissionRate, 2)` |
| `orders.creatorEarnings` | `price − commissionAmount` |
| `payments.amount` | `orders.price` — never from the request body |
| `commissions.baseAmount` | `price − refunded` |
| `commissions.amount` | `round(baseAmount × rate, 2)` |
| `affiliateEarnings.amount` | `round(commissions.amount × affiliate.commissionRate, 2)` |
| `payouts.amount` | validated against `SUM(transactions.amount)` and `payoutMinAmount` |
| `transactions.balanceAfter` | computed in the transaction |
| `buyerProfiles.totalSpent` | recomputed from `payments` |
| `creatorProfiles.ratingAvg` / `ratingCount` / `completedOrders` | recomputed from `reviews` / `orders` |
| `contentRequests.proposalsCount` | `COUNT(proposals)` |
| `affiliateProfiles.*Earnings` | recomputed from `affiliateEarnings` |

The rule: **every derived field in `docs/data-model.md` §4 is read-only over the
API.** A `PATCH` that includes one is rejected or ignored, never applied.

### 9.4 Never serialise a secret

| Field | Rule |
|---|---|
| `users.password` | **Never** in any response. JSON Server returns it (verified) — `authService` strips it, and nothing else may call `/users` for account data. Laravel: hash it, and hide it in the API Resource so it cannot leak by accident. |
| `creatorProfiles.payoutMethod` / `payouts.method` | Owner and finance admins only. `accountMasked` only — never a full account number. |
| `disputeMessages.internal` | Admin only, **filtered server-side** (§6.17). |
| `platformSettings.commission` / `.affiliate` / `.moderation` | Admin only (§6.27). |
| Card details | Only `{ brand, last4 }` ever reaches this API. A full PAN is never sent, stored, or logged. |
| `supportTickets.name` / `.email` | Admin and the ticket's owner only. |

### 9.5 Input handling

- Validate **every** field server-side, whatever the form already checked.
  Return `422` with the `details` shape in §3.3.
- Validate enum values against §8. A status outside its enum is `422`; a legal
  value in an illegal position is `409`.
- Sanitise uploaded filenames before storing or displaying them; the client
  renders file metadata as text and never uses `dangerouslySetInnerHTML`.
- Sniff uploaded file content for its real MIME type. Never trust the client's
  `type`, and store outside the web root behind signed URLs.
- Rate-limit `POST /auth/login`, `POST /auth/register`, `POST /reports`, and
  `POST /supportTickets` — the last two are unauthenticated writes. Return
  `429` `rate_limited` with `details.retryAfterSeconds`.
- Scope `search` to the fields listed per resource. JSON Server's `q` searches
  everything, including fields a member should not be able to probe (§4.6).

### 9.6 Audit everything administrative

Every admin action writes an `auditLogs` entry in the **same transaction** as
the change (§6.26). The log is append-only at the database-user level, not just
in application code. Buyer and creator activity is not duplicated there — it
lives in its own collections.

---

## 10. Related documents

- [`prompts/00-architecture-and-rules.md`](../prompts/00-architecture-and-rules.md)
  — domain model (§8), enums and state machines (§9), API layer rules (§10),
  RBAC (§11), security (§14), migration principles (§15)
- [`docs/data-model.md`](data-model.md) — every collection, its fields and
  relations, the seed system, and the MySQL mapping for each table
- `docs/payments.md` — the escrow model and the dummy payment provider
- `docs/laravel-migration-guide.md` — the step-by-step swap from JSON Server to
  Laravel
