# 00 — BetterBlue Architecture & Permanent Project Rules

> **This file is never "executed."** It is the single source of truth for the entire BetterBlue build.
> Every implementation prompt (01–38) requires Claude Code to read this file **before touching any code**.
> If an implementation prompt ever appears to conflict with this document, follow this document and report the conflict.

---

## 1. Product Identity & Positioning (Non-Negotiable)

BetterBlue is a **professional creator marketplace for business-oriented user-generated content (UGC)**. Businesses (buyers) commission creators to produce legitimate commercial photos and videos: brand promotion, product marketing, social media content, testimonials, advertising campaigns, website content, lifestyle/product demonstrations.

- It is **NOT** an adult-content, dating, escort, or erotic-content platform. Never frame, name, style, or illustrate anything in that direction.
- Approved vocabulary: Creator, Buyer, Business, Commercial Content, UGC, Marketing Content, Promotional Content, Campaign, Content Request, Proposal, Order, Deliverable, Portfolio, Sample Work, Brand Content, Trust & Safety, Content Policy, Moderation, Content Review, Policy Violation, Restricted Content, Marketplace Safety.
- The moderation system is a normal professional trust-and-safety system. The Content Policy prohibits: nudity, pornographic or sexually explicit content, sexual services or solicitation, escort-related services, illegal content, exploitative content, and any inappropriate content involving minors. State these rules in policy/moderation copy plainly and professionally — they must never become the visual identity, branding, or theme of the product.
- **All dummy data, sample content, imagery, names, and copy must be business-safe**: restaurant promos, fashion/product shoots, fitness brands, travel/hospitality, SaaS, beauty products, food products, e-commerce, local businesses, education, real estate, events.
- Placeholder images: use `https://picsum.photos/seed/<stable-seed>/<w>/<h>` (generic professional photography) and locally generated initials-avatars/SVGs. Never hotlink content that could be inappropriate. All image URLs flow through `src/constants/images.js` helpers so the client can replace them later.

## 2. Non-Negotiable Technical Rules

1. **Node.js 18.19.0** is the development runtime. Every dependency and script must work on it. `package.json` sets `"engines": { "node": ">=18.19.0" }`.
2. **React ^18.2.0**, JavaScript only. Allowed source file types: `.js`, `.jsx`, `.json`, `.css`, `.module.css`, plus standard config/docs (`.md`, `.html`, `.svg`, `.mjs` for Node scripts). **Never** create `.ts`/`.tsx`, never add TypeScript tooling.
3. **No new dependencies, ever.** The complete approved dependency set (Section 3) is installed once in Prompt 01. If a prompt seems to need a new package, implement it with the approved set and report the gap.
4. All HTTP goes through the API layer (`src/services/`). Components never call `axios`/`fetch` directly and never contain JSON-Server-specific behavior.
5. Statuses, roles, and enum-like strings are **only** imported from `src/constants/`. Never write literals like `"pending"` inline in components or services.
6. Routes are only referenced through `src/routes/paths.js` helpers. Never hardcode URL strings in components.
7. Keep the app runnable at the end of every prompt: `npm run lint`, `npm run build`, and `npm run dev:all` must all succeed.

## 3. Approved Dependency Set (installed in Prompt 01, never modified after)

**dependencies**
`react ^18.2.0` · `react-dom ^18.2.0` · `react-router-dom ^6.26.1` · `@mui/material ^5.16.7` · `@emotion/react ^11.13.0` · `@emotion/styled ^11.13.0` · `@mui/x-date-pickers ^6.20.2` · `@iconify/react ^4.1.1` · `framer-motion ^11.3.0` · `gsap ^3.12.5` · `axios ^1.7.4` · `dayjs ^1.11.12` · `recharts ^2.12.7` · `@fontsource/inter ^5.0.20` · `@fontsource/plus-jakarta-sans ^5.0.21`

**devDependencies**
`vite ^5.4.2` · `@vitejs/plugin-react ^4.3.1` · `eslint ^8.57.0` · `eslint-plugin-react ^7.35.0` · `eslint-plugin-react-hooks ^4.6.2` · `eslint-plugin-react-refresh ^0.4.9` · `json-server 0.17.4` (exact pin — 1.x betas change REST behavior) · `concurrently ^8.2.2`

All verified compatible with Node 18.19.0 and React 18. Icons come from `@iconify/react` (use professional sets, e.g. `solar:*`, `tabler:*`); do not add `@mui/icons-material`.

