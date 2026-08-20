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

import CreatorSocialCard, {
  CREATOR_CARD_MAX_WIDTH,
  CreatorSocialCardSkeleton,
} from './CreatorSocialCard'

// The column itself (V2-09 §1, §6): one `CreatorSocialCard` per row, a sentinel
// under it, and the four things that can be true at the bottom of an infinite
// list — another page loading, a page that failed, the end of the list, or
// nothing at all.
//
// The mirror of `features/feeds/components/FeedTimeline.jsx`, deliberately: two
// social surfaces that behave differently at the bottom of a scroll would be
// two surfaces, not one system. This component owns *which* creators are shown
// and *what the bottom of the column says*; it never reaches into how a
// storefront is drawn.

/** Placeholders for the first page — three cards, as §6 asks. */
const INITIAL_SKELETONS = 3

/** Placeholders for every page after it. */
const PAGE_SKELETONS = 2

/**
 * Reveal stagger, and the card it stops applying to.
 *
 * The delay is capped for the same reason the feed column caps it: past the
 * opening group, cards arrive one at a time as the visitor scrolls and are
 * already staggered by the scrolling itself.
 */
const STAGGER_STEP = 0.06
const STAGGER_CAP = 3

/** A column of placeholders, used for both the first page and every later one. */
function SkeletonRun({ count }) {
  return Array.from({ length: count }, (_, index) => (
    <CreatorSocialCardSkeleton key={`skeleton-${index}`} />
  ))
}

/**
 * @param {object} props
 * @param {ReturnType<import('@/hooks/useInfiniteList').useInfiniteList>} props.list
 *   the accumulating list driving the column
 * @param {(creator: object) => void} props.onSendMessage what "Send message"
 *   means for whoever is reading — the page decides, not the card
 * @param {(creator: object) => void} props.onPromote likewise for "Promote"
 * @param {boolean} props.isFiltered anything is off its default, so the empty
 *   state can offer a way back
 * @param {() => void} props.onClear reset every filter
 */
export default function CreatorTimeline({
  list,
  onSendMessage,
  onPromote,
  isFiltered,
  onClear,
}) {
  const { items, total, error, isLoading, isLoadingMore, isEmpty, hasMore, isComplete } = list

  // A failure with nothing on screen is the whole page's failure; a failure
  // with creators above it is one row at the bottom of a list that still works.
  if (error && items.length === 0) {
    return (
      <ErrorState
        title="We could not load the creators"
        message="The marketplace is temporarily unavailable. Your filters are kept in the address bar, so a retry picks up exactly where you were."
        error={error}
        onRetry={list.retry}
      />
    )
  }

  if (isEmpty) {
    return (
      <EmptyState
        icon="tabler:users-search"
        title="No creators match — try a different filter"
        description="Nobody on the marketplace fits this combination right now. Clearing the filters brings every open storefront back."
        primaryAction={isFiltered ? { label: 'Clear filters', onClick: onClear } : undefined}
        secondaryAction={{ label: 'Browse the feeds instead', to: paths.FEEDS }}
      />
    )
  }

  return (
    <Stack spacing={2.5} alignItems="center" sx={{ mx: 'auto', maxWidth: CREATOR_CARD_MAX_WIDTH }}>
      {/* Names the results region in the outline, so the page reads h1 → h2 →
          the card's own h3 rather than skipping a level (00 §13). The count
          line in the filter bar already says this to anyone who can see it. */}
      <Typography component="h2" sx={visuallyHidden}>
        Creators
      </Typography>

      {isLoading && items.length === 0 ? <SkeletonRun count={INITIAL_SKELETONS} /> : null}

      {items.map((creator, index) => (
        <FadeInView
          key={creator.id}
          delay={Math.min(index, STAGGER_CAP) * STAGGER_STEP}
          sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}
        >
          <CreatorSocialCard
            creator={creator}
            onSendMessage={onSendMessage}
            onPromote={onPromote}
          />
        </FadeInView>
      ))}

      {isLoadingMore ? <SkeletonRun count={PAGE_SKELETONS} /> : null}

      {error && items.length > 0 ? (
        <ErrorState
          dense
          title="We could not load more creators"
          message="The storefronts already here are unaffected — try again to pick up where the column stopped."
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
              Load more creators
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
            That’s everyone
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Every creator matching this filter — {formatNumber(total)}{' '}
            {total === 1 ? 'storefront' : 'storefronts'} in all.
          </Typography>
        </Stack>
      ) : null}
    </Stack>
  )
}
