// The industries a business can pick on its BetterBlue profile
// (`buyerProfiles.industry`, contract §6.3).
//
// A fixed, professional list rather than a free-text field: it keeps the
// directory tidy, it is what a future "browse buyers by industry" filter would
// group on, and it stops a profile form inventing its own vocabulary. The
// values are the labels themselves — the field stores what a person reads,
// exactly as the seed does — so nothing has to translate an id to display it.
//
// The first twelve mirror `constants/categoriesFallback.js`, so a buyer's
// industry lines up with the categories their briefs are posted under; the rest
// cover businesses that commission content without matching a content category.
// **Append only**: an existing profile stores its label, and renaming an entry
// would orphan it (see `buyerIndustryOptions`, which keeps such a value
// selectable rather than silently blanking the field).

export const BUYER_INDUSTRIES = Object.freeze([
  'Food & Beverage',
  'Fashion & Apparel',
  'Beauty & Skincare',
  'Fitness & Wellness',
  'Travel & Hospitality',
  'Technology & SaaS',
  'E-commerce & Retail',
  'Home & Lifestyle',
  'Automotive',
  'Education & Coaching',
  'Real Estate',
  'Events & Entertainment',
  'Health & Medical',
  'Professional Services',
  'Nonprofit & Community',
  'Other',
])

/**
 * Options for a `FormSelect`, with one guarantee: whatever the profile already
 * stores stays selectable. A value saved before this list existed — or one
 * retired from it later — is appended rather than dropped, so opening the form
 * can never quietly erase an industry nobody meant to change.
 *
 * @param {string} [currentValue] the value on the record being edited
 * @returns {Array<{value: string, label: string}>}
 */
export function buyerIndustryOptions(currentValue) {
  const values = BUYER_INDUSTRIES.includes(currentValue) || !currentValue
    ? BUYER_INDUSTRIES
    : [...BUYER_INDUSTRIES, currentValue]

  return values.map((value) => ({ value, label: value }))
}