## 4. Commands, Ports, Environment

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server, port **5173** |
| `npm run api` | `json-server --watch server/db.json --port 4000 --delay 300` |
| `npm run dev:all` | `concurrently -n web,api -c auto "npm:dev" "npm:api"` |
| `npm run seed` | `node scripts/seed-db.js` → regenerates `server/db.json` |
| `npm run build` / `npm run preview` | Production build / preview |
| `npm run lint` | `eslint src --ext .js,.jsx --max-warnings 0` |
| `npm run smoke:api` | Node smoke test against running JSON Server (Prompt 07) |
| `npm run smoke:workflow` | Order/payment workflow smoke test (Prompt 17) |

Environment (`.env` + committed `.env.example`; read only via `src/config/env.js`):
`VITE_API_BASE_URL=http://localhost:4000` · `VITE_API_PROVIDER=json-server` · `VITE_APP_NAME=BetterBlue` · `VITE_ENABLE_DEV_PAGES=true`

Dev-only routes (`/dev/*`) render only when `import.meta.env.DEV && env.enableDevPages`.

## 5. Canonical Folder Structure

```
betterblue/
├── prompts/                  # this prompt system (never modified by implementation prompts)
├── docs/                     # api-contract.md, data-model.md, payments.md, qa-checklist.md, e2e-walkthrough.md, laravel-migration-guide.md
├── scripts/                  # seed-db.js, seed-data/*.js, smoke-*.mjs (plain Node 18, no deps)
├── server/                   # db.json (generated by seed — never hand-edited)
├── public/                   # favicon.svg, static assets
└── src/
    ├── main.jsx
    ├── app/                  # App.jsx, AppProviders.jsx
    ├── assets/brand/         # logo SVGs
    ├── components/
    │   ├── brand/            # Logo
    │   ├── feedback/         # EmptyState, ErrorState, ToastProvider, ConfirmDialogProvider, skeletons/
    │   ├── data-display/     # StatusChip, StatCard, UserAvatar, RatingStars, KeyValueList, TimelineList, PaginationControl, MediaLightbox
    │   ├── inputs/           # SearchInput, SortSelect, FilterChipGroup, FormTextField, FormSelect, FormDateField, FormFileField, CurrencyField
    │   ├── layout/           # PageHeader, Section, ResponsiveDialog, SideSheet, StickyActionBar
    │   ├── table/            # DataTable (+ mobile card mode)
    │   ├── motion/           # PageTransition, FadeInView, StaggerList, AnimatedNumber, motionPresets.js
    │   └── navigation/       # PublicTopNav, PublicFooter (dashboard nav lives in layouts/dashboard)
    ├── config/               # env.js, appConfig.js
    ├── constants/            # roles.js, statuses.js, permissions.js, policy.js, images.js, notificationTypes.js, index.js
    ├── context/              # AuthContext.jsx (others colocated with their providers)
    ├── features/             # feature modules; each owns pages/ + components/ (+ hooks/ utils/ as needed)
    │   ├── auth/  landing/  staticPages/  discovery/  creatorProfile/  dashboard/
    │   ├── requests/  proposals/  orders/  checkout/  payments/  deliveries/
    │   ├── portfolio/  earnings/  disputes/  notifications/  affiliate/  reviews/
    │   └── admin/            # overview/ users/ moderation/ operations/ finance/ disputes/ settings/ roles/ audit/
    ├── hooks/                # useApiQuery, useApiMutation, usePaginatedQuery, useDebounce, useForm, useDocumentTitle, useFeatureFlag
    ├── layouts/              # PublicLayout, AuthLayout, dashboard/DashboardLayout (+ TopBar, SidebarNav, MobileBottomNav)
    ├── routes/               # index.jsx (router), paths.js, guards.jsx, navConfig.jsx
    ├── services/             # api/ (apiClient, apiError, listAdapter) + one service per domain + payments/ providers
    ├── styles/               # global.css, tokens.css
    ├── theme/                # index.js, palette.js, typography.js, components.js, motionTokens.js
    └── utils/                # formatters.js, validators.js, stateMachine.js, storage.js, id.js, exportCsv.js
```

Naming: components `PascalCase.jsx` (+ `PascalCase.module.css` when CSS Modules are needed); hooks `useThing.js`; services `thingService.js`; utils/constants `camelCase.js`. Path alias `@/` → `src/` (jsconfig + vite config).

## 6. Design System (locked tokens)

