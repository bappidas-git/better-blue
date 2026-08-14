# Prompt 04 — Reusable UI Component Library

> **Before you start:** Read `prompts/00-architecture-and-rules.md` (especially §5 structure, §6 design, §12 UX patterns), then inspect Prompts 01–03 output.

## 1. Objective

Build the shared component library every feature will reuse: feedback (toasts, confirm, empty/error states, skeletons), data display (StatusChip, StatCard, DataTable, avatars, ratings, timeline, lightbox), inputs/forms (+ `useForm` hook), layout primitives, and motion wrappers — all showcased in the dev gallery.

## 2. Context

00 §12 defines the standard UX patterns; these components are their concrete implementation. Later prompts are forbidden from re-implementing any of this, so names and props defined here are canonical.

## 3. What Already Exists

Theme/tokens/motion presets (02), constants incl. `STATUS_META` (03), validators/formatters (03), dev gallery page.

## 4. What to Implement

**Feedback (`src/components/feedback/`)**
1. `ToastProvider.jsx` + exported `useToast()` — context over MUI Snackbar/Alert; API `toast.success|error|info|warning(message, { description? })`; stacked bottom-center mobile / bottom-right desktop; auto-hide 4s; Framer enter/exit.
2. `ConfirmDialogProvider.jsx` + `useConfirm()` — promise-based: `const ok = await confirm({ title, message, confirmLabel, tone: 'danger'|'primary', requireReason?: boolean })`; returns `false` or `{ confirmed: true, reason? }`; danger tone uses error palette; built on ResponsiveDialog (below).
3. `EmptyState.jsx` — icon (iconify), title, description, optional primary/secondary action; centered, elegant, per 00 §6.
4. `ErrorState.jsx` — friendly message + technical detail collapsible + Retry button (`onRetry`).
5. `skeletons/` — `CardSkeleton`, `ListSkeleton(rows)`, `TableSkeleton(rows, cols)`, `StatSkeleton`, `ProfileSkeleton`, `FormSkeleton`; all pulse via MUI Skeleton, sized to match real components.

**Data display (`src/components/data-display/`)**
6. `StatusChip.jsx` — props `status` + `metaMap` (defaults to `STATUS_META`); renders tinted chip from `tone`; dot indicator; sm/md sizes.
7. `StatCard.jsx` — label, value (supports `AnimatedNumber`), optional delta (+/- with tone), icon tile, optional `to` link, loading state.
8. `UserAvatar.jsx` — image or initials fallback via `avatarDataUri`; sizes; optional status dot; `UserAvatarGroup`.
9. `RatingStars.jsx` — display mode (value, count) + input mode (`onChange`, keyboard accessible); half-star display.
10. `KeyValueList.jsx` — responsive definition list (stacks on mobile, two columns desktop).
11. `TimelineList.jsx` — vertical timeline: icon node, title, description, timestamp, tone; used for order/dispute/audit histories.
12. `PaginationControl.jsx` — MUI Pagination + "x–y of z" text; compact on mobile.
13. `MediaLightbox.jsx` — dialog-based media viewer: image or video (HTML5) with caption, prev/next arrows, keyboard nav (←/→/Esc), focus trap, thumbnail strip on desktop.

**Inputs & forms (`src/components/inputs/`)**
14. `SearchInput.jsx` — debounced (300ms via `useDebounce` — create `src/hooks/useDebounce.js`), search icon, clear button.
15. `SortSelect.jsx` — options `{ value, label }`; `FilterChipGroup.jsx` — single/multi-select chip row, horizontal-scroll on mobile.
16. Form fields wrapping MUI with unified props `{ label, value, onChange(value), error, helperText, required, ... }`: `FormTextField` (multiline support, counter when `maxLength`), `FormSelect`, `FormDateField` (MUI X DatePicker + dayjs), `FormFileField` (drag-drop zone + browse; accept/multiple/maxSizeMb; shows name/size/type chips + image previews; emits `File[]` — actual upload handled by services later), `CurrencyField` (prefix $, numeric sanitization, 2dp on blur).
17. `src/hooks/useForm.js` — `useForm({ initialValues, validators })` → `{ values, errors, touched, setValue, handleSubmit(onValid), reset, isSubmitting, setSubmitting }`; validates on blur + submit; on invalid submit focuses first errored field (by ref registry or id convention).

