import { useMemo, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import MediaLightbox from '@/components/data-display/MediaLightbox'
import EmptyState from '@/components/feedback/EmptyState'
import ErrorState from '@/components/feedback/ErrorState'
import Section from '@/components/layout/Section'
import { imageUrl, IMAGE_SIZES } from '@/constants/images'
import { CONTENT_TYPE, STATUS_META } from '@/constants/statuses'
import { durations } from '@/theme/motionTokens'

import {
  buildCategoryOptions,
  buildTypeOptions,
  CATEGORY_FILTER_THRESHOLD,
  CONTENT_TYPE_ICONS,
  DEFAULT_PORTFOLIO_FILTER,
  FILTER_ALL,
  filterPortfolioItems,
} from '../utils/portfolioFilters'
import PortfolioFilterBar from './PortfolioFilterBar'

// The published work, as a grid that scans quickly and opens into the viewer.
//
// Two rules hold the section together: every tile reserves its box with an
// aspect ratio before the photograph arrives (nothing reflows mid-load), and the
// lightbox is handed *the filtered set*, so paging through it never wanders into
// work the visitor just filtered out.

/** Tiles rendered while the published set is in flight. */
const SKELETON_COUNT = 8

/** Every tile is a 4:3 box, whatever the image turns out to be. */
const TILE_RATIO = '4 / 3'

/** 2 columns at 360px, 3 from 600px, 4 from 1200px — gaps stay at 8–12px. */
const gridSx = {
  display: 'grid',
  gridTemplateColumns: {
    xs: 'repeat(2, minmax(0, 1fr))',
    sm: 'repeat(3, minmax(0, 1fr))',
    lg: 'repeat(4, minmax(0, 1fr))',
  },
  gap: { xs: 1, md: 1.5 },
}

const THUMB = IMAGE_SIZES.thumbnail

/**
 * MOCK-MEDIA: seeded portfolio media is placeholder photography for every item,
 * video ones included — there is no video file behind a `mediaType: 'video'`
 * record (contract §5.2). Feeding that URL to the viewer's `<video>` branch
 * would render an empty player, so items open as stills and the tile's play
 * badge carries the "this is a film" signal instead. Real uploads land in
 * Prompt 20; this is the line that changes.
 */
const LIGHTBOX_MEDIA_TYPE = 'image'

/** Everything the viewer says about an item beneath the media. */
function toCaption(item, categoryNames) {
  const parts = [item.description]

  const category = categoryNames[item.categoryId]
  if (category) parts.push(`Category: ${category}`)
  if (item.tags?.length) parts.push(`Tags: ${item.tags.join(', ')}`)

  return parts.filter(Boolean).join(' · ')
}

/** What a screen reader hears instead of the tile's picture and hover overlay. */
function tileLabel(item) {
  const type = STATUS_META[item.contentType]?.label ?? item.contentType
  return `${item.title}, ${type}. Open in viewer.`
}

function GalleryTile({ item, onOpen }) {
  const isVideo = item.contentType === CONTENT_TYPE.VIDEO

  return (
    <ButtonBase
      onClick={onOpen}
      aria-label={tileLabel(item)}
      aria-haspopup="dialog"
      sx={{
        position: 'relative',
        width: '100%',
        aspectRatio: TILE_RATIO,
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: 'primary.surface',
        display: 'block',
        '&:hover .portfolio-tile__overlay, &.Mui-focusVisible .portfolio-tile__overlay': {
          opacity: 1,
        },
        '&:hover .portfolio-tile__media': { transform: 'scale(1.04)' },
        '@media (prefers-reduced-motion: reduce)': {
          '&:hover .portfolio-tile__media': { transform: 'none' },
        },
      }}
    >
      <Box
        component="img"
        className="portfolio-tile__media"
        src={item.thumbnailUrl || imageUrl(item.id, THUMB.width, THUMB.height)}
        alt=""
        loading="lazy"
        decoding="async"
        sx={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          transition: (theme) =>
            theme.transitions.create('transform', { duration: durations.base }),
        }}
      />

      {isVideo ? (
        <Box
          aria-hidden="true"
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 0.75,
            py: 0.25,
            borderRadius: 1,
            bgcolor: (theme) => alpha(theme.palette.common.black, 0.6),
            color: 'common.white',
          }}
        >
          <Icon icon="tabler:player-play-filled" width={13} />
          <Typography variant="caption" component="span" sx={{ fontWeight: 600 }}>
            {STATUS_META[CONTENT_TYPE.VIDEO]?.label}
          </Typography>
        </Box>
      ) : null}

      {/* Decorative: the button's accessible name already carries all of it. */}
      <Box
        className="portfolio-tile__overlay"
        aria-hidden="true"
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'flex-end',
          gap: 0.75,
          p: 1.25,
          textAlign: 'left',
          color: 'common.white',
          opacity: 0,
          transition: (theme) => theme.transitions.create('opacity', { duration: durations.fast }),
          backgroundImage: (theme) =>
            `linear-gradient(to top, ${alpha(theme.palette.common.black, 0.78)} 0%, ${alpha(
              theme.palette.common.black,
              0
            )} 62%)`,
        }}
      >
        <Box sx={{ display: 'flex', flexShrink: 0, pb: 0.25 }}>
          <Icon icon={CONTENT_TYPE_ICONS[item.contentType] ?? 'tabler:photo'} width={16} />
        </Box>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
            overflow: 'hidden',
          }}
        >
          {item.title}
        </Typography>
      </Box>
    </ButtonBase>
  )
}