- **Palette** — primary purple: main `#7C3AED`, light `#A78BFA`, dark `#5B21B6`, tints `#F5F3FF`/`#EDE9FE`. Secondary pink: main `#EC4899`, light `#F9A8D4`, dark `#BE185D`, tint `#FDF2F8`. Brand gradient token: `linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)` — reserved for hero accents, primary CTAs, logo, small highlights. Never wash whole surfaces in gradient.
- **Neutrals** — background default `#FAFAFC`, paper `#FFFFFF`, text primary `#171223`, text secondary `#6E6880`, divider `#E5E2EC`. Semantic: success `#16A34A`, warning `#F59E0B`, error `#DC2626`, info `#0EA5E9`.
- **Typography** — display/headings: "Plus Jakarta Sans" (600–800); body/UI: "Inter" (400–600). Loaded via @fontsource in Prompt 02.
- **Shape** — base radius 12; cards 16; buttons 10 (hero CTAs pill); dialogs/sheets 20. **Shadows** — 3 subtle elevation levels only; no heavy drop shadows, no glassmorphism.
- **Spacing** — MUI 8px scale; page gutter `px: { xs: 2, md: 4 }`; section vertical rhythm 48–96px.
- **Styling rules** — theme + `sx` for layout/spacing; CSS Modules for bespoke visuals; never hardcode hex values outside `src/theme` + `src/styles/tokens.css`; no inline `style=` attributes except truly dynamic values (e.g., progress width).
- Light theme only (dark mode is a documented future enhancement).

## 7. Motion Rules

- **Framer Motion** = product UI: page transitions, list stagger, dialogs, micro-interactions, in-view reveals. **GSAP (+ScrollTrigger)** = marketing surfaces only (landing hero, landing scroll scenes). Never both on the same element.
- Tokens in `src/theme/motionTokens.js`: durations 150/250/400/650ms; easing `[0.22, 1, 0.36, 1]` (ease-out-expo-like). Shared variants in `src/components/motion/motionPresets.js`.
- Animate `transform`/`opacity` only; no layout-thrashing properties; no scroll-jacking; keep interactions < 400ms.
- `<MotionConfig reducedMotion="user">` wraps the app; GSAP effects check `prefers-reduced-motion` and fall back to static layouts. This is mandatory for every animation added in any prompt.

## 8. Domain Model (collections in `server/db.json`)

`users`, `buyerProfiles`, `creatorProfiles`, `portfolioItems`, `categories`, `contentRequests`, `proposals`, `orders`, `deliveries`, `revisions`, `payments`, `transactions`, `commissions`, `payouts`, `disputes`, `disputeMessages`, `reviews`, `notifications`, `moderationReviews`, `reports`, `supportTickets`, `affiliateProfiles`, `affiliateReferrals`, `affiliateEarnings`, `auditLogs`, `platformSettings` (singleton object).

- IDs are **opaque strings** with entity prefixes: `usr_`, `bpr_`, `cpr_`, `pfi_`, `cat_`, `req_`, `prp_`, `ord_`, `dlv_`, `rev_`, `pay_`, `txn_`, `com_`, `pyo_`, `dsp_`, `dmsg_`, `rvw_`, `ntf_`, `mod_`, `rpt_`, `tkt_`, `aff_`, `ref_`, `aer_`, `aud_`. New records get IDs from `src/utils/id.js` (`generateId('ord')`) inside services only — documented as a JSON-Server-era behavior Laravel will replace.
- Foreign keys are `somethingId` fields (`buyerId`, `creatorId`, `orderId`, …). One order = one request + one accepted proposal (no orderItems; documented decision).
- Money: decimal numbers + `currency: "USD"` fields; format only via `formatCurrency`. Dates: ISO 8601 strings; format via dayjs helpers in `formatters.js`.
- `server/db.json` is **generated** — extend `scripts/seed-data/*.js` and re-run `npm run seed`; never hand-edit db.json.

## 9. Enums & State Machines (authoritative — defined in `src/constants/`, Prompt 03)

