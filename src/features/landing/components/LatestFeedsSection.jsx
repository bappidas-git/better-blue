import { useCallback, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import { Link as RouterLink, useNavigate } from 'react-router-dom'

import EmptyState from '@/components/feedback/EmptyState'
import RoleGateDialog from '@/components/feedback/RoleGateDialog'
import AmbientGlow from '@/components/motion/AmbientGlow'
import FadeInView from '@/components/motion/FadeInView'
import { ROLES } from '@/constants/roles'
import { useAuth } from '@/context/AuthContext'
import FeedCard, {
  FEED_CARD_MAX_WIDTH,
  FeedCardSkeleton,
} from '@/features/feeds/components/FeedCard'
import useApiQuery from '@/hooks/useApiQuery'
import { paths } from '@/routes/paths'
import { feedService } from '@/services'

import { glowBandSx } from '../utils/landingStyles'
import LandingSection from './LandingSection'

// **Latest feeds** — the newest ten briefs on the board, as a single column of
// the canonical `FeedCard` (V2-05 §2). The home page's social-timeline moment:
// the same card the feeds board and the detail page use, in the same order the
// database returns it, so what a visitor sees here is literally what they get
// when they follow the link.
//
// The card is consumed exactly as V2-03 built it — this section owns *where*
// feeds are shown and *who may reply*, never how a feed is drawn.
//
// Motion is split by element, as everywhere else on this page (00 §7): GSAP
// reveals the section header (`data-landing-reveal`), Framer's `FadeInView`
// staggers the cards. No element carries both.

/** Feeds in the column (V2-05 §2) — the service's own default, spelled out. */
const FEED_LIMIT = 10

/** Placeholder cards while the column is in flight. */
const SKELETON_COUNT = 4

/**
 * Reveal stagger, and the card it stops applying to.
 *
 * A ten-card column is taller than any viewport, so cards past the fold enter
 * one at a time as the visitor scrolls — they are already staggered by the
 * scrolling itself. Uncapped, the tenth card would sit still for half a second
 * after arriving on screen; capping the delay keeps the opening group staggered
 * and lets the rest reveal on arrival.
 */
const STAGGER_STEP = 0.06
const STAGGER_CAP = 3

export default function LatestFeedsSection() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [gateOpen, setGateOpen] = useState(false)

  const { data, isLoading, error } = useApiQuery(() => feedService.getLatestFeeds(FEED_LIMIT), [])

  const feeds = Array.isArray(data) ? data : []
  const isCreator = user?.role === ROLES.CREATOR

  /**
   * Reply, for whoever is reading. A signed-in creator goes to the feed, where
   * the composer lives (V2-08); everybody else — guest, buyer, admin — meets
   * the role gate. The card renders the button either way and asks us what it
   * means, which is why the decision is here rather than inside it.
   *
   * SECURITY: the gate is UX (00 §11). `feedService.createReply` refuses a
   * reply from anyone but a creator on its own, and the Laravel API must too.
   */
  const handleReply = useCallback(
    (feed) => {
      if (isCreator) {
        navigate(paths.feedDetail(feed.id))
        return
      }
      setGateOpen(true)
    },
    [isCreator, navigate]
  )

  // A failed board costs the page this band and nothing else: the sections
  // around it fetch their own data and are unaffected (V2-05 §2).
  if (error) return null

  return (
    <Box sx={{ position: 'relative', overflow: 'hidden' }}>
      {/* Behind the header only, and bounded to it — a glow stretched over a
          full band would sit behind body copy (docs/theme-v2.md §5). */}
      <AmbientGlow placement="center" intensity="subtle" sx={glowBandSx} />

      <LandingSection
        sx={{ position: 'relative' }}
        eyebrow="Live on the board"
        title="Latest feeds"
        description="Every brief here was posted by a business looking for commercial content right now — the deliverables, the offer, and how many creators have already answered."
        headerProps={{ 'data-landing-reveal': true }}
        action={
          <Button
            component={RouterLink}
            to={paths.FEEDS}
            variant="outlined"
            endIcon={<Icon icon="tabler:arrow-right" width={18} />}
          >
            View all feeds
          </Button>
        }
      >
        <Stack
          spacing={2.5}
          alignItems="center"
          sx={{ mx: 'auto', maxWidth: FEED_CARD_MAX_WIDTH }}
        >
          {isLoading
            ? Array.from({ length: SKELETON_COUNT }, (_, index) => (
                <FeedCardSkeleton key={`skeleton-${index}`} />
              ))
            : feeds.map((feed, index) => (
                <FadeInView
                  key={feed.id}
                  delay={Math.min(index, STAGGER_CAP) * STAGGER_STEP}
                  sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}
                >
                  <FeedCard feed={feed} onReply={handleReply} />
                </FadeInView>
              ))}

          {!isLoading && feeds.length === 0 ? (
            <EmptyState
              icon="tabler:layout-list"
              title="No feeds have been posted yet"
              description="Businesses post their content briefs here. Until the first one lands, the creator directory is the way in."
              // The same way out `FeedsPage` offers on an empty board: sending
              // someone to the board itself would only show them this again.
              primaryAction={{ label: 'Browse creators instead', to: paths.CREATORS }}
            />
          ) : null}
        </Stack>
      </LandingSection>

      <RoleGateDialog
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        requiredRole={ROLES.CREATOR}
        action="reply to this feed"
      />
    </Box>
  )
}
