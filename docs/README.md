# BetterBlue — Documentation

Everything written down about this project, and what each document is for.
Start here.

---

## If you are…

| …you want | Read |
|---|---|
| to run the project | the [root README](../README.md) |
| to build the backend | [`laravel-migration-guide.md`](laravel-migration-guide.md), then [`api-contract.md`](api-contract.md) and [`data-model.md`](data-model.md) |
| to understand the money | [`payments.md`](payments.md) |
| to verify the product works | [`e2e-walkthrough.md`](e2e-walkthrough.md) |
| to know why the code looks like this | [`../prompts/00-architecture-and-rules.md`](../prompts/00-architecture-and-rules.md) |
| to build a screen that matches the design | [`theme-v2.md`](theme-v2.md) |
| to know what the Storefront V2 sweep verified | [`qa-storefront-v2.md`](qa-storefront-v2.md) |

---

## The documents

### [`theme-v2.md`](theme-v2.md)
**The visual-token authority.** The Storefront V2 dark theme: the three
surfaces, the purple/pink/magenta palette with every tint and text shade, the
gradient, glow and glass tokens, the animation utilities and what reduced motion
does to them, the measured WCAG table for every pair, the component treatments
the MUI override sweep applies, and the deliberate exceptions. Supersedes the
light palette in `prompts/00-architecture-and-rules.md` §6; V2 prompts 02–10
build on it.

### [`laravel-migration-guide.md`](laravel-migration-guide.md)
**The backend handoff.** A ten-step plan for replacing JSON Server with
Laravel/MySQL: which endpoints to build first, the MySQL schema with DDL
sketches, the Sanctum swap mapped 1:1 onto `authService`, the list-adapter
branch, uploads, the payment provider and its webhooks, server-side identifier
generation, the four scheduled jobs, the full endpoint-permission table, and the
environment changes — plus what must *not* change. Ends with a migration test
plan and a grep-able index of all 147 `MOCK-*` markers in the source.

### [`api-contract.md`](api-contract.md)
**The REST contract the frontend already codes against.** Conventions
(identifiers, money, dates, verbs, idempotency), authentication, the error
envelope and canonical codes, list pagination and filtering, uploads, a
reference for all 27 resources, and §7 — the 48 composite operations, each with
its exact mock call sequence and its recommended Laravel endpoint. Section 9
states plainly that the frontend guards are UX only.

### [`data-model.md`](data-model.md)
**The schema.** Every collection with its fields, types and relations; the
demo-account roster; the conventions that matter (especially *which id a foreign
key points at* — creators have both an account and a profile); what the
integrity validator checks; and the MySQL mapping per table. Also documents the
seed system under `scripts/seed-data/`.

### [`payments.md`](payments.md)
**The money layer.** The payment-provider interface and its dummy
implementation with test cards, the escrow lifecycle end to end, commission
policy including the partial-refund rule, rounding, payment/order/payout state
tables, the transaction ledger and its invariants, earnings and payouts, failure
handling, and how to swap in a real provider with webhooks.

### [`e2e-walkthrough.md`](e2e-walkthrough.md)
**The certification scenario.** The scripted end-to-end run across all four
roles — public surfaces, the full buyer journey from registration through escrow
to review, disputes, creator finance, moderation, admin operations, super-admin
configuration, notifications — with every step's recorded result. Includes the
route × role verification matrix, the production-build certification, and the
fixes made during certification.

### [`qa-checklist.md`](qa-checklist.md)
**The quality audit.** Forms (validation, focus, pending and error states),
dialogs, keyboard journeys, focus rings, colour contrast, responsive behaviour
at 360 px, loading/empty/error coverage, and the professional-content sweep —
with the findings that were fixed.

### [`qa-storefront-v2.md`](qa-storefront-v2.md)
**The Storefront V2 sweep.** The final audit of everything the V2 series
changed: the Feeds naming sweep, the category removal, dark-theme consistency
across public pages and every V2 dialog, the re-run gating matrix for Reply /
Send message / Promote, keyboard and reduced-motion passes, the responsive grid
at 360/768/1280, and the seed and build verification — with the seven findings
that were fixed and the deliberate keeps.

### [`notifications-audit.md`](notifications-audit.md)
**Notification emit coverage.** Every workflow event, which notification type it
raises, who receives it, and the deliberate silences (you are not notified about
your own click).

### [`audit-log-coverage.md`](audit-log-coverage.md)
**Audit trail coverage.** Which administrative and sensitive actions write an
audit row, with the action names and the entity each is written against.

---

## Related

- [`../README.md`](../README.md) — install, run, demo accounts, scripts, structure
- [`../prompts/00-architecture-and-rules.md`](../prompts/00-architecture-and-rules.md) — the permanent rules: product identity, technical constraints, folder structure, design tokens, domain model, state machines, API-layer rules, RBAC, UX patterns, accessibility baseline
- [`../prompts/`](../prompts/) — the numbered build specification (01–38) this project was written against
