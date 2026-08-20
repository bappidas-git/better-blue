# Theme V2 — the dark vibrant visual system

**This document is the visual-token authority for Storefront V2.** It supersedes
the light palette in [`../prompts/00-architecture-and-rules.md`](../prompts/00-architecture-and-rules.md)
§6 — including the "light theme only" line and every light hex it lists.
Everything else in 00 §6 still stands: the type scale, the radius scale, the
three elevation levels, the motion budget, and the rule that raw hex values live
in exactly one place.

The product is **dark only**. There is no light palette, no `prefers-color-scheme`
branch, and no toggle. Storefront V2 prompts 02–10 build their pages on the
tokens below and should not introduce new colour values.

---

## 1. Where the tokens live

| File | What it holds |
|---|---|
| [`../src/theme/palette.js`](../src/theme/palette.js) | The palette, the gradient tokens, the glow tokens, the glass pair. The source of truth. |
| [`../src/theme/index.js`](../src/theme/index.js) | `customShadows` — three elevation levels plus the glow compositions. |
| [`../src/theme/components.js`](../src/theme/components.js) | The MUI override sweep that applies all of it. |
| [`../src/styles/tokens.css`](../src/styles/tokens.css) | The `--bb-*` mirror, for CSS Modules and global styles. |
| [`../src/styles/global.css`](../src/styles/global.css) | Scrollbars, selection, autofill, the `bb-gradient-shift` keyframes, and the three utility classes. |

Two files restate hex values on purpose and are documented mirrors, not
exceptions to the rule:

- [`../src/constants/images.js`](../src/constants/images.js) — the avatar tints, because the module is
  framework-free (the seed script imports it from plain Node) and an SVG string
  cannot read the theme. See §8.
- [`../index.html`](../index.html) — `--bb-bg` restated as an inline `html` background and a
  `theme-color` meta, so the very first paint is already dark.

MUI components read the theme. Everything else reads the CSS custom properties.
Nothing writes a colour literal.

---

## 2. Surfaces

Three surfaces, in strict order. Getting an element on the right one is most of
what makes the dark theme read.

| Token | Hex | Used for |
|---|---|---|
| `background.default` | `#0B0710` | The page. Near-black plum. |
| `background.paper` | `#151020` | Base panels: app bar, footer, sticky bars, table bodies, outlined Paper. |
| `background.elevated` | `#1D1530` | Raised surfaces: **Card**, Dialog, Drawer, Menu, Popover, Tooltip, table headers. Not a MUI-standard key — address it as `theme.palette.background.elevated`. |
| `background.input` | `#171126` | The filled well behind every text field. |
| `background.backdrop` | `rgba(6, 3, 10, 0.7)` | The modal scrim, blurred 4px. |

**Edge rule.** A *container* edge — card, dialog, menu, outlined paper — is the
pink-tinted `--bb-glass-border`. A *content* rule — `<Divider />`, a table cell
border, a section separator — is `divider` (`#2A2140`). Keeping those two apart
is what stops the pink hairline from turning into a pink grid.

---

## 3. Colour tokens

### Brand

| Token | Value | Role |
|---|---|---|
| `primary.main` | `#A855F7` | The brand purple. Fills, dots, icons, glows, gradient stop. |
| `primary.light` | `#C084FC` | **The purple that carries text**, plus the focus ring. |
| `primary.dark` | `#7C3AED` | Solid button fills and the skip link — the shade that clears AA under white. |
| `primary.lighter` | `rgba(168,85,247,0.14)` | Chip / selection tint. |
| `primary.surface` | `rgba(168,85,247,0.07)` | Faint wash for tinted panels. |
| `secondary.*` | `#EC4899` / `#F472B6` / `#BE185D` + the same two washes | The brand pink, same shape. |
| `accent.*` | `#D946EF` / `#E879F9` / `#A21CAF` + washes | Magenta — the third hue, between purple and pink. Badges, glow blobs, accents that must read as brand without repeating either CTA colour. Not MUI-augmented, so it is `theme.palette.accent.main`, never `color="accent"`. |

The two tints are **alpha washes, not flat hex**, so they composite correctly on
all three surfaces. A fixed tint tuned for `#0B0710` is wrong on `#1D1530`.

### Neutrals

| Token | Value |
|---|---|
| `text.primary` | `#F5F2FA` |
| `text.secondary` | `#B8AECB` |
| `text.disabled` | `#6E6486` |
| `divider` | `#2A2140` |

### Semantic

