import { Icon } from '@iconify/react'
import { Box, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material'

import { NOTIFICATION_TYPE } from '@/constants/notificationTypes'
import { DEFAULT_ADMIN_PERMISSIONS, PERMISSIONS } from '@/constants/permissions'
import { ROLES } from '@/constants/roles'
import ActivityFeed from '@/features/dashboard/components/ActivityFeed'
import ChartCard from '@/features/dashboard/components/ChartCard'
import QuickActions from '@/features/dashboard/components/QuickActions'
import StatCardGrid from '@/features/dashboard/components/StatCardGrid'
import ThemedBarChart from '@/features/dashboard/components/ThemedBarChart'
import ThemedDonutChart from '@/features/dashboard/components/ThemedDonutChart'
import ThemedLineChart from '@/features/dashboard/components/ThemedLineChart'
import WelcomeBanner from '@/features/dashboard/components/WelcomeBanner'
import { filterNavEntries, flattenNavEntries, splitBottomNav } from '@/routes/navConfig'
import { paths } from '@/routes/paths'
import { formatCurrency } from '@/utils/formatters'

import GalleryBlock from './GalleryBlock'

// Widgets tab — the Prompt 14 dashboard kit in every state it supports, plus a
// static read-out of the nav resolver so permission filtering and the mobile
// "More" split can be verified without signing in as four different accounts.
//
// Fixtures are inline and business-safe (00 §1); the gallery is the one place
// that is allowed (Prompt 04 §9).

const SPEND_BY_MONTH = [
  { label: 'Jan', spend: 2400, escrow: 900 },
  { label: 'Feb', spend: 3120, escrow: 1400 },
  { label: 'Mar', spend: 2980, escrow: 1100 },
  { label: 'Apr', spend: 4310, escrow: 2050 },
  { label: 'May', spend: 5240, escrow: 1800 },
  { label: 'Jun', spend: 8130, escrow: 3400 },
]

const ORDERS_BY_CATEGORY = [
  { label: 'Food & Beverage', photo: 14, video: 9 },
  { label: 'Beauty', photo: 11, video: 6 },
  { label: 'Fitness', photo: 7, video: 12 },
  { label: 'Real Estate', photo: 9, video: 4 },
  { label: 'Technology', photo: 5, video: 8 },
]

const ESCROW_SPLIT = [
  { name: 'Held in escrow', value: 12400 },
  { name: 'Released', value: 28650 },
  { name: 'Refunded', value: 1850 },
]

const STATS = [
  {
    key: 'requests',
    label: 'Open requests',
    value: 6,
    icon: 'solar:clipboard-list-linear',
    delta: 0.2,
    deltaLabel: 'vs last 30 days',
  },
  {
    key: 'proposals',
    label: 'Proposals to review',
    value: 14,
    icon: 'solar:document-add-linear',
    iconTone: 'info',
  },
  {
    key: 'orders',
    label: 'Orders in flight',
    value: 3,
    icon: 'solar:box-linear',
    iconTone: 'warning',
  },
  {
    key: 'escrow',
    label: 'Held in escrow',
    value: 12400,
    format: (value) => formatCurrency(value, 'USD', { hideDecimals: true }),
    icon: 'solar:wallet-money-linear',
    iconTone: 'success',
    delta: -0.08,
    deltaLabel: 'vs last 30 days',
  },
]

const QUICK_ACTIONS = [
  {
    key: 'new-request',
    label: 'Post a request',
    description: 'Brief creators on your next campaign',
    icon: 'solar:add-square-linear',
    to: paths.CREATORS,
  },
  {
    key: 'find-creators',
    label: 'Find creators',
    description: 'Browse verified portfolios',
    icon: 'solar:magnifer-linear',
    to: paths.CREATORS,
  },
  {
    key: 'pricing',
    label: 'How pricing works',
    description: 'Commission, escrow, and payouts',
    icon: 'solar:tag-price-linear',
    to: paths.PRICING,
  },
]

const ACTIVITY = [
  {
    id: 'ntf_1',
    type: NOTIFICATION_TYPE.PROPOSAL_RECEIVED,
    title: 'New proposal from Ava Martinez',
    body: 'Ava proposed $820 for “20 seasonal menu photos for our autumn dinner service”, delivered in 9 days.',
    createdAt: '2026-08-15T08:30:00.000Z',
    read: false,
  },
  {
    id: 'ntf_2',
    type: NOTIFICATION_TYPE.DELIVERY_SUBMITTED,
    title: 'Harbor Table delivery is ready',
    body: 'Three vertical reels are waiting on your review.',
    createdAt: '2026-08-14T17:10:00.000Z',
    read: false,
  },
  {
    id: 'ntf_3',
    type: NOTIFICATION_TYPE.PAYMENT_RELEASED,
    title: 'Payment released',
    body: '$640 was released to Noah Feldman for the Bloom Coffee product set.',
    createdAt: '2026-08-13T11:45:00.000Z',
    read: true,
  },
  {
    id: 'ntf_4',
    type: NOTIFICATION_TYPE.MODERATION_APPROVED,
    title: 'Portfolio item approved',
    body: 'Trust & Safety approved “Autumn tasting menu — stills”.',
    createdAt: '2026-08-12T09:05:00.000Z',
    read: true,
  },
]

/* --- Nav resolver read-out ------------------------------------------------ */

// A fixture nav, not the live `adminNav`: Prompt 14 seeds only the Overview
// entry per role (later prompts append theirs), so the filtering and the mobile
// split need representative data to be visible at all.
const FIXTURE_ADMIN_NAV = [
  { key: 'overview', label: 'Overview', icon: 'solar:widget-5-linear', path: '/admin', exact: true },
  {
    key: 'trust',
    group: 'Trust & Safety',
    items: [
      { key: 'moderation', label: 'Moderation', icon: 'solar:shield-check-linear', path: '/admin/moderation', permission: PERMISSIONS.MODERATION_REVIEW },
      { key: 'reports', label: 'Reports', icon: 'solar:flag-linear', path: '/admin/reports', permission: PERMISSIONS.REPORTS_MANAGE },
    ],
  },
  {
    key: 'finance',
    group: 'Finance',
    items: [
      { key: 'payments', label: 'Payments', icon: 'solar:card-linear', path: '/admin/payments', permission: PERMISSIONS.PAYMENTS_MANAGE },
      { key: 'settlements', label: 'Settlements', icon: 'solar:banknote-2-linear', path: '/admin/settlements', permission: PERMISSIONS.SETTLEMENTS_PROCESS },
    ],
  },
  {
    key: 'platform',
    group: 'Platform',
    items: [
      { key: 'settings', label: 'Settings', icon: 'solar:settings-linear', path: '/admin/settings', permission: PERMISSIONS.SETTINGS_MANAGE },
      { key: 'roles', label: 'Admin team', icon: 'solar:users-group-rounded-linear', path: '/admin/roles', roles: [ROLES.SUPER_ADMIN] },
    ],
  },
]

const FIXTURE_MORE_KEYS = ['settings', 'roles']

const FIXTURE_ADMINS = [
  {
    key: 'super',
    caption: 'Super admin — every permission, plus the super-admin-only entry',
    user: { role: ROLES.SUPER_ADMIN, name: 'Elena Marsh' },
  },
  {
    key: 'ops',
    caption: 'Operations admin — the default permission set',
    user: { role: ROLES.ADMIN, name: 'Maya Chen', permissions: [...DEFAULT_ADMIN_PERMISSIONS] },
  },
  {
    key: 'safety',
    caption: 'Trust & Safety reviewer — content only, no finance or platform',
    user: {
      role: ROLES.ADMIN,
      name: 'Priya Raman',
      permissions: [PERMISSIONS.MODERATION_REVIEW, PERMISSIONS.REPORTS_MANAGE],
    },
  },
]

/** Plain card for the feed columns — `ChartCard` centres its body for charts. */
function FeedCard({ title, children }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Typography variant="h6" component="h3" sx={{ fontSize: '1rem', mb: 1 }}>
          {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
  )
}

function NavResolution({ caption, user }) {
  const entries = filterNavEntries(FIXTURE_ADMIN_NAV, user)
  const items = flattenNavEntries(entries)
  const { primary, more } = splitBottomNav(items, FIXTURE_MORE_KEYS)

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle2">{user.name}</Typography>
        <Typography variant="caption" color="text.secondary">
          {caption}
        </Typography>

        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
          {items.map((item) => (
            <Chip
              key={item.key}
              size="small"
              label={item.label}
              icon={<Icon icon={item.icon} width={14} />}
            />
          ))}
        </Stack>

        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
          Mobile bar: {primary.map((item) => item.label).join(' · ') || '—'}
          {more.length > 0 ? ` · More (${more.map((item) => item.label).join(', ')})` : ''}
        </Typography>
      </CardContent>
    </Card>
  )
}

