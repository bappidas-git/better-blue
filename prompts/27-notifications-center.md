# Prompt 27 — Notifications Center & Preferences

> **Before you start:** Read `prompts/00-architecture-and-rules.md`, then inspect Prompts 01–26 output (notificationService + NOTIFICATION_META have been emitting since 07; DashboardLayout bell is a placeholder from 14).

## 1. Objective

Build the notification experience: live bell dropdown in the dashboard topbar, full notifications page per role, read/unread management, deep-link routing per notification type, notification preferences (respected at emit time), and an emit-coverage audit across all existing workflows.

## 2. Context

Every workflow prompt has been writing notifications via `notificationService.notify`. This prompt surfaces them and closes the loop: type→route deep links, preference filtering, and a systematic audit that no key event is silent.

## 3. What Already Exists

notificationService (list/unreadCount/markRead/markAllRead/notify/notifyAdmins) (07/26), NOTIFICATION_META with categories/icons/tones (03), bell placeholder with badge (14), notificationPrefs on users (05), settings slots in buyer/creator settings (15/21).

## 4. What to Implement

1. **Deep-link map** — `src/features/notifications/notificationRoutes.js`: `getNotificationPath(notification, role)` mapping every NOTIFICATION_TYPE + entityType/entityId to the correct role-aware route (proposal_received → buyer request detail proposals tab; delivery_submitted → buyer order detail; payment_released → creator earnings; dispute_* → role dispute detail; moderation_* → creator portfolio; account/system → settings/overview fallback). Unknown → role overview. Unit-style dev check: console.warn on unmapped types in dev.
2. **Bell dropdown** (replace 14 placeholder) — `NotificationBell` + popover (desktop) / full-screen SideSheet (mobile): header ("Notifications" + "Mark all read" when unread>0), latest 8 items (icon tile by meta tone, title, body 2-line clamp, relative time, unread dot + tinted bg), item click → markRead + navigate deep link + close; footer "View all"; empty state ("You're all caught up"); badge live-updates (poll: refetch unreadCount every 60s + on route change + on window focus — implement `useNotifications` hook centralizing this; document that real-time push is a Laravel/websocket future note).
3. `NotificationsPage` — mounted per role (`/buyer/notifications`, `/creator/notifications`, admin at `/admin/notifications` — same shared feature page): filter chips by category (All / Marketplace / Orders / Payments / Disputes / Moderation (creator/admin) / Affiliate / System) + Unread-only toggle; grouped by day headers (Today/Yesterday/date); infinite-ish "Load more" pagination (25/page); per-item mark read on click + kebab "Mark as read/unread"; "Mark all as read" header action (confirm if > 20); EmptyStates per filter.
4. **Preferences** — fill the 15/21 settings slots with shared `NotificationPreferences` component: per-category rows (label + description from meta categories) with In-app toggle (email column shown disabled + "Coming soon" tag — honest mock); persists to `users.notificationPrefs`; **emit-time enforcement**: `notificationService.notify` checks target's prefs (category from NOTIFICATION_META) and skips creation when disabled (system_announcement category cannot be disabled — document); default prefs all-on (05 seeds already set).
5. **Emit-coverage audit** — review every workflow built so far against `NOTIFICATION_TYPE` list; produce `docs/notifications-audit.md` table: event → emitter location → recipient(s) → type — and **fix any gaps found** (missing emits) as part of this prompt (small service edits allowed; list them in report). Known checklist: proposals (received/shortlisted? — shortlist currently may not notify: add `proposal_shortlisted` emit in 18's shortlist action if absent; accepted/declined), order paid, delivery submitted/accepted, revision requested, order completed, payment released, payout events (requested confirmation; processed arrives 32), disputes (opened/message/resolved arrives 33), moderation results (arrive 30 — mark table rows "emitter arrives P30"), account status (arrives 29), affiliate (arrives 34) — mark future rows explicitly.
6. navConfig: append Notifications for buyer/creator (badge = unread count via badgeKey mechanism — implement badge resolution in DashboardLayout via useNotifications); admin nav entry arrives with 28 (note for that prompt: reuse this page — leave the shared page role-agnostic).

## 5. Functional Requirements

Badge/dropdown/page stay consistent (single hook source); mark read/all-read round-trips; deep links land correctly for every seeded type; prefs toggle genuinely suppresses future emits (test: disable Orders for buyer → creator delivers → no new notification; re-enable → works); focus/route refetch keeps counts fresh.

## 6. UI/UX Requirements

Dropdown premium compact (360px width desktop popover); unread styling subtle (tint + dot, not loud); day grouping clean; Framer stagger on dropdown open (fast, 150ms); mobile sheet native-feel.

## 7. Technical Requirements

`useNotifications` hook (context-free; per-mount with shared module-level cache to avoid duplicate polls — keep simple, document); no per-component polling proliferation; deep-link map is data-driven; page shared across roles (role from auth).

## 8. API Requirements

Existing endpoints; markAllRead as batched PATCHes (mock; Laravel bulk endpoint noted).

## 9. Data Requirements

Seeds provide ≥ 12 varied-type notifications per demo user across categories/days (verify; extend + reseed + report).

## 10. Files & Folders

Creates: `src/features/notifications/pages/NotificationsPage.jsx`, `src/features/notifications/components/{NotificationBell,NotificationDropdown,NotificationItem,NotificationPreferences,CategoryFilterChips}.jsx`, `src/features/notifications/notificationRoutes.js`, `src/hooks/useNotifications.js`, `docs/notifications-audit.md`. Updates: DashboardLayout (bell), 15/21 settings slots, notify() pref-enforcement, gap-fix emits, routes/navConfig (buyer/creator).

## 11. Responsive Requirements

Bell → sheet on mobile; page list comfortable at 360px; toggles 44px; day headers sticky-scroll optional (keep simple).

## 12. Accessibility Requirements

Bell `aria-label="Notifications, 3 unread"`; dropdown keyboard navigable (arrow/Enter/Esc); unread conveyed in text (`aria-label` includes "unread"); page filters labeled; toggles with visible labels + state.

## 13. Validation & Error Handling

Poll failures silent (stale badge acceptable); markRead optimistic with rollback on failure; page errors → ErrorState retry.

## 14. Acceptance Criteria

- Bell/dropdown/page/badge all live and consistent; every seeded type deep-links correctly (spot-check 8 types).
- Preference suppression verified live (test above); audit doc complete with all gaps fixed or explicitly deferred-to-prompt-N.
- A11y keyboard pass on dropdown; lint + build clean.

## 15. Verification Steps

1. Reseed → dropdown/page walkthrough both demo roles; deep-link spot-checks.
2. Pref suppression live test (disable → trigger via other role → verify absent → re-enable).
3. Mark-all + unread-only + category filters; 360px sheet pass.
4. `npm run lint && npm run build`.

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

NOTIFICATION_META structure (03), workflow semantics (only add missing emits), `prompts/`.

## 18. Depends On

14 (bell slot), 15/21 (settings slots), 18/20/24/25/26 (emitters to audit), 07 (service).

## 19. Final Checklist

- [ ] Bell + dropdown/sheet + shared page + preferences complete
- [ ] Deep-link map covers all types; useNotifications single-source
- [ ] Emit-time pref enforcement + coverage audit doc + gaps fixed
- [ ] Badges via navConfig badgeKey working; lint + build clean
- [ ] Report written
