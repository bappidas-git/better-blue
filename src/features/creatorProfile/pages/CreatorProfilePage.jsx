import { useMemo, useState } from 'react'

import { Icon } from '@iconify/react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import { Link as RouterLink, useLocation, useNavigate, useParams } from 'react-router-dom'

import EmptyState from '@/components/feedback/EmptyState'
import ErrorState from '@/components/feedback/ErrorState'
import ProfileSkeleton from '@/components/feedback/skeletons/ProfileSkeleton'
import Section from '@/components/layout/Section'
import StickyActionBar from '@/components/layout/StickyActionBar'
import FadeInView from '@/components/motion/FadeInView'
import { ACCOUNT_STATUS } from '@/constants/statuses'
import useApiQuery from '@/hooks/useApiQuery'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import NotFoundPage from '@/features/staticPages/pages/NotFoundPage'
import { paths } from '@/routes/paths'
import {
  API_ERROR_CODE,
  categoryService,
  creatorProfileService,
  portfolioService,
  reviewService,
} from '@/services'

import AboutSection from '../components/AboutSection'
import PortfolioGallery from '../components/PortfolioGallery'
import ProfileHeader, { ProfileActions } from '../components/ProfileHeader'
import ReviewList from '../components/ReviewList'
import ReviewsSummary from '../components/ReviewsSummary'
import UnavailableProfile from '../components/UnavailableProfile'
import { useCreatorRequestCta } from '../hooks/useCreatorRequestCta'

// The public storefront — the page where a buyer decides.
//
// Four requests, deliberately independent, so no section can hold another one
// hostage: the profile (which everything else is gated on), the taxonomy that
// names the category chips, the published portfolio, and the reviews. A failure
// in any of the last three costs its own section and nothing else (§13).
//
// Reviews key on `profile.userId`, not on the `cpr_…` in the URL: a review
// belongs to the *account* (contract §6.18), while portfolio items belong to the
// storefront (§6.5). That asymmetry is the reason those two queries start at
// different moments.

/**
 * Published items pulled in one go. Far past any seeded portfolio, and the
 * gallery filters client-side from here — a creator with more work than this
 * gets the newest of it, which is what the section is for.
 */
const PORTFOLIO_LIMIT = 48

/** Reviews per "Load more" press. */
const REVIEWS_PAGE_SIZE = 5

/** Account states that keep a storefront off the public web (00 §9). */
const isPublic = (profileStatus) => profileStatus === ACCOUNT_STATUS.ACTIVE

function ProfilePageSkeleton() {
  return (
    <Box aria-busy="true">
      <Skeleton variant="rounded" sx={{ height: { xs: 96, sm: 128, md: 160 }, borderRadius: 3 }} />
      <ProfileSkeleton sx={{ mt: 2 }} bioLines={4} />
      <Box
        sx={{
          mt: 6,
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            sm: 'repeat(3, minmax(0, 1fr))',
            lg: 'repeat(4, minmax(0, 1fr))',
          },
          gap: { xs: 1, md: 1.5 },
        }}
      >
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton
            key={index}
            variant="rounded"
            sx={{ width: '100%', height: 'auto', aspectRatio: '4 / 3', borderRadius: 2 }}
          />
        ))}
      </Box>
    </Box>
  )
}

