import { useMemo } from 'react'

import { ROLES } from '@/constants/roles'
import { ACCOUNT_STATUS } from '@/constants/statuses'
import { useAuth } from '@/context/AuthContext'
import { paths } from '@/routes/paths'

// "Start a request" means something different to everybody who reads it, so the
// decision lives here rather than inside the header: the components render what
// this returns, and the whole CTA matrix is auditable in one place.
//
//   guest    → /register, with the request form remembered as the deep link
//   buyer    → the request form, pre-pointed at this creator
//   creator  → nothing (a creator cannot commission another creator)
//   admin    → nothing (the buyer dashboard is not theirs to enter)
//
// SECURITY: hiding a button is not authorization (00 §11). Every route behind
// it is guarded, and the Laravel API must enforce the same rules again.

/** Query parameter carrying the creator hint into the request form. */
export const CREATOR_HINT_PARAM = 'creator'

/** Roles that are offered the CTA at all. */
const REQUESTING_ROLES = [ROLES.BUYER]

/**
 * Where "Start a request" goes for the current visitor, and whether it can be
 * pressed at all.
 *
 * @param {object} [profile] the creator storefront being viewed
 * @returns {{
 *   isVisible: boolean,
 *   isDisabled: boolean,
 *   disabledReason: string|null,
 *   label: string,
 *   to: string|null,
 *   state: object|undefined,
 * }}
 */
export function useCreatorRequestCta(profile) {
  const { user, isAuthenticated } = useAuth()
  const role = user?.role

  return useMemo(() => {
    const creatorId = profile?.id
    const isSuspended =
      Boolean(profile?.profileStatus) && profile.profileStatus !== ACCOUNT_STATUS.ACTIVE
    // `availability === false` is the creator saying "not right now"; an absent
    // field is not a closed door.
    const isPaused = profile?.availability === false

    const hidden = {
      isVisible: false,
      isDisabled: true,
      disabledReason: null,
      label: 'Start a request',
      to: null,
      state: undefined,
    }

    if (!creatorId || isSuspended) return hidden
    if (isAuthenticated && !REQUESTING_ROLES.includes(role)) return hidden

    const search = `?${CREATOR_HINT_PARAM}=${encodeURIComponent(creatorId)}`
    const requestForm = { pathname: paths.BUYER_REQUEST_NEW, search }

    return {
      isVisible: true,
      isDisabled: isPaused,
      disabledReason: isPaused
        ? 'This creator is not accepting new requests right now.'
        : null,
      label: 'Start a request',
      // Signed out, the form is behind registration — so it is carried along as
      // the deep link `GuestRoute` returns to once an account exists (Prompt 09).
      to: isAuthenticated ? `${paths.BUYER_REQUEST_NEW}${search}` : paths.REGISTER,
      state: isAuthenticated ? undefined : { from: requestForm },
    }
  }, [isAuthenticated, profile, role])
}

export default useCreatorRequestCta
