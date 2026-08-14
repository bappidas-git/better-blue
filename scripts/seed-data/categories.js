// Seed: `categories` — the marketplace taxonomy (Prompt 05 §4.3).
//
// Generated from `src/constants/categoriesFallback.js` so the seeded rows, the
// offline fallback used by `categoryService`, and the `CATEGORY_ID` map can
// never drift apart. Array order is display order: `sortOrder` = index + 1.

import { CATEGORIES_FALLBACK } from '../../src/constants/categoriesFallback.js'

export const categories = CATEGORIES_FALLBACK.map((category, index) => ({
  id: category.id,
  name: category.name,
  slug: category.slug,
  icon: category.icon,
  active: true,
  sortOrder: index + 1,
}))

/** Every category id, in display order. */
export const CATEGORY_IDS = categories.map((category) => category.id)
