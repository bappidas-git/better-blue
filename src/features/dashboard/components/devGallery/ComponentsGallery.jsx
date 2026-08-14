import { useState } from 'react'

import { Icon } from '@iconify/react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material'

import KeyValueList from '@/components/data-display/KeyValueList'
import MediaLightbox from '@/components/data-display/MediaLightbox'
import PaginationControl from '@/components/data-display/PaginationControl'
import RatingStars from '@/components/data-display/RatingStars'
import StatCard from '@/components/data-display/StatCard'
import StatusChip from '@/components/data-display/StatusChip'
import TimelineList from '@/components/data-display/TimelineList'
import UserAvatar, { UserAvatarGroup } from '@/components/data-display/UserAvatar'
import EmptyState from '@/components/feedback/EmptyState'
import ErrorState from '@/components/feedback/ErrorState'
import { useConfirm } from '@/components/feedback/ConfirmDialogProvider'
import { useToast } from '@/components/feedback/ToastProvider'
import {
  CardSkeleton,
  FormSkeleton,
  ListSkeleton,
  ProfileSkeleton,
  StatSkeleton,
  TableSkeleton,
} from '@/components/feedback/skeletons'
import PageHeader from '@/components/layout/PageHeader'
import ResponsiveDialog from '@/components/layout/ResponsiveDialog'
import Section from '@/components/layout/Section'
import SideSheet from '@/components/layout/SideSheet'
import StickyActionBar from '@/components/layout/StickyActionBar'
import DataTable from '@/components/table/DataTable'
import { CONTENT_TYPE, ORDER_STATUS, PAYMENT_STATUS, imageUrl } from '@/constants'
import { paths } from '@/routes/paths'
import { formatCurrency, formatDate } from '@/utils/formatters'
import GalleryBlock from './GalleryBlock'

// Components tab — every shared component in every state it ships with.
// Fixtures are inline and business-safe (00 §1); the dev gallery is the one
// place local sample data is allowed (Prompt 04 §9).

const ORDER_ROWS = [
  {
    id: 'ord_1001',
    project: 'Aurora Skincare — spring product shoot',
    buyer: 'Aurora Skincare',
    type: CONTENT_TYPE.PHOTO,
    status: ORDER_STATUS.COMPLETED,
    amount: 480,
    dueAt: '2026-03-04T09:30:00Z',
  },
  {
    id: 'ord_1002',
    project: 'Bloom Coffee — launch reels',
    buyer: 'Bloom Coffee Co',
    type: CONTENT_TYPE.VIDEO,
    status: ORDER_STATUS.IN_PROGRESS,
    amount: 1250,
    dueAt: '2026-03-18T17:00:00Z',
  },
  {
    id: 'ord_1003',
    project: 'Trailhead Fitness — UGC bundle',
    buyer: 'Trailhead Fitness',
    type: CONTENT_TYPE.BUNDLE,
    status: ORDER_STATUS.REVISION_REQUESTED,
    amount: 860,
    dueAt: '2026-03-11T12:00:00Z',
  },
  {
    id: 'ord_1004',
    project: 'Northside Realty — listing walkthroughs',
    buyer: 'Northside Realty',
    type: CONTENT_TYPE.VIDEO,
    status: ORDER_STATUS.PENDING_PAYMENT,
    amount: 2100,
    dueAt: '2026-03-26T09:00:00Z',
  },
  {
    id: 'ord_1005',
    project: 'Harbor Table — seasonal menu photos',
    buyer: 'Harbor Table',
    type: CONTENT_TYPE.PHOTO,
    status: ORDER_STATUS.DISPUTED,
    amount: 640,
    dueAt: '2026-02-27T15:30:00Z',
  },
]

