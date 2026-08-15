import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

import FormTextField from '@/components/inputs/FormTextField'
import { useAuth } from '@/context/AuthContext'
// Both of these are role-neutral — the password form and the placeholder that
// Prompt 27 replaces — so the creator's Settings renders the buyer's components
// rather than growing a second copy. They stay in `buyerAccount/` for now
// because moving them would edit the buyer screens, which this prompt is not
// allowed to touch (§17); Prompt 27, which rewrites the notification slot
// anyway, is the natural moment to promote both into a shared folder.
import PasswordChangeCard from '@/features/buyerAccount/components/PasswordChangeCard'
import SettingsNotificationSlot from '@/features/buyerAccount/components/SettingsNotificationSlot'
import CreatorDangerZoneCard from '@/features/creatorAccount/components/CreatorDangerZoneCard'
import DashboardPage from '@/layouts/dashboard/DashboardPage'
import { paths } from '@/routes/paths'

// Account settings for a creator: the sign-in details, what BetterBlue is
// allowed to send, and the way out.
//
// Storefront details are *not* here — they live on the Profile screen, because
// they are what buyers read rather than how the account works. Keeping the
// split sharp is what stops this page turning into a second profile form.

/** Content column cap for form pages (§6). */
const FORM_MAX_WIDTH = 720

export default function CreatorSettingsPage() {
  const { user } = useAuth()

  return (
    <DashboardPage
      title="Settings"
      subtitle="Your sign-in details, notifications, and account status."
      maxWidth={false}
      sx={{ maxWidth: FORM_MAX_WIDTH, mx: 'auto' }}
    >
      <Stack spacing={{ xs: 2, md: 3 }}>
        <Card>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Typography variant="h6" component="h2" sx={{ fontSize: '1.0625rem' }}>
              Account
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
              How you sign in to BetterBlue.
            </Typography>

            <Stack spacing={3}>
              <FormTextField
                id="settings-email"
                label="Email address"
                value={user?.email ?? ''}
                onChange={() => {}}
                // The sign-in identifier is unique across the platform and is
                // referenced by every notification and payout advice, so
                // changing it is a support action rather than a self-service
                // one (contract §6.2).
                InputProps={{ readOnly: true }}
                helperText={
                  <>
                    Your email is also your sign-in name.{' '}
                    <Link component={RouterLink} to={paths.CONTACT}>
                      Contact support
                    </Link>{' '}
                    to change it.
                  </>
                }
              />

              <Divider />

              <PasswordChangeCard />
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Typography variant="h6" component="h2" sx={{ fontSize: '1.0625rem' }}>
              Preferences
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
              What BetterBlue tells you about, and where.
            </Typography>

            <SettingsNotificationSlot />
          </CardContent>
        </Card>

        <CreatorDangerZoneCard />
      </Stack>
    </DashboardPage>
  )
}
