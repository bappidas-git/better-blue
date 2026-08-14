# Prompt 02 — Design System & Theme

> **Before you start:** Read `prompts/00-architecture-and-rules.md` (especially §1 positioning, §6 design tokens, §7 motion rules), then inspect the project created by Prompt 01.

## 1. Objective

Implement the BetterBlue visual foundation: MUI theme with the locked purple/pink token system, typography, global styles, CSS custom-property tokens, motion tokens, the temporary BetterBlue SVG logo, and a dev-only design gallery page for visual verification.

## 2. Context

Every subsequent prompt consumes this theme. It must feel premium, minimal, and professional — a modern technology/creator marketplace. Purple/pink is expressed through a disciplined token system and one brand gradient, not through colorful surfaces.

## 3. What Already Exists

Prompt 01: Vite app shell, all dependencies installed, folder skeleton, `env.js`, `AppProviders.jsx` (pass-through).

## 4. What to Implement

1. `src/theme/palette.js` — exact values from 00 §6: primary purple scale, secondary pink scale, neutrals, semantic colors, `background.default #FAFAFC`, `text.primary #171223`, `text.secondary #6E6880`, divider; export `brandGradient` string token.
2. `src/theme/typography.js` — "Plus Jakarta Sans" for h1–h6 + `button` (weights 600–800, tight letter-spacing on large sizes), "Inter" for body/caption/overline; responsive heading sizes (h1 ~40px mobile / 56px desktop, scaling down through h6); base body 16px/1.6.
3. `src/theme/components.js` — MUI component overrides: Button (radius 10, weight 600, no uppercase, sizes, `variant="gradient"` custom variant using the brand gradient with hover lift ≤ 2px), Card (radius 16, 1px divider border, subtle shadow), Paper, TextField/OutlinedInput (radius 10, comfortable 44px+ touch height), Chip (soft tinted backgrounds), Dialog (radius 20), Tabs (pill indicator), Tooltip, Skeleton (rounded), AppBar (neutral, blurless), Table, Alert, Snackbar.
4. `src/theme/motionTokens.js` — durations `{ fast: 150, base: 250, slow: 400, hero: 650 }`, easing array `[0.22, 1, 0.36, 1]`, distances `{ sm: 8, md: 16, lg: 24 }`.
5. `src/theme/index.js` — `createTheme` assembling palette/typography/components, `shape.borderRadius: 12`, custom `theme.customShadows` (3 levels), spacing 8. Export default theme.
6. `src/styles/tokens.css` — CSS custom properties mirroring core tokens (`--bb-primary`, `--bb-secondary`, `--bb-gradient-brand`, `--bb-bg`, `--bb-text`, `--bb-radius-*`) for CSS Modules use. `src/styles/global.css` — font imports via @fontsource (weights: Inter 400/500/600, Plus Jakarta Sans 600/700/800), sensible reset supplementing CssBaseline, `:focus-visible` ring (2px primary, offset 2), thin styled scrollbars, `::selection` tint, `img { max-width: 100% }`, and a `@media (prefers-reduced-motion: reduce)` block zeroing transitions/animations for non-Framer CSS effects.
7. Update `AppProviders.jsx`: `ThemeProvider` + `CssBaseline` + Framer `MotionConfig reducedMotion="user"` + `LocalizationProvider` (`@mui/x-date-pickers` + `AdapterDayjs`). Import both CSS files in `main.jsx`.
8. **Logo** — `src/components/brand/Logo.jsx`: temporary SVG logo, inline JSX. Design: rounded-square monogram tile with the brand gradient containing an abstract minimal "B" (two stacked rounded forms suggesting a camera aperture is acceptable — keep abstract/professional), plus "BetterBlue" wordmark in Plus Jakarta Sans 700 (`Better` in text.primary, `Blue` gradient-filled via SVG gradient). Props: `variant="full"|"mark"`, `size`, `asLink` (wraps in home link later). Store raw SVGs in `src/assets/brand/` (`logo-full.svg`, `logo-mark.svg`) and derive `public/favicon.svg` from the mark; reference favicon in `index.html`. Must be trivially replaceable (single component + two files); nothing inappropriate — clean geometric tech-brand mark.
9. `src/components/motion/motionPresets.js` — shared Framer variants built from motionTokens: `fadeInUp`, `fadeIn`, `scaleIn`, `staggerContainer(stagger=0.06)`, `listItem`.
10. Dev design gallery — `src/features/dashboard/pages/DevDesignPage.jsx` (temporary mount): renders color swatches (all palette tokens), typography scale, buttons (all variants incl. gradient, states), inputs, chips, alerts, card samples, logo variants, motion preset demo. Mount temporarily in `App.jsx` when `import.meta.env.DEV && env.enableDevPages` (Prompt 08 moves it to `/dev/design`); otherwise App shows the themed placeholder shell with the Logo.

