import { useId } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import Link from '@mui/material/Link'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { visuallyHidden } from '@mui/utils'
import { Link as RouterLink } from 'react-router-dom'

import CreatorLevelBadge from '@/components/data-display/CreatorLevelBadge'
import OnlineDot from '@/components/data-display/OnlineDot'
import RatingStars from '@/components/data-display/RatingStars'
import UserAvatar from '@/components/data-display/UserAvatar'
import WorksSlider, { WorksSliderSkeleton } from '@/components/data-display/WorksSlider'
// The marketing phrasing for a contribution pair — "112+ Images · 67 Videos".
// Imported from the landing feature rather than restated, because this card and
// the Top Creators row it is modelled on print the same figures and must print
// them the same way; a second copy would drift the first time the wording did.
import formatContribution from '@/features/landing/utils/formatContribution'
import { paths } from '@/routes/paths'
import { formatCurrency, formatNumber } from '@/utils/formatters'

// One creator, full width, in the same social style as `FeedCard` — Storefront
// V2 (`prompts-v2/09` §3).
//
// Three zones, in the order a buyer reads them:
//
//   top     who they are — avatar with their presence on it, name, verified,
//           level, tagline, where they are
//   middle  what they have published, as the shared `WorksSlider` strip
//   bottom  how it has gone, and the three things you can do about it
//
// The card renders all three actions for **everybody**, signed in or not, and
// asks the page what each one means (§4, §5). A guest who clicks "Send message"
// meets the role gate; a buyer gets the dialog. Hiding the button instead would
// leave a visitor with no way to find out that the marketplace does this at
// all — which is the opposite of what a public storefront is for.
//
// SECURITY: those decisions are UX (00 §11). `directMessagesService` and the
// affiliate service refuse the same actions on their own, and the Laravel API
// must too.

/** The column the creators page lays out (§1) — wider than the 680px feed card. */
export const CREATOR_CARD_MAX_WIDTH = 760

/** Avatar diameter in the top zone — matches the Top Creators row. */
const AVATAR_SIZE = 72

/** Presence dot drawn on the avatar, and the ring that lifts it off the photo. */
const PRESENCE_SIZE = 12
const PRESENCE_RING = 0.375

/** One labelled figure in the card's stat row. */
function Stat({ icon, children }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
      <Box aria-hidden="true" sx={{ display: 'flex', color: 'primary.main', flexShrink: 0 }}>
        <Icon icon={icon} width={17} />
      </Box>
      <Typography variant="body2" color="text.secondary" noWrap>
        {children}
      </Typography>
    </Stack>
  )
}

/**
 * The avatar with the creator's presence on it.
 *
 * `OnlineDot` rather than `UserAvatar`'s own `status` dot: the pulse is what
 * makes "online now" read at a glance in a scrolling column, and the label it
 * carries is announced even with `showLabel` off, so nothing is lost to anyone
 * reading with a screen reader. The ring is the elevated surface, so the dot
 * sits on the avatar rather than in it.
 */
function AvatarWithPresence({ name, online }) {
  return (
    <Box sx={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <UserAvatar name={name} size={AVATAR_SIZE} />
      {online ? (
        <Box
          sx={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            p: PRESENCE_RING,
            borderRadius: '50%',
            bgcolor: 'background.elevated',
            display: 'inline-flex',
          }}
        >
          <OnlineDot showLabel={false} size={PRESENCE_SIZE} />
        </Box>
      ) : null}
    </Box>
  )
}

/**
 * @param {object} props
 * @param {object} props.creator a storefront from `creatorMetaService.listCreators`
 * @param {(creator: object) => void} props.onSendMessage the Send message
 *   button, for whoever is reading — the page decides what it means
 * @param {(creator: object) => void} props.onPromote the Promote button, same
 */