/**
 * @param {object} props
 * @param {object[]} [props.items] published portfolio items, newest first
 * @param {Object<string, string>} [props.categoryNames] category id → display name
 * @param {string} props.creatorName used in the empty-state copy
 * @param {boolean} [props.isLoading=false] the published set is in flight
 * @param {object} [props.error] an `ApiError` from the portfolio request
 * @param {() => void} [props.onRetry] retry handler for that failure
 */
export default function PortfolioGallery({
  items,
  categoryNames = {},
  creatorName,
  isLoading = false,
  error,
  onRetry,
}) {
  const [filter, setFilter] = useState(DEFAULT_PORTFOLIO_FILTER)
  const [openIndex, setOpenIndex] = useState(null)

  const published = useMemo(() => items ?? [], [items])

  const typeOptions = useMemo(() => buildTypeOptions(published), [published])

  // The type filter narrows first, so the category counts describe the grid the
  // visitor is actually looking at.
  const typeFiltered = useMemo(
    () => filterPortfolioItems(published, { type: filter.type, category: FILTER_ALL }),
    [published, filter.type]
  )

  const categoryOptions = useMemo(
    () =>
      published.length > CATEGORY_FILTER_THRESHOLD
        ? buildCategoryOptions(typeFiltered, categoryNames)
        : [],
    [published.length, typeFiltered, categoryNames]
  )

  const visible = useMemo(
    () => filterPortfolioItems(typeFiltered, { category: filter.category }),
    [typeFiltered, filter.category]
  )

  const lightboxItems = useMemo(
    () =>
      visible.map((item) => ({
        id: item.id,
        type: LIGHTBOX_MEDIA_TYPE,
        src: item.mediaUrl || imageUrl(item.id, IMAGE_SIZES.wide.width, IMAGE_SIZES.wide.height),
        alt: item.title,
        caption: toCaption(item, categoryNames),
      })),
    [visible, categoryNames]
  )

  const changeFilter = (next) => {
    setFilter(next)
    // The open set is about to change under the viewer; close it rather than
    // leaving it pointing at an item that is no longer in the gallery.
    setOpenIndex(null)
  }

  const renderBody = () => {
    if (error) {
      return (
        <ErrorState
          dense
          title="We could not load this portfolio"
          message="The rest of the profile is fine — this section alone failed to load."
          error={error}
          onRetry={onRetry}
        />
      )
    }

    if (isLoading) {
      return (
        <Box sx={gridSx} aria-busy="true" aria-label="Loading portfolio" role="status">
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <Skeleton
              key={index}
              variant="rounded"
              sx={{ width: '100%', height: 'auto', aspectRatio: TILE_RATIO, borderRadius: 2 }}
            />
          ))}
        </Box>
      )
    }

    if (published.length === 0) {
      return (
        <EmptyState
          dense
          icon="tabler:camera-plus"
          title="Portfolio coming soon"
          description={`${creatorName} has not published sample work yet. Their rating and completed orders are still the record of what they deliver.`}
        />
      )
    }

    return (
      <>
        <PortfolioFilterBar
          value={filter}
          onChange={changeFilter}
          typeOptions={typeOptions}
          categoryOptions={categoryOptions}
        />

        <Box sx={gridSx}>
          {visible.map((item, index) => (
            <GalleryTile key={item.id} item={item} onOpen={() => setOpenIndex(index)} />
          ))}
        </Box>
      </>
    )
  }

  const activeTitle = openIndex === null ? undefined : visible[openIndex]?.title

  return (
    <Section
      title="Portfolio"
      description={
        published.length > 0
          ? 'Published sample work. Open any piece for the full brief, category, and tags.'
          : undefined
      }
      spacing="md"
    >
      {renderBody()}

      <MediaLightbox
        open={openIndex !== null}
        items={lightboxItems}
        index={openIndex ?? 0}
        onIndexChange={setOpenIndex}
        onClose={() => setOpenIndex(null)}
        title={activeTitle ?? 'Portfolio item'}
      />
    </Section>
  )
}
