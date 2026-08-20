import { useState } from 'react'

import { Icon } from '@iconify/react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from '@mui/material'

import CreatorLevelBadge from '@/components/data-display/CreatorLevelBadge'
import OnlineDot from '@/components/data-display/OnlineDot'
import UserAvatar from '@/components/data-display/UserAvatar'
import EmptyState from '@/components/feedback/EmptyState'
import ErrorState from '@/components/feedback/ErrorState'
import RoleGateDialog from '@/components/feedback/RoleGateDialog'
import FilterChipGroup from '@/components/inputs/FilterChipGroup'
import {
  CREATOR_LEVEL,
  FEED_DEAL_STATUS,
  getCreatorLevel,
  getFeedDealMeta,
} from '@/constants'
import FeedCard, { FeedCardSkeleton } from '@/features/feeds/components/FeedCard'
import FeedDealChip from '@/features/feeds/components/FeedDealChip'
import { useApiQuery } from '@/hooks/useApiQuery'
import { ROLES } from '@/constants/roles'
import { FEED_SORT, creatorMetaService, feedService } from '@/services'
import { formatCurrency, formatNumber } from '@/utils/formatters'

import GalleryBlock from './GalleryBlock'

// Dev-only acceptance surface for Storefront V2 prompt 03: the feed data layer,
// the canonical FeedCard, the level and presence indicators, and the role gate.
// Everything below goes through `src/services` and the real seeded API, so this
// tab is also where the service's sorts, filters, and privacy rule are checked
// by eye (V2-03 §Verify 2 and 3).
//
// Inline fixtures are allowed only in this gallery (Prompt 04 §9); the three
// fixed feeds below exist so all three deal statuses are on screen at once
// regardless of what the seeded board currently holds.

/* --- Fixtures ------------------------------------------------------------- */

const FIXTURE_BUYER = {
  companyName: 'Verde Kitchen',
  logoUrl: undefined,
}

const FIXTURE_FEEDS = [
  {
    id: 'req_gallery_open',
    title: '20 seasonal menu photos for our autumn dinner service',
    description:
      'We are refreshing the autumn menu across all six locations and need photography for the printed menu, the website, and organic social. Shooting happens in our Portland kitchen over one service, with the full dish list and plating notes ready on the day.',
    tags: ['menu-photography', 'food-styling', 'on-location', 'print-ready', 'hospitality', 'seasonal'],
    offerPrice: 900,
    currency: 'USD',
    repliesCount: 40,
    status: 'open',
    publishedAt: '2026-08-11T13:30:00.000Z',
    buyer: FIXTURE_BUYER,
  },
  {
    id: 'req_gallery_closed',
    title: 'Courtyard dining films for the winter terrace launch',
    description:
      'Three short films for the covered courtyard we are opening for winter service: the space at dusk with the heaters lit, a service sequence from the pass to the table, and a short piece on the winter drinks list.',
    tags: ['short-form-video', 'vertical-video', 'hospitality'],
    offerPrice: 820,
    currency: 'USD',
    repliesCount: 7,
    status: 'awarded',
    publishedAt: '2026-07-22T13:30:00.000Z',
    buyer: FIXTURE_BUYER,
  },
  {
    id: 'req_gallery_delivered',
    title: 'Loft showroom photography for the Brooklyn flagship',
    description:
      'A completed commission from the archive: the showroom photographed empty and dressed, with detail frames of every room set and the delivery graded to the brand guidelines supplied with the brief.',
    tags: ['interiors', 'property', 'architecture', 'showroom'],
    offerPrice: 640,
    currency: 'USD',
    repliesCount: 2,
    status: 'completed',
    publishedAt: '2026-06-14T13:30:00.000Z',
    buyer: FIXTURE_BUYER,
  },
]

const LEVEL_FIXTURES = [
  { level: CREATOR_LEVEL.ONE, deliveriesCount: 6, totalEarned: 1868, name: 'Chloe Dubois' },
  { level: CREATOR_LEVEL.TWO, deliveriesCount: 18, totalEarned: 7944, name: 'Isla Bergstrom' },
  { level: CREATOR_LEVEL.THREE, deliveriesCount: 42, totalEarned: 13124, name: 'Ava Martinez' },
]

/* --- Blocks --------------------------------------------------------------- */

