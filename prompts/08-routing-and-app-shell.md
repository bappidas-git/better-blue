# Prompt 08 — Routing & Application Shell

> **Before you start:** Read `prompts/00-architecture-and-rules.md` (especially §5, §12, §13), then inspect Prompts 01–07 output.

## 1. Objective

Establish the routing architecture (react-router v6 with lazy loading and path constants), the public layout (top navigation + footer), auth layout, error boundary, 404, scroll behavior, page transitions, and document-title handling — the shell every page mounts into.

## 2. Context

All route paths for the entire application are declared now (constants), even though most pages arrive later — later prompts register elements into prepared route-config arrays without restructuring the router. Guards are wired in Prompt 09.

## 3. What Already Exists

Theme + components (02/04), services/hooks (07), dev gallery mounted crudely in `App.jsx`.

## 4. What to Implement

1. `src/routes/paths.js` — frozen path constants + builder functions for **every** route in the product, grouped and commented by owning prompt: public (`HOME '/'`, `CREATORS '/creators'`, `creatorProfile(id)`, `REQUESTS '/requests'`, `requestDetail(id)`, `HOW_IT_WORKS`, `CONTENT_POLICY`, `PRICING`, `FAQ`, `ABOUT`, `CONTACT`, `TERMS`, `PRIVACY`, `referral(code) '/r/:code'`, `LOGIN`, `REGISTER`), buyer (`BUYER '/buyer'`, `BUYER_REQUESTS`, `BUYER_REQUEST_NEW`, `buyerRequestDetail(id)`, `buyerCheckout(orderId)`, `BUYER_ORDERS`, `buyerOrderDetail(id)`, `BUYER_PAYMENTS`, `BUYER_DISPUTES`, `buyerDisputeDetail(id)`, `BUYER_AFFILIATE`, `BUYER_NOTIFICATIONS`, `BUYER_PROFILE`, `BUYER_SETTINGS`), creator (`CREATOR '/creator'`, `CREATOR_BROWSE`, `CREATOR_PROPOSALS`, `CREATOR_ORDERS`, `creatorOrderDetail(id)`, `CREATOR_PORTFOLIO`, `CREATOR_EARNINGS`, `CREATOR_DISPUTES`, `creatorDisputeDetail(id)`, `CREATOR_NOTIFICATIONS`, `CREATOR_PROFILE`, `CREATOR_SETTINGS`), admin (`ADMIN '/admin'`, `ADMIN_USERS`, `adminUserDetail(id)`, `ADMIN_MODERATION`, `adminModerationDetail(id)`, `ADMIN_REQUESTS`, `ADMIN_ORDERS`, `adminOrderDetail(id)`, `ADMIN_PAYMENTS`, `ADMIN_SETTLEMENTS`, `ADMIN_COMMISSIONS`, `ADMIN_DISPUTES`, `adminDisputeDetail(id)`, `ADMIN_REPORTS`, `ADMIN_SUPPORT`, `ADMIN_ANNOUNCEMENTS`, `ADMIN_AFFILIATES`, `ADMIN_ADMINS`, `ADMIN_ROLES`, `ADMIN_SETTINGS`, `ADMIN_CATEGORIES`, `ADMIN_AUDIT`, `ADMIN_NOTIFICATIONS`), dev (`DEV_DESIGN '/dev/design'`).
2. Route config modules — `src/routes/{publicRoutes,buyerRoutes,creatorRoutes,adminRoutes}.jsx`: arrays of `{ path, element }` using `React.lazy` imports; initially only routes whose pages exist (home placeholder, dev design); later prompts append entries here.
3. `src/routes/index.jsx` — `createBrowserRouter`: PublicLayout branch (public routes + 404 catch-all), AuthLayout branch (login/register placeholders for Prompt 09), dashboard branches mounted under `/buyer`, `/creator`, `/admin` (empty shells until Prompts 09/14), dev route gated by `env.enableDevPages && import.meta.env.DEV`. Global `Suspense` fallback: branded full-screen loader (logo mark + subtle pulse).
4. `src/layouts/PublicLayout.jsx` — `PublicTopNav` + `<main>` (Outlet wrapped in `PageTransition` keyed by pathname) + `PublicFooter`; `ScrollRestoration`/scroll-to-top on navigation.
5. `src/components/navigation/PublicTopNav.jsx` — sticky, elevates subtly after 8px scroll; Logo (links home); links: Find Creators, Browse Requests, How It Works, Pricing; right side: Log in (text) + Join BetterBlue (gradient CTA); auth-aware section arrives in Prompt 09 (leave a clearly-marked slot). Mobile < md: hamburger → full-height Framer drawer with staggered links.
6. `src/components/navigation/PublicFooter.jsx` — 4 columns desktop / accordion-free stacked mobile: Marketplace, Company, Trust & Safety (Content Policy, Terms, Privacy), Support; logo + one-line mission + © line ("© 2026 BetterBlue. Professional commercial content marketplace."); all links via `paths`.
7. `src/layouts/AuthLayout.jsx` — split layout: left brand panel (gradient wash, logo, short value copy — hidden < md), right centered card slot (Outlet).
8. `src/features/staticPages/pages/NotFoundPage.jsx` — 404 with mark, message, CTAs (Home / Find Creators).
9. `src/app/ErrorBoundary.jsx` (class component) wrapping the router + `RouteErrorElement` for router-level errors: friendly "Something went wrong", Reload + Home actions, dev-only stack detail.
10. `src/hooks/useDocumentTitle.js` — `useDocumentTitle('Find Creators')` → "Find Creators · BetterBlue"; apply to all pages created here.
11. `src/features/landing/pages/HomePage.jsx` — **temporary placeholder** (hero headline + CTA links) explicitly marked `// TEMP: replaced in Prompt 10`; move DevDesignPage mount to `/dev/design`; `App.jsx` becomes just `RouterProvider`.

