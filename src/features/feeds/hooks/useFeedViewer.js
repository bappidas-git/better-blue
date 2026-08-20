import { ROLES } from '@/constants/roles'
import { useAuth } from '@/context/AuthContext'
import useApiQuery from '@/hooks/useApiQuery'
import { creatorProfileService } from '@/services/creatorProfileService'

// Who is reading a feed, and — when it is a creator — which storefront they are
// reading it as (Storefront V2, `prompts-v2/08` §2).
//
// The reply area branches four ways and every branch needs the same two
// answers, so they are resolved once here rather than in each card. The
// creator's `cpr_…` is the important half: a reply belongs to a **storefront**,
// not to an account (`docs/data-model.md` → `feedReplies.creatorId`), so the id
// on the session is not the id `feedService` filters by.
//
// Deliberately *not* `useProposeGate`: that hook answers a different question —
// may this creator send a priced proposal — and to answer it, it reads the
// proposals collection. A feed's reply area has nothing to do with proposals
// (V2-08 "Do NOT"), so it does not fetch them.
//
// SECURITY: everything here is UX (00 §11). Which card renders decides what a
// visitor is *offered*, never what they may do — `feedService` refuses a reply
// from anyone but its owner independently, and the Laravel API must too.

/** The four readers of a feed. Admins and super admins are one case: staff. */
export const FEED_VIEWER = Object.freeze({
  GUEST: 'guest',
  BUYER: 'buyer',
  CREATOR: 'creator',
  STAFF: 'staff',
})

function resolveViewer(user) {
  if (!user) return FEED_VIEWER.GUEST
  if (user.role === ROLES.CREATOR) return FEED_VIEWER.CREATOR
  if (user.role === ROLES.BUYER) return FEED_VIEWER.BUYER
  return FEED_VIEWER.STAFF
}

/**
 * @returns {{viewer: string, isCreator: boolean, user: object|null,
 *   creatorUserId: string|null, creatorProfileId: string|null,
 *   creatorName: string|null, isLoading: boolean}}
 *   `creatorProfileId` is `null` for everyone who is not a signed-in creator,
 *   and while their storefront is still loading — which is what `isLoading`
 *   is for, so the reply area waits rather than flashing the wrong card.
 */
export default function useFeedViewer() {
  const { user } = useAuth()

  const viewer = resolveViewer(user)
  const isCreator = viewer === FEED_VIEWER.CREATOR
  const creatorUserId = isCreator ? (user?.id ?? null) : null

  const { data: profile, isLoading } = useApiQuery(
    () => creatorProfileService.getByUserId(creatorUserId),
    [creatorUserId],
    { enabled: Boolean(creatorUserId) }
  )

  return {
    viewer,
    isCreator,
    user: user ?? null,
    creatorUserId,
    creatorProfileId: profile?.id ?? null,
    // What the thread header calls them. The storefront's trading name first,
    // because that is the name the buyer replied to.
    creatorName: profile?.displayName ?? user?.name ?? null,
    isLoading: Boolean(creatorUserId) && isLoading,
  }
}
