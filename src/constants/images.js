// Imagery helpers — prompts/00-architecture-and-rules.md §1.
//
// Every image URL in the product flows through this module so the client can
// swap the placeholder source for real media later by editing one file.
// Photography comes from picsum.photos with a *stable seed*, so the same
// entity always renders the same generic professional photo; avatars are
// generated locally as initials SVGs (nothing is hotlinked).
//
// This module stays framework-free (no React, no MUI, no theme import): the
// Prompt 05 seed script imports it from plain Node. That is also why the tint
// hex values are restated here — like `src/styles/tokens.css`, this is a
// documented mirror of the locked palette in `src/theme/palette.js` (00 §6),
// because an SVG string cannot read the MUI theme.

import { CATEGORY_ID } from './categoriesFallback.js'

const PICSUM_BASE = 'https://picsum.photos/seed'

/** Seed used when a caller has nothing stable to key on. */
export const DEFAULT_IMAGE_SEED = 'betterblue'

/** Common render sizes, so callers stop inventing dimensions. */
export const IMAGE_SIZES = Object.freeze({
  thumbnail: Object.freeze({ width: 400, height: 300 }),
  card: Object.freeze({ width: 800, height: 600 }),
  wide: Object.freeze({ width: 1200, height: 675 }),
  hero: Object.freeze({ width: 1600, height: 900 }),
})

/** Stable picsum seed per marketplace category (cover art, category cards). */
export const CATEGORY_IMAGE_SEEDS = Object.freeze({
  [CATEGORY_ID.FOOD_BEVERAGE]: 'bb-food-beverage',
  [CATEGORY_ID.FASHION_APPAREL]: 'bb-fashion-apparel',
  [CATEGORY_ID.BEAUTY_SKINCARE]: 'bb-beauty-skincare',
  [CATEGORY_ID.FITNESS_WELLNESS]: 'bb-fitness-wellness',
  [CATEGORY_ID.TRAVEL_HOSPITALITY]: 'bb-travel-hospitality',
  [CATEGORY_ID.TECHNOLOGY_SAAS]: 'bb-technology-saas',
  [CATEGORY_ID.ECOMMERCE_PRODUCTS]: 'bb-ecommerce-products',
  [CATEGORY_ID.HOME_LIFESTYLE]: 'bb-home-lifestyle',
  [CATEGORY_ID.AUTOMOTIVE]: 'bb-automotive',
  [CATEGORY_ID.EDUCATION_COACHING]: 'bb-education-coaching',
  [CATEGORY_ID.REAL_ESTATE]: 'bb-real-estate',
  [CATEGORY_ID.EVENTS_ENTERTAINMENT]: 'bb-events-entertainment',
})

/**
 * Initials-avatar tints. Backgrounds and text colors are locked palette
 * tokens, paired so every combination clears AA contrast.
 */
export const AVATAR_TINTS = Object.freeze({
  purple: Object.freeze({ background: '#EDE9FE', color: '#5B21B6' }),
  lilac: Object.freeze({ background: '#F5F3FF', color: '#7C3AED' }),
  pink: Object.freeze({ background: '#FDF2F8', color: '#BE185D' }),
  ink: Object.freeze({ background: '#E5E2EC', color: '#171223' }),
})

/** Tint names in deterministic-selection order. */
export const AVATAR_TINT_NAMES = Object.freeze(Object.keys(AVATAR_TINTS))

const AVATAR_FONT_STACK =
  "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

/** Small, stable string hash (djb2) — deterministic across sessions. */
function hashString(value) {
  let hash = 5381
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index)
  }
  return Math.abs(hash | 0)
}

const toPositiveInt = (value, fallback) => {
  const parsed = Math.round(Number(value))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/** Normalizes any string into a URL-safe, stable picsum seed. */
function normalizeSeed(seed) {
  const cleaned = String(seed ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return cleaned || DEFAULT_IMAGE_SEED
}

/**
 * Seeded placeholder photograph.
 * @param {string} seed stable key (entity id, slug, or descriptive string)
 * @param {number} [width=800]
 * @param {number} [height=600]
 * @returns {string} e.g. `https://picsum.photos/seed/bb-food-beverage/800/600`
 */
export function imageUrl(seed, width = IMAGE_SIZES.card.width, height = IMAGE_SIZES.card.height) {
  const safeWidth = toPositiveInt(width, IMAGE_SIZES.card.width)
  const safeHeight = toPositiveInt(height, IMAGE_SIZES.card.height)
  return `${PICSUM_BASE}/${normalizeSeed(seed)}/${safeWidth}/${safeHeight}`
}

/** Cover image for a category, using its stable seed. */
export function categoryImageUrl(categoryId, width, height) {
  return imageUrl(CATEGORY_IMAGE_SEEDS[categoryId] ?? categoryId, width, height)
}

/**
 * Up to two uppercase initials for a person or business name.
 * `'Ava Martinez'` → `'AM'`, `'Verde Kitchen'` → `'VK'`, `''` → `'BB'`.
 */
export function initialsFromName(name) {
  const words = String(name ?? '')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) return 'BB'

  const letters =
    words.length === 1
      ? words[0].slice(0, 2)
      : `${words[0][0]}${words[words.length - 1][0]}`

  return letters.toUpperCase()
}

/**
 * Deterministic initials avatar as an SVG data URI — safe in `<img src>` and
 * MUI `<Avatar src>`, with no network request.
 * @param {string} name display name the initials come from
 * @param {string} [tint] one of `AVATAR_TINT_NAMES`; omitted → derived from the name
 * @param {{ size?: number }} [options]
 */
export function avatarDataUri(name, tint, options = {}) {
  const initials = initialsFromName(name)
  const tintName =
    tint && AVATAR_TINTS[tint]
      ? tint
      : AVATAR_TINT_NAMES[hashString(String(name ?? '')) % AVATAR_TINT_NAMES.length]
  const { background, color } = AVATAR_TINTS[tintName]
  const size = toPositiveInt(options.size, 128)
  const fontSize = Math.round(size * 0.4)

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `<rect width="${size}" height="${size}" fill="${background}"/>`,
    `<text x="50%" y="50%" dy="0.35em" text-anchor="middle" fill="${color}"`,
    ` font-family="${AVATAR_FONT_STACK}" font-size="${fontSize}" font-weight="600"`,
    ` letter-spacing="1">${initials}</text>`,
    '</svg>',
  ].join('')

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
