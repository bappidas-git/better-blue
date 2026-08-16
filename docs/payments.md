# BetterBlue — Payments & Escrow

> The money layer, end to end: how a buyer's payment is taken, held, released,
> refunded, and eventually paid out; what the dummy processor does; and exactly
> what changes when a real payment provider arrives.
>
> **Companion documents** — `docs/api-contract.md` (§6.12–§6.15 resources, §7
> composite operations), `docs/data-model.md` (record shapes),
> `prompts/00-architecture-and-rules.md` (§9 state machines, §10 services, §15
> migration).

---

## Contents

1. [The shape of the money layer](#1-the-shape-of-the-money-layer)
2. [The provider interface](#2-the-provider-interface)
3. [The dummy provider and its test cards](#3-the-dummy-provider-and-its-test-cards)
4. [The escrow lifecycle](#4-the-escrow-lifecycle)
5. [State tables](#5-state-tables)
6. [Commission policy](#6-commission-policy)
7. [The ledger and its invariants](#7-the-ledger-and-its-invariants)
8. [Earnings and payouts](#8-earnings-and-payouts)
9. [Failure handling](#9-failure-handling)
10. [Swapping in a real provider](#10-swapping-in-a-real-provider)

---

## 1. The shape of the money layer

```
  features / hooks / components
            │  only ever see payment, order, transaction records
            ▼
  src/services/paymentService.js          ← all escrow business logic
            │            │
            │            └── src/utils/money.js          (cent-safe arithmetic)
            │            └── src/constants/transactionTemplates.js (ledger copy)
            ▼
  src/services/payments/                  ← the provider boundary
      paymentProvider.js   interface + getPaymentProvider() factory
      dummyPaymentProvider.js  the prototype's processor
      index.js
            │
            ▼
      (a real processor, later — behind the same three methods)
```

Three rules hold this together, and every one of them is greppable:

| Rule | How to check it |
|---|---|
| Nothing outside `paymentService` imports a provider | `grep -rn "services/payments" src --include=*.jsx` → no matches |
| All money arithmetic goes through `utils/money.js` | `grep -rn "\* 100\|/ 100" src/services` → only `money.js` |
| One money movement = one `transactions` row | every write goes through `writeTransaction` in `paymentService` |

`DUMMY_TEST_CARDS` and `PAYMENT_FAILURE_CODE` are re-exported *from
`paymentService`* precisely so the checkout screen and the dev gallery can show
them without reaching past the boundary.

---

## 2. The provider interface

A provider implements three methods. The full JSDoc typedefs live in
`src/services/payments/paymentProvider.js`.

```js
createPayment({ amount, currency, method })  → { providerRef, status: 'processing' }
confirmPayment(providerRef)                  → { status: 'succeeded' | 'failed',
                                                 failureCode?, failureReason? }
refund(providerRef, amount?)                 → { status: 'refunded', amount }
```

Rules of the interface:

- **A charge is never settled synchronously.** `createPayment` authorises and
  returns a reference; the outcome comes from `confirmPayment`. That is how real
  processors behave, and it is what makes the `processing` payment state real
  rather than decorative.
- **A decline is not an exception.** "The bank said no" is
  `{ status: 'failed', failureCode }`. Exceptions are reserved for transport and
  configuration failures, so `paymentService` can tell the two apart.
- **The provider never sees a BetterBlue record**, and BetterBlue never stores a
  card number. `method` carries `{ brand, last4, number? }` inbound; only
  `{ brand, last4 }` is ever written to `payments.method` (contract §9.4).

### The factory

```js
const provider = await getPaymentProvider()   // reads platformSettings.paymentProvider
```

`platformSettings.paymentProvider` selects the implementation and defaults to
`'dummy'` when the key is absent — which it is in the seeded settings, so the
prototype works with no configuration at all. An unrecognised key falls back to
the dummy provider with a dev-console warning rather than failing a payment.

---

## 3. The dummy provider and its test cards

`MOCK-PAYMENT`: no money moves, and no request leaves the browser. The outcome
of a charge is decided from the card digits, after a fixed **1200 ms** delay
(`DUMMY_PROCESSING_MS`) so the pending state of a checkout is a state a reviewer
can actually see.

### Test cards

| Number | Outcome | `failureCode` |
|---|---|---|
| `4242 4242 4242 4242` | Succeeds — escrow moves to `held` | — |
| `4000 0000 0000 0002` | Declined by the bank | `card_declined` |
| `4000 0000 0000 9995` | Declined for insufficient funds | `insufficient_funds` |

### The rules behind them, in order

1. digits end `0002` → `card_declined`
2. digits end `9995` → `insufficient_funds`
3. 16 digits that pass the Luhn checksum → succeeds
4. a stored method with only a `last4` → succeeds (a masked tail is trusted; only
   a full number is checksummed)
5. anything else → `invalid_card`

The cards are exported as `DUMMY_TEST_CARDS` for the checkout screen's dev panel
and for the **Payments** tab of the design gallery (`/dev/design`), which also
runs `computeCommission` against the live settings.

Deliberate limitation: in-flight charges are held in a module-level `Map`, so a
page reload loses one. The workflow survives it — the payment simply stays
`processing`, and that stale row does not block a retry (see §5).

---

## 4. The escrow lifecycle

```
    proposal accepted                                    orderService.acceptProposal
            │                                            ├─ order created: pending_payment
            ▼                                            ├─ commissionRate frozen on the order
    ┌───────────────────┐                                └─ deliveryDays stored, no due date yet
    │  pending_payment  │
    └─────────┬─────────┘
              │  buyer pays                              paymentService.initiateOrderPayment
              │                                          ├─ provider.createPayment  → processing
              │  ┌── declined ──► payment: failed        ├─ provider.confirmPayment
              │  │                order: unchanged       ├─ payment → held  (heldAt)
              │  │                (retry allowed)        ├─ order  → in_progress (activatedAt,
              ▼  │                                       │           deliveryDueAt = now + days)
    ┌───────────────────┐                                ├─ ledger: charge (buyer, −price)
    │   BETTERBLUE      │                                └─ notify creator + buyer
    │   HOLDS THE       │   order: in_progress → delivered → revision_requested → …
    │   MONEY (held)    │   the escrow does not move while work happens
    └───┬───────────┬───┘
        │           │
        │           └──────────── dispute / cancellation ────────────┐
        │                                                            │
        │ buyer accepts the delivery                                 │
        ▼                                                            ▼
  releasePayment                                              refundPayment
  ├─ payment → released (releasedAt)              full ──► ├─ payment → refunded
  ├─ ledger: release    (creator, +base)                   ├─ ledger: refund (buyer, +amount)
  ├─ commissions row    (rate, base, fee)                  └─ caller ends the order
  ├─ ledger: commission (creator, −fee)
  ├─ notify creator                            partial ──► ├─ payment → partially_refunded
  └─ AFFILIATE-HOOK (Prompt 34)                            │   (refundedAt AND releasedAt)
        │                                                  ├─ ledger: partial_refund (buyer, +part)
        │                                                  └─ then settles the remainder exactly
        ▼                                                     as the release path does
  caller moves the order to completed
  (deliveryService.acceptDelivery / disputeService.resolveDispute)
```

**Delivering does not move money.** `deliveryService.submitDelivery` walks the
order from `in_progress` (or `revision_requested`) to `delivered` and opens the
version's Trust & Safety case, and it touches neither the payment nor the
ledger: the escrow stays exactly where it is until the buyer accepts. That is
also why the moderation outcome — auto-approved or queued, per
`platformSettings.moderation.autoApproveDeliveries` (contract §7 operation 5) —
has **no** bearing on the release. A version pulled into review is still a
version the buyer can accept, and accepting it releases the escrow; withholding
a creator's money on a content decision is a dispute or a suspension, not a
side effect of a queue.

**Who moves what.** `paymentService` moves *money* — payments, ledger rows,
commission records. The *order's* own transition is always the caller's, because
the same release settles an accepted delivery, an auto-acceptance, and a dispute
resolution, and those finish an order differently. This is why
`releasePayment` does not set `completed` and `refundPayment` does not set
`refunded`.

### Composite sequences

Each of these is one REST call under Laravel and a client-side sequence today —
the mock call sequences are `docs/api-contract.md` §7.2 operations 1–4 and 11.

| Operation | Service function | Future endpoint |
|---|---|---|
| Accept a proposal | `orderService.acceptProposal` | `POST /proposals/:id/accept` |
| Fund an order | `paymentService.initiateOrderPayment` | `POST /orders/:id/pay` |
| Release escrow | `paymentService.releasePayment` | `POST /orders/:id/release` |
| Refund | `paymentService.refundPayment` | `POST /payments/:id/refund` |
| Cancel an order | `orderService.cancelOrder` | `POST /orders/:id/cancel` |
| Request a payout | `paymentService.requestPayout` | `POST /payouts` |

---

## 5. State tables

### Payment

| From | To | Trigger |
|---|---|---|
| `initiated` | `processing` | the provider accepted the charge |
| `initiated` | `failed` | the charge could not be created |
| `processing` | `held` | the provider settled it successfully |
| `processing` | `failed` | declined — `failureReason` is stored |
| `held` | `released` | escrow settled to the creator |
| `held` | `refunded` | the whole amount went back to the buyer |
| `held` | `partially_refunded` | part went back; the rest settled in the same call |
| `released` · `refunded` · `partially_refunded` · `failed` | — | terminal |

A `partially_refunded` payment carries **both** `refundedAt` and `releasedAt`:
the split is settled in one operation, which is why the state is terminal.

A stale `processing` payment does **not** block a retry — only `held`,
`released`, `refunded`, and `partially_refunded` mean money was actually taken.
The seeded checkout scenario (`ord_001`) relies on this: it carries a failed
attempt *and* a `processing` retry, and must still be payable.

### Order (money-relevant edges only)

| Order status | Escrow | Ledger rows so far |
|---|---|---|
| `pending_payment` | nothing collected | none |
| `in_progress` · `delivered` · `revision_requested` · `disputed` | held | `charge` |
| `completed` | released | `charge`, `release`, `commission` |
| `completed` after a partial refund | partly returned, rest released | + `partial_refund` |
| `cancelled` | nothing collected, or refunded first | none, or `charge` + `refund` |
| `refunded` | returned in full | `charge`, `refund` |

### Payout

`requested → processing | rejected`, `processing → paid`. **Only a `paid` payout
writes its `payout` ledger row** — that is the moment money leaves the balance.

Prompt 32 built the desk that works this machine (`/admin/settlements`), and it
does so in **two deliberate steps**:

| Step | Service function | What moves |
|---|---|---|
| Approve | `processPayout(id, { action: 'approve' })` | status → `processing`. No money. |
| Reject | `processPayout(id, { action: 'reject', reason })` | status → `rejected`, reason stored. No money; the reservation is released by leaving `requested`. |
| Confirm sent | `markPayoutPaid(id)` | status → `paid`, **and the `payout` ledger row** |

They are two calls rather than one because they are two different facts —
"we accept this request" and "the bank has sent it" — and collapsing them would
have the platform assert the second when only the first is known. MOCK-TRANSFER:
no bank is called at any point; the admin is recording a transfer they made
elsewhere, and the confirmation copy on screen says so.

---

## 6. Commission policy

```
commissionAmount = round(baseAmount × rate, 2)
creatorEarnings  = baseAmount − commissionAmount
```

**Where the rate comes from**, in priority order:

1. `orders.commissionRate` — frozen onto the order when the proposal was
   accepted. A settings change never reprices work already agreed.
2. `platformSettings.commission.categoryOverrides[categoryId]`
3. `platformSettings.commission.defaultRate` (seeded at `0.2`)
4. `SETTINGS_FALLBACK` — used only when settings cannot be read at all, so a
   missing rate can never silently price an order at zero commission.

A per-creator negotiated rate is the documented next extension
(`CREATOR-RATE-HOOK` in `paymentService.computeCommission`, Prompt 35);
`creatorId` is already threaded through every call site so that change stays
inside one function.

### Partial-refund policy (chosen and documented)

**Commission applies only to the portion the creator keeps.**

A partial refund of `R` on a payment of `P`:

```
returned to buyer   = R
settled base        = P − R          → commissions.baseAmount
commission          = round((P − R) × rate, 2)
creator receives    = (P − R) − commission
```

BetterBlue therefore earns nothing on money it gave back. The alternative —
charging commission on the original price — would mean the platform's fee
survives a dispute the creator lost, which is not defensible to either party.
The seeded partial-refund scenario (`ord_012`, `$205` returned) is built on this
rule, so seeded and computed money agree.

### Rounding

All money arithmetic goes through `src/utils/money.js`: `round2`, `toCents`,
`fromCents`, `applyRate`, `sumMoney`, `subtractMoney`, `toAmount`. Rounding is
**half away from zero at two decimals**, matching PHP's `round($x, 2)` and
MySQL's `ROUND(x, 2)` so today's numbers survive the migration. Sums are folded
in cent space so a long ledger cannot accumulate binary error one row at a time.

`scripts/seed-utils.js#round2` is the seed's own copy (the seed runs in plain
Node and cannot resolve the `@/` alias). The two agree on every amount either
produces, and must keep agreeing.

---

## 7. The ledger and its invariants

`transactions` is append-only: no `POST` from a feature, no `PATCH`, no
`DELETE`. Rows are written only as a side effect of money moving.

**`amount` is signed from the perspective of `userId`** — money leaving is
negative, money arriving is positive.

### Rows per event

| Event | Rows written |
|---|---|
| Order funded | `charge` — buyer, `−price` |
| Escrow released | `release` — creator, `+baseAmount`; `commission` — creator, `−fee` |
| Full refund | `refund` — buyer, `+amount` |
| Partial refund | `partial_refund` — buyer, `+refunded`; then the two release rows on the remainder |
| Payout paid | `payout` — creator, `−amount`, written by `markPayoutPaid` |
| Affiliate conversion | `affiliate_commission` — referrer, `+share` (Prompt 34) |

The commission is a **debit against the creator's balance**, not a credit to a
platform account: the creator's `release` row is gross and the `commission` row
takes the fee back out, so the pair nets to `orders.creatorEarnings`. The
platform's own revenue record is the `commissions` row, which is what finance
reporting reads. This matches the seeded ledger exactly (`scripts/seed-data/finance.js`).

### Invariants

1. **One movement, one row.** Never two rows for one transfer, never one row for
   two.
2. **Descriptions come from `constants/transactionTemplates.js`.** No prose is
   written at a call site.
3. **`balanceAfter` is set only on balance-bearing types** (`release`,
   `commission`, `payout`, `affiliate_commission`) and is `null` on a buyer's
   `charge`, which settles against their card.
4. **Exactly one `commissions` row per settled order.**
5. **`commissions.baseAmount` is what actually settled** (`price − refunded`),
   not necessarily `orders.price`.

> **MOCK-BALANCE** — `balanceAfter` is derived and JSON Server derives nothing,
> so the newest balance-bearing row is read back and added to. Two concurrent
> writes would produce two rows with the same balance. Laravel computes it inside
> the transaction and treats `SUM(amount)` as the balance of record.

---

## 8. Earnings and payouts

`paymentService.getEarningsSummary(creatorId)` returns:

| Figure | Derivation |
|---|---|
| `held` | `creatorEarnings` on orders in `in_progress`/`delivered`/`revision_requested`/`disputed` — escrow, not theirs yet |
| `lifetime` | every `release` + `commission` row, netted |
| `balance` | the sum of the creator's whole ledger — the balance of record |
| `pendingPayouts` | payouts in `requested` or `processing` |
| `available` | `balance − pendingPayouts`, floored at zero |
| `paidOut` | payouts in `paid` |

`paymentService.getEarningsBreakdown(creatorId)` is the screen-shaped version of
the same money (contract §7 operation 21, Prompt 25). It returns that summary
untouched, plus one row per order that carries money, the totals under them, the
payout minimum, and twelve months of net earnings bucketed from the ledger. It
exists so that **nothing above the services layer performs money arithmetic**:
the tiles, the per-order table, and the chart on `/creator/earnings` reconcile
because they are three folds of the same reads rather than three calculations.

A row's `net` is `orders.creatorEarnings`, which is also what its `release` and
`commission` rows net to — so the table and the ledger cannot drift. A row's
escrow chip comes from the **payment**, not the order status, because a completed
order that was partially refunded is the one case where those two disagree.

`requestPayout(creatorId, { amount })` guards the amount against
`platformSettings.general.payoutMinAmount` (seeded `50`) and `available`, both
reported as `validation_failed` with `details.amount`. It snapshots the
creator's `payoutMethod` onto the payout row so a later change of bank details
cannot rewrite history, and writes **no ledger row** — money leaves the balance
only when finance marks the payout `paid`.

**The same money cannot be withdrawn twice.** A `requested` payout is subtracted
from `available` the moment the row exists, and `requestPayout` re-derives
`available` from the ledger on every call rather than trusting a figure a screen
is holding — so a second request for the amount just withdrawn is a
`validation_failed`, whether it comes from a stale tab, a double click, or a
crafted request. The earnings screen re-reads both after a successful
withdrawal, so the button it offers is disabled for the same reason the service
would have refused it.

> **SECURITY** — the balance is computed in the browser and JSON Server checks
> nothing. This is the clearest "never trust the client" case in the whole API
> (contract §9.3): Laravel must recompute the balance and the minimum
> server-side and ignore anything the client claims.

---

## 9. Failure handling

### Error codes

The contract's code set is closed (§3.2), so payment failures map onto it:

| Situation | `ApiError` | Details |
|---|---|---|
| Order not `pending_payment`, no held payment, double release | `conflict` (409) | `{ from, to }` |
| Card declined / insufficient funds | `payment_failed` (402) | `{ reason: 'card_declined' \| 'insufficient_funds' \| 'invalid_card', payment }` |
| Refund amount out of range | `validation_failed` (422) | `{ amount }` |
| Payout below minimum / above balance | `validation_failed` (422) | `{ amount, minimum }` / `{ amount, available }` |
| A party cancelling a funded order | `forbidden` (403) | — |
| Sequence broke after money moved | `server_error` | `{ step, completed }` |

A decline is **thrown**, not returned, because the target contract answers
`402 payment_failed` (§6.12): checkout branches on `error.details.reason` today
and keeps doing exactly that after the swap. The failed payment record is still
written and is attached as `details.payment`.

### Partial failure — what the mock stack cannot do

There is no transaction around a composite sequence, so writes are ordered to
fail as safely as possible:

```
provider → payment → order → ledger → notifications
```

- Before the provider settles, nothing has been written that matters.
- A failure *after* the money moved throws a deliberately loud `server_error`
  naming the step and what was already written — swallowing it is how a payment
  ends up `held` against an order that never started.
- Notifications are best-effort: a bell item must never fail a settled payment.

> **Laravel** — wrap each composite in `DB::transaction()` with
> `SELECT … FOR UPDATE` on the order, and let the database constraints do the
> real work: `orders.request_id UNIQUE` (no double accept),
> `commissions.order_id UNIQUE` (no double release), and the idempotency key
> from contract §1.8 on `POST /orders/:id/pay` (no double charge).

---

## 10. Swapping in a real provider

The point of all of the above: this is a **module and a settings value**, not a
refactor.

1. **Implement the interface.** Add
   `src/services/payments/<name>PaymentProvider.js` exporting `key`,
   `createPayment`, `confirmPayment`, and `refund` with the signatures in §2.
   A live secret key must never reach the browser (00 §14), so in production
   this module is a thin client for the backend endpoint rather than a direct
   SDK call — the interface is the same either way.
2. **Register it.** Add it to `PROVIDERS` and `PAYMENT_PROVIDER_KEY` in
   `paymentProvider.js` (there is a commented slot for exactly this).
3. **Switch it on.** Set `platformSettings.paymentProvider` to the new key from
   the admin settings screen. No deploy, no code change, and the dummy provider
   stays available for demos.
4. **Nothing else changes.** `paymentService`, every feature, every screen, and
   the whole ledger are untouched.

### Webhook notes for the Laravel backend

The browser-side flow above collapses into one endpoint per operation, and the
*outcome* of a charge should arrive from the processor, not from a client poll:

- `POST /orders/:id/pay` authorises the charge, writes the payment as
  `processing`, and returns immediately. The response is a state, not a promise.
- A **webhook** (`POST /webhooks/payments`) carries the settlement. Verify the
  signature, look the payment up by `provider_ref`, and run the "escrow held"
  transaction there: payment → `held`, order → `in_progress`, `charge` row,
  notifications.
- Webhooks are **at-least-once and out of order.** Key every handler on
  `provider_ref` + event id, make it idempotent, and ignore an event that would
  move a payment backwards through `PAYMENT_STATUS_MACHINE`.
- Refunds settle asynchronously too: a `refund.succeeded` webhook confirms what
  `POST /payments/:id/refund` began.
- The frontend does not need polling for the prototype's flows, but it must
  tolerate a payment sitting at `processing` — which is exactly the state the
  seeded data and the dummy provider already exercise.