## 5. Functional Requirements

Theme applies app-wide; fonts load locally via @fontsource (no external font CDN); gradient variant button works with keyboard focus ring; gallery renders every token.

## 6. UI/UX Requirements

Premium/minimal per 00 §6: neutral surfaces, gradient only as accent, subtle shadows, generous whitespace, strong type hierarchy. No glassmorphism, no heavy shadows, no gradient-washed backgrounds.

## 7. Technical Requirements

No hardcoded hex outside `src/theme` + `src/styles/tokens.css`. Theme is plain JS objects; component overrides use `styleOverrides`/`variants`. Reduced-motion honored at all three layers (MotionConfig, CSS media block, motionTokens consumers).

## 8. API Requirements

None.

## 9. Data Requirements

None.

## 10. Files & Folders

Creates: `src/theme/{index,palette,typography,components,motionTokens}.js`, `src/styles/{global,tokens}.css`, `src/components/brand/Logo.jsx`, `src/assets/brand/logo-full.svg`, `src/assets/brand/logo-mark.svg`, `public/favicon.svg`, `src/components/motion/motionPresets.js`, `src/features/dashboard/pages/DevDesignPage.jsx`. Updates: `AppProviders.jsx`, `main.jsx`, `App.jsx`, `index.html`.

## 11. Responsive Requirements

Typography scales across breakpoints; gallery grid stacks on mobile; buttons/inputs ≥ 44px touch height.

## 12. Accessibility Requirements

AA contrast for text tokens on their surfaces (verify primary on white, white on primary/gradient, secondary text on background); visible focus ring everywhere; logo SVGs have `<title>`/`aria-label`; gallery images/swatches labeled.

## 13. Validation & Error Handling

N/A beyond clean console.

## 14. Acceptance Criteria

- Fonts render (Plus Jakarta Sans headings, Inter body) with no FOUT-induced layout jump on reload.
- Gradient CTA, focus rings, chip tints, card styling all match token spec; favicon shows the mark.
- Reduced-motion (emulate via devtools) disables gallery motion demo.
- Lint + build clean; app boots.

## 15. Verification Steps

1. `npm run dev` → inspect gallery at the dev mount: swatches, type scale, buttons, inputs, logo.
2. Toggle `prefers-reduced-motion` in devtools → motion demo becomes static.
3. Narrow to 360px → gallery stacks, no horizontal scroll.
4. `npm run lint && npm run build`.

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

`prompts/`, dependency set, npm scripts, `env.js` API, folder structure.

## 18. Depends On

01.

## 19. Final Checklist

- [ ] Palette/typography/shape/shadows exactly per 00 §6
- [ ] Gradient used only as accent; custom Button `gradient` variant works
- [ ] Logo component + SVG assets + favicon in place and replaceable
- [ ] motionTokens + motionPresets created; reduced-motion respected
- [ ] Dev gallery renders all tokens; lint + build clean
- [ ] Report written
