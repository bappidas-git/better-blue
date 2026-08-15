import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

import ErrorState from '@/components/feedback/ErrorState'
import { useAuth } from '@/context/AuthContext'
import AvailabilityCard from '@/features/creatorAccount/components/AvailabilityCard'
import AvailabilitySwitch from '@/features/creatorAccount/components/AvailabilitySwitch'
import useCreatorAvailability from '@/features/creatorAccount/hooks/useCreatorAvailability'
import ActivityFeed from '@/features/dashboard/components/ActivityFeed'
import ChartCard from '@/features/dashboard/components/ChartCard'
import OnboardingChecklist from '@/features/dashboard/components/OnboardingChecklist'
import QuickActions from '@/features/dashboard/components/QuickActions'
import StatCardGrid from '@/features/dashboard/components/StatCardGrid'
import ThemedLineChart from '@/features/dashboard/components/ThemedLineChart'
import WelcomeBanner from '@/features/dashboard/components/WelcomeBanner'
import useApiQuery from '@/hooks/useApiQuery'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { paths } from '@/routes/paths'
import { creatorDashboardService } from '@/services/creatorDashboardService'
import { EMPTY_PLACEHOLDER, formatCurrency, formatNumber } from '@/utils/formatters'

// The creator's home screen: what work is available, what is in flight, what it
// has earned, and what happened lately — with a first-run variant for an
// account that has none of that yet.
//
// Every number on this page comes from `creatorDashboardService.getOverview`,
// which is also where the aggregation lives (Prompt 21 §7). The page decides
// what to *render* — including which of the four sections failed and needs its
// own retry — and computes nothing but display strings. It is the buyer
// overview's twin by design (Prompt 15): same section layout, same partial
// failure handling, same skeletons.
//
// The stat tiles become the entry points to Browse, Proposals, Orders, and
// Earnings as those screens arrive. A tile pointing at an unbuilt path would
// land on the dashboard 404, so each one stays inert until its prompt lands
// (Prompt 14's rule for `navConfig`, applied to page-level links):
//   TODO(Prompt 23): link "Matching open requests" → CREATOR_BROWSE.
//   TODO(Prompt 23): link "Active proposals"      → CREATOR_PROPOSALS.
//   TODO(Prompt 24): link "Active orders"         → CREATOR_ORDERS.
//   TODO(Prompt 25): link "Available to withdraw" → CREATOR_EARNINGS.

/** Chart height by breakpoint (§11). */
const CHART_HEIGHT = { xs: 240, md: 300 }

/** Published sample work a storefront needs before it competes properly (§3). */
const PORTFOLIO_TARGET = 3

/** Profile completeness the onboarding checklist treats as "done" (§3). */
const COMPLETENESS_TARGET = 80

/** Where the finished onboarding checklist remembers it was dismissed. */
const ONBOARDING_STORAGE_KEY = 'dashboard.creator.onboardingDismissed'

/** One sentence describing the earnings chart, for screen readers (§12). */
function earningsChartLabel(earningsByMonth, currency) {
  if (!earningsByMonth?.length) return 'Monthly earnings over the last six months.'

  const first = earningsByMonth[0]
  const last = earningsByMonth[earningsByMonth.length - 1]
  const peak = earningsByMonth.reduce((best, month) => (month.amount > best.amount ? month : best))
  const money = (amount) => formatCurrency(amount, currency, { hideDecimals: true })

  return (
    `Monthly earnings over the last six months, from ${money(first.amount)} in ${first.label} ` +
    `to ${money(last.amount)} in ${last.label}. ` +
    `Best month: ${peak.label} at ${money(peak.amount)}.`
  )
}

/** The banner's second line — the one thing most worth doing today. */
function welcomeSubline({ isFreshAccount, isAvailable, activeOrders, openMatchingRequests }) {
  if (isFreshAccount) {
    return 'Let us get your storefront ready for its first brief.'
  }
  if (!isAvailable) {
    return 'You are not accepting new requests, so buyers browsing the directory cannot find you.'
  }
  if (activeOrders > 0) {
    return `${formatNumber(activeOrders)} ${
      activeOrders === 1 ? 'order is' : 'orders are'
    } in flight. Keep the deliveries moving.`
  }
  if (openMatchingRequests > 0) {
    return `${formatNumber(openMatchingRequests)} open ${
      openMatchingRequests === 1 ? 'brief matches' : 'briefs match'
    } what you shoot.`
  }
  return 'Nothing is waiting on you. New briefs in your categories will show up here.'
}

/** A card that holds nothing but a failure and the way out of it. */
function SectionError({ error, onRetry, title, message }) {
  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <ErrorState dense title={title} message={message} error={error} onRetry={onRetry} />
      </CardContent>
    </Card>
  )
}

