# BetterBlue

**A professional creator marketplace for business-oriented user-generated
content.** Businesses commission creators to produce commercial photos and
videos — brand promotion, product marketing, social content, testimonials,
advertising campaigns, website imagery — through a complete workflow of content
requests, priced proposals, escrow-backed orders, deliverables, revisions,
disputes, and reviews.

This repository is a **fully functional frontend prototype**: React 18 + Vite,
running against a JSON Server mock API. Every screen, every role, and every
workflow is built and works end to end. The mock stack is deliberately isolated
behind a services layer so a Laravel/MySQL backend can replace it without
touching the UI — see [`docs/laravel-migration-guide.md`](docs/laravel-migration-guide.md).

---

## Requirements

- **Node.js 18.19.0** or newer — `"engines": { "node": ">=18.19.0" }`
- npm 9+ (ships with Node 18.19)

No database, no services, no API keys. Everything runs locally.

## Getting started

```bash
npm install
cp .env.example .env    # optional — the app falls back to the same defaults
npm run seed            # regenerates server/db.json (already committed)
npm run dev:all         # web + mock API together
```

| | |
|---|---|
| Web app | http://localhost:5173 |
| Mock API (JSON Server) | http://localhost:4000 |

Sign in with any account from the table below — or click one on the sign-in
screen, where a development-only panel fills the form for you.

## Demo accounts

Every seeded account uses the same password: **`Password123!`**

| Role | Email | Signed in as | What it demonstrates |
|---|---|---|---|
| Buyer | `buyer@betterblue.test` | Nora Whitfield — Verde Kitchen | A live brief with four proposals, an order awaiting revision, completed orders, reviews, months of payment history |
| Buyer (fresh) | `newbuyer@betterblue.test` | Ruth Alvarez — Harbor Lane Bakery | The first-run experience: no briefs, no orders, an onboarding checklist |
| Creator | `creator@betterblue.test` | Ava Martinez | A shortlisted proposal, an in-progress order, a revision to answer, a delivery under review, released earnings, a paid payout, affiliate earnings |
| Admin | `admin@betterblue.test` | Maya Chen | Moderation queue, live disputes, support tickets, user management, audit log |
| Super admin | `super@betterblue.test` | Elena Marsh | All of the above plus the admin team, the permission matrix, and platform settings |

A further 19 seeded accounts share the same password — the full roster is in
[`docs/data-model.md`](docs/data-model.md) §2. `theo.almeida@betterblue.test` is
a deliberately limited admin (moderation only), useful for seeing the permission
system refuse things.

> **These are mock credentials for a prototype.** JSON Server cannot
> authenticate, so passwords are stored in plain text and compared client-side.
> Every such site is marked `MOCK-AUTH:` in the source. Real authentication
> arrives with the Laravel backend.

---

## Features by role

### Visitors (no account)
Landing page with live marketplace data · creator discovery with category,
content-type, price and rating filters · public creator profiles with portfolio
galleries and reviews · the open request board · how it works, pricing, FAQ,
about, contact · Content Policy, Terms, Privacy · content reporting.

### Buyers
Dashboard with spend, active briefs and attention items · a four-step request
wizard with drafts and autosave · proposal management with shortlisting and
side-by-side comparison · checkout with escrow funding and card decline handling
· order workspace with deliverables, revisions and acceptance · payment history
and receipts · disputes · reviews · the affiliate referral programme ·
notifications and preferences · profile and account settings.

### Creators
Dashboard with earnings, active orders and proposal outcomes · request board
with filters and a proposal composer that previews commission live · portfolio
management with moderation status per item · order workspace with a multi-file
delivery composer and revision handling · earnings with an escrow/available/paid
breakdown, a transaction ledger and payout requests · disputes · notifications
and preferences · public profile editing.

### Admins (permission-scoped)
Operations overview with attention queues · user management with suspend,
blacklist and reactivate · content moderation for portfolio items, deliverables
and member reports · marketplace operations across requests and orders ·
payments, escrow monitor, commissions and settlements · dispute resolution with
release, full refund and partial refund · support inbox · announcements ·
affiliate administration · audit trail.

