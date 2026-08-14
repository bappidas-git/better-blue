import { useState } from 'react'

import { Icon } from '@iconify/react'
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  MenuItem,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { motion, useReducedMotion } from 'framer-motion'

import Logo from '@/components/brand/Logo'
import {
  fadeIn,
  fadeInUp,
  listItem,
  scaleIn,
  staggerContainer,
} from '@/components/motion/motionPresets'
import {
  ACCOUNT_STATUS,
  AFFILIATE_EARNING_STATUS,
  AVATAR_TINT_NAMES,
  CATEGORY_ID,
  CONTENT_STATUS,
  ORDER_STATUS,
  ORDER_STATUS_MACHINE,
  PAYMENT_STATUS,
  PAYOUT_STATUS,
  PROPOSAL_STATUS,
  REQUEST_STATUS,
  TRANSACTION_TYPE,
  avatarDataUri,
  categoryImageUrl,
  getFallbackCategory,
  getStatusMeta,
} from '@/constants'
import { brandGradient, palette } from '@/theme/palette'
import {
  formatCurrency,
  formatDate,
  formatNumberCompact,
  formatPercent,
  formatRelativeTime,
} from '@/utils/formatters'
import { nextStates } from '@/utils/stateMachine'

// Temporary dev-only design gallery for visually verifying the Prompt 02
// theme. Mounted from App.jsx while routing doesn't exist yet; Prompt 08
// moves it to /dev/design. All copy below is business-safe sample content.

const SWATCH_GROUPS = [
  {
    title: 'Primary — purple',
    items: [
      ['primary.surface', palette.primary.surface],
      ['primary.lighter', palette.primary.lighter],
      ['primary.light', palette.primary.light],
      ['primary.main', palette.primary.main],
      ['primary.dark', palette.primary.dark],
    ],
  },
  {
    title: 'Secondary — pink',
    items: [
      ['secondary.surface', palette.secondary.surface],
      ['secondary.light', palette.secondary.light],
      ['secondary.main', palette.secondary.main],
      ['secondary.dark', palette.secondary.dark],
    ],
  },
  {
    title: 'Semantic',
    items: [
      ['success.main', palette.success.main],
      ['warning.main', palette.warning.main],
      ['error.main', palette.error.main],
      ['info.main', palette.info.main],
    ],
  },
  {
    title: 'Neutrals',
    items: [
      ['background.default', palette.background.default],
      ['background.paper', palette.background.paper],
      ['text.primary', palette.text.primary],
      ['text.secondary', palette.text.secondary],
      ['text.disabled', palette.text.disabled],
      ['divider', palette.divider],
    ],
  },
]

const TYPE_SCALE = [
  ['h1', 'Commission content that converts'],
  ['h2', 'Creators for every campaign'],
  ['h3', 'Briefs, proposals, orders'],
  ['h4', 'Escrow-protected payments'],
  ['h5', 'Deliverables and revisions'],
  ['h6', 'Trust and safety built in'],
  ['subtitle1', 'Subtitle 1 — section lead-ins and card titles'],
  ['subtitle2', 'Subtitle 2 — dense card titles and labels'],
  ['body1', 'Body 1 — Inter at 16px/1.6 for comfortable long-form reading across briefs, proposals, and policy pages.'],
  ['body2', 'Body 2 — secondary copy, table cells, and helper contexts.'],
  ['button', 'Button — Plus Jakarta Sans 600, no uppercase'],
  ['caption', 'Caption — timestamps and metadata'],
  ['overline', 'Overline — eyebrow labels'],
]

const TABLE_ROWS = [
  {
    project: 'Aurora Skincare — product shoot',
    type: 'Photo',
    status: { label: 'Completed', color: 'success' },
    budget: '$480.00',
  },
  {
    project: 'Bloom Coffee — launch reels',
    type: 'Video',
    status: { label: 'In progress', color: 'info' },
    budget: '$1,250.00',
  },
  {
    project: 'Trailhead Fitness — UGC bundle',
    type: 'Bundle',
    status: { label: 'In review', color: 'warning' },
    budget: '$860.00',
  },
]