`main` fills a dot, an icon, or a bar. `dark` is **the shade text uses** — the
role it had in the light theme, which on a dark surface means one step
*brighter*, not darker. That inversion is carried by the token so the ~40 call
sites already saying `color: 'success.dark'` for a money figure keep working.
`light` is the label colour on a tinted fill (Chip, Alert).

| Token | `main` | `light` | `dark` (text) |
|---|---|---|---|
| success | `#34D399` | `#6EE7B7` | `#10B981` |
| warning | `#FBBF24` | `#FCD34D` | `#F59E0B` |
| error | `#F87171` | `#FCA5A5` | `#EF4444` |
| info | `#38BDF8` | `#7DD3FC` | `#0EA5E9` |

`contrastText` for all four is `#0B0710` — a white label on a bright mint or
amber fill is under 2:1.

---

## 4. Gradient

```
brandGradient          linear-gradient(135deg, #A855F7 0%, #EC4899 100%)
brandGradientAnimated  the same stops, named for the animated treatment
```

**Where it belongs:** primary CTAs (`<Button variant="gradient">`), the logo
tile, hero accents, the profile banner, small highlights, display text through
`.bb-gradient-text`.

**Where it does not:** whole surfaces, body copy, anything a paragraph sits on.

`brandGradientAnimated` is not a different gradient — it is the same string
under a name that signals "pair me with `background-size: 200% 200%` and the
`bb-gradient-shift` keyframes". Two stops plus a `0% → 100% → 0%` ping-pong give
a seamless 8s loop with no seam and no direction flip.

---

## 5. Glow

```
glowPurple  0 0 24px rgba(168, 85, 247, 0.35)
glowPink    0 0 24px rgba(236, 72, 153, 0.30)
```

Composed in `theme.customShadows`:

| Shadow | Value | Used for |
|---|---|---|
| `z1` | `0 1px 2px rgba(0,0,0,.5), 0 1px 3px rgba(0,0,0,.36)` | Resting cards |
| `z2` | `0 8px 24px rgba(0,0,0,.55)` | Hover, popovers, menus |
| `z3` | `0 24px 60px rgba(0,0,0,.66)` | Dialogs and toasts |
| `glowPurple` / `glowPink` | the tokens above | Single-hue emphasis |
| `glowBrand` | both glows | The strongest emphasis: hovered/focused gradient CTA |
| `cardHover` | `0 12px 32px rgba(0,0,0,.55)` + `glowPurple` | Depth first, halo second — the interactive-card hover |

The elevation scale is driven by **deep black, not ink**: a 5% ink shadow over
`#0B0710` is invisible, which is why the light theme's values could not carry
over.

> **Glow is interactive emphasis only. Never put a glow behind body text**, never
> behind a whole section, and never on more than one element in a viewport at
> rest. Two neon halos next to each other stop reading as emphasis.

### AmbientGlow

[`../src/components/motion/AmbientGlow.jsx`](../src/components/motion/AmbientGlow.jsx) is the section-scale version: two
positioned radial blobs (purple + pink), heavily diffused, low opacity. Pure
CSS — no JS animation loop, no Framer, no state.

```jsx
<Box sx={{ position: 'relative', overflow: 'hidden' }}>
  <AmbientGlow placement="hero" intensity="medium" />
  <Stack sx={{ position: 'relative' }}>…</Stack>
</Box>
```

- `placement` — `hero` | `top` | `center` | `bottom`
- `intensity` — `subtle` (0.22) | `medium` (0.38) | `strong` (0.55)
- `size`, `blur` — override the blob diameter and the edge softening

It is `aria-hidden`, `pointer-events: none`, and sits at `z-index: 0`, so
anything meant to be above it needs `position: relative`. It clips itself to its
parent, which is what keeps a blob from widening the page on a 360px screen.
Because it is static, reduced motion needs no special case.

---

## 6. Glass

```
--bb-glass-bg      rgba(255, 255, 255, 0.04)
--bb-glass-border  rgba(236, 72, 153, 0.14)
--bb-glass-blur    16px
```

`.bb-glass` applies all three plus the card radius. Glass needs **something
behind it to blur** — an AmbientGlow, an image, a scrolling page. Over a flat
surface it degrades to a 4% white wash with a pink hairline, which is still a
valid card edge but is not the effect.

The same border value is what every container edge uses (§2), so a `.bb-glass`
panel and a `<Card>` read as the same family.

---

## 7. Animation utilities

All three live in [`../src/styles/global.css`](../src/styles/global.css) and are plain class names — use
them via `className`, not `sx`.

