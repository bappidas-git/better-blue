import { useId, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import StatusChip from '@/components/data-display/StatusChip'
import { imageUrl, IMAGE_SIZES } from '@/constants/images'
import { CONTENT_STATUS, STATUS_META, VISIBILITY } from '@/constants/statuses'
import { CONTENT_TYPE_ICONS } from '@/features/creatorProfile/utils/portfolioFilters'
import { paths } from '@/routes/paths'
import {
  canArchivePortfolioItem,
  canEditPortfolioItem,
  canSetPortfolioVisibility,
  canSubmitPortfolioItem,
} from '@/services/portfolioService'
import { formatDate } from '@/utils/formatters'

import RejectionBanner from './RejectionBanner'
import VisibilityToggle, { VisibilityBadge } from './VisibilityToggle'

// One piece of sample work, with the management chrome around it.
//
// The tile itself is the public gallery's (Prompt 13): a 4:3 box reserved
// before the photograph lands, the same type badge, the same rounded corners —
// so a creator recognises their own storefront in this grid. Everything else is
// the half a buyer never sees: where the item stands, whether it is actually
// visible, and the menu of what can be done to it next.
//
// Which actions exist is not decided here. `portfolioService` reads them off
// `CONTENT_STATUS_MACHINE`, so a menu can never offer a move the service would
// refuse — the card only decides how they look.

/** Matches the public gallery so the two grids read as one product (§6). */
const TILE_RATIO = '4 / 3'

const THUMB = IMAGE_SIZES.thumbnail

/** The best answer to "when did I last touch this?" the record can give. */
const lastTouched = (item) =>
  item.updatedAt ?? item.publishedAt ?? item.submittedAt ?? item.createdAt

/** Decisions that come with something to read and something to fix. */
const DECIDED_AGAINST = [
  CONTENT_STATUS.REVISION_REQUIRED,
  CONTENT_STATUS.REJECTED,
  CONTENT_STATUS.RESTRICTED,
]

/**
 * What "in review" means, said for a portfolio.
 *
 * `STATUS_META` descriptions are shared across every enum that uses the value —
 * `submitted` also belongs to proposals and deliveries, so its wording ("waiting
 * on a response") is deliberately generic. A creator looking at their own work
 * wants the queue explained, so the card carries its own copy (00 §9 sanctions
 * exactly this for context-specific wording).
 */
const WAITING_COPY = {
  [CONTENT_STATUS.SUBMITTED]: 'In the review queue. Nothing to do — we will let you know.',
  [CONTENT_STATUS.UNDER_REVIEW]: 'A reviewer is working through this now.',
  [CONTENT_STATUS.APPROVED]: 'Approved. It goes live on your profile shortly.',
}

/**
 * @param {object} props
 * @param {object} props.item a `portfolioItems` record
 * @param {object} [props.review] the `moderationReviews` case behind it
 * @param {string} [props.categoryName] resolved category display name
 * @param {() => void} [props.onPreview] opens the item in the viewer
 * @param {() => void} [props.onEdit] opens the editor
 * @param {() => void} [props.onSubmit] sends it for review
 * @param {() => void} [props.onArchive] retires it
 * @param {(next: string) => void} [props.onVisibilityChange] flips visibility
 * @param {boolean} [props.busy=false] an action on this card is in flight
 */
export default function PortfolioManageCard({
  item,
  review,
  categoryName,
  onPreview,
  onEdit,
  onSubmit,
  onArchive,
  onVisibilityChange,
  busy = false,
}) {
  const [menuAnchor, setMenuAnchor] = useState(null)
  const titleId = useId()

  const isPublished = item.status === CONTENT_STATUS.PUBLISHED
  const isListed = (item.visibility ?? VISIBILITY.PUBLIC) === VISIBILITY.PUBLIC

  const canEdit = canEditPortfolioItem(item)
  // A published item's way back into review is *editing* it — offering a bare
  // "submit" would take live work off the profile in exchange for nothing.
  const canSubmit = canSubmitPortfolioItem(item) && !isPublished
  const canArchive = canArchivePortfolioItem(item)
  const canToggleVisibility = canSetPortfolioVisibility(item)
  const showDecision = DECIDED_AGAINST.includes(item.status)

  const closeMenu = () => setMenuAnchor(null)

  /** Every menu row closes the menu first: the dialog it opens wants the focus. */
  const run = (action) => () => {
    closeMenu()
    action?.()
  }

  const hasActions = canEdit || canSubmit || canArchive || canToggleVisibility

  return (
    <Card
      component="article"
      aria-labelledby={titleId}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        opacity: busy ? 0.6 : 1,
        transition: (theme) => theme.transitions.create('opacity', { duration: 150 }),
      }}
    >
      <ButtonBase
        onClick={onPreview}
        aria-label={`Preview ${item.title}`}
        aria-haspopup="dialog"
        sx={{
          position: 'relative',
          width: '100%',
          aspectRatio: TILE_RATIO,
          display: 'block',
          bgcolor: 'primary.surface',
          // Unlisted and archived work is shown, but shown as set aside.
          filter: isPublished && !isListed ? 'grayscale(0.55)' : 'none',
        }}
      >
        <Box
          component="img"
          src={item.thumbnailUrl || imageUrl(item.id, THUMB.width, THUMB.height)}
          alt=""
          loading="lazy"
          decoding="async"
          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />

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
          <Icon icon={CONTENT_TYPE_ICONS[item.contentType] ?? 'tabler:photo'} width={13} />
          <Typography variant="caption" component="span" sx={{ fontWeight: 600 }}>
            {STATUS_META[item.contentType]?.label ?? item.contentType}
          </Typography>
        </Box>
      </ButtonBase>

      <CardContent
        sx={{
          p: { xs: 1.5, md: 2 },
          pb: { xs: 1.5, md: 2 },
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          flexGrow: 1,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <StatusChip status={item.status} size="sm" tooltip />
          {isPublished ? <VisibilityBadge visibility={item.visibility} /> : null}

          <Box sx={{ flexGrow: 1 }} />

          <IconButton
            size="small"
            onClick={(event) => setMenuAnchor(event.currentTarget)}
            disabled={busy}
            // Named after the item, because a grid of cards otherwise gives a
            // screen reader a dozen buttons all called "More".
            aria-label={`Actions for ${item.title}`}
            aria-haspopup="menu"
            aria-expanded={Boolean(menuAnchor)}
            // 44px under a thumb, 40 under a pointer (00 §13) — the same trade
            // `FilterChipGroup` makes for its chips.
            sx={{
              width: { xs: 44, md: 40 },
              height: { xs: 44, md: 40 },
              mr: -0.5,
              mt: -0.5,
            }}
          >
            <Icon icon="tabler:dots-vertical" width={20} />
          </IconButton>
        </Stack>

        <Box>
          <Typography
            id={titleId}
            variant="subtitle2"
            component="h3"
            sx={{
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
              overflow: 'hidden',
            }}
          >
            {item.title}
          </Typography>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: 'block' }}>
            {[categoryName, `Updated ${formatDate(lastTouched(item))}`]
              .filter(Boolean)
              .join(' · ')}
          </Typography>
        </Box>

        {showDecision ? (
          <RejectionBanner
            status={item.status}
            review={review}
            fallbackReason={item.rejectionReason}
            onFix={canEdit && onEdit ? onEdit : undefined}
          />
        ) : null}

        {/* Nothing is expected of a submission in the queue, so the card says
            that instead of leaving the status chip to imply it. */}
        {WAITING_COPY[item.status] ? (
          <Typography variant="caption" color="text.secondary">
            {WAITING_COPY[item.status]}
          </Typography>
        ) : null}
      </CardContent>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeMenu}
        MenuListProps={{ 'aria-label': `Actions for ${item.title}`, dense: false }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        // 44px rows: this menu is opened with a thumb as often as a mouse.
        slotProps={{ paper: { sx: { minWidth: 232, '& .MuiMenuItem-root': { minHeight: 44 } } } }}
      >
        {canEdit ? (
          <MenuItem onClick={run(onEdit)}>
            <ListItemIcon>
              <Icon icon="tabler:pencil" width={18} aria-hidden="true" />
            </ListItemIcon>
            <ListItemText
              primary="Edit"
              secondary={isPublished ? 'Re-submits for review' : undefined}
              primaryTypographyProps={{ variant: 'body2' }}
              secondaryTypographyProps={{ variant: 'caption' }}
            />
          </MenuItem>
        ) : null}

        {canSubmit ? (
          <MenuItem onClick={run(onSubmit)}>
            <ListItemIcon>
              <Icon icon="solar:shield-check-linear" width={18} aria-hidden="true" />
            </ListItemIcon>
            <ListItemText primary="Submit for review" primaryTypographyProps={{ variant: 'body2' }} />
          </MenuItem>
        ) : null}

        {canToggleVisibility ? (
          <VisibilityToggle
            visibility={item.visibility}
            onChange={(next) => {
              closeMenu()
              onVisibilityChange?.(next)
            }}
          />
        ) : null}

        {isPublished && isListed ? (
          <MenuItem
            component="a"
            href={paths.creatorProfile(item.creatorId)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={closeMenu}
          >
            <ListItemIcon>
              <Icon icon="solar:square-top-down-linear" width={18} aria-hidden="true" />
            </ListItemIcon>
            <ListItemText primary="View public profile" primaryTypographyProps={{ variant: 'body2' }} />
          </MenuItem>
        ) : null}

        {canArchive ? <Divider /> : null}
        {canArchive ? (
          <MenuItem onClick={run(onArchive)}>
            <ListItemIcon>
              <Icon icon="solar:archive-linear" width={18} aria-hidden="true" />
            </ListItemIcon>
            <ListItemText
              primary="Archive"
              secondary="Cannot be undone"
              primaryTypographyProps={{ variant: 'body2' }}
              secondaryTypographyProps={{ variant: 'caption' }}
            />
          </MenuItem>
        ) : null}

        {/* An empty menu would look broken. When there is genuinely nothing to
            do — in review, archived, restricted — the menu says why. */}
        {hasActions ? null : (
          <MenuItem disabled>
            <ListItemText
              primary={
                item.status === CONTENT_STATUS.ARCHIVED
                  ? 'Archived work cannot be changed'
                  : 'Nothing to do while this is under review'
              }
              primaryTypographyProps={{ variant: 'body2' }}
            />
          </MenuItem>
        )}
      </Menu>
    </Card>
  )
}
