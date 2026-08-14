import { useCallback, useState } from 'react'

import { Icon } from '@iconify/react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material'

import PaginationControl from '@/components/data-display/PaginationControl'
import RatingStars from '@/components/data-display/RatingStars'
import EmptyState from '@/components/feedback/EmptyState'
import ErrorState from '@/components/feedback/ErrorState'
import { CardSkeleton } from '@/components/feedback/skeletons'
import FilterChipGroup from '@/components/inputs/FilterChipGroup'
import FormFileField from '@/components/inputs/FormFileField'
import SearchInput from '@/components/inputs/SearchInput'
import SortSelect from '@/components/inputs/SortSelect'
import { useApiMutation } from '@/hooks/useApiMutation'
import { useApiQuery } from '@/hooks/useApiQuery'
import { usePaginatedQuery } from '@/hooks/usePaginatedQuery'
import {
  API_ERROR_CODE,
  categoryService,
  creatorProfileService,
  orderService,
  uploadService,
  UPLOAD_PURPOSE,
  UPLOAD_RULES,
} from '@/services'
import { formatCurrency } from '@/utils/formatters'

import GalleryBlock from './GalleryBlock'

// Dev-only acceptance surface for Prompt 07: the API layer, the three data
// hooks, and the upload mock, all against the real seeded API. Everything here
// goes through `src/services` — there is no axios or fetch in this file, which
// is the point (00 §2.4).

const SORT_OPTIONS = [
  { value: 'ratingAvg', label: 'Rating' },
  { value: 'startingPrice', label: 'Starting price' },
  { value: 'completedOrders', label: 'Completed orders' },
  { value: 'responseTimeHours', label: 'Response time' },
]

const REAL_ORDER_ID = 'ord_002'
const MISSING_ORDER_ID = 'ord_this_does_not_exist'

/** Friendly copy per error code, so the demo shows the real UX not a raw dump. */
function errorCopy(error) {
  if (error?.code === API_ERROR_CODE.NETWORK_ERROR) {
    return {
      title: 'We can’t reach the API',
      message: 'The mock API is not answering. Start it with `npm run api`, then retry.',
    }
  }
  if (error?.code === API_ERROR_CODE.NOT_FOUND) {
    return {
      title: 'Not found',
      message: 'That record does not exist, or is not visible to you.',
    }
  }
  return {
    title: 'Something went wrong',
    message: error?.message ?? 'We could not load this right now.',
  }
}

/* --- Discovery grid ------------------------------------------------------- */

function DiscoveryDemo() {
  const categories = useApiQuery(() => categoryService.listActive(), [])
  const [category, setCategory] = useState(null)

  const search = useCallback(
    (params) => creatorProfileService.search(params),
    []
  )

  const list = usePaginatedQuery(search, {
    initialParams: { limit: 6, sort: 'ratingAvg', order: 'desc' },
  })

  const applyCategory = (next) => {
    setCategory(next)
    list.setFilters(next ? { category: next } : {})
  }

  const categoryOptions = (categories.data ?? []).map((entry) => ({
    value: entry.id,
    label: entry.name,
  }))

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', md: 'center' }}
      >
        <SearchInput
          value={list.params.search}
          onChange={list.setSearch}
          placeholder="Search creators, taglines, locations"
          label="Search"
        />
        <SortSelect
          value={list.params.sort}
          onChange={(value) => list.setSort(value, 'desc')}
          options={SORT_OPTIONS}
        />
      </Stack>

      {categoryOptions.length > 0 ? (
        <FilterChipGroup
          label="Category"
          options={categoryOptions}
          value={category}
          onChange={applyCategory}
        />
      ) : null}

      <Typography variant="caption" color="text.secondary">
        {list.isLoading
          ? 'Loading…'
          : `${list.total} creator${list.total === 1 ? '' : 's'} · page ${list.page}`}
      </Typography>

      {list.isLoading ? (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          }}
        >
          {[0, 1, 2].map((key) => (
            <CardSkeleton key={key} media={false} lines={3} label="Loading creators" />
          ))}
        </Box>
      ) : null}

      {!list.isLoading && list.error ? (
        <ErrorState {...errorCopy(list.error)} error={list.error} onRetry={list.refetch} />
      ) : null}

      {!list.isLoading && !list.error && list.items.length === 0 ? (
        <EmptyState
          icon="tabler:users-group"
          title="No creators match those filters"
          description="Clear the search or pick a different category to see the seeded storefronts."
          primaryAction={{
            label: 'Clear filters',
            icon: 'tabler:filter-off',
            onClick: () => {
              setCategory(null)
              list.setSearch('')
              list.setFilters({})
            },
          }}
        />
      ) : null}

      {!list.isLoading && !list.error && list.items.length > 0 ? (
        <>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            }}
          >
            {list.items.map((profile) => (
              <Card key={profile.id} variant="outlined">
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="subtitle1">{profile.displayName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {profile.tagline}
                    </Typography>
                    <RatingStars value={profile.ratingAvg} count={profile.ratingCount} size="sm" />
                    <Typography variant="body2">
                      From {formatCurrency(profile.startingPrice, profile.currency)}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Box>

          <PaginationControl
            page={list.page}
            pageSize={list.limit}
            total={list.total}
            onPageChange={list.setPage}
            itemLabel="creators"
          />
        </>
      ) : null}
    </Stack>
  )
}

/* --- Error paths ---------------------------------------------------------- */

