import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'

// Bottom-pinned container for a page's primary actions — 00 §12 puts mobile
// detail-page CTAs in here. Adds the safe-area inset so buttons clear the home
// indicator, plus a top hairline so content scrolling underneath stays legible.

/**
 * @param {object} props
 * @param {React.ReactNode} props.children action buttons (give the primary one `fullWidth` on mobile)
 * @param {'sticky'|'fixed'} [props.position='sticky'] `fixed` pins it to the viewport;
 *   `sticky` keeps it inside the scrolling column it is rendered in
 * @param {boolean} [props.mobileOnly=false] hide from md up (desktop pages usually
 *   put the same actions in `PageHeader`)
 * @param {'flex-start'|'center'|'flex-end'|'space-between'} [props.justify='flex-end']
 *   horizontal distribution of the actions
 * @param {object} [props.sx] MUI system styles
 */
export default function StickyActionBar({
  children,
  position = 'sticky',
  mobileOnly = false,
  justify = 'flex-end',
  sx,
  ...rest
}) {
  return (
    <Box
      sx={{
        position,
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: (theme) => theme.zIndex.appBar - 1,
        display: mobileOnly ? { xs: 'block', md: 'none' } : 'block',
        bgcolor: 'background.paper',
        borderTop: 1,
        borderColor: 'divider',
        px: { xs: 2, md: 3 },
        pt: 1.5,
        pb: 'max(12px, env(safe-area-inset-bottom))',
        ...sx,
      }}
      {...rest}
    >
      <Stack
        direction="row"
        spacing={1.5}
        justifyContent={justify}
        alignItems="center"
        sx={{ '& > *': { minHeight: 44 } }}
      >
        {children}
      </Stack>
    </Box>
  )
}