export default function CreatorProfilePage() {
  const { creatorId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const [visibleReviews, setVisibleReviews] = useState(REVIEWS_PAGE_SIZE)

  const {
    data: profile,
    isLoading,
    error,
    refetch,
  } = useApiQuery(() => creatorProfileService.getPublicProfile(creatorId), [creatorId])

  useDocumentTitle(profile?.displayName ?? 'Creator profile')

  const { data: categories } = useApiQuery(() => categoryService.listActive(), [])

  const categoryNames = useMemo(
    () => Object.fromEntries((categories ?? []).map((category) => [category.id, category.name])),
    [categories]
  )

  // The portfolio belongs to the storefront, so it can start from the URL alone
  // — in parallel with the profile request rather than behind it.
  const {
    data: portfolio,
    isLoading: isPortfolioLoading,
    error: portfolioError,
    refetch: refetchPortfolio,
  } = useApiQuery(
    () => portfolioService.listPublished(creatorId, { page: 1, limit: PORTFOLIO_LIMIT }),
    [creatorId]
  )

  const creatorUserId = profile?.userId

  const {
    data: reviewPage,
    isLoading: isReviewsLoading,
    error: reviewsError,
    refetch: refetchReviews,
  } = useApiQuery(
    () =>
      reviewService.listByCreatorWithBuyers(creatorUserId, {
        page: 1,
        limit: visibleReviews,
      }),
    [creatorUserId, visibleReviews],
    { enabled: Boolean(creatorUserId) }
  )

  const {
    data: breakdown,
    error: breakdownError,
    refetch: refetchBreakdown,
  } = useApiQuery(() => reviewService.getBreakdown(creatorUserId), [creatorUserId], {
    enabled: Boolean(creatorUserId),
  })

  const cta = useCreatorRequestCta(profile)

  const goBack = () => navigate(-1)

  // Discovery keeps its whole state in the query string, so the way back to the
  // exact result set is the history entry itself — a link to `/creators` would
  // drop every filter. When the visit did not start there (a shared link, a
  // landing-page card), the link is the only honest option.
  const cameFromDiscovery = Boolean(location.state?.fromDiscovery)

  const backButton = (
    <Button
      size="small"
      color="inherit"
      startIcon={<Icon icon="tabler:arrow-left" width={18} />}
      sx={{ mb: 2, ml: -1, color: 'text.secondary' }}
      {...(cameFromDiscovery
        ? { onClick: goBack }
        : { component: RouterLink, to: paths.CREATORS })}
    >
      {cameFromDiscovery ? 'Back to results' : 'All creators'}
    </Button>
  )

  const containerSx = {
    px: { xs: 2, md: 4 },
    py: { xs: 3, md: 5 },
    pb: { xs: 4, md: 8 },
  }

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={containerSx}>
        <ProfilePageSkeleton />
      </Container>
    )
  }

  if (error?.code === API_ERROR_CODE.NOT_FOUND) return <NotFoundPage />

  if (error) {
    return (
      <Container maxWidth="lg" sx={containerSx}>
        {backButton}
        <ErrorState
          title="We could not load this profile"
          message="The creator directory is temporarily unavailable. Nothing is wrong with the link."
          error={error}
          onRetry={refetch}
        />
      </Container>
    )
  }

  if (!isPublic(profile.profileStatus)) {
    return <UnavailableProfile displayName={profile.displayName} />
  }

  const reviews = reviewPage?.items ?? []
  const reviewTotal = reviewPage?.total ?? 0
  const isLoadingMoreReviews = isReviewsLoading && visibleReviews > REVIEWS_PAGE_SIZE

  const retryReviews = () => {
    refetchReviews()
    refetchBreakdown()
  }

  const renderReviews = () => {
    if (reviewsError || breakdownError) {
      return (
        <ErrorState
          dense
          title="We could not load the reviews"
          message="The rest of the profile is fine — this section alone failed to load."
          error={reviewsError ?? breakdownError}
          onRetry={retryReviews}
        />
      )
    }

    if (!isReviewsLoading && reviewTotal === 0) {
      return (
        <EmptyState
          dense
          icon="tabler:message-star"
          title="No reviews yet"
          description={`${profile.displayName} has not been reviewed on BetterBlue yet. Reviews are left by buyers on completed orders, so every one of them is earned.`}
        />
      )
    }

    return (
      <Stack spacing={3}>
        {breakdown ? <ReviewsSummary breakdown={breakdown} /> : null}
        <ReviewList
          reviews={reviews}
          total={reviewTotal}
          isLoading={isReviewsLoading && reviews.length === 0}
          isLoadingMore={isLoadingMoreReviews}
          onLoadMore={() => setVisibleReviews((count) => count + REVIEWS_PAGE_SIZE)}
        />
      </Stack>
    )
  }

  return (
    <>
      <Container maxWidth="lg" sx={containerSx}>
        {backButton}

        {profile.availability === false ? (
          <Alert severity="info" icon={<Icon icon="tabler:clock-pause" width={20} />} sx={{ mb: 2 }}>
            Not accepting new requests right now. You can still browse the portfolio and come back
            later.
          </Alert>
        ) : null}

        <ProfileHeader profile={profile} categoryNames={categoryNames} cta={cta} />

        {/* Each `Section` owns its own bottom rhythm, but wrapping one in a
            reveal makes it an only child — so the rhythm is set here instead,
            at the same 48/64px (00 §6). */}
        <Stack spacing={{ xs: 6, md: 8 }} sx={{ mt: { xs: 5, md: 7 } }}>
          <FadeInView>
            <AboutSection profile={profile} />
          </FadeInView>

          <FadeInView>
            <PortfolioGallery
              items={portfolio?.items}
              categoryNames={categoryNames}
              creatorName={profile.displayName}
              isLoading={isPortfolioLoading}
              error={portfolioError}
              onRetry={refetchPortfolio}
            />
          </FadeInView>

          <FadeInView>
            <Section title="Reviews" spacing="md">
              {renderReviews()}
            </Section>
          </FadeInView>
        </Stack>
      </Container>

      {/* `sticky`, not `fixed`: the route sits inside `PageTransition`, whose
          transform makes it the containing block for anything fixed — a fixed
          bar would pin to the bottom of the *page* instead of the viewport.
          Sticky also means the bar parks after the content at the end of the
          scroll rather than covering it, so nothing is permanently hidden. */}
      <StickyActionBar mobileOnly>
        <ProfileActions cta={cta} fullWidth />
      </StickyActionBar>
    </>
  )
}