function ErrorPathDemo() {
  const [orderId, setOrderId] = useState(REAL_ORDER_ID)
  const { data, isLoading, error, refetch } = useApiQuery(
    () => orderService.getWithRelations(orderId),
    [orderId]
  )

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
        <Button
          variant={orderId === REAL_ORDER_ID ? 'contained' : 'outlined'}
          onClick={() => setOrderId(REAL_ORDER_ID)}
          startIcon={<Icon icon="tabler:package" width={18} />}
        >
          Load {REAL_ORDER_ID}
        </Button>
        <Button
          variant={orderId === MISSING_ORDER_ID ? 'contained' : 'outlined'}
          color="warning"
          onClick={() => setOrderId(MISSING_ORDER_ID)}
          startIcon={<Icon icon="tabler:alert-triangle" width={18} />}
        >
          Load a missing order (404)
        </Button>
        <Button variant="text" onClick={refetch} startIcon={<Icon icon="tabler:refresh" width={18} />}>
          Refetch
        </Button>
      </Stack>

      <Alert severity="info" icon={<Icon icon="tabler:plug-connected-x" width={20} />}>
        Stop <code>npm run api</code> and press Refetch: the same surface should show a friendly{' '}
        <code>network_error</code> with a working retry, not a blank page.
      </Alert>

      {isLoading ? <CardSkeleton lines={3} label="Loading order" /> : null}

      {!isLoading && error ? (
        <ErrorState {...errorCopy(error)} error={error} onRetry={refetch} />
      ) : null}

      {!isLoading && !error && data ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="subtitle1">{data.order.title}</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={`status: ${data.order.status}`} />
                <Chip size="small" label={`price: ${formatCurrency(data.order.price)}`} />
                <Chip size="small" label={`deliveries: ${data.deliveries.length}`} />
                <Chip size="small" label={`revisions: ${data.revisions.length}`} />
                <Chip size="small" label={`payment: ${data.payment?.status ?? 'none'}`} />
                <Chip size="small" label={`request: ${data.request ? 'loaded' : 'missing'}`} />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                One `getWithRelations` call — the order, then request, proposal, deliveries,
                revisions and payment fetched in parallel.
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  )
}

/* --- Upload mock ---------------------------------------------------------- */

function UploadDemo() {
  const [files, setFiles] = useState([])
  const [uploaded, setUploaded] = useState([])
  const upload = useApiMutation(uploadService.uploadFiles)
  const rules = UPLOAD_RULES[UPLOAD_PURPOSE.PORTFOLIO]

  const run = async () => {
    try {
      const result = await upload.mutate(files, { kind: UPLOAD_PURPOSE.PORTFOLIO })
      setUploaded(result)
      setFiles([])
    } catch {
      // `useApiMutation` keeps the ApiError in `upload.error` for the inline
      // message below — the toast belongs to real feature screens.
    }
  }

  return (
    <Stack spacing={3}>
      <FormFileField
        label="Sample work"
        value={files}
        onChange={(next) => {
          setFiles(next)
          upload.reset()
        }}
        multiple
        accept="image/*,video/mp4"
        helperText={`The mock accepts ${rules.accept.join(', ')} up to ${rules.maxSizeMb} MB.`}
        error={upload.error?.details?.file}
      />

      <Stack direction="row" spacing={1.5}>
        <Button
          variant="contained"
          onClick={run}
          disabled={files.length === 0 || upload.isLoading}
          startIcon={<Icon icon="tabler:cloud-upload" width={18} />}
        >
          {upload.isLoading ? 'Uploading…' : `Upload ${files.length || ''}`.trim()}
        </Button>
        {uploaded.length > 0 ? (
          <Button variant="text" onClick={() => setUploaded([])}>
            Clear results
          </Button>
        ) : null}
      </Stack>

      {uploaded.length === 0 ? (
        <EmptyState
          dense
          icon="tabler:photo-up"
          title="Nothing uploaded yet"
          description="Pick a file to see the contract-shaped response the real POST /uploads will return."
        />
      ) : (
        <Stack spacing={1.5}>
          {uploaded.map((file) => (
            <Card key={file.id} variant="outlined">
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box
                    component="img"
                    src={file.thumbnailUrl}
                    alt=""
                    sx={{
                      width: 72,
                      height: 54,
                      objectFit: 'cover',
                      borderRadius: 1.5,
                      border: 1,
                      borderColor: 'divider',
                      flexShrink: 0,
                    }}
                  />
                  <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                    <Typography variant="body2" noWrap title={file.name}>
                      {file.name}
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip size="small" label={file.id} />
                      <Chip size="small" label={file.mediaType} />
                      <Chip size="small" label={`${file.sizeKb} KB`} />
                    </Stack>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  )
}

/* --- Panel ---------------------------------------------------------------- */

export default function ApiGallery() {
  return (
    <Stack spacing={{ xs: 6, md: 8 }}>
      <GalleryBlock
        title="Discovery search"
        caption="creatorProfileService.search + usePaginatedQuery against the seeded API: debounced search, category filter, sort, and pagination — each one resetting to page 1. Loading shows skeletons, failure shows ErrorState with retry, no matches shows EmptyState."
      >
        <DiscoveryDemo />
      </GalleryBlock>

      <GalleryBlock
        title="Error paths"
        caption="useApiQuery against orderService.getWithRelations. The second button asks for an id that does not exist, which must surface as a not_found ApiError — and stopping the API must surface as a recoverable network_error."
      >
        <ErrorPathDemo />
      </GalleryBlock>

      <GalleryBlock
        title="Upload mock"
        caption="FormFileField collects real File objects; uploadService.uploadFiles simulates POST /uploads and returns contract-shaped file records. An oversized or unsupported file is rejected with a validation_failed ApiError shown inline under the field."
      >
        <UploadDemo />
      </GalleryBlock>
    </Stack>
  )
}
