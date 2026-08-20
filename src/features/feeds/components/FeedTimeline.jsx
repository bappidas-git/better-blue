import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { visuallyHidden } from '@mui/utils'

import EmptyState from '@/components/feedback/EmptyState'
import ErrorState from '@/components/feedback/ErrorState'
import FadeInView from '@/components/motion/FadeInView'
import { paths } from '@/routes/paths'
import { formatNumber } from '@/utils/formatters'

import FeedCard, { FEED_CARD_MAX_WIDTH, FeedCardSkeleton } from './FeedCard'

// The timeline itself (V2-07 §1, §3, §5): one column of the canonical
// `FeedCard`, a sentinel under it, and the four things that can be true at the
// bottom of an infinite list — another page loading, a page that failed, the
// end of the list, or nothing at all.
//
// The card is consumed exactly as V2-03 built it. This component owns *which*
// feeds are shown and *what the bottom of the column says*; it never reaches
// into how a feed is drawn.

/** Placeholders for the first page — a screen and a half of column (§5). */
const INITIAL_SKELETONS = 4

/** Placeholders for every page after it (§3). */
const PAGE_SKELETONS = 2

/**
 * Reveal stagger, and the card it stops applying to.
 *
 * The delay is capped for the same reason the home strip caps it (V2-05): past
 * the opening group, cards arrive one at a time as the visitor scrolls and are
 * already staggered by the scrolling itself. Uncapped, the tenth card of the
 * seventh page would wait two-thirds of a second after entering the viewport.
 */
const STAGGER_STEP = 0.06
const STAGGER_CAP = 3

/** A column of placeholders, used for both the first page and every later one. */
function SkeletonRun({ count }) {
  return Array.from({ length: count }, (_, index) => (
    <FeedCardSkeleton key={`skeleton-${index}`} />
  ))
}

/**
 * @param {object} props
 * @param {ReturnType<import('@/hooks/useInfiniteList').useInfiniteList>} props.list
 *   the accumulating list driving the column
 * @param {(feed: object) => void} props.onReply the Reply button, for whoever
 *   is reading — the page decides what it means, not the card
 * @param {boolean} props.isFiltered anything is off its default, so the empty
 *   state can offer a way back
 * @param {() => void} props.onClear reset every filter
 */
export default function FeedTimeline({ list, onReply, isFiltered, onClear }) {
  const { items, total, error, isLoading, isLoadingMore, isEmpty, hasMore, isComplete } = list

  // A failure with nothing on screen is the whole page's failure; a failure
  // with feeds above it is one row at the bottom of a list that still works
  // (§3 — "keeps loaded items").
  if (error && items.length === 0) {
    return (
      <ErrorState
        title="We could not load the feeds"
        message="The timeline is temporarily unavailable. Your filters are kept in the address bar, so a retry picks up exactly where you were."
        error={error}
        onRetry={list.retry}
      />
    )
  }

  if (isEmpty) {
    return (
      <EmptyState
        icon="tabler:layout-list"
        title="No feeds match — try a different filter"
        description="Nothing on the board fits this combination right now. Clearing the filters brings the whole timeline back."
        primaryAction={isFiltered ? { label: 'Clear filters', onClick: onClear } : undefined}
        secondaryAction={{ label: 'Browse creators instead', to: paths.CREATORS }}
      />
    )
  }

  return (
    <Stack
      spacing={2.5}
      alignItems="center"
      sx={{ mx: 'auto', maxWidth: FEED_CARD_MAX_WIDTH }}
    >
      {/* Names the results region in the outline, so the page reads h1 → h2 →
          the card's own h3 rather than skipping a level (00 §13). The count
          line in the filter bar already says this to anyone who can see it. */}
      <Typography component="h2" sx={visuallyHidden}>
        Feeds
      </Typography>

      {isLoading && items.length === 0 ? <SkeletonRun count={INITIAL_SKELETONS} /> : null}

      {items.map((feed, index) => (
        <FadeInView
          key={feed.id}
          delay={Math.min(index, STAGGER_CAP) * STAGGER_STEP}
          sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}
        >
          <FeedCard feed={feed} onReply={onReply} />
        </FadeInView>
      ))}

      {isLoadingMore ? <SkeletonRun count={PAGE_SKELETONS} /> : null}

      {error && items.length > 0 ? (
        <ErrorState
          dense
          title="We could not load more feeds"
          message="The feeds already here are unaffected — try again to pick up where the timeline stopped."
          error={error}
          onRetry={list.retry}
          retryLabel="Retry"
        />
      ) : null}

      {hasMore && !error ? (
        <>
          {/* What the observer watches. Sized rather than empty so a zero-height
              element in a flex column cannot be skipped over. */}
          <Box ref={list.sentinelRef} aria-hidden="true" sx={{ width: '100%', height: 4 }} />

          {/* The keyboard route to the next page, and the fallback wherever
              IntersectionObserver is missing. Scrolling normally reaches the
              sentinel first, so this is rarely the thing that fires. */}
          {isLoadingMore ? null : (
            <Button variant="outlined" onClick={list.loadMore}>
              Load more feeds
            </Button>
          )}
        </>
      ) : null}

      {isComplete ? (
        <Stack spacing={0.5} alignItems="center" sx={{ py: { xs: 3, md: 4 } }}>
          <Box
            aria-hidden="true"
            sx={{
              width: 44,
              height: 44,
              mb: 0.5,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'primary.surface',
              color: 'primary.light',
            }}
          >
            <Icon icon="tabler:check" width={22} />
          </Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            You’re all caught up
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            That is every feed matching this filter — {formatNumber(total)}{' '}
            {total === 1 ? 'feed' : 'feeds'} in all.
          </Typography>
        </Stack>
      ) : null}
    </Stack>
  )
}
