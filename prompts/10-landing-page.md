# Prompt 10 — Landing Page

> **Before you start:** Read `prompts/00-architecture-and-rules.md` (especially §1 positioning, §6 design, §7 motion), then inspect Prompts 01–09 output.

## 1. Objective

Replace the temporary home placeholder with the real BetterBlue landing page: an Awwwards-inspired (not copied), performance-conscious marketing page with GSAP hero + scroll reveals, API-driven featured creators and categories, and clear buyer/creator CTAs.

## 2. Context

This is the product's face: it must instantly communicate "professional marketplace where businesses commission creators for commercial photos & videos." All dynamic content comes from the API (featured creators, categories, stats) — no hardcoded marketplace data.

## 3. What Already Exists

PublicLayout/TopNav/Footer (08), auth-aware nav (09), `creatorProfileService.listFeatured`, `categoryService.listActive` (07), motion presets + GSAP available, `FadeInView`/`StaggerList`/`AnimatedNumber` (04), image helpers (03).

## 4. What to Implement

Sections (each its own component under `src/features/landing/components/`, composed in `HomePage.jsx`):

1. **Hero** — eyebrow ("The commercial content marketplace"), headline ("Custom photos & videos for your brand, made by professional creators" — copy may be refined but must stay business-focused), subcopy, dual CTAs ("Post a content request" → register/buyer home; "Become a creator" → register), trust row (e.g. "500+ creators · 12 categories · Escrow-protected payments" — static marketing copy is acceptable here). Visual: composition of 3–4 floating "content cards" (professional imagery via `imageUrl` seeds: food shoot, product shot, travel, fitness) with subtle GSAP intro timeline (staggered rise + settle) and gentle parallax on scroll; soft gradient glow accent behind (token gradient at low opacity).
2. **Logo/trust band** — "Trusted by growing brands" + 5–6 neutral fictional brand wordmarks (text-only, e.g. Verde Kitchen, Nimbus, Atlas Travel — reuse seeded buyer names; no real brands).
3. **How it works** — 4 steps (Post a request → Review proposals → Creator produces → Approve & release payment) as cards with iconify icons, connecting line on desktop, `StaggerList` reveal; link to How It Works page (placeholder until Prompt 11 — use paths constant; it 404s gracefully? No: route exists after Prompt 11; until then point the link at `REGISTER`… **Decision:** link to `HOW_IT_WORKS` path and note in report that the page lands in Prompt 11; acceptable because nav already exposes it? It does not yet — verify TopNav links only to existing routes; adjust TopNav "How It Works" to render only if route registered, or keep and accept 404 → **Implement:** register a minimal HowItWorks stub page in this prompt (heading + "full guide coming"), replaced in Prompt 11.)
4. **Browse by category** — API-driven category grid (icon + name + image tile), links into `CREATORS` with category query param; horizontal snap-scroll on mobile.
5. **Featured creators** — API-driven carousel/grid of 6 featured creator cards (avatar, name, tagline, rating, starting price, category chips) linking to public profiles (route exists after Prompt 13; until then card links may point to `CREATORS` — leave TODO comment + report) → **Implement:** link to `creatorProfile(id)` constant now; Prompt 13 fulfills it; register a stub CreatorProfile page showing skeleton + "profile experience arriving" ONLY if needed to avoid 404 — prefer registering the real route in 13 and pointing cards at `CREATORS` until then with a marked TODO.
6. **For buyers / For creators** — two-tab or side-by-side value panels (buyers: briefs, escrow, licensed content; creators: real briefs, fair pricing, protected payouts) with CTAs.
7. **Stats band** — `AnimatedNumber` stats fetched via a tiny `landingService.getStats()` (computes from API: creators count, completed orders count, categories count; cached).
8. **Testimonials** — 3 professional quotes (static marketing copy, fictional businesses).
9. **Final CTA band** — gradient accent panel, headline + both CTAs.
10. **SEO/meta** — `useDocumentTitle('Commercial content, made by creators')`; meta description already in index.html.

