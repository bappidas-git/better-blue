# Storefront V2 — Prompt 06 of 10 — Home: Audience Panels, Final CTA & Role-Preselect Register

> **Read first:** `prompts/00-architecture-and-rules.md`, `docs/theme-v2.md`. Inspect the HomePage sections below Top Creators (audience panels, stats, testimonials, final CTA) and `RegisterPage` before changing anything.

## Objective

Update the "Built for both sides" audience section and the final CTA band with the new labels/CTAs, replace the final CTA copy with Lorem Ipsum, support `?role=` preselection on the register page, and finish the home page's dark-theme polish.

## Scope guard

- Landing page + one small additive change to `RegisterPage` (query-param preselect). Nothing else.

## Changes

1. **Audience section ("Built for both sides — One workflow, two very different jobs"):**
   - Left card: eyebrow/label **"For businesses" → "For Buyers"** (heading/body copy otherwise unchanged).
   - Right card: heading **"Get paid properly for commercial work" → "Get paid properly for your work done"**.
   - Replace the cards' CTA buttons (whatever they currently are — "Post a content request"/"Become a creator"/"Go to dashboard" variants) with: left → **"Register as a Buyer"**, right → **"Register as a Creator"**, linking to `REGISTER` with `?role=buyer` / `?role=creator`. Show these same CTAs regardless of auth state (remove auth-conditional CTA logic in this section).
2. **Final CTA band (above footer):** replace ALL its text (eyebrow, heading, subcopy) with Lorem Ipsum of comparable lengths; buttons → **"Register as a Buyer"** (gradient) + **"Register as a Creator"** (outlined), same `?role=` links. Keep the band's gradient-panel treatment, upgraded to theme-v2 (animated gradient background per the utility, reduced-motion safe).
3. **Register role preselect (`RegisterPage`):** read `?role=buyer|creator` from the URL — when valid, preselect that role card and advance directly to the details step (with the role switchable via a small "Change" affordance back to step 1); invalid/absent param → existing behavior. `RoleGateDialog` (V2-03) already emits these links — verify the round-trip.
4. **Home polish pass:** walk the full home page top-to-bottom on dark — consistent Section rhythm, glass/glow discipline (interactive elements only), stats + testimonials sections restyled tokens-only (no structural change), no leftover light-theme surfaces or category remnants anywhere on the page.
5. Verify all home links land correctly post-V2-02 renames (Feeds links, creators links).

## Do NOT

- Change stats/testimonials content or structure; alter registration logic beyond preselect; touch other pages; add dependencies; edit `prompts/`.

## Verify

1. Audience section shows the exact new labels/heading and both register CTAs route with the correct `?role=` and preselect works (buyer + creator, incl. from RoleGateDialog).
2. Final CTA band: lorem copy + two CTAs; animated gradient static under reduced motion.
3. Full-page home review at 360px + 1280px: cohesive dark theme, no light remnants, no category traces, console clean.
4. `npm run lint && npm run build`.

## Git & PR (required output)

1. Branch: `git checkout -b feat/storefront-v2-06-home-audience-cta`.
2. Commit: `feat(landing): buyer/creator audience CTAs, lorem final CTA, register role preselect (v2 - 06)`.
3. Push + `gh pr create --title "Storefront V2 — 06: Home audience & CTA updates" --body "<summary + verification>"`.
4. **End your final message with the PR URL** (or branch + summary if gh/remote unavailable).

## Done checklist

- [ ] "For Buyers" + "Get paid properly for your work done" + Register CTAs in audience cards
- [ ] Final CTA: lorem + Register as Buyer/Creator (animated gradient, reduced-motion safe)
- [ ] `?role=` preselect on RegisterPage (incl. RoleGateDialog round-trip)
- [ ] Home fully dark-polished, category-free; lint + build clean
- [ ] PR opened and URL reported
