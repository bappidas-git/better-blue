import dayjs from 'dayjs'

import { CONTENT_TYPE, STATUS_META } from '@/constants/statuses'
import { listParam } from '@/hooks/useListParams'
import { SORT_ORDER } from '@/services/api/listAdapter'

// The request board's filter contract in one place: what the query string is
// allowed to say, what each control offers, and how both translate into
// `requestService.listBoard` parameters.
//
// The mirror of `features/discovery/utils/creatorFilters.js` (Prompt 12), and
// deliberately so — the public board and the creator's browse view are the
// supply-side twin of creator discovery, and a creator who has used one should
// recognise the other. Everything the board components need to *decide*
// something lives here, so they stay declarative (§7).

/**
 * Query-string keys. Short, because these end up in shared links, and frozen
 * because a renamed key silently breaks every link already sent.
 */
export const BOARD_PARAM = Object.freeze({
  SEARCH: 'q',
  CATEGORY: 'category',
  CONTENT_TYPE: 'type',
  BUDGET_MIN: 'min',
  DEADLINE: 'deadline',
  INVITED: 'invited',
  SCOPE: 'scope',
  SORT: 'sort',
  PAGE: 'page',
})

/**
 * Which slice of the board a creator is looking at when they have not picked
 * categories by hand. `mine` narrows to the categories on their storefront —
 * the sensible default for somebody browsing for work they can actually take.
 */
export const BOARD_SCOPE = Object.freeze({ MINE: 'mine', ALL: 'all' })

/** Cards per page: two full rows on the widest layout. */
export const BOARD_PAGE_SIZE = 8

/**
 * Minimum-budget slider bounds. Unlike discovery's price *range*, this is a
 * single "at least" handle: a creator filters out the briefs that cannot pay
 * for the work, and the top stop genuinely means "$2,000 or more".
 */
export const BUDGET_RANGE = Object.freeze({ min: 0, max: 2000, step: 50 })

/** Deadline windows, in days — "briefs due inside the next …". */
export const DEADLINE_OPTIONS = Object.freeze([
  Object.freeze({ value: '7', label: 'Next 7 days' }),
  Object.freeze({ value: '14', label: 'Next 14 days' }),
  Object.freeze({ value: '30', label: 'Next 30 days' }),
])

const DEADLINE_VALUES = DEADLINE_OPTIONS.map((option) => option.value)

/** Iconify names per content type — labels come from `STATUS_META` (00 §9). */
const CONTENT_TYPE_ICONS = Object.freeze({
  [CONTENT_TYPE.PHOTO]: 'tabler:photo',
  [CONTENT_TYPE.VIDEO]: 'tabler:video',
  [CONTENT_TYPE.BUNDLE]: 'tabler:package',
})

/** Chip options for the content-type filter, in enum order. */
export const CONTENT_TYPE_OPTIONS = Object.freeze(
  Object.values(CONTENT_TYPE).map((value) =>
    Object.freeze({
      value,
      label: STATUS_META[value]?.label ?? value,
      icon: CONTENT_TYPE_ICONS[value],
    })
  )
)

const CONTENT_TYPE_VALUES = Object.values(CONTENT_TYPE)

/** Sort tokens. The URL spelling; the stored column each maps to is below. */
export const BOARD_SORT = Object.freeze({
  NEWEST: 'newest',
  BUDGET_HIGH_LOW: 'budget_high_low',
  DEADLINE_SOONEST: 'deadline_soonest',
})

export const SORT_OPTIONS = Object.freeze([
  Object.freeze({ value: BOARD_SORT.NEWEST, label: 'Newest' }),
  Object.freeze({ value: BOARD_SORT.BUDGET_HIGH_LOW, label: 'Budget: high to low' }),
  Object.freeze({ value: BOARD_SORT.DEADLINE_SOONEST, label: 'Deadline: soonest' }),
])

const SORT_VALUES = SORT_OPTIONS.map((option) => option.value)

/**
 * Sort token → the stored column and direction the service sorts on. Kept here
 * rather than in the page for the same reason `CREATOR_ORDERING` is kept in the
 * service: the control offers an *intention*, not a column name.
 */
const SORT_FIELDS = Object.freeze({
  [BOARD_SORT.NEWEST]: { sort: 'publishedAt', order: SORT_ORDER.DESC },
  [BOARD_SORT.BUDGET_HIGH_LOW]: { sort: 'budgetMax', order: SORT_ORDER.DESC },
  [BOARD_SORT.DEADLINE_SOONEST]: { sort: 'deadline', order: SORT_ORDER.ASC },
})

/**
 * The schema `useListParams` runs the URL through. Frozen at module scope so
 * its identity is stable — the hook memoises on it.
 */
