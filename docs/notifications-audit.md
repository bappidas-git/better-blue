# Notification emit coverage

> **Purpose.** Every workflow in BetterBlue is supposed to tell the people
> affected by it. This document is the evidence: one row per event that should
> produce a notification, with the code that emits it, who receives it, and the
> `NOTIFICATION_TYPE` it carries. It was produced by Prompt 27 (the notification
> centre) and is the checklist later prompts extend rather than re-derive.
>
> **How to keep it true.** When you add a workflow operation that changes
> something a member would want to know about, add a row here at the same time.
> When you add a `NOTIFICATION_TYPE`, add its destination to
> `src/features/notifications/notificationRoutes.js` — a dev-mode check warns in
> the console if you forget.

Related: `docs/api-contract.md` §6.19 (the notifications resource) ·
`src/constants/notificationTypes.js` (types, categories, meta) ·
`src/services/notificationService.js` (`notify`, `notifyAdmins`).

---

## 1. How an emit works

Every notification in the product is written by one function:

```js
notificationService.notify({ userId, type, title, body, entityType, entityId })
```

Three things are true of every call site, and are worth stating once rather than
per row:

1. **Workflows never fail because a notification failed.** Each service wraps the
   call in its own `notifyQuietly` helper, which swallows the error. A creator
   who was paid but not told is recoverable; a payment that was rolled back
   because a bell item could not be written is not.
2. **Preferences are enforced at emit time, not at read time.** `notify` reads
   the recipient's `users.notificationPrefs[category].inApp` and writes nothing
   at all when the category is switched off, so silenced notifications cannot
   reappear later. Two types are exempt and always delivered —
   `system_announcement` and `account_status_changed` (see
   `MANDATORY_NOTIFICATION_TYPES`), which is why the `system` preference row
   renders locked rather than as a switch that quietly does nothing.
3. **`entityType` + `entityId` are the deep link.** `getNotificationPath`
   resolves them per role. A notification with no entity (an announcement) lands
   on the reader's dashboard home.

`notifyAdmins(permission, payload)` is the fan-out variant: one notification per
active admin holding a permission. It is how a workflow raises something for the
team without knowing who is on shift.

---

## 2. Coverage table

**Status column.** ✅ emits today · 🕓 the workflow that emits it has not been
built yet, and the prompt that builds it is named · ➖ deliberately silent, with
the reason.

### Requests and proposals — `marketplace`

| Event | Emitter | Recipient(s) | Type | Status |
|---|---|---|---|---|
| Creator submits a proposal | `proposalService.submitProposal` | request's buyer | `proposal_received` | ✅ |
| Buyer shortlists a proposal | `proposalService.shortlistProposal` | proposal's creator | `proposal_shortlisted` | ✅ |
| Buyer declines one proposal | `proposalService.declineProposal` | proposal's creator | `proposal_declined` | ✅ |
| Creator withdraws a proposal | `proposalService.withdrawProposal` | request's buyer | `proposal_declined` | ✅ |
| Buyer awards the brief — the losing proposals end | `orderService.acceptProposal` | every other live creator | `proposal_declined` | ✅ |
| Buyer awards the brief — the winner | `orderService.acceptProposal` | winning creator | `proposal_accepted` | ✅ |
| Buyer closes or cancels a brief with live proposals | `requestService.endLiveProposals` (via `closeRequest` / `cancelRequest`) | every live creator | `proposal_declined` | ✅ |
| Buyer un-shortlists a proposal | — | — | — | ➖ Nothing has been decided, and "you are no longer starred" is discouraging noise about a brief still in play. |
| Buyer publishes a draft brief | — | — | — | ➖ Nobody has engaged with it yet; discovery is how creators find it. |

### Orders and deliveries — `orders`

