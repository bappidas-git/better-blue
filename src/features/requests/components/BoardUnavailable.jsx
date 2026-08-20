import Container from '@mui/material/Container'

import EmptyState from '@/components/feedback/EmptyState'
import { paths } from '@/routes/paths'

// What a visitor sees when `features.publicRequestBoard` is switched off
// (Prompt 23 §4.2, contract §6.27).
//
// A flag being off is not an error and not a 404 — the briefs still exist, they
// are simply not being shown publicly today. So this says that plainly and
// points at the two doors that *are* open: creator sign-up and the directory.
// Creators are never sent here; they browse from their dashboard, which is not
// behind the flag.
//
// Storefront-only (both callers are public pages), so V2-02 gave it the
// storefront's vocabulary: this surface is called Feeds. The flag keeps its
// name — it is a settings key, not a label.

/**
 * @param {object} [props]
 * @param {string} [props.title]
 * @param {string} [props.description]
 */
export default function BoardUnavailable({
  title = 'Feeds are not public right now',
  description = 'Businesses are still posting briefs — they are just not listed publicly at the moment. Create a creator account and you will see every open brief from your dashboard.',
}) {
  return (
    <Container maxWidth="md" sx={{ px: { xs: 2, md: 4 }, py: { xs: 6, md: 10 } }}>
      <EmptyState
        icon="solar:clipboard-list-linear"
        title={title}
        description={description}
        primaryAction={{ label: 'Become a creator', to: paths.REGISTER }}
        secondaryAction={{ label: 'Browse creators', to: paths.CREATORS }}
      />
    </Container>
  )
}
