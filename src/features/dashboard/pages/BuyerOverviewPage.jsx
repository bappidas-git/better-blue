import { useMemo } from 'react'

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

import ErrorState from '@/components/feedback/ErrorState'
import { useAuth } from '@/context/AuthContext'
import ActivityFeed from '@/features/dashboard/components/ActivityFeed'
import ChartCard from '@/features/dashboard/components/ChartCard'
import OnboardingChecklist from '@/features/dashboard/components/OnboardingChecklist'
import QuickActions from '@/features/dashboard/components/QuickActions'
import StatCardGrid from '@/features/dashboard/components/StatCardGrid'
import ThemedBarChart from '@/features/dashboard/components/ThemedBarChart'
import WelcomeBanner from '@/features/dashboard/components/WelcomeBanner'
import useApiQuery from '@/hooks/useApiQuery'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { paths } from '@/routes/paths'
import { buyerDashboardService } from '@/services/buyerDashboardService'
import { getBuyerProfileCompleteness } from '@/services/buyerProfileService'
import { EMPTY_PLACEHOLDER, formatCurrency, formatNumber } from '@/utils/formatters'

// The buyer's home screen: how much is in flight, what it has cost, and what
// happened lately — with a first-run variant for an account that has none of
// that yet.
//
// Every number on this page comes from `buyerDashboardService.getOverview`,
// which is also where the aggregation lives (Prompt 15 §7). The page decides
// what to *render* — including which of the three sections failed and needs its
// own retry — and computes nothing but display strings.
//
// TODO(Prompts 18–20): the stat tiles are the entry points to Requests,
// Orders, and Payments. Each becomes a link the moment its route renders a
// page — a tile pointing at an unbuilt path would land on the dashboard 404,
// so they stay inert until then (Prompt 14's rule for `navConfig`, applied to
// page-level links). The "New request" action and the onboarding step are
// live: Prompt 16 built the wizard behind them.

/** Chart height by breakpoint (§11). */
const CHART_HEIGHT = { xs: 240, md: 300 }

/** One sentence describing the spend chart, for screen readers (§12). */
function spendChartLabel(spendByMonth, currency) {
  if (!spendByMonth?.length) return 'Monthly spend over the last six months.'

  const first = spendByMonth[0]
  const last = spendByMonth[spendByMonth.length - 1]
  const peak = spendByMonth.reduce((best, month) => (month.amount > best.amount ? month : best))
  const money = (amount) => formatCurrency(amount, currency, { hideDecimals: true })

  return (
    `Monthly spend over the last six months, from ${money(first.amount)} in ${first.label} ` +
    `to ${money(last.amount)} in ${last.label}. ` +
    `Highest month: ${peak.label} at ${money(peak.amount)}.`
  )
}

