# Audit log coverage

> **Purpose.** Every administrative action in BetterBlue is supposed to leave a
> record. This document is the evidence: one row per admin mutation the console
> can perform, with the service function that performs it and the `AUDIT_ACTION`
> it writes. It was produced by Prompt 36's coverage sweep over the features
> Prompts 28–35 built, and is the checklist later prompts extend rather than
> re-derive.
>
> **How to keep it true.** When you add a service function that changes
> something on somebody else's behalf, add its verb to
> `src/constants/auditActions.js`, emit it, and add a row here — in the same
> change. A verb that is not in that file cannot appear in the audit explorer's
> filters, so an unrecorded action is invisible twice over.

Related: `docs/api-contract.md` §6.26 (the resource, the vocabulary, retention) ·
`src/constants/auditActions.js` (the vocabulary) ·
`src/services/auditService.js` (`log`, the only write) ·
`src/features/admin/audit/` (the explorer) ·
`docs/notifications-audit.md` (the same exercise for notifications).

---

## 1. What is audited, and what is not

The trail records **what an admin did**, not what happened. A buyer funding an
order, a creator delivering work, a proposal being accepted — those live in
their own collections with their own timestamps, and duplicating them here would
turn an accountability record into a second activity feed.

Two deliberate exceptions, both cases where a **member** writes an entry about
themselves:

| Verb | Why it is here |
|---|---|
| `user.deactivate` | Closing your own account from Settings. Support needs to see who left, when, and why (`meta.selfService = true`). |
| `dispute.open` | A dispute freezes an order and holds money. That has to be accountable whoever caused it. |

Every emit is **best-effort**: the audit write happens after the thing it
records, inside a `try`/`catch` that swallows failures. An unwritten entry must
never undo a suspension that already happened — a missing line is visible in the
log, a rolled-back mutation is not (00 §10).

---

## 2. Coverage table

Every admin mutation reachable from the console, as of Prompt 36. "Emitted by"
is the function that calls `auditService.log`.

### Accounts — Prompt 29

| Action | Emitted by | Verb |
|---|---|---|
| Suspend an account | `userService.adminSetAccountStatus` | `user.suspend` |
| Blacklist an account | `userService.adminSetAccountStatus` | `user.blacklist` |
| Reinstate an account | `userService.adminSetAccountStatus` | `user.reactivate` |
| Toggle the verified badge | `userService.adminSetCreatorVerified` | `user.verify` |
| Member closes their own account | `DangerZoneCard` / `CreatorDangerZoneCard` | `user.deactivate` |

### Content review — Prompt 30

| Action | Emitted by | Verb |
|---|---|---|
| Approve submitted content | `moderationService.decide` | `moderation.approve` |
| Request changes | `moderationService.decide` | `moderation.request_changes` |
| Reject | `moderationService.decide` | `moderation.reject` |
| Restrict | `moderationService.decide` | `moderation.restrict` |
| **Claim a case from the queue** | `moderationService.claimForReview` | `moderation.claim` ⟵ **added by the sweep** |
| **Open a case against content** | `moderationService.ensureReviewForSubject` | `moderation.open` ⟵ **added by the sweep** |
| Triage a report — reviewed | `reportService.resolveReport` | `report.review` ⟵ **corrected by the sweep** |
| Triage a report — actioned | `reportService.actionReport` | `report.action` |
| Triage a report — dismissed | `reportService.dismissReport` | `report.dismiss` |

### Marketplace operations — Prompt 31

| Action | Emitted by | Verb |
|---|---|---|
| Close a content request | `requestService.adminCloseRequest` | `request.close` |
| Cancel an order | `orderService.cancelOrder` (admin actor only) | `order.cancel` |
| Leave an internal order note | `orderService.addAdminNote` | `order.note` |
| Reply to a ticket | `supportService.replyToTicket` | `ticket.reply` |
| Change a ticket's status | `supportService.setTicketStatus` | `ticket.resolve` · `ticket.close` · `ticket.reopen` |
| Send an announcement | `notificationService.broadcastAnnouncement` | `announcement.send` |

### Money — Prompt 32

| Action | Emitted by | Verb |
|---|---|---|
| Release escrow | `paymentService.releasePayment` | `payment.release` |
| Refund (including admin intervention) | `paymentService.refundPayment` | `payment.refund` |
| Approve or reject a payout | `paymentService.processPayout` | `payout.process` · `payout.reject` |
| Mark a payout paid | `paymentService.markPayoutPaid` | `payout.mark_paid` |

