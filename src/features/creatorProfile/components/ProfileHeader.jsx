import { useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { visuallyHidden } from '@mui/utils'
import { Link as RouterLink } from 'react-router-dom'

import RatingStars from '@/components/data-display/RatingStars'
import UserAvatar from '@/components/data-display/UserAvatar'
import { useToast } from '@/components/feedback/ToastProvider'
import { brandGradient } from '@/theme/palette'
import { formatCurrency, formatDate, formatNumber } from '@/utils/formatters'

// The top of a creator's storefront: who they are, what they promise, the proof
// behind it, and the one action a buyer came for.
//
// Composition is a tinted band with the avatar overlapping it — editorial
// rather than boxy — and it holds together from 360px (everything stacked,
// actions in the page's sticky bar) to 1200px (identity left, actions right).

/** Banner height per breakpoint. The avatar overlaps its lower edge. */
const BANNER_HEIGHT = { xs: 96, sm: 128, md: 160 }

/** Avatar diameter per breakpoint — kept in sync with the overlap below. */
const AVATAR_SIZE = { xs: 88, md: 112 }

/** How far the avatar rides up over the banner. */
const AVATAR_OVERLAP = { xs: -5.5, md: -7 }

/** Month-and-year is the honest precision for a join date. */
const MEMBER_SINCE_FORMAT = 'MMM YYYY'

/**
 * The banner tint. `brandGradient` is the locked token (00 §6) and it is
 * reserved for accents, so it is painted on a layer at low opacity rather than
 * washing the surface — the header stays a paper surface with a hint of brand.
 */
const bannerSx = {
  position: 'relative',
  height: BANNER_HEIGHT,
  borderRadius: 3,
  overflow: 'hidden',
  bgcolor: 'primary.surface',
  '&::after': {
    content: '""',
    position: 'absolute',
    inset: 0,
    backgroundImage: brandGradient,
    opacity: 0.16,
  },
}

/** One icon-and-text fact in the meta row. */
function MetaItem({ icon, children }) {
  if (!children) return null
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: 'text.secondary' }}>
      <Box aria-hidden="true" sx={{ display: 'flex', flexShrink: 0 }}>
        <Icon icon={icon} width={16} />
      </Box>
      <Typography variant="body2" component="span">
        {children}
      </Typography>
    </Stack>
  )
}

/**
 * The header's buttons, rendered inline from md up and inside the page's
 * `StickyActionBar` below it — one definition, so the two can never drift.
 *
 * @param {object} props
 * @param {object} props.cta the result of `useCreatorRequestCta`
 * @param {boolean} [props.fullWidth=false] stretch the buttons (mobile bar)
 * @param {() => void} [props.onReport] opens the report dialog (Prompt 30). The
 *   affordance lives in an overflow menu rather than beside "Share": reporting
 *   is a thing a visitor should be able to find, not a thing the page suggests.
 */
export function ProfileActions({ cta, fullWidth = false, onReport }) {
  const toast = useToast()
  const [menuAnchor, setMenuAnchor] = useState(null)

  // In the mobile bar two buttons share 360px, and the leading icons are what
  // push "Start a request" onto a second line. The label is the affordance;
  // the icon is decoration, so the icon is what goes.
  const showIcons = !fullWidth
  const labelSx = { whiteSpace: 'nowrap' }

  const share = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Profile link copied', {
        description: 'Paste it wherever your team compares creators.',
      })
    } catch {
      // Clipboard access is permission-gated and absent over plain HTTP, so a
      // refusal is expected rather than exceptional — show the link instead of
      // an error nobody can act on.
      toast.info('Copy this profile link', { description: url })
    }
  }

  const requestButton = cta.isVisible ? (
    <Button
      variant="gradient"
      size="large"
      fullWidth={fullWidth}
      disabled={cta.isDisabled}
      startIcon={showIcons ? <Icon icon="tabler:sparkles" width={18} /> : undefined}
      sx={labelSx}
      {...(cta.isDisabled ? null : { component: RouterLink, to: cta.to, state: cta.state })}
    >
      {cta.label}
    </Button>
  ) : null

  return (
    <>
      {cta.isDisabled && cta.isVisible ? (
        // A disabled button takes no pointer events, so the tooltip listens on a
        // wrapper — and the reason is also written out for assistive tech,
        // which never sees a tooltip on an unfocusable control.
        <Tooltip title={cta.disabledReason ?? ''}>
          <Box sx={{ display: 'inline-flex', width: fullWidth ? '100%' : 'auto' }}>
            {requestButton}
            <Box component="span" sx={visuallyHidden}>
              {cta.disabledReason}
            </Box>
          </Box>
        </Tooltip>
      ) : (
        requestButton
      )}

      <Button
        variant="outlined"
        size="large"
        fullWidth={fullWidth}
        onClick={share}
        startIcon={showIcons ? <Icon icon="tabler:share-2" width={18} /> : undefined}
        sx={labelSx}
      >
        Share
      </Button>

      {onReport ? (
        <>
          <IconButton
            aria-label="More options for this profile"
            aria-haspopup="menu"
            aria-expanded={menuAnchor ? true : undefined}
            onClick={(event) => setMenuAnchor(event.currentTarget)}
            sx={{ width: 44, height: 44, alignSelf: 'center', flexShrink: 0 }}
          >
            <Icon icon="tabler:dots-vertical" width={20} />
          </IconButton>
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem
              onClick={() => {
                setMenuAnchor(null)
                onReport()
              }}
            >
              <ListItemIcon>
                <Icon icon="solar:flag-linear" width={18} />
              </ListItemIcon>
              <ListItemText primary="Report this profile" />
            </MenuItem>
          </Menu>
        </>
      ) : null}
    </>
  )
}

