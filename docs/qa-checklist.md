# QA Checklist — Release Hardening (Prompt 37)

The audit-and-fix pass run across the finished application (Prompts 01–36) against
`prompts/00-architecture-and-rules.md`. Every row records **what was checked**, **how**,
**what was found**, and **what was done**. Nothing is marked pass on inspection alone
where a live check was possible.

**Verdict: no unfixed criticals.** Three items are deferred with justification
([§11](#11-deferrals-and-documented-exceptions)); none of them reaches a user as a defect.

> **Colour figures here are historical.** This pass was run against the light
> palette. Storefront V2 re-themed the product dark; the current tokens and
> their measured contrast live in [`theme-v2.md`](theme-v2.md). Everything else
> in this document — forms, dialogs, keyboard journeys, 360px behaviour,
> loading/empty/error coverage — still describes the shipped app.

---

## How the evidence was produced

| Method | What it means in the tables below |
|---|---|
| **grep** | Repository-wide pattern sweep. Counts are exact; exceptions are listed individually. |
| **live** | Headless Chromium (Playwright, run from outside the repo — **no new project dependency**) driving the real app on `npm run dev:all`, signed in through the real login form as each of the four seeded roles. |
| **build** | `npm run build` output — chunk names and sizes. |
| **read** | Source read end to end for the files named. |

Live sweeps covered **84 route/role combinations**: 17 public + 14 buyer + 12 creator +
18 admin + 23 super-admin.

> **A note on one class of false positive.** `npm run api` runs json-server with
> `--delay 300`, and services orchestrate several calls per screen (00 §10). A sweep that
> navigates fast enough registers in-flight requests as `net::ERR_ABORTED` and catches
> skeletons that have not yet resolved. Every such signal in the first pass was re-checked
> with a generous wait before being recorded; the re-checks are noted where they apply.
> **Zero** of them turned out to be real.

Seed state: `npm run seed` run before and after the pass; `server/db.json` regenerates
identically apart from CRUD performed during flow verification. Seeds themselves were not
edited.

---

## 1. Forms & validation

Every form in the product, checked for the six behaviours 00 §12 requires: client rules
fire inline on **blur** and on **submit**, the **first invalid field takes focus**, the
submit **disables while pending**, **server errors surface**, **success is confirmed**,
and a **failed submit loses no data**.

Two implementation families exist and both are legitimate:

- **`useForm`** — one value per field. Focus-first-invalid, touched tracking, and pending
  state come from the hook.
- **Bespoke state** — a queue with a lifecycle rather than a set of values. The delivery
  composer uploads files one at a time so one failure does not cost the other seven; the
  withdrawal dialog checks one amount against a live balance. Both carry a comment saying
  why `useForm` does not fit. What they were missing was first-invalid focus, now fixed.

| # | Form | Impl | Blur | Submit | Focus 1st | Pending | Server err | Success | Keeps data | Result |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Login | `useForm` | ✅ | ✅ | ✅ | ✅ | ✅ inline | redirect | ✅ | pass |
| 2 | Register | `useForm` | ✅ | ✅ | ✅ | ✅ | ✅ inline | redirect | ✅ | pass |
| 3 | Forgot password | `useForm` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ panel | ✅ | pass |
| 4 | Buyer profile | `useForm` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ toast | ✅ | pass |
| 5 | Buyer password change | `useForm` | ✅ | ✅ | ✅ | ✅ | ✅ field-level | ✅ toast | ✅ | pass |
| 6 | Creator profile | `useForm` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ toast | ✅ | pass |
| 7 | Creator expertise | `useForm` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ toast | ✅ | pass |
| 8 | Payout method | `useForm` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ toast | ✅ | pass |
| 9–12 | Request wizard, steps 1–4 | `useForm` ×4 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ draft-saved | pass |
| 13 | Proposal | `useForm` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ toast | ✅ | pass |
| 14 | Checkout card | `useForm` | ✅ | ✅ | ✅ | ✅ parent | ✅ decline codes | ✅ receipt | ✅ | pass |
| 15 | Request revision | `useForm` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ toast | ✅ | pass |
| 16 | Review | `useForm` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ toast | ✅ | pass |
| 17 | Portfolio item | `useForm` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ toast | ✅ | pass |
| 18 | Contact | `useForm` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ panel | ✅ | pass |
| 19 | Delivery composer | bespoke | ✅ | ✅ | n/a — one field, already focused | ✅ + per-file | ✅ per-file retry | ✅ toast | ✅ note kept | pass |
| 20 | Raise dispute | bespoke | ✅ | ✅ | **fixed** | ✅ | ✅ | ✅ toast | ✅ | **fixed** |
| 21 | Dispute message | bespoke | ✅ | ✅ | n/a — single field | ✅ | ✅ | ✅ optimistic | ✅ | pass |
| 22 | Withdraw (creator) | bespoke | ✅ | ✅ | **fixed** | ✅ | ✅ field + alert | ✅ in-dialog panel | ✅ | **fixed** |
| 23 | Withdraw (affiliate) | bespoke | ✅ | ✅ | n/a — single field | ✅ | ✅ | ✅ toast | ✅ | pass |
| 24 | Account status / reason | `useForm` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ toast | ✅ | pass |
| 25 | Moderation decisions | `useForm` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ toast | ✅ | pass |
| 26 | Dispute resolve | bespoke | ✅ | ✅ | ✅ step gate | ✅ | ✅ | ✅ toast | ✅ | pass |
| 27 | Dispute escalate | bespoke | ✅ | ✅ | **fixed** | ✅ | ✅ | ✅ toast | ✅ | **fixed** |
| 28 | Dispute request-info | bespoke | ✅ | ✅ | **fixed** | ✅ | ✅ | ✅ toast | ✅ | **fixed** |
| 29 | Refund | bespoke | ✅ | ✅ | **fixed** | ✅ | ✅ | ✅ toast | ✅ | **fixed** |
| 30 | Announcements | bespoke | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ progress | ✅ | pass |
| 31–35 | Settings ×5 sections | `useForm` ×5 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ change summary | ✅ dirty-guard | pass |
| 36 | Categories | `useForm` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ toast | ✅ | pass |
| 37 | Create admin | `useForm` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ temp-password dialog | ✅ | pass |
| 38 | Report content | bespoke | n/a — radio + optional text | ✅ | — | ✅ | ✅ alert | ✅ toast | ✅ | pass |

### Fixes

**F1 — First invalid field takes focus in bespoke dialogs.** Five dialogs validated on
submit and revealed their inline messages, but left the cursor where it was, so on a long
dialog the message could be off-screen. Rather than convert them to `useForm` (a rewrite
their state shape does not want), `useForm`'s own focus implementation was extracted as
`focusFieldById(id)` and re-used — one implementation, two callers.
`src/hooks/useForm.js`, `RaiseDisputeDialog`, `WithdrawDialog`, `EscalateDialog`,
`RequestInfoDialog`, `RefundDialog`.

**F2 — Submit no longer goes dead on an invalid form.** *Raise dispute* and *Withdraw*
gated the submit button on validity, so an incomplete form produced a disabled button and
no explanation — and the focus behaviour in F1 was unreachable. Both now disable only for
things a person cannot argue with (a submit in flight; an attachment still uploading or
needing a retry, which the attachment chips and their `aria-live` line already explain;
no payout method, which has its own alert and an "Add one" link). An invalid form keeps
its button live so pressing it says what is wrong and jumps there — 00 §12.

---

## 2. Error handling (API killed)

Method: sign in with the API alive, then abort **every** request to `:4000` and load the
route. Each surface must show `ErrorState` (or an equivalent alert with its own retry),
the retry must actually re-attempt, and nothing may crash, blank, or spin forever.

| Route | Role | Error shown | Retry present | Retry re-attempts | Stuck skeleton | Crash |
|---|---|---|---|---|---|---|
| `/creators` | signed out | ✅ | 1 | ✅ | 0 | none |
| `/requests/req_001` | signed out | ✅ | 1 | ✅ | 0 | none |
| `/buyer` | buyer | ✅ per-section ×3 | 3 | ✅ | 0 | none |
| `/buyer/requests` | buyer | ✅ | 1 | ✅ | 0 | none |
| `/buyer/orders/ord_007` | buyer | ✅ | 1 | ✅ | 0 | none |
| `/buyer/payments` | buyer | ✅ | 1 | ✅ | 0 | none |
| `/creator` | creator | ✅ per-section ×4 | 4 | ✅ | 0 | none |
| `/creator/orders` | creator | ✅ | 1 | ✅ | 0 | none |
| `/creator/earnings` | creator | ✅ | 1 | ✅ | 0 | none |
| `/creator/portfolio` | creator | ✅ | 1 | ✅ | 0 | none |
| `/admin` | admin | ✅ per-tile ×14 | 14 | ✅ | 0 | none |
| `/admin/users` | admin | ✅ | 1 | ✅ | 0 | none |
| `/admin/disputes` | admin | ✅ | 1 | ✅ | 0 | none |
| `/admin/settings` | super admin | ✅ | 1 | ✅ | 0 | none |
| `/admin/audit-logs` | super admin | ✅ | 1 | ✅ | 0 | none |
| `/admin/payments` | super admin | ✅ | 1 | ✅ | 0 | none |
| `/admin/settlements` | super admin | ✅ | 1 | ✅ | 0 | none |
| `/admin/commissions` | super admin | ✅ ×2 sections | 2 | ✅ | 0 | none |

**19 of 19 pass. 0 crashes, 0 stuck skeletons, 0 blank screens, 0 spinners-forever.**

One route needed a second look. `/admin/payments` first showed no error text and no retry —
because `admin@betterblue.test` is a **scoped** admin without `payments.manage`, so
`PermissionGate` was correctly rendering its denial screen instead of the page. Re-run as
super admin it behaves as the table records. This doubles as evidence for the
`PermissionGate` row in [§8](#8-security-minded-frontend).

Partial failure is handled per-section, not per-page: the dashboards render the sections
that loaded and give each failed one its own message and retry, rather than replacing a
working screen with a single error.

### Standardisation check

`ErrorState` is the single error surface. `DataTable` renders it internally from its
`error` + `onRetry` props, which is why many list pages never name it directly. `Alert
severity="error"` appears 23 times and every one is a *form or dialog* server-error
banner, not a data surface — the correct use.

**401 revalidation.** `apiClient` normalises a 401 into an `ApiError`; `AuthContext`
revalidates the stored session on boot and clears it on failure, returning the person to
sign-in with their destination remembered. Suspended and blacklisted accounts are force
signed out into `AccountStatusScreen` rather than a bare redirect (00 §11). Read and
confirmed in `services/api/apiClient.js`, `context/AuthContext.jsx`, `routes/guards.jsx`.

**ErrorBoundary.** Two nets: the class boundary wrapping `<RouterProvider>` in `App.jsx`,
and `RouteErrorElement` as the router `errorElement` on all four route groups. Both render
the same screen; the stack is gated on `env.isDev` so internals never ship (00 §14).

Verified rather than assumed: a `throw` was injected into the render of three sampled page
components — `AboutPage` (public), `BuyerRequestsPage` (buyer), `AdminUsersPage` (admin) —
and each route loaded.

| Route | Caught | Screen shown | Ways out |
|---|---|---|---|
| `/about` | ✅ | "Something went wrong" | Reload · back home |
| `/buyer/requests` | ✅ | same | Reload · back home |
| `/admin/users` | ✅ | same | Reload · back home |

None reached a blank page or a React stack dump. The injections were reverted immediately
and the working tree verified clean.

**Observation, recorded rather than changed:** because `errorElement` is attached at the
route-*group* level, a failing page replaces its whole layout — the dashboard shell goes
with it — rather than only the page area. The result is still a recoverable screen with
two ways out, so nothing is lost, but per-page isolation would need `errorElement` on each
child route. That is a routing change rather than a hardening fix, so it is noted here for
Prompt 38 instead of being made now (00 §17).

---

## 3. Loading & empty states

| Surface class | Skeleton matches layout | Empty state | Actionable CTA | Flash of empty |
|---|---|---|---|---|
| Buyer/creator overviews | ✅ stat + chart + feed skeletons | ✅ first-run variant | ✅ "Post a request" / "Browse requests" | none |
| Admin overview | ✅ KPI tile skeletons | n/a — always has data | n/a | none |
| List pages (all) | ✅ `TableSkeleton` desktop / `ListSkeleton` mobile, via `DataTable` | ✅ `EmptyState` | ✅ per 00 §12 | none |
| Discovery / request board | ✅ card-shaped grid skeletons | ✅ filtered vs unfiltered copy | ✅ "Clear all filters" when filtered | none |
| Detail pages | ✅ section skeletons | n/a — a detail page has a subject | n/a | none |
| Portfolio | ✅ grid skeletons | ✅ per filter | ✅ "Add your first item" | none |
| Notifications | ✅ list skeletons | ✅ per category | ✅ | none |
| Settings / roles matrix | n/a — renders from `constants/`, no fetch | n/a | n/a | none |

Checked live at every one of the 84 route/role combinations: the loading state is a
skeleton shaped like the content that replaces it, and no route rendered an empty state
before its data arrived. Empty copy distinguishes *"nothing yet"* from *"nothing matches
these filters"* and offers the matching action.

`AdminRolesPage` has no loading or error state by design — it renders the permission matrix
from `src/constants/permissions.js` and makes no request.

---

## 4. Responsive matrix

Every route loaded at **360 / 600 / 900 / 1280 / 1536** as the role that owns it —
**420 route × width checks**.

| Check | Method | Result |
|---|---|---|
| Horizontal scroll (`scrollWidth > clientWidth`) | live, all 420 | **0 occurrences.** Nothing overflows the viewport at any width, including 360. |
| Sidebar ≥ md, bottom nav < md (00 §13) | live, all 420 | Exactly as specified: a fixed bottom nav is present on all 67 dashboard loads at 360 and 600, and absent on all of them at 900, 1280 and 1536. |
| Content clears the bottom nav | live, 134 dashboard loads at 360/600 | **0 overlaps.** `main`'s bottom padding is ≥ the bar's height on every one. |
| Tables become cards below md | live, all 420 | Every `DataTable` renders cards below md — **1** `<table>` survives, documented below. |
| Dialogs become sheets below md | live, targeted | `ResponsiveDialog` is a full-width sheet at 360 and a centred modal at 1280. |
| Touch targets ≥ 44px | live, 360 + 600, re-run after fixes | **61 distinct sub-44px targets → 2**, both links inside sentences (WCAG 2.5.8 exempt). See below. |
| Text truncates gracefully | live, all 420 | 3 clipped strings found; assessed below. |

### The one table that stays a table

`PermissionMatrix` (`/admin/roles`) uses a raw `<Table>` rather than `DataTable`, and says
why in its own comment: *"a matrix turned into cards stops being a matrix"*. It is wrapped
in a `TableContainer` with `overflowX: 'auto'`, so at 360 the grid scrolls **inside its own
container** and the page's horizontal scroll stays at 0 — which the matrix above confirms.
Correct as built; recorded here so the exception is deliberate rather than missed.

### Fixes

**F3 — Filter chips were 24px on phones across the whole admin console.**
`FilterChipGroup` applied its 44px mobile floor only when `size === 'md'`, but
`AdminListPage` — the shared toolbar behind every admin list — passes `size="sm"`. Every
admin status filter was therefore a 24px-tall tap target. The floor now applies at any
size; `size` sets desktop density only, which is a question about how tight a toolbar
looks, not about whether a finger can hit it. `src/components/inputs/FilterChipGroup.jsx`.

**F4 — The home link was a 28px target.** `Logo` sized its link box to the artwork, so the
28px mark in the mobile top bar was a 28px tap target on **67 of 84** screens. The hit area
is now 44×44; the artwork is unchanged and centred inside it.
`src/components/brand/Logo.jsx`.

**F5 — Two more sub-44 controls.** The welcome banner's dismiss button (36×36 → 44×44) and
both skip links (42px → 44px, via `minHeight` + `inline-flex`).
`WelcomeBanner.jsx`, `PublicLayout.jsx`, `layouts/dashboard/DashboardLayout.jsx`.

### Not defects

- **Inline links in sentences** ("Contact support" at 92×15) — exempt from target sizing
  under WCAG 2.5.8, which excludes links inside a block of text.
- **Hidden inputs** measured at 1×1 — the `<input type="file">` behind a label button and
  the `<input>` inside a MUI `Switch`. The visible control is the target; the input is not.
- **Clipped text ×3** — `/pricing` at 600 clips the overline "PLATFORM COMMISSION", and the
  wizard's content-type choice cards clip their one-line descriptions at 600/900. All three
  are inside deliberate `-webkit-line-clamp` containers: the text is trimmed with an
  ellipsis by design and the full value is present in the DOM and in the accessible name.
  No information is lost and no layout breaks.

---

## 5. Accessibility

| Check | Method | Result |
|---|---|---|
| One `<h1>` per page | live, 84 route/role loads | **84/84 have exactly one.** Two initially read as zero and were re-checked with a generous wait — both had their `h1`; the first pass had probed mid-load. |
| `<main>` landmark present | live, 84 | **84/84.** Also `<header>` on every page, `<nav>` on every page, `<footer>` on all public pages. |
| Heading hierarchy, no skipped levels | live, 20 representative routes | Was **9 pages with jumps** and **60 stray `<h6>`s**. Now **0 and 0** — see fixes. |
| Every input has an accessible name | live, 84 | **0 unlabelled** inputs, selects or textareas. |
| Every control has an accessible name | live, 84 | **0 nameless** buttons, links or `role="button"` elements. |
| Icon-buttons carry `aria-label` | grep, all 35 `IconButton` uses | **35/35 labelled.** |
| Images have `alt` | live, 84 + grep | **0 images without `alt`.** Decorative images correctly use `alt=""`. |
| Dialog: focus moves in, Escape closes, focus returns | live, sampled ×6 | Pass — `ResponsiveDialog` traps focus, is `aria-labelledby` its title, closes on Escape, and returns focus to its opener. |
| Keyboard journeys | live, Tab-ring walk at every step | Both completable. Buyer *register → request → accept → pay → review*: every advancing control reached by Tab (register submit at tab 2, wizard next at 4, proposal action at 3, pay at 6, accept/review at 21) with `:focus-visible` on each. Creator *propose → deliver*: browse card at 35, proposal CTA at 10, delivery composer at 1, send at 19. |
| `:focus-visible` ring | read + live | Restored on `MuiButtonBase` in the theme (MUI zeroes it) and applied through `focusRing()`; visible on sampled buttons, links, chips and inputs. |
| Live regions | grep + read | 23 sites. Toasts announce through `role="status"` (success, info) and `role="alert"` (warning, error) — implicit live regions with the right politeness per severity. Result counts on discovery and the board are `role="status" aria-live="polite"`; the upload and evidence queues announce progress and failures; the moderation, settlement and announcement screens announce batch outcomes. |
| Colour contrast (AA) | computed over the token palette | 3 token failures found and fixed in the theme — see below. |
| Reduced motion | live, `prefers-reduced-motion: reduce`, 10 routes scrolled end to end | **Nothing on screen is stuck at opacity 0 or parked off-position.** |

### Fixes

**F6 — 60 stray `<h6>` headings.** MUI maps `Typography variant="subtitle1"` and
`"subtitle2"` to `<h6>` elements. Those two variants are the app's visual subtitle — a
card's second line, a field group's caption — and all 60 uses across 29 files were landing
in the document outline as headings. Symptoms: outlines reading `h1 → h3 → h6`, and heading
jumps on 9 screens.

Fixed **once in the theme** by overriding `variantMapping` for those two variants, rather
than at 60 call sites: the rule now holds for every future use, nothing visual changes (the
type scale comes from `variant`, not the element), and anything that genuinely is a heading
still says so with an explicit `component`, which wins over the mapping.
`src/theme/components.js`.

**F7 — Six `h1 → h3` jumps on list screens.** Card and filter headings sat at `h3` with no
`h2` between them and the page title. Region headings were added where a region existed
without one — `Filters`, `Creators`, `Open requests`, `Your requests`, `Portfolio items` —
all visually hidden, because the toolbar and count line already say this on screen. Cards
were left at `h3` deliberately: `CreatorCard` appears on three different screens and
changing its level would be right on one and wrong on the other two. The earnings
explainer moved `h3 → h2` to sit level with its siblings.
`FilterRail`, `BoardFilters`, `CreatorsPage`, `RequestBoard`, `BuyerRequestsPage`,
`CreatorPortfolioPage`, `PayoutExplainer`.

**F8 — Three semantic colours failed AA as text.** `warning`, `info` and `success` were
relying on MUI's automatic `dark` shade (a flat 20% darken, a ratio nobody had checked):
warning came out at **3.31:1** on white and info at **4.18:1**, both under AA for body
text, and success passed on white (4.91:1) but failed on its own 12% tint (4.30:1) — the
surface `softTone` actually paints Chip and Alert labels on.

Explicit `dark` shades were derived to clear **4.5:1 on both** paper and tint, and pinned
in the palette with their ratios; `error` already passed but is pinned too so none can
drift with a library default. The locked `main` tokens (00 §6) are untouched — they are
what fills a chip or an icon; only the text shade changed. Four captions using `.main` for
text now use `.dark`. `src/theme/palette.js` + 4 call sites.

| token | before (auto) | on paper | after | on paper | on 12% tint |
|---|---|---|---|---|---|
| `success.dark` | `#11823B` | 4.91 | `#117E39` | **5.16** | **4.52** |
| `warning.dark` | `#C47E08` | 3.31 ❌ | `#9A6407` | **5.00** | **4.56** |
| `info.dark` | `#0B84BA` | 4.18 ❌ | `#0A75A5` | **5.12** | **4.53** |
| `error.dark` | `#B01E1E` | 6.88 | `#B01E1E` (pinned) | **6.88** | **5.72** |

Verified passing and unchanged: text primary on paper 18.31, text secondary on paper 5.31,
primary.main on paper 5.70, white on primary.main 5.70, primary.dark on its tint 7.57,
white on error.main 4.83, and the focus ring at 5.47 against the page background (needs 3).

**Documented, not changed:** white on `secondary.main` is 3.53:1. `secondary.main` is the
pink end of the locked brand gradient (00 §6), and the only text over it is the hero CTA
label — large, bold text, whose AA threshold is 3:1. It passes at the size it is used and
the token cannot change without changing the brand.

---

## 6. Performance

| Check | Method | Result |
|---|---|---|
| Every route lazy-loaded | grep | **73 `lazy()` calls for 73 route entries.** No page component is statically imported by any route table. |
| GSAP out of the entry chunk | build | GSAP appears **only** in `HomePage-*.js` (139.6 kB / 53.7 kB gz), the lazy landing chunk. |
| Recharts out of the entry chunk | build | Recharts appears only in the shared lazy `chartTheme-*.js` (376.8 kB / 104.5 kB gz), pulled in by chart-bearing screens. |
| Chunking is reasonable | build | 166 JS chunks; entry 1,015 kB / **324 kB gzipped** (React + MUI + router + shell). Page chunks are 8–45 kB. Vite's >500 kB notice fires on the entry chunk only. |
| Re-render waste on hot lists | live, MutationObserver | **0 measured.** Details below. |
| Images lazy + sized | grep, all 24 `component="img"` | 12 grid/list images are `loading="lazy"` and **all 12 reserve their box** (explicit width + height or aspect ratio), so no layout shift. |
| `useApiQuery` dependency arrays | grep, all 167 query call sites | **0** carry an inline object, array or function literal — nothing can change identity every render and loop. |
| No fetch loops | live, network idle per route | Each route settles and stops. The only recurring request is the deliberate 60s unread-notification poll. |
| Dev console clean | live, 84 route/role loads | **0 errors, 0 page errors.** Warnings: see §11. |
| Dead code / unused imports | lint + grep | `no-unused-vars` is at **error** and passes. One genuinely dead module removed. |

### Re-render waste — measured, not assumed

00 §16.3 and this prompt both warn against premature abstraction, so `React.memo` was
treated as something to justify rather than to sprinkle.

A `MutationObserver` was attached to the discovery grid and the price slider dragged across
14 steps. **Zero mutations** reached the grid during the drag — `FilterRail` keeps the
draft range in local state and debounces the commit, so the grid is never in the drag path.
The observer is proven rather than assumed: applying a category filter through the same
observer produced **192 mutations**.

So there is no re-render waste to memoise away on the hottest list in the product, and no
`React.memo` was added. The pages already memoise their derived data (`CreatorsPage` alone
has 6 `useMemo` and 3 `useCallback`).

**Fix — dead code.** `RoleHomePlaceholder.jsx` was still in the tree, marked `TEMP:` and
superseded by the real overviews in Prompts 15, 21 and 28. Nothing imported it. Removed.

---

## 7. Animation discipline

| Check | Method | Result |
|---|---|---|
| Durations within tokens | grep | Every duration comes from `motionTokens` (150 / 250 / 400 / 650 ms). **0** literals above 650 ms anywhere. |
| Transform / opacity only | grep | `motionPresets` animates `opacity`, `y`, `scale` and nothing else. **0** Framer props animate `width`, `height`, `top`, `left`, `margin`, `padding`, `fontSize` or `filter`. |
| No layout-thrashing CSS transitions | grep | **0** transitions on `width`, `height`, `top`, `left`, `margin`, `padding` or `font-size`. |
| Framer and GSAP never share an element | grep | GSAP is confined to **one file** — `useLandingAnimations.js`, a marketing surface — and no file imports both libraries. No double-animation is possible. |
| No scroll-jacking | read | ScrollTrigger is used for a scrubbed hero parallax and a batched reveal. **No `pin:`**, no scroll hijacking; the page scrolls at the reader's speed. |
| Hover states consistent | grep, 21 ad-hoc hovers | All go through the theme's `hoverLift` (≤ 2px, reduced-motion guarded) or change only paint properties — `boxShadow`, `color`, `borderColor`, `backgroundColor`, `opacity`. Nothing hovers a layout property. |
| Entrance does not delay interactivity | live | The landing hero's primary CTA accepts a click as soon as it exists, mid-entrance, and navigates. |
| Reduced motion | live, `reduce`, 10 routes scrolled end to end | Clean. See below. |

The GSAP layer is built so reduced motion cannot break it: hidden states are applied at
runtime by `from()`/`set()` rather than in CSS, and registration is gated behind
`gsap.matchMedia('(prefers-reduced-motion: no-preference)')`. If the hook never runs — a
reduced-motion reader, a JS failure, a crawler — the page renders complete and readable.
Framer is covered globally by `<MotionConfig reducedMotion="user">`.

One page initially flagged an element at opacity 0 under reduced motion. Re-checked with
the page fully scrolled and given time, that element renders at `opacity: 1` under **both**
motion settings — the first reading had caught a reveal mid-flight. **No regression.**

---

## 8. Security-minded frontend

### Grep sweeps

| Sweep | Pattern | Result |
|---|---|---|
| Secrets / credentials | `api[_-]?key`, `secret`, `token =`, `private[_-]?key`, `sk_live`, `pk_live`, `AKIA`, bearer literals | **0 hits.** No credential is committed anywhere in `src/`. |
| Demo passwords | `Password123!` and friends | Only in `README.md` (documented demo accounts) and the seed data that creates them. None hard-coded in application code. Temporary admin passwords are generated at runtime by `adminTeamService.generateTempPassword()`, never fixed. |
| `dangerouslySetInnerHTML` | literal | **0.** |
| `innerHTML` | literal | **0.** |
| `eval` / `new Function` | literal | **0.** |
| Raw `fetch` / `axios` outside the API layer | `\b(fetch\|axios)\s*\(` | **0.** `axios` is imported in exactly one file, `services/api/apiClient.js`. |
| `XMLHttpRequest` / `sendBeacon` / `WebSocket` / `EventSource` | literal | **0.** |
| Route literals outside `paths.js` | `'/buyer…'`, `'/creator…'`, `'/admin…'`, `'/login'`, … | **0.** One dev-only fixture nav still held literal `/admin/*` paths; it now builds them from `paths.js`. |
| Status / role literals outside `constants/` | the prompt's spot greps `"pending"`, `"approved"`, `'/buyer/'` plus the full enum set | **0 domain literals.** Remaining matches are React list keys (`key: 'pending'`), per-module UI tab enums that own their own values, and the mock gateway's protocol vocabulary — see below. |
| External hosts | `https?://…` in `src/` | `picsum.photos` (only inside `constants/images.js`), `betterblue.test` (seed/demo addresses), `w3.org` (SVG namespaces), the footer's two social links, `localhost` (dev API default). No third-party script or beacon. |

Two deliberate exceptions, both documented in the code that holds them:

- **`services/payments/dummyPaymentProvider.js`** returns `'processing'` / `'succeeded'` /
  `'failed'`. That is the *gateway's* vocabulary, not the domain's `PAYMENT_STATUS`, and
  keeping them separate is what lets a real provider drop in behind the same interface
  (00 §15). The service translates.
- **`orderService.ORDER_EVENT_TYPE`** is its own enum for timeline events. Some values
  coincide by name with `ORDER_STATUS`; they are different things and correctly separate.

### Destructive-action confirmation

Every remove / cancel / suspend / blacklist / refund / resolve / withdraw / void / archive
path was traced from its control to its service call. **All are confirmed** through
`useConfirm()` with explicit consequence copy, and carry a reason field where the domain
needs one (21 modules use it). The single control a sweep flagged as unconfirmed —
`ProposalListCard`'s "Withdraw" — is presentational; its parent, `CreatorProposalsPage`,
runs the confirmation. Admin interventions state what happens to the money *before* the
button, and record the reason in the audit trail.

### Role-guard matrix

Each role signed in and sent to both foreign area roots plus two deep URLs in each — **24
checks, 24 correct redirects, 0 leaks**.

| Signed in as | Sent to | Landed on |
|---|---|---|
| buyer | `/creator`, `/creator/orders`, `/creator/earnings` | `/buyer` ×3 |
| buyer | `/admin`, `/admin/users`, `/admin/settings` | `/buyer` ×3 |
| creator | `/buyer`, `/buyer/orders`, `/buyer/payments` | `/creator` ×3 |
| creator | `/admin`, `/admin/users`, `/admin/settings` | `/creator` ×3 |
| admin | `/buyer`, `/buyer/orders`, `/buyer/requests` | `/admin` ×3 |
| admin | `/creator`, `/creator/orders`, `/creator/earnings` | `/admin` ×3 |
| super admin | the same six buyer/creator URLs | `/admin` ×6 |

**`PermissionGate` on a scoped admin** — `admin@betterblue.test` holds a subset of
permissions. All six restricted screens refuse: `/admin/settings`, `/admin/admins`,
`/admin/roles` and `/admin/audit-logs` render "Super admin only"; `/admin/payments` and
`/admin/settlements` render the "you do not have access" screen naming the permission
required and where to ask for it. Nothing renders the underlying data.

**Deep-link return** — a signed-out visitor requesting `/buyer/orders/ord_007` is sent to
`/login` and, after signing in, lands on `/buyer/orders/ord_007` rather than the dashboard
root.

### Uploaded-file metadata

Filenames reach the DOM only as React text children, which escape by construction — there
is no `dangerouslySetInnerHTML` anywhere to bypass that. `uploadService` sanitises the
metadata it stores, size and type are validated before upload, and long names are truncated
for display with the full value kept in the accessible name rather than dropped.

### Frontend guards are UX only

Stated again here because it is the single most important line in this document:

> **Every guard, gate, disabled button and hidden control in this application is a
> convenience, not a security boundary.** The client decides what to *show*; it cannot
> decide what a caller is *allowed to do*. `RoleRoute`, `PermissionGate`, `hasPermission`,
> the mock `authService` and every `assertTransition` in the services layer run in a
> browser the user controls and can be bypassed with the developer tools.
>
> **The Laravel API must independently enforce authentication, role authorisation,
> per-permission authorisation, ownership checks, and every state-machine transition on
> every endpoint**, and must never trust an id, a role, a status or a price sent by the
> client. `docs/api-contract.md` defines the endpoints; this is the rule that governs all
> of them.

---

## 9. Copy & content

| Check | Method | Result |
|---|---|---|
| No lorem ipsum | grep | **0.** |
| No placeholder or dev copy user-visible | grep for `TODO`/`TBD`/`FIXME` in JSX text, `"test"`, `"foo"`, `"asdf"`, `"debug"` | **0.** |
| No "coming soon" for things that exist | grep + read | The two remaining are honest: `PortfolioGallery`'s empty state ("Portfolio coming soon" — a creator who has not published yet) and email notifications, which are genuinely not built and are shown disabled with a tag rather than pretending to work. |
| Glossary terms used consistently (00 §18) | grep | Creator 1,146 · Buyer 687 · Proposal 600 · Payout 416 · Commission 299 · Escrow 199 · Deliverable 38 · Content Request 13. No competing vocabulary ("freelancer", "gig", "client", "job") in user-facing copy. |
| Business-safe content (00 §1) | grep + seed guard | **Clean.** `scripts/seed-db.js` carries a `PROHIBITED_TERMS` sweep that fails the seed if any prohibited term appears in any string of any collection — re-run and passing. The only matches for those terms in the whole repository are that guard itself and the Content Policy copy that prohibits them, which is correct. |
| Imagery through one helper | grep | Every `picsum.photos` URL is inside `src/constants/images.js`. **0** hotlinks elsewhere, so the client can swap the source in one place. |
| Seed subject matter | read | Restaurants, fashion, fitness, travel, SaaS, beauty, food, e-commerce, education, real estate, events — commercial UGC throughout. |

---

## 10. TEMP / TODO sweep

Every marker in `src/`, and what happened to it.

| Marker | Location | Disposition |
|---|---|---|
| `TEMP:` role-home placeholder | `dashboard/components/RoleHomePlaceholder.jsx` | **Removed.** Superseded by the real overviews in Prompts 15, 21 and 28; nothing imported it. |
| `TODO(Prompt 31)` — link the Active-orders tile | `admin/overview/components/KpiGrid.jsx` | **Resolved.** Prompt 31 built the orders console; the tile links to it. |
| `TODO(Prompt 27)` — activity rows become links | `dashboard/pages/BuyerOverviewPage.jsx` | **Resolved.** Rows resolve through `getNotificationPath` to the record they are about. |
| `TODO(Prompt 27)` — activity rows become links | `dashboard/pages/CreatorOverviewPage.jsx` | **Resolved.** Same. |
| `ADMIN_PENDING` gate (comment-gated, not a `TODO` string) | `notifications/notificationRoutes.js` | **Resolved.** Still listed `/admin/requests`, `/admin/orders` and `/admin/affiliates`, all mounted by Prompts 31 and 34, so those admin notifications were landing on the dashboard home. List and guard removed after verifying each path against `adminRoutes.jsx`. |
| Buyer affiliate target returning `null` | `notifications/notificationRoutes.js` | **Resolved.** Prompt 34 mounted `/buyer/affiliate`. |
| Creator affiliate target returning `null` | `notifications/notificationRoutes.js` | **Kept, comment corrected.** Referrals shipped as a buyer programme — `affiliateService` only converts referred sign-ups whose role is `buyer`, and the only nav entry is the buyer's. There is no creator screen to point at; the comment no longer claims one is coming. |
| `TODO(laravel)` ×4 | `services/api/listAdapter.js` | **Kept by design.** They mark the exact lines the Laravel adapter must revisit, which is what 00 §15 asks that file to carry. Not stubs — the JSON-Server path they annotate is complete and working. |
| Prompt-narrative mentions of a former TODO | `authService.js`, `AdminOverviewPage.jsx` | Prose recording that a gate *was* removed. No action. |
| The word "stub" in comments | `routes/*.jsx`, `HowItWorksPage.jsx` | History — "Prompt 19 replaced that stub". No stub remains. |

**No stubs, no placeholder screens and no comment-gated links survive.**

---

## 11. Deferrals and documented exceptions

Two items are not fixed. Neither reaches a user, and both are recorded rather than quietly
passed.

**D1 — React Router future-flag warning in the dev console.**
Every page logs one warning: *"React Router will begin wrapping state updates in
`React.startTransition` in v7… use the `v7_startTransition` future flag to opt in early."*

- It is **dev-only**: the string does not appear anywhere in `npm run build` output, so no
  user or production console ever sees it.
- Opting in is not cosmetic. `v7_startTransition` changes how navigation interacts with
  Suspense: with lazy routes, the previous screen is held instead of the route's fallback
  being shown. That would alter the skeleton and loading behaviour audited in §3 — the one
  thing a hardening pass must not quietly change (00 §17), and it is a v7 migration
  decision rather than a hardening one (00 §3 freezes the dependency set).

Deferred to the v7 migration, where the loading behaviour can be re-verified as part of the
change. It is the only warning in the console across all 84 route/role loads.

**D2 — `secondary.main` against white is 3.53:1.**
`#EC4899` is the pink end of the locked brand gradient (00 §6) and cannot change without
changing the brand. The only white text over it is the hero CTA label, which is large bold
text and therefore governed by the 3:1 AA-large threshold, which it passes. Recorded so
that anyone adding **body-sized** white text on secondary knows not to.

**D3 — `errorElement` sits at the route-group level, not per page.**
A page that throws is caught and shown a recoverable screen with two ways out (verified in
§2), but it replaces its whole layout — the dashboard shell included — rather than only the
page area. Giving each child route its own `errorElement` would keep the shell up.

That is a change to the router's shape, not a hardening fix, and this pass is explicitly
barred from altering routing behaviour (00 §17). Nothing is lost today: the screen is
friendly, the stack is dev-only, and "back home" always works. Raised for Prompt 38, where
the router is in scope.

### Not deferrals — findings re-checked and dismissed

Recorded so the numbers in this document can be trusted:

- **`net::ERR_ABORTED` on ~70 route loads** — the sweep's own navigation cancelling
  in-flight requests, not application failures. Zero real console errors remain.
- **Skeletons "stuck" on heavy admin screens** — json-server's `--delay 300` plus chained
  service calls. Every one resolved when re-checked with a generous wait.
- **Two pages reading as zero-`h1`** — probed mid-load. Both have exactly one.
- **An element at opacity 0 under reduced motion on `/about`** — caught mid-reveal by a
  stepped scroll. Fully scrolled, it renders at `opacity: 1` under both motion settings.
- **`/admin/payments` blank under a dead API** — `PermissionGate` correctly refusing a
  scoped admin. Re-run as super admin, it shows its error state and retry.
- **Register submit "not keyboard reachable"** — the first step is a role chooser whose
  button reads "Continue"; it is reachable at Tab 2 with a visible focus ring.

---

## 12. Files changed

34 files, grouped by the audit that called for the change. No feature behaviour, service
signature, seed or visual token was altered (00 §17); `prompts/` is untouched.

**Audit 1 — forms & validation (6)**
`src/hooks/useForm.js` (extracted `focusFieldById`) ·
`features/disputes/components/RaiseDisputeDialog.jsx` ·
`features/earnings/components/WithdrawDialog.jsx` ·
`features/admin/disputes/components/EscalateDialog.jsx` ·
`features/admin/disputes/components/RequestInfoDialog.jsx` ·
`features/admin/finance/components/RefundDialog.jsx`

**Audit 4 — responsive / touch targets (7)**
`components/inputs/FilterChipGroup.jsx` · `components/brand/Logo.jsx` ·
`features/dashboard/components/WelcomeBanner.jsx` · `layouts/PublicLayout.jsx` ·
`layouts/dashboard/DashboardLayout.jsx` · `features/auth/pages/LoginPage.jsx` ·
`features/staticPages/pages/HowItWorksPage.jsx`

**Audit 5 — accessibility (12)**
`theme/components.js` (`variantMapping`) · `theme/palette.js` (AA `dark` shades) ·
`features/discovery/components/FilterRail.jsx` · `features/discovery/pages/CreatorsPage.jsx` ·
`features/requests/components/BoardFilters.jsx` · `features/requests/components/RequestBoard.jsx` ·
`features/requests/pages/BuyerRequestsPage.jsx` · `features/portfolio/pages/CreatorPortfolioPage.jsx` ·
`features/earnings/components/PayoutExplainer.jsx` ·
`features/admin/roles/components/EditPermissionsDialog.jsx` ·
`features/disputes/components/MessageComposer.jsx` ·
`features/admin/disputes/components/AdminThreadComposer.jsx`

**Audit 6 — performance / dead code (2)**
`components/data-display/MediaLightbox.jsx` (thumbnail strip lazy-loads) ·
`features/dashboard/components/RoleHomePlaceholder.jsx` (**deleted**)

**Audit 8 — security sweeps (1)**
`features/dashboard/components/devGallery/WidgetsGallery.jsx` (fixture nav now builds from
`paths.js`)

**Audit 10 — TEMP / TODO (5)**
`features/notifications/notificationRoutes.js` ·
`features/admin/overview/components/KpiGrid.jsx` ·
`features/admin/overview/pages/AdminOverviewPage.jsx` ·
`features/dashboard/pages/BuyerOverviewPage.jsx` ·
`features/dashboard/pages/CreatorOverviewPage.jsx`

**Created** — `docs/qa-checklist.md` (this file).

---

## 13. Final verification

Run after every fix above, on a freshly seeded database.

| Gate | Result |
|---|---|
| `npm run lint` (`--max-warnings 0`) | **pass**, 0 errors, 0 warnings |
| `npm run build` | **pass** — 166 chunks; GSAP and Recharts both outside the entry chunk |
| `npm run smoke:api` | **pass** — 59/59 checks |
| `npm run smoke:workflow` | **pass** — 37/37 checks |
| `npm run seed` | **pass** — integrity + content-policy checks green, before and after |
| Console click-through, 84 route/role loads | **0 errors**, 1 warning class (D1, dev-only) |
| Kill-API resilience | **19/19** routes |
| Responsive matrix | **420/420** checks, 0 horizontal scroll |
| Role-guard matrix | **24/24** redirects, 6/6 permission gates |
| Dialog focus behaviour | **6/6** dialogs |
| Keyboard journeys | both completable |
| Reduced-motion sweep | clean across 10 routes |

### Cross-role flows re-run end to end after the fixes

| Flow | What was actually done | Result |
|---|---|---|
| **Marketplace loop** | Creator opened a live brief, submitted without the deliverability declaration, then completed it | Validation refused and said why; the 160 characters already typed were kept; ticking the declaration persisted the proposal (3 → 4); the dialog became a "Proposal sent" panel with a route to *My proposals*; the buyer received a `proposal_received` notification. |
| **Disputes** | Super admin opened a live case and posted to the thread | Message persisted (4 → 5 messages); no page errors. |
| **Settlements** | Super admin approved a requested payout | Confirmed first — *"Approve this payout? $700.00 to Yuki Tanaka… The request moves to Processing"* — then the payout advanced past `requested`. |
| **Affiliate pipeline** | Super admin approved a pending commission on the Earnings-approval queue | Confirmed first — *"Approve this commission? $10.00 to Ava Martinez becomes payable…"* — then `pending → approved`. Buyer referral screen renders. |
| **Escrow / payments** | `npm run smoke:workflow` | 37/37 — hold, release, commission split, declined card, partial refund, and the ledger rows behind each. |

`npm run seed` was re-run afterwards, so `server/db.json` is back to its seeded state.

---

*Produced by the Prompt 37 hardening pass. Every count in this document comes from a sweep
that was re-run after the fixes it describes.*
