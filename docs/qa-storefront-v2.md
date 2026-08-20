# QA — Storefront V2 (final sweep, V2-10)

The audit-and-fix pass run across everything the Storefront V2 series changed
(V2-01…09), plus the Wallet page V2-10 built. Every row records **what was
checked**, **how**, **what was found**, and **what was done**.

**Verdict: seven findings, seven fixed.** Nothing is deferred. Six deliberate
keeps are listed in [§8](#8-deliberate-keeps) with the reason each one is
correct rather than missed.

Scope is the storefront: the public pages, the auth pages, and the V2 dialogs.
Dashboards and the admin console were spot-checked for legibility only, per the
series' standing rule.

---

## How the evidence was produced

| Method | What it means below |
|---|---|
| **grep** | Repository-wide pattern sweep. Counts are exact; exceptions are listed individually. |
| **live** | Headless Chromium (Playwright, driven from outside the repo — **no new project dependency**) against the real app on `npm run dev:all`, signed in through the real login form. |
| **DOM** | A live pass that reads the rendered text or computed styles rather than the source, so what is measured is what a visitor gets. |
| **build** | `npm run lint`, `npm run build`, `npm run smoke:api`, `npm run seed`. |
| **read** | Source read end to end for the files named. |

Live passes covered 16 public/auth routes at 360 / 768 / 1280 px, three actors
(guest, buyer, creator) across the three gated actions, and a full click-through
of the storefront in one session.

> **One class of false positive, twice.** Two signals in the first pass looked
> like defects and were not:
>
> - **Blocked outbound network.** The sandbox has no route to `picsum.photos` or
>   the Iconify API, so photos and icons fail and pages never reach network
>   idle. Every live pass below therefore aborts non-localhost requests at the
>   browser and waits on the app's own calls. Icons render blank in the
>   screenshots taken here; they are unaffected in a normal environment (the
>   same blanks appear on untouched pages such as `/pricing`).
> - **Styles read mid-transition.** Input focus measured immediately after
>   `.focus()` returns the *pre-transition* border colour. Re-read after the
>   200 ms transition, the field carries the documented `primary.main` border
>   and 3 px halo. Figures in [§5](#5-keyboard) are the settled ones.
>
> A third artefact worth naming because it looks alarming in a screenshot: a
> full-page capture does not scroll, so `whileInView` sections below the fold
> are photographed before they reveal and come out blank. Scrolled through at
> reading pace, every section resolves to `opacity: 1` — measured, not assumed
> ([§6](#6-responsive-motion-images)).

---

## 1. Naming sweep — "Requests" on the storefront

**How:** grep across `src/features/{landing,feeds,discovery,staticPages,wallet,creatorProfile,auth}`
and `src/components/navigation`, then a **DOM** pass that reads every visible text
node (accordions expanded) on all 16 public/auth routes and matches `/request/i`
— so the check is on what renders, not on identifiers.

| Check | Result |
|---|---|
| Nav labels (desktop + drawer) | Home · Feeds · Creators · How It Works · Pricing · Wallet — final |
| Footer Marketplace column | Home · Feeds · Creators · Wallet — final |
| Identifiers (`requestService`, `contentRequests`, `publicRequestBoard`, `req_…` ids) | Untouched by design — the rename is presentation-level |
| Visible copy naming the public board or the act of posting to it | **4 findings, fixed** |

**Fixed**

| Where | Was | Now |
|---|---|---|
| `landing/components/HowItWorksSection.jsx` | "Post a request" | "Post a feed" |
| `staticPages/content/howItWorks.js` (buyer journey) | "Create a content request" | "Post a feed" |
| `staticPages/content/howItWorks.js` (creator journey) | "Browse open content requests…" | "Browse the open feeds…" |
| `staticPages/content/faq.js` ×3, `content/pricing.js` ×2, `PricingPage.jsx`, `HowItWorksPage.jsx` | "publishing / publish a content request", "browse … open content requests", "What makes a good content request?" | "publishing / publish a feed", "browse … the open feeds", "What makes a good brief?" |

The line drawn, and applied consistently: **the public board and its posts are
feeds**; the record itself keeps its name in legal, policy, and dashboard-facing
prose, where "content request" is the term Terms of Service defines and the buyer
dashboard uses. See [§8](#8-deliberate-keeps).

**Legacy routes (live).** `/requests` → `/feeds`, `/requests/req_001` →
`/feeds/req_001` (page title resolves to the feed), and query strings survive:
`/requests?deal=open&sort=price_desc` → `/feeds?deal=open&sort=price_desc`.

---

## 2. Category sweep

**How:** grep for `categor` across the storefront features; **live** network
capture on 16 routes, counting any request whose path matches `/categor/i`;
**DOM** text pass for the word.

| Route | Category fetches before | After |
|---|---|---|
| `/`, `/feeds`, `/feeds/:id`, `/creators`, `/wallet`, `/how-it-works`, `/pricing`, `/faq`, `/about`, `/contact`, `/content-policy`, `/terms`, `/privacy`, `/login`, `/register` | 0 | 0 |
| `/creators/:creatorId` | **2** (`GET /categories?active=true`) | **0** |

**Finding — the public creator profile was still a category surface.** It fetched
the taxonomy on mount and rendered category chips under the creator's headline, a
category sub-filter over the portfolio grid, and a `Category: …` line in every
lightbox caption. V2-09 froze that page except for link targets, so the storefront's
last categories lived there.

**Fixed** (public surface only — the `categories` collection, the admin console,
and every dashboard form are untouched):

- `creatorProfile/pages/CreatorProfilePage.jsx` — dropped the `categoryService`
  query and the id→name map; the page is down from four independent requests to three.
- `creatorProfile/components/ProfileHeader.jsx` — category chips removed.
- `creatorProfile/components/PortfolioGallery.jsx` — category sub-filter, its
  options memo, and the caption's category line removed; the two-stage filter
  collapses to one pass over content type.
- `creatorProfile/components/PortfolioFilterBar.jsx` — now a single chip row.
- `creatorProfile/utils/portfolioFilters.js` — `buildCategoryOptions` and
  `CATEGORY_FILTER_THRESHOLD` deleted (nothing else imported them);
  `filterPortfolioItems` narrowed to content type.

Content-type chips ("Photo / Video / Photo + Video Bundle") stay: they are a
`CONTENT_TYPE` enum, not the taxonomy.

---

## 3. Theme consistency

**How:** **grep** for hex literals outside `src/theme`, `src/styles`, and the
documented mirror in `src/constants/images.js`; **live** screenshots of every
public and auth page plus all four V2 dialogs; **read** of the MUI override sweep.

| Check | Result |
|---|---|
| Hex outside the token files | 2 matches, both legitimate: `#000` inside a `mask-image` (an alpha stop, not a colour) in `WorksSlider`, and the dev-only `TokensGallery` captions that quote the token values as text |
| Public pages, auth pages | Dark tokens throughout; no light surface anywhere |
| `RoleGateDialog` (guest/buyer/creator) | Elevated surface, glass border, blurred scrim |
| `SendMessageDialog` | Same, plus the documented field treatment |
| `PromoteCreatorDialog` (both states) | Same; link well on `primary.surface` with `primary.light` text |
| Delete-reply confirm | Same; `error.main` destructive button with ink label |
| Glow discipline | One `AmbientGlow` per viewport at rest, none behind body copy — including the new Wallet hero |
| Focus ring | `rgb(192, 132, 252)` = `primary.light`, 2 px solid, on every control sampled |
| Inputs on focus | `border-color: rgb(168, 85, 247)` (`primary.main`) + `0 0 0 3px rgba(168,85,247,0.22)` — matches `theme-v2.md` §10 |

Logged-in shells were spot-checked (buyer and creator dashboards reached through
the real login): legible, nothing broken, nothing changed.

---

## 4. Gating matrix (live, re-run)

Each cell is what actually happened when the control was pressed as that actor.

| Action | Guest | Buyer | Creator |
|---|---|---|---|
| **Reply** on a feed | RoleGate — "Creators only" | RoleGate — "Creators only" | Composer available |
| **Send message** on a creator | RoleGate — "Buyers only" | `SendMessageDialog` | RoleGate — "Buyers only" |
| **Promote** a creator | RoleGate — "Buyers only" | Promote dialog | RoleGate — "Buyers only" |

**Promote, by enrolment** (buyer actor): not enrolled → "Join the affiliate
program…" with a route into `/buyer/affiliate`; enrolled → the member's own
`/r/{CODE}?creator={id}` link, copy button, and three share targets. The enrolled
state was exercised by flipping a seeded affiliate profile to `active` through
the API for the duration of the run; `npm run seed` afterwards restored it, and
`server/db.json` is byte-identical to a fresh seed.

**Round-trips**

| Journey | Result |
|---|---|
| Role gate → "Register as Creator" | `/register?role=creator`, form opens on its details step with the creator field (`displayName`) |
| Wallet CTA → "Register as a Buyer" | `/register?role=buyer`, details step with the buyer field (`companyName`) |
| Gate → "Log in" → sign in | Returns to `/creators`, the page the gate was raised on |
| Login as buyer / creator | Lands on `/buyer` / `/creator` |
| Creator deletes own reply | Confirm dialog names the buyer and the consequence; Cancel leaves the thread intact |

Console was clean for all three actors across their whole journey.

---

## 5. Keyboard

| Surface | Result |
|---|---|
| Feeds filter bar | Chips take tab stops in visual order with the purple ring; Enter applies and syncs the URL (`?filter=replies`) |
| Price sort | Opens and selects from the keyboard (`&price=low`) |
| Works slider (creator cards) | **Finding — fixed**, below |
| Dialogs | Focus moves into the modal container on open, Tab stays trapped, Escape closes, focus returns to the trigger; the rest of the app is `aria-hidden` while open |
| Mobile drawer (360 px) | Same four properties; returns focus to the menu button |
| Reply composer | Focus carries the documented halo; Tab from the field reaches "Send reply" |

**Finding — the works slider dropped keyboard focus at the end of the strip.**
Its arrows were genuinely `disabled` at the ends, so pressing "Show more work" until the
strip ran out disabled the button under the caret; the browser blurred it and
focus fell to `<body>`, sending the next Tab back to the top of the page.

**Fixed** in `components/data-display/WorksSlider.jsx`: the arrows now carry
`aria-disabled` and an inert handler instead of `disabled`. The unavailable state
is still announced and still dimmed, the tab stop survives, and the caret stays
where the reader put it. Verified live — after eight presses the focus is still on
the arrow (`aria-disabled="true"`), and Shift+Tab moves to the strip.

---

## 6. Responsive, motion, images

**Responsive (live, 360 / 768 / 1280).** Home, Feeds, Feed details, Creators,
Wallet, How it works, Pricing: **no horizontal scroll at any width on any page**
(`documentElement.scrollWidth ≤ innerWidth` after a full scroll-through). The
feeds filter bar pins at 56 px, flush under the 57 px app bar. The works slider
hides its arrows below `md` and swipes natively (`overflow-x: auto`,
`touch-action: auto`, verified with a touch context at 360 px). The Wallet
statement becomes stacked labelled rows below `sm`.

**Reduced motion (live, `prefers-reduced-motion: reduce`).**

| Check | Result |
|---|---|
| `.bb-gradient-text` | `animation-name: none`, `background-position: 0% 50%` — a static brand gradient, not a frozen sweep |
| Any running CSS animation | None, on any page (MUI's 1 ms autofill-detection keyframe aside) |
| Reveals | Nothing in the viewport is left at `opacity: 0`, at any scroll position, under either motion setting — cards below the fold are unrevealed in both, which is what `whileInView` means |
| Hover lifts | Dropped; the glow and shadow remain |

**Images.** Every `<img>` on every public page has an `alt` attribute (0
exceptions). Content photography is `loading="lazy"` — 24 on Home, 41 on
Creators. Two deliberate non-lazy classes: the three hero cards
(`loading="eager"`, `decoding="async"`, explicit `width`/`height`, `alt=""` —
above the fold and the LCP candidate, with the caption carrying the name), and
initials avatars, which are `data:` URIs with no network request to defer.

---

## 7. Perf, console, and the build

**No fetch loops.** Request counts per route are stable and settle: Wallet 1,
Pricing 1, How it works / FAQ / legal 0, Feeds 4–5, Feed details 5, Creators 7,
Home 14 (counts double in dev — `React.StrictMode` invokes every effect twice;
`settingsService` de-duplicates its own in-flight request, which is why Wallet
shows 1 rather than 2).

**Full click-through** — home → Feeds → a feed → back → Creators → a profile →
Wallet → Pricing → How it works → FAQ → Content Policy → home: **no console
errors or warnings**, no `/categories` request, and `/platformSettings` fetched
**once** for the whole session (Wallet and Pricing share the service cache).
Back-navigation restored the feeds column from cache with zero requests.

**Infinite scroll** is stable on both columns: Feeds paged 10 → 30 over five
screens with no duplicate requests and no reset; Creators the same.

| Command | Result |
|---|---|
| `npm run lint` | **0 problems, 0 warnings** |
| `npm run build` | **Built.** Wallet ships as its own chunk (`WalletPage-*.js`). The >500 kB advisory on the shared vendor chunk is pre-existing and unchanged. |
| `npm run seed` | Regenerates cleanly; integrity checks pass |
| `npm run smoke:api` | **59/59 checks pass** — after the fix below |

**Finding — `npm run smoke:api` had been failing since V2-09.** The seed-file
tripwire asserted 27 collections; V2-09 added `directMessages` (behind Send
message) without moving it, so the run ended `✖ found 28`. **Fixed** in
`scripts/smoke-api.mjs`: the count is 28, and the comment now records both bumps.

**Seed consistency after a fresh `npm run seed`** — 65 feeds, 31 reply threads
across 11 feeds, 106 messages inside them:

| Invariant | Result |
|---|---|
| `contentRequests.repliesCount` = threads in `feedReplies` for that feed | **0 mismatches across all 65 feeds** |
| Every `feedReplies.feedId` resolves to a feed | **0 orphans** |
| Collections in `server/db.json` | 28, matching the smoke tripwire |

---

## 8. Deliberate keeps

Found, examined, and left alone — with the reason.

1. **"Start a request" on the creator profile.** The button hands off to the
   buyer dashboard's **New request** wizard. The V2 rename is presentation-level
   and stops at the dashboard door; relabelling the button "feed" would name a
   screen that says "request" one click later. The seam belongs where the
   vocabularies actually change.
2. **"content request" in Terms and Privacy.** Terms *defines* the term
   (`"Content request" — a buyer's published brief…`) and Privacy inventories
   what is stored. These name the record, which has not been renamed.
3. **"content requests" in the Content Policy.** Policy prose about what may be
   posted and what may be reported, in the same register as the rest of that
   document.
4. **"order or request reference" on Contact, and the login subtitle.** Both
   point at the dashboard, where the member sees "Requests".
5. **"…with the category, format, and context of each piece" (How it works).**
   Describes the creator's own portfolio form, which still has a category field.
   Same for Privacy's list of stored profile fields. Neither is a storefront
   browsing control; changing them would make the copy inaccurate.
6. **Light avatar tints.** Unchanged from `theme-v2.md` §8 — the seed bakes them
   into `db.json`, and a pale initials disc reads as the profile photo it stands
   in for.

---

## 9. The Wallet page (V2-10)

Built in this pass, so it is verified here rather than swept.

| Check | Result |
|---|---|
| `useDocumentTitle('Wallet')` | Tab reads "Wallet · BetterBlue" |
| Hero | Eyebrow "WALLET", `.bb-gradient-text` on the headline's second half, one `AmbientGlow` |
| Four steps | Glass panes over the hero's glow, `<ol>`, "Step n" labels matching `EscrowExplainer` |
| Worked example | $150 balance → $400 order → **$250 short → payment link** → +$300 → $450 → −$400 funded → $50 left. Every figure but the three inputs is derived in `utils/walletExample.js`; all money rendered through `formatCurrency` in the platform currency read from `settingsService` |
| Payment-link step | Highlighted row plus a "Payment link" chip, in both the table and the stacked rendering |
| Simulation note | Present under the statement: balances, links, and funding are simulated; no card is charged |
| Why a wallet | Three cards — one balance · faster checkout · one statement |
| Mini-FAQ | Three panels, all keyboard-operable (Enter), answers consistent with the escrow story on How it works and Pricing |
| CTAs | "Register as a Buyer" → `/register?role=buyer` (round-trip verified in [§4](#4-gating-matrix-live-re-run)) and "See pricing" → `/pricing` |
| Responsive | 360 / 768 / 1280 with no horizontal scroll; steps stack, the table becomes stacked rows below `sm` |
| Requests | One (`/platformSettings`), served from the service cache when arriving from Pricing |
