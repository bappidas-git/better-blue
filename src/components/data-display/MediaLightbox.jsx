import { useCallback, useEffect, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Dialog from '@mui/material/Dialog'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { alpha, useTheme } from '@mui/material/styles'

// Full-screen viewer for portfolio items and order deliverables. Built on MUI
// Dialog, so the focus trap, Escape handling, and focus return to the trigger
// come for free (00 §13); this component adds ←/→ navigation, the thumbnail
// strip, and video playback.
//
// Every image item must carry `alt` — the viewer is often the only place a
// deliverable is seen at full size.

/**
 * @typedef {object} MediaItem
 * @property {string} [id] stable key
 * @property {'image'|'video'} [type='image'] media kind
 * @property {string} src media URL
 * @property {string} [alt] alt text — required for images
 * @property {string} [poster] video poster image
 * @property {React.ReactNode} [caption] caption shown under the media
 */

/**
 * @param {object} props
 * @param {boolean} props.open whether the viewer is shown
 * @param {MediaItem[]} props.items media to page through
 * @param {number} [props.index] controlled active index — pair with `onIndexChange`
 * @param {number} [props.defaultIndex=0] starting index when uncontrolled
 * @param {(index: number) => void} [props.onIndexChange] called when the active item changes
 * @param {() => void} props.onClose close handler (Escape, backdrop, close button)
 * @param {string} [props.title='Media viewer'] accessible dialog title
 */
export default function MediaLightbox({
  open,
  items = [],
  index,
  defaultIndex = 0,
  onIndexChange,
  onClose,
  title = 'Media viewer',
}) {
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const isControlled = typeof index === 'number'
  const [internalIndex, setInternalIndex] = useState(defaultIndex)

  const activeIndex = Math.min(
    Math.max(isControlled ? index : internalIndex, 0),
    Math.max(items.length - 1, 0)
  )
  const active = items[activeIndex]

  // Reopening always starts from the caller's chosen item.
  useEffect(() => {
    if (open && !isControlled) setInternalIndex(defaultIndex)
  }, [defaultIndex, isControlled, open])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const missing = items.filter((item) => (item.type ?? 'image') === 'image' && !item.alt)
    if (missing.length) {
      console.warn(
        `[MediaLightbox] ${missing.length} image item(s) are missing the required \`alt\` prop.`
      )
    }
  }, [items])

  const goTo = useCallback(
    (next) => {
      if (items.length === 0) return
      const wrapped = (next + items.length) % items.length
      if (!isControlled) setInternalIndex(wrapped)
      onIndexChange?.(wrapped)
    },
    [isControlled, items.length, onIndexChange]
  )

  const handleKeyDown = (event) => {
    if (items.length < 2) return
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      goTo(activeIndex + 1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      goTo(activeIndex - 1)
    }
  }

  const arrowSx = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: 44,
    height: 44,
    color: 'common.white',
    bgcolor: (muiTheme) => alpha(muiTheme.palette.common.black, 0.45),
    '&:hover': { bgcolor: (muiTheme) => alpha(muiTheme.palette.common.black, 0.65) },
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      onKeyDown={handleKeyDown}
      fullScreen={!isDesktop}
      fullWidth
      maxWidth="lg"
      aria-label={title}
      PaperProps={{ sx: { bgcolor: 'background.paper', overflow: 'hidden' } }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <Typography variant="subtitle2" sx={{ flexGrow: 1, minWidth: 0 }}>
          {title}
          {items.length > 1 ? (
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              {activeIndex + 1} of {items.length}
            </Typography>
          ) : null}
        </Typography>
        <IconButton aria-label="Close media viewer" onClick={onClose} sx={{ width: 44, height: 44 }}>
          <Icon icon="tabler:x" width={20} />
        </IconButton>
      </Stack>

      <Box
        sx={{
          position: 'relative',
          display: 'grid',
          placeItems: 'center',
          bgcolor: (muiTheme) => alpha(muiTheme.palette.text.primary, 0.94),
          minHeight: { xs: 260, md: 420 },
          p: { xs: 1, md: 2 },
        }}
      >
        {active ? (
          (active.type ?? 'image') === 'video' ? (
            <Box
              component="video"
              key={active.id ?? active.src}
              src={active.src}
              poster={active.poster}
              controls
              preload="metadata"
              sx={{ maxWidth: '100%', maxHeight: { xs: '55vh', md: '70vh' }, borderRadius: 1 }}
            />
          ) : (
            <Box
              component="img"
              key={active.id ?? active.src}
              src={active.src}
              alt={active.alt ?? ''}
              sx={{
                maxWidth: '100%',
                maxHeight: { xs: '55vh', md: '70vh' },
                objectFit: 'contain',
                borderRadius: 1,
              }}
            />
          )
        ) : (
          <Typography variant="body2" sx={{ color: 'common.white', py: 6 }}>
            Nothing to show here yet.
          </Typography>
        )}

        {items.length > 1 ? (
          <>
            <IconButton
              aria-label="Previous item"
              onClick={() => goTo(activeIndex - 1)}
              sx={{ ...arrowSx, left: 12 }}
            >
              <Icon icon="tabler:chevron-left" width={22} />
            </IconButton>
            <IconButton
              aria-label="Next item"
              onClick={() => goTo(activeIndex + 1)}
              sx={{ ...arrowSx, right: 12 }}
            >
              <Icon icon="tabler:chevron-right" width={22} />
            </IconButton>
          </>
        ) : null}
      </Box>

      {active?.caption ? (
        <Box sx={{ px: 2.5, py: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {active.caption}
          </Typography>
        </Box>
      ) : null}

      {isDesktop && items.length > 1 ? (
        <Stack
          direction="row"
          spacing={1}
          sx={{
            px: 2,
            py: 1.5,
            borderTop: 1,
            borderColor: 'divider',
            overflowX: 'auto',
          }}
        >
          {items.map((item, itemIndex) => (
            <ButtonBase
              key={item.id ?? `${item.src}-${itemIndex}`}
              onClick={() => goTo(itemIndex)}
              aria-label={`Show item ${itemIndex + 1}${item.alt ? `: ${item.alt}` : ''}`}
              aria-current={itemIndex === activeIndex}
              sx={{
                flexShrink: 0,
                width: 84,
                height: 56,
                borderRadius: 1.5,
                overflow: 'hidden',
                border: 2,
                borderColor: itemIndex === activeIndex ? 'primary.main' : 'transparent',
                opacity: itemIndex === activeIndex ? 1 : 0.65,
                transition: (muiTheme) => muiTheme.transitions.create('opacity'),
                '&:hover': { opacity: 1 },
              }}
            >
              {(item.type ?? 'image') === 'video' ? (
                <Box
                  sx={{
                    width: '100%',
                    height: '100%',
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: (muiTheme) => alpha(muiTheme.palette.text.primary, 0.08),
                    color: 'text.secondary',
                    backgroundImage: item.poster ? `url(${item.poster})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  <Icon icon="tabler:player-play-filled" width={18} />
                </Box>
              ) : (
                <Box
                  component="img"
                  src={item.src}
                  alt=""
                  sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}
            </ButtonBase>
          ))}
        </Stack>
      ) : null}
    </Dialog>
  )
}
