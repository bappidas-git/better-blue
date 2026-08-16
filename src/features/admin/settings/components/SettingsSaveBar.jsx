import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import { BOTTOM_NAV_HEIGHT } from '@/layouts/dashboard/MobileBottomNav'

// The dirty-state bar — Prompt 35 §4.1, §6 ("no accidental-save paths").
//
// It exists because a settings form has no natural submit: there is no "next"
// step to press, and an auto-save would reprice the marketplace on a keystroke.
// So nothing is written until the reader says so, and while anything is unsaved
// this bar is on screen saying how much.
//
// **It only renders when something changed.** A bar that is always there stops
// being a signal; one that appears the moment a value moves *is* the signal.
//
// Sticky rather than fixed, so it rides at the bottom of the settings column
// and never covers another page's content. Below `md` it is lifted clear of the
// console's fixed bottom nav — a sticky `bottom: 0` sticks to the *viewport*,
// which on a phone is exactly where that bar already is, so the offset is the
// only thing keeping "Save" tappable (00 §12/§13).

/**
 * @param {object} props
 * @param {number} props.count how many fields differ from what is stored
 * @param {() => void} props.onSave opens the confirmation summary
 * @param {() => void} props.onDiscard puts every field back
 * @param {boolean} [props.isSaving] disables both buttons and shows progress
 * @param {boolean} [props.hasErrors] something is invalid — saving is blocked
 *   and the bar says which way out is available
 */
export default function SettingsSaveBar({ count, onSave, onDiscard, isSaving = false, hasErrors = false }) {
  if (count <= 0) return null

  const label = `${count} unsaved ${count === 1 ? 'change' : 'changes'}`

  return (
    <Box
      role="status"
      sx={{
        position: 'sticky',
        bottom: {
          xs: `calc(${BOTTOM_NAV_HEIGHT + 1}px + env(safe-area-inset-bottom))`,
          md: 0,
        },
        zIndex: (theme) => theme.zIndex.appBar - 1,
        mt: 2,
        mx: { xs: -2, sm: -3, md: -4 },
        px: { xs: 2, sm: 3, md: 4 },
        py: 1.5,
        bgcolor: 'background.paper',
        borderTop: 1,
        borderColor: 'divider',
        boxShadow: (theme) => theme.shadows[1],
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          <Box
            aria-hidden="true"
            sx={{ display: 'flex', color: hasErrors ? 'error.main' : 'warning.main' }}
          >
            <Icon icon={hasErrors ? 'solar:danger-triangle-linear' : 'solar:pen-new-square-linear'} width={20} />
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {label}
            {hasErrors ? (
              <Box component="span" sx={{ color: 'error.main', fontWeight: 400 }}>
                {' '}
                — fix the highlighted fields to save
              </Box>
            ) : null}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1.5} sx={{ '& > *': { minHeight: 44 } }}>
          <Button
            onClick={onDiscard}
            color="inherit"
            variant="outlined"
            disabled={isSaving}
            sx={{ flexGrow: { xs: 1, sm: 0 } }}
          >
            Discard
          </Button>
          <Button
            onClick={onSave}
            variant="gradient"
            disabled={isSaving || hasErrors}
            sx={{ flexGrow: { xs: 1, sm: 0 } }}
            startIcon={<Icon icon="solar:diskette-linear" width={18} aria-hidden="true" />}
          >
            {isSaving ? 'Saving…' : 'Review and save'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  )
}
