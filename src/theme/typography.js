// Typography tokens — prompts/00-architecture-and-rules.md §6.
// Display/headings: "Plus Jakarta Sans" (600–800). Body/UI: "Inter" (400–600).
// Both are self-hosted via @fontsource (imported in src/styles/global.css).

export const headingFontFamily =
  '"Plus Jakarta Sans", "Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

export const bodyFontFamily =
  '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

// MUI default `md` breakpoint. Typography is a plain object (no theme access),
// so the responsive step-up is expressed as a raw media query.
const MD_UP = '@media (min-width:900px)'

const heading = (weight, mobileRem, desktopRem, lineHeight, letterSpacing) => ({
  fontFamily: headingFontFamily,
  fontWeight: weight,
  fontSize: `${mobileRem}rem`,
  lineHeight,
  letterSpacing,
  [MD_UP]: { fontSize: `${desktopRem}rem` },
})

export const typography = {
  fontFamily: bodyFontFamily,
  fontWeightRegular: 400,
  fontWeightMedium: 500,
  fontWeightSemiBold: 600,
  fontWeightBold: 700,

  // 40px mobile → 56px desktop, scaling down through h6 (16 → 18px).
  h1: heading(800, 2.5, 3.5, 1.1, '-0.02em'),
  h2: heading(800, 2, 2.75, 1.15, '-0.02em'),
  h3: heading(700, 1.625, 2.125, 1.2, '-0.015em'),
  h4: heading(700, 1.375, 1.625, 1.25, '-0.01em'),
  h5: heading(600, 1.125, 1.25, 1.35, '-0.005em'),
  h6: heading(600, 1, 1.125, 1.4, '-0.005em'),

  subtitle1: { fontWeight: 600, fontSize: '1rem', lineHeight: 1.5 },
  subtitle2: { fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.5 },

  body1: { fontSize: '1rem', lineHeight: 1.6 },
  body2: { fontSize: '0.875rem', lineHeight: 1.6 },

  button: {
    fontFamily: headingFontFamily,
    fontWeight: 600,
    fontSize: '0.9375rem',
    lineHeight: 1.5,
    letterSpacing: 0,
    textTransform: 'none',
  },

  caption: { fontSize: '0.75rem', lineHeight: 1.5 },
  overline: {
    fontSize: '0.75rem',
    fontWeight: 600,
    lineHeight: 1.5,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
}
