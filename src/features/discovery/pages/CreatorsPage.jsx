import { useCallback, useMemo, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import PaginationControl from '@/components/data-display/PaginationControl'
import EmptyState from '@/components/feedback/EmptyState'
import ErrorState from '@/components/feedback/ErrorState'
import FilterChipGroup from '@/components/inputs/FilterChipGroup'
import SearchInput from '@/components/inputs/SearchInput'
import SortSelect from '@/components/inputs/SortSelect'
import PageHeader from '@/components/layout/PageHeader'
import StaggerList from '@/components/motion/StaggerList'
import { appConfig } from '@/config/appConfig'
import useApiQuery from '@/hooks/useApiQuery'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import { paths } from '@/routes/paths'
import { categoryService, creatorProfileService } from '@/services'
import { formatNumber } from '@/utils/formatters'

import ActiveFilterChips from '../components/ActiveFilterChips'
import CreatorCard, { CreatorCardSkeleton } from '../components/CreatorCard'
import FilterRail from '../components/FilterRail'
import FilterSheet from '../components/FilterSheet'
import { useDiscoveryParams } from '../hooks/useDiscoveryParams'
import {
  CONTENT_TYPE_OPTIONS,
  CREATOR_PARAM,
  CREATORS_PAGE_SIZE,
  creatorDiscoverySchema,
  SORT_OPTIONS,
  toCreatorSearchParams,
} from '../utils/creatorFilters'

// The creator marketplace — 00 §12's list pattern at full size: PageHeader →
// toolbar → filters + grid → PaginationControl, with every piece of state in
// the query string so a result set is a link somebody can send.
//
// Three requests drive it, and they are deliberately independent: the taxonomy
// (cached for the session by `categoryService`), the page of storefronts, and
// the portfolio thumbnails for whatever that page turned out to contain. The
// grid therefore paints as soon as the storefronts land instead of waiting on
// the slowest thumbnail query.

/** Skeletons while the first page loads — one full grid at the widest layout. */
const SKELETON_COUNT = CREATORS_PAGE_SIZE

/** Desktop filter rail width (§11). */
const RAIL_WIDTH = 280

export default function CreatorsPage() {
  useDocumentTitle('Find creators')

  const [isSheetOpen, setSheetOpen] = useState(false)

  const { data: categories, isLoading: isCategoriesLoading } = useApiQuery(
    () => categoryService.listActive(),
    []
  )

  const categoryList = useMemo(() => (Array.isArray(categories) ? categories : []), [categories])

  // Validates `?category=` against the live taxonomy: a stale or invented id is
  // dropped rather than sent to the API. Until the list arrives the context is
  // empty and nothing is dropped, so a deep link never loses its filter to a
  // race with its own first render.
  const paramContext = useMemo(
    () =>
      categoryList.length > 0
        ? { categoryIds: new Set(categoryList.map((category) => category.id)) }
        : null,
    [categoryList]
  )

  const categoryNames = useMemo(
    () => Object.fromEntries(categoryList.map((category) => [category.id, category.name])),
    [categoryList]
  )

  const { values, setValue, setValues, clearFilters, activeFilterCount, isFiltered } =
    useDiscoveryParams(creatorDiscoverySchema, { context: paramContext, pageKey: CREATOR_PARAM.PAGE })

  const searchParams = useMemo(() => toCreatorSearchParams(values), [values])
  const searchKey = useMemo(() => JSON.stringify(searchParams), [searchParams])

  const {
    data: page,
    isLoading,
    error,
    refetch,
  } = useApiQuery(() => creatorProfileService.search(searchParams), [searchKey])

  const creators = page?.items ?? []
  const total = page?.total ?? 0

  // Second pass over whatever the page returned. Keyed on the ids so it reruns
  // when the page changes but not when an unrelated render happens.
  const creatorIds = creators.map((creator) => creator.id)
  const previewKey = creatorIds.join(',')

  const { data: previews } = useApiQuery(
    () => creatorProfileService.listPortfolioPreviews(creatorIds),
    [previewKey],
    { enabled: creatorIds.length > 0 }
  )

  // "Ready" is asked of the data, not of a loading flag: while a new page is
  // resolving, `previews` still holds the *previous* page's strips, and the
  // effect that starts the next batch runs a frame after those cards render.
  // Checking that every id on screen is accounted for keeps the strips in their
  // skeleton across both gaps instead of collapsing and reflowing the grid.
  const isPreviewReady = creatorIds.every((id) => Boolean(previews) && id in previews)

  const patch = useCallback((changes) => setValues(changes), [setValues])

  const closeSheet = useCallback(() => setSheetOpen(false), [])

  const countLabel = isLoading
    ? 'Searching creators…'
    : `${formatNumber(total)} ${total === 1 ? 'creator' : 'creators'}`

  const renderGrid = () => {
    if (error) {
      return (
        <ErrorState
          title="We could not load creators"
          message="The directory is temporarily unavailable. Your filters are kept in the address bar, so a retry picks up exactly where you were."
          error={error}
          onRetry={refetch}
        />
      )
    }

    if (!isLoading && creators.length === 0) {
      return (
        <EmptyState
          icon="tabler:users-search"
          title="No creators match these filters"
          description="Try removing a filter or widening the price range — or post a content request and let creators come to you."
          primaryAction={
            isFiltered ? { label: 'Clear all filters', onClick: clearFilters } : undefined
          }
          secondaryAction={{ label: 'Post a content request', to: paths.REGISTER }}
        />
      )
    }

    return (
      <StaggerList
        stagger={0.04}
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            lg: 'repeat(3, 1fr)',
            xl: 'repeat(4, 1fr)',
          },
          gap: { xs: 2, md: 2.5 },
        }}
      >
        {isLoading
          ? Array.from({ length: SKELETON_COUNT }, (_, index) => (
              <CreatorCardSkeleton key={`skeleton-${index}`} />
            ))
          : creators.map((creator) => (
              <CreatorCard
                key={creator.id}
                profile={creator}
                categoryNames={categoryNames}
                preview={previews?.[creator.id]}
                isPreviewLoading={!isPreviewReady}
              />
            ))}
      </StaggerList>
    )
  }

  return (
    <Container maxWidth="xl" sx={{ px: { xs: 2, md: 4 }, py: { xs: 4, md: 6 } }}>
      <PageHeader
        title="Find creators"
        subtitle="Browse verified creators who shoot commercial content for businesses — photography, video, and full campaign bundles, with published portfolios and rates up front."
      />

      {/* Toolbar. Sticks under the public top nav so search, sort, and the
          mobile "Filters" affordance stay reachable while the grid scrolls. */}
      <Box
        sx={{
          position: 'sticky',
          top: { xs: appConfig.topNavHeight.xs, md: appConfig.topNavHeight.md },
          zIndex: (theme) => theme.zIndex.appBar - 1,
          bgcolor: 'background.default',
          // Bleeds into the container gutters so cards scroll *under* the
          // toolbar rather than past its edges.
          mx: { xs: -2, md: -4 },
          px: { xs: 2, md: 4 },
          pt: 1,
          pb: 1.5,
          mb: 1,
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="stretch">
          <SearchInput
            value={values[CREATOR_PARAM.SEARCH]}
            onChange={(next) => setValue(CREATOR_PARAM.SEARCH, next)}
            placeholder="Search by name or specialty"
            label="Search creators"
            size="medium"
            sx={{ flexGrow: 1 }}
          />

          <Stack direction="row" spacing={1.5} sx={{ flexShrink: 0 }}>
            <Button
              onClick={() => setSheetOpen(true)}
              variant="outlined"
              size="large"
              startIcon={<Icon icon="tabler:adjustments-horizontal" width={20} />}
              aria-haspopup="dialog"
              sx={{ display: { lg: 'none' }, flexGrow: { xs: 1, sm: 0 } }}
            >
              {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}
            </Button>

            <SortSelect
              value={values[CREATOR_PARAM.SORT]}
              onChange={(next) => setValue(CREATOR_PARAM.SORT, next)}
              options={SORT_OPTIONS}
              size="medium"
              minWidth={{ xs: 0, sm: 210 }}
              sx={{ flexGrow: { xs: 1, sm: 0 } }}
            />
          </Stack>
        </Stack>

        {/* Quick content-type filters, mirroring the rail's chips. Below lg the
            rail is behind the sheet, so the most-used filter stays in reach. */}
        <FilterChipGroup
          multiple
          label="Content type"
          options={CONTENT_TYPE_OPTIONS}
          value={values[CREATOR_PARAM.CONTENT_TYPE]}
          onChange={(next) => setValue(CREATOR_PARAM.CONTENT_TYPE, next)}
          sx={{ display: { lg: 'none' }, mt: 1 }}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: `${RAIL_WIDTH}px minmax(0, 1fr)` },
          gap: { xs: 0, lg: 5 },
          alignItems: 'start',
        }}
      >
        <Box
          component="aside"
          aria-label="Creator filters"
          sx={{
            display: { xs: 'none', lg: 'block' },
            position: 'sticky',
            // Clears the top nav and the sticky toolbar above it.
            top: (theme) => `calc(${appConfig.topNavHeight.md}px + ${theme.spacing(12)})`,
            maxHeight: (theme) => `calc(100vh - ${appConfig.topNavHeight.md}px - ${theme.spacing(14)})`,
            overflowY: 'auto',
            pr: 1,
          }}
        >
          <FilterRail
            values={values}
            onChange={patch}
            categories={categoryList}
            isCategoriesLoading={isCategoriesLoading}
          />
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <ActiveFilterChips
            values={values}
            onChange={patch}
            onClear={clearFilters}
            categoryNames={categoryNames}
            sx={{ mb: 1 }}
          />

          <Typography
            variant="body2"
            color="text.secondary"
            role="status"
            aria-live="polite"
            sx={{ mb: 2 }}
          >
            {countLabel}
          </Typography>

          {renderGrid()}

          {!error && creators.length > 0 ? (
            <PaginationControl
              page={values[CREATOR_PARAM.PAGE]}
              pageSize={CREATORS_PAGE_SIZE}
              total={total}
              onPageChange={(next) => setValues({ [CREATOR_PARAM.PAGE]: next })}
              itemLabel="creators"
              disabled={isLoading}
              hideOnSinglePage
            />
          ) : null}
        </Box>
      </Box>

      <FilterSheet
        open={isSheetOpen}
        onClose={closeSheet}
        values={values}
        onChange={patch}
        onClear={clearFilters}
        isFiltered={isFiltered}
        total={total}
        isLoading={isLoading}
        categories={categoryList}
        isCategoriesLoading={isCategoriesLoading}
      />
    </Container>
  )
}
