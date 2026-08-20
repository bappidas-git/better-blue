import { useId } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Container from '@mui/material/Container'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'

import ErrorState from '@/components/feedback/ErrorState'
import { ROLES } from '@/constants/roles'
import { useAuth } from '@/context/AuthContext'
import NotFoundPage from '@/features/staticPages/pages/NotFoundPage'
import BoardUnavailable from '@/features/requests/components/BoardUnavailable'
import useApiQuery from '@/hooks/useApiQuery'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import useFeatureFlag from '@/hooks/useFeatureFlag'
import { paths } from '@/routes/paths'
import { API_ERROR_CODE } from '@/services/api/apiError'
import { feedService } from '@/services/feedService'

import FeedBuyerCard from '../components/FeedBuyerCard'
import FeedDetailCard, { FEED_DETAIL_MAX_WIDTH } from '../components/FeedDetailCard'
import FeedReplySection from '../components/FeedReplySection'
import FeedStatusBanner from '../components/FeedStatusBanner'

// **One feed, opened** — Storefront V2, `prompts-v2/08`.
//
// V2-02 renamed this screen (`RequestBoardDetailPage` at `/requests/:requestId`
// → `FeedDetailPage` at `/feeds/:feedId`, with the old URL redirecting) and
// V2-08 rebuilt it. What it used to be: the dashboard's brief renderer with a
// proposal sidebar beside it. What it is now: one centred reading column — the
// feed as a card that has grown rather than a document, the business behind it,
// and the reply area, which is the only part that changes with who is reading.
//
// The proposal path is **not** here any more, and that is deliberate rather
// than an omission. Proposals are the priced, formal offer that runs the
// award → order → escrow workflow, and they live where that workflow does: the
// creator's own board at `/creator/browse` (Prompt 23), which is untouched and
// still renders the full brief through `RequestBriefPanel`. The storefront's
// feed carries the informal thing instead — a private reply to the buyer. The
// two collections never read each other (`docs/data-model.md` → `feedReplies`).
//
// PRIVACY: this page fetches exactly one reply, the signed-in creator's own,
// and only when a creator is signed in. See `FeedReplySection` for the rule and
// the server-side obligation it does not discharge.

/** The page while its first read is still in flight. */
function FeedDetailSkeleton() {
  return (
    <Stack spacing={2.5} aria-hidden="true">
      <Card>
        <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Skeleton variant="rounded" width={48} height={48} />
            <Box sx={{ flexGrow: 1 }}>
              <Skeleton variant="text" width="38%" />
              <Skeleton variant="text" width="22%" height={14} />
            </Box>
            <Skeleton variant="rounded" width={82} height={28} />
          </Stack>
          <Skeleton variant="text" width="92%" height={40} sx={{ mt: 2.5 }} />
          <Skeleton variant="text" width="76%" height={40} />
          <Skeleton variant="text" width="100%" sx={{ mt: 2 }} />
          <Skeleton variant="text" width="97%" />
          <Skeleton variant="text" width="88%" />
          <Stack direction="row" spacing={0.75} sx={{ mt: 2.5 }}>
            <Skeleton variant="rounded" width={96} height={26} />
            <Skeleton variant="rounded" width={78} height={26} />
            <Skeleton variant="rounded" width={110} height={26} />
          </Stack>
          <Skeleton variant="rounded" height={92} sx={{ mt: 2.5 }} />
        </CardContent>
      </Card>
      <Card>
        <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
          <Skeleton variant="text" width="34%" height={22} />
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 2 }}>
            <Skeleton variant="rounded" width={40} height={40} />
            <Box sx={{ flexGrow: 1 }}>
              <Skeleton variant="text" width="46%" />
              <Skeleton variant="text" width="30%" height={14} />
            </Box>
          </Stack>
          <Skeleton variant="text" width="100%" sx={{ mt: 2 }} />
          <Skeleton variant="text" width="100%" />
        </CardContent>
      </Card>
    </Stack>
  )
}