const TIMELINE_ITEMS = [
  {
    id: 'evt_1',
    icon: 'tabler:file-text',
    title: 'Request published',
    description: 'Aurora Skincare posted the brief to the marketplace.',
    timestamp: '2026-02-14T09:12:00Z',
    tone: 'info',
  },
  {
    id: 'evt_2',
    icon: 'tabler:send',
    title: 'Proposal accepted',
    description: 'Ava Martinez was awarded the order at $480.00.',
    timestamp: '2026-02-16T14:02:00Z',
    tone: 'brand',
  },
  {
    id: 'evt_3',
    icon: 'tabler:lock',
    title: 'Payment held in escrow',
    description: 'Funds are released once the delivery is accepted.',
    timestamp: '2026-02-16T14:03:00Z',
    tone: 'success',
    meta: <StatusChip status={PAYMENT_STATUS.HELD} size="sm" />,
  },
  {
    id: 'evt_4',
    icon: 'tabler:refresh',
    title: 'Revision requested',
    description: 'Buyer asked for warmer color grading on four photos.',
    timestamp: '2026-02-21T11:45:00Z',
    tone: 'warning',
  },
]

const LIGHTBOX_ITEMS = [
  {
    id: 'pfi_1',
    type: 'image',
    src: imageUrl('bb-food-beverage', 1200, 800),
    alt: 'Plated seasonal dish photographed in natural light for a restaurant menu launch',
    caption: 'Harbor Table — seasonal menu, natural light set',
  },
  {
    id: 'pfi_2',
    type: 'image',
    src: imageUrl('bb-beauty-skincare', 1200, 800),
    alt: 'Skincare bottles arranged on a neutral backdrop for an e-commerce listing',
    caption: 'Aurora Skincare — product set, neutral backdrop',
  },
  {
    id: 'pfi_3',
    type: 'video',
    // Poster only: the gallery demonstrates the video branch without making a
    // media request (and without a console error for a missing file).
    poster: imageUrl('bb-fitness-wellness', 1200, 675),
    alt: 'Fitness brand promotional clip',
    caption: 'Trailhead Fitness — 30s promo cut (poster shown; no sample file is bundled)',
  },
]

const SAMPLE_ERROR = {
  status: 503,
  code: 'SERVICE_UNAVAILABLE',
  message: 'The orders service did not respond in time.',
  details: { requestId: 'req_8f21c4', retryAfterSeconds: 5 },
}

const COLUMNS = [
  {
    key: 'project',
    label: 'Project',
    sortable: true,
    render: (row) => (
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {row.project}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {row.buyer}
        </Typography>
      </Box>
    ),
  },
  { key: 'type', label: 'Type', render: (row) => <StatusChip status={row.type} size="sm" showDot={false} /> },
  { key: 'status', label: 'Status', sortable: true, render: (row) => <StatusChip status={row.status} size="sm" /> },
  {
    key: 'dueAt',
    label: 'Due',
    sortable: true,
    render: (row) => formatDate(row.dueAt),
  },
  {
    key: 'amount',
    label: 'Amount',
    align: 'right',
    sortable: true,
    render: (row) => formatCurrency(row.amount),
  },
]

const TABLE_STATES = [
  { value: 'success', label: 'Rows' },
  { value: 'loading', label: 'Loading' },
  { value: 'error', label: 'Error' },
  { value: 'empty', label: 'Empty' },
]