// --- Domain section (Prompt 03) -------------------------------------------
// Temporary verification of the domain constants + utilities: one tinted chip
// per tone (the StatusChip precursor built for real in Prompt 04), generated
// initials avatars, seeded picsum imagery, and formatter output.

const TONE_SAMPLES = [
  {
    tone: 'neutral',
    statuses: [
      REQUEST_STATUS.DRAFT,
      ORDER_STATUS.CANCELLED,
      CONTENT_STATUS.ARCHIVED,
      AFFILIATE_EARNING_STATUS.VOID,
    ],
  },
  {
    tone: 'info',
    statuses: [
      REQUEST_STATUS.OPEN,
      ORDER_STATUS.IN_PROGRESS,
      CONTENT_STATUS.UNDER_REVIEW,
      PAYMENT_STATUS.HELD,
    ],
  },
  {
    tone: 'warning',
    statuses: [
      ORDER_STATUS.PENDING_PAYMENT,
      ORDER_STATUS.REVISION_REQUESTED,
      CONTENT_STATUS.RESTRICTED,
      ACCOUNT_STATUS.SUSPENDED,
    ],
  },
  {
    tone: 'success',
    statuses: [
      ORDER_STATUS.COMPLETED,
      CONTENT_STATUS.APPROVED,
      PAYMENT_STATUS.RELEASED,
      PAYOUT_STATUS.PAID,
    ],
  },
  {
    tone: 'error',
    statuses: [
      PAYMENT_STATUS.FAILED,
      CONTENT_STATUS.REJECTED,
      ORDER_STATUS.DISPUTED,
      ACCOUNT_STATUS.BLACKLISTED,
    ],
  },
  {
    tone: 'brand',
    statuses: [
      REQUEST_STATUS.AWARDED,
      PROPOSAL_STATUS.SHORTLISTED,
      CONTENT_STATUS.PUBLISHED,
      TRANSACTION_TYPE.COMMISSION,
    ],
  },
]

const toneColor = (theme, tone) =>
  ({
    info: theme.palette.info,
    warning: theme.palette.warning,
    success: theme.palette.success,
    error: theme.palette.error,
    brand: theme.palette.primary,
  })[tone] ?? { main: theme.palette.text.secondary, dark: theme.palette.text.primary }

function ToneChip({ status }) {
  const meta = getStatusMeta(status)
  return (
    <Tooltip title={meta.description}>
      <Box
        component="span"
        sx={(theme) => {
          const color = toneColor(theme, meta.tone)
          return {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1.25,
            py: 0.5,
            borderRadius: 999,
            bgcolor: alpha(color.main, 0.12),
            color: color.dark,
            ...theme.typography.caption,
            fontWeight: 600,
          }
        }}
      >
        <Box
          component="span"
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: 'currentColor',
          }}
        />
        {meta.label}
      </Box>
    </Tooltip>
  )
}

const AVATAR_SAMPLES = [
  'Ava Martinez',
  'Marcus Bell',
  'Verde Kitchen',
  'Nimbus Fitness',
  'Atlas Travel Co',
]

const IMAGE_SAMPLES = [
  CATEGORY_ID.FOOD_BEVERAGE,
  CATEGORY_ID.TECHNOLOGY_SAAS,
  CATEGORY_ID.FITNESS_WELLNESS,
]

const SAMPLE_ISO_DATE = '2026-03-04T09:30:00Z'

