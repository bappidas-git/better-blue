import { useId } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Link from '@mui/material/Link'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { visuallyHidden } from '@mui/utils'
import { Link as RouterLink } from 'react-router-dom'

import UserAvatar from '@/components/data-display/UserAvatar'
import FeedDealChip from '@/features/feeds/components/FeedDealChip'
import { paths } from '@/routes/paths'
import { formatCurrency, formatNumber, formatRelativeTime } from '@/utils/formatters'

// **The** feed card (Storefront V2, prompts-v2/03 §5) — one per row on the
// home strip, the feeds board, and anywhere else a feed is listed. There is one
// implementation on purpose: V2-05 and V2-07 both render it and are told not to
// fork it, so a change to the card is a change everywhere it appears.
//
// The whole card is clickable without being a link: the heading is the link and
// stretches its hit area with the `::after` trick, so the footer buttons stay
// separately reachable and the card is one tab stop plus its controls rather
// than a link wrapping two buttons. That is the same pattern
// `RequestBoardCard` uses, kept for consistency with the dashboard board.

/** Tags drawn before the row collapses into a "+n" chip. */
const TAGS_SHOWN = 5

/** The column a feed timeline is laid out in (V2-05 §2, V2-07 §1). */
export const FEED_CARD_MAX_WIDTH = 680

/** Clamps text to `lines` and hides the overflow — no JS measurement. */
const clamp = (lines) => ({
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
})

/**
 * @param {object} props
 * @param {object} props.feed a feed record — a `contentRequests` row carrying
 *   `tags`, `offerPrice`, and `repliesCount`, optionally with the `buyer`
 *   summary and derived `dealStatus` that `feedService` attaches
 * @param {(feed: object) => void} [props.onReply] the Reply button. Rendered
 *   whoever is looking: a signed-in creator is taken to the composer, and
 *   everyone else meets `RoleGateDialog` — which is the caller's decision, not
 *   the card's. Omit it and the button is not drawn at all.
 * @param {string} [props.detailTo] where the heading and Details point;
 *   defaults to this feed's public page
 * @param {boolean} [props.disableReply=false] draw the Reply button disabled —
 *   for a feed the viewer has already replied to
 */
