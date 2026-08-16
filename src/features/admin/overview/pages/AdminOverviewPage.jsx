import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import ErrorState from '@/components/feedback/ErrorState'
import { useAuth } from '@/context/AuthContext'
import AttentionQueues from '@/features/admin/overview/components/AttentionQueues'
import AuditFeed from '@/features/admin/overview/components/AuditFeed'
import KpiGrid from '@/features/admin/overview/components/KpiGrid'
import ChartCard from '@/features/dashboard/components/ChartCard'
import ThemedBarChart from '@/features/dashboard/components/ThemedBarChart'
import ThemedDonutChart from '@/features/dashboard/components/ThemedDonutChart'
import ThemedLineChart from '@/features/dashboard/components/ThemedLineChart'
import WelcomeBanner from '@/features/dashboard/components/WelcomeBanner'
import useApiQuery from '@/hooks/useApiQuery'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { adminService } from '@/services/adminService'
import { formatCurrency, formatNumber } from '@/utils/formatters'

// The admin console's home screen: how the marketplace is doing, what is
// waiting on the team, and what the team has been doing.
//
// Every number comes from `adminService` (§7) — the page fetches no collection
// and computes no aggregate, it only decides what to *render* and how to say
// it. Three independent queries rather than one, so the figures, the queues,
// and the audit feed each fail and retry on their own; inside the first,
// `getOverviewStats` isolates each metric again (§13).
//
// Denser than the buyer and creator overviews and in the same design language
// (§6): six tiles instead of four, three charts in a band, three queues below
// them. Deep links into the rest of the console are comment-gated until
// Prompts 29–36 build those screens — a tile pointing at an unbuilt route lands
// on the dashboard 404, which is the rule `navConfig` already follows.

/** One height for all three charts, so the band reads as one row (§6). */
const CHART_HEIGHT = 280

/** One sentence describing the weekly order volume, for screen readers (§12). */
function ordersChartLabel(ordersByWeek) {
  if (!ordersByWeek?.length) return 'Orders placed per week over the last eight weeks.'

  const total = ordersByWeek.reduce((sum, week) => sum + week.orders, 0)
  const peak = ordersByWeek.reduce((best, week) => (week.orders > best.orders ? week : best))

  return (
    `Orders placed per week over the last eight weeks, ${formatNumber(total)} in total. ` +
    `Busiest week: ${peak.label}, with ${formatNumber(peak.orders)}. ` +
    `Latest week: ${formatNumber(ordersByWeek[ordersByWeek.length - 1].orders)}.`
  )
}

/** One sentence describing the commission trend. */
function revenueChartLabel(revenueByMonth, currency) {
  if (!revenueByMonth?.length) return 'Commission revenue per month over the last six months.'

  const money = (amount) => formatCurrency(amount, currency, { hideDecimals: true })
  const first = revenueByMonth[0]
  const last = revenueByMonth[revenueByMonth.length - 1]
  const peak = revenueByMonth.reduce((best, month) => (month.amount > best.amount ? month : best))

  return (
    `Commission revenue per month over the last six months, from ${money(first.amount)} in ` +
    `${first.label} to ${money(last.amount)} in ${last.label}. ` +
    `Best month: ${peak.label} at ${money(peak.amount)}.`
  )
}

/** One sentence describing the category split. */
function categoryChartLabel(categoryDistribution) {
  if (!categoryDistribution?.length) return 'Orders by marketplace category.'

  const total = categoryDistribution.reduce((sum, slice) => sum + slice.value, 0)
  const top = categoryDistribution[0]

  return (
    `Orders by category, ${formatNumber(total)} in total across ` +
    `${formatNumber(categoryDistribution.length)} categories. ` +
    `Largest: ${top.name}, with ${formatNumber(top.value)}.`
  )
}