export default function FeedDetailPage() {
  // A feed *is* a content request, so `:feedId` carries the `req_…` id every
  // service behind this screen already expects (V2-02).
  const { feedId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isEnabled, isLoading: isFlagLoading } = useFeatureFlag('publicRequestBoard')
  const headingId = useId()
  const replyHeadingId = useId()

  const { data, isLoading, error, refetch } = useApiQuery(() => feedService.getFeed(feedId), [
    feedId,
  ])

  const feed = data?.feed ?? null
  const buyer = data?.buyer ?? null
  const buyerName = buyer?.companyName ?? buyer?.name ?? 'this business'

  useDocumentTitle(feed?.title ?? 'Feed')

  // The buyer card's third line. Its own request, so a slow count never holds
  // up the feed — the card renders with a placeholder in the meantime.
  const { data: feedsPosted } = useApiQuery(
    () => feedService.countFeedsByBuyer(buyer?.userId),
    [buyer?.userId],
    { enabled: Boolean(buyer?.userId) }
  )

  /**
   * Back to the timeline.
   *
   * A real link to `/feeds`, so it has an href, opens in a new tab, and works
   * when this page was opened cold. When there *is* somewhere to go back to,
   * the click pops history instead — which is the only way the timeline comes
   * back as the reader left it: the filters live in the query string and
   * `useInfiniteList` restores the accumulated pages on a POP navigation
   * (V2-07 §3). Re-navigating to `/feeds` would drop both.
   */
  const canGoBack = Number(window.history.state?.idx) > 0
  const handleBack = (event) => {
    if (!canGoBack) return
    event.preventDefault()
    navigate(-1)
  }

  /* -- flag, failure, and the first paint --------------------------------- */

  // The flag hides the *public* board. A creator, who has their own board
  // inside the dashboard, keeps reaching feeds either way (V2-02, V2-07).
  if (!isFlagLoading && !isEnabled && user?.role !== ROLES.CREATOR) {
    return <BoardUnavailable />
  }

  // A feed that does not exist — or a draft, which `getFeed` refuses as
  // `not_found` precisely so a visitor cannot learn that a private brief is
  // there — is a wrong URL, and the router's own 404 is the honest answer.
  if (error?.code === API_ERROR_CODE.NOT_FOUND) {
    return <NotFoundPage />
  }

  return (
    <Container
      maxWidth={false}
      sx={{
        maxWidth: FEED_DETAIL_MAX_WIDTH,
        mx: 'auto',
        px: { xs: 2, sm: 3 },
        py: { xs: 3, md: 5 },
      }}
    >
      <Button
        component={RouterLink}
        to={paths.FEEDS}
        onClick={handleBack}
        variant="text"
        // The top nav has a "Feeds" link too; naming this one keeps the two
        // apart in a screen reader's list of links.
        aria-label="Back to feeds"
        startIcon={<Icon icon="tabler:arrow-left" width={18} aria-hidden="true" />}
        sx={{ ml: -1, mb: { xs: 2, md: 2.5 }, minHeight: 44 }}
      >
        Feeds
      </Button>

      {error ? (
        <ErrorState
          title="We could not open this feed"
          message="It may have been withdrawn, or the link may be wrong. The rest of the feeds are unaffected."
          error={error}
          onRetry={refetch}
        />
      ) : isLoading || !feed ? (
        <FeedDetailSkeleton />
      ) : (
        <Stack spacing={{ xs: 2, md: 2.5 }}>
          <FeedStatusBanner dealStatus={feed.dealStatus} />

          <FeedDetailCard feed={feed} buyer={buyer} headingId={headingId} />

          <FeedBuyerCard buyer={buyer} feedsPosted={feedsPosted ?? null} />

          <FeedReplySection
            feed={feed}
            buyerName={buyerName}
            headingId={replyHeadingId}
            // The public count lives on the feed record, so the number under a
            // gate card and the thread a creator just opened cannot drift.
            onRepliesChanged={refetch}
          />
        </Stack>
      )}
    </Container>
  )
}
