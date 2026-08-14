# BetterBlue — Master Implementation Prompt System

This folder contains the complete, dependency-ordered prompt system for building **BetterBlue**, a professional creator marketplace where businesses commission creators for commercial photos and videos (UGC for marketing, brand promotion, product content, campaigns).

> ## ▶ How to use this system
>
> **Execute these prompts sequentially in Claude Code, starting from Prompt 01.**
>
> 1. Open Claude Code at the repository root (the folder containing `prompts/`).
> 2. For each prompt in order, tell Claude Code: *"Read and execute `prompts/NN-….md`"* (one prompt per session/run is recommended).
> 3. Every prompt instructs Claude Code to first read **`prompts/00-architecture-and-rules.md`** — the permanent rulebook that prevents architectural drift. Never skip it.
> 4. After each prompt, run the prompt's **Verification Steps** (at minimum: `npm run lint`, `npm run build`, and the listed manual checks). Commit the working state before moving on (recommended).
> 5. If something fails, fix it within that prompt's scope before advancing — later prompts assume earlier acceptance criteria are met.
>
> `00-architecture-and-rules.md` is never "executed" — it is reference material for every other prompt.

## Ground rules baked into every prompt

- **Stack:** React ^18.2 + Vite 5, JavaScript/JSX only (never TypeScript), CSS Modules + MUI v5, Framer Motion + GSAP, Iconify, JSON Server (`db.json`) behind a REST abstraction, all verified on **Node.js 18.19.0**. All dependencies are installed once in Prompt 01 — no prompt adds packages.
- **Architecture:** centralized API/service layer (Laravel/MySQL replaces JSON Server later by swapping one adapter + base URL), centralized status/enum constants and state machines, role-based routing/guards (buyer, creator, admin, super admin), mobile-first premium purple/pink design system.
- **Positioning:** strictly professional commercial-content marketplace; all copy, dummy data, and imagery business-safe; moderation framed as standard marketplace Trust & Safety.

## Execution order