### Super admins
Everything above, plus platform settings (commission rates, payout minimums,
auto-accept window, feature flags) · the category taxonomy · the admin team with
per-permission grants · the roles matrix · the full audit log explorer.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | React 18.2 · JavaScript only (no TypeScript) |
| Build | Vite 5 |
| Routing | React Router 6 |
| UI | MUI 5 + Emotion, custom theme and design tokens |
| Icons | Iconify (`solar:*`, `tabler:*`) |
| Motion | Framer Motion (product UI) · GSAP + ScrollTrigger (marketing surfaces) |
| Charts | Recharts |
| Dates | Day.js + MUI X Date Pickers |
| HTTP | Axios, behind a single client in `src/services/api/` |
| Fonts | Plus Jakarta Sans (headings) · Inter (body), via `@fontsource` |
| Mock API | JSON Server 0.17.4 (pinned) |
| Lint | ESLint 8 with react, react-hooks and react-refresh plugins |

No state library: server state goes through `useApiQuery` / `useApiMutation` /
`usePaginatedQuery`, and the only global client state is auth, toasts, confirm
dialogs and notifications.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server on port 5173 |
| `npm run api` | JSON Server mock API on port 4000 (300 ms simulated latency) |
| `npm run dev:all` | Runs web + API together with named, coloured output |
| `npm run seed` | Regenerates `server/db.json` from `scripts/seed-data/` |
| `npm run build` | Production build |
| `npm run preview` | Serves the production build |
| `npm run lint` | ESLint over `src/`, zero warnings allowed |
| `npm run smoke:api` | Checks the running mock API the way `src/services/` uses it (non-destructive) |
| `npm run smoke:workflow` | Drives the escrow lifecycle against the running API — **writes records**, so run `npm run seed` afterwards |

## Mock database

`server/db.json` is **generated** — never edit it by hand. To change the data,
edit a module under `scripts/seed-data/` and re-run the seed:

```bash
npm run seed                     # validate, then rewrite server/db.json
node scripts/seed-db.js --check  # validate only, write nothing
```

The seed is deterministic — no `Date.now()`, no `Math.random()` — so re-running
it produces byte-identical output and `server/db.json` diffs cleanly. Before
writing, it validates referential integrity, enum membership, money arithmetic
and timestamp ordering across all 26 collections, and exits non-zero with a
specific message if anything fails.

## Project structure

```
betterblue/
├── docs/            # API contract, data model, payments, QA, walkthrough, migration guide
├── prompts/         # the build specification this project was written against
├── scripts/         # seed-db.js, seed-data/*.js, smoke-*.mjs (plain Node, no deps)
├── server/          # db.json — generated by the seed, never hand-edited
├── public/          # favicon and static assets
└── src/
    ├── app/         # App shell and providers
    ├── components/  # shared UI: feedback, data-display, inputs, layout, table, motion
    ├── config/      # env.js (the only reader of import.meta.env), appConfig.js
    ├── constants/   # roles, statuses, state machines, permissions, policy, images
    ├── context/     # AuthContext
    ├── features/    # one module per feature area, each owning its pages + components
    ├── hooks/       # useApiQuery, useApiMutation, usePaginatedQuery, useForm, …
    ├── layouts/     # PublicLayout, AuthLayout, DashboardLayout
    ├── routes/      # router, paths.js, guards.jsx, navConfig.jsx
    ├── services/    # api/ (client, adapter) + one service per domain + payments/
    ├── styles/      # global.css, tokens.css
    ├── theme/       # palette, typography, components, motion tokens
    └── utils/       # formatters, validators, state machine, storage, id, exportCsv
```

Path alias: `@/` → `src/`.

## Configuration

