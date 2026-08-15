import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import DashboardPage from '@/layouts/dashboard/DashboardPage'

// TEMP: replaced by the real overviews in Prompts 15 (buyer), 21 (creator), and
// 28 (admin). Since Prompt 14 it renders inside the real `DashboardLayout` — the
// sidebar, top bar, bottom bar, and "More" sheet around this card are the
// finished article; only the card itself is a placeholder.
//
// It goes through `DashboardPage` like every other dashboard screen (00 §12), so
// the page title reaches the top bar and the browser tab from the same place the
// real overview will set it.

/**
 * @param {object} props
 * @param {string} props.title page heading, top-bar title, and document title
 * @param {string} props.subtitle one line on what this dashboard is for
 * @param {string} props.description what the real overview will show
 * @param {string} props.icon iconify name for the role
 * @param {string} props.arrivesIn which prompt builds the real screen
 */
export default function RoleHomePlaceholder({
  title,
  subtitle,
  description,
  icon,
  arrivesIn,
}) {
  return (
    <DashboardPage title={title} subtitle={subtitle}>
      <Card>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={2.5} alignItems="flex-start">
            <Box
              aria-hidden="true"
              sx={{
                width: 52,
                height: 52,
                borderRadius: 3,
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'primary.surface',
                color: 'primary.main',
              }}
            >
              <Icon icon={icon} width={26} />
            </Box>

            <Box>
              <Typography variant="h6" component="h2" gutterBottom>
                Overview arrives in {arrivesIn}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '62ch' }}>
                {description}
              </Typography>
            </Box>

            <Typography variant="caption" color="text.secondary">
              The navigation, top bar, and mobile bar around this card are the real dashboard
              framework — later prompts append their screens to `routes/navConfig.jsx` and they
              appear here.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </DashboardPage>
  )
}
