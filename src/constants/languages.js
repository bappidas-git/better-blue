// The languages a creator can say they work in (`creatorProfiles.languages`,
// contract §6.4).
//
// A fixed list rather than free text, for the same reasons `industries.js`
// gives: it keeps the storefronts comparable, it is what a future "creators who
// speak …" filter would group on, and it stops each profile form inventing its
// own spelling of the same language. The values **are** the labels — the field
// stores what a person reads, exactly as the seed does — so nothing has to
// translate an id to display it.
//
// **Append only**: an existing storefront stores its labels, and renaming an
// entry would orphan them (see `creatorLanguageOptions`, which keeps such a
// value selectable rather than silently dropping it from a saved profile).

export const CREATOR_LANGUAGES = Object.freeze([
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Dutch',
  'Swedish',
  'Norwegian',
  'Danish',
  'Finnish',
  'Polish',
  'Arabic',
  'Hindi',
  'Mandarin',
  'Cantonese',
  'Japanese',
  'Korean',
  'Turkish',
  'Swahili',
  'Wolof',
])

/**
 * Options for a multi-select `FormSelect`, with one guarantee: whatever the
 * storefront already stores stays selectable. A language saved before this list
 * existed — or one retired from it later — is appended rather than dropped, so
 * opening the profile form can never quietly erase it.
 *
 * @param {string[]} [currentValues] the languages on the record being edited
 * @returns {Array<{value: string, label: string}>}
 */
export function creatorLanguageOptions(currentValues = []) {
  const extras = (currentValues ?? []).filter(
    (value) => value && !CREATOR_LANGUAGES.includes(value)
  )

  return [...CREATOR_LANGUAGES, ...new Set(extras)].map((value) => ({ value, label: value }))
}
