import { useCallback, useMemo, useState } from 'react'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Container from '@mui/material/Container'
import { Navigate, NavigationType, useNavigate, useNavigationType } from 'react-router-dom'

import AppLoader from '@/app/AppLoader'
import RoleGateDialog from '@/components/feedback/RoleGateDialog'
import PageHeader from '@/components/layout/PageHeader'
import { ROLES } from '@/constants/roles'
import { useAuth } from '@/context/AuthContext'
import BoardUnavailable from '@/features/requests/components/BoardUnavailable'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import useFeatureFlag from '@/hooks/useFeatureFlag'
import useInfiniteList from '@/hooks/useInfiniteList'
import useListParams from '@/hooks/useListParams'
import { paths } from '@/routes/paths'
import { feedService } from '@/services'
import { formatNumber } from '@/utils/formatters'

import BackToTopButton from '../components/BackToTopButton'
import FeedFilterBar from '../components/FeedFilterBar'
import FeedFilterSheet from '../components/FeedFilterSheet'
import FeedTimeline from '../components/FeedTimeline'
import {
  FEEDS_CONTENT_MAX_WIDTH,
  FEEDS_PAGE_SIZE,
  feedsSchema,
  toFeedListParams,
} from '../utils/feedFilters'

// **Feeds** — every brief on BetterBlue as a social timeline (V2-07).
//
// V2-02 renamed this screen (`RequestBoardPage` at `/requests` → `FeedsPage` at
// `/feeds`, old URLs redirecting); V2-07 rebuilt what it renders. The
// grid-plus-filter-rail board is gone: one centred column of `FeedCard`s that
// keeps loading as you scroll, four chips, a price sort, and a switch. The
// dashboard board it used to share (`RequestBoard`) is untouched and still
// serves `/creator/browse`, which is a working surface with categories,
// budgets, deadlines, and proposal state — a different job from this one.
//
// The page owns three decisions and delegates everything else: which feeds to
// ask for (`toFeedListParams`), what "Reply" means for whoever is reading
// (below), and what the timeline says while it has nothing yet (`FeedTimeline`).
//
// Behind `features.publicRequestBoard` (contract §6.27), unchanged from V2-02:
// with the flag off a visitor is told feeds are not public today, and a
// *creator* — who has their own board inside the dashboard, which the flag does
// not touch — is sent straight there rather than shown a wall.

/** Anchor the back-to-top button returns focus to. */
const TOP_ANCHOR_ID = 'feeds-top'

/**
 * The restore cache's key (see `useInfiniteList`). One timeline, one key: the
 * accumulated pages survive a trip to a feed and back, and nothing else in the
 * app shares the slot.
 */
const RESTORE_KEY = 'feeds-timeline'

export default function FeedsPage() {
  useDocumentTitle('Feeds')

  const { user } = useAuth()
  const navigate = useNavigate()
  const navigationType = useNavigationType()
  const { isEnabled, isLoading: isFlagLoading } = useFeatureFlag('publicRequestBoard')

  const [isSheetOpen, setSheetOpen] = useState(false)
  const [isGateOpen, setGateOpen] = useState(false)

  const { values, setValues, clearFilters, isFiltered } = useListParams(feedsSchema)

  const listParams = useMemo(
    () => toFeedListParams(values, { limit: FEEDS_PAGE_SIZE }),
    [values]
  )

  // Every hook runs on every render, including the ones the feature flag will
  // turn out to hide: `enabled` holds the requests instead of an early return,
  // which is what keeps the hook order stable (00 §16).
  const list = useInfiniteList(feedService.listFeeds, {
    params: listParams,
    limit: FEEDS_PAGE_SIZE,
    enabled: isEnabled,
    cacheKey: RESTORE_KEY,
    // Only a *back* navigation restores. A fresh load has an empty cache
    // anyway, and arriving from a link should start at the top of a fresh
    // timeline rather than in the middle of the last one.
    restore: navigationType === NavigationType.Pop,
  })

  const isCreator = user?.role === ROLES.CREATOR

  /**
   * Reply, for whoever is reading. A signed-in creator goes to the feed, where
   * the composer lives (V2-08) — `state.intent` is what tells that page to open
   * on the composer rather than at the top of the brief. Everybody else —
   * guest, buyer, admin — meets the role gate. The card renders the button
   * either way and asks us what it means, which is why the decision is here
   * rather than inside it.
   *
   * A creator who has *already* replied is deliberately not blocked: the
   * composer's page is also where their thread is, so sending them there is the
   * right answer either way. `feedService.createReply` is what refuses a second
   * one, and it does so on the screen that can show them the first.
   *
   * SECURITY: the gate is UX (00 §11). `createReply` refuses a reply from
   * anyone but a creator on its own, and the Laravel API must too.
   */
  const handleReply = useCallback(
    (feed) => {
      if (isCreator) {
        navigate(paths.feedDetail(feed.id), { state: { intent: 'reply' } })
        return
      }
      setGateOpen(true)
    },
    [isCreator, navigate]
  )

  const handleFilterChange = useCallback((patch) => setValues(patch), [setValues])
  const closeSheet = useCallback(() => setSheetOpen(false), [])
  const openSheet = useCallback(() => setSheetOpen(true), [])

  if (isFlagLoading) {
    return <AppLoader label="Loading feeds" />
  }

  if (!isEnabled) {
    return isCreator ? <Navigate to={paths.CREATOR_BROWSE} replace /> : <BoardUnavailable />
  }

  return (
    <Box sx={{ position: 'relative' }}>
      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 5 } }}>
        {/* No AmbientGlow behind this header, though the pattern would fit the
            band: the intro paragraph runs the width of it, and a glow behind
            body copy is the one thing §5 of docs/theme-v2.md rules out. The
            brand carries the page from the gradient offers and the open-deal
            halos in the column instead. */}
        <PageHeader
          id={TOP_ANCHOR_ID}
          tabIndex={-1}
          // Same axis as the filter bar and the column below it.
          sx={{ maxWidth: FEEDS_CONTENT_MAX_WIDTH, mx: 'auto', outline: 'none', mb: { xs: 2, md: 3 } }}
          title="Feeds"
          subtitle="Every brief a business has posted on BetterBlue — the offer, what they need shot, and how many creators have answered. Filter the timeline or just keep scrolling; it loads as you go."
          meta={
            <Chip
              // The header's copy of the count. The filter bar's line is the
              // live region, so this one is silent and the number is announced
              // once rather than twice.
              label={
                list.isLoading && list.total === 0
                  ? 'Loading…'
                  : `${formatNumber(list.total)} ${list.total === 1 ? 'feed' : 'feeds'}`
              }
              size="small"
              color="primary"
              variant="outlined"
            />
          }
        />

        <FeedFilterBar
          values={values}
          onChange={handleFilterChange}
          onClear={clearFilters}
          isFiltered={isFiltered}
          total={list.total}
          isLoading={list.isLoading}
          onOpenSheet={openSheet}
        />

        <FeedTimeline
          list={list}
          onReply={handleReply}
          isFiltered={isFiltered}
          onClear={clearFilters}
        />
      </Container>

      <FeedFilterSheet
        open={isSheetOpen}
        onClose={closeSheet}
        values={values}
        onChange={handleFilterChange}
        onClear={clearFilters}
        isFiltered={isFiltered}
        total={list.total}
        isLoading={list.isLoading}
      />

      <BackToTopButton targetId={TOP_ANCHOR_ID} />

      <RoleGateDialog
        open={isGateOpen}
        onClose={() => setGateOpen(false)}
        requiredRole={ROLES.CREATOR}
        action="reply to this feed"
      />
    </Box>
  )
}
