// Feed deal status — Storefront V2 (`prompts-v2/03-…`).
//
// The storefront talks about a feed in three states — **open**, **closed**,
// **delivered** — while the record underneath is still a `contentRequests` row
// carrying one of six `REQUEST_STATUS` values (`docs/data-model.md`). This
// module is the one place that mapping lives, so the feed board, the feed
// detail page, and the filter chips can never disagree about what "closed"
// means.
//
// Nothing here renames or replaces `REQUEST_STATUS`: the dashboard, the admin
// console, and the state machine keep reading the stored value. This is a
// **presentation-layer projection** of it, exactly like the `/requests` →
// `/feeds` rename in V2-02.
//
// Framework-free (plain `.js` imports only) so the seed script can use it too.

import { REQUEST_STATUS } from './statuses.js'

/** The three states a feed is shown in. */
export const FEED_DEAL_STATUS = Object.freeze({
  OPEN: 'open',
  CLOSED: 'closed',
  DELIVERED: 'delivered',
})

/**
 * `REQUEST_STATUS` → `FEED_DEAL_STATUS`.
 *
 * `awarded`, `closed`, and `cancelled` all collapse into **closed**: from the
 * outside they are the same fact — the buyer is no longer taking replies, and
 * why is between them and the creator they picked. `draft` has no entry because
 * a draft is private and never reaches a feed surface at all.
 */
const DEAL_STATUS_BY_REQUEST_STATUS = Object.freeze({
  [REQUEST_STATUS.OPEN]: FEED_DEAL_STATUS.OPEN,
  [REQUEST_STATUS.AWARDED]: FEED_DEAL_STATUS.CLOSED,
  [REQUEST_STATUS.CLOSED]: FEED_DEAL_STATUS.CLOSED,
  [REQUEST_STATUS.CANCELLED]: FEED_DEAL_STATUS.CLOSED,
  [REQUEST_STATUS.COMPLETED]: FEED_DEAL_STATUS.DELIVERED,
})

/**
 * The `REQUEST_STATUS` values behind each deal status — the inverse of the map
 * above, and what a service needs to turn a `dealStatus` filter into a query
 * (`feedService.listFeeds`). Exported so that mapping stays derived rather than
 * written out twice.
 */
export const REQUEST_STATUSES_BY_DEAL_STATUS = Object.freeze(
  Object.values(FEED_DEAL_STATUS).reduce(
    (map, dealStatus) => ({
      ...map,
      [dealStatus]: Object.freeze(
        Object.entries(DEAL_STATUS_BY_REQUEST_STATUS)
          .filter(([, value]) => value === dealStatus)
          .map(([requestStatus]) => requestStatus)
      ),
    }),
    {}
  )
)

/**
 * `{ label, tone, glow, description }` per deal status. `tone` is a
 * `STATUS_TONES` value, so `FeedDealChip` tints itself the same way every other
 * status chip does; `glow` marks the one state worth a halo — an open feed is
 * the only one a creator can act on (`docs/theme-v2.md` §5).
 */
export const FEED_DEAL_META = Object.freeze({
  [FEED_DEAL_STATUS.OPEN]: Object.freeze({
    label: 'Open',
    tone: 'success',
    glow: true,
    description: 'Taking replies — the buyer has not picked a creator yet.',
  }),
  [FEED_DEAL_STATUS.CLOSED]: Object.freeze({
    label: 'Closed',
    tone: 'neutral',
    glow: false,
    description: 'No longer taking replies.',
  }),
  [FEED_DEAL_STATUS.DELIVERED]: Object.freeze({
    label: 'Delivered',
    tone: 'info',
    glow: false,
    description: 'The work was delivered and the engagement is finished.',
  }),
})

/**
 * How a feed is shown, from the request record behind it.
 *
 * @param {object|string} request a `contentRequests` record, or its `status`
 * @returns {'open'|'closed'|'delivered'} `closed` for anything unrecognised —
 *   the safe reading, because it is the state that offers no action
 *
 * @example
 * getFeedDealStatus({ status: 'awarded' })   // → 'closed'
 * getFeedDealStatus('completed')             // → 'delivered'
 */
export function getFeedDealStatus(request) {
  const status = typeof request === 'string' ? request : request?.status
  return DEAL_STATUS_BY_REQUEST_STATUS[status] ?? FEED_DEAL_STATUS.CLOSED
}

/**
 * Metadata for a deal status, tolerant of an unknown value.
 *
 * @param {string} dealStatus a `FEED_DEAL_STATUS` value
 * @returns {{label: string, tone: string, glow: boolean, description: string}}
 */
export function getFeedDealMeta(dealStatus) {
  return FEED_DEAL_META[dealStatus] ?? FEED_DEAL_META[FEED_DEAL_STATUS.CLOSED]
}

export default FEED_DEAL_STATUS