const FORMATTER_SAMPLES = [
  ['formatCurrency(1250)', formatCurrency(1250)],
  ['formatCurrency(12500, "USD", { compact: true })', formatCurrency(12500, 'USD', { compact: true })],
  ['formatNumberCompact(12500)', formatNumberCompact(12500)],
  ['formatPercent(0.2)', formatPercent(0.2)],
  [`formatDate('${SAMPLE_ISO_DATE}')`, formatDate(SAMPLE_ISO_DATE)],
  [`formatRelativeTime('${SAMPLE_ISO_DATE}')`, formatRelativeTime(SAMPLE_ISO_DATE)],
]

function DomainDemo() {
  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
          Status tones — STATUS_META
        </Typography>
        <Stack spacing={1.5}>
          {TONE_SAMPLES.map((group) => (
            <Stack
              key={group.tone}
              direction="row"
              spacing={1.5}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ width: 64, flexShrink: 0 }}
              >
                {group.tone}
              </Typography>
              {group.statuses.map((status) => (
                <ToneChip key={status} status={status} />
              ))}
            </Stack>
          ))}
        </Stack>
      </Box>

      <Box>
        <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
          Order state machine
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          nextStates(ORDER_STATUS_MACHINE, &apos;{ORDER_STATUS.DELIVERED}&apos;)
        </Typography>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
          {nextStates(ORDER_STATUS_MACHINE, ORDER_STATUS.DELIVERED).map((status) => (
            <ToneChip key={status} status={status} />
          ))}
        </Stack>
      </Box>

      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
          Generated avatars — avatarDataUri
        </Typography>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            {AVATAR_SAMPLES.map((name) => (
              <Stack key={name} spacing={0.75} alignItems="center" sx={{ width: 96 }}>
                <Box
                  component="img"
                  src={avatarDataUri(name)}
                  alt={`Initials avatar for ${name}`}
                  sx={{ width: 56, height: 56, borderRadius: '50%' }}
                />
                <Typography variant="caption" color="text.secondary" align="center">
                  {name}
                </Typography>
              </Stack>
            ))}
          </Stack>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            {AVATAR_TINT_NAMES.map((tint) => (
              <Stack key={tint} spacing={0.75} alignItems="center" sx={{ width: 96 }}>
                <Box
                  component="img"
                  src={avatarDataUri('Bloom Coffee', tint)}
                  alt={`Initials avatar in the ${tint} tint`}
                  sx={{ width: 40, height: 40, borderRadius: 1 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {tint}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Stack>
      </Box>

      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
          Seeded imagery — imageUrl / CATEGORY_IMAGE_SEEDS
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          }}
        >
          {IMAGE_SAMPLES.map((categoryId) => {
            const category = getFallbackCategory(categoryId)
            return (
              <Paper key={categoryId} variant="outlined" sx={{ overflow: 'hidden' }}>
                <Box
                  component="img"
                  src={categoryImageUrl(categoryId, 400, 260)}
                  alt={`Placeholder photography for the ${category.name} category`}
                  sx={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }}
                />
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ px: 2, py: 1.5 }}
                >
                  <Icon icon={category.icon} width={20} />
                  <Typography variant="subtitle2">{category.name}</Typography>
                </Stack>
              </Paper>
            )
          })}
        </Box>
      </Box>

      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
          Formatters
        </Typography>
        <Stack spacing={0.75}>
          {FORMATTER_SAMPLES.map(([expression, result]) => (
            <Stack
              key={expression}
              direction={{ xs: 'column', sm: 'row' }}
              spacing={{ xs: 0, sm: 2 }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  minWidth: 320,
                }}
              >
                {expression}
              </Typography>
              <Typography variant="body2">{result}</Typography>
            </Stack>
          ))}
        </Stack>
      </Box>
    </Stack>
  )
}

function GallerySection({ title, caption, children }) {
  return (
    <Box component="section">
      <Typography variant="overline" color="text.secondary" component="p">
        {title}
      </Typography>
      {caption ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {caption}
        </Typography>
      ) : (
        <Box sx={{ mb: 3 }} />
      )}
      {children}
    </Box>
  )
}