| Class | What it does | Constraints |
|---|---|---|
| `.bb-gradient-text` | Gradient-filled text via `background-clip: text` | **Display sizes only** (h1–h3 / ≥24px). The fill is AA-large on the dark surfaces and never AA for body copy. Never on a paragraph, a label, or a control. |
| `.bb-gradient-border` | 1px animated gradient border, drawn with a padding-box/border-box double background — no pseudo-element, no extra DOM | Set `--bb-gradient-border-bg` when the element is not on the elevated surface |
| `.bb-glass` | The glass pane of §6 | Needs something behind it |

`@keyframes bb-gradient-shift` moves `background-position` `0% → 100% → 0%` over
`--bb-duration-gradient` (8s), eased. It is the only keyframe in the system.

### Reduced motion

Under `prefers-reduced-motion: reduce`:

- the global block zeroes every CSS animation and transition, as before;
- `.bb-gradient-text` and `.bb-gradient-border` additionally get
  `animation: none` and their background pinned to `0% 50%`, so they render as a
  **static brand gradient** rather than freezing mid-sweep;
- `.bb-glass` and `AmbientGlow` are unaffected — neither animates;
- every hover lift (`translateY`) is dropped; the glow and the shadow stay, so
  hover feedback survives without movement;
- Framer Motion continues to honour the same preference through
  `<MotionConfig reducedMotion="user">` in `AppProviders`.

Verified in Chromium under both settings: computed `animation-name` goes
`bb-gradient-shift` → `none`, and `background-position` pins to `0% 50%`.

All hover treatments animate **transform, opacity, box-shadow and border-colour
only** — nothing that triggers layout.

---

## 8. Deliberate exceptions

**Avatar tints stay light.** `AVATAR_TINTS` in `src/constants/images.js` still
holds the four pale tints (`#EDE9FE`, `#F5F3FF`, `#FDF2F8`, `#E5E2EC`) with dark
initials. Two reasons: the seed script bakes these tints into `server/db.json`
as data URIs, so flipping the constant without re-seeding would leave the
product showing light avatars for seeded users and dark ones for everybody else;
and re-seeding is a content change, which this pass is not allowed to make. A
light initials disc on a dark UI reads as a profile photo, which is exactly what
it stands in for, and the dark-on-light pairing inside it still clears AA.

**The gradient CTA is AA-large, not AA.** White on `#A855F7` is 3.96:1 and on
`#EC4899` is 3.53:1. Both gradient stops are locked brand values and the white
label is the established brand treatment carried over from V1, so the gradient
button and the logo keep it. Everywhere the same colour would have carried
*ordinary* text, the theme moved off it instead: solid buttons sit on
`primary.dark` (5.70:1), links and outlined chips take `primary.light`
(≥6.6:1), and the skip link uses `primary.dark`.

**Hairlines are below 3:1 by design.** `divider` measures 1.16–1.32:1 against
the surfaces and the glass border 1.18:1. These are decorative rules, not
control boundaries or state indicators, so WCAG 1.4.11 does not apply to them;
they sit in the same range as every mainstream dark design system. Where a
boundary *is* the affordance — a text field — the field carries a filled
recessed background, a `primary.light` hover border, and a 2px `primary.main`
focus border with a 3px purple halo.

---

## 9. Measured contrast

WCAG 2.1 ratios, computed against the four surfaces
(`default` `#0B0710` / `paper` `#151020` / `elevated` `#1D1530` / `field` `#171126`).

### Text

| Token | default | paper | elevated | field |
|---|---|---|---|---|
| `text.primary` | 18.02 | 16.83 | 15.77 | 16.57 |
| `text.secondary` | 9.46 | 8.83 | 8.28 | 8.70 |
| `text.disabled` | 3.64 | 3.40 | 3.19 | 3.35 |
| `primary.light` | 7.55 | 7.05 | 6.61 | 6.94 |
| `secondary.light` | 7.54 | 7.04 | 6.60 | 6.93 |
| `accent.main` | 5.77 | 5.39 | 5.05 | 5.31 |
| `success.dark` | 7.87 | 7.35 | 6.89 | 7.23 |
| `warning.dark` | 9.29 | 8.68 | 8.13 | 8.54 |
| `error.dark` | 5.30 | 4.95 | 4.64 | 4.88 |
| `info.dark` | 7.20 | 6.72 | 6.30 | 6.62 |

`text.disabled` is a disabled-state token and is exempt from the AA minimum.

`primary.main` as *text* measures 5.04 / 4.71 / **4.41** / 4.64 — the elevated
figure is why links and outlined chips resolve to `primary.light` instead. Used
as a fill, a dot, or an icon it is fine everywhere (the non-text minimum is 3:1).

