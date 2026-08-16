import { useCallback, useMemo, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import { visuallyHidden } from '@mui/utils'
import PaginationControl from '@/components/data-display/PaginationControl'
import EmptyState from '@/components/feedback/EmptyState'
import ErrorState from '@/components/feedback/ErrorState'
import FilterChipGroup from '@/components/inputs/FilterChipGroup'
import SearchInput from '@/components/inputs/SearchInput'
import SortSelect from '@/components/inputs/SortSelect'
import SideSheet from '@/components/layout/SideSheet'
import StaggerList from '@/components/motion/StaggerList'
import { appConfig } from '@/config/appConfig'
import useApiQuery from '@/hooks/useApiQuery'
import useListParams from '@/hooks/useListParams'
import { categoryService } from '@/services/categoryService'
import { requestService } from '@/services/requestService'
import { formatNumber } from '@/utils/formatters'

import {
  BOARD_PAGE_SIZE,
  BOARD_PARAM,
  BOARD_SCOPE,
  boardSchema,
  CONTENT_TYPE_OPTIONS,
  isInvitedTo,
  SORT_OPTIONS,
  toBoardListParams,
} from '../utils/boardFilters'
import BoardFilters, { ActiveBoardFilters } from './BoardFilters'
import RequestBoardCard, { RequestBoardCardSkeleton } from './RequestBoardCard'

// The request board itself — 00 §12's list pattern at full size, and the one
// implementation behind **both** places it appears: the public `/requests` page
// and the creator's `/creator/browse` view. Only the chrome around it and the
// defaults it starts from differ (§7).
//
// Two requests drive it, deliberately independent: the taxonomy (cached for the
// session by `categoryService`) and the page of briefs. The grid paints as soon
// as the briefs land rather than waiting on the category list.

/** Desktop filter rail width (§11). */
const RAIL_WIDTH = 280

/** Skeletons while a page loads — one full grid at the widest layout. */
const SKELETON_COUNT = BOARD_PAGE_SIZE

/**
 * @param {object} props
 * @param {'public'|'dashboard'} [props.variant='public'] which shell it sits in —
 *   only the sticky toolbar offset depends on it
 * @param {string} [props.creatorProfileId] the viewing creator's `cpr_…`, which
 *   is what makes the "Invited" badge and the invitations filter mean anything
 * @param {string[]} [props.defaultCategoryIds] the creator's own categories,
 *   applied while the scope is "My categories" and nothing is picked by hand
 * @param {boolean} [props.showScopeToggle=false] render the My/All categories chips
 * @param {boolean} [props.showInvitedFilter=false] render the invitations switch —
 *   pass `true` only when this creator actually has an invitation
 * @param {Map<string, string>} [props.proposalStatusByRequest] `req_…` → the
 *   `PROPOSAL_STATUS` of this creator's own offer on it, so answered briefs say so
 * @param {object} [props.emptyAction] `{ label, to }` for the unfiltered empty state
 */
export default function RequestBoard({
  variant = 'public',
  creatorProfileId,
  defaultCategoryIds,
  showScopeToggle = false,
  showInvitedFilter = false,
  proposalStatusByRequest,
  emptyAction,
}) {
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

  const { values, setValue, setValues, clearFilters, activeFilterCount, isFiltered } = useListParams(
    boardSchema,
    { context: paramContext, pageKey: BOARD_PARAM.PAGE }
  )

  const listParams = useMemo(
    () => toBoardListParams(values, { invitedCreatorId: creatorProfileId, defaultCategoryIds }),
    [values, creatorProfileId, defaultCategoryIds]
  )
  const listKey = useMemo(() => JSON.stringify(listParams), [listParams])

  const {
    data: page,
    isLoading,
    error,
    refetch,
  } = useApiQuery(() => requestService.listBoard(listParams), [listKey])

  const requests = page?.items ?? []
  const total = page?.total ?? 0

  const patch = useCallback((changes) => setValues(changes), [setValues])
  const closeSheet = useCallback(() => setSheetOpen(false), [])

  const isScopedToMine = values[BOARD_PARAM.SCOPE] === BOARD_SCOPE.MINE
  const countLabel = isLoading
    ? 'Finding open requests…'
    : `${formatNumber(total)} open ${total === 1 ? 'request' : 'requests'}`

  const renderGrid = () => {
    if (error) {
      return (
        <ErrorState
          title="We could not load the request board"
          message="The board is temporarily unavailable. Your filters are kept in the address bar, so a retry picks up exactly where you were."
          error={error}
          onRetry={refetch}
        />
      )
    }

    if (!isLoading && requests.length === 0) {
      return (
        <EmptyState
          icon="solar:clipboard-list-linear"
          title={
            isFiltered || (isScopedToMine && defaultCategoryIds?.length)
              ? 'No open requests match these filters'
              : 'No open requests right now'
          }
          description={
            isFiltered || (isScopedToMine && defaultCategoryIds?.length)
              ? 'Try widening the budget, clearing a category, or looking further out than this deadline window.'
              : 'Businesses post new briefs every week. Check back soon — or make sure your profile is easy to find in the meantime.'
          }
          primaryAction={
            isFiltered ? { label: 'Clear all filters', onClick: clearFilters } : emptyAction
          }
        />
      )
    }

    // A plain grid rather than a `ul`, the same shape Prompt 12's creator grid
    // uses: `StaggerList` wraps every child in its own animated element, so a
    // list element here would put a `div` between the `ul` and its `li`s —
    // invalid markup, and the cards would stop being the grid items.
    return (
      <StaggerList
        stagger={0.04}
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' },
          gap: { xs: 2, md: 2.5 },
        }}
      >
        {isLoading
          ? Array.from({ length: SKELETON_COUNT }, (_, index) => (
              <RequestBoardCardSkeleton key={`skeleton-${index}`} />
            ))
          : requests.map((request) => (
              <RequestBoardCard
                key={request.id}
                request={request}
                categoryLabel={categoryNames[request.categoryId]}
                isInvited={isInvitedTo(request, creatorProfileId)}
                proposalStatus={proposalStatusByRequest?.get(request.id)}
              />
            ))}
      </StaggerList>
    )
  }

  return (
    <>
      {/* Toolbar. On the public board it sticks under the top nav so search,
          sort, and the mobile "Filters" affordance stay reachable while the
          grid scrolls; inside the dashboard the shell already has a sticky
          top bar and a second one would eat the phone's viewport. */}
      <Box
        sx={{
          ...(variant === 'public'
            ? {
                position: 'sticky',
                top: { xs: appConfig.topNavHeight.xs, md: appConfig.topNavHeight.md },
                zIndex: (theme) => theme.zIndex.appBar - 1,
                bgcolor: 'background.default',
                // Bleeds into the container gutters so cards scroll *under* the
                // toolbar rather than past its edges.
                mx: { xs: -2, md: -4 },
                px: { xs: 2, md: 4 },
              }
            : null),
          pt: 1,
          pb: 1.5,
          mb: 1,
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="stretch">
          <SearchInput
            value={values[BOARD_PARAM.SEARCH]}
            onChange={(next) => setValue(BOARD_PARAM.SEARCH, next)}
            placeholder="Search briefs by title or description"
            label="Search open requests"
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
              value={values[BOARD_PARAM.SORT]}
              onChange={(next) => setValue(BOARD_PARAM.SORT, next)}
              options={SORT_OPTIONS}
              size="medium"
              minWidth={{ xs: 0, sm: 210 }}
              sx={{ flexGrow: { xs: 1, sm: 0 } }}
            />
          </Stack>
        </Stack>

        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ mt: 1 }}
        >
          {showScopeToggle ? (
            <FilterChipGroup
              label="Which requests"
              allowClear={false}
              options={[
                { value: BOARD_SCOPE.MINE, label: 'My categories', icon: 'tabler:target-arrow' },
                { value: BOARD_SCOPE.ALL, label: 'All categories', icon: 'tabler:world' },
              ]}
              value={values[BOARD_PARAM.SCOPE]}
              onChange={(next) => setValue(BOARD_PARAM.SCOPE, next ?? BOARD_SCOPE.MINE)}
              sx={{ flexWrap: 'wrap', overflowX: 'visible' }}
            />
          ) : null}

          {/* Quick content-type filters, mirroring the rail's chips. Below lg
              the rail is behind the sheet, so the most-used filter stays in
              reach without opening it. */}
          <FilterChipGroup
            multiple
            label="Content type"
            options={CONTENT_TYPE_OPTIONS}
            value={values[BOARD_PARAM.CONTENT_TYPE]}
            onChange={(next) => setValue(BOARD_PARAM.CONTENT_TYPE, next)}
            sx={{ display: { lg: 'none' }, flexWrap: 'wrap', overflowX: 'visible' }}
          />
        </Stack>
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
          aria-label="Request filters"
          sx={{
            display: { xs: 'none', lg: 'block' },
            position: 'sticky',
            top: (theme) =>
              variant === 'public'
                ? `calc(${appConfig.topNavHeight.md}px + ${theme.spacing(12)})`
                : theme.spacing(2),
            maxHeight: (theme) => `calc(100vh - ${theme.spacing(16)})`,
            overflowY: 'auto',
            pr: 1,
          }}
        >
          <BoardFilters
            values={values}
            onChange={patch}
            categories={categoryList}
            isCategoriesLoading={isCategoriesLoading}
            showInvited={showInvitedFilter}
          />
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <ActiveBoardFilters
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

          {/* Names the results region in the outline, so the page reads
              h1 → h2 → the card's own h3 rather than skipping a level
              (00 §13). Visually hidden: the count line above already says
              this to anyone who can see it. */}
          <Typography component="h2" sx={visuallyHidden}>
            Open requests
          </Typography>

          {renderGrid()}

          {!error && requests.length > 0 ? (
            <PaginationControl
              page={values[BOARD_PARAM.PAGE]}
              pageSize={BOARD_PAGE_SIZE}
              total={total}
              onPageChange={(next) => setValues({ [BOARD_PARAM.PAGE]: next })}
              itemLabel="requests"
              disabled={isLoading}
              hideOnSinglePage
            />
          ) : null}
        </Box>
      </Box>

      <SideSheet
        open={isSheetOpen}
        onClose={closeSheet}
        title="Filters"
        description="Narrow the board to the briefs you could take on."
        actions={
          <>
            <Button
              variant="text"
              color="inherit"
              onClick={clearFilters}
              disabled={!isFiltered}
              sx={{ flexShrink: 0 }}
            >
              Clear all
            </Button>
            <Button variant="gradient" onClick={closeSheet} sx={{ flexGrow: 1 }}>
              {isLoading
                ? 'Show results'
                : `Show ${formatNumber(total)} ${total === 1 ? 'request' : 'requests'}`}
            </Button>
          </>
        }
      >
        <BoardFilters
          idPrefix="sheet-board-filters"
          values={values}
          onChange={patch}
          categories={categoryList}
          isCategoriesLoading={isCategoriesLoading}
          showInvited={showInvitedFilter}
        />
      </SideSheet>
    </>
  )
}