/**
 * The banner's second line: one sentence on where the platform stands.
 *
 * Counts the three queues an admin can actually clear — disputes, moderation,
 * and settlements. A metric that failed to load is left out of the sum rather
 * than counted as zero, because "nothing needs attention" must never be the
 * sentence a timed-out request produces.
 */
function platformStatusLine(stats) {
  if (!stats) return 'Bringing the marketplace up to date…'

  const queues = [stats.openDisputes, stats.moderationQueueSize, stats.pendingSettlements]
  const known = queues.filter((value) => typeof value === 'number')
  if (known.length === 0) return 'Some figures could not be loaded — try the cards below again.'

  const waiting = known.reduce((sum, value) => sum + value, 0)
  const partial = known.length < queues.length ? ' (of the queues we could read)' : ''

  return waiting === 0
    ? `All systems normal — nothing is waiting on the team${partial}.`
    : `All systems normal — ${formatNumber(waiting)} ${
        waiting === 1 ? 'item needs' : 'items need'
      } attention${partial}.`
}

/** A card holding nothing but a failure and the way out of it. */
function SectionError({ error, onRetry, title, message }) {
  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <ErrorState dense title={title} message={message} error={error} onRetry={onRetry} />
      </CardContent>
    </Card>
  )
}

/** A chart-shaped skeleton, sized to the band so nothing jumps when data lands. */
function ChartSkeleton({ label }) {
  return (
    <Skeleton
      variant="rounded"
      role="status"
      aria-busy="true"
      aria-label={label}
      sx={{ width: '100%', height: CHART_HEIGHT }}
    />
  )
}

