import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import { FEED_DEAL_STATUS } from '@/constants/feedStatus'

// The line that explains why a feed's reply button is gone (Storefront V2,
// `prompts-v2/08` §1).
//
// An **open** feed gets no banner: the composer under it is the message. The
// other two states are the ones where a creator needs a reason, and a reason
// they can read — not a disabled button and a tooltip (00 §12).
//
// Not a MUI `Alert`, because neither state is a semantic one. "Closed" is not a
// warning and "Delivered" is not information the reader must act on; both are
// simply where the deal got to, so the banner takes its tone from
// `FEED_DEAL_META` (neutral, info) the way `FeedDealChip` does rather than
// borrowing a colour that means something else in the rest of the product.

/** Copy and colour per state. `palette` is a `theme.palette` key, or `null`. */
const BANNER = {
  [FEED_DEAL_STATUS.CLOSED]: {
    icon: 'solar:lock-keyhole-minimalistic-linear',
    title: 'This deal is closed',
    body: 'The buyer is no longer taking replies on this feed. Everything else on BetterBlue is still open.',
    palette: null,
  },
  [FEED_DEAL_STATUS.DELIVERED]: {
    icon: 'solar:check-circle-linear',
    title: 'Delivered',
    body: 'The work on this feed was delivered and the engagement is finished.',
    palette: 'info',
  },
}

/**
 * @param {object} props
 * @param {'open'|'closed'|'delivered'} props.dealStatus
 * @returns {JSX.Element|null} `null` for an open feed
 */
export default function FeedStatusBanner({ dealStatus }) {
  const banner = BANNER[dealStatus]
  if (!banner) return null

  return (
    <Stack
      // `role="status"` rather than `alert`: it is the state of the page a
      // visitor just opened, not an interruption.
      role="status"
      direction="row"
      spacing={1.5}
      alignItems="flex-start"
      sx={{
        p: { xs: 2, sm: 2.25 },
        borderRadius: 'var(--bb-radius-lg)',
        border: '1px solid',
        // A container edge, so the neutral case takes the glass pair rather
        // than `divider` — that one is for content rules (docs/theme-v2.md §2).
        borderColor: (theme) =>
          banner.palette
            ? alpha(theme.palette[banner.palette].main, 0.32)
            : 'var(--bb-glass-border)',
        bgcolor: (theme) =>
          banner.palette
            ? alpha(theme.palette[banner.palette].main, 0.1)
            : 'var(--bb-glass-bg)',
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          display: 'flex',
          flexShrink: 0,
          pt: '2px',
          color: banner.palette ? `${banner.palette}.light` : 'text.secondary',
        }}
      >
        <Icon icon={banner.icon} width={20} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle2" component="p" sx={{ fontWeight: 700 }}>
          {banner.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {banner.body}
        </Typography>
      </Box>
    </Stack>
  )
}
