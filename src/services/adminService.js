// Admin dashboard aggregates — placeholder.
//
// The admin overview (Prompt 28) needs counts and sums that no single endpoint
// returns: open moderation cases, disputes awaiting triage, revenue by month,
// GMV, active members. Under JSON Server every one of them is a `_limit=1`
// request read for its `X-Total-Count`, or a full-collection fetch reduced
// client-side; under Laravel they become one `GET /admin/overview` that does
// the aggregation in SQL.
//
// Nothing is implemented here yet on purpose: the shape of each aggregate is
// decided by the dashboard that renders it, and guessing now would mean
// rewriting later. The module exists so Prompt 28 has an obvious home and so
// no feature invents its own aggregation path in the meantime.
//
// Read-side helpers to build on: every `*Service.list()` returns `total`
// alongside `items`, so a count is `list({ page: 1, limit: 1, filters })`
// followed by `.total` — no collection fetch required.

export const adminService = Object.freeze({
  // —— aggregate helpers (added by Prompt 28) ——
  // getOverviewStats() — headline counters for the admin dashboard.
  // getRevenueSeries({ from, to }) — commission totals per month for Recharts.
  // getModerationBacklog() — open cases by age bucket.
})

export default adminService