export default function WidgetsGallery() {
  return (
    <Stack spacing={{ xs: 5, md: 7 }}>
      <GalleryBlock
        title="Welcome banner"
        caption="Greeting by daypart, a contextual second line, and an optional action. Dismissal lasts the browser session; the three below pin the clock so every daypart is visible at once."
      >
        <Stack spacing={2}>
          <WelcomeBanner
            name="Nora Whitfield"
            subline="Two proposals are waiting on your decision, and one delivery is ready to review."
            now={new Date('2026-08-15T09:00:00')}
            dismissable={false}
            action={
              <Button variant="gradient" size="small">
                Review proposals
              </Button>
            }
          />
          <WelcomeBanner
            name="Ava Martinez"
            subline="Three briefs match your categories today."
            now={new Date('2026-08-15T14:00:00')}
            dismissable={false}
          />
          <WelcomeBanner
            name="Maya Chen"
            subline="The moderation queue is clear. Four settlements are due tomorrow."
            now={new Date('2026-08-15T20:00:00')}
            storageKey="devGallery.welcomeDismissed"
          />
        </Stack>
      </GalleryBlock>

      <GalleryBlock
        title="Stat grid"
        caption="Two columns on a phone, four from md up. Numbers count up on mount and honour prefers-reduced-motion; the loading row renders matching skeletons."
      >
        <Stack spacing={3}>
          <StatCardGrid items={STATS} />
          <StatCardGrid loading />
        </Stack>
      </GalleryBlock>

      <GalleryBlock
        title="Quick actions"
        caption="The two or three things a member came to do. Two columns on a phone, one row from sm up."
      >
        <QuickActions actions={QUICK_ACTIONS} />
      </GalleryBlock>

      <GalleryBlock
        title="Charts"
        caption="Recharts wrappers pre-styled from the theme: brand purple then pink, hairline grid, compact axis ticks, full values in the tooltip. Every chart is announced as an image with a required ariaLabel summary — omitting it logs a dev warning."
      >
        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
          }}
        >
          <ChartCard
            title="Spend over time"
            subtitle="Last six months, gradient area fill"
            height={260}
          >
            <ThemedLineChart
              data={SPEND_BY_MONTH}
              series={[{ key: 'spend', label: 'Spend' }]}
              valueFormat="currency"
              gradient
              height={260}
              ariaLabel="Spend over the last six months, rising from $2,400 in January to $8,130 in June."
            />
          </ChartCard>

          <ChartCard title="Spend vs escrow" subtitle="Two series, legend on" height={260}>
            <ThemedLineChart
              data={SPEND_BY_MONTH}
              series={[
                { key: 'spend', label: 'Spend' },
                { key: 'escrow', label: 'Held in escrow' },
              ]}
              valueFormat="currency"
              showLegend
              height={260}
              ariaLabel="Monthly spend compared with the balance held in escrow across the last six months. Spend rises from $2,400 to $8,130; escrow peaks at $3,400 in June."
            />
          </ChartCard>

          <ChartCard title="Orders by category" subtitle="Grouped, rounded bars" height={260}>
            <ThemedBarChart
              data={ORDERS_BY_CATEGORY}
              series={[
                { key: 'photo', label: 'Photo' },
                { key: 'video', label: 'Video' },
              ]}
              showLegend
              height={260}
              ariaLabel="Orders by category. Food and Beverage leads with 14 photo and 9 video orders; Technology is lowest with 5 photo and 8 video orders."
            />
          </ChartCard>

          <ChartCard title="Escrow position" subtitle="Donut with centre total" height={260}>
            <ThemedDonutChart
              data={ESCROW_SPLIT}
              valueFormat="currency"
              centerLabel="Lifetime volume"
              height={260}
              ariaLabel="Escrow position: $28,650 released, $12,400 still held, and $1,850 refunded."
            />
          </ChartCard>

          <ChartCard title="Categories, horizontal" subtitle="Long labels on a phone" height={260}>
            <ThemedBarChart
              data={ORDERS_BY_CATEGORY}
              series={[{ key: 'photo', label: 'Photo orders' }]}
              horizontal
              height={260}
              ariaLabel="Photo orders by category, from 14 in Food and Beverage down to 5 in Technology."
            />
          </ChartCard>

          <ChartCard title="Empty state" subtitle="No rows, or every value zero" height={260}>
            <ThemedLineChart
              data={[]}
              series={[{ key: 'spend', label: 'Spend' }]}
              height={260}
              ariaLabel="Spend over time. No data yet."
            />
          </ChartCard>
        </Box>
      </GalleryBlock>

      <GalleryBlock
        title="Activity feed"
        caption="Notification-shaped rows: icon and tone come from NOTIFICATION_META, so the same row looks identical in the bell menu, the notifications centre, and here. Unread rows carry a dot and a heavier title."
      >
        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
          }}
        >
          <FeedCard title="Recent activity">
            <ActivityFeed items={ACTIVITY} onItemClick={() => {}} />
          </FeedCard>
          <FeedCard title="Loading">
            <ActivityFeed loading skeletonRows={4} />
          </FeedCard>
          <FeedCard title="Empty">
            <ActivityFeed
              items={[]}
              emptyTitle="No activity yet"
              emptyDescription="Proposals, deliveries, and payments will show up here as they happen."
            />
          </FeedCard>
        </Box>
      </GalleryBlock>

      <GalleryBlock
        title="Navigation resolver"
        caption="routes/navConfig.jsx is data, not layout logic. The same fixture admin nav resolved for three permission sets — empty groups vanish with their heading, super-admin-only entries stay hidden, and the mobile bar never exceeds five slots."
      >
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
          }}
        >
          {FIXTURE_ADMINS.map((entry) => (
            <NavResolution key={entry.key} caption={entry.caption} user={entry.user} />
          ))}
        </Box>
      </GalleryBlock>
    </Stack>
  )
}
