# Prompt 14 — Dashboard Framework (Shared Layout, Navigation & Widgets)

> **Before you start:** Read `prompts/00-architecture-and-rules.md` (especially §12 dashboard pattern, §13 responsive), then inspect Prompts 01–13 output.

## 1. Objective

Build the shared dashboard system used by buyer, creator, admin, and super admin: `DashboardLayout` (desktop sidebar + topbar; mobile app bar + bottom navigation + "More" sheet), role-driven nav configuration, and the reusable dashboard widget kit (stat grids, themed charts, activity feed, quick actions).

## 2. Context

One layout serves all roles (00 §12) to prevent architectural drift. Later prompts only append `navConfig` entries and build pages inside `DashboardPage`. On mobile this must feel like a native app: bottom nav, sheet menus, sticky headers.

## 3. What Already Exists

Auth + guards + placeholder role homes (09), routes mounted at `/buyer|/creator|/admin` (08/09), component library (04), Recharts installed (01), notification service (07; bell dropdown arrives Prompt 27 — placeholder now).

## 4. What to Implement

1. `src/routes/navConfig.jsx` — exported arrays `buyerNav`, `creatorNav`, `adminNav`: items `{ key, label, icon (iconify), path, roles? (admin granularity), permission?, badgeKey? }` **plus grouping** support `{ group: 'Marketplace', items: [...] }` for admin. Seed initial entries only for existing pages (Overview per role; Profile/Settings placeholders arrive 15/21). Include `MORE_NAV_KEYS` per role: which keys collapse into the mobile "More" sheet (bottom nav shows first 4 + More). Document the append-only rule in a header comment.
2. `src/layouts/dashboard/DashboardLayout.jsx` — resolves nav by `user.role` (admin variant filters items by `hasPermission` + super-admin-only entries via `roles`); renders:
   - **Desktop ≥ md:** fixed sidebar 264px (Logo mark+word, grouped nav with active states — soft primary-tint pill, icon+label; collapse toggle → 72px icon rail persisted in storage `bb.navCollapsed`; bottom section: user card (avatar, name, role chip) + View site + Log out), topbar (breadcrumb/page-title slot via `DashboardPageContext`, right: notification bell placeholder button (badge count from `notificationService.unreadCount`, opens Prompt-27 dropdown later — for now navigates to notifications path if registered, else no-op tooltip "Coming soon"), avatar menu (Profile, Settings, View site, Log out)).
   - **Mobile < md:** top app bar (page title, bell, avatar menu), fixed bottom nav (first 4 nav items + "More" → bottom sheet listing all remaining items with icons; active states; safe-area inset padding), content area with bottom padding for the bar.
3. `DashboardPage.jsx` (`src/layouts/dashboard/`) — standard page wrapper: sets title into topbar context + `useDocumentTitle`, consistent paddings (px 2/3/4 responsive, py 3), optional `actions`, `maxWidth` control; **all dashboard pages must use it**.
4. Widget kit (`src/features/dashboard/components/`):
   - `StatCardGrid` — responsive 2/2/4 grid of `StatCard`s with loading skeleton mode.
   - `ChartCard` — title, subtitle, action slot, height-managed body; children = chart.
   - `ThemedLineChart`, `ThemedBarChart`, `ThemedDonutChart` — Recharts wrappers pre-styled with palette (purple primary, pink secondary, neutral grid, rounded bars, gradient area fill option), responsive container, compact tick formatting (`formatNumberCompact`/`formatCurrency`), accessible fallback: `role="img"` + `aria-label` summary prop (required), empty-data state ("Not enough data yet").
   - `ActivityFeed` — renders notification-shaped items (icon by `NOTIFICATION_META`, title, body, relative time), loading/empty states, `onItemClick`.
   - `QuickActions` — icon+label action tiles (2-col mobile, row desktop).
   - `WelcomeBanner` — greeting by daypart + name + contextual subline (dismissable per-session).
5. Replace the three placeholder role-home pages with real `DashboardLayout` mounting: route-level layout per area (`/buyer` element = guards + DashboardLayout with Outlet; same pattern creator/admin); the index Overview pages remain placeholder cards ("Overview arrives in Prompt 15/21/28") but now render inside the real layout via `DashboardPage`.
6. Page-transition variant for dashboard outlet (150–200ms fade only — snappier than public).

## 5. Functional Requirements

Sidebar collapse persists; active nav matches nested routes (`/buyer/orders/ord_1` highlights Orders); bottom nav never exceeds 5 slots; bell badge shows live unread count (poll on route change); role switching (logout/login) renders correct nav; admin nav respects permissions (test with seeded limited admin).

## 6. UI/UX Requirements

Neutral surfaces, sidebar on `background.paper` with hairline divider; active pill + icon tint; dense-but-breathing spacing; mobile bottom nav 64px with labels (10–11px) + icons; sheet menu spring ≤ 350ms; premium feel per 00 §6.

## 7. Technical Requirements

Layout components contain zero business logic (data via services/hooks only for bell count + user); navConfig is data, not JSX conditionals scattered in layout; `DashboardPageContext` for title/actions.

## 8. API Requirements

`notificationService.unreadCount(userId)` only.

## 9. Data Requirements

Seeded unread notifications make badges non-zero for demo users.

## 10. Files & Folders

Creates: `src/layouts/dashboard/{DashboardLayout,SidebarNav,TopBar,MobileBottomNav,MoreSheet,DashboardPage,DashboardPageContext}.jsx`, `src/routes/navConfig.jsx`, `src/features/dashboard/components/{StatCardGrid,ChartCard,ThemedLineChart,ThemedBarChart,ThemedDonutChart,ActivityFeed,QuickActions,WelcomeBanner}.jsx`. Updates: router area mounting, placeholder overview pages, dev gallery (add Widgets tab demoing charts/feed with fixture data).

## 11. Responsive Requirements

Breakpoint md is the layout switch; test 360 (bottom nav + sheet), 768 (still bottom nav), 900+ (sidebar), 1280 (collapse toggle); content never hides behind fixed bars (padding + safe-area).

## 12. Accessibility Requirements

Sidebar `nav aria-label="Dashboard"`; bottom nav `aria-label` + `aria-current`; More sheet focus trap; collapse toggle `aria-expanded`; charts require `ariaLabel` prop (lint-visible via required-prop JSDoc + console.warn in dev when missing); bell button labeled with unread count.

## 13. Validation & Error Handling

Unread-count failure silently shows no badge (never blocks layout); unknown nav icon falls back to a default icon.

## 14. Acceptance Criteria

- All four roles see correct layout/nav on mobile + desktop; collapse persists; active states correct on deep routes.
- Widgets tab renders all charts themed + accessible labels + empty states.
- Limited-permission seeded admin sees a reduced nav.
- Lint + build clean.

## 15. Verification Steps

1. Login matrix (4 roles) × (360px, 1280px) — nav, badges, sheet, collapse.
2. Deep-route active-state check; keyboard pass on sidebar/bottom nav/sheet.
3. Dev gallery widget review incl. reduced-motion.
4. `npm run lint && npm run build`.

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

Guard logic (09), public layout, component library, `prompts/`.

## 18. Depends On

04, 07, 08, 09.

## 19. Final Checklist

- [ ] DashboardLayout (sidebar/topbar/bottom-nav/More sheet) for all roles
- [ ] navConfig data-driven with permission filtering + append-only doc
- [ ] DashboardPage wrapper + full widget kit (charts themed + a11y)
- [ ] Bell badge live; placeholders mounted in real layout
- [ ] Lint + build clean; report written