| # | File | Purpose | Depends on | Major modules created | Verify after |
|---|------|---------|-----------|----------------------|--------------|
| 00 | `00-architecture-and-rules.md` | Permanent architecture rulebook (read by every prompt) | — | — | — |
| 01 | `01-project-foundation.md` | Vite/React scaffold, all deps, ESLint, env, scripts, folder skeleton, shell | 00 | package.json, config, `src/` skeleton, app shell | Install/lint/build; both servers boot |
| 02 | `02-design-system-and-theme.md` | MUI theme (purple/pink tokens), typography, global styles, logo, motion tokens | 01 | `theme/`, `styles/`, Logo, motion presets, dev gallery | Gallery review; reduced-motion |
| 03 | `03-domain-constants-and-state-machines.md` | All roles/statuses/enums, STATUS_META, transition machines, permissions, policy, utils | 01–02 | `constants/`, `utils/` (stateMachine, validators, formatters…) | Machine + formatter checks |
| 04 | `04-ui-component-library.md` | Reusable components: toasts, confirm, skeletons, StatusChip, DataTable, forms, dialogs, motion | 01–03 | `components/*`, `useForm`, `useDebounce` | Gallery all-states; a11y pass |
| 05 | `05-mock-database-and-seeds.md` | Full db.json data model + deterministic seed system + data-model docs | 01, 03 | `scripts/seed*`, `server/db.json`, `docs/data-model.md` | Seed idempotence; endpoint spot-checks |
| 06 | `06-api-contract.md` | Complete REST API contract documentation (mock mapping + Laravel target) | 03, 05 | `docs/api-contract.md` | Contract↔db cross-check |
| 07 | `07-api-client-and-services.md` | Axios client, error/list adapters, all domain services, data hooks, API smoke test | 03–06 | `services/*`, `useApiQuery` family, `smoke:api` | `npm run smoke:api`; greps |
| 08 | `08-routing-and-app-shell.md` | Router + all path constants, public layout/nav/footer, 404, error boundary, transitions | 02, 04, 07 | `routes/`, `layouts/Public*`, navigation, NotFound | Route/404/a11y checks |
| 09 | `09-authentication-and-access-control.md` | Login/register/logout, AuthContext, guards, RBAC, account-status handling | 03–05, 07–08 | `authService`, AuthContext, guards, auth pages | 4-role login matrix; redirects |
| 10 | `10-landing-page.md` | Real landing page: GSAP hero, API-driven sections, CTAs | 04, 07–09 | `features/landing/*`, landingService | Breakpoints; reduced-motion; API-down |
| 11 | `11-public-info-pages.md` | How It Works, Content Policy, Pricing, FAQ, About, Contact, Terms, Privacy | 03–04, 07–08, 10 | `features/staticPages/*` | Link audit; contact round-trip |
| 12 | `12-creator-discovery.md` | `/creators` search/filter/sort/pagination with URL sync, creator cards | 04, 07–08 | `features/discovery/*` | Filter matrix; URL round-trip |
| 13 | `13-creator-public-profile.md` | Public creator profile: header, portfolio gallery + lightbox, reviews | 04, 07–08, 12 | `features/creatorProfile/*` | Profile branches; lightbox a11y |
| 14 | `14-dashboard-framework.md` | Shared DashboardLayout (sidebar/bottom-nav), navConfig, widget kit (charts, stats, feeds) | 04, 07–09 | `layouts/dashboard/*`, `navConfig`, widget kit | 4-role × 2-viewport layout matrix |
| 15 | `15-buyer-overview-profile-settings.md` | Buyer overview (stats/chart/activity/onboarding), profile, settings | 07, 09, 14 | buyerDashboardService, buyer account pages | Stats↔db reconciliation |
| 16 | `16-buyer-request-creation.md` | 4-step content-request wizard with drafts + policy acknowledgment | 04, 07, 14–15 | `features/requests/` wizard | Wizard happy/edge paths; draft resume |
| 17 | `17-payment-escrow-architecture.md` | Payment provider abstraction, escrow lifecycle, commission, ledger, payouts (services only) | 03, 05, 07, 16 | `services/payments/*`, money utils, `docs/payments.md`, `smoke:workflow` | `npm run smoke:workflow` |
| 18 | `18-buyer-proposal-management.md` | Request list/detail, proposal review/shortlist/compare/accept → checkout stub | 14–17 | requests/proposals buyer pages | Cross-check accept side-effects |
| 19 | `19-checkout-and-payment-ui.md` | Checkout, dummy card form, processing/success/failure, buyer payments history | 17–18 | `features/checkout/*`, `features/payments/*` | Success/decline/refund-path tests |
| 20 | `20-buyer-orders-and-delivery-review.md` | Buyer orders, delivery review, revisions, acceptance→release, creator reviews | 17, 19 | `features/orders/*` (buyer), reviews | Full buyer loop incl. release |
| 21 | `21-creator-overview-profile-settings.md` | Creator overview, marketplace profile editor, settings, availability | 14–15, 17 | creatorDashboardService, creator account pages | Propagation to public surfaces |
| 22 | `22-creator-portfolio-management.md` | Portfolio manager + moderation submission lifecycle | 13–14, 21 | `features/portfolio/*` | Lifecycle + public-leak checks |
| 23 | `23-request-discovery-and-proposals.md` | Public request board, creator browse, proposal submission, My Proposals | 12, 17–18, 21–22 | request board, `features/proposals/*` | Cross-role proposal loop |
| 24 | `24-creator-orders-and-delivery.md` | Creator order workspace, delivery composer, revisions, versioning | 20, 23 | creator orders, `features/deliveries/*` | Two-sided order loop |
| 25 | `25-creator-earnings-and-payouts.md` | Earnings center, transactions, payout requests | 17, 21, 24 | `features/earnings/*` | Ledger reconciliation |
| 26 | `26-dispute-system.md` | Buyer/creator disputes: create, thread, evidence, statuses | 17, 20, 24 | `features/disputes/*` | Cross-role dispute loop |
| 27 | `27-notifications-center.md` | Bell, notifications page, preferences, deep links, emit audit | 14–15, 21, 18–26 | `features/notifications/*`, useNotifications | Deep links; pref suppression |
| 28 | `28-admin-foundation-and-overview.md` | Admin nav structure, overview KPIs/charts/attention queues, admin kit | 09, 14, 27 | `features/admin/overview`, admin shared kit | KPI reconciliation; nav permissions |
| 29 | `29-admin-user-management.md` | User directory, user detail, suspend/blacklist/reactivate/verify | 09, 12–13, 28 | `features/admin/users` | Cross-surface enforcement |
| 30 | `30-admin-content-moderation.md` | Moderation queue + review workspace + reports + public report entries | 22, 24, 28–29 | `features/admin/moderation`, ReportDialog | All decision branches |
| 31 | `31-admin-marketplace-operations.md` | Admin requests/orders oversight, support tickets, announcements | 17, 23–24, 28 | `features/admin/operations` | Cancel/refund; broadcast |
| 32 | `32-admin-payments-and-settlements.md` | Ledger, escrow monitor, refunds, settlements, commissions | 17, 25, 28, 31 | `features/admin/finance` | Settlement cycle cross-role |
| 33 | `33-admin-dispute-resolution.md` | Dispute triage, workspace, binding resolutions (release/refund/partial) | 17, 26, 28–29, 31–32 | `features/admin/disputes` | 3 outcome paths ledger-verified |
| 34 | `34-affiliate-program.md` | Affiliate: capture→signup→conversion pipeline, buyer dashboard, admin management | 09, 17, 25, 28, 32 | `features/affiliate/*`, admin affiliates | Live pipeline end-to-end |
| 35 | `35-super-admin-platform-configuration.md` | Platform settings (general/commission/affiliate/moderation/features) + categories | 28 + consumers (17–34) | `features/admin/settings` | Live-effect change matrix |
| 36 | `36-super-admin-roles-and-audit.md` | Admin management, permission picker, roles matrix, audit log explorer | 28–29, 35 | `features/admin/team`, audit explorer | Fresh limited-admin reality test |
| 37 | `37-quality-hardening.md` | Full audit-and-fix: validation, errors, a11y, responsive, perf, motion, security | 01–36 | `docs/qa-checklist.md` + fixes | All sweeps + smokes green |
| 38 | `38-final-integration-and-release.md` | E2E certification, route×role matrix, prod build, README, Laravel migration guide | 01–37 | `docs/e2e-walkthrough.md`, `docs/laravel-migration-guide.md` | Full walkthrough on preview build |

