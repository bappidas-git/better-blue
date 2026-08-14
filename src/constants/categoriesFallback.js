// Marketplace categories — offline fallback + seed source.
//
// `categoryService.listActive()` (Prompt 07) serves categories from the API and
// falls back to this list when the request fails, and the seed script
// (Prompt 05) generates the `categories` collection from it — so these IDs are
// the canonical `cat_…` identifiers used across the whole product. Array order
// is the display order (`sortOrder` = index + 1 in the seed); every seeded
// category starts `active: true`.
//
// Icons are Iconify names from the `tabler` set (00 §3).

/** Category IDs, so nothing downstream has to write a `cat_…` literal. */
export const CATEGORY_ID = Object.freeze({
  FOOD_BEVERAGE: 'cat_food_beverage',
  FASHION_APPAREL: 'cat_fashion_apparel',
  BEAUTY_SKINCARE: 'cat_beauty_skincare',
  FITNESS_WELLNESS: 'cat_fitness_wellness',
  TRAVEL_HOSPITALITY: 'cat_travel_hospitality',
  TECHNOLOGY_SAAS: 'cat_technology_saas',
  ECOMMERCE_PRODUCTS: 'cat_ecommerce_products',
  HOME_LIFESTYLE: 'cat_home_lifestyle',
  AUTOMOTIVE: 'cat_automotive',
  EDUCATION_COACHING: 'cat_education_coaching',
  REAL_ESTATE: 'cat_real_estate',
  EVENTS_ENTERTAINMENT: 'cat_events_entertainment',
})

export const CATEGORIES_FALLBACK = Object.freeze([
  Object.freeze({
    id: CATEGORY_ID.FOOD_BEVERAGE,
    name: 'Food & Beverage',
    slug: 'food-beverage',
    icon: 'tabler:tools-kitchen-2',
  }),
  Object.freeze({
    id: CATEGORY_ID.FASHION_APPAREL,
    name: 'Fashion & Apparel',
    slug: 'fashion-apparel',
    icon: 'tabler:shirt',
  }),
  Object.freeze({
    id: CATEGORY_ID.BEAUTY_SKINCARE,
    name: 'Beauty & Skincare',
    slug: 'beauty-skincare',
    icon: 'tabler:sparkles',
  }),
  Object.freeze({
    id: CATEGORY_ID.FITNESS_WELLNESS,
    name: 'Fitness & Wellness',
    slug: 'fitness-wellness',
    icon: 'tabler:barbell',
  }),
  Object.freeze({
    id: CATEGORY_ID.TRAVEL_HOSPITALITY,
    name: 'Travel & Hospitality',
    slug: 'travel-hospitality',
    icon: 'tabler:plane',
  }),
  Object.freeze({
    id: CATEGORY_ID.TECHNOLOGY_SAAS,
    name: 'Technology & SaaS',
    slug: 'technology-saas',
    icon: 'tabler:device-laptop',
  }),
  Object.freeze({
    id: CATEGORY_ID.ECOMMERCE_PRODUCTS,
    name: 'E-commerce Products',
    slug: 'ecommerce-products',
    icon: 'tabler:shopping-bag',
  }),
  Object.freeze({
    id: CATEGORY_ID.HOME_LIFESTYLE,
    name: 'Home & Lifestyle',
    slug: 'home-lifestyle',
    icon: 'tabler:sofa',
  }),
  Object.freeze({
    id: CATEGORY_ID.AUTOMOTIVE,
    name: 'Automotive',
    slug: 'automotive',
    icon: 'tabler:car',
  }),
  Object.freeze({
    id: CATEGORY_ID.EDUCATION_COACHING,
    name: 'Education & Coaching',
    slug: 'education-coaching',
    icon: 'tabler:school',
  }),
  Object.freeze({
    id: CATEGORY_ID.REAL_ESTATE,
    name: 'Real Estate',
    slug: 'real-estate',
    icon: 'tabler:building-community',
  }),
  Object.freeze({
    id: CATEGORY_ID.EVENTS_ENTERTAINMENT,
    name: 'Events & Entertainment',
    slug: 'events-entertainment',
    icon: 'tabler:confetti',
  }),
])

/** Look up a fallback category by id; `undefined` when unknown. */
export function getFallbackCategory(categoryId) {
  return CATEGORIES_FALLBACK.find((category) => category.id === categoryId)
}
