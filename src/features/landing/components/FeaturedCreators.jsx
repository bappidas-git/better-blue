import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { visuallyHidden } from '@mui/utils'
import { Link as RouterLink } from 'react-router-dom'

import RatingStars from '@/components/data-display/RatingStars'
import UserAvatar from '@/components/data-display/UserAvatar'
import EmptyState from '@/components/feedback/EmptyState'
import CardSkeleton from '@/components/feedback/skeletons/CardSkeleton'
import { imageUrl } from '@/constants/images'
import useApiQuery from '@/hooks/useApiQuery'
import { paths } from '@/routes/paths'
import { creatorProfileService } from '@/services'
import { formatCurrency } from '@/utils/formatters'

import { cardLiftSx } from '../utils/landingStyles'
import LandingSection from './LandingSection'
import media from './LandingMedia.module.css'

// The editorial shelf — storefronts an admin has flagged `featured` (contract
// §6.4), best-rated first. Entirely API-driven: flip the flag in the database
// and the shelf changes on the next load.
//
// V2-04 removed the category chips from these cards: categories no longer
// appear anywhere in the storefront, so the tile now carries the storefront's
// own signals — rating and starting price — and nothing borrowed from the
// taxonomy. V2-05 restyles the section itself.

const FEATURED_LIMIT = 6

const COVER_WIDTH = 640
const COVER_HEIGHT = 360

function CreatorCard({ profile }) {
  return (
    <Card sx={[cardLiftSx, { height: '100%' }]}>
      {/* One link for the whole card: a single tab stop, and the announced name
          is the creator plus everything else in the tile. */}
      <CardActionArea
        component={RouterLink}
        to={paths.creatorProfile(profile.id)}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          justifyContent: 'flex-start',
        }}
      >
        <img
          className={`${media.media} ${media.ratioWide}`}
          src={imageUrl(profile.id, COVER_WIDTH, COVER_HEIGHT)}
          width={COVER_WIDTH}
          height={COVER_HEIGHT}
          alt=""
          loading="lazy"
          decoding="async"
        />

        <Stack spacing={1.5} sx={{ p: 2.5, pt: 0, width: '100%' }}>
          <UserAvatar
            name={profile.displayName}
            size="lg"
            sx={{ mt: -3.5, border: 3, borderColor: 'background.paper' }}
          />

          <Box>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography variant="h6" component="h3" noWrap>
                {profile.displayName}
              </Typography>
              {profile.verified ? (
                <>
                  <Box aria-hidden="true" sx={{ display: 'flex', color: 'primary.main' }}>
                    <Icon icon="tabler:rosette-discount-check-filled" width={18} />
                  </Box>
                  <Box component="span" sx={visuallyHidden}>
                    Verified creator
                  </Box>
                </>
              ) : null}
            </Stack>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 0.5,
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 2,
                overflow: 'hidden',
              }}
            >
              {profile.tagline}
            </Typography>
          </Box>

          <RatingStars value={profile.ratingAvg} count={profile.ratingCount} size="sm" />

          <Typography variant="body2" color="text.secondary" sx={{ mt: 'auto' }}>
            From{' '}
            <Box component="span" sx={{ color: 'text.primary', fontWeight: 700 }}>
              {formatCurrency(profile.startingPrice, profile.currency, { hideDecimals: true })}
            </Box>
          </Typography>
        </Stack>
      </CardActionArea>
    </Card>
  )
}

export default function FeaturedCreators() {
  const { data, isLoading, error } = useApiQuery(
    () => creatorProfileService.listFeatured(FEATURED_LIMIT),
    []
  )

  const profiles = Array.isArray(data) ? data : []
  const showFallback = Boolean(error) || (!isLoading && profiles.length === 0)

  return (
    <LandingSection
      eyebrow="Featured creators"
      title="Professionals who shoot for businesses every week"
      description="Verified storefronts with published portfolios, agreed turnaround times, and a rating earned on completed orders."
      headerProps={{ 'data-landing-reveal': true }}
      action={
        <Button
          component={RouterLink}
          to={paths.CREATORS}
          variant="outlined"
          endIcon={<Icon icon="tabler:arrow-right" width={18} />}
        >
          See all creators
        </Button>
      }
    >
      {showFallback ? (
        <EmptyState
          dense
          icon="tabler:users-group"
          title="Featured creators are not loading right now"
          description="The full creator directory is still available, with the same filters and profiles."
          primaryAction={{ label: 'Browse all creators', to: paths.CREATORS }}
        />
      ) : (
        <Box
          data-landing-reveal
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
            },
            gap: 3,
          }}
        >
          {isLoading
            ? Array.from({ length: 3 }, (_, index) => (
                <CardSkeleton key={`skeleton-${index}`} lines={2} label="Loading creator" />
              ))
            : profiles.map((profile) => (
                <CreatorCard key={profile.id} profile={profile} />
              ))}
        </Box>
      )}
    </LandingSection>
  )
}
