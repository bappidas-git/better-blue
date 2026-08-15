import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

import UserAvatar from '@/components/data-display/UserAvatar'
import { ROLE_META } from '@/constants/roles'
import { useAuth } from '@/context/AuthContext'
import useDocumentTitle from '@/hooks/useDocumentTitle'

// TEMP: replaced in Prompts 14/15/21/28 by the real buyer, creator, and admin
// dashboards on top of DashboardLayout. It exists now so every role has a
// landing page to be redirected *to* — the guards, the post-sign-in redirect,
// and the deep-link restore all need a real destination to prove they work.
//
// Deliberately plain: no data, no nav, nothing a later prompt has to unpick.

/**
 * @param {object} props
 * @param {string} props.title page heading and document title
 * @param {string} props.description one line on what lands here later
 * @param {string} props.icon iconify name for the role
 * @param {string} props.arrivesIn which prompt builds the real screen
 */
export default function RoleHomePlaceholder({ title, description, icon, arrivesIn }) {
  const { user, logout } = useAuth()
  useDocumentTitle(title)

  return (
    <Container maxWidth="md" sx={{ px: { xs: 2, md: 4 }, py: { xs: 5, md: 8 } }}>
      <Stack spacing={3}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ color: 'primary.main', display: 'flex' }}>
            <Icon icon={icon} width={28} />
          </Box>
          <Typography variant="h4" component="h1">
            {title}
          </Typography>
        </Stack>

        <Card>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Stack spacing={3}>
              <Stack direction="row" spacing={2} alignItems="center">
                <UserAvatar name={user?.name} src={user?.avatarUrl} size="lg" />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h6" component="p" noWrap>
                    Signed in as {user?.name}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                    <Chip
                      size="small"
                      label={ROLE_META[user?.role]?.label ?? user?.role}
                      sx={{ bgcolor: 'primary.surface', color: 'primary.dark', fontWeight: 600 }}
                    />
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {user?.email}
                    </Typography>
                  </Stack>
                </Box>
              </Stack>

              <Typography variant="body1" color="text.secondary">
                {description}
              </Typography>

              <Button
                variant="outlined"
                onClick={logout}
                startIcon={<Icon icon="tabler:logout" width={18} />}
                sx={{ alignSelf: 'flex-start' }}
              >
                Log out
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Typography variant="caption" color="text.secondary">
          Placeholder screen — the real dashboard arrives in {arrivesIn}.
        </Typography>
      </Stack>
    </Container>
  )
}
