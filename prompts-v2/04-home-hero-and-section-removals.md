# Storefront V2 — Prompt 04 of 10 — Home: Hero Rework & Section Removals

> **Read first:** `prompts/00-architecture-and-rules.md`, `docs/theme-v2.md`. Inspect `src/features/landing/` (HomePage composition, Hero, TrustBand, CategoryGrid, useLandingAnimations) before changing anything.

## Objective

Rework the landing hero (Lorem Ipsum copy, new CTAs, creator-attributed visual cards) and remove the "Trusted by growing brands" band and the entire "Browse by category" section — beginning the category-free storefront.

## Scope guard

- Landing page only (plus the small service call it needs). Categories disappear from the **storefront UI** only — the db collection, admin category management, and dashboard forms stay untouched.

## Changes

1. **Hero copy → Lorem Ipsum:** replace ALL hero text (eyebrow, headline, subcopy, trust/checkmark row items) with Lorem Ipsum placeholder text of comparable lengths (headline ~6–8 words of lorem, subcopy ~2 lorem sentences, 3 short lorem trust items). Keep the typographic hierarchy.
2. **Hero CTAs:** primary **"View Feeds"** → `FEEDS`; secondary **"Explore Creators"** → `CREATORS`. (Authenticated users see the same two CTAs — remove any dashboard-conditional CTA logic in the hero.) Gradient primary + outlined secondary, glow per theme-v2.
3. **Hero visual cards → creator attribution:** the 3–4 floating content cards now source from `creatorMetaService.getFeaturedWithContributions(4)` (V2-03). Below/overlaid on each image show: **creator display name** (link → `creatorProfile(id)`, stops propagation, hover underline/glow) and **contribution counts** formatted like `112+ Images · 67 Videos` (small util `formatContribution(counts)` — feature-local; pluralize, add `+` when ≥ 100... implement: append `+` for values ≥ 100). Remove the old category + meta caption entirely. Keep the GSAP intro/parallax working with the new card content (reduced-motion safe as before); loading state: skeleton cards.
4. **Remove TrustBand:** delete the "Trusted by growing brands" section from the HomePage composition (remove component usage + file if unused elsewhere).
5. **Remove Category section:** delete "Browse by category — Creators for the content your industry actually needs" (CategoryGrid) from HomePage (component + landing-only imports removed). Also drop category chips from the landing **FeaturedCreators** cards if they render there (that section stays until V2-05 restyles the area; just strip category chips now).
6. **Ambient theming:** add `AmbientGlow` blobs behind the hero (per theme-v2 usage rules); verify hero reads premium on dark at 360px + desktop.
7. Update `landingService`/animation hook only as needed for removed sections (no dead code/queries left — e.g., stop fetching categories on the landing page).

## Do NOT

- Touch the How-it-works, Featured-creators (beyond chip strip), audience, stats, testimonial, or final-CTA sections yet (V2-05/06). Don't remove `categoryService`/db categories. Don't change routes. No new deps. Don't edit `prompts/`.

## Verify

1. Hero: lorem copy, both CTAs route correctly, creator names link to real seeded profiles, counts match seeded `contributionCounts`, GSAP intro + reduced-motion fallback still work.
2. TrustBand and CategoryGrid gone; no category chips or requests to `/categories` from the landing page (network tab check); no console errors; no unused-import lint errors.
3. 360px + 1280px hero pass (no clipped glows/overlap); `npm run lint && npm run build`.

## Git & PR (required output)

1. Branch: `git checkout -b feat/storefront-v2-04-home-hero`.
2. Commit: `feat(landing): lorem hero with creator attribution, remove trust band + category section (v2 - 04)`.
3. Push + `gh pr create --title "Storefront V2 — 04: Home hero rework & section removals" --body "<summary + verification>"`.
4. **End your final message with the PR URL** (or branch + summary if gh/remote unavailable).

## Done checklist

- [ ] Hero: lorem copy, View Feeds / Explore Creators CTAs, creator name links + contribution counts
- [ ] TrustBand + CategoryGrid removed clean (no dead code, no category fetches from landing)
- [ ] AmbientGlow + dark polish; GSAP + reduced-motion intact
- [ ] Lint + build clean; PR opened and URL reported
