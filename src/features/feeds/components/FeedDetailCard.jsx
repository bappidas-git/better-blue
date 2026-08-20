import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { visuallyHidden } from '@mui/utils'

import UserAvatar from '@/components/data-display/UserAvatar'
import FeedDealChip from '@/features/feeds/components/FeedDealChip'
import { describeDeadline } from '@/features/requests/utils/requestDisplay'
import { formatCurrency, formatNumber, formatRelativeTime } from '@/utils/formatters'

// One feed, opened — the expanded twin of `FeedCard` (Storefront V2,
// `prompts-v2/08` §1).
//
// Same anatomy as the card in the timeline, and deliberately so: the same
// header, the same tags, the same offer figure, so arriving here from a card
// feels like the card growing rather than a different screen. What changes is
// that **nothing is clamped** — the heading is the page's `h1` and the
// description is rendered in full — and the offer moves out of the footer into
// a glass strip that carries the three numbers a creator decides on.
//
// It renders the feed and nothing else. What a reader may *do* with it lives
// below, in the reply area, which is the only viewer-aware part of the page.

/** The column this page is laid out in (§1: a centred ~760px reading column). */
export const FEED_DETAIL_MAX_WIDTH = 760

/**
 * The description as the buyer wrote it, split into paragraphs.
 *
 * A blank line is a paragraph break and a single newline is a line the buyer
 * chose to end — both survive, because a brief written as three points should
 * not arrive as one block. Empty fragments are dropped so trailing whitespace
 * cannot open a gap.
 *
 * @param {string} [description]
 * @returns {string[]} paragraphs, in order
 */
function toParagraphs(description) {
  return String(description ?? '')
    .split(/\n{2,}|\r\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

/** One figure in the stat strip: a small label over a value. */
function Stat({ icon, label, children, sx }) {
  return (
    <Box sx={{ minWidth: 0, ...sx }}>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: 'text.secondary' }}>
        <Icon icon={icon} width={15} aria-hidden="true" style={{ flexShrink: 0 }} />
        <Typography variant="caption" component="span" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
          {label}
        </Typography>
      </Stack>
      <Box sx={{ mt: 0.5 }}>{children}</Box>
    </Box>
  )
}

/**
 * @param {object} props
 * @param {object} props.feed a feed record with `buyer` and `dealStatus`
 *   attached, as `feedService.getFeed` returns them
 * @param {object|null} [props.buyer] the business summary, when the caller has
 *   it separately from the feed
 * @param {string} props.headingId id for the `h1`, so the page's landmarks and
 *   the reply area can point at it
 */
export default function FeedDetailCard({ feed, buyer, headingId }) {
  const business = buyer ?? feed.buyer ?? null
  const buyerName = business?.companyName ?? business?.name ?? 'A BetterBlue business'
  const postedAt = feed.publishedAt ?? feed.createdAt
  const replies = Number(feed.repliesCount) || 0
  const tags = Array.isArray(feed.tags) ? feed.tags : []
  const paragraphs = toParagraphs(feed.description)
  const deadline = describeDeadline(feed)
  const hasDeadline = Boolean(feed.deadline)

  return (
    <Card component="article" aria-labelledby={headingId}>
      <CardContent sx={{ p: { xs: 2.5, sm: 3 }, '&:last-child': { pb: { xs: 2.5, sm: 3 } } }}>
        {/* --- who posted it, when, and where the deal stands --------------- */}
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
          <UserAvatar name={buyerName} src={business?.logoUrl} size="lg" variant="rounded" />
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }} noWrap>
              {buyerName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Posted <time dateTime={postedAt}>{formatRelativeTime(postedAt)}</time>
            </Typography>
          </Box>
          <FeedDealChip feed={feed} dealStatus={feed.dealStatus} size="md" />
        </Stack>

        {/* --- the brief, in full ------------------------------------------- */}
        <Typography
          id={headingId}
          variant="h4"
          component="h1"
          sx={{ mt: 2.5, fontWeight: 800, letterSpacing: '-0.01em' }}
        >
          {feed.title}
        </Typography>

        <Stack spacing={1.5} sx={{ mt: 2 }}>
          {paragraphs.map((paragraph, index) => (
            <Typography
              // Paragraphs are content, not records: their text is the only
              // identity they have, and index keeps duplicates apart.
              key={`${index}-${paragraph.slice(0, 24)}`}
              variant="body1"
              component="p"
              color="text.secondary"
              sx={{ whiteSpace: 'pre-line' }}
            >
              {paragraph}
            </Typography>
          ))}
        </Stack>

        {tags.length > 0 ? (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 2.5 }}>
            <Box component="span" sx={visuallyHidden}>
              Tags:
            </Box>
            {tags.map((tag) => (
              <Chip key={tag} label={tag} size="small" variant="outlined" sx={{ height: 26 }} />
            ))}
          </Stack>
        ) : null}

        <Divider sx={{ my: 2.5 }} />

        {/* --- the numbers, on the glass strip ------------------------------ */}
        <Box
          className="bb-glass"
          sx={{
            p: { xs: 2, sm: 2.5 },
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: hasDeadline ? 'auto auto 1fr' : 'auto 1fr' },
            gap: { xs: 2, sm: 3 },
            alignItems: 'center',
          }}
        >
          <Stat icon="solar:tag-price-linear" label="Offer">
            <Typography
              // Display size, so `.bb-gradient-text` is on the right side of
              // the rule that keeps it off body copy (docs/theme-v2.md §7).
              className="bb-gradient-text"
              component="p"
              sx={{
                fontSize: { xs: '1.75rem', sm: '2rem' },
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
              }}
            >
              {feed.offerPrice == null
                ? 'On request'
                : formatCurrency(feed.offerPrice, feed.currency, { hideDecimals: true })}
            </Typography>
          </Stat>

          <Stat icon="solar:chat-round-line-linear" label="Replies">
            <Typography component="p" variant="h6" sx={{ fontWeight: 700 }}>
              {formatNumber(replies)}
            </Typography>
          </Stat>

          {hasDeadline ? (
            <Stat icon="solar:calendar-minimalistic-linear" label="Deadline">
              <Typography
                component="p"
                variant="subtitle1"
                sx={{ fontWeight: 600, color: deadline.tone }}
              >
                <Box component="span" sx={visuallyHidden}>
                  {deadline.label}
                </Box>
                <Box component="span" aria-hidden="true">
                  {deadline.date}
                </Box>
              </Typography>
              {deadline.relative ? (
                <Typography variant="caption" color="text.secondary" aria-hidden="true">
                  {deadline.relative}
                </Typography>
              ) : null}
            </Stat>
          ) : null}
        </Box>
      </CardContent>
    </Card>
  )
}
