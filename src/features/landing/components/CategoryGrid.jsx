import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

import EmptyState from '@/components/feedback/EmptyState'
import CardSkeleton from '@/components/feedback/skeletons/CardSkeleton'
import StaggerList from '@/components/motion/StaggerList'
import { categoryImageUrl } from '@/constants/images'
import { CREATOR_PARAM } from '@/features/discovery/utils/creatorFilters'
import { paths } from '@/routes/paths'

import { cardLiftSx } from '../utils/landingStyles'
import LandingSection from './LandingSection'
import media from './LandingMedia.module.css'

// The marketplace taxonomy, straight from the API (`categoryService.listActive`,
// fetched once by the page and shared with the featured shelf). Nothing here is
// hardcoded: deactivate a category in the admin console and this section loses
// a tile without a code change.

/**
 * Discovery owns its query-param contract (Prompt 12), so the key comes from
 * there rather than being restated here: rename it once and these tiles follow.
 */
const toCategoryLink = (categoryId) =>
  `${paths.CREATORS}?${CREATOR_PARAM.CATEGORY}=${encodeURIComponent(categoryId)}`

/** Placeholder count while loading — one screen's worth on any breakpoint. */
const SKELETON_TILES = 4

const IMAGE_WIDTH = 400
const IMAGE_HEIGHT = 250

function CategoryTile({ category }) {
  return (
    <Card sx={[cardLiftSx, { height: '100%', overflow: 'hidden' }]}>
      <CardActionArea
        component={RouterLink}
        to={toCategoryLink(category.id)}
        sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
      >
        <img
          className={`${media.media} ${media.ratioTile}`}
          src={categoryImageUrl(category.id, IMAGE_WIDTH, IMAGE_HEIGHT)}
          width={IMAGE_WIDTH}
          height={IMAGE_HEIGHT}
          // Decorative: the category name sits right below it (00 §13).
          alt=""
          loading="lazy"
          decoding="async"
        />

        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ p: 2 }}>
          <Box
            aria-hidden="true"
            sx={{
              flexShrink: 0,
              width: 36,
              height: 36,
              borderRadius: 1.5,
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'primary.surface',
              color: 'primary.main',
            }}
          >
            <Icon icon={category.icon ?? 'tabler:category'} width={20} />
          </Box>
          <Typography variant="subtitle2" component="h3" sx={{ minWidth: 0 }}>
            {category.name}
          </Typography>
        </Stack>
      </CardActionArea>
    </Card>
  )
}

/**
 * @param {object} props
 * @param {object[]} [props.categories] active categories from the API
 * @param {boolean} [props.isLoading] the categories request is in flight
 * @param {object} [props.error] the categories request failed
 */
export default function CategoryGrid({ categories, isLoading = false, error = null }) {
  const items = Array.isArray(categories) ? categories : []
  const showFallback = Boolean(error) || (!isLoading && items.length === 0)

  return (
    <LandingSection
      tone="paper"
      eyebrow="Browse by category"
      title="Creators for the content your industry actually needs"
      description="Every category is staffed by creators who shoot commercial work in it — menus, product ranges, classes, properties, launches."
      action={
        <Button
          component={RouterLink}
          to={paths.CREATORS}
          variant="text"
          endIcon={<Icon icon="tabler:arrow-right" width={18} />}
        >
          Browse all creators
        </Button>
      }
    >
      {showFallback ? (
        // Quiet fallback: one section failing never takes the page with it.
        <EmptyState
          dense
          icon="tabler:category"
          title="Categories are not loading right now"
          description="You can still browse the full creator directory and filter it there."
          primaryAction={{ label: 'Browse all creators', to: paths.CREATORS }}
        />
      ) : (
        <StaggerList
          inView
          stagger={0.05}
          sx={{
            display: { xs: 'flex', md: 'grid' },
            gridTemplateColumns: { md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
            gap: 2,
            // Below `md` the grid becomes a full-bleed snap rail: the negative
            // margin lets it run to the screen edges inside a padded Container.
            overflowX: { xs: 'auto', md: 'visible' },
            scrollSnapType: { xs: 'x mandatory', md: 'none' },
            mx: { xs: -2, md: 0 },
            px: { xs: 2, md: 0 },
            pb: { xs: 1, md: 0 },
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
            // StaggerList wraps each child, so the rail sizing belongs here.
            '& > *': {
              flex: { xs: '0 0 74%', md: '1 1 auto' },
              scrollSnapAlign: { xs: 'start', md: 'none' },
            },
          }}
        >
          {isLoading
            ? Array.from({ length: SKELETON_TILES }, (_, index) => (
                <CardSkeleton
                  key={`skeleton-${index}`}
                  lines={0}
                  chips={false}
                  label="Loading category"
                />
              ))
            : items.map((category) => (
                <CategoryTile key={category.id} category={category} />
              ))}
        </StaggerList>
      )}
    </LandingSection>
  )
}
