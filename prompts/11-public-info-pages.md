# Prompt 11 — Public Information & Policy Pages

> **Before you start:** Read `prompts/00-architecture-and-rules.md` (especially §1 positioning), then inspect Prompts 01–10 output.

## 1. Objective

Build the public informational pages: How It Works (full), Content Policy (trust & safety), Pricing & Fees, FAQ, About, Contact (working support-ticket form), Terms, Privacy — completing the public shell's footer/nav links.

## 2. Context

These pages establish BetterBlue's professional positioning. The Content Policy page is the canonical trust-and-safety surface the moderation system references. Legal pages are clearly-labeled templates the client will replace.

## 3. What Already Exists

PublicLayout + footer links (08), HowItWorks stub (10), `policy.js` constants (03), `supportService.createTicket` (07), `settingsService.getSettings` (07), Section/PageHeader/FadeInView components (04).

## 4. What to Implement

All under `src/features/staticPages/pages/` (+ shared `InfoPageLayout` component: narrow prose column, side TOC on desktop for long pages):

1. **HowItWorksPage** (replaces stub) — hero intro; two journey sections rendered as alternating step timelines: For Businesses (Create request → Compare proposals → Fund securely → Review deliverables → Approve & release) and For Creators (Build portfolio → Get approved → Propose on briefs → Deliver → Get paid); escrow explainer card ("How payment protection works": paid upfront → held by BetterBlue → released on approval); FAQ teaser; CTA band. FadeInView reveals.
2. **ContentPolicyPage** — renders **from `constants/policy.js`** (single source with moderation): intro paragraph framing BetterBlue as a professional commercial-content marketplace; section per policy block (professional content standards; prohibited content list rendered plainly; IP & licensing honesty; respectful conduct; accurate representation); "How enforcement works" section (review states, possible actions: revision required, rejection, restriction, account suspension/blacklist per platform rules); "Report content" pointer (report flows arrive in Prompt 30 — mention capability generically); last-updated date. Tone: normal marketplace trust-and-safety page (00 §1) — informative, not lurid.
3. **PricingPage** — how fees work: buyers pay the proposal price; creators receive price minus platform commission; commission rate + payout minimum + auto-accept window fetched live from `settingsService.getSettings()` (with loading/fallback); worked example card ($400 order → commission at current rate → creator receives $X — computed, `formatCurrency`); affiliate program teaser; zero-fee-to-post callout; FAQ links.
4. **FaqPage** — accordion (MUI) with 4 groups (Getting started / Orders & payments / For creators / Trust & safety), ~16 professional Q&As consistent with actual product behavior (escrow, revisions, disputes, moderation, payouts); deep-linkable groups via hash.
5. **AboutPage** — short mission ("helping businesses get authentic commercial content"), values trio, neutral team-free design (no fake people bios), CTA.
6. **ContactPage** — form (name, email — prefilled if authenticated, subject select [General, Orders & payments, Trust & safety, Partnerships], message) → `supportService.createTicket` (attaches `userId` when logged in) → success state ("We usually reply within 1 business day") + toast; support email fallback from `appConfig`.
7. **TermsPage / PrivacyPage** — clearly structured placeholder legal templates (numbered sections, definitions, marketplace terms incl. escrow/commission/content licensing summary, acceptable-use pointing to Content Policy; privacy: data collected, use, retention, contact). Both open with a subtle non-legal-advice banner: "Template for demonstration — replace with counsel-reviewed text before launch."
8. Register all routes in `publicRoutes.jsx`; verify every footer/nav link now resolves (no 404s); add `useDocumentTitle` everywhere.

## 5. Functional Requirements

Contact creates a real supportTickets record (visible later in admin); Pricing reflects live settings values; policy content shared with moderation via constants (no duplicated policy text).

## 6. UI/UX Requirements

Readable prose width (~68ch); consistent InfoPageLayout header (eyebrow + h1 + intro); TOC sticky on desktop for Policy/Terms/Privacy; accordion touch-friendly; subtle reveals only (no GSAP here).

## 7. Technical Requirements

Long static copy lives in feature-local `content.js` modules (not inline JSX walls, not in constants except policy); pages lazy-loaded.

## 8. API Requirements

`GET /platformSettings` (settingsService), `POST /supportTickets` (supportService).

## 9. Data Requirements

None new (tickets write to existing collection).

## 10. Files & Folders

Creates: 8 pages + `InfoPageLayout.jsx` + `content.js` modules under `src/features/staticPages/`. Updates: `publicRoutes.jsx`, footer/nav link audit fixes.

## 11. Responsive Requirements

Prose comfortable at 360px; TOC hidden < lg; accordion rows ≥ 44px; contact form full-width mobile.

## 12. Accessibility Requirements

Heading hierarchy strict (one h1, nested h2/h3); accordion keyboard operable with `aria-expanded`; contact form labeled + error `role="alert"`; TOC as `nav aria-label="On this page"`.

## 13. Validation & Error Handling

Contact: required/email/min-length validation, submit error toast + preserved input; settings fetch failure → fallback copy without crash.

## 14. Acceptance Criteria

- Every footer/nav link resolves; all 8 pages themed, titled, responsive.
- Contact round-trip: submit → record in db.json → success UI.
- Pricing example matches settings math; changing settings rate in db (temporarily) changes the page after cache expiry/reload; revert.
- Content professional throughout; lint + build clean.

## 15. Verification Steps

1. Click-audit every footer/nav link (desktop + mobile drawer).
2. Submit contact form; check db.json record; test validation errors.
3. Temporary settings-rate edit test on Pricing (then reseed).
4. 360px pass on Policy/FAQ/Contact; `npm run lint && npm run build`.

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

`policy.js` structure (consume as-is; propose changes in report if gaps found), services beyond usage, `prompts/`.

## 18. Depends On

03, 04, 07, 08, 10 (stub replacement).

## 19. Final Checklist

- [ ] All 8 pages built with InfoPageLayout; routes registered; links audited
- [ ] Policy renders from constants; Pricing from live settings; Contact writes tickets
- [ ] Legal placeholders clearly marked; copy professional throughout
- [ ] A11y (headings, accordion, form) verified; lint + build clean
- [ ] Report written
