# BetterBlue

BetterBlue is a professional creator marketplace for business-oriented user-generated content (UGC). Businesses commission creators to produce legitimate commercial photos and videos — brand promotion, product marketing, social media content, testimonials, advertising campaigns, and website content — through a workflow of content requests, proposals, escrow-backed orders, deliverables, and reviews.

## Requirements

- **Node.js 18.19.0** or newer (`"engines": { "node": ">=18.19.0" }`)

## Getting Started

```bash
npm install
cp .env.example .env   # optional — the app falls back to the same defaults
npm run dev:all
```

- Web app: http://localhost:5173
- Mock API (JSON Server): http://localhost:4000

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server on port 5173 |
| `npm run api` | JSON Server mock API on port 4000 (300ms simulated latency) |
| `npm run dev:all` | Runs web + api together with named, colored output |
| `npm run seed` | Regenerates `server/db.json` (seed script arrives in a later prompt) |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint over `src/` with zero warnings allowed |

## Documentation

Project documentation lives in [`docs/`](docs/) and grows as the build progresses (API contract, data model, payments, QA checklist, migration guide). The architecture and permanent project rules are defined in [`prompts/00-architecture-and-rules.md`](prompts/00-architecture-and-rules.md).
