import Container from '@mui/material/Container'

import EmptyState from '@/components/feedback/EmptyState'
import { paths } from '@/routes/paths'

// What a visitor sees when a storefront exists but is not open to the public —
// the owner's account is suspended, blacklisted, or deactivated (00 §9).
//
// The copy says nothing about *why*. A moderation outcome is between the
// platform and the member; a stranger who followed a link is only owed a clear
// statement that this profile is not available and a way onward.

/**
 * @param {object} props
 * @param {string} [props.displayName] the creator's name, when it is known
 */
export default function UnavailableProfile({ displayName }) {
  return (
    <Container maxWidth="sm" sx={{ px: { xs: 2, md: 4 }, py: { xs: 8, md: 12 } }}>
      <EmptyState
        icon="tabler:user-off"
        title="This creator is currently unavailable"
        description={
          displayName
            ? `${displayName}'s profile is not accepting visitors right now. Plenty of other verified creators are ready to take on commercial work.`
            : 'This profile is not accepting visitors right now. Plenty of other verified creators are ready to take on commercial work.'
        }
        primaryAction={{ label: 'Browse creators', to: paths.CREATORS, icon: 'tabler:users-group' }}
        secondaryAction={{ label: 'Go to home', to: paths.HOME }}
      />
    </Container>
  )
}