export default function FeedCard({
  feed,
  onReply,
  detailTo,
  disableReply = false,
  sx,
  ...rest
}) {
  const titleId = useId()

  const to = detailTo ?? paths.feedDetail(feed.id)
  const buyerName = feed.buyer?.companyName ?? feed.buyer?.name ?? 'A BetterBlue business'
  const postedAt = feed.publishedAt ?? feed.createdAt
  const replies = Number(feed.repliesCount) || 0
  const tags = Array.isArray(feed.tags) ? feed.tags : []
  const shownTags = tags.slice(0, TAGS_SHOWN)
  const surplusTags = tags.length - shownTags.length

  return (
    <Card
      component="article"
      aria-labelledby={titleId}
      sx={{
        position: 'relative',
        width: '100%',
        maxWidth: FEED_CARD_MAX_WIDTH,
        // Glass over whatever the page puts behind it (an AmbientGlow, the
        // scrolling board). Over a flat surface it degrades to the 4% wash the
        // theme's card edge already is — still correct, just quieter
        // (docs/theme-v2.md §6).
        backgroundColor: 'var(--bb-glass-bg)',
        backdropFilter: 'blur(var(--bb-glass-blur))',
        WebkitBackdropFilter: 'blur(var(--bb-glass-blur))',
        transition: (theme) =>
          theme.transitions.create(['transform', 'box-shadow', 'border-color'], {
            duration: 200,
          }),
        '&:hover, &:focus-within': {
          transform: 'translateY(-3px)',
          boxShadow: (theme) => theme.customShadows.cardHover,
          borderColor: 'primary.main',
        },
        // Reduced motion keeps the glow and drops the movement, exactly as the
        // theme's own card rule does (docs/theme-v2.md §7).
        '@media (prefers-reduced-motion: reduce)': {
          '&:hover, &:focus-within': { transform: 'none' },
        },
        ...sx,
      }}
      {...rest}
    >
      <CardContent
        sx={{
          p: { xs: 2, sm: 2.5 },
          '&:last-child': { pb: { xs: 2, sm: 2.5 } },
        }}
      >
        {/* --- who posted it, when, and where the deal stands --------------- */}
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
          <UserAvatar
            name={buyerName}
            src={feed.buyer?.logoUrl}
            size="md"
            variant="rounded"
          />
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="subtitle2" noWrap sx={{ color: 'text.primary' }}>
              {buyerName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Posted <time dateTime={postedAt}>{formatRelativeTime(postedAt)}</time>
            </Typography>
          </Box>
          <FeedDealChip feed={feed} dealStatus={feed.dealStatus} />
        </Stack>

        {/* --- the brief itself --------------------------------------------- */}
        <Typography
          id={titleId}
          variant="h6"
          component="h3"
          sx={{ mt: 2, fontWeight: 700, ...clamp(2) }}
        >
          <Link
            component={RouterLink}
            to={to}
            underline="hover"
            color="inherit"
            // Stretches the heading's hit area across the whole card. `z-index`
            // stays at 0 so the positioned controls below still sit on top.
            sx={{ '&::after': { content: '""', position: 'absolute', inset: 0, zIndex: 0 } }}
          >
            {feed.title}
          </Link>
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, ...clamp(3) }}>
          {feed.description}
        </Typography>

        {shownTags.length > 0 ? (
          <Stack
            direction="row"
            spacing={0.75}
            flexWrap="wrap"
            useFlexGap
            sx={{ mt: 1.75 }}
          >
            <Box component="span" sx={visuallyHidden}>
              Tags:
            </Box>
            {shownTags.map((tag) => (
              <Chip key={tag} label={tag} size="small" variant="outlined" sx={{ height: 24 }} />
            ))}
            {surplusTags > 0 ? (
              <Chip
                label={`+${surplusTags}`}
                size="small"
                variant="outlined"
                aria-label={`${surplusTags} more tag${surplusTags === 1 ? '' : 's'}`}
                sx={{ height: 24, color: 'text.secondary' }}
              />
            ) : null}
          </Stack>
        ) : null}

        <Divider sx={{ my: 2 }} />

        {/* --- the offer, the interest, and the two ways in ------------------ */}
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ position: 'relative', zIndex: 1 }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              // `.bb-gradient-text` is display-only (docs/theme-v2.md §7), so
              // the price is sized at 24px+ rather than dropped into body copy.
              className="bb-gradient-text"
              component="p"
              sx={{
                fontSize: { xs: '1.5rem', sm: '1.625rem' },
                fontWeight: 800,
                lineHeight: 1.15,
                letterSpacing: '-0.01em',
              }}
            >
              <Box component="span" sx={visuallyHidden}>
                Offer:{' '}
              </Box>
              {/* Whole dollars, as every other budget figure on a card reads
                  (`formatBudget`) — cents on a headline offer are noise. */}
              {feed.offerPrice == null
                ? 'Budget on request'
                : formatCurrency(feed.offerPrice, feed.currency, { hideDecimals: true })}
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.25 }}>
              <Icon
                icon="solar:chat-round-line-linear"
                width={15}
                aria-hidden="true"
                style={{ flexShrink: 0, color: 'currentColor' }}
              />
              <Typography variant="caption" color="text.secondary">
                {formatNumber(replies)} {replies === 1 ? 'Reply' : 'Replies'}
              </Typography>
            </Stack>
          </Box>

          <Stack direction="row" spacing={1} sx={{ ml: 'auto', flexShrink: 0 }}>
            <Button
              component={RouterLink}
              to={to}
              size="small"
              variant="text"
              // The card already links here; naming the feed keeps a screen
              // reader's list of "Details" links apart from one another.
              aria-label={`Details of “${feed.title}”`}
            >
              Details
            </Button>
            {onReply ? (
              <Button
                size="small"
                variant="gradient"
                disabled={disableReply}
                onClick={() => onReply(feed)}
                aria-label={`Reply to “${feed.title}”`}
              >
                Reply
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}

/** Matching placeholder, so a loading timeline does not reflow when it fills. */
export function FeedCardSkeleton() {
  return (
    <Card aria-hidden="true" sx={{ width: '100%', maxWidth: FEED_CARD_MAX_WIDTH }}>
      <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Skeleton variant="rounded" width={40} height={40} />
          <Box sx={{ flexGrow: 1 }}>
            <Skeleton variant="text" width="42%" />
            <Skeleton variant="text" width="26%" height={14} />
          </Box>
          <Skeleton variant="rounded" width={72} height={24} />
        </Stack>
        <Skeleton variant="text" width="88%" height={26} sx={{ mt: 2 }} />
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="94%" />
        <Skeleton variant="text" width="64%" />
        <Stack direction="row" spacing={0.75} sx={{ mt: 1.75 }}>
          <Skeleton variant="rounded" width={84} height={24} />
          <Skeleton variant="rounded" width={68} height={24} />
          <Skeleton variant="rounded" width={92} height={24} />
        </Stack>
        <Divider sx={{ my: 2 }} />
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box>
            <Skeleton variant="text" width={104} height={32} />
            <Skeleton variant="text" width={68} height={14} />
          </Box>
          <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
            <Skeleton variant="rounded" width={72} height={32} />
            <Skeleton variant="rounded" width={72} height={32} />
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}