## 5. Functional Requirements

Deep links work (BrowserRouter + Vite SPA fallback); 404 catches unknown paths; nav highlights active link (`NavLink`); transitions don't break back/forward; document titles update per page.

## 6. UI/UX Requirements

Premium minimal shell per 00 §6; top nav 64px (56px mobile); footer neutral dark-on-light; page transition = fade + 8px rise, 250ms; drawer nav feels native (stagger, spring ≤ 400ms).

## 7. Technical Requirements

Every page lazy-loaded; no path string literals outside `paths.js` (grep-verifiable); layouts contain zero business logic.

## 8. API Requirements

None new.

## 9. Data Requirements

None.

## 10. Files & Folders

Creates: `src/routes/{paths.js,index.jsx,publicRoutes.jsx,buyerRoutes.jsx,creatorRoutes.jsx,adminRoutes.jsx}`, `src/layouts/{PublicLayout,AuthLayout}.jsx`, `src/components/navigation/{PublicTopNav,PublicFooter}.jsx`, `src/features/staticPages/pages/NotFoundPage.jsx`, `src/app/ErrorBoundary.jsx`, `src/hooks/useDocumentTitle.js`, `src/features/landing/pages/HomePage.jsx` (temp). Updates: `App.jsx`.

## 11. Responsive Requirements

Nav: links hidden < md behind drawer; footer stacks; 360px no horizontal scroll; touch targets ≥ 44px.

## 12. Accessibility Requirements

`<nav aria-label>`, skip-to-content link (visually hidden, focusable, jumps to `<main id="main">`), drawer focus trap + Escape + focus return, active link `aria-current="page"`, 404 has `h1`.

## 13. Validation & Error Handling

ErrorBoundary catches a thrown render error (test with a temporary throw, then remove); unknown routes → 404 (not blank).

## 14. Acceptance Criteria

- `/`, `/dev/design`, unknown → 404 all render inside PublicLayout with transitions; drawer works at 360px; skip-link functions; titles update.
- Grep: no `'/creators'`-style literals outside `paths.js`.
- Lint + build clean; `vite preview` serves deep links.

## 15. Verification Steps

1. Navigate all mounted routes at 360px + 1280px; test back/forward with transitions.
2. Keyboard pass: skip link, nav, drawer.
3. Temporary error-throw test for boundary; remove it.
4. `npm run lint && npm run build && npm run preview` (deep-link `/dev/design`).

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

Service layer, component library APIs, theme, `prompts/`.

## 18. Depends On

02, 04, 07 (03 for constants).

## 19. Final Checklist

- [ ] Complete `paths.js` for the entire product + builders
- [ ] Router with lazy loading, Suspense loader, 404, ErrorBoundary
- [ ] PublicTopNav (+ mobile drawer) & PublicFooter finished
- [ ] AuthLayout ready for Prompt 09; dev gallery at /dev/design
- [ ] A11y (skip link, traps, aria-current) verified; lint + build clean; report written