function Swatch({ label, value, background }) {
  return (
    <Stack spacing={0.75}>
      <Box
        role="img"
        aria-label={`${label} color swatch`}
        sx={{
          height: 64,
          borderRadius: 1,
          background: background ?? value,
          border: 1,
          borderColor: 'divider',
        }}
      />
      <Typography variant="subtitle2">{label}</Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
      >
        {value}
      </Typography>
    </Stack>
  )
}

function TabsDemo() {
  const [tab, setTab] = useState(0)
  return (
    <Tabs
      value={tab}
      onChange={(event, next) => setTab(next)}
      aria-label="Sample dashboard tabs"
    >
      <Tab label="Overview" />
      <Tab label="Proposals" />
      <Tab label="Orders" />
    </Tabs>
  )
}

function DialogDemo() {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  return (
    <>
      <Button variant="outlined" onClick={() => setOpen(true)}>
        Open dialog
      </Button>
      <Dialog
        open={open}
        onClose={close}
        aria-labelledby="gallery-dialog-title"
      >
        <DialogTitle id="gallery-dialog-title">Accept this proposal?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Sample confirmation copy: accepting a proposal funds the order and
            notifies the creator. Radius 20, shadow level 3.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={close}>
            Cancel
          </Button>
          <Button variant="gradient" onClick={close}>
            Accept proposal
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

function SnackbarDemo() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outlined" onClick={() => setOpen(true)}>
        Show snackbar
      </Button>
      <Snackbar
        open={open}
        autoHideDuration={3000}
        onClose={() => setOpen(false)}
        message="Proposal sent — the buyer has been notified."
      />
    </>
  )
}

const MOTION_TILES = [
  { preset: 'fadeInUp', variants: fadeInUp, note: 'Section and card reveals' },
  { preset: 'scaleIn', variants: scaleIn, note: 'Dialogs and popovers' },
  { preset: 'fadeIn', variants: fadeIn, note: 'Low-emphasis content' },
  { preset: 'listItem', variants: listItem, note: 'Staggered list rows' },
]

function MotionDemo() {
  const [runId, setRunId] = useState(0)
  const prefersReducedMotion = useReducedMotion()
  return (
    <Stack spacing={2} alignItems="flex-start">
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
        <Button
          variant="outlined"
          size="small"
          startIcon={<Icon icon="solar:restart-linear" />}
          onClick={() => setRunId((n) => n + 1)}
        >
          Replay
        </Button>
        {prefersReducedMotion && (
          <Typography variant="caption" color="text.secondary">
            Reduced motion is on — presets render statically.
          </Typography>
        )}
      </Stack>
      <Box
        key={runId}
        component={motion.div}
        variants={staggerContainer()}
        initial={prefersReducedMotion ? false : 'hidden'}
        animate="visible"
        sx={{
          display: 'grid',
          gap: 2,
          width: '100%',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(4, 1fr)',
          },
        }}
      >
        {MOTION_TILES.map((tile) => (
          <Paper
            key={tile.preset}
            component={motion.div}
            variants={tile.variants}
            variant="outlined"
            sx={{ p: 2.5 }}
          >
            <Typography variant="subtitle2" color="primary.dark">
              {tile.preset}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {tile.note}
            </Typography>
          </Paper>
        ))}
      </Box>
    </Stack>
  )
}

