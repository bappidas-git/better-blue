// Motion tokens — prompts/00-architecture-and-rules.md §7.
// Consumed by Framer variants (src/components/motion/motionPresets.js),
// GSAP marketing scenes, and CSS transitions inside theme overrides.
// Animate transform/opacity only; keep interactions under 400ms.

export const durations = {
  fast: 150,
  base: 250,
  slow: 400,
  hero: 650,
}

/** Ease-out-expo-like curve, as a Framer Motion cubic-bezier array. */
export const easing = [0.22, 1, 0.36, 1]

/** Same curve for CSS `transition`/`animation` timing functions. */
export const cssEasing = `cubic-bezier(${easing.join(', ')})`

/** Standard travel distances (px) for enter/reveal animations. */
export const distances = {
  sm: 8,
  md: 16,
  lg: 24,
}

export const motionTokens = { durations, easing, cssEasing, distances }

export default motionTokens
