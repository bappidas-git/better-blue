# BetterBlue

BetterBlue is a professional creator marketplace for business-oriented user-generated content (UGC). Businesses commission creators to produce legitimate commercial photos and videos — brand promotion, product marketing, social media content, testimonials, advertising campaigns, and website content — through a workflow of content requests, proposals, escrow-backed orders, deliverables, and reviews.

## Requirements

- **Node.js 18.19.0** or newer (`"engines": { "node": ">=18.19.0" }`)

## Getting Started

```bash
npm install
cp .env.example .env   # optional — the app falls back to the same defaults
npm run seed           # generates server/db.json (already committed)
npm run dev:all
```

- Web app: http://localhost:5173
- Mock API (JSON Server): http://localhost:4000

## Demo accounts

Every seeded account uses the same password: **`Password123!`**

| Role | Email | Signed in as |
|---|---|---|
| Buyer | `buyer@betterblue.test` | Nora Whitfield — Verde Kitchen |
| Buyer (fresh account) | `newbuyer@betterblue.test` | Ruth Alvarez — Harbor Lane Bakery |
| Creator | `creator@betterblue.test` | Ava Martinez |
| Admin | `admin@betterblue.test` | Maya Chen — marketplace operations |
| Super admin | `super@betterblue.test` | Elena Marsh — full platform access |

Each account has meaningful data waiting on first sign-in: live briefs with
proposals, orders in every state, disputes, a moderation queue, payouts, and
notifications. The exception is the **fresh buyer**, which is deliberately
empty — no briefs, no orders, and a half-finished profile — so the dashboard's
first-run onboarding state can be seen as a new customer sees it. The other 20
seeded accounts share the same password — see
[`docs/data-model.md`](docs/data-model.md) for the full roster.

> These are mock credentials for a prototype. JSON Server cannot authenticate,
> so passwords are stored in plain text and compared client-side, marked
> `MOCK-AUTH:` in the source. Real authentication arrives with the Laravel
> backend.

## Mock database

`server/db.json` is **generated** — never edit it by hand. To change the data,
edit a module under `scripts/seed-data/` and run:

```bash
npm run seed                     # validate, then rewrite server/db.json
node scripts/seed-db.js --check  # validate only, write nothing
```

The seed is deterministic (no `Date.now()`, no `Math.random()`), so re-running
it produces byte-identical output and `server/db.json` diffs cleanly. Before
writing, it validates referential integrity, enum membership, money math, and
timestamp ordering across all 26 collections, and exits non-zero with a
specific message if anything fails.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server on port 5173 |
| `npm run api` | JSON Server mock API on port 4000 (300ms simulated latency) |
| `npm run dev:all` | Runs web + api together with named, colored output |
| `npm run seed` | Regenerates `server/db.json` from `scripts/seed-data/` |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint over `src/` with zero warnings allowed |
| `npm run smoke:api` | Checks the running mock API the way `src/services/` uses it (non-destructive) |
| `npm run smoke:workflow` | Drives the escrow lifecycle against the running API — **writes records**, so `npm run seed` afterwards |

## Documentation

Project documentation lives in [`docs/`](docs/) and grows as the build progresses (API contract, data model, payments, QA checklist, migration guide). The architecture and permanent project rules are defined in [`prompts/00-architecture-and-rules.md`](prompts/00-architecture-and-rules.md).

- [`docs/api-contract.md`](docs/api-contract.md) — the REST contract the frontend codes against: conventions, auth, errors, pagination, every endpoint, and the composite operations that become single Laravel endpoints later.
- [`docs/data-model.md`](docs/data-model.md) — every collection, its fields and relations, the seed system, and the MySQL mapping for each table.
- [`docs/payments.md`](docs/payments.md) — the money layer: the provider interface and its dummy implementation, the escrow lifecycle, commission and partial-refund policy, ledger invariants, payouts, and the guide to swapping in a real payment provider.