**Layout (`src/components/layout/`)**
18. `PageHeader.jsx` — title, subtitle, optional back button, breadcrumbs slot, actions slot; responsive (actions wrap below title on mobile).
19. `Section.jsx` — consistent vertical rhythm wrapper with optional heading/eyebrow/action.
20. `ResponsiveDialog.jsx` — MUI Dialog ≥ md; full-screen slide-up sheet (rounded top 20) < md; standard header (title + close), scrollable body, sticky footer actions; focus trap + Escape + focus return (MUI native) verified.
21. `SideSheet.jsx` — right drawer desktop / full-screen mobile, for detail peeks and filters.
22. `StickyActionBar.jsx` — bottom-sticky action container (mobile primary CTAs), safe-area padding, top hairline.

**Table (`src/components/table/`)**
23. `DataTable.jsx` — props: `columns [{ key, label, render?, sortable?, align?, width? }]`, `rows`, `loading`, `error`, `onRetry`, `emptyState` props, `sort/onSortChange`, `pagination` props, `onRowClick`, `renderMobileCard(row)`; desktop: MUI table with sticky header; `< md`: renders card list via `renderMobileCard` (required prop — no shrunken tables per 00 §13); integrates TableSkeleton/EmptyState/ErrorState/PaginationControl.

**Motion (`src/components/motion/`)**
24. `PageTransition.jsx` (fade+8px rise on route enter, exit fade; respects MotionConfig), `FadeInView.jsx` (whileInView once, viewport margin), `StaggerList.jsx` (container+item from presets), `AnimatedNumber.jsx` (spring count-up; static under reduced motion).

**Wiring** — mount ToastProvider + ConfirmDialogProvider in `AppProviders`. Rebuild DevDesignPage into tabbed gallery: Tokens / Components / Forms / Motion, demonstrating every component above (incl. DataTable with fake local rows in both desktop and mobile modes, lightbox, toasts, confirm incl. requireReason, useForm demo with validators).

## 5. Functional Requirements

All components controlled, prop-driven, zero API awareness, zero business logic; gallery exercises every state (loading/error/empty/success).

## 6. UI/UX Requirements

Per 00 §6/§12: 44px touch targets, subtle shadows, tinted chips, elegant empty states, motion ≤ 400ms.

## 7. Technical Requirements

CSS Modules only where `sx` is insufficient; every component JSDoc'd with prop descriptions; no default-export barrels that break tree-shaking (use `src/components/index.js` barrel with named exports).

## 8. API Requirements

None (DataTable etc. consume props only).

## 9. Data Requirements

Gallery uses small inline fixture arrays (allowed only inside the dev gallery).

## 10. Files & Folders

As listed in section 4 + `src/hooks/useDebounce.js`, `src/hooks/useForm.js`, `src/components/index.js`. Updates: `AppProviders.jsx`, `DevDesignPage.jsx`.

## 11. Responsive Requirements

Verify at 360/768/1280: DataTable card mode, ResponsiveDialog sheet mode, PageHeader wrap, FilterChipGroup scroll, StickyActionBar safe-area.

## 12. Accessibility Requirements

Dialogs: focus trap, Escape, `aria-labelledby`, focus return. RatingStars input: radiogroup semantics + arrow keys. Toasts: `role="status"` (success/info) / `role="alert"` (error). Lightbox: arrows keyboard operable, alt text prop required. All icon-only buttons have `aria-label`.

## 13. Validation & Error Handling

`useForm` + validators integration proven in gallery (submit invalid → inline errors + focus first). FormFileField enforces accept/size with inline error, never crashes on odd files.

## 14. Acceptance Criteria

Gallery demonstrates every component/state listed; confirm-with-reason resolves `{ confirmed, reason }`; DataTable switches to cards < 900px; lint + build clean; console clean.

## 15. Verification Steps

1. Walk the gallery tabs at 360px and 1280px; keyboard-only pass on dialog, rating, lightbox, form.
2. Reduced-motion check: transitions/AnimatedNumber become static.
3. `npm run lint && npm run build`.

## 16. Constraints

Execution protocol per 00 §16: inspect first · additive changes · reuse before creating · JS/JSX only · no new dependencies · Node 18.19.0 · lint+build clean · report changes/assumptions/issues.

## 17. Do NOT Change

Theme token values, constants APIs, `prompts/`.

## 18. Depends On

01, 02, 03.

## 19. Final Checklist

- [ ] All 24 components + 2 hooks built with canonical names/props
- [ ] Providers wired; gallery covers everything incl. edge states
- [ ] Mobile card mode + sheet dialogs verified at 360px
- [ ] A11y behaviors (traps, labels, keyboard) verified
- [ ] Lint + build clean; report written