function FeedbackDemos() {
  const toast = useToast()
  const confirm = useConfirm()
  const [lastResult, setLastResult] = useState(null)

  const runConfirm = async (options) => {
    const result = await confirm(options)
    setLastResult(result)
    if (result) {
      toast.success('Confirmed', {
        description: result.reason ? `Reason: ${result.reason}` : 'No reason was required.',
      })
    } else {
      toast.info('Dismissed — nothing was changed.')
    }
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
          Toasts — useToast()
        </Typography>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
          <Button
            variant="outlined"
            onClick={() =>
              toast.success('Proposal sent', {
                description: 'Aurora Skincare has been notified.',
              })
            }
          >
            Success + description
          </Button>
          <Button
            variant="outlined"
            onClick={() => toast.error('Payment could not be processed.')}
          >
            Error
          </Button>
          <Button variant="outlined" onClick={() => toast.info('Your request is now live.')}>
            Info
          </Button>
          <Button
            variant="outlined"
            onClick={() => toast.warning('This order is due in 48 hours.')}
          >
            Warning
          </Button>
          <Button
            variant="text"
            onClick={() => {
              toast.success('Delivery accepted')
              toast.info('Payment released to the creator')
              toast.warning('Two revisions remain')
              toast.error('Receipt email bounced')
            }}
          >
            Stack four
          </Button>
        </Stack>
      </Box>

      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
          Confirm — useConfirm()
        </Typography>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
          <Button
            variant="outlined"
            onClick={() =>
              runConfirm({
                title: 'Accept this delivery?',
                message:
                  'Accepting releases the escrowed payment to the creator, minus the platform commission. This cannot be undone.',
                confirmLabel: 'Accept delivery',
                icon: 'tabler:circle-check',
              })
            }
          >
            Primary tone
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={() =>
              runConfirm({
                title: 'Cancel this order?',
                message:
                  'The buyer is refunded in full, the creator is notified, and the request returns to the marketplace.',
                confirmLabel: 'Cancel order',
                tone: 'danger',
              })
            }
          >
            Danger tone
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={() =>
              runConfirm({
                title: 'Suspend this account?',
                message:
                  'The account holder loses access while Trust & Safety reviews the case. Open orders stay funded.',
                confirmLabel: 'Suspend account',
                tone: 'danger',
                requireReason: true,
                reasonLabel: 'Reason for suspension',
                reasonPlaceholder: 'Explain what triggered this decision…',
              })
            }
          >
            Danger + requireReason
          </Button>
        </Stack>
        <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
          <Typography variant="caption" color="text.secondary" component="p">
            Resolved value
          </Typography>
          <Typography
            variant="body2"
            sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
          >
            {lastResult === null ? 'awaiting a confirmation…' : JSON.stringify(lastResult)}
          </Typography>
        </Paper>
      </Box>
    </Stack>
  )
}