| Event | Emitter | Recipient(s) | Type | Status |
|---|---|---|---|---|
| Buyer funds the order (escrow held) | `paymentService.initiateOrderPayment` | creator **and** buyer | `order_paid` | ✅ |
| Creator submits a delivery | `deliveryService.submitDelivery` | order's buyer | `delivery_submitted` | ✅ |
| Buyer requests a revision | `revisionService.requestRevision` | order's creator | `revision_requested` | ✅ |
| Buyer accepts a delivery | `deliveryService.acceptDelivery` | order's creator | `delivery_accepted` | ✅ |
| Order completes | `orderService.completeOrder` | order's creator | `order_completed` | ✅ |
| Order completes **without the buyer doing it** — auto-acceptance, an admin release, a dispute resolution | `orderService.completeOrder` | order's buyer | `order_completed` | ✅ **gap fixed in Prompt 27** — see §3 |
| Order cancelled (either path) | `orderService.cancelOrder` | buyer **and** creator | `order_cancelled` | ✅ |
| Delivery deadline passes with nothing submitted | — | — | — | 🕓 There is no scheduler in the mock stack. Laravel adds a scheduled job; the type to emit is `revision_requested`'s sibling and is listed as future work in §4. |

### Money — `payments`

| Event | Emitter | Recipient(s) | Type | Status |
|---|---|---|---|---|
| Escrow released to the creator | `paymentService.settleEscrow` (via `releasePayment`) | order's creator | `payment_released` | ✅ |
| Refund issued (full or partial) | `paymentService.refundPayment` | buyer **and** creator | `payment_refunded` | ✅ |
| Creator requests a payout | `paymentService.requestPayout` | requesting creator | `payout_requested` | ✅ |
| Creator's payout request reaches the finance queue | — | admins with `settlements.process` | `payout_requested` | 🕓 **Prompt 32.** Deliberately deferred rather than added here: `notifyAdmins` exists and would work, but the notification's deep link is `/admin/settlements`, which Prompt 32 builds. Emitting now would put a queue item in front of admins that opens their dashboard home. |
| Payout marked processing / paid / rejected | — | beneficiary creator | `payout_processed` | 🕓 **Prompt 32** (the admin settlements workflow). |
| Commission written | — | — | — | ➖ Internal accounting. It is visible on the creator's ledger and inside the release notification's figure. |

### Disputes — `disputes`

| Event | Emitter | Recipient(s) | Type | Status |
|---|---|---|---|---|
| Dispute opened | `disputeService.createDispute` | the other party | `dispute_opened` | ✅ |
| Dispute opened — team queue | `disputeService.createDispute` → `notifyAdmins('disputes.resolve')` | every active admin who can resolve disputes | `dispute_opened` | ✅ |
| Message posted on a dispute | `disputeService.postMessage` | the other party (internal notes excluded) | `dispute_message` | ✅ |
| Message posted — assigned reviewer | — | assigned admin | `dispute_message` | 🕓 **Prompt 33** (the admin dispute workspace, where "assigned to me" becomes a screen). |
| Dispute resolved | — | both parties | `dispute_resolved` | 🕓 **Prompt 33.** `resolveDispute` is the admin action and arrives with the console. |

### Content review — `moderation`

| Event | Emitter | Recipient(s) | Type | Status |
|---|---|---|---|---|
| Portfolio item / deliverable approved | — | submitting creator | `moderation_approved` | 🕓 **Prompt 30** (the moderation console — the decision itself does not exist yet). |
| Submission rejected | — | submitting creator | `moderation_rejected` | 🕓 **Prompt 30.** |
| Changes requested on a submission | — | submitting creator | `moderation_revision` | 🕓 **Prompt 30.** |
| Item enters the review queue | `deliveryService.openModerationCase`, `portfolioService.submitForReview` | — | — | ➖ The creator already knows: they pressed submit, and the item shows `under_review`. |

### Account and platform — `system`

| Event | Emitter | Recipient(s) | Type | Status |
|---|---|---|---|---|
| Account suspended / blacklisted / reactivated | admin (`users.manage`) | the account | `account_status_changed` | ✅ **Prompt 29** — one function, `userService.adminSetAccountStatus`, with the verb derived from the destination status (`user.suspend` / `user.blacklist` / `user.reactivate`). The reason is quoted to the member verbatim. |
| Platform announcement to an audience | — | every member in the audience | `system_announcement` | 🕓 **Prompt 34** (`notificationService.broadcastAnnouncement`). |

