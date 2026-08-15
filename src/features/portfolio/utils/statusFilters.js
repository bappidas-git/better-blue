// The status buckets the portfolio manager filters and counts by.
//
// A creator does not think in the nine CONTENT_STATUS values — they think in
// "live", "with the reviewers", "needs my attention", and "not finished". This
// module is the one place those two vocabularies are mapped onto each other, so
// the chips, the grid, and the empty states can never disagree about which
// bucket an item is in.
//
// Every status lands in exactly one bucket. That is not a detail: a status with
// no bucket would give a creator an item they own and cannot reach through any
// filter.

import {
  PORTFOLIO_IN_REVIEW_STATUSES,
  summarizePortfolioStatuses,
} from '@/services/portfolioService'
import { CONTENT_STATUS } from '@/constants/statuses'

/** Filter tokens. `ALL` is the default and is never hidden. */
export const PORTFOLIO_FILTER = Object.freeze({
  ALL: 'all',
  PUBLISHED: 'published',
  IN_REVIEW: 'in_review',
  NEEDS_CHANGES: 'needs_changes',
  REJECTED: 'rejected',
  DRAFTS: 'drafts',
  ARCHIVED: 'archived',
  RESTRICTED: 'restricted',
})

export const DEFAULT_PORTFOLIO_FILTER = PORTFOLIO_FILTER.ALL

/**
 * Bucket definitions, in the order they appear on screen: what is live, what is
 * moving, what is stuck, what is unfinished, what is retired.
 *
 * `countKey` indexes `summarizePortfolioStatuses`. `always` marks the buckets
 * that stay on screen at zero — the ones whose emptiness is worth telling a
 * creator about. The rest appear only once they hold something, which keeps the
 * chip row honest and short enough to fit a phone.
 */
export const PORTFOLIO_FILTERS = Object.freeze([
  Object.freeze({
    value: PORTFOLIO_FILTER.ALL,
    label: 'All',
    countKey: 'total',
    always: true,
    statuses: null,
  }),
  Object.freeze({
    value: PORTFOLIO_FILTER.PUBLISHED,
    label: 'Published',
    countKey: 'published',
    always: true,
    statuses: [CONTENT_STATUS.PUBLISHED],
  }),
  Object.freeze({
    value: PORTFOLIO_FILTER.IN_REVIEW,
    label: 'In review',
    countKey: 'inReview',
    always: true,
    statuses: PORTFOLIO_IN_REVIEW_STATUSES,
  }),
  Object.freeze({
    value: PORTFOLIO_FILTER.NEEDS_CHANGES,
    label: 'Needs changes',
    countKey: 'needsChanges',
    statuses: [CONTENT_STATUS.REVISION_REQUIRED],
  }),
  Object.freeze({
    value: PORTFOLIO_FILTER.REJECTED,
    label: 'Rejected',
    countKey: 'rejected',
    statuses: [CONTENT_STATUS.REJECTED],
  }),
  Object.freeze({
    value: PORTFOLIO_FILTER.DRAFTS,
    label: 'Drafts',
    countKey: 'drafts',
    always: true,
    statuses: [CONTENT_STATUS.DRAFT],
  }),
  Object.freeze({
    value: PORTFOLIO_FILTER.RESTRICTED,
    label: 'Restricted',
    countKey: 'restricted',
    statuses: [CONTENT_STATUS.RESTRICTED],
  }),
  Object.freeze({
    value: PORTFOLIO_FILTER.ARCHIVED,
    label: 'Archived',
    countKey: 'archived',
    statuses: [CONTENT_STATUS.ARCHIVED],
  }),
])

const FILTER_BY_VALUE = Object.freeze(
  Object.fromEntries(PORTFOLIO_FILTERS.map((filter) => [filter.value, filter]))
)

/** Counts for the chip row — re-exported so pages import one module, not two. */
export { summarizePortfolioStatuses }

/**
 * Does this item belong in the bucket currently selected?
 *
 * @param {object} item a `portfolioItems` record
 * @param {string} filter a `PORTFOLIO_FILTER` token
 * @returns {boolean}
 */
export function matchesPortfolioFilter(item, filter) {
  const statuses = FILTER_BY_VALUE[filter]?.statuses
  return statuses ? statuses.includes(item?.status) : true
}

/**
 * The chips to render, given the counts. Zero-count buckets drop out unless
 * they are marked `always`, and the currently selected bucket always stays —
 * a chip that vanished as soon as its last item moved would leave the grid
 * filtered by something the creator can no longer see or clear.
 *
 * @param {object} counts from `summarizePortfolioStatuses`
 * @param {string} [selected] the active filter token
 * @returns {{value: string, label: string, count: number}[]}
 */
export function buildFilterOptions(counts = {}, selected) {
  return PORTFOLIO_FILTERS.filter(
    (filter) => filter.always || counts[filter.countKey] > 0 || filter.value === selected
  ).map((filter) => ({
    value: filter.value,
    label: filter.label,
    count: counts[filter.countKey] ?? 0,
  }))
}

/**
 * What an empty grid should say. The first-run case (nothing at all, whatever
 * the filter) asks for the first sample; every other case explains what this
 * particular bucket means and leaves the work alone.
 *
 * @param {string} filter the active `PORTFOLIO_FILTER` token
 * @param {boolean} isFresh true when the creator has no items at all
 * @returns {{icon: string, title: string, description: string}}
 */
export function emptyStateCopy(filter, isFresh) {
  if (isFresh) {
    return {
      icon: 'tabler:camera-plus',
      title: 'Show buyers what you create — add your first sample',
      description:
        'Sample work is the first thing a buyer looks at. Add a photo or a film, tell them what it was for, and send it for review.',
    }
  }

  switch (filter) {
    case PORTFOLIO_FILTER.PUBLISHED:
      return {
        icon: 'solar:gallery-linear',
        title: 'Nothing is live yet',
        description:
          'Approved work appears here and on your public profile. Send a draft for review to get the first one published.',
      }
    case PORTFOLIO_FILTER.IN_REVIEW:
      return {
        icon: 'solar:shield-check-linear',
        title: 'Nothing is with Trust & Safety',
        description: 'Items you send for review sit here until a reviewer decides.',
      }
    case PORTFOLIO_FILTER.NEEDS_CHANGES:
      return {
        icon: 'solar:pen-new-square-linear',
        title: 'Nothing needs changes',
        description:
          'When a reviewer asks for changes, the item lands here with what to fix.',
      }
    case PORTFOLIO_FILTER.REJECTED:
      return {
        icon: 'solar:shield-cross-linear',
        title: 'Nothing has been rejected',
        description: 'Rejected work appears here with the reason and the way forward.',
      }
    case PORTFOLIO_FILTER.DRAFTS:
      return {
        icon: 'solar:document-add-linear',
        title: 'No drafts',
        description:
          'Drafts are private. Start one whenever you like and send it for review when it is ready.',
      }
    case PORTFOLIO_FILTER.RESTRICTED:
      return {
        icon: 'solar:eye-closed-linear',
        title: 'Nothing is restricted',
        description:
          'Work hidden after a Content Policy decision appears here. Support can explain any decision.',
      }
    case PORTFOLIO_FILTER.ARCHIVED:
      return {
        icon: 'solar:archive-linear',
        title: 'Nothing archived',
        description: 'Work you retire is kept here, out of your public profile.',
      }
    default:
      return {
        icon: 'tabler:camera-plus',
        title: 'No sample work yet',
        description: 'Add a photo or a film and send it for review.',
      }
  }
}