`auditIfAdmin` gates all four: the same functions run for buyer- and
creator-initiated flows, and a member accepting a delivery is not an
administrative action.

### Disputes — Prompt 33

| Action | Emitted by | Verb |
|---|---|---|
| Take a case | `disputeService.assign` | `dispute.assign` |
| Request information | `disputeService.requestInfo` | `dispute.request_info` |
| Escalate | `disputeService.escalate` | `dispute.escalate` |
| Resolve | `disputeService.resolve` | `dispute.resolve` |
| Close | `disputeService.close` | `dispute.close` |
| A party opens a dispute | `disputeService.open` | `dispute.open` |

### Affiliates — Prompt 34

| Action | Emitted by | Verb |
|---|---|---|
| Approve an earning | `affiliateService.approveEarning` | `affiliate.earning.approve` |
| Void an earning | `affiliateService.voidEarning` | `affiliate.earning.void` |
| Suspend / reinstate an affiliate | `affiliateService.setProfileStatus` | `affiliate.suspend` · `affiliate.reactivate` |

### Platform — Prompts 35 and 36

| Action | Emitted by | Verb |
|---|---|---|
| Save platform settings | `settingsService.saveSettings` | `settings.update` |
| Add a category | `categoryService.createCategory` | `category.create` |
| Edit a category | `categoryService.updateCategory` | `category.update` |
| Activate / deactivate a category | `categoryService.setCategoryActive` | `category.activate` · `category.deactivate` |
| Reorder categories | `categoryService.moveCategory` | `category.reorder` |
| **Create an admin** | `adminTeamService.createAdmin` | `admin.create` |
| **Change an admin's permissions** | `adminTeamService.updateAdminPermissions` | `admin.permissions.update` |
| **Suspend / reinstate an admin** | `adminTeamService.setAdminStatus` | `admin.suspend` · `admin.reactivate` |

### Seeded but not yet reachable

| Verb | Status |
|---|---|
| `creator.feature` | Editorial picks are seeded (`creatorProfiles.featured`) but no console screen toggles them. The verb stays in the vocabulary so the seeded entries render, and the screen that adds the toggle emits it. |
| `content.restrict` | Restriction of already-published work is recorded by the seed. The live path from Prompt 30 goes through the review queue and writes `moderation.restrict` against the case; a direct "restrict this published item" control would write `content.restrict`. |

---

## 3. Gaps found, and what was done about them

The sweep read every service function that takes an `actor` and checked it
against `auditService.log`. Three findings.

### 3.1 Fixed — claiming a moderation case was unrecorded

`moderationService.claimForReview` moves content into `under_review` and puts one
reviewer's name on the decision that follows. It wrote the reviewer onto the
case's own `history` array and nothing to the trail, so "who was working this,
and since when" could only be answered by opening the case. It now writes
`moderation.claim` — the mirror of `dispute.assign`, which has been audited since
Prompt 33.

### 3.2 Fixed — opening a case against published content was unrecorded

`moderationService.ensureReviewForSubject` pulls live content back into review.
Reached from `reportService.actionReport` it was *partly* covered — the report's
own `report.action` entry says a report was acted on — but the case creation
itself had no entry, and a case opened by any other path had none at all. It now
writes `moderation.open`.

### 3.3 Fixed — a "reviewed" report read as an actioned one

`reportService.resolveReport` mapped its three outcomes onto two verbs:
`dismissed` → `report.dismiss`, and *everything else* → `report.action`. So a
triage that explicitly decided **not** to act yet was recorded as one that had.
`report.review` was already in the seeded vocabulary; the mapping is now a table
of three and the explorer's filter separates them.

### 3.4 Not a gap — payment and order verbs that skip member actions

`paymentService` and `orderService` share their functions between admin and
member flows and audit only when `isAdminRole(actor.role)`. That is correct, not
a hole: a buyer accepting a delivery releases escrow, and recording it as an
administrative action would make the trail lie about who decided what.

---

## 4. How the vocabulary stays honest

Prompt 36 moved every action string into `src/constants/auditActions.js` and
refactored all eleven emitting services, the two account-closure components, and
the seed to import from it. The check that keeps it that way is a grep:

```bash
# Should return nothing but the constants file itself.
grep -rnE "action: *'[a-z_]+\.[a-z_.]+'" src/ scripts/
```

`AUDIT_NAMESPACES` is derived from that map rather than listed by hand, so
adding a verb adds it to the audit explorer's namespace filter with no second
edit — and `docs/api-contract.md` §6.26 carries the same list for the API side.