/**
 * @param {object} props
 * @param {object} props.profile the `creatorProfiles` record
 * @param {Object<string, string>} [props.categoryNames] category id → display name
 * @param {object} props.cta the result of `useCreatorRequestCta`
 * @param {() => void} [props.onReport] opens the report dialog (Prompt 30)
 */
export default function ProfileHeader({ profile, categoryNames = {}, cta, onReport }) {
  const rating = Number(profile.ratingAvg) || 0
  const ratingCount = Number(profile.ratingCount) || 0
  const completedOrders = Number(profile.completedOrders) || 0
  const responseHours = Number(profile.responseTimeHours) || 0
  const categories = profile.categories ?? []

  return (
    <Box component="header">
      <Box sx={bannerSx} />

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={{ xs: 2, md: 3 }}
        alignItems={{ xs: 'flex-start', md: 'flex-end' }}
        justifyContent="space-between"
        sx={{ px: { xs: 0, sm: 2 } }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 1.5, sm: 2.5 }}
          alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
          sx={{ minWidth: 0 }}
        >
          <UserAvatar
            name={profile.displayName}
            size="xl"
            sx={{
              width: AVATAR_SIZE,
              height: AVATAR_SIZE,
              mt: AVATAR_OVERLAP,
              border: 4,
              borderColor: 'background.paper',
              boxShadow: (theme) => theme.customShadows.z1,
              flexShrink: 0,
            }}
          />

          <Box sx={{ minWidth: 0, pt: { xs: 0, sm: 1 } }}>
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
              <Typography variant="h4" component="h1" sx={{ minWidth: 0 }}>
                {profile.displayName}
              </Typography>
              {profile.verified ? (
                <>
                  <Box aria-hidden="true" sx={{ display: 'flex', color: 'primary.main' }}>
                    <Icon icon="tabler:rosette-discount-check-filled" width={24} />
                  </Box>
                  <Box component="span" sx={visuallyHidden}>
                    Verified creator
                  </Box>
                </>
              ) : null}
            </Stack>

            {profile.tagline ? (
              <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5, maxWidth: '60ch' }}>
                {profile.tagline}
              </Typography>
            ) : null}

            <Stack
              direction="row"
              spacing={2}
              flexWrap="wrap"
              useFlexGap
              component="ul"
              // A plain list of facts: the bullets are the icons, so the list
              // semantics are kept and the markers are not.
              sx={{ listStyle: 'none', m: 0, mt: 1.5, p: 0 }}
            >
              {[
                { icon: 'tabler:map-pin', text: profile.location },
                {
                  icon: 'tabler:clock',
                  text: responseHours > 0 ? `Responds in ~${formatNumber(responseHours)}h` : null,
                },
                {
                  icon: 'tabler:calendar',
                  text: profile.createdAt
                    ? `Member since ${formatDate(profile.createdAt, MEMBER_SINCE_FORMAT)}`
                    : null,
                },
              ]
                .filter((fact) => Boolean(fact.text))
                .map((fact) => (
                  <Box component="li" key={fact.icon}>
                    <MetaItem icon={fact.icon}>{fact.text}</MetaItem>
                  </Box>
                ))}
            </Stack>

            {categories.length > 0 ? (
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
                {categories.map((categoryId) => (
                  <Chip
                    key={categoryId}
                    label={categoryNames[categoryId] ?? categoryId}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Stack>
            ) : null}
          </Box>
        </Stack>

        {/* Below md these live in the page's StickyActionBar instead. */}
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ display: { xs: 'none', md: 'flex' }, flexShrink: 0, pb: 0.5 }}
        >
          <ProfileActions cta={cta} onReport={onReport} />
        </Stack>
      </Stack>

      <Stack
        direction="row"
        spacing={{ xs: 2, sm: 4 }}
        flexWrap="wrap"
        useFlexGap
        alignItems="center"
        sx={{
          mt: 3,
          px: { xs: 2, sm: 3 },
          py: 2,
          borderRadius: 2,
          border: 1,
          borderColor: 'divider',
          bgcolor: 'primary.surface',
        }}
      >
        {ratingCount > 0 ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <RatingStars value={rating} size="sm" showValue={false} />
            <Typography variant="subtitle1" component="p">
              {rating.toFixed(1)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ({formatNumber(ratingCount)} {ratingCount === 1 ? 'review' : 'reviews'})
            </Typography>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No reviews yet
          </Typography>
        )}

        <Typography variant="body2" color="text.secondary">
          <Box component="span" sx={{ color: 'text.primary', fontWeight: 700 }}>
            {formatNumber(completedOrders)}
          </Box>{' '}
          {completedOrders === 1 ? 'order' : 'orders'} completed
        </Typography>

        <Typography variant="body2" color="text.secondary">
          From{' '}
          <Box component="span" sx={{ color: 'text.primary', fontWeight: 700 }}>
            {formatCurrency(profile.startingPrice, profile.currency, { hideDecimals: true })}
          </Box>
        </Typography>
      </Stack>
    </Box>
  )
}