export default function CreatorSocialCard({ creator, onSendMessage, onPromote }) {
  const titleId = useId()

  const contribution = formatContribution(creator.contributionCounts)
  const deliveries = Number(creator.deliveriesCount) || 0
  const items = Array.isArray(creator.portfolioItems) ? creator.portfolioItems : []
  const profilePath = paths.creatorProfile(creator.id)

  return (
    <Card
      component="article"
      aria-labelledby={titleId}
      sx={{
        width: '100%',
        maxWidth: CREATOR_CARD_MAX_WIDTH,
        mx: 'auto',
        // The same glass the feed column and the Top Creators row carry, so the
        // three social surfaces read as one family (docs/theme-v2.md §6).
        backgroundColor: 'var(--bb-glass-bg)',
        backdropFilter: 'blur(var(--bb-glass-blur))',
        WebkitBackdropFilter: 'blur(var(--bb-glass-blur))',
        '&:hover, &:focus-within': { borderColor: 'primary.main' },
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } } }}>
        {/* --- who they are ------------------------------------------------- */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 1.5, sm: 2.5 }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
        >
          <AvatarWithPresence name={creator.displayName} online={Boolean(creator.isOnline)} />

          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography id={titleId} variant="h6" component="h3" sx={{ fontWeight: 700 }}>
                <Link
                  component={RouterLink}
                  to={profilePath}
                  underline="hover"
                  color="inherit"
                >
                  {creator.displayName}
                </Link>
              </Typography>

              {creator.verified ? (
                <>
                  <Box aria-hidden="true" sx={{ display: 'flex', color: 'primary.main' }}>
                    <Icon icon="tabler:rosette-discount-check-filled" width={18} />
                  </Box>
                  <Box component="span" sx={visuallyHidden}>
                    Verified creator
                  </Box>
                </>
              ) : null}

              <CreatorLevelBadge creator={creator} />
            </Stack>

            {creator.tagline ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                {creator.tagline}
              </Typography>
            ) : null}

            {creator.location ? (
              <Stack
                direction="row"
                spacing={0.5}
                alignItems="center"
                sx={{ mt: 0.75, color: 'text.secondary' }}
              >
                <Icon icon="solar:map-point-linear" width={16} aria-hidden="true" />
                <Typography variant="caption" noWrap>
                  {creator.location}
                </Typography>
              </Stack>
            ) : null}
          </Box>
        </Stack>

        {/* --- what they have published ------------------------------------- */}
        <Box sx={{ mt: 2.5 }}>
          <WorksSlider items={items} creatorName={creator.displayName} />
        </Box>

        <Divider sx={{ my: 2.5 }} />

        {/* --- and how it has gone ------------------------------------------ */}
        <Stack
          direction="row"
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ columnGap: { xs: 1.5, sm: 2.5 }, rowGap: 1 }}
        >
          <RatingStars value={creator.ratingAvg} count={creator.ratingCount} size="sm" />

          <Stat icon="solar:box-minimalistic-linear">
            {formatNumber(deliveries)} {deliveries === 1 ? 'delivery' : 'deliveries'}
          </Stat>

          {contribution ? <Stat icon="solar:gallery-linear">{contribution}</Stat> : null}

          <Stat icon="solar:tag-price-linear">
            From {formatCurrency(creator.startingPrice, creator.currency, { hideDecimals: true })}
          </Stat>
        </Stack>

        {/* --- what you can do about it ------------------------------------- */}
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ mt: 2 }}
        >
          <Button
            component={RouterLink}
            to={profilePath}
            variant="text"
            color="inherit"
            startIcon={<Icon icon="solar:user-linear" width={18} aria-hidden="true" />}
            aria-label={`View ${creator.displayName}'s profile`}
            sx={{ minHeight: 44 }}
          >
            View profile
          </Button>

          <Box sx={{ flexGrow: 1 }} />

          <Button
            variant="gradient"
            onClick={() => onSendMessage?.(creator)}
            startIcon={<Icon icon="solar:letter-linear" width={18} aria-hidden="true" />}
            aria-label={`Send a message to ${creator.displayName}`}
            sx={{ minHeight: 44 }}
          >
            Send message
          </Button>

          {/* An icon button with a real name: the label is what a screen reader
              reads and what the tooltip shows, so the share glyph never has to
              be guessed at (00 §13). */}
          <Tooltip title={`Promote ${creator.displayName}`}>
            <Button
              variant="outlined"
              color="inherit"
              onClick={() => onPromote?.(creator)}
              aria-label={`Promote ${creator.displayName} with your referral link`}
              sx={{ minWidth: 44, minHeight: 44, px: 1.5 }}
            >
              <Icon icon="solar:share-linear" width={20} aria-hidden="true" />
            </Button>
          </Tooltip>
        </Stack>
      </CardContent>
    </Card>
  )
}

/** Same three zones, same heights — the column does not reflow when data lands. */
export function CreatorSocialCardSkeleton() {
  return (
    <Card
      aria-hidden="true"
      sx={{ width: '100%', maxWidth: CREATOR_CARD_MAX_WIDTH, mx: 'auto' }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack direction="row" spacing={2.5} alignItems="center">
          <Skeleton variant="circular" width={AVATAR_SIZE} height={AVATAR_SIZE} />
          <Box sx={{ flexGrow: 1 }}>
            <Skeleton variant="text" width="38%" height={28} />
            <Skeleton variant="text" width="72%" />
            <Skeleton variant="text" width="28%" />
          </Box>
        </Stack>

        <WorksSliderSkeleton count={6} sx={{ mt: 2.5 }} />

        <Divider sx={{ my: 2.5 }} />

        <Stack direction="row" spacing={2.5} alignItems="center">
          <Skeleton variant="text" width={120} />
          <Skeleton variant="text" width={96} />
          <Skeleton variant="text" width={140} />
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
          <Skeleton variant="rounded" width={128} height={44} />
          <Box sx={{ flexGrow: 1 }} />
          <Skeleton variant="rounded" width={160} height={44} />
          <Skeleton variant="rounded" width={44} height={44} />
        </Stack>
      </CardContent>
    </Card>
  )
}