export const boardSchema = Object.freeze({
  [BOARD_PARAM.SEARCH]: listParam.text(),

  // Validated against the live taxonomy passed as `context`; an id that no
  // longer exists is dropped rather than sent to the API.
  [BOARD_PARAM.CATEGORY]: listParam.list({
    allow: (value, context) => !context?.categoryIds || context.categoryIds.has(value),
  }),

  [BOARD_PARAM.CONTENT_TYPE]: listParam.list({
    allow: (value) => CONTENT_TYPE_VALUES.includes(value),
  }),

  [BOARD_PARAM.BUDGET_MIN]: listParam.number({
    fallback: BUDGET_RANGE.min,
    min: BUDGET_RANGE.min,
    max: BUDGET_RANGE.max,
    integer: true,
  }),

  [BOARD_PARAM.DEADLINE]: listParam.choice({ options: DEADLINE_VALUES, fallback: null }),

  // Only meaningful for a signed-in creator; a guest's `?invited=1` parses to
  // `true` and is then ignored by `toBoardListParams`, which has no id to
  // filter on. That is deliberate — the URL never lies about what it asked for.
  [BOARD_PARAM.INVITED]: listParam.flag({ fallback: false }),

  // A view scope rather than a filter: it decides what "no category chosen"
  // means, so it neither counts toward the "Filters (2)" badge nor is reset by
  // "Clear all". Inert on the public board, which has no creator categories to
  // narrow to.
  [BOARD_PARAM.SCOPE]: listParam.choice({
    options: Object.values(BOARD_SCOPE),
    fallback: BOARD_SCOPE.MINE,
    isFilter: false,
  }),

  [BOARD_PARAM.SORT]: listParam.choice({
    options: SORT_VALUES,
    fallback: BOARD_SORT.NEWEST,
    isFilter: false,
  }),

  [BOARD_PARAM.PAGE]: listParam.number({
    fallback: 1,
    min: 1,
    max: 9999,
    integer: true,
    isFilter: false,
  }),
})

/**
 * Parsed URL values → `requestService.listBoard` parameters.
 *
 * Only the service's documented vocabulary crosses this boundary (§7). Anything
 * at its default is omitted entirely, which is what makes the budget slider at
 * zero mean "any budget" rather than "at least nothing".
 *
 * The budget filter reads `budgetMax_gte`: a creator asking for briefs worth at
 * least $500 wants the ones whose *ceiling* clears $500, not the ones whose
 * floor does — a `$300–$900` brief is worth their time and a `$400` fixed one
 * is not.
 *
 * @param {object} values parsed board values
 * @param {object} [options]
 * @param {number} [options.limit=BOARD_PAGE_SIZE] page size
 * @param {string} [options.invitedCreatorId] the viewing creator's `cpr_…`,
 *   required before the "Invited to you" filter can do anything
 * @param {string[]} [options.defaultCategoryIds] applied when the URL names no
 *   category **and** the scope is `mine` — the creator's own categories on the
 *   dashboard browse view
 * @returns {object} params for `requestService.listBoard`
 */
export function toBoardListParams(
  values,
  { limit = BOARD_PAGE_SIZE, invitedCreatorId, defaultCategoryIds } = {}
) {
  const { sort, order } = SORT_FIELDS[values[BOARD_PARAM.SORT]] ?? SORT_FIELDS[BOARD_SORT.NEWEST]

  const chosenCategories = values[BOARD_PARAM.CATEGORY]
  const isScopedToMine = values[BOARD_PARAM.SCOPE] === BOARD_SCOPE.MINE
  const categories =
    chosenCategories.length > 0
      ? chosenCategories
      : isScopedToMine
        ? (defaultCategoryIds ?? []).filter(Boolean)
        : []

  const contentTypes = values[BOARD_PARAM.CONTENT_TYPE]
  const budgetMin = values[BOARD_PARAM.BUDGET_MIN]
  const deadlineDays = values[BOARD_PARAM.DEADLINE]

  const filters = {}
  if (categories.length > 0) filters.categoryId = categories
  if (contentTypes.length > 0) filters.contentType = contentTypes
  if (budgetMin > BUDGET_RANGE.min) filters.budgetMax_gte = budgetMin
  if (deadlineDays) {
    filters.deadline_lte = dayjs().add(Number(deadlineDays), 'day').endOf('day').toISOString()
  }
  if (values[BOARD_PARAM.INVITED] && invitedCreatorId) {
    filters.invitedCreatorId = invitedCreatorId
  }

  return {
    page: values[BOARD_PARAM.PAGE],
    limit,
    sort,
    order,
    search: values[BOARD_PARAM.SEARCH] || undefined,
    filters,
  }
}

/**
 * Is this brief addressed to the creator reading it?
 *
 * `invitedCreatorId` is a **`cpr_…`** — the storefront the buyer arrived from
 * when they wrote the brief (Prompt 16) — so the comparison is against the
 * creator's *profile* id, never their account id.
 *
 * @param {object} request a brief record
 * @param {string} [creatorProfileId] the viewing creator's `cpr_…`
 * @returns {boolean}
 */
export function isInvitedTo(request, creatorProfileId) {
  return Boolean(
    creatorProfileId && request?.invitedCreatorId && request.invitedCreatorId === creatorProfileId
  )
}