- **ROLES**: `buyer`, `creator`, `admin`, `super_admin`. Role home routes: buyer → `/buyer`, creator → `/creator`, admin/super_admin → `/admin`.
- **ACCOUNT_STATUS**: `active`, `suspended`, `blacklisted`, `deactivated`. (Blacklist/suspend are statuses — users are never deleted.)
- **REQUEST_STATUS**: `draft`, `open`, `awarded`, `completed`, `cancelled`, `closed`.
- **PROPOSAL_STATUS**: `submitted`, `shortlisted`, `accepted`, `declined`, `withdrawn`, `expired`.
- **ORDER_STATUS**: `pending_payment`, `in_progress`, `delivered`, `revision_requested`, `completed`, `cancelled`, `disputed`, `refunded`.
  Transitions: `pending_payment→in_progress|cancelled`; `in_progress→delivered|disputed|cancelled`; `delivered→revision_requested|completed|disputed`; `revision_requested→delivered|disputed|cancelled`; `disputed→completed|refunded|cancelled`.
- **PAYMENT_STATUS**: `initiated`, `processing`, `held`, `released`, `refunded`, `partially_refunded`, `failed`.
- **TRANSACTION_TYPE**: `charge`, `release`, `refund`, `partial_refund`, `commission`, `payout`, `affiliate_commission`.
- **DELIVERY_STATUS**: `submitted`, `revision_requested`, `accepted`.
- **CONTENT_STATUS** (portfolio/deliverable moderation lifecycle): `draft`, `submitted`, `under_review`, `approved`, `rejected`, `revision_required`, `published`, `restricted`, `archived`.
- **DISPUTE_STATUS**: `open`, `under_review`, `awaiting_buyer`, `awaiting_creator`, `escalated`, `resolved`, `closed`. **DISPUTE_RESOLUTION**: `release_payment`, `full_refund`, `partial_refund`.
- **PAYOUT_STATUS**: `requested`, `processing`, `paid`, `rejected`.
- **AFFILIATE**: profile `active`/`suspended`; referral `pending`/`converted`/`expired`; earning `pending`/`approved`/`paid`/`void`.
- **CONTENT_TYPE**: `photo`, `video`, `bundle`. **NOTIFICATION_TYPE**: defined in `constants/notificationTypes.js`.
- Every status has metadata `{ label, tone, description }` (`STATUS_META`) powering `StatusChip`. Transition maps are enforced by `utils/stateMachine.js#assertTransition(machine, from, to)` inside services — UI never mutates statuses directly.

## 10. API Layer Rules

- `services/api/apiClient.js`: single axios instance, `baseURL` from env, interceptors attach `Authorization: Bearer <token>` and normalize failures into `ApiError { status, code, message, details }`.
- `services/api/listAdapter.js` is the **only** place aware of provider specifics. Standard list params `{ page, limit, sort, order, search, filters }` map to JSON Server (`_page`, `_limit`, `_sort`, `_order`, `q`, `field`, `field_gte/_lte`) and list responses normalize to `{ items, total, page, limit }` (JSON Server: array + `X-Total-Count`). Swapping to Laravel = swapping this adapter + base URL.
- One service per domain exposing **intention-named** functions (`proposalService.submitProposal`, `orderService.acceptProposal`, `paymentService.releasePayment`, …). With JSON Server these orchestrate multiple REST calls client-side; the Laravel backend will do the same work server-side behind the same function signature. Never use `_embed`/`_expand`.
- Cross-cutting emits: workflow mutations call `notificationService.notify(...)` and (for admin/sensitive actions) `auditService.log(...)`. Later prompts may **extend** existing services with new functions or add documented integration calls, but must not change existing signatures.
- Server state via `hooks/useApiQuery` / `useApiMutation` / `usePaginatedQuery` (`{ data, isLoading, error, refetch }` / `{ mutate, isLoading, error }`). No Redux, no react-query. Global client state only: `AuthContext`, `ToastProvider`, `ConfirmDialogProvider`, notifications hook.

## 11. RBAC Rules

- Guards in `routes/guards.jsx`: `GuestRoute`, `ProtectedRoute`, `RoleRoute(roles)`. Admin granularity via `permissions.js` (keys like `users.manage`, `moderation.review`, `disputes.resolve`, `payments.manage`, `settlements.process`, `content.manage`, `settings.manage`, `admins.manage`) + `hasPermission(user, key)` + `PermissionGate` component. `super_admin` implicitly has all permissions; admins carry a `permissions` array.
- Suspended/blacklisted users cannot log in and are force-logged-out on revalidation, with respectful status screens.
- **Documented everywhere relevant:** frontend guards are UX only — the future Laravel API must independently enforce all authorization.

## 12. Standard UX Patterns (use these, don't invent variants)