export default function DevDesignPage() {
  return (
    <Box component="main" sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 }, py: { xs: 4, md: 8 } }}>
        <Stack spacing={{ xs: 6, md: 8 }} divider={<Divider />}>
          {/* Header */}
          <Box component="header">
            <Stack
              direction="row"
              spacing={2}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
              sx={{ mb: 2 }}
            >
              <Logo variant="full" size={36} />
              <Chip label="Dev only" size="small" />
            </Stack>
            <Typography variant="h3" component="h1" gutterBottom>
              Design gallery
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 560 }}>
              Visual verification for the BetterBlue theme: locked tokens,
              typography, component overrides, and motion presets. Prompt 08
              moves this page to /dev/design.
            </Typography>
          </Box>

          {/* Colors */}
          <GallerySection
            title="Color tokens"
            caption="Neutral surfaces carry the UI; purple/pink appears as disciplined accents. The gradient is reserved for CTAs, the logo, and small highlights."
          >
            <Stack spacing={4}>
              {SWATCH_GROUPS.map((group) => (
                <Box key={group.title}>
                  <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
                    {group.title}
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gap: 2,
                      gridTemplateColumns: {
                        xs: 'repeat(2, 1fr)',
                        sm: 'repeat(3, 1fr)',
                        md: 'repeat(5, 1fr)',
                      },
                    }}
                  >
                    {group.items.map(([label, value]) => (
                      <Swatch key={label} label={label} value={value} />
                    ))}
                  </Box>
                </Box>
              ))}
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
                  Brand gradient
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gap: 2,
                    gridTemplateColumns: { xs: '1fr', md: '2fr 3fr' },
                  }}
                >
                  <Swatch
                    label="brandGradient"
                    value="135deg · #7C3AED → #EC4899"
                    background={brandGradient}
                  />
                </Box>
              </Box>
            </Stack>
          </GallerySection>

          {/* Typography */}
          <GallerySection
            title="Typography"
            caption="Plus Jakarta Sans 600–800 for headings and buttons; Inter 400–600 for body and UI. Headings scale up at the md breakpoint."
          >
            <Stack spacing={2.5}>
              {TYPE_SCALE.map(([variant, sample]) => (
                <Typography key={variant} variant={variant} component="p">
                  {sample}
                </Typography>
              ))}
            </Stack>
          </GallerySection>

          {/* Buttons */}
          <GallerySection
            title="Buttons"
            caption="Radius 10, weight 600, no uppercase. The gradient variant is the primary CTA treatment — hover lifts by 1px with a soft shadow. Tab through to check the focus ring."
          >
            <Stack spacing={3}>
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                <Button variant="gradient">Post a request</Button>
                <Button variant="contained">Contained</Button>
                <Button variant="outlined">Outlined</Button>
                <Button variant="text">Text</Button>
                <Button variant="contained" color="secondary">
                  Secondary
                </Button>
              </Stack>
              <Stack
                direction="row"
                spacing={2}
                flexWrap="wrap"
                useFlexGap
                alignItems="center"
              >
                <Button variant="contained" size="small">
                  Small
                </Button>
                <Button variant="contained" size="medium">
                  Medium
                </Button>
                <Button variant="contained" size="large">
                  Large
                </Button>
                <Button
                  variant="gradient"
                  size="large"
                  endIcon={<Icon icon="solar:arrow-right-linear" />}
                >
                  Find creators
                </Button>
              </Stack>
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                <Button
                  variant="outlined"
                  startIcon={<Icon icon="solar:camera-minimalistic-linear" />}
                >
                  With icon
                </Button>
                <Button variant="contained" disabled>
                  Disabled
                </Button>
                <Button variant="gradient" disabled>
                  Disabled gradient
                </Button>
              </Stack>
            </Stack>
          </GallerySection>

          {/* Inputs */}
          <GallerySection
            title="Inputs"
            caption="Outlined fields, radius 10, comfortable touch heights. The date picker runs on the @mui/x-date-pickers + dayjs adapter from AppProviders."
          >
            <Box
              sx={{
                display: 'grid',
                gap: 3,
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
              }}
            >
              <TextField
                label="Campaign name"
                helperText="Shown to creators on your request."
                fullWidth
              />
              <TextField
                select
                label="Content type"
                defaultValue="photo"
                fullWidth
              >
                <MenuItem value="photo">Photo</MenuItem>
                <MenuItem value="video">Video</MenuItem>
                <MenuItem value="bundle">Photo + video bundle</MenuItem>
              </TextField>
              <TextField
                label="Budget (USD)"
                error
                helperText="Enter a budget of at least $50."
                fullWidth
              />
              <TextField label="Disabled field" disabled fullWidth />
              <TextField
                label="Dense field"
                size="small"
                helperText="size='small' still keeps a 44px touch target."
                fullWidth
              />
              <DatePicker
                label="Deadline"
                slotProps={{ textField: { fullWidth: true } }}
              />
              <TextField
                label="Brief summary"
                multiline
                minRows={3}
                fullWidth
                helperText="Multiline fields share the same outline treatment."
                sx={{ gridColumn: { md: 'span 2' } }}
              />
            </Box>
          </GallerySection>

          {/* Chips */}
          <GallerySection
            title="Chips"
            caption="Soft tinted fills — brand colors use their locked tints, semantic colors a 12% wash with darkened text."
          >
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                <Chip label="Default" />
                <Chip label="Primary" color="primary" />
                <Chip label="Secondary" color="secondary" />
                <Chip label="Success" color="success" />
                <Chip label="Warning" color="warning" />
                <Chip label="Error" color="error" />
                <Chip label="Info" color="info" />
              </Stack>
              <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                <Chip label="Outlined" variant="outlined" />
                <Chip label="Primary outlined" variant="outlined" color="primary" />
                <Chip label="Deletable" color="primary" onDelete={() => {}} />
                <Chip label="Clickable" color="secondary" onClick={() => {}} />
              </Stack>
            </Stack>
          </GallerySection>

          {/* Alerts */}
          <GallerySection
            title="Alerts"
            caption="Standard severity alerts on soft tinted surfaces, radius 12."
          >
            <Stack spacing={2}>
              <Alert severity="success">Delivery accepted — payment released to the creator.</Alert>
              <Alert severity="info">Your request is live. Creators can now send proposals.</Alert>
              <Alert severity="warning">This order&apos;s deadline is in 48 hours.</Alert>
              <Alert severity="error">Payment could not be processed. Try another method.</Alert>
            </Stack>
          </GallerySection>

          {/* Cards & elevation */}
          <GallerySection
            title="Cards & elevation"
            caption="Cards: radius 16, 1px divider border, shadow level 1. Three subtle elevation levels only."
          >
            <Box
              sx={{
                display: 'grid',
                gap: 3,
                gridTemplateColumns: { xs: '1fr', md: '5fr 7fr' },
                alignItems: 'start',
              }}
            >
              <Card>
                <CardContent>
                  <Typography variant="overline" color="text.secondary" component="p">
                    Content request
                  </Typography>
                  <Typography variant="h6" component="h3" gutterBottom>
                    Lifestyle photos for a spring menu launch
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Neighborhood bistro looking for 12 natural-light photos of
                    seasonal dishes for social and website use.
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                    <Chip label="Photo" color="primary" size="small" />
                    <Chip label="Open" color="success" size="small" />
                  </Stack>
                </CardContent>
                <CardActions sx={{ px: 2, pb: 2 }}>
                  <Button variant="gradient" size="small">
                    Send proposal
                  </Button>
                  <Button variant="text" size="small">
                    View brief
                  </Button>
                </CardActions>
              </Card>
              <Box
                sx={{
                  display: 'grid',
                  gap: 3,
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                }}
              >
                {['z1', 'z2', 'z3'].map((level) => (
                  <Paper
                    key={level}
                    sx={{
                      p: 3,
                      boxShadow: (theme) => theme.customShadows[level],
                    }}
                  >
                    <Typography variant="subtitle2">customShadows.{level}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {level === 'z1' && 'Resting cards'}
                      {level === 'z2' && 'Hover & popovers'}
                      {level === 'z3' && 'Dialogs & toasts'}
                    </Typography>
                  </Paper>
                ))}
              </Box>
            </Box>
          </GallerySection>

          {/* Navigation & surfaces */}
          <GallerySection
            title="App bar, tabs & overlays"
            caption="Neutral blurless app bar, pill tab indicator, ink tooltip, dialog radius 20, inverse snackbar."
          >
            <Stack spacing={3}>
              <Box
                sx={{
                  borderRadius: 1,
                  overflow: 'hidden',
                  border: 1,
                  borderColor: 'divider',
                }}
              >
                <AppBar position="static">
                  <Toolbar sx={{ gap: 1.5 }}>
                    <Logo variant="mark" size={28} />
                    <Typography variant="h6" component="span">
                      Dashboard
                    </Typography>
                    <Box sx={{ flexGrow: 1 }} />
                    <Button variant="gradient" size="small">
                      New request
                    </Button>
                  </Toolbar>
                </AppBar>
              </Box>
              <TabsDemo />
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                <Tooltip title="Escrow protects both sides until delivery is accepted" arrow>
                  <Button variant="text">Hover or focus for tooltip</Button>
                </Tooltip>
                <DialogDemo />
                <SnackbarDemo />
              </Stack>
            </Stack>
          </GallerySection>

          {/* Table */}
          <GallerySection
            title="Table"
            caption="Divider borders, muted header row on the default background."
          >
            <TableContainer component={Paper} variant="outlined">
              <Table aria-label="Sample orders table" sx={{ minWidth: 560 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Project</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Budget</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {TABLE_ROWS.map((row) => (
                    <TableRow key={row.project} hover>
                      <TableCell>{row.project}</TableCell>
                      <TableCell>{row.type}</TableCell>
                      <TableCell>
                        <Chip
                          label={row.status.label}
                          color={row.status.color}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">{row.budget}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </GallerySection>

          {/* Skeletons */}
          <GallerySection
            title="Skeletons"
            caption="Rounded placeholders for loading states."
          >
            <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap" useFlexGap>
              <Skeleton variant="circular" width={48} height={48} />
              <Stack spacing={1} sx={{ minWidth: 200, flexGrow: 1, maxWidth: 320 }}>
                <Skeleton variant="text" sx={{ fontSize: '1rem' }} />
                <Skeleton variant="text" sx={{ fontSize: '0.875rem' }} width="60%" />
              </Stack>
              <Skeleton variant="rectangular" width={160} height={90} />
            </Stack>
          </GallerySection>

          {/* Logo */}
          <GallerySection
            title="Logo"
            caption="Temporary geometric mark — gradient tile with an abstract B, wordmark in Plus Jakarta Sans 700. Swappable via src/components/brand/Logo.jsx + src/assets/brand/."
          >
            <Stack spacing={3}>
              <Stack
                direction="row"
                spacing={4}
                alignItems="center"
                flexWrap="wrap"
                useFlexGap
              >
                <Logo variant="full" size={40} />
                <Logo variant="full" size={28} />
                <Logo variant="mark" size={48} />
                <Logo variant="mark" size={32} />
              </Stack>
              <Paper variant="outlined" sx={{ p: 3, maxWidth: 360 }}>
                <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1.5 }}>
                  On paper surface, as home link:
                </Typography>
                <Logo variant="full" size={32} asLink />
              </Paper>
            </Stack>
          </GallerySection>

          {/* Domain */}
          <GallerySection
            title="Domain"
            caption="Prompt 03 constants and utilities: status tones behind the future StatusChip, an order state machine read-out, locally generated avatars, seeded picsum imagery, and formatter output."
          >
            <DomainDemo />
          </GallerySection>

          {/* Motion */}
          <GallerySection
            title="Motion presets"
            caption="Framer variants from motionTokens (250ms base, ease-out-expo-like). Honors prefers-reduced-motion at the MotionConfig, CSS, and consumer layers."
          >
            <MotionDemo />
          </GallerySection>
        </Stack>
      </Container>
    </Box>
  )
}