function TableDemo() {
  const toast = useToast()
  const [state, setState] = useState('success')
  const [layout, setLayout] = useState('auto')
  const [sort, setSort] = useState({ key: 'dueAt', direction: 'asc' })
  const [page, setPage] = useState(1)

  const rows = state === 'success' ? ORDER_ROWS : []

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {TABLE_STATES.map((option) => (
            <Button
              key={option.value}
              size="small"
              variant={state === option.value ? 'contained' : 'outlined'}
              onClick={() => setState(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </Stack>
        <Divider flexItem orientation="vertical" sx={{ display: { xs: 'none', sm: 'block' } }} />
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {['auto', 'table', 'cards'].map((option) => (
            <Button
              key={option}
              size="small"
              variant={layout === option ? 'contained' : 'outlined'}
              color="secondary"
              onClick={() => setLayout(option)}
            >
              {option}
            </Button>
          ))}
        </Stack>
      </Stack>

      <DataTable
        columns={COLUMNS}
        rows={rows}
        layout={layout}
        loading={state === 'loading'}
        error={state === 'error' ? SAMPLE_ERROR : undefined}
        onRetry={() => setState('success')}
        emptyState={{
          icon: 'tabler:clipboard-list',
          title: 'No orders yet',
          description: 'Orders appear here once a buyer accepts one of your proposals.',
          primaryAction: { label: 'Browse requests', icon: 'tabler:search', onClick: () => {} },
        }}
        sort={sort}
        onSortChange={setSort}
        onRowClick={(row) => toast.info(`Opened ${row.project}`)}
        pagination={{
          page,
          pageSize: 5,
          total: 42,
          onPageChange: setPage,
          itemLabel: 'orders',
        }}
        ariaLabel="Sample orders"
        renderMobileCard={(row) => (
          <Card>
            <CardContent>
              <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="flex-start">
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2">{row.project}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {row.buyer}
                  </Typography>
                </Box>
                <StatusChip status={row.status} size="sm" />
              </Stack>
              <Stack
                direction="row"
                spacing={2}
                justifyContent="space-between"
                alignItems="center"
                sx={{ mt: 2 }}
              >
                <Typography variant="caption" color="text.secondary">
                  Due {formatDate(row.dueAt)}
                </Typography>
                <Typography variant="subtitle2">{formatCurrency(row.amount)}</Typography>
              </Stack>
            </CardContent>
          </Card>
        )}
      />
      <Typography variant="caption" color="text.secondary">
        Sort: {sort.key} · {sort.direction} — DataTable reports sort intent; ordering data stays with
        the page (or the API).
      </Typography>
    </Stack>
  )
}

function LayoutDemos() {
  const toast = useToast()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
          PageHeader
        </Typography>
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
          <PageHeader
            title="Order ORD-1002"
            subtitle="Bloom Coffee Co · Launch reels for the spring blend release"
            titleComponent="p"
            backTo="/orders"
            meta={<StatusChip status={ORDER_STATUS.IN_PROGRESS} />}
            actions={
              <>
                <Button variant="outlined" startIcon={<Icon icon="tabler:message" width={18} />}>
                  Message
                </Button>
                <Button variant="gradient">Submit delivery</Button>
              </>
            }
            sx={{ mb: 0 }}
          />
        </Paper>
      </Box>

      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
          Section
        </Typography>
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
          <Section
            eyebrow="Deliverables"
            title="Files shared with the buyer"
            description="Section owns the vertical rhythm between page blocks so pages stop inventing margins."
            titleComponent="p"
            action={
              <Button size="small" variant="text">
                View all
              </Button>
            }
            spacing="sm"
            sx={{ '&:not(:last-child)': { mb: 0 } }}
          >
            <KeyValueList
              items={[
                { label: 'Photos', value: '18 files · 240 MB' },
                { label: 'Videos', value: '2 files · 1.1 GB' },
              ]}
            />
          </Section>
        </Paper>
      </Box>

      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
          Overlays
        </Typography>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
          <Button variant="outlined" onClick={() => setDialogOpen(true)}>
            Open ResponsiveDialog
          </Button>
          <Button variant="outlined" onClick={() => setSheetOpen(true)}>
            Open SideSheet
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Below 900px both become full-screen sheets. Tab to check the focus trap, press Escape to
          close, and confirm focus returns to the trigger button.
        </Typography>

        <ResponsiveDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Request a revision"
          description="The creator is notified and the order returns to in-progress."
          actions={
            <>
              <Button color="inherit" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="gradient"
                onClick={() => {
                  setDialogOpen(false)
                  toast.success('Revision requested')
                }}
              >
                Send request
              </Button>
            </>
          }
        >
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              One revision is included in this order. Be specific about what needs to change — the
              clearer the note, the faster the turnaround.
            </Typography>
            <KeyValueList
              items={[
                { label: 'Order', value: 'ORD-1002 · Bloom Coffee Co' },
                { label: 'Revisions used', value: '0 of 1' },
                { label: 'Delivery due', value: formatDate('2026-03-18T17:00:00Z') },
              ]}
              labelWidth={140}
            />
          </Stack>
        </ResponsiveDialog>

        <SideSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Filters"
          description="Side sheets hold filter panels and detail peeks."
          actions={
            <>
              <Button color="inherit" onClick={() => setSheetOpen(false)}>
                Reset
              </Button>
              <Button variant="contained" onClick={() => setSheetOpen(false)}>
                Apply
              </Button>
            </>
          }
        >
          <KeyValueList
            items={[
              { label: 'Status', value: <StatusChip status={ORDER_STATUS.IN_PROGRESS} size="sm" /> },
              { label: 'Budget', value: '$500 – $2,500' },
              { label: 'Category', value: 'Food & Beverage' },
              { label: 'Delivery window', value: 'Next 30 days' },
            ]}
            labelWidth={140}
            divided
          />
        </SideSheet>
      </Box>

      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
          StickyActionBar
        </Typography>
        <Paper
          variant="outlined"
          sx={{ height: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
        >
          <Box sx={{ p: 2, flexGrow: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Scroll this panel — the action bar stays pinned to the bottom of the scrolling column,
              with a top hairline and safe-area padding underneath.
            </Typography>
            <Box sx={{ height: 220 }} />
            <Typography variant="body2" color="text.secondary">
              End of content.
            </Typography>
          </Box>
          <StickyActionBar>
            <Button variant="text" color="inherit">
              Save draft
            </Button>
            <Button variant="gradient">Submit proposal</Button>
          </StickyActionBar>
        </Paper>
      </Box>
    </Stack>
  )
}

function DataDisplayDemos() {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [rating, setRating] = useState(4)
  const [page, setPage] = useState(2)

  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
          StatusChip — sizes, dot, tooltip, outlined
        </Typography>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <StatusChip status={ORDER_STATUS.DELIVERED} size="sm" />
          <StatusChip status={ORDER_STATUS.DELIVERED} />
          <StatusChip status={ORDER_STATUS.DISPUTED} tooltip />
          <StatusChip status={PAYMENT_STATUS.HELD} variant="outlined" />
          <StatusChip status={ORDER_STATUS.COMPLETED} showDot={false} />
          <StatusChip status="not_a_real_status" />
        </Stack>
      </Box>

      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
          StatCard — count-up, delta tones, link, loading
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
          }}
        >
          <StatCard
            label="Earnings this month"
            value={12480}
            format={(value) => formatCurrency(value)}
            delta={0.124}
            deltaLabel="vs last month"
            icon="tabler:wallet"
          />
          <StatCard
            label="Active orders"
            value={18}
            delta={-0.06}
            deltaLabel="vs last month"
            icon="tabler:briefcase"
            iconTone="info"
            to={paths.BUYER_ORDERS}
          />
          <StatCard
            label="Open disputes"
            value={2}
            delta={0.5}
            deltaTone="error"
            deltaLabel="vs last month"
            icon="tabler:alert-triangle"
            iconTone="error"
          />
          <StatCard label="Loading" value={0} loading />
        </Box>
      </Box>

      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
          UserAvatar & UserAvatarGroup
        </Typography>
        <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap" useFlexGap>
          <UserAvatar name="Ava Martinez" size="xs" />
          <UserAvatar name="Ava Martinez" size="sm" />
          <UserAvatar name="Ava Martinez" size="md" status="online" />
          <UserAvatar name="Marcus Bell" size="lg" status="away" tooltip />
          <UserAvatar name="Verde Kitchen" size="lg" variant="rounded" status="offline" />
          <UserAvatarGroup
            max={4}
            size="md"
            users={[
              { id: 'usr_1', name: 'Ava Martinez' },
              { id: 'usr_2', name: 'Marcus Bell' },
              { id: 'usr_3', name: 'Verde Kitchen' },
              { id: 'usr_4', name: 'Nimbus Fitness' },
              { id: 'usr_5', name: 'Atlas Travel Co' },
            ]}
          />
        </Stack>
      </Box>

      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
          RatingStars — display (half stars) and input (arrow keys)
        </Typography>
        <Stack spacing={2} alignItems="flex-start">
          <RatingStars value={4.5} count={128} />
          <RatingStars value={3.5} count={12} size="sm" />
          <Stack direction="row" spacing={2} alignItems="center">
            <RatingStars
              value={rating}
              onChange={(next) => setRating(next ?? 0)}
              size="lg"
              label="Rate this delivery"
            />
            <Typography variant="body2" color="text.secondary">
              Selected: {rating}
            </Typography>
          </Stack>
        </Stack>
      </Box>

      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
          KeyValueList & TimelineList
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
            alignItems: 'start',
          }}
        >
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <KeyValueList
              items={[
                { label: 'Order', value: 'ORD-1002' },
                { label: 'Buyer', value: 'Bloom Coffee Co' },
                { label: 'Content type', value: <StatusChip status={CONTENT_TYPE.VIDEO} size="sm" showDot={false} /> },
                { label: 'Amount', value: formatCurrency(1250), hint: 'Held in escrow' },
                { label: 'Due', value: formatDate('2026-03-18T17:00:00Z') },
              ]}
              labelWidth={160}
              divided
            />
          </Paper>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <TimelineList items={TIMELINE_ITEMS} />
          </Paper>
        </Box>
      </Box>

      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
          PaginationControl
        </Typography>
        <PaginationControl
          page={page}
          pageSize={12}
          total={148}
          onPageChange={setPage}
          itemLabel="creators"
          sx={{ pt: 0 }}
        />
      </Box>

      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
          MediaLightbox
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
          {LIGHTBOX_ITEMS.map((item, index) => (
            <Box
              key={item.id}
              component="button"
              type="button"
              onClick={() => setLightboxOpen(index)}
              aria-label={`Open ${item.alt} in the media viewer`}
              sx={{
                p: 0,
                border: 1,
                borderColor: 'divider',
                borderRadius: 2,
                overflow: 'hidden',
                cursor: 'pointer',
                bgcolor: 'background.paper',
                width: 160,
                height: 110,
              }}
            >
              <Box
                component="img"
                src={item.src ?? item.poster}
                alt=""
                sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </Box>
          ))}
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Arrow keys page through items, Escape closes, and the thumbnail strip appears from 900px up.
        </Typography>
        <MediaLightbox
          open={lightboxOpen !== false}
          items={LIGHTBOX_ITEMS}
          defaultIndex={typeof lightboxOpen === 'number' ? lightboxOpen : 0}
          onClose={() => setLightboxOpen(false)}
          title="Portfolio sample"
        />
      </Box>
    </Stack>
  )
}

export default function ComponentsGallery() {
  return (
    <Stack spacing={{ xs: 6, md: 8 }} divider={<Divider />}>
      <GalleryBlock
        title="Feedback"
        caption="Toasts stack bottom-center on mobile and bottom-right on desktop, auto-dismissing after 4s. Confirm resolves false when dismissed, or { confirmed: true, reason? } when accepted."
      >
        <FeedbackDemos />
      </GalleryBlock>

      <GalleryBlock
        title="Empty & error states"
        caption="Every list surface uses these two: an elegant empty state with a way out, and a friendly error with retry plus collapsible technical detail."
      >
        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
          }}
        >
          <Paper variant="outlined">
            <EmptyState
              icon="tabler:folder-open"
              title="No proposals yet"
              description="Creators usually respond within a day. Sharing more detail in your brief helps."
              primaryAction={{ label: 'Edit brief', icon: 'tabler:pencil', onClick: () => {} }}
              secondaryAction={{ label: 'Invite creators', onClick: () => {} }}
            />
          </Paper>
          <Paper variant="outlined">
            <ErrorState error={SAMPLE_ERROR} onRetry={() => {}} />
          </Paper>
        </Box>
      </GalleryBlock>

      <GalleryBlock
        title="Skeletons"
        caption="Sized to match the components they stand in for, so nothing shifts when the data lands."
      >
        <Stack spacing={4}>
          <Box
            sx={{
              display: 'grid',
              gap: 3,
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
            }}
          >
            <StatSkeleton />
            <StatSkeleton />
            <CardSkeleton />
            <CardSkeleton media={false} lines={3} actions />
          </Box>
          <TableSkeleton rows={4} cols={5} />
          <Box
            sx={{
              display: 'grid',
              gap: 4,
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
              alignItems: 'start',
            }}
          >
            <ListSkeleton rows={3} />
            <ProfileSkeleton />
          </Box>
          <FormSkeleton fields={4} columns={2} />
        </Stack>
      </GalleryBlock>

      <GalleryBlock
        title="Data display"
        caption="Status, stats, people, ratings, facts, history, paging, and media — the vocabulary every feature page is built from."
      >
        <DataDisplayDemos />
      </GalleryBlock>

      <GalleryBlock
        title="Layout"
        caption="PageHeader, Section, ResponsiveDialog, SideSheet, and StickyActionBar. Resize to 360px to see the header actions wrap and the overlays become full-screen sheets."
      >
        <LayoutDemos />
      </GalleryBlock>

      <GalleryBlock
        title="DataTable"
        caption="Switch the state to exercise rows, loading, error, and empty; switch the layout to force card mode at any width. Below 900px 'auto' renders cards on its own."
      >
        <TableDemo />
      </GalleryBlock>
    </Stack>
  )
}
