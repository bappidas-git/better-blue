import { forwardRef, useId } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import Slide from '@mui/material/Slide'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'

// The one dialog every feature uses — 00 §12: modal at md and up, full-screen
// slide-up sheet below it (rounded top 20 per 00 §6). Focus trap, Escape, and
// focus return to the trigger are MUI Dialog behaviors; this wrapper adds the
// standard header, the scrollable body, and the sticky footer.

const SlideUp = forwardRef(function SlideUp(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />
})

/**
 * @param {object} props
 * @param {boolean} props.open whether the dialog is shown
 * @param {(event: object, reason: string) => void} props.onClose called by the close
 *   button, backdrop click, and Escape — always wire it or the dialog cannot be dismissed
 * @param {React.ReactNode} props.title heading text (also labels the dialog for AT)
 * @param {React.ReactNode} [props.description] optional supporting line under the title
 * @param {React.ReactNode} props.children body content (scrolls when it overflows)
 * @param {React.ReactNode} [props.actions] footer buttons, right-aligned and sticky
 * @param {'xs'|'sm'|'md'|'lg'|'xl'} [props.maxWidth='sm'] desktop width cap
 * @param {boolean} [props.fullWidth=true] stretch to `maxWidth` on desktop
 * @param {boolean} [props.hideCloseButton=false] drop the header close button
 * @param {boolean} [props.disableEscapeKeyDown=false] block Escape (use sparingly)
 * @param {React.ReactNode} [props.headerAction] extra control shown left of the close button
 */
export default function ResponsiveDialog({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  maxWidth = 'sm',
  fullWidth = true,
  hideCloseButton = false,
  disableEscapeKeyDown = false,
  headerAction,
  ...rest
}) {
  const theme = useTheme()
  const isSheet = useMediaQuery(theme.breakpoints.down('md'))
  const baseId = useId()
  const titleId = `${baseId}-title`
  const descriptionId = `${baseId}-description`

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isSheet}
      fullWidth={fullWidth}
      maxWidth={maxWidth}
      scroll="paper"
      disableEscapeKeyDown={disableEscapeKeyDown}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      TransitionComponent={isSheet ? SlideUp : undefined}
      PaperProps={{
        sx: isSheet
          ? {
              // Bottom sheet: sits just below the top edge so the 20px
              // rounded corners stay visible while it still fills the screen.
              mt: 3,
              height: 'calc(100% - 24px)',
              borderRadius: '20px 20px 0 0',
            }
          : undefined,
      }}
      {...rest}
    >
      <DialogTitle
        id={titleId}
        component="div"
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
          pb: description ? 1 : 2,
        }}
      >
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h6" component="h2">
            {title}
          </Typography>
          {description ? (
            <Typography
              id={descriptionId}
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5 }}
            >
              {description}
            </Typography>
          ) : null}
        </Box>
        <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0, mt: -0.5, mr: -1 }}>
          {headerAction}
          {hideCloseButton ? null : (
            <IconButton
              aria-label="Close dialog"
              onClick={(event) => onClose?.(event, 'closeButtonClick')}
              size="small"
              sx={{ width: 40, height: 40 }}
            >
              <Icon icon="tabler:x" width={20} />
            </IconButton>
          )}
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ py: 2.5 }}>
        {children}
      </DialogContent>

      {actions ? (
        <DialogActions
          sx={{
            px: 3,
            py: 2,
            gap: 1,
            // Safe-area padding keeps the footer clear of the home indicator
            // when the sheet is full-screen on a phone.
            pb: { xs: 'max(16px, env(safe-area-inset-bottom))', md: 2 },
            bgcolor: 'background.paper',
          }}
        >
          {actions}
        </DialogActions>
      ) : null}
    </Dialog>
  )
}