export default function CreatorOverviewPage() {
  const { user } = useAuth()

  const {
    data: overview,
    isLoading,
    error,
    refetch,
  } = useApiQuery(() => creatorDashboardService.getOverview(user?.id, { user }), [user?.id], {
    enabled: Boolean(user?.id),
  })

  const availability = useCreatorAvailability(overview?.profile, {
    activeOrders: overview?.activeOrders ?? 0,
    onChanged: refetch,
  })

  const errors = overview?.errors ?? {}
  const isFresh = Boolean(overview?.isFreshAccount)
  const currency = overview?.currency
  const completeness = overview?.profileCompleteness
  const portfolio = overview?.portfolioCounts

  const stats = [
    {
      key: 'matching',
      label: 'Matching open requests',
      value: overview?.openMatchingRequests ?? EMPTY_PLACEHOLDER,
      icon: 'solar:clipboard-list-linear',
      iconTone: overview?.openMatchingRequests > 0 ? 'brand' : 'info',
      // TODO(Prompt 23): `to: paths.CREATOR_BROWSE` once the request board renders.
    },
    {
      key: 'proposals',
      label: 'Active proposals',
      value: overview?.activeProposals ?? EMPTY_PLACEHOLDER,
      icon: 'solar:document-add-linear',
      // TODO(Prompt 23): `to: paths.CREATOR_PROPOSALS`.
    },
    {
      key: 'orders',
      label: 'Active orders',
      value: overview?.activeOrders ?? EMPTY_PLACEHOLDER,
      icon: 'solar:box-linear',
      iconTone: overview?.activeOrders > 0 ? 'warning' : 'brand',
      // TODO(Prompt 24): `to: paths.CREATOR_ORDERS`.
    },
    {
      key: 'available',
      label: 'Available to withdraw',
      value: overview?.earningsSummary?.available ?? EMPTY_PLACEHOLDER,
      format: (amount) => formatCurrency(amount, currency, { hideDecimals: true }),
      icon: 'solar:wallet-money-linear',
      iconTone: 'success',
      // TODO(Prompt 25): `to: paths.CREATOR_EARNINGS`.
    },
  ]

  const onboardingSteps = [
    {
      key: 'profile',
      title: 'Complete your profile',
      description:
        (completeness?.percent ?? 0) >= COMPLETENESS_TARGET
          ? 'Buyers can see what you shoot, what it costs, and where to pay you.'
          : `${completeness?.percent ?? 0}% complete — buyers skip a storefront that does not say what it does.`,
      done: (completeness?.percent ?? 0) >= COMPLETENESS_TARGET,
      action: { label: 'Edit profile', to: paths.CREATOR_PROFILE, icon: 'tabler:user-edit' },
    },
    {
      key: 'portfolio',
      title: `Add ${PORTFOLIO_TARGET} portfolio items`,
      description:
        (portfolio?.published ?? 0) >= PORTFOLIO_TARGET
          ? 'Your sample work is live on your storefront.'
          : `${portfolio?.published ?? 0} of ${PORTFOLIO_TARGET} published${
              portfolio?.inReview
                ? `, ${formatNumber(portfolio.inReview)} in review with Trust & Safety`
                : ''
            }. Sample work is the first thing a buyer looks at.`,
      done: (portfolio?.published ?? 0) >= PORTFOLIO_TARGET,
      // TODO(Prompt 22): `action: { label: 'Add work', to: paths.CREATOR_PORTFOLIO }`
      // once the portfolio manager renders.
    },
    {
      key: 'proposal',
      title: 'Submit your first proposal',
      description:
        'Find a brief that fits, price it, and say how you would shoot it. The order is created when the buyer accepts.',
      done: (overview?.proposalsTotal ?? 0) > 0,
      // TODO(Prompt 23): `action: { label: 'Browse requests', to: paths.CREATOR_BROWSE }`.
    },
  ]

  const quickActions = [
    {
      key: 'browse',
      label: 'Browse requests',
      description: 'Find briefs in your categories',
      icon: 'solar:magnifer-linear',
      // TODO(Prompt 23): `to: paths.CREATOR_BROWSE`.
      disabledReason: 'The request board arrives with the proposals screen',
    },
    {
      key: 'portfolio',
      label: 'Add portfolio item',
      description: 'Show buyers your sample work',
      icon: 'solar:gallery-add-linear',
      // TODO(Prompt 22): `to: paths.CREATOR_PORTFOLIO`.
      disabledReason: 'Portfolio management arrives in the next release',
    },
    {
      key: 'profile',
      label: 'Edit profile',
      description: 'Update what you offer',
      icon: 'solar:user-id-linear',
      to: paths.CREATOR_PROFILE,
    },
  ]

  // A total failure of the query itself (rather than of one section) is the
  // only case where there is nothing to draw at all — `getOverview` resolves
  // even when every section inside it fails.
  if (error) {
    return (
      <DashboardPage title="Overview">
        <ErrorState
          title="We could not load your dashboard"
          message="Check your connection and try again — nothing about your account has changed."
          error={error}
          onRetry={refetch}
        />
      </DashboardPage>
    )
  }

  return (
    <DashboardPage
      title="Overview"
      subtitle="Your briefs, proposals, orders, and earnings at a glance."
      actions={
        // The header sits directly under the top bar, which is where a switch
        // this consequential belongs on every screen width.
        isLoading || errors.profile ? null : (
          <AvailabilitySwitch
            isAvailable={availability.isAvailable}
            onChange={availability.setAvailable}
            disabled={!availability.canToggle}
          />
        )
      }
    >
      <Stack spacing={{ xs: 2, md: 3 }}>
        <WelcomeBanner
          name={user?.name}
          storageKey="dashboard.creator.welcomeDismissed"
          subline={
            isLoading
              ? 'Bringing your dashboard up to date…'
              : welcomeSubline({
                  isFreshAccount: isFresh,
                  isAvailable: availability.isAvailable,
                  activeOrders: overview?.activeOrders ?? 0,
                  openMatchingRequests: overview?.openMatchingRequests ?? 0,
                })
          }
        />

        {/* The storefront's front door. Above the figures because a closed
            storefront is the reason those figures stop moving. */}
        {errors.profile && !isLoading ? (
          <SectionError
            error={errors.profile}
            onRetry={refetch}
            title="Your storefront did not load"
            message="Availability and profile progress are unavailable until this card loads."
          />
        ) : (
          <AvailabilityCard
            loading={isLoading}
            isAvailable={availability.isAvailable}
            onChange={availability.setAvailable}
            disabled={!availability.canToggle}
          />
        )}

        {/* Section 1 — the numbers. */}
        {errors.pipeline && !isLoading ? (
          <SectionError
            error={errors.pipeline}
            onRetry={refetch}
            title="Your figures did not load"
            message="The rest of the dashboard is fine — this card just needs another go."
          />
        ) : (
          <StatCardGrid loading={isLoading} items={stats} />
        )}

        {/* Section 2 — the three steps to a working storefront. Unlike the
            buyer's, this checklist stays up past the first order: a creator who
            never adds sample work keeps losing briefs to one who did. It
            collapses to a single line once every step is done, and dismissing
            it puts it away for good. */}
        {isLoading || errors.pipeline || errors.profile ? null : (
          <OnboardingChecklist
            title="Get your storefront working"
            description="Three steps between here and buyers finding you."
            steps={onboardingSteps}
            storageKey={ONBOARDING_STORAGE_KEY}
            doneTitle="Your storefront is set up"
            doneMessage="Profile complete, sample work published, and your first proposal sent."
          />
        )}

        {/* Section 3 — earnings and activity, side by side from `lg` up. */}
        <Box
          sx={{
            display: 'grid',
            gap: { xs: 2, md: 3 },
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 3fr) minmax(0, 2fr)' },
          }}
        >
          {errors.earnings && !isLoading ? (
            <SectionError
              error={errors.earnings}
              onRetry={refetch}
              title="Earnings did not load"
              message="Your balance is safe — this chart just could not be read."
            />
          ) : (
            <ChartCard
              title="Earnings — last 6 months"
              subtitle="Released to you, after the BetterBlue commission"
              height={CHART_HEIGHT}
            >
              {isLoading ? (
                <Skeleton
                  variant="rounded"
                  role="status"
                  aria-busy="true"
                  aria-label="Loading monthly earnings"
                  sx={{ width: '100%', height: CHART_HEIGHT }}
                />
              ) : (
                <ThemedLineChart
                  data={overview?.earningsByMonth ?? []}
                  series={[{ key: 'amount', label: 'Earnings' }]}
                  valueFormat="currency"
                  gradient
                  height={CHART_HEIGHT}
                  ariaLabel={earningsChartLabel(overview?.earningsByMonth, currency)}
                  emptyMessage="No earnings in the last six months"
                />
              )}
            </ChartCard>
          )}

          {errors.activity ? (
            <SectionError
              error={errors.activity}
              onRetry={refetch}
              title="Activity did not load"
              message="Your updates are still there — this card just needs another go."
            />
          ) : (
            <Card>
              <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                <Typography variant="h6" component="h2" sx={{ fontSize: '1.0625rem', mb: 0.5 }}>
                  Recent activity
                </Typography>
                {/* TODO(Prompt 27): rows become links into the notification
                    centre. Until that screen exists there is nowhere to send
                    anyone, so the feed stays read-only and says why. */}
                <Tooltip title="Opening an update from here arrives with the notification centre">
                  <Box>
                    <ActivityFeed
                      loading={isLoading}
                      items={overview?.recentActivity ?? []}
                      emptyTitle="Nothing has happened yet"
                      emptyDescription="Proposals, orders, deliveries, and payouts will show up here."
                    />
                  </Box>
                </Tooltip>
              </CardContent>
            </Card>
          )}
        </Box>

        {/* Section 4 — the three things a creator comes here to do. */}
        <Box>
          <Typography variant="overline" component="h2" color="text.secondary">
            Quick actions
          </Typography>
          {/* TODO(Prompts 22–23): the first two tiles are inert until the
              portfolio manager and the request board render — a tile that
              navigates to a 404 is worse than one that plainly does nothing. */}
          <QuickActions actions={quickActions} sx={{ mt: 1 }} />
        </Box>
      </Stack>
    </DashboardPage>
  )
}