Environment variables are read **only** through `src/config/env.js`. Copy
`.env.example` to `.env` to change them.

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:4000` | Where the API lives |
| `VITE_API_PROVIDER` | `json-server` | List-adapter dialect — `json-server` or `laravel` |
| `VITE_APP_NAME` | `BetterBlue` | Product name in titles and the shell |
| `VITE_ENABLE_DEV_PAGES` | `true` | Development surfaces: the design gallery, the demo-account panel, the test-card panel. Set `false` for a client-facing build |

## Documentation

Everything lives in [`docs/`](docs/) — start at the
[documentation index](docs/README.md).

| Document | What it covers |
|---|---|
| [`docs/README.md`](docs/README.md) | Index of everything below |
| [`docs/api-contract.md`](docs/api-contract.md) | The REST contract the frontend codes against: conventions, auth, errors, pagination, every resource, and the 48 composite operations that become single Laravel endpoints |
| [`docs/data-model.md`](docs/data-model.md) | Every collection, its fields and relations, the seed system, and the MySQL mapping per table |
| [`docs/payments.md`](docs/payments.md) | The money layer: the provider interface, escrow lifecycle, commission and partial-refund policy, ledger invariants, payouts |
| [`docs/laravel-migration-guide.md`](docs/laravel-migration-guide.md) | **The backend handoff** — a ten-step plan for replacing JSON Server with Laravel/MySQL |
| [`docs/e2e-walkthrough.md`](docs/e2e-walkthrough.md) | The certification scenario: every workflow, every role, executed and recorded |
| [`docs/qa-checklist.md`](docs/qa-checklist.md) | The accessibility, forms, responsive and content audit |
| [`docs/notifications-audit.md`](docs/notifications-audit.md) | Which workflow events emit which notifications |
| [`docs/audit-log-coverage.md`](docs/audit-log-coverage.md) | Which administrative actions write audit rows |
| [`prompts/00-architecture-and-rules.md`](prompts/00-architecture-and-rules.md) | The permanent architecture and project rules |

## Screenshots

<!--
  Screenshots go here. Suggested set, at 1280px desktop and 360px mobile:

  ![Landing](docs/screenshots/landing.png)
  ![Creator discovery](docs/screenshots/discovery.png)
  ![Request wizard](docs/screenshots/request-wizard.png)
  ![Proposal comparison](docs/screenshots/proposals.png)
  ![Checkout and escrow](docs/screenshots/checkout.png)
  ![Creator earnings](docs/screenshots/earnings.png)
  ![Admin dispute resolution](docs/screenshots/dispute-resolution.png)
  ![Super admin settings](docs/screenshots/settings.png)
-->

*Screenshots to be added — capture the eight screens listed in the comment above
at 1280 px and 360 px.*

## Known limitations

This is a prototype with a mock backend. The limitations are structural, not
oversights, and each is documented with its replacement path:

- **Mock authentication.** Plain-text passwords compared in the browser; the
  session token is a base64 payload, not a credential. Marked `MOCK-AUTH:`.
- **Client-side orchestration.** Business actions that should be one
  transactional endpoint are several REST calls made from the browser, with no
  rollback. All 48 are documented in api-contract §7.
- **Frontend guards are UX only.** JSON Server has no authorization; every
  record is readable and writable by anyone who knows the URL.
- **No real-time.** No websockets or polling — notifications appear on the next
  fetch, not the moment they are written.
- **No email.** Notification preferences show email channels as "not available
  yet"; nothing is ever sent.
- **Uploads are local.** Files become object URLs that die with the tab.
- **Dummy payments.** A deterministic test-card processor, not a gateway.
- **No scheduled work.** Auto-accept windows and affiliate attribution expiry are
  displayed and honoured on read, but nothing sweeps them.

## Licence and ownership

Proprietary. All rights reserved by the project owner. This codebase, its
design system, seed content and documentation are delivered as a client work
product and are not licensed for redistribution.

Placeholder photography is served from [picsum.photos](https://picsum.photos)
through helpers in `src/constants/images.js`, so every image URL can be swapped
for licensed assets in one place. Avatars are locally generated SVGs. All sample
copy, company names and people are fictional and business-safe.
