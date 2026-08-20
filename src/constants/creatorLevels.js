// Creator levels — Storefront V2 (`prompts-v2/03-…`).
//
// A creator's level is the one number the storefront uses to say "this person
// has done this before". It is **derived, never stored by hand**: give
// `getCreatorLevel` a creator's delivery count and lifetime earnings and it
// returns 1, 2, or 3. The seed script calls this exact function
// (`scripts/seed-db.js`), so `creatorProfiles.level` in `server/db.json` and
// anything the app recomputes at runtime can never disagree.
//
// Framework-free on purpose: `scripts/seed-db.js` imports this module from
// plain Node, so it must not reach for `@/` aliases, the theme, or MUI.
//
// > **Laravel** — the same two thresholds belong in one place server-side (a
// > `creator_level` accessor or a nightly recompute writing `creator_profiles.
// > level`). Ship the thresholds as configuration, not as literals scattered
// > across queries, and keep this file as the client-side mirror.

/** The three levels, in ascending order. */
export const CREATOR_LEVEL = Object.freeze({
  ONE: 1,
  TWO: 2,
  THREE: 3,
})

/**
 * The thresholds, highest first. **Both** figures must be met — a creator with
 * 40 cheap deliveries and one with a single five-figure commission have each
 * done half of what Level 3 claims, so neither reaches it.
 *
 * Ordered highest-first so `getCreatorLevel` can return the first match.
 */
export const CREATOR_LEVEL_THRESHOLDS = Object.freeze([
  Object.freeze({ level: CREATOR_LEVEL.THREE, deliveries: 25, earned: 10000 }),
  Object.freeze({ level: CREATOR_LEVEL.TWO, deliveries: 10, earned: 2000 }),
])

/**
 * `{ label, tone, description }` per level. `tone` is a `STATUS_TONES` value so
 * the badge can be coloured the same way every other tinted chip in the product
 * is; `glow` says how much halo the badge carries — Level 3 is the only one
 * loud enough to read as an award (`docs/theme-v2.md` §5: one glow per viewport
 * at rest).
 */
export const CREATOR_LEVEL_META = Object.freeze({
  [CREATOR_LEVEL.ONE]: Object.freeze({
    label: 'Level 1',
    tone: 'neutral',
    glow: 'none',
    description: 'Building a delivery record on BetterBlue.',
  }),
  [CREATOR_LEVEL.TWO]: Object.freeze({
    label: 'Level 2',
    tone: 'info',
    glow: 'subtle',
    description: 'At least 10 deliveries and $2,000 earned.',
  }),
  [CREATOR_LEVEL.THREE]: Object.freeze({
    label: 'Level 3',
    tone: 'brand',
    glow: 'strong',
    description: 'At least 25 deliveries and $10,000 earned.',
  }),
})

/** A finite, non-negative number — anything else counts as zero. */
function toCount(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

/**
 * The level a creator has earned.
 *
 * @param {object} [creator] a `creatorProfiles` record, or anything carrying the
 *   two figures
 * @param {number} [creator.deliveriesCount] orders delivered, lifetime
 * @param {number} [creator.totalEarned] earnings net of commission, lifetime
 * @returns {1|2|3} never `null` — every creator is at least Level 1
 *
 * @example
 * getCreatorLevel({ deliveriesCount: 42, totalEarned: 13124 }) // → 3
 * getCreatorLevel({})                                          // → 1
 */
export function getCreatorLevel({ deliveriesCount, totalEarned } = {}) {
  const deliveries = toCount(deliveriesCount)
  const earned = toCount(totalEarned)

  const match = CREATOR_LEVEL_THRESHOLDS.find(
    (threshold) => deliveries >= threshold.deliveries && earned >= threshold.earned
  )
  return match ? match.level : CREATOR_LEVEL.ONE
}

/**
 * Metadata for a level, tolerant of a missing or unknown value so a storefront
 * seeded before levels existed still renders a badge.
 *
 * @param {number} level `1` | `2` | `3`
 * @returns {{label: string, tone: string, glow: string, description: string}}
 */
export function getCreatorLevelMeta(level) {
  return CREATOR_LEVEL_META[level] ?? CREATOR_LEVEL_META[CREATOR_LEVEL.ONE]
}

export default CREATOR_LEVEL