## Phase map

- **Foundation (01–09):** tooling → design system → domain constants → component library → mock DB → API contract → services → routing → auth.
- **Public experience (10–13):** landing, info/policy pages, creator discovery, public profiles.
- **Dashboards & buyer flow (14–20):** dashboard framework, buyer overview/profile, request wizard, payment architecture, proposals, checkout, orders & review.
- **Creator flow (21–25):** overview/profile, portfolio + moderation submission, request board + proposals, delivery workspace, earnings & payouts.
- **Cross-cutting (26–27):** disputes, notifications.
- **Admin (28–33):** foundation/overview, users, moderation, operations, finance, dispute resolution.
- **Affiliate & super admin (34–36):** affiliate program, platform configuration, roles/permissions/audit.
- **Ship (37–38):** quality hardening, final integration + release + migration docs.

## Working agreements (summary — full version in 00)

1. Read `00-architecture-and-rules.md` before every prompt; inspect the repo before changing it.
2. Reuse existing components/services/constants; never rewrite working code without cause.
3. JavaScript/JSX only; no new dependencies; everything must run on Node 18.19.0.
4. Business logic lives in services/hooks; HTTP only in the API layer; statuses/routes only from constants.
5. Keep the app functional after every prompt: `npm run lint` (0 warnings) + `npm run build` + listed manual checks.
6. End every prompt run with a report: changes, assumptions, remaining issues.

## Troubleshooting

- **Claude Code drifts from the architecture** → stop, point it back to `00-architecture-and-rules.md` §16, and have it reconcile before continuing.
- **A prompt references something missing** → a previous prompt's acceptance criteria weren't met; return and complete them first.
- **Seed data feels stale/corrupted** → `npm run seed` regenerates `server/db.json` deterministically (never hand-edit it).
- **Node version issues** → confirm `node -v` is 18.19.0; all pinned versions in 00 §3 are chosen for it.