### Tinted fills — label on its own 14% wash

| Tone | Wash over paper | Label | Ratio |
|---|---|---|---|
| primary | `#2A1A3E` | `primary.light` | 6.04 |
| secondary | `#331831` | `secondary.light` | 6.03 |
| accent | `#30183D` | `accent.light` | 6.45 |
| success | `#192B31` | `success.light` | 9.63 |
| warning | `#352921` | `warning.light` | 9.77 |
| error | `#351E2B` | `error.light` | 8.06 |
| info | `#1A283E` | `info.light` | 8.89 |

`text.primary` on the purple wash is 14.41:1; `text.secondary` 7.57:1.

### Solid fills carrying a label

| Fill | Label | Ratio |
|---|---|---|
| `primary.dark` `#7C3AED` — contained button, skip link | `#FFFFFF` | 5.70 |
| `secondary.dark` `#BE185D` — contained button | `#FFFFFF` | 6.04 |
| `success.main` | `#0B0710` | 10.38 |
| `warning.main` | `#0B0710` | 11.96 |
| `error.main` | `#0B0710` | 7.22 |
| `info.main` | `#0B0710` | 9.32 |
| `text.primary` — Snackbar inverse surface | `#0B0710` | 18.02 |
| `background.elevated` — Tooltip, table head | `text.primary` | 15.77 |

### Focus ring

`#C084FC` against default / paper / elevated / field: **7.55 · 7.05 · 6.61 · 6.94**.
2px, offset 2, on every focusable element — restored on `ButtonBase` in the
theme because MUI zeroes the native outline.

---

## 10. Component treatments

What the override sweep in `src/theme/components.js` actually does.

- **Card** — elevated surface, glass border, `z1`. A card that owns a
  `CardActionArea` (this codebase's "the whole tile is a link" convention) lifts
  `translateY(-3px)` into `cardHover` over 200ms; static cards do not move. The
  rule is a `:has()` selector, so no call site opts in and browsers without
  `:has()` simply get no lift.
- **Button** — `variant="gradient"` rests with `glowPurple` and lifts 1px into
  `glowBrand` on hover and focus. Contained primary/secondary sit on the `dark`
  brand shade in *every* state; their hover energy is the glow, not a colour
  change, which is how each state stays above 4.5:1. Outlined and text variants
  take `primary.light` with a `primary.surface` hover.
- **TextField / OutlinedInput** — filled `background.input` well, `divider`
  border, `primary.light` at 55% on hover, `primary.main` plus a 3px purple halo
  on focus.
- **Chip** — filled: a 14% wash with the `light` label. Outlined: the `light`
  label with a 50% border. Default: a 9% white wash with `text.primary`.
- **Tabs** — a full-height pill filled with the brand gradient at 28% and a 32%
  purple inset ring; the selected label is `text.primary` at weight 700. The
  wash is not the neat gradient because a label on the full-saturation version
  would only reach ~3.5:1.
- **Dialog / Drawer / Menu / Popover** — elevated surface, glass border, `z3`
  (`z2` for menus), over an `rgba(6,3,10,0.7)` backdrop blurred 4px.
- **AppBar** — `background.default` at 80% behind a 12px blur, with a `divider`
  bottom rule.
- **Table** — opaque elevated header (opaque because `DataTable`'s header is
  sticky and a translucent wash would let rows scroll through it), `divider`
  cell borders, a 7% purple row hover.
- **Tooltip** — the light theme's ink chip would now be *lighter* than the page,
  so it is an elevated chip with a `divider` hairline instead.
- **Snackbar** — the inverse surface, which on a dark theme means a light chip
  with ink text.
- **Skeleton** — a 7% light block with an 8% light sweep.
- **CssBaseline** — `color-scheme: dark`, so native scrollbars, date pickers and
  form controls follow. Chrome's autofill is repainted separately in
  `global.css`; without that it punches a near-white hole through the theme.

---

## 11. For V2 prompts 02–10

- Read colour from the theme (`theme.palette.*`, `sx` palette paths) or from
  `--bb-*`. Do not introduce a hex.
- Put content on the right surface (§2) before reaching for a border.
- One glow per viewport at rest, and never behind body text (§5).
- `.bb-gradient-text` on display headings only (§7).
- Any new hover treatment: transform / opacity / shadow only, and it must
  survive `prefers-reduced-motion` as a static state.
- New tokens belong in `src/theme/palette.js` **and** `src/styles/tokens.css`,
  and get a row in this document.
