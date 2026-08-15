import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

// PLACEHOLDER SLOT — replaced in Prompt 27 (the notification centre).
//
// `users.notificationPrefs` already exists on every account (contract §6.2) and
// `notificationService.notify` already honours it, but the screen that edits it
// ships with the centre that consumes it. Rather than leave a hole in Settings,
// the card says what is coming and where the current behaviour stands.
//
// Prompt 27: replace the body of this component with the per-category
// switches — the Preferences card on every role's settings screen renders this
// slot, so all of them light up from one change.

export default function SettingsNotificationSlot() {
  return (
    <Stack
      direction="row"
      spacing={2}
      alignItems="flex-start"
      sx={{
        p: 2,
        borderRadius: 2,
        border: 1,
        borderStyle: 'dashed',
        borderColor: 'divider',
        bgcolor: 'background.default',
      }}
    >
      <Box aria-hidden="true" sx={{ display: 'flex', color: 'text.secondary', mt: 0.25 }}>
        <Icon icon="solar:bell-linear" width={20} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle2" component="p">
          Notification preferences arrive with the notification centre
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Until then, every category is switched on: you will hear about proposals, deliveries,
          payments, and anything needing a decision in the bell menu.
        </Typography>
      </Box>
    </Stack>
  )
}
