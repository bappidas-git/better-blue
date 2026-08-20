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
  Divider,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material'

import Logo from '@/components/brand/Logo'
import StatusChip from '@/components/data-display/StatusChip'
import UserAvatar from '@/components/data-display/UserAvatar'
import AmbientGlow from '@/components/motion/AmbientGlow'
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
} from '@/constants'
import { brandGradient, glassBorder, palette } from '@/theme/palette'
import {
  formatCurrency,
  formatDate,
  formatNumberCompact,
  formatPercent,
  formatRelativeTime,
} from '@/utils/formatters'
import { nextStates } from '@/utils/stateMachine'
import GalleryBlock from './GalleryBlock'

// Tokens tab — the Prompt 02 theme verification (colors, type, component
// overrides) plus the Prompt 03 domain constants, now rendered with the real
// `StatusChip`/`UserAvatar` instead of the placeholder chips they replaced.

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
      ['secondary.lighter', palette.secondary.lighter],
      ['secondary.light', palette.secondary.light],
      ['secondary.main', palette.secondary.main],
      ['secondary.dark', palette.secondary.dark],
    ],
  },
  {
    title: 'Accent — magenta',
    items: [
      ['accent.surface', palette.accent.surface],
      ['accent.lighter', palette.accent.lighter],
      ['accent.light', palette.accent.light],
      ['accent.main', palette.accent.main],
      ['accent.dark', palette.accent.dark],
    ],
  },
  {
    title: 'Semantic — main fills the dot, dark paints the label',
    items: [
      ['success.main', palette.success.main],
      ['success.dark', palette.success.dark],
      ['warning.main', palette.warning.main],
      ['warning.dark', palette.warning.dark],
      ['error.main', palette.error.main],
      ['error.dark', palette.error.dark],
      ['info.main', palette.info.main],
      ['info.dark', palette.info.dark],
    ],
  },
  {
    title: 'Neutrals — page, paper, elevated',
    items: [
      ['background.default', palette.background.default],
      ['background.paper', palette.background.paper],
      ['background.elevated', palette.background.elevated],
      ['background.input', palette.background.input],
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
  [
    'body1',
    'Body 1 — Inter at 16px/1.6 for comfortable long-form reading across briefs, proposals, and policy pages.',
  ],
  ['body2', 'Body 2 — secondary copy, table cells, and helper contexts.'],
  ['button', 'Button — Plus Jakarta Sans 600, no uppercase'],
  ['caption', 'Caption — timestamps and metadata'],
  ['overline', 'Overline — eyebrow labels'],
]

const TABLE_ROWS = [
  {
    project: 'Aurora Skincare — product shoot',
    type: 'Photo',
    status: ORDER_STATUS.COMPLETED,
    budget: 480,
  },
  {
    project: 'Bloom Coffee — launch reels',
    type: 'Video',
    status: ORDER_STATUS.IN_PROGRESS,
    budget: 1250,
  },
  {
    project: 'Trailhead Fitness — UGC bundle',
    type: 'Bundle',
    status: CONTENT_STATUS.UNDER_REVIEW,
    budget: 860,
  },
]

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

/** Every placement AmbientGlow ships with, rendered side by side below. */
const AMBIENT_PLACEMENTS = ['hero', 'top', 'center', 'bottom']

const AVATAR_SAMPLES = ['Ava Martinez', 'Marcus Bell', 'Verde Kitchen', 'Nimbus Fitness', 'Atlas Travel Co']

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

/** A glow token is a shadow, not a fill — so it is shown lit rather than filled. */
function GlowSwatch({ label, value, shadowKey }) {
  return (
    <Stack spacing={0.75}>
      <Box
        role="img"
        aria-label={`${label} glow sample`}
        sx={{
          height: 64,
          borderRadius: 1,
          bgcolor: 'background.elevated',
          border: 1,
          borderColor: 'divider',
          boxShadow: (theme) => theme.customShadows[shadowKey],
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
    <Tabs value={tab} onChange={(event, next) => setTab(next)} aria-label="Sample dashboard tabs">
      <Tab label="Overview" />
      <Tab label="Proposals" />
      <Tab label="Orders" />
    </Tabs>
  )
}

export default function TokensGallery() {
  return (
    <Stack spacing={{ xs: 6, md: 8 }} divider={<Divider />}>
      <GalleryBlock
        title="Color tokens"
        caption="Dark only — three surfaces (page #0B0710, paper #151020, elevated #1D1530) carry the UI, and purple/pink/magenta appear as vibrant accents. The tints are alpha washes so they composite correctly on all three. The gradient is reserved for CTAs, the logo, and small highlights."
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
              Brand gradient & glow
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
              }}
            >
              <Swatch
                label="brandGradient"
                value="135deg · #A855F7 → #EC4899"
                background={brandGradient}
              />
              <GlowSwatch
                label="customShadows.glowPurple"
                value="0 0 24px rgba(168,85,247,0.35)"
                shadowKey="glowPurple"
              />
              <GlowSwatch
                label="customShadows.glowPink"
                value="0 0 24px rgba(236,72,153,0.30)"
                shadowKey="glowPink"
              />
            </Box>
          </Box>
        </Stack>
      </GalleryBlock>

      <GalleryBlock
        title="Surfaces, glass & animated gradients"
        caption="The V2 utilities from src/styles/global.css plus AmbientGlow. The gradient text and border sweep on an 8s loop; under prefers-reduced-motion they render as a static gradient. Glow is interactive emphasis only — never behind body copy."
      >
        <Stack spacing={4}>
          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
              .bb-gradient-text — display sizes only
            </Typography>
            <Typography variant="h2" component="p" className="bb-gradient-text">
              Content that converts
            </Typography>
          </Box>

          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
              .bb-gradient-border
            </Typography>
            <Box
              className="bb-gradient-border"
              sx={{ p: 3, maxWidth: 420, display: 'grid', gap: 0.5 }}
            >
              <Typography variant="subtitle2">Featured creator</Typography>
              <Typography variant="body2" color="text.secondary">
                A 1px animated gradient edge, drawn with a padding-box/border-box double
                background — no pseudo-element, no extra DOM.
              </Typography>
            </Box>
          </Box>

          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
              .bb-glass over AmbientGlow
            </Typography>
            <Box
              sx={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 3,
                minHeight: 240,
                display: 'grid',
                placeItems: 'center',
                p: { xs: 2, md: 4 },
                bgcolor: 'background.default',
              }}
            >
              <AmbientGlow placement="hero" intensity="strong" />
              <Box
                className="bb-glass"
                sx={{ position: 'relative', p: 3, maxWidth: 420, display: 'grid', gap: 0.5 }}
              >
                <Typography variant="subtitle2">Escrow-protected payment</Typography>
                <Typography variant="body2" color="text.secondary">
                  Glass needs something behind it to blur. Over a flat surface it degrades to a
                  4% white wash with a {glassBorder} hairline, which is still a valid card edge.
                </Typography>
              </Box>
            </Box>
          </Box>

          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
              AmbientGlow placements
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
              }}
            >
              {AMBIENT_PLACEMENTS.map((placement) => (
                <Box
                  key={placement}
                  sx={{
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: 2,
                    minHeight: 140,
                    border: 1,
                    borderColor: 'divider',
                    bgcolor: 'background.default',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <AmbientGlow placement={placement} intensity="medium" size="70%" />
                  <Typography
                    variant="caption"
                    sx={{ position: 'relative', fontFamily: 'ui-monospace, Menlo, monospace' }}
                  >
                    {placement}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Stack>
      </GalleryBlock>

      <GalleryBlock
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
      </GalleryBlock>

      <GalleryBlock
        title="Buttons"
        caption="Radius 10, weight 600, no uppercase. The gradient variant is the primary CTA treatment — it rests with a purple halo and lifts 1px into both glows on hover. Solid buttons sit on the deeper brand shade so white labels clear AA. Tab through to check the #C084FC focus ring."
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
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
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
            <Button variant="outlined" startIcon={<Icon icon="solar:camera-minimalistic-linear" />}>
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
      </GalleryBlock>

      <GalleryBlock
        title="Chips"
        caption="Soft tinted fills — a 14% wash of the hue with the brightened `light` shade as the label, which is the dark-theme inverse of the light theme's darkened text on a pale tint."
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
      </GalleryBlock>

      <GalleryBlock
        title="Alerts"
        caption="Standard severity alerts on dark tinted surfaces, radius 12. The icon inherits the label colour so each alert reads as one hue."
      >
        <Stack spacing={2}>
          <Alert severity="success">Delivery accepted — payment released to the creator.</Alert>
          <Alert severity="info">Your request is live. Creators can now send proposals.</Alert>
          <Alert severity="warning">This order&apos;s deadline is in 48 hours.</Alert>
          <Alert severity="error">Payment could not be processed. Try another method.</Alert>
        </Stack>
      </GalleryBlock>

      <GalleryBlock
        title="Cards & elevation"
        caption="Cards: radius 16 on the elevated surface, 1px glass border, shadow level 1. Cards that own a CardActionArea lift 3px into a purple glow on hover; static cards stay put. Three elevation levels only, driven by deep black rather than ink."
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
                Neighborhood bistro looking for 12 natural-light photos of seasonal dishes for
                social and website use.
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                <Chip label="Photo" color="primary" size="small" />
                <StatusChip status={REQUEST_STATUS.OPEN} size="sm" />
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
              <Paper key={level} sx={{ p: 3, boxShadow: (theme) => theme.customShadows[level] }}>
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
      </GalleryBlock>

      <GalleryBlock
        title="App bar, tabs & tooltip"
        caption="Translucent blurred app bar, gradient pill tab indicator, elevated tooltip. Dialogs and toasts live in the Components tab, built on ResponsiveDialog and ToastProvider."
      >
        <Stack spacing={3}>
          <Box sx={{ borderRadius: 1, overflow: 'hidden', border: 1, borderColor: 'divider' }}>
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
          <Tooltip title="Escrow protects both sides until delivery is accepted" arrow>
            <Button variant="text" sx={{ alignSelf: 'flex-start' }}>
              Hover or focus for tooltip
            </Button>
          </Tooltip>
        </Stack>
      </GalleryBlock>

      <GalleryBlock
        title="Table primitives"
        caption="Divider borders and an opaque elevated header row — opaque because DataTable's header is sticky. Rows tint purple on hover. Feature pages use DataTable (Components tab) rather than raw MUI tables."
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
                    <StatusChip status={row.status} size="sm" />
                  </TableCell>
                  <TableCell align="right">{formatCurrency(row.budget)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </GalleryBlock>

      <GalleryBlock
        title="Logo"
        caption="Temporary geometric mark — gradient tile with an abstract B, wordmark in Plus Jakarta Sans 700 with the neutral half on the light text token. Swappable via src/components/brand/Logo.jsx + src/assets/brand/."
      >
        <Stack spacing={3}>
          <Stack direction="row" spacing={4} alignItems="center" flexWrap="wrap" useFlexGap>
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
      </GalleryBlock>

      <GalleryBlock
        title="Domain tokens"
        caption="Prompt 03 constants rendered through the real components: every STATUS_META tone as a StatusChip, an order state machine read-out, generated avatars, seeded imagery, and formatter output."
      >
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
                    <StatusChip key={status} status={status} size="sm" tooltip />
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
                <StatusChip key={status} status={status} tooltip />
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
                    <UserAvatar name={name} size="lg" />
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
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 2, py: 1.5 }}>
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
      </GalleryBlock>
    </Stack>
  )
}