### Affiliate — `affiliate`

| Event | Emitter | Recipient(s) | Type | Status |
|---|---|---|---|---|
| A referral converts on a completed order | — | referring member | `affiliate_conversion` | 🕓 **Prompt 34.** The hook point is already marked `AFFILIATE-HOOK` in `paymentService.settleEscrow`. |
| Affiliate commission paid out | — | referring member | `affiliate_payout` | 🕓 **Prompt 34.** |

### Not notified, on purpose

| Event | Why not |
|---|---|
| A review is left on a completed order | There is no `NOTIFICATION_TYPE` for it, and adding one was out of scope for Prompt 27 (00 §17 — the type list is Prompt 03's). The creator sees it on their profile and their order. Worth revisiting if reviews grow a reply flow. |
| A member edits their own profile, portfolio, or brief | Telling somebody what they just did is noise. |
| A search, a page view, a filter | Not events. |

---

## 3. Gaps found, and what was done about them

The audit checked all twenty-four `NOTIFICATION_TYPE` values against every
workflow built through Prompt 26. Three findings:

### 3.1 Fixed — the buyer was never told an order finished without them

`orderService.completeOrder` notified the creator and nobody else. That reads
fine for the common path — the buyer accepted a delivery and is looking at a
confirmation screen — but the same function is reached three other ways: an
auto-acceptance running out the clock, an admin releasing escrow, and (from
Prompt 33) a dispute resolved in the creator's favour. In all three the buyer's
escrow leaves without a word.

**Change:** `completeOrder` now emits a second `order_completed` to the buyer
when `reason !== 'buyer_accepted'`. One `if`, one emit, no change to any
signature or to the happy path.

### 3.2 Deferred with a reason — payout requests do not reach the finance queue

`requestPayout` confirms to the creator and stops there. Admins with
`settlements.process` should hear about it, and `notifyAdmins` would do it in
three lines. It was **not** added, because the notification would deep-link to
`/admin/settlements`, which does not exist until Prompt 32 — the result would be
a queue item that opens the admin dashboard home. **Prompt 32 should add the
`notifyAdmins(PERMISSIONS.SETTLEMENTS_PROCESS, …)` call alongside the screen**,
and delete `paths.ADMIN_SETTLEMENTS` from `ADMIN_PENDING` in
`notificationRoutes.js` at the same time.

### 3.3 Fixed — two seeded notifications pointed at the wrong record

Not an emit gap, but the audit found it: two rows in
`scripts/seed-data/notifications.js` referenced payouts **by array index**, and
the indexes had drifted. Ava's "$1,200 sent to your bank" pointed at her $500
*rejected* request, and Liam's "$1,500 processing" pointed at one of Ava's
payouts entirely. Harmless while notifications were not clickable; wrong the
moment Prompt 27 made them so. Both now resolve through a `payoutOf(creator,
amount)` helper that cannot drift.

---

## 4. Future work

- **Scheduled emits.** Overdue deliveries, expiring proposals, and payment
  reminders all need something running on a clock. There is no scheduler in the
  mock stack; Laravel's scheduler plus a queued job is the intended home, and
  each will want its own `NOTIFICATION_TYPE`.
- **Email.** The preference screen shows an Email column, disabled, marked
  "Coming soon". `users.notificationPrefs[category].email` already exists in the
  data model and is honoured by nothing. Laravel's mail queue is the
  implementation; `notify` grows a second branch beside the in-app write.
- **Real-time delivery.** The bell polls once a minute
  (`hooks/useNotifications.js`). Laravel broadcasts on a private per-user channel
  and the hook subscribes instead — `refresh` stays as the reconnect path, and
  nothing above the hook changes.
- **Bulk read.** `markAllRead` is one `PATCH` per unread row, capped at 100 per
  call. Laravel replaces the whole loop with a single `UPDATE … WHERE user_id = ?
  AND read = 0`.
