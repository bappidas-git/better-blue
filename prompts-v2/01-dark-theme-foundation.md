# Storefront V2 — Prompt 01 of 10 — Dark Vibrant Theme Foundation (Pink + Purple)

> **Read first:** `prompts/00-architecture-and-rules.md` (project rules still apply: JS/JSX only, no new dependencies, Node 18.19.0, no hardcoded hex outside theme/token files, reduced-motion support). Then inspect the current theme (`src/theme/*`, `src/styles/*`) and the live app before changing anything.
>
> **Supersession note:** This prompt intentionally supersedes 00 §6's "light theme only" line and its light palette values. Do NOT edit anything inside `prompts/` — instead create `docs/theme-v2.md` as the new visual-token authority that the remaining V2 prompts (02–10) will reference.

## Objective

Re-theme BetterBlue to a **dark, highly vibrant, modern, young, feminine, energetic** visual system: deep near-black base, pink/magenta/purple gradients, subtle neon glows, dark glassmorphism cards, elegant hover/lift animations, and animated gradient accents — implemented at the token/theme level so it propagates everywhere, while remaining professional, readable (AA contrast), performant, and reduced-motion safe.

## Scope guard

- **Design/theme layer only. Do not change functionality, content, copy, routes, APIs, services, or business logic.**
- The MUI theme is global, so dashboards/admin will automatically inherit the dark look — that is expected and fine. Do **no** bespoke admin redesign work; only fix outright legibility/contrast breakages the flip causes in logged-in areas (spot-check buyer/creator/admin shells).

## Changes

1. **`src/theme/palette.js` — dark palette (locked values, document them in `docs/theme-v2.md`):**
   - Mode: `dark`. Background default `#0B0710` (near-black plum), paper/surface `#151020`, elevated surface `#1D1530`.
   - Text primary `#F5F2FA`, secondary `#B8AECB`, disabled `#6E6486`. Divider `#2A2140`.
   - Primary purple `#A855F7` (light `#C084FC`, dark `#7C3AED`), secondary pink `#EC4899` (light `#F472B6`, dark `#BE185D`), magenta accent token `#D946EF`.
   - Semantic (dark-tuned): success `#34D399`, warning `#FBBF24`, error `#F87171`, info `#38BDF8`.
   - Brand gradient token stays `linear-gradient(135deg, #A855F7 0%, #EC4899 100%)`; add `brandGradientAnimated` (same stops, used with 200% background-size animation) and `glowPurple`/`glowPink` shadow tokens: `0 0 24px rgba(168,85,247,0.35)` / `0 0 24px rgba(236,72,153,0.30)`.
2. **`src/styles/tokens.css`** — update all `--bb-*` custom properties to the dark values; add `--bb-glow-purple`, `--bb-glow-pink`, `--bb-glass-bg: rgba(255,255,255,0.04)`, `--bb-glass-border: rgba(236,72,153,0.14)`.
3. **`src/styles/global.css`** — dark scrollbars/selection; `@keyframes bb-gradient-shift` (background-position 0%→100%→0%, ~8s ease); utility classes: `.bb-gradient-text` (gradient-filled text via background-clip), `.bb-gradient-border` (1px animated gradient border via padding-box/border-box double background), `.bb-glass` (glass bg + `backdrop-filter: blur(16px)` + soft border); all animation utilities disabled inside the existing `prefers-reduced-motion` block (static gradient, no shift).
4. **`src/theme/components.js` — dark overrides sweep:**
   - Card/Paper: elevated surface, 1px `--bb-glass-border`-style border, soft ambient shadow; hover (interactive cards): translateY(-3px) + purple/pink glow shadow, 200ms.
   - Buttons: `gradient` variant gains subtle outer glow + slightly stronger glow on hover/focus; outlined/text variants tuned for dark; focus ring stays visible (2px `#C084FC`, offset 2).
   - TextField/OutlinedInput: dark field bg `#171126`, border `#2A2140`, focus border + soft glow in primary; label/placeholder contrast checked.
   - Chip: dark tinted variants (purple/pink/neutral tints at ~14% alpha with readable text); Tabs indicator gradient pill; Dialog/Drawer: elevated surface + glass border, backdrop `rgba(6,3,10,0.7)` + blur; Tooltip, Alert, Snackbar, Table (dark header, row hover tint), Skeleton (dark shimmer), AppBar (translucent `rgba(11,7,16,0.8)` + blur).
5. **Ambient glow component** — `src/components/motion/AmbientGlow.jsx`: positioned radial-gradient blobs (purple + pink, heavy blur, low opacity, `pointer-events: none`, `aria-hidden`), props for placement/intensity; pure CSS (no JS animation loops); used by later V2 prompts behind heroes/section headers. Add a demo placement to the dev design gallery.
6. **Logo & favicon** — verify `Logo`/favicon read well on dark (adjust wordmark neutral fill to light token if needed; gradient mark stays).
7. **Contrast + polish pass** — walk the dev gallery (`/dev/design`) and every public page at 360px + 1280px: fix any token combination failing readability (chips, secondary text, table headers, alerts); keep shadows/glows subtle (no washed-out neon walls); verify hover lifts are transform/opacity only.
8. **`docs/theme-v2.md`** — document: full token table, gradient/glow/glass usage rules ("glow = interactive emphasis only; never on body text"), animation utilities + reduced-motion behavior, and note that V2 prompts 02–10 build on this.

## Do NOT

- Add dependencies; introduce light/dark toggling (dark only); change layout structure, copy, or routes; edit `prompts/`; redesign dashboard/admin screens beyond legibility fixes.

## Verify

1. `npm run lint && npm run build` clean; `npm run dev:all` boots.
2. Dev gallery: every component readable/premium on dark; gradient button glow + focus ring OK.
3. Public pages (home, creators, requests board, how-it-works, pricing, login/register) + one pass through buyer/creator/admin shells: no illegible text, no broken surfaces.
4. Reduced-motion emulation: animated gradients/hovers static, page fully readable.
5. 360px pass on home + login: no horizontal scroll, glows don't clip oddly.

## Git & PR (required output)

1. From the repo's default branch (pull latest): `git checkout -b feat/storefront-v2-01-dark-theme`.
2. Commit all changes: `feat(theme): dark vibrant pink/purple theme foundation (storefront v2 - 01)`.
3. Push and open a PR: `gh pr create --title "Storefront V2 — 01: Dark vibrant theme foundation" --body "<summary of token changes, files touched, verification done>"`.
4. **End your final message with the PR URL.** If `gh`/remote is unavailable, say so and output the branch name + a summary instead.

## Done checklist

- [ ] Dark palette/tokens/components implemented exactly as specified; docs/theme-v2.md written
- [ ] Glass, glow, animated-gradient utilities + AmbientGlow created (reduced-motion safe)
- [ ] Contrast/legibility pass done (public + quick logged-in spot-check)
- [ ] No functional/content/route changes; lint + build clean
- [ ] PR opened and URL reported