GSAP usage: hero timeline + ScrollTrigger reveals for sections 3/5/7 (batch reveal, once); everything else Framer `FadeInView`. All GSAP work in a `useLandingAnimations` hook (feature-local) with `prefers-reduced-motion` guard (skip timelines, render final state) and cleanup on unmount (`gsap.context`).

## 5. Functional Requirements

Featured/categories/stats load from API with skeletons and graceful fallbacks (API down → sections render with EmptyState-style quiet fallback, page never crashes); all CTAs route via paths constants; authenticated users see "Go to dashboard" instead of register CTAs in hero (small conditional).

## 6. UI/UX Requirements

Premium minimal (00 §6): neutral background, gradient only in hero glow + final band + CTAs; consistent Section rhythm (py 64–96); hero fills ~90vh on desktop, natural height mobile; card hovers lift ≤ 4px with shadow token; no parallax jank (transform-only, will-change sparingly).

## 7. Technical Requirements

Landing chunk stays lazy (verify GSAP lands only in this chunk via build output); images `loading="lazy"` below the fold + explicit width/height (no CLS); `landingService` in services layer.

## 8. API Requirements

`creatorProfileService.listFeatured(6)`, `categoryService.listActive()`, landing stats (documented in contract as client-computed for mock; Laravel note: `/stats/landing`).

## 9. Data Requirements

Seeds already provide featured creators/categories; verify 3 featured exist (adjust seeds only if missing — via seed-data + reseed).

## 10. Files & Folders

Creates: `src/features/landing/components/{Hero,TrustBand,HowItWorksSection,CategoryGrid,FeaturedCreators,AudiencePanels,StatsBand,Testimonials,FinalCta}.jsx` (+ module CSS where needed), `src/features/landing/hooks/useLandingAnimations.js`, `src/services/landingService.js`, HowItWorks stub page. Updates: `HomePage.jsx` (real composition), route configs (stub), `paths` untouched.

## 11. Responsive Requirements

Hero stacks (copy above visual) < md; category row becomes snap-scroll; featured grid 1/2/3 columns; stats 2×2 grid mobile; test 360/768/1280/1536.

## 12. Accessibility Requirements

Single h1 (hero); sections labeled by headings; decorative imagery `alt=""`, meaningful imagery descriptive alt; reduced-motion renders full static content (verify nothing hidden at opacity 0); keyboard focus order logical; CTA contrast AA on gradient.

## 13. Validation & Error Handling

Section-level error tolerance (one failed fetch never blanks the page); retry on stats/featured optional quiet refetch.

## 14. Acceptance Criteria

- Lighthouse-style sanity: no CLS from images, interactions responsive, animations 60fps-feeling on a mid device.
- Reduced-motion: page fully readable/static. API-down: page renders with fallbacks.
- All content professional/business-focused; featured creators + categories provably from API (change db → UI changes).
- Lint + build clean.

## 15. Verification Steps

1. Full visual pass at 4 breakpoints; scroll the whole page twice (reveal-once verified).
2. Toggle reduced motion → static but complete. Stop API → fallbacks render.
3. Edit a featured creator's tagline in db.json → refresh shows it.
4. `npm run lint && npm run build` (check landing chunk contains GSAP, main doesn't).

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

TopNav/Footer structure (beyond the stub link fix), theme tokens, services APIs (additive `landingService` only), `prompts/`.

## 18. Depends On

04, 07, 08, 09 (03 for images).

## 19. Final Checklist

- [ ] All 9 sections built; API-driven parts verified against seeds
- [ ] GSAP isolated to landing chunk with reduced-motion + cleanup
- [ ] 4-breakpoint + reduced-motion + API-down passes done
- [ ] Copy 100% business-professional; lint + build clean
- [ ] Report written (incl. the featured-card link TODO decision)
