# Prompt 31 — Admin Marketplace Operations (Requests, Orders, Support, Announcements)

> **Before you start:** Read `prompts/00-architecture-and-rules.md`, then inspect Prompts 01–30 output (admin kit, order/dispute/payment services).

## 1. Objective

Build admin marketplace operations: platform-wide request oversight (close/unpublish with reasons), order oversight (full context, cancel-with-refund intervention), support ticket handling, and platform announcements (targeted broadcast notifications).

## 2. Context

Admins observe everything and intervene exceptionally — interventions ride existing service workflows (17's cancel/refund) with audit + notifications, never ad-hoc status edits. Permissions: `requests.manage`, `orders.manage`, `support.manage`, `announcements.send`.

## 3. What Already Exists

Admin kit + gated nav entries (28), orderService (incl. cancelOrder w/ admin path 17), getOrderTimeline (20), supportTickets writing from Contact (11), notificationService (+broadcast need), auditService, seeded tickets/orders/requests (05).

## 4. What to Implement

1. `AdminRequestsPage` (`/admin/requests`) — DataTable: title (→ detail sheet), buyer EntityRefChip, category, budget, status, proposals count, created; filters (status/category/date), search, sort, CSV export; row detail `SideSheet`: full `RequestBriefView` (23's shared component) + proposals summary + actions: **Close request** (open only; confirm `requireReason` — policy/administrative closure; request → `closed`, notify buyer + proposers with reason, audit `request.close`), **Reopen** (closed→open? machine lacks it — **follow machine: no reopen; omit**; report), link "View public" when board enabled.
2. `AdminOrdersPage` (`/admin/orders`) + `AdminOrderDetailPage` (`/admin/orders/:id`) — list: order id short, title, buyer + creator EntityRefChips, price, StatusChip, payment StatusChip, created, due (AgeBadge overdue); filters (order status, payment status, date, category), search, export; detail: full context — parties cards, money card (price/commission/net + payment state + transactions list for this order), `RequestBriefView` collapsible, delivery versions (shared components from 24), full TimelineList, linked dispute banner (→ P33 gated link); **interventions** (kebab, `orders.manage` + confirm `requireReason`): Cancel order (active states; triggers cancelOrder admin path → refund via paymentService when held; notify both; audit `order.cancel`), Add internal note (auditLogs entry `order.note` — surfaced in timeline admin-view only); interventions annotated "Exceptional action — prefer dispute resolution flow".
3. `AdminSupportPage` (`/admin/support`) — ticket list (subject, requester (user link or email), StatusChip, AgeBadge, updated); filters/search; ticket detail SideSheet: original message, requester context (user bundle link when registered), reply composer (appends to `replies[]` with adminId + timestamp; sets status `pending`), status actions (Resolve w/ optional closing note → `resolved`; Close → `closed`; Reopen → `open`); replies rendered as thread; **note**: replies are recorded in-app only (no email in mock — visible to user? v1: support replies are admin-side records; document honestly + future note); audit `support.reply|support.resolve`.
4. `AdminAnnouncementsPage` (`/admin/announcements`) — compose card: title (8–80), body (20–500), audience select (All users / Buyers / Creators), preview panel (renders as notification item); Send (confirm with recipient count fetched live) → `notificationService.broadcast({ audience, title, body })` (new: queries target users honoring prefs-exempt system category, batch-creates `system_announcement` notifications with progress feedback (chunked, simple), returns count; Laravel note: queued job); history list (derive from sent announcements — store an `announcements`-like record? **Keep simple: write one auditLogs entry `announcement.send` with meta {title, audience, count} and render history from audit** — no new collection; document); audit + toast.
5. navConfig: enable Requests/Orders/Support/Announcements (28 gates); Overview attention "overdue orders" links resolve; dispute-banner links stay gated until P33.

## 5. Functional Requirements

Close-request cascade (notifications to all proposers) verified; admin cancel on held-payment order refunds correctly (ledger rows per 17); support round-trip (contact form 11 → queue → reply → resolve); broadcast creates exactly audience-count notifications + bell badges update for targets; every intervention audited with reason.

## 6. UI/UX Requirements

Operations-desk density (28 kit); interventions visually cautious (outlined danger, consequence copy); announcement preview true-to-widget; timelines admin-flavored (include internal notes with "Internal" chip).

## 7. Technical Requirements

Interventions call existing workflow services only (grep: no direct status PATCHes in admin components); broadcast in notificationService; shared components reused (brief/delivery/timeline) — no forks.

## 8. API Requirements

Contract additions: broadcast composite, admin list params; document announcement-history-via-audit decision.

## 9. Data Requirements

Seeds: tickets in 3 states w/ a replied example; an admin-cancellable active order; overdue order (verify; extend + reseed + report).

## 10. Files & Folders

Creates: `src/features/admin/operations/pages/{AdminRequestsPage,AdminOrdersPage,AdminOrderDetailPage,AdminSupportPage,AdminAnnouncementsPage}.jsx`, `src/features/admin/operations/components/{RequestDetailSheet,OrderMoneyCard,InterventionDialogs,TicketDetailSheet,AnnouncementComposer,AnnouncementPreview}.jsx`, notificationService.broadcast, orderService admin-note helper. Updates: adminRoutes, navConfig, 28 link gates.

## 11. Responsive Requirements

Tables→cards 360px; detail sheets full-screen mobile; composer stacks with sticky Send.

## 12. Accessibility Requirements

Intervention dialogs consequence-explicit; thread semantics on support replies; announcement preview labeled as preview; export buttons labeled.

## 13. Validation & Error Handling

Reason requirements; broadcast confirm shows count before send + progress + partial-failure report ("Sent 240/243 — retry failed"); cancel on non-cancellable state impossible (UI + service).

## 14. Acceptance Criteria

- Request close cascade, admin cancel+refund ledger, support round-trip, and audience-correct broadcast all verified against db.
- Broadcast respects audience exactly (spot-check a buyer + creator + admin inbox); history renders from audit.
- Permission gating per section proven; lint + build clean.

## 15. Verification Steps

1. Reseed → each §14 flow with db inspection (statuses, ledger, notifications, audit).
2. Broadcast to Creators → verify counts + a non-creator unaffected.
3. Filters/search/export matrix on both big tables; 360px pass.
4. `npm run lint && npm run build`.

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

Workflow service semantics (17/20/24 — ride them), machines (no reopen invention), dispute scope (P33), `prompts/`.

## 18. Depends On

28 (kit), 17 (cancel/refund), 23/24 (shared views), 11 (tickets source), 27 (broadcast surface).

## 19. Final Checklist

- [ ] Requests oversight w/ reasoned closure cascade
- [ ] Orders oversight w/ full context + cancel/refund + internal notes
- [ ] Support queue w/ replies + statuses; Announcements w/ audience broadcast + history
- [ ] All actions audited/notified via existing services; lint + build clean
- [ ] Report written