/** The banner's second line — the one thing most worth doing today. */
function welcomeSubline({ isFreshAccount, proposalsAwaiting, activeOrders }) {
  if (isFreshAccount) {
    return 'Let us get your first brief in front of the right creators.'
  }
  if (proposalsAwaiting > 0) {
    return `${formatNumber(proposalsAwaiting)} ${
      proposalsAwaiting === 1 ? 'proposal is' : 'proposals are'
    } waiting on your decision.`
  }
  if (activeOrders > 0) {
    return `${formatNumber(activeOrders)} ${
      activeOrders === 1 ? 'order is' : 'orders are'
    } in flight. Nothing needs you right now.`
  }
  return 'Everything is up to date. Post a brief whenever you are ready.'
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

export default function BuyerOverviewPage() {
  const { user } = useAuth()

  const {
    data: overview,
    isLoading,
    error,
    refetch,
  } = useApiQuery(() => buyerDashboardService.getOverview(user?.id), [user?.id], {
    enabled: Boolean(user?.id),
  })

  const completeness = useMemo(
    () => getBuyerProfileCompleteness(overview?.profile, user),
    [overview?.profile, user]
  )

  const errors = overview?.errors ?? {}
  const isFresh = Boolean(overview?.isFreshAccount)
  const currency = overview?.currency

  const stats = [
    {
      key: 'requests',
      label: 'Active requests',
      value: overview?.activeRequests ?? EMPTY_PLACEHOLDER,
      icon: 'solar:clipboard-list-linear',
      // TODO(Prompt 16): to: paths.BUYER_REQUESTS
    },
    {
      key: 'proposals',
      label: 'Proposals to review',
      value: overview?.proposalsAwaiting ?? EMPTY_PLACEHOLDER,
      icon: 'solar:inbox-in-linear',
      iconTone: overview?.proposalsAwaiting > 0 ? 'warning' : 'brand',
      // TODO(Prompt 18): to: paths.BUYER_REQUESTS (the proposals inbox)
    },
    {
      key: 'orders',
      label: 'Active orders',
      value: overview?.activeOrders ?? EMPTY_PLACEHOLDER,
      icon: 'solar:box-linear',
      // TODO(Prompt 20): to: paths.BUYER_ORDERS
    },
    {
      key: 'spent',
      label: 'Total spent',
      value: overview?.totalSpent ?? EMPTY_PLACEHOLDER,
      format: (amount) => formatCurrency(amount, currency, { hideDecimals: true }),
      icon: 'solar:wallet-money-linear',
      iconTone: 'success',
      // TODO(Prompt 19): to: paths.BUYER_PAYMENTS
    },
  ]

  const onboardingSteps = [
    {
      key: 'profile',
      title: 'Complete your profile',
      description:
        completeness.percent === 100
          ? 'Creators can see who they would be working with.'
          : `${completeness.percent}% complete — creators trust a brief more when they know the business behind it.`,
      done: completeness.percent === 100,
      action: { label: 'Edit profile', to: paths.BUYER_PROFILE, icon: 'tabler:building-store' },
    },
    {
      key: 'request',
      title: 'Post your first request',
      description:
        'Describe the content you need, the budget, and the deadline. Creators propose against it.',
      done: (overview?.requestsTotal ?? 0) > 0,
      action: { label: 'Post a request', to: paths.BUYER_REQUEST_NEW, icon: 'tabler:plus' },
    },
    {
      key: 'proposals',
      title: 'Review proposals and award the work',
      description:
        'Compare prices, timelines, and sample work, then fund the order you pick. Your payment is held in escrow until you accept the delivery.',
      done: (overview?.ordersTotal ?? 0) > 0,
    },
  ]

  const quickActions = [
    {
      key: 'new-request',
      label: 'New request',
      description: 'Brief the content you need',
      icon: 'solar:document-add-linear',
      to: paths.BUYER_REQUEST_NEW,
    },
    {
      key: 'browse-creators',
      label: 'Browse creators',
      description: 'Find the right professional',
      icon: 'solar:users-group-rounded-linear',
      to: paths.CREATORS,
    },
    {
      key: 'support',
      label: 'Get support',
      description: 'Ask the BetterBlue team',
      icon: 'solar:chat-round-line-linear',
      to: paths.CONTACT,
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
      subtitle="Your requests, proposals, orders, and spend at a glance."
    >
      <Stack spacing={{ xs: 2, md: 3 }}>
        <WelcomeBanner
          name={user?.name}
          storageKey="dashboard.buyer.welcomeDismissed"
          subline={
            isLoading
              ? 'Bringing your dashboard up to date…'
              : welcomeSubline({
                  isFreshAccount: isFresh,
                  proposalsAwaiting: overview?.proposalsAwaiting ?? 0,
                  activeOrders: overview?.activeOrders ?? 0,
                })
          }
        />

        {/* Section 1 — the numbers, or the checklist that replaces them. */}
        {errors.summary && !isLoading ? (
          <SectionError
            error={errors.summary}
            onRetry={refetch}
            title="Your figures did not load"
            message="The rest of the dashboard is fine — this card just needs another go."
          />
        ) : isFresh && !isLoading ? (
          <OnboardingChecklist
            title="Get your first brief live"
            description="Three steps between here and a creator working on your content."
            steps={onboardingSteps}
          />
        ) : (
          <StatCardGrid loading={isLoading} items={stats} />
        )}

        {/* Section 2 — spend and activity, side by side from `lg` up. A fresh
            account has no spend to plot, so it gets the activity feed alone. */}
        <Box
          sx={{
            display: 'grid',
            gap: { xs: 2, md: 3 },
            gridTemplateColumns: {
              xs: '1fr',
              lg: isFresh && !isLoading ? '1fr' : 'minmax(0, 3fr) minmax(0, 2fr)',
            },
          }}
        >
          {isFresh && !isLoading ? null : errors.spend ? (
            <SectionError
              error={errors.spend}
              onRetry={refetch}
              title="Spend did not load"
              message="Your payment history is safe — this chart just could not be read."
            />
          ) : (
            <ChartCard
              title="Spend — last 6 months"
              subtitle="What you have paid into escrow, net of refunds"
              height={CHART_HEIGHT}
            >
              {isLoading ? (
                <Skeleton
                  variant="rounded"
                  role="status"
                  aria-busy="true"
                  aria-label="Loading monthly spend"
                  sx={{ width: '100%', height: CHART_HEIGHT }}
                />
              ) : (
                <ThemedBarChart
                  data={overview?.spendByMonth ?? []}
                  series={[{ key: 'amount', label: 'Spend' }]}
                  valueFormat="currency"
                  height={CHART_HEIGHT}
                  ariaLabel={spendChartLabel(overview?.spendByMonth, currency)}
                  emptyMessage="No spend in the last six months"
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
                <Typography
                  variant="h6"
                  component="h2"
                  sx={{ fontSize: '1.0625rem', mb: 0.5 }}
                >
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
                      emptyDescription="Proposals, deliveries, and payment updates will show up here."
                    />
                  </Box>
                </Tooltip>
              </CardContent>
            </Card>
          )}
        </Box>

        {/* Section 3 — the three things a buyer comes here to do. */}
        <Box>
          <Typography variant="overline" component="h2" color="text.secondary">
            Quick actions
          </Typography>
          <QuickActions actions={quickActions} sx={{ mt: 1 }} />
        </Box>
      </Stack>
    </DashboardPage>
  )
}