function FeedCardBlock() {
  const [gate, setGate] = useState(null)

  return (
    <GalleryBlock
      title="Feed card"
      caption="One card per row, capped at 680px inside a feed column. Header carries the buyer, the posted time, and the deal chip; the offer price leads the footer in gradient text at display size. The heading stretches its hit area across the card, so the whole card is clickable while Reply and Details stay separate controls. Hover lifts and glows; under reduced motion the lift is dropped and the glow stays."
    >
      <Stack spacing={2.5} alignItems={{ xs: 'stretch', md: 'flex-start' }}>
        {FIXTURE_FEEDS.map((feed) => (
          <FeedCard
            key={feed.id}
            feed={feed}
            detailTo="#"
            onReply={() => setGate({ requiredRole: ROLES.CREATOR, action: 'reply to this feed' })}
          />
        ))}
        <Box sx={{ width: '100%' }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Loading placeholder
          </Typography>
          <FeedCardSkeleton />
        </Box>
      </Stack>

      <RoleGateDialog
        open={Boolean(gate)}
        onClose={() => setGate(null)}
        requiredRole={gate?.requiredRole}
        action={gate?.action}
      />
    </GalleryBlock>
  )
}

function IndicatorsBlock() {
  return (
    <GalleryBlock
      title="Deal chips, level badges, presence"
      caption="Three tiny components that appear everywhere V2 shows a feed or a storefront. The deal chip glows only on `open` — the one state that carries an affordance. Level badges take their tier from the shared rule in constants/creatorLevels.js, so the badge and the seed can never disagree; only Level 3 carries a full halo. The presence dot pulses, and renders as a plain solid dot under prefers-reduced-motion."
    >
      <Stack spacing={3}>
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Deal status
          </Typography>
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center">
            {Object.values(FEED_DEAL_STATUS).map((status) => (
              <Stack key={status} direction="row" spacing={1} alignItems="center">
                <FeedDealChip dealStatus={status} />
                <Typography variant="caption" color="text.secondary">
                  {getFeedDealMeta(status).description}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        <Divider />

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Creator level
          </Typography>
          <Stack spacing={1.5}>
            {LEVEL_FIXTURES.map((creator) => (
              <Stack key={creator.level} direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                <CreatorLevelBadge creator={creator} />
                <Typography variant="caption" color="text.secondary">
                  {formatNumber(creator.deliveriesCount)} deliveries ·{' '}
                  {formatCurrency(creator.totalEarned, undefined, { hideDecimals: true })} earned → rule says level{' '}
                  {getCreatorLevel(creator)}
                </Typography>
              </Stack>
            ))}
            <Stack direction="row" spacing={1.5} alignItems="center">
              <CreatorLevelBadge creator={LEVEL_FIXTURES[2]} size="md" />
              <Typography variant="caption" color="text.secondary">
                Medium size, for a profile header
              </Typography>
            </Stack>
          </Stack>
        </Box>

        <Divider />

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Presence
          </Typography>
          <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap" useFlexGap>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <UserAvatar name="Ava Martinez" size="sm" />
              <OnlineDot />
            </Stack>
            <OnlineDot showLabel={false} />
            <Typography variant="caption" color="text.secondary">
              Label hidden — still announced to assistive tech
            </Typography>
            <Typography variant="caption" color="text.secondary">
              <code>online={'{false}'}</code> renders nothing:
            </Typography>
            <OnlineDot online={false} />
          </Stack>
        </Box>
      </Stack>
    </GalleryBlock>
  )
}

function RoleGateBlock() {
  const [gate, setGate] = useState(null)

  return (
    <GalleryBlock
      title="Role gate"
      caption="One dialog for every gated V2 action. Register carries ?role= (read by the register form in V2-06); Log in carries the current location as state.from, which is the same shape the route guards use — so signing in returns the visitor to the page they were gated on. A sheet below md, a modal above it."
    >
      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
        <Button
          variant="outlined"
          onClick={() => setGate({ requiredRole: ROLES.CREATOR, action: 'reply to this feed' })}
        >
          Gate: reply (creator)
        </Button>
        <Button
          variant="outlined"
          onClick={() =>
            setGate({ requiredRole: ROLES.BUYER, action: 'send a message to this creator' })
          }
        >
          Gate: send message (buyer)
        </Button>
        <Button variant="outlined" onClick={() => setGate({ requiredRole: ROLES.CREATOR })}>
          Gate: no action phrase
        </Button>
      </Stack>

      <RoleGateDialog
        open={Boolean(gate)}
        onClose={() => setGate(null)}
        requiredRole={gate?.requiredRole}
        action={gate?.action}
      />
    </GalleryBlock>
  )
}

/** Sort and filter combinations, run live so the ordering is checkable by eye. */
const FEED_VIEWS = [
  { value: FEED_SORT.LATEST, label: 'Latest', params: { sort: FEED_SORT.LATEST } },
  {
    value: FEED_SORT.MOST_REPLIES,
    label: 'Most replies',
    params: { sort: FEED_SORT.MOST_REPLIES },
  },
  { value: FEED_SORT.PRICE_ASC, label: 'Price ↑', params: { sort: FEED_SORT.PRICE_ASC } },
  { value: FEED_SORT.PRICE_DESC, label: 'Price ↓', params: { sort: FEED_SORT.PRICE_DESC } },
  {
    value: 'open',
    label: 'Open deals',
    params: { sort: FEED_SORT.LATEST, filters: { dealStatus: FEED_DEAL_STATUS.OPEN } },
  },
  {
    value: 'closedDelivered',
    label: 'Closed & delivered',
    params: {
      sort: FEED_SORT.LATEST,
      filters: { dealStatus: [FEED_DEAL_STATUS.CLOSED, FEED_DEAL_STATUS.DELIVERED] },
    },
  },
]

function FeedServiceBlock() {
  const [view, setView] = useState(FEED_SORT.LATEST)
  const active = FEED_VIEWS.find((entry) => entry.value === view) ?? FEED_VIEWS[0]

  const feeds = useApiQuery(
    () => feedService.listFeeds({ page: 1, limit: 6, ...active.params }),
    [view]
  )

  return (
    <GalleryBlock
      title="feedService — sorts and deal-status filters"
      caption="Live against the seeded API. Drafts are never returned: the status filter is an explicit set of the five public statuses, so a private brief cannot appear even unfiltered. `closed` is three request statuses (awarded, closed, cancelled) resolved into one status-in-set query, which is what keeps `total` — and pagination — honest."
    >
      <Stack spacing={2}>
        <FilterChipGroup
          options={FEED_VIEWS.map(({ value, label }) => ({ value, label }))}
          value={view}
          onChange={(next) => setView(next ?? FEED_SORT.LATEST)}
          label="Feed view"
          allowClear={false}
          size="sm"
        />

        {feeds.error ? (
          <ErrorState
            title="We can’t reach the API"
            message="Start the mock API with `npm run api`, then retry."
            onRetry={feeds.refetch}
          />
        ) : null}

        {feeds.isLoading ? (
          <Typography variant="body2" color="text.secondary">
            Loading…
          </Typography>
        ) : null}

        {!feeds.isLoading && !feeds.error && feeds.data?.items?.length === 0 ? (
          <EmptyState
            icon="solar:documents-linear"
            title="No feeds match"
            description="Nothing on the board answers this combination."
          />
        ) : null}

        {feeds.data?.items?.length ? (
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {formatNumber(feeds.data.total)} feed{feeds.data.total === 1 ? '' : 's'} match ·
                showing {feeds.data.items.length}
              </Typography>
              <Stack divider={<Divider flexItem />}>
                {feeds.data.items.map((feed) => (
                  <Stack
                    key={feed.id}
                    direction="row"
                    spacing={1.5}
                    alignItems="center"
                    sx={{ py: 1, minWidth: 0 }}
                  >
                    <Chip label={feed.id} size="small" sx={{ fontFamily: 'monospace' }} />
                    <FeedDealChip dealStatus={feed.dealStatus} tooltip={false} />
                    <Typography variant="body2" noWrap sx={{ flexGrow: 1, minWidth: 0 }}>
                      {feed.title}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {formatCurrency(feed.offerPrice, feed.currency, { hideDecimals: true })}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ whiteSpace: 'nowrap' }}
                    >
                      {feed.repliesCount} replies
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        ) : null}
      </Stack>
    </GalleryBlock>
  )
}

/** The demo creator's storefront, and the feed the gallery checks privacy on. */
const DEMO_CREATOR_ID = 'cpr_ava'
const OTHER_CREATOR_ID = 'cpr_liam'
const PRIVACY_FEED_ID = 'req_001'

function ReplyPrivacyBlock() {
  const mine = useApiQuery(() => feedService.getMyReply(PRIVACY_FEED_ID, DEMO_CREATOR_ID), [])
  const theirs = useApiQuery(() => feedService.getMyReply(PRIVACY_FEED_ID, OTHER_CREATOR_ID), [])
  const counts = useApiQuery(() => feedService.countRepliesByFeed([PRIVACY_FEED_ID]), [])

  const total = counts.data?.get(PRIVACY_FEED_ID) ?? 0

  return (
    <GalleryBlock
      title="Replies — the privacy rule"
      caption="Every reply query carries creatorId as a filter, so the provider never returns another creator's thread. Below: the same feed, asked twice. The demo creator gets her conversation; a creator who has not replied gets nothing — not somebody else's."
    >
      <Stack spacing={2}>
        <Alert severity="info" icon={<Icon icon="solar:shield-check-linear" width={20} />}>
          Feed <code>{PRIVACY_FEED_ID}</code> holds {formatNumber(total)} reply threads in total.
          Neither query below can see more than one of them.
        </Alert>

        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              getMyReply({PRIVACY_FEED_ID}, {DEMO_CREATOR_ID})
            </Typography>
            {mine.isLoading ? (
              <Typography variant="body2" color="text.secondary">
                Loading…
              </Typography>
            ) : mine.data ? (
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Chip label={mine.data.id} size="small" sx={{ fontFamily: 'monospace' }} />
                  <Typography variant="caption" color="text.secondary">
                    {mine.data.messages.length} messages
                  </Typography>
                </Stack>
                {mine.data.messages.map((message) => (
                  <Box
                    key={message.id}
                    sx={{
                      p: 1.25,
                      borderRadius: 'var(--bb-radius-md)',
                      bgcolor:
                        message.authorRole === 'creator' ? 'primary.lighter' : 'background.input',
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {message.authorRole}
                    </Typography>
                    <Typography variant="body2">{message.body}</Typography>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No thread — reseed with <code>npm run seed</code>.
              </Typography>
            )}
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              getMyReply({PRIVACY_FEED_ID}, {OTHER_CREATOR_ID})
            </Typography>
            {theirs.isLoading ? (
              <Typography variant="body2" color="text.secondary">
                Loading…
              </Typography>
            ) : theirs.data ? (
              <Alert severity="error">
                A thread came back for a creator who did not write one — the privacy filter is
                broken.
              </Alert>
            ) : (
              <Alert severity="success" icon={<Icon icon="solar:check-circle-linear" width={20} />}>
                <code>null</code> — nothing leaks across storefronts.
              </Alert>
            )}
          </CardContent>
        </Card>
      </Stack>
    </GalleryBlock>
  )
}

function TopCreatorsBlock() {
  const top = useApiQuery(() => creatorMetaService.getTopCreators(4), [])

  return (
    <GalleryBlock
      title="creatorMetaService — top creators"
      caption="Ranked level → rating → deliveries, with each storefront's published work joined in for the V2-05 slider. The ranking is folded client-side because the provider sorts on one field; Laravel does it in one ORDER BY."
    >
      {top.error ? (
        <ErrorState
          title="We can’t reach the API"
          message="Start the mock API with `npm run api`, then retry."
          onRetry={top.refetch}
        />
      ) : null}

      <Stack spacing={1.5}>
        {(top.data ?? []).map((creator, index) => (
          <Card key={creator.id} variant="outlined">
            <CardContent>
              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="h6" component="p" color="text.secondary" sx={{ width: 24 }}>
                  {index + 1}
                </Typography>
                <UserAvatar name={creator.displayName} size="md" />
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="subtitle2">{creator.displayName}</Typography>
                    <CreatorLevelBadge creator={creator} />
                    <OnlineDot online={creator.isOnline} />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {creator.ratingAvg} ★ · {formatNumber(creator.deliveriesCount)} deliveries ·{' '}
                    {formatCurrency(creator.totalEarned, undefined, { hideDecimals: true })} earned ·{' '}
                    {formatNumber(creator.contributionCounts.images)} images ·{' '}
                    {formatNumber(creator.contributionCounts.videos)} videos
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.5} sx={{ ml: 'auto' }}>
                  {creator.portfolioItems.slice(0, 6).map((item) => (
                    <Box
                      key={item.id}
                      component="img"
                      src={item.thumbnailUrl}
                      alt=""
                      loading="lazy"
                      sx={{
                        width: 48,
                        height: 36,
                        objectFit: 'cover',
                        borderRadius: 'var(--bb-radius-sm)',
                        border: 1,
                        borderColor: 'divider',
                      }}
                    />
                  ))}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </GalleryBlock>
  )
}

export default function V2Gallery() {
  return (
    <Stack spacing={{ xs: 6, md: 8 }}>
      <FeedCardBlock />
      <IndicatorsBlock />
      <RoleGateBlock />
      <FeedServiceBlock />
      <ReplyPrivacyBlock />
      <TopCreatorsBlock />
    </Stack>
  )
}