export default function AdminOverviewPage() {
  const { user } = useAuth()

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useApiQuery(() => adminService.getOverviewStats(), [])

  const {
    data: queues,
    isLoading: queuesLoading,
    error: queuesError,
    refetch: refetchQueues,
  } = useApiQuery(() => adminService.getAttentionQueues(), [])

  const {
    data: auditItems,
    isLoading: auditLoading,
    error: auditError,
    refetch: refetchAudit,
  } = useApiQuery(() => adminService.getRecentAuditActivity(), [])

  const errors = stats?.errors ?? {}
  const currency = stats?.currency

  // `getOverviewStats` resolves even when every section inside it failed, so a
  // rejected query here means the call itself could not run — the one case
  // where there is nothing at all to draw.
  if (statsError) {
    return (
      <DashboardPage title="Overview">
        <ErrorState
          title="We could not load the console"
          message="Check your connection and try again — nothing on the platform has changed."
          error={statsError}
          onRetry={refetchStats}
        />
      </DashboardPage>
    )
  }

  return (
    <DashboardPage
      title="Overview"
      subtitle="Marketplace health, the queues waiting on the team, and what the team has been doing."
      maxWidth={false}
    >
      <Stack spacing={{ xs: 2, md: 3 }}>
        <WelcomeBanner
          name={user?.name}
          icon="tabler:shield-check"
          storageKey="dashboard.admin.welcomeDismissed"
          subline={statsLoading ? 'Bringing the marketplace up to date…' : platformStatusLine(stats)}
        />

        {/* Section 1 — the six headline figures, each its own failure boundary. */}
        <KpiGrid stats={stats} loading={statsLoading} onRetry={refetchStats} />

        {/* Section 2 — volume, revenue, and mix. The donut spans both columns at
            `md`, where three equal columns would be too narrow to read. */}
        <Box
          sx={{
            display: 'grid',
            gap: { xs: 2, md: 3 },
            gridTemplateColumns: {
              xs: '1fr',
              md: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(3, minmax(0, 1fr))',
            },
          }}
        >
          {errors.series && !statsLoading ? (
            <SectionError
              error={errors.series}
              onRetry={refetchStats}
              title="Order volume did not load"
              message="The rest of the console is fine — this chart just needs another go."
            />
          ) : (
            <ChartCard
              title="Orders per week"
              subtitle="Placed in the last 8 weeks"
              height={CHART_HEIGHT}
            >
              {statsLoading ? (
                <ChartSkeleton label="Loading weekly order volume" />
              ) : (
                <ThemedLineChart
                  data={stats?.ordersByWeek ?? []}
                  series={[{ key: 'orders', label: 'Orders' }]}
                  gradient
                  height={CHART_HEIGHT}
                  ariaLabel={ordersChartLabel(stats?.ordersByWeek)}
                  emptyMessage="No orders in the last eight weeks"
                />
              )}
            </ChartCard>
          )}

          {errors.commission && !statsLoading ? (
            <SectionError
              error={errors.commission}
              onRetry={refetchStats}
              title="Commission revenue did not load"
              message="Nothing about the ledger has changed — this chart just could not be read."
            />
          ) : (
            <ChartCard
              title="Commission revenue by month"
              subtitle="Recognised when escrow is released"
              height={CHART_HEIGHT}
            >
              {statsLoading ? (
                <ChartSkeleton label="Loading monthly commission revenue" />
              ) : (
                <ThemedBarChart
                  data={stats?.revenueByMonth ?? []}
                  series={[{ key: 'amount', label: 'Commission' }]}
                  valueFormat="currency"
                  height={CHART_HEIGHT}
                  ariaLabel={revenueChartLabel(stats?.revenueByMonth, currency)}
                  emptyMessage="No commission revenue in the last six months"
                />
              )}
            </ChartCard>
          )}

          <Box sx={{ gridColumn: { md: 'span 2', lg: 'span 1' } }}>
            {errors.series && !statsLoading ? (
              <SectionError
                error={errors.series}
                onRetry={refetchStats}
                title="Category mix did not load"
                message="This card shares its data with the weekly chart — retrying fixes both."
              />
            ) : (
              <ChartCard
                title="Orders by category"
                subtitle="Last 6 months"
                height={CHART_HEIGHT}
              >
                {statsLoading ? (
                  <ChartSkeleton label="Loading the category split" />
                ) : (
                  <ThemedDonutChart
                    data={(stats?.categoryDistribution ?? []).map((slice) => ({
                      name: slice.name,
                      value: slice.value,
                    }))}
                    height={CHART_HEIGHT}
                    centerLabel="Orders"
                    ariaLabel={categoryChartLabel(stats?.categoryDistribution)}
                    emptyMessage="No orders in the last six months"
                  />
                )}
              </ChartCard>
            )}
          </Box>
        </Box>

        {/* Section 3 — the four queues, oldest item first. */}
        <Box>
          <Typography variant="overline" component="h2" color="text.secondary">
            Needs attention
          </Typography>
          <Box sx={{ mt: 1 }}>
            {queuesError ? (
              <SectionError
                error={queuesError}
                onRetry={refetchQueues}
                title="The attention queues did not load"
                message="Everything above is current — these three cards just need another go."
              />
            ) : (
              <AttentionQueues
                queues={queues}
                loading={queuesLoading}
                onRetry={refetchQueues}
              />
            )}
          </Box>
        </Box>

        {/* Section 4 — the audit trail's newest entries. */}
        <Card>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Typography variant="h6" component="h2" sx={{ fontSize: '1.0625rem' }}>
              Recent admin activity
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Every administrative action, recorded as it happens.
            </Typography>

            {auditError ? (
              <ErrorState
                dense
                title="The activity feed did not load"
                message="The trail itself is append-only and untouched — this card just needs another go."
                error={auditError}
                onRetry={refetchAudit}
              />
            ) : (
              <AuditFeed items={auditItems ?? []} loading={auditLoading} />
            )}
            {/* TODO(Prompt 36): a "View the full audit log" link to
                `paths.ADMIN_AUDIT`, gated on `PERMISSIONS.AUDIT_VIEW`. */}
          </CardContent>
        </Card>
      </Stack>
    </DashboardPage>
  )
}
