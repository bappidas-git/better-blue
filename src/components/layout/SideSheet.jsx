import { useId } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

// Right-hand drawer for detail peeks and filter panels — full-screen below md
// so it behaves like a page on a phone. Focus trap, Escape, and focus return
// come from MUI's Modal, same as ResponsiveDialog.

/**
 * @param {object} props
 * @param {boolean} props.open whether the sheet is shown
 * @param {(event: object, reason: string) => void} props.onClose backdrop click / Escape / close button
 * @param {React.ReactNode} props.title heading text (labels the sheet for AT)
 * @param {React.ReactNode} [props.description] optional supporting line under the title
 * @param {React.ReactNode} props.children body content (scrolls when it overflows)
 * @param {React.ReactNode} [props.actions] footer content, pinned to the bottom
 * @param {number} [props.width=420] desktop width in px (full width below md)
 * @param {'left'|'right'|'bottom'} [props.anchor='right'] which edge it slides
 *   from. `bottom` turns it into a bottom sheet and expects the caller to pass
 *   its own `PaperProps` — the default paper is sized for a side drawer
 *   (`features/feeds/components/FeedFilterSheet.jsx`)
 */
export default function SideSheet({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  width = 420,
  anchor = 'right',
  ...rest
}) {
  const baseId = useId()
  const titleId = `${baseId}-title`

  return (
    <Drawer
      open={open}
      onClose={onClose}
      anchor={anchor}
      aria-labelledby={titleId}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: width },
          maxWidth: '100%',
          borderRadius: 0,
          display: 'flex',
          flexDirection: 'column',
        },
      }}
      {...rest}
    >
      <Stack
        direction="row"
        spacing={1}
        alignItems="flex-start"
        sx={{
          px: { xs: 2, sm: 3 },
          py: 2,
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography id={titleId} variant="h6" component="h2">
            {title}
          </Typography>
          {description ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {description}
            </Typography>
          ) : null}
        </Box>
        <IconButton
          aria-label="Close panel"
          onClick={(event) => onClose?.(event, 'closeButtonClick')}
          size="small"
          sx={{ width: 40, height: 40, mt: -0.5, mr: -1 }}
        >
          <Icon icon="tabler:x" width={20} />
        </IconButton>
      </Stack>

      <Box sx={{ flexGrow: 1, overflowY: 'auto', px: { xs: 2, sm: 3 }, py: 2.5 }}>
        {children}
      </Box>

      {actions ? (
        <Stack
          direction="row"
          spacing={1}
          justifyContent="flex-end"
          sx={{
            px: { xs: 2, sm: 3 },
            py: 2,
            pb: { xs: 'max(16px, env(safe-area-inset-bottom))', sm: 2 },
            borderTop: 1,
            borderColor: 'divider',
            flexShrink: 0,
          }}
        >
          {actions}
        </Stack>
      ) : null}
    </Drawer>
  )
}
