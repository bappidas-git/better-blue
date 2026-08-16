# BetterBlue — End-to-End Walkthrough & Release Certification

> **What this is.** A scripted certification of the whole product: every
> workflow, every role, executed against a running application and recorded step
> by step. It is both the script somebody follows to demonstrate BetterBlue and
> the evidence that the release build works.
>
> **How it was executed.** Driven through a real Chromium browser against
> `npm run dev:all` on a freshly seeded database, with assertions made both on
> what the screen shows *and* on what the mock API actually persisted. Several
> browser profiles run side by side so a buyer, a creator and an admin are
> signed in simultaneously, the way the workflows really interleave.
>
> Sections in which a failure was found were fixed and **re-run in full**. The
> fixes are listed in [§13](#13-fixes-made-during-certification).

**Result: 148 of 148 steps pass**, plus a 432-cell route × role matrix with no
unexpected outcomes.

---

## Contents

| § | Section | Steps | Result |
|---|---|---|---|
| 1 | [Setup](#1-setup) | — | ✅ |
| 2 | [Public surfaces](#2-public-surfaces) | 22 | ✅ 22/22 |
| 3 | [The buyer journey](#3-the-buyer-journey) | 40 | ✅ 40/40 |
| 4 | [Disputes](#4-disputes) | 19 | ✅ 19/19 |
| 5 | [Creator finance](#5-creator-finance) | 11 | ✅ 11/11 |
| 6 | [Moderation](#6-moderation) | 10 | ✅ 10/10 |
| 7 | [Admin operations](#7-admin-operations) | 12 | ✅ 12/12 |
| 8 | [Super admin](#8-super-admin) | 13 | ✅ 13/13 |
| 9 | [Notifications](#9-notifications) | 12 | ✅ 12/12 |
| 10 | [JSON Server integration](#10-json-server-integration) | — | ✅ |
| 11 | [Route × role matrix](#11-route--role-verification-matrix) | 432 cells | ✅ |
| 12 | [Production build certification](#12-production-build-certification) | 29 | ✅ 29/29 |
| 13 | [Fixes made during certification](#13-fixes-made-during-certification) | — | 5 fixes |
| 14 | [Fresh-clone certification](#14-fresh-clone-certification) | — | ✅ |

---

## 1. Setup

```bash
npm install
npm run seed        # regenerate server/db.json from scripts/seed-data/
npm run dev:all     # web on :5173, mock API on :4000
```

**Checks**

| Check | Result |
|---|---|
| `npm run seed` completes with integrity checks passed | ✅ 26 collections, 563 KB |
| The seed is idempotent — re-running reproduces the committed `db.json` byte for byte | ✅ `git diff --stat server/db.json` empty |
| `npm run lint` | ✅ zero warnings |
| `npm run build` | ✅ 2 674 modules, 13.4 s |
| `server/db.json` is untouched by a build | ✅ |
| Both servers reachable | ✅ `:4000` `X-Total-Count: 30` · `:5173` `200` |

> **Reseeding while the API is running.** `json-server --watch` writes `db.json`
> back asynchronously, so a seed run underneath it can be clobbered by its own
> flush. Stop the API, seed, then restart — that is what the certification
> harness does between sections.

---

## 2. Public surfaces

Everything a signed-out visitor can reach. **22/22 passed.**

| # | Step | Result |
|---|---|---|
| 2.1 | Landing renders the hero | ✅ |
| 2.2 | Featured creators are live from the API, not placeholders | ✅ 4 seeded creators named on the page |
| 2.3 | The category section is live from the API | ✅ 3 seeded categories named |
| 2.4 | Marketplace statistics render real numbers | ✅ |
| 2.5 | Discovery lists creators | ✅ 12 cards |
| 2.6 | The category filter narrows results and syncs to the URL | ✅ 12 → 4 for *Food & Beverage* |
| 2.7 | The search filter applies | ✅ |
| 2.8 | A creator profile renders its identity | ✅ `cpr_ava` |
| 2.9 | …with portfolio and reviews | ✅ |
| 2.10 | The public request board lists open briefs | ✅ 9 open in seed |
| 2.11 | A public request detail renders | ✅ |
| 2.12–2.19 | `/how-it-works`, `/pricing`, `/faq`, `/about`, `/contact`, `/terms`, `/privacy`, `/content-policy` each render a heading and substantial content | ✅ 8/8 |
| 2.20 | The report-content entry is reachable from a public profile | ✅ overflow menu, "More options for this profile" |
| 2.21 | The menu offers "Report this profile" | ✅ |
| 2.22 | The report dialog opens with reasons to choose from | ✅ |

**Note.** Reporting deliberately lives behind an overflow menu rather than a
top-level button — it is a rare action and giving it a primary affordance on
every creator's storefront would read as an accusation.

---

## 3. The buyer journey

The complete commercial arc, from a stranger arriving on an affiliate link to a
published review. Run in **two browser profiles** (buyer and creator) plus a
third for the rival creator. **40/40 passed.**

### 3.1 Register through a seeded affiliate link

| # | Step | Result |
|---|---|---|
| 3.1.1 | `/r/AVA-STUDIO` stores the code and lands on `/register` | ✅ `bb.referralCode` set |
| 3.1.2 | Registration signs the new buyer straight in | ✅ → `/buyer` |
| 3.1.3 | `users` + `buyerProfiles` rows created | ✅ |
| 3.1.4 | An affiliate referral is captured as `pending` against `aff_001` | ✅ |
| 3.1.5 | The dashboard shows the first-run onboarding state | ✅ |

### 3.2 Complete the profile

| # | Step | Result |
|---|---|---|
| 3.2.1 | Profile edits persist through `buyerProfileService` | ✅ industry, website, location all stored |

### 3.3 Create a content request — wizard, draft, resume

| # | Step | Result |
|---|---|---|
| 3.3.1 | "Save as draft" persists a draft with the answers so far | ✅ `status=draft`, `quantity=12` |
| 3.3.2 | The draft is listed on `/buyer/requests` | ✅ |
| 3.3.3 | The draft resumes with every field restored | ✅ via `?draft=req_…` |
| 3.3.4 | The review step summarises the whole brief | ✅ `$1,400.00` |
| 3.3.5 | Publishing without the Content Policy acknowledgement is blocked inline | ✅ |
| 3.3.6 | …and focus moves to the field that failed, not the button | ✅ `field-policyAck` — **fixed during certification** |
| 3.3.7 | Publishing promotes the *same* record from `draft` to `open` | ✅ no duplicate created |
| 3.3.8 | The buyer lands on the request detail | ✅ |

### 3.4 Creator submits a proposal

| # | Step | Result |
|---|---|---|
| 3.4.1 | The new brief reaches the creator request board | ✅ |
| 3.4.2 | The commission preview uses the live platform rate | ✅ "You'll receive ≈ $1,000.00 after the 20% BetterBlue commission ($250.00)" |
| 3.4.3 | Sending without the deliverability acknowledgement is blocked *and focused* | ✅ `proposal-terms` — **fixed during certification** |
| 3.4.4 | The proposal persists as `submitted` at the quoted price | ✅ $1,250 |
| 3.4.5 | A second creator proposes, so comparison has something to compare | ✅ $1,250 / $1,380 |

### 3.5 Shortlist, compare, accept

| # | Step | Result |
|---|---|---|
| 3.5.1 | Both proposals reach the buyer | ✅ |
| 3.5.2 | Shortlisting persists | ✅ `status=shortlisted` |
| 3.5.3 | The compare view opens with both proposals side by side | ✅ "Comparing 2 proposals" |
| 3.5.4 | Accepting confirms with the consequence spelled out | ✅ |
| 3.5.5 | An order is created awaiting payment | ✅ `pending_payment`, $1,250 |
| 3.5.6 | The request is marked `awarded` | ✅ |
| 3.5.7 | The accepted proposal is marked `accepted` | ✅ |

> Comparison is offered only once at least two live proposals exist — with one
> proposal there is nothing to compare, and the control is correctly absent.

### 3.6 Checkout — declined card, then escrow

| # | Step | Result |
|---|---|---|
| 3.6.1 | A declined card (`4000 0000 0000 0002`) is explained, not swallowed | ✅ "Your card was declined" |
| 3.6.2 | The order stays `pending_payment` after a decline | ✅ |
| 3.6.3 | The failed payment is recorded as `failed` | ✅ |
| 3.6.4 | A successful retry (`4242 4242 4242 4242`) moves escrow to `held` | ✅ $1,250 held |
| 3.6.5 | The order becomes `in_progress` | ✅ |
| 3.6.6 | Exactly one `charge` row lands in the ledger | ✅ |
| 3.6.7 | The buyer sees a receipt / success state | ✅ |

### 3.7 Creator delivers

| # | Step | Result |
|---|---|---|
| 3.7.1 | A delivery record is created with both attached files | ✅ `version=1`, 2 files |
| 3.7.2 | The order moves to `delivered` | ✅ |
| 3.7.3 | The buyer is notified of the delivery | ✅ |

### 3.8 Revision round

| # | Step | Result |
|---|---|---|
| 3.8.1 | The order moves to `revision_requested` | ✅ |
| 3.8.2 | A revision record stores the buyer's note | ✅ |
| 3.8.3 | The revision counter increments | ✅ `revisionsUsed=1` |
| 3.8.4 | The creator sees the change request | ✅ |
| 3.8.5 | A version-2 delivery is recorded | ✅ `v1:revision_requested, v2:submitted` |
| 3.8.6 | The order returns to `delivered` | ✅ |

### 3.9 Accept — release, commission, review, affiliate conversion

| # | Step | Result |
|---|---|---|
| 3.9.1 | The order completes | ✅ `completed` |
| 3.9.2 | The payment is released | ✅ `released` |
| 3.9.3 | The ledger holds exactly charge + release + commission | ✅ `{charge:1, release:1, commission:1}` |
| 3.9.4 | release − commission = the creator's earnings | ✅ `1250 − 250 = 1000` |
| 3.9.5 | The completed order invites a review | ✅ |
| 3.9.6 | The review is stored against the order | ✅ 5 stars |
| 3.9.7 | The creator's public aggregate updates | ✅ `ratingCount 7 → 8` |
| 3.9.8 | The new review shows on the public profile | ✅ |
| 3.9.9 | The affiliate referral converts on the first completed order | ✅ `converted`, linked to the order |
| 3.9.10 | An affiliate earning is booked | ✅ `$25.00 pending` |

---

## 4. Disputes

A second seeded order taken through the whole case lifecycle across three
signed-in roles. **19/19 passed.**

| # | Step | Result |
|---|---|---|
| 4.1 | The buyer can open a dispute from the order's overflow menu | ✅ "Report an issue" |
| 4.2 | A dispute record is opened against the order | ✅ `status=open` |
| 4.3 | The order moves to `disputed` | ✅ |
| 4.4 | The buyer's opening statement is stored on the dispute | ✅ on `description`, not as a message |
| 4.5 | The creator sees the dispute and the buyer's statement | ✅ |
| 4.6 | The creator's reply is recorded on the thread | ✅ |
| 4.7 | The dispute reaches the admin queue | ✅ |
| 4.8 | The admin sees both sides of the thread | ✅ |
| 4.9 | Assigning puts the case `under_review` with an owner | ✅ `usr_admin_maya` |
| 4.10 | Requesting information moves it to an awaiting state | ✅ `awaiting_buyer` |
| 4.11 | The decision is previewed with both sides of the money before it is binding | ✅ "Commission is charged only on the $826.00 retained — $165.20 at 20%" |
| 4.12 | The dispute resolves with a recorded resolution | ✅ `resolved` / `partial_refund` |
| 4.13 | The order leaves `disputed` | ✅ `completed` |
| 4.14 | The payment records the partial refund | ✅ `partially_refunded`, `refundedAmount=354` |
| 4.15 | The ledger gains refund + release + commission rows | ✅ `partial_refund:354, release:826, commission:−165.20` |
| 4.16 | Refund + release equals the amount that was held | ✅ `354 + 826 = 1180` |
| 4.17 | Commission is charged only on what the creator kept | ✅ `165.20 = 826 × 0.20` |
| 4.18 | The buyer sees the decision **and the reasoning** on their copy | ✅ |
| 4.19 | The creator sees the same decision and reasoning | ✅ |

> **This section found the most serious defect in the certification** — see
> [§13.1](#131-a-dispute-resolution-could-move-the-money-and-then-fail).

---

## 5. Creator finance

**11/11 passed.**

| # | Step | Result |
|---|---|---|
| 5.1 | The earnings screen reconciles with the ledger | ✅ screen $2,153.60 + $600 in flight = ledger $2,753.60 |
| 5.2 | Escrow, paid-out and lifetime totals are all present | ✅ |
| 5.3 | A withdrawal is recorded as a `requested` payout | ✅ $300 |
| 5.4 | The request reaches the admin settlements queue | ✅ |
| 5.5 | Approving moves the payout to `processing` | ✅ |
| 5.6 | A processing payout offers the "mark paid" step | ✅ |
| 5.7 | Confirming the transfer is a deliberate second step | ✅ |
| 5.8 | The payout settles as `paid` | ✅ |
| 5.9 | A `payout` row debits the creator ledger | ✅ `−300` |
| 5.10 | The creator sees the settled payout | ✅ |
| 5.11 | The creator is notified about it | ✅ `payout_processed` |

> Note the deliberate two-step settlement: "we accept this request" and "the bank
> has sent it" are different facts, and only the second writes a ledger row.
>
> Note also that the demo `admin@betterblue.test` does **not** hold
> `settlements.process` — this section runs as the super admin, and the
> permission refusal for the plain admin is verified in §7.

---

## 6. Moderation

**10/10 passed.**

| # | Step | Result |
|---|---|---|
| 6.1 | Two portfolio items are submitted for review | ✅ |
| 6.2 | Each submission creates a moderation review | ✅ |
| 6.3 | A submission must be claimed before it can be decided | ✅ "Claim for review" precedes Approve/Reject |
| 6.4 | Approving publishes the item | ✅ `status=published` |
| 6.5 | The approved item is visible on the public profile | ✅ |
| 6.6 | Rejecting keeps the item off the public profile | ✅ `status=rejected` |
| 6.7 | The creator sees the rejection **and its reason** | ✅ "The uploaded file is too low-resolution…" |
| 6.8 | The deliverable spot-review queue lists work to check | ✅ |
| 6.9 | Member reports are queued for triage | ✅ 4 reports |
| 6.10 | A report opens a triage surface with an outcome to choose | ✅ |

---

## 7. Admin operations

**12/12 passed.**

| # | Step | Result |
|---|---|---|
| 7.1 | Suspension asks for a reason before it applies | ✅ |
| 7.2 | The member is suspended | ✅ `accountStatus=suspended` |
| 7.3 | The suspension is written to the audit trail | ✅ `user.suspend` |
| 7.4 | A suspended member is refused at sign-in, respectfully | ✅ "Your account is on hold — Trust & Safety is reviewing…" |
| 7.5 | The member can be reactivated | ✅ `accountStatus=active` |
| 7.6 | An admin **without** `announcements.send` is refused the screen | ✅ names the missing permission |
| 7.7 | An announcement fans out to its audience | ✅ 10 recipients, 76 → 86 notifications |
| 7.8 | A support ticket opens a reply surface | ✅ |
| 7.9 | The reply is stored on the ticket | ✅ status → `pending` |
| 7.10 | The payments overview reports charge volume and commission revenue | ✅ |
| 7.11 | The escrow monitor agrees with the payments held in the API | ✅ $13,170 |
| 7.12 | The commissions ledger is reviewable | ✅ |

---

## 8. Super admin

**13/13 passed.**

| # | Step | Result |
|---|---|---|
| 8.1 | The default commission rate is changed | ✅ 20% → 25% |
| 8.2 | A new proposal prices against the new rate **immediately** | ✅ "≈ $750.00 after the 25% BetterBlue commission ($250.00)" |
| 8.3 | The rate can be restored | ✅ back to 20% |
| 8.4 | A new category is created | ✅ *Craft & Artisan Goods* |
| 8.5 | The new category is immediately usable in a brief | ✅ appears in the wizard's category list |
| 8.6 | The affiliate feature flag can be turned off | ✅ `affiliateProgram=false` |
| 8.7 | The affiliate area stops being offered while the flag is off | ✅ |
| 8.8 | Turning the flag back on restores the area | ✅ |
| 8.9 | A limited admin is created with only the permissions granted | ✅ `["moderation.review"]` |
| 8.10 | That admin reaches the moderation queue | ✅ |
| 8.11 | Every area outside that permission is refused | ✅ `/admin/users`, `/admin/settlements`, `/admin/settings`, `/admin/audit-logs` all blocked |
| 8.12 | The sidebar only offers what the permission allows | ✅ Overview / Moderation / Notifications |
| 8.13 | The audit explorer shows this session's trail | ✅ `admin.create, settings.update, category.create, user.reactivate, user.suspend, payout.process` |

> **Two distinct refusals, by design.** Permission-gated areas say *"You do not
> have access to this area — this needs the '…' permission"*; super-admin-only
> areas say *"This area is super admin only"*. Both are guard-blocks; they read
> differently because the remedy differs.
>
> **Reminder:** these guards are UX only. See
> [`laravel-migration-guide.md` §9](laravel-migration-guide.md#step-9--authorization).

---

## 9. Notifications

**12/12 passed.**

| # | Step | Result |
|---|---|---|
| 9.1 | The top bar carries a notifications bell | ✅ labelled with the unread count |
| 9.2 | The bell opens a menu of recent notifications | ✅ |
| 9.3 | The notifications page lists the member's items | ✅ |
| 9.4 | "Mark all read" clears the unread count | ✅ 4 → 0 |
| 9.5 | Notification preferences are exposed in settings | ✅ |
| 9.6 | Every category carries its own in-app switch | ✅ 13 switches |
| 9.7 | The mandatory account category cannot be muted in the app | ✅ no in-app switch offered |
| 9.8 | Turning a category off is persisted immediately | ✅ `moderation.inApp true → false` |
| 9.9 | A sample submitted afterwards reaches the moderation queue | ✅ |
| 9.10 | The decision still lands on the record | ✅ `rejected` |
| 9.11 | …but the muted category writes **no** notification | ✅ count unchanged |
| 9.12 | The preference can be turned back on | ✅ |

> 9.8–9.11 are the real suppression test: mute a category, trigger an event that
> would normally notify, and confirm the *action* still happens while the
> *notification* does not.

---

## 10. JSON Server integration

| Check | Command | Result |
|---|---|---|
| API contract smoke | `npm run smoke:api` | ✅ **59/59 checks passed**, run 4× consecutively |
| Escrow workflow smoke | `npm run smoke:workflow` | ✅ **37/37 checks passed** on a fresh seed |
| Reseed idempotence | `npm run seed` twice | ✅ byte-identical output; `git diff` empty |
| `server/db.json` untouched by a build | `npm run build` then `git diff` | ✅ clean |
| Seed integrity validation | `node scripts/seed-db.js --check` | ✅ referential integrity, enums, money, timestamps across 26 collections |

`smoke:workflow` **writes records** by design — run `npm run seed` afterwards.
`smoke:api` cleans up after itself, but any write makes JSON Server rewrite
`db.json` without a trailing newline; `npm run seed` restores the byte.

---

## 11. Route × role verification matrix

Every path declared in `src/routes/paths.js` — with the `*_PATTERN` routes
filled from seeded ids — navigated as six personas, by hard URL entry rather
than by clicking a link, so the guards are what is actually under test.

**Personas:** `guest` (signed out) · `buyer` · `creator` · `admin`
(`admin@betterblue.test`, 10 permissions) · `limited-admin`
(`theo.almeida@betterblue.test`, `moderation.review` only) · `super_admin`.

**Legend**

| Cell | Meaning |
|---|---|
| `render` | The page rendered its own content |
| `→ /path` | The guard redirected there |
| `block (perm)` | Rendered the "you do not have access" screen naming the missing permission |
| `block (super)` | Rendered the "super admin only" screen |
| `not-found` | The 404 page |

<!-- MATRIX -->

**All 432 cells matched the expected outcome.** The patterns worth calling out:

- **Public and auth routes** render for everyone signed out. Signed-in members
  hitting `/login`, `/register` or `/forgot-password` are redirected to their own
  role home rather than shown a form they cannot use.
- **`/r/:code`** redirects to `/register` for a guest (capturing the code) and
  to the role home for anyone already signed in — a referral link cannot
  re-attribute an existing account.
- **Every dashboard subtree redirects a guest to `/login`**, remembering where
  they were going, including URLs no page exists for yet: the `/buyer/*`,
  `/creator/*` and `/admin/*` splats keep unbuilt paths behind the guard rather
  than leaking a public 404 that loses the destination.
- **Cross-role access redirects rather than dead-ends** — a creator opening a
  `/buyer/…` URL lands on `/creator` with an explanation, not on an error.
- **`/dev/design`** renders for every persona here, because this matrix runs
  against the **dev server**, where the route is mounted (`import.meta.env.DEV
  && env.enableDevPages`). It is deliberately not role-gated — it is a component
  gallery with no data in it. In a production build the route does not exist at
  all, which [§12a.2](#12a-dev-surfaces-absent-from-the-prod-flag-build) verifies
  separately.

---

## 12. Production build certification

Built with `VITE_ENABLE_DEV_PAGES=false` and served by `npm run preview`, against
the same mock API. **29/29 passed.**

### Build output summary

```
✓ 2674 modules transformed.
dist/index.html                          0.70 kB │ gzip:   0.41 kB
dist/assets/index-*.css                 24.16 kB │ gzip:   8.99 kB
dist/assets/HomePage-*.css               1.46 kB │ gzip:   0.66 kB
…
dist/assets/RequestWizardPage-*.js      39.52 kB │ gzip:  13.47 kB
dist/assets/AdminOverviewPage-*.js      43.98 kB │ gzip:  12.86 kB
dist/assets/FormDateField-*.js         108.13 kB │ gzip:  32.57 kB
dist/assets/HomePage-*.js              139.60 kB │ gzip:  53.70 kB
dist/assets/chartTheme-*.js            376.78 kB │ gzip: 104.51 kB
dist/assets/index-*.js               1,015.84 kB │ gzip: 324.20 kB
✓ built in 13.41s
```

| Metric | Value |
|---|---|
| Total `dist/` | 4.1 MB |
| JS chunks | 166 |
| CSS files | 2 |
| Entry chunk | 1,015.84 kB (324.20 kB gzip) |
| Largest lazy chunk | `chartTheme` 376.78 kB (104.51 kB gzip) — Recharts, loaded only by screens with charts |
| Build time | 13.4 s |

Vite warns that chunks exceed 500 kB. This is expected and accepted for a
prototype: the entry chunk carries React, MUI and the router, and every route is
already lazily code-split (166 chunks). Splitting the vendor bundle further is a
performance task for the production release, not a correctness issue.

### 12a. Dev surfaces absent from the prod-flag build

| # | Step | Result |
|---|---|---|
| 12a.1 | The demo-account panel is gone from the sign-in screen | ✅ |
| 12a.2 | `/dev/design` is not routed | ✅ `ERROR 404` |
| 12a.3 | The test-card panel is gone from checkout | ✅ — **fixed during certification** |
| 12a.4 | The real checkout form still renders | ✅ |

Verified in the bundle as well as on screen:

```
Demo accounts                 → 0 files
Test cards (development only) → 0 files
Design gallery                → 0 files
Password123                   → 0 files
```

The test-card *numbers* still appear in one chunk, because
`DUMMY_TEST_CARDS` is exported by the dummy payment provider — which **is** this
prototype's payment implementation, not a dev surface. It leaves with the
provider swap ([migration guide §6](laravel-migration-guide.md#step-6--the-payment-provider)).

### 12b. Environment correctness

| # | Step | Result |
|---|---|---|
| 12b.1 | The built bundle talks to `VITE_API_BASE_URL` | ✅ 18 calls to `:4000` |
| 12b.2 | The app name from env reaches the document title | ✅ "Overview · BetterBlue" |

### 12c. SPA deep links and lazy chunks

Each path entered as a **hard load** in a fresh browser context.

| Path | Renders | Chunks fetched | Console errors |
|---|---|---|---|
| `/creators/cpr_ava` | ✅ | 24 | none |
| `/requests` | ✅ | 20 | none |
| `/pricing` | ✅ | 21 | none |
| `/buyer/orders` | ✅ | 11 | none |
| `/buyer/payments` | ✅ | 14 | none |

### 12d. Responsive spot-checks at 360 px

| Flow | Horizontal overflow | Mobile bottom nav |
|---|---|---|
| Landing | ✅ 0 px | n/a (public) |
| Discovery | ✅ 0 px | n/a |
| Request board | ✅ 0 px | n/a |
| Buyer orders | ✅ 0 px | ✅ visible |
| Buyer requests | ✅ 0 px | ✅ visible |

### 12e. Keyboard-only buyer flow

| # | Step | Result |
|---|---|---|
| 12e.1 | The sign-in form is reachable by Tab alone | ✅ email → password → forgot → **Sign in** |
| 12e.2 | Enter submits the form and lands on the dashboard | ✅ |
| 12e.3 | Keyboard-focused buttons and links carry a visible focus ring | ✅ `solid 2px rgb(124, 58, 237)` on every sampled control |

Text inputs show no outline of their own — MUI draws their focus indicator on
the fieldset border. Verified visually; not a regression.

### 12f. Kill-API resilience

| # | Step | Result |
|---|---|---|
| 12f.1 | An unreachable API produces an explained error state, not a blank page | ✅ |
| 12f.2 | The error state offers a retry | ✅ |
| 12f.3 | Retrying after the API returns recovers the screen | ✅ |

---

## 13. Fixes made during certification

Five defects were found by executing this walkthrough. Each was fixed with a
minimal diff, and the section that found it was re-run in full afterwards.

### 13.1 A dispute resolution could move the money and then fail

**Severity: high.** Found in §4.

Resolving a dispute with a partial refund reliably failed halfway: the payment
was refunded, the release and commission rows were written — and then the order
stayed `disputed` and the case stayed unresolved, with the error *"The money was
moved but … did not complete. Support needs to reconcile this case by hand."*

**Root cause.** `json-server --watch` reloads whenever `db.json` changes,
including when it wrote the file itself, and for a few hundred milliseconds
during that reload the port **refuses connections**. Resolving a dispute writes
about eight records in a burst, so a later request in the same operation landed
inside that window every time. The request that died was a `GET /orders/:id` at
the start of `completeOrder`.

**Fix.** `src/services/api/apiClient.js` now retries a request that failed at the
transport layer, up to three times with a short backoff — but **only for
idempotent methods** (`GET`, `HEAD`, `OPTIONS`). A `POST` that died mid-flight
may or may not have been applied, and retrying it could write a duplicate ledger
row, which is worse than the failure it would paper over. This is exactly the
kind of provider quirk the API layer exists to absorb (00 §10); against Laravel,
which does not restart between requests, the loop never fires.

Verified by re-running the resolution on three separate seeded disputes: before
the fix, 0/3 completed; after, 3/3.

### 13.2 The request wizard's Publish did not focus the field that failed

**Severity: medium (accessibility).** Found in §3.3.

Every **Next** click focuses the first invalid field, but the final **Publish**
validated all four steps, jumped to the offending one, and left focus on the
button. A keyboard user got an inline error they had to hunt for.

**Fix.** `useRequestWizard.submit` now captures the failing field and focuses it
on the next frame, after the step swap renders.

### 13.3 The proposal dialog had the same gap

**Severity: medium (accessibility).** Found in §3.4.

The deliverability acknowledgement is bespoke state rather than a `useForm`
field, so `handleSubmit`'s focus-first-invalid never reached it. Sending without
ticking it showed a helper message and left focus on "Send proposal".

**Fix.** The checkbox got an `id`, and the handler calls `focusFieldById` — the
same pattern the other bespoke dialogs already use.

### 13.4 The test-card panel shipped in production bundles

**Severity: low.** Found in §12a.

`TestCardPanel`'s own header claimed the panel and its card numbers were
"dropped from a production bundle rather than merely hidden", but it gated on
`env.isDev` — a runtime property — so Vite could not eliminate it. The panel did
not *render* in production, but its markup and card numbers shipped.

**Fix.** Gate on `import.meta.env.DEV` directly, as its sibling
`DemoAccountsPanel` already does. This is the one sanctioned exception to
reading `import.meta.env` outside `env.js`, and it is now documented as such in
both components.

### 13.5 `npm run smoke:api` failed intermittently on a clean run

**Severity: low.** Found in §1.

The final check reads `server/db.json` from disk to prove the scratch record is
gone. lowdb persists *after* answering, so the flushing write returns roughly
60 ms before the bytes land, and reading once caught the pre-flush file — failing
a run that had actually cleaned up.

**Fix.** `checkSeedFileClean` re-reads with a bounded 3-second poll. Verified by
four consecutive clean runs at 59/59.

### Also corrected (documentation, not behaviour)

- **Error-copy defect.** `inconsistency()` builds "The money was moved but
  `<step>` did not complete", but three call sites passed a full clause,
  producing *"…but the order could not be closed out did not complete."* All
  four call sites across `disputeService` and `paymentService` now pass noun
  phrases.
- **API contract drift.** Three rows of the composite-operation table named
  functions that do not exist under those names: `disputeService.resolveDispute`
  (actually `resolve`), `affiliateService.enrollAffiliate` (actually `enroll`),
  and `requestPayout` attributed to `payoutService` (it lives on
  `paymentService`, which `payoutService` documents in a comment). The doc was
  corrected; all **48** documented composite operations now resolve to a real
  exported function.

---

## 14. Fresh-clone certification

Simulating a developer receiving this repository for the first time.

```bash
rm -rf node_modules
npm install
npm run seed
npm run dev:all
```

| Check | Result |
|---|---|
| `npm install` completes | ✅ no build scripts, no post-install downloads |
| `npm run seed` regenerates `server/db.json` | ✅ integrity checks passed |
| `npm run dev:all` starts both servers | ✅ `:5173` and `:4000` |
| `npm run lint` | ✅ zero warnings |
| `npm run build` | ✅ clean |
| `npm run smoke:api` | ✅ 59/59 |
| `npm run smoke:workflow` | ✅ 37/37 |

**Node version.** The project declares `"engines": { "node": ">=18.19.0" }`.
This certification ran on **Node 22.22.2**, which satisfies that range; every
dependency is pinned to versions verified against 18.19.0, and nothing in the
source or the scripts uses an API newer than Node 18.

### Ten-minute spot tour

The demonstration path, in order, all reachable from a fresh `npm run dev:all`:

1. **Landing** (`/`) — live creators, categories and marketplace numbers.
2. **Discovery** (`/creators`) — filter by category and content type; open a
   profile.
3. **Request board** (`/requests`) — what creators see; open a brief.
4. Sign in as **`buyer@betterblue.test`** — dashboard, then a brief with four
   proposals: shortlist, compare, and look at the accept confirmation.
5. **Checkout** a `pending_payment` order with `4000 0000 0000 0002` to see a
   decline, then `4242 4242 4242 4242` to fund escrow.
6. Sign in as **`creator@betterblue.test`** — earnings with the escrow/available
   split, the transaction ledger, and a payout request.
7. Sign in as **`admin@betterblue.test`** — the moderation queue and a live
   dispute; try `/admin/settlements` to see a permission refusal.
8. Sign in as **`super@betterblue.test`** — platform settings (change the
   commission rate and watch a proposal preview follow it), the admin team, and
   the audit log.
9. Resize to **360 px** on any of the above.

---

## Related documents

- [`README.md`](README.md) — the documentation index
- [`laravel-migration-guide.md`](laravel-migration-guide.md) — re-run this walkthrough against the Laravel backend
- [`qa-checklist.md`](qa-checklist.md) — the accessibility and quality audit this builds on
- [`payments.md`](payments.md) — the money rules asserted in §3.6, §3.9, §4 and §5
- [`api-contract.md`](api-contract.md) — the contract the smokes in §10 verify
