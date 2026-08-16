# QA Checklist — Release Hardening (Prompt 37)

The audit-and-fix pass run across the finished application (Prompts 01–36) against
`prompts/00-architecture-and-rules.md`. Every row records **what was checked**, **how**,
**what was found**, and **what was done**. Nothing is marked pass on inspection alone
where a live check was possible.

**Verdict: no unfixed criticals.** Two items are deferred with justification
([§11](#11-deferrals-and-documented-exceptions)); neither reaches a user.

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
and `RouteErrorElement` as the router `errorElement` on all four route groups, so one
route failing does not tear down the shell. Both render the same screen; the stack is
gated on `env.isDev` so internals never ship (00 §14). Verified by forcing a render error
on three sampled routes — public, buyer, admin — each caught by the route-level element
with the rest of the app still navigable.

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
| Touch targets ≥ 44px | live, 360 + 600 | 3 real defects found and fixed — see below. |
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
| Keyboard journeys | live | Buyer *register → request → accept → pay → review* and creator *propose → deliver* both completable with keyboard only. |
| `:focus-visible` ring | read + live | Restored on `MuiButtonBase` in the theme (MUI zeroes it) and applied through `focusRing()`; visible on sampled buttons, links, chips and inputs. |
| `aria-live` regions | live | Toasts, result counts, upload queues and the notification badge all announce. |
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

---

## 9. Copy & content

---

## 10. TEMP / TODO sweep

---

## 11. Deferrals and documented exceptions

---

## 12. Files changed

---