- **List pages**: PageHeader → toolbar (SearchInput + filters + SortSelect) → content (DataTable on desktop / cards on mobile) → PaginationControl. Filters sync to URL query params. Loading = matching skeletons; error = `ErrorState` with retry; empty = `EmptyState` with icon + primary action.
- **Detail pages**: PageHeader with back button + StatusChip + actions; content in cards/tabs; mobile action buttons in `StickyActionBar`.
- **Destructive/irreversible actions** (cancel, reject, suspend, blacklist, resolve, refund): always `useConfirm()` dialog with explicit consequence copy; reason field where the domain requires it.
- **Feedback**: every mutation → success/error toast via `useToast()`; buttons show loading state and disable while pending.
- **Dialogs**: `ResponsiveDialog` (modal ≥ md, full-screen/bottom-sheet below). Forms via `useForm` + `validators` + `Form*` field components; errors inline under fields; first invalid field focused on submit.
- **Dashboards**: shared `DashboardLayout` (desktop sidebar + topbar; mobile app bar + bottom nav ≤ 5 items + "More" sheet). Nav items live in `routes/navConfig.jsx`; each prompt **appends** its entries with stable `key`s — never rebuild nav from scratch.

## 13. Responsive & Accessibility Baseline

- Mobile-first at MUI defaults (sm 600 / md 900 / lg 1200). Sidebar appears ≥ md; bottom nav < md. Touch targets ≥ 44px. Tables must render as cards on mobile (DataTable handles it). Test 360px width minimum.
- Semantic landmarks (`header/nav/main/footer`), labeled inputs, alt text everywhere, visible `:focus-visible` rings, focus trap + Escape + focus-return in dialogs, keyboard-reachable actions, AA contrast with the token palette, ARIA only where semantics fall short, `useDocumentTitle` on every page.

## 14. Security & Privacy Rules

- No secrets/credentials in source; configurable values via env. Mock auth (JSON Server can't authenticate) lives entirely in `authService` + `apiClient` and is clearly commented `MOCK-AUTH:` with the Laravel replacement path documented.
- Role-gated routes AND role-gated UI, confirmation for destructive actions, input validation on every form, no `dangerouslySetInnerHTML`, uploaded-file metadata sanitized for display, audit logs for admin/sensitive actions.

## 15. Laravel/MySQL Migration Principles

The mock stack (JSON Server + client-side orchestration + mock auth + dummy payments + mock uploads) is isolated behind: `env.js` (base URL), `listAdapter.js`, `authService`, `payments/` providers, `uploadService`, and `utils/id.js`. `docs/api-contract.md` (Prompt 06) defines the target REST contract; `docs/laravel-migration-guide.md` (Prompt 38) documents the swap steps. Nothing outside the services layer may depend on JSON Server behavior.

## 16. Claude Code Execution Protocol (applies to every prompt)

1. Read `prompts/00-architecture-and-rules.md` (this file) first.
2. Inspect the existing project (folder tree, relevant files, `git log`/recent changes if available) and understand what previous prompts built.
3. Never rewrite working code unnecessarily; make additive, minimal-diff changes.
4. Reuse existing components, hooks, services, constants; search `src/components` and `src/services` before creating anything new.
5. Follow this architecture exactly (structure, naming, tokens, patterns).
6. Keep the application fully functional after your change.
7. Verify dependency compatibility with Node 18.19.0; **install nothing new**.
8. JavaScript/JSX only — never TypeScript.
9. No business logic in presentation components; API calls only in services.
10. Maintain responsive + accessibility + reduced-motion behavior for everything you touch.
11. After implementing: run `npm run lint` and `npm run build` (plus listed manual checks); fix every issue you introduced.
12. Finish with a report: what changed (files/modules), assumptions made, anything remaining or deferred.

## 17. Definition of Done (every prompt)

Lint passes with zero warnings · build succeeds · app boots with `npm run dev:all` · new screens have loading/empty/error states · mobile 360px and desktop 1280px verified · enums/routes come from constants · acceptance criteria of the prompt met · report written.

## 18. Glossary

**Content Request** — a buyer's brief for commercial content. **Proposal** — a creator's priced offer on a request. **Order** — the funded engagement created when a proposal is accepted. **Escrow/Held** — buyer's payment held by BetterBlue until acceptance. **Deliverable** — content submitted for an order. **Revision** — buyer-requested change within the order's included revisions. **Release** — escrow paid out to creator minus commission. **Commission** — BetterBlue's percentage fee. **Settlement/Payout** — transfer of released earnings to the creator. **Moderation** — trust-and-safety review of content against the Content Policy.
