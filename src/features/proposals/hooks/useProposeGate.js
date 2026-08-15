import { useCallback, useMemo } from 'react'

import { ROLES } from '@/constants/roles'
import { REQUEST_STATUS } from '@/constants/statuses'
import { useAuth } from '@/context/AuthContext'
import useApiQuery from '@/hooks/useApiQuery'
import { paths } from '@/routes/paths'
import {
  creatorProfileService,
  getCreatorProfileCompleteness,
} from '@/services/creatorProfileService'
import { proposalService } from '@/services/proposalService'

// Everything the request board needs to know about *who is reading it* — and,
// on a brief's detail page, whether they may answer it.
//
// One hook rather than a condition per screen, because the answer is the same
// on the board card, the detail page's action panel, and the dialog's own
// submit guard, and three copies of it would disagree the first time a rule
// moved. The rules it reports are the UI half of `proposalService`'s guards:
// the service refuses the same submissions independently (00 §11 — a hidden
// button is not a permission).

/** Storefront completeness a creator needs before they may propose (§4.3). */
export const PROPOSE_COMPLETENESS_TARGET = 60

/** Who is looking at a brief — the action panel branches on this. */
export const VIEWER = Object.freeze({
  GUEST: 'guest',
  BUYER: 'buyer',
  CREATOR: 'creator',
  OTHER: 'other',
})

function resolveViewer(user) {
  if (!user) return VIEWER.GUEST
  if (user.role === ROLES.CREATOR) return VIEWER.CREATOR
  if (user.role === ROLES.BUYER) return VIEWER.BUYER
  return VIEWER.OTHER
}

/**
 * @typedef {object} ProposeBlocker
 * @property {string} key stable identifier, e.g. `'completeness'`
 * @property {string} message the visible helper line — a reason, never a telling-off
 * @property {{label: string, to: string}} [action] the way to clear it
 */

/**
 * @param {object} [options]
 * @param {object|null} [options.request] the brief being looked at — omit on the
 *   board, where there is no single brief to gate
 * @returns {{viewer: string, isCreator: boolean, creatorUserId: string|null,
 *   profile: object|null, creatorProfileId: string|null, categoryIds: string[],
 *   completeness: object|null, isAvailable: boolean, existingProposal: object|null,
 *   hasProposed: boolean, canPropose: boolean, blockers: ProposeBlocker[],
 *   isLoading: boolean, refresh: () => void}}
 */
export default function useProposeGate({ request } = {}) {
  const { user } = useAuth()
  const viewer = resolveViewer(user)
  const isCreator = viewer === VIEWER.CREATOR
  const creatorUserId = isCreator ? (user?.id ?? null) : null

  const {
    data: profile,
    isLoading: isProfileLoading,
    refetch: refetchProfile,
  } = useApiQuery(() => creatorProfileService.getByUserId(creatorUserId), [creatorUserId], {
    enabled: Boolean(creatorUserId),
  })

  const requestId = request?.id ?? null

  const {
    data: existingProposal,
    isLoading: isProposalLoading,
    refetch: refetchProposal,
  } = useApiQuery(
    () => proposalService.getCreatorProposalFor(requestId, creatorUserId),
    [requestId, creatorUserId],
    { enabled: Boolean(requestId && creatorUserId) }
  )

  const completeness = useMemo(
    () => (profile ? getCreatorProfileCompleteness(profile, user) : null),
    [profile, user]
  )

  const refresh = useCallback(() => {
    refetchProfile()
    refetchProposal()
  }, [refetchProfile, refetchProposal])

  const isAvailable = profile ? profile.availability !== false : true
  const hasProposed = Boolean(existingProposal)

  const isLoading =
    (Boolean(creatorUserId) && isProfileLoading) ||
    (Boolean(requestId && creatorUserId) && isProposalLoading)

  const blockers = useMemo(() => {
    if (!isCreator || isLoading) return []

    const reasons = []

    if (request && request.status !== REQUEST_STATUS.OPEN) {
      reasons.push({
        key: 'closed',
        message: 'This request is no longer open, so it is not taking new proposals.',
      })
    }

    if ((completeness?.percent ?? 0) < PROPOSE_COMPLETENESS_TARGET) {
      reasons.push({
        key: 'completeness',
        message:
          `Your profile is ${completeness?.percent ?? 0}% complete. Buyers compare proposals ` +
          `side by side, so we ask for ${PROPOSE_COMPLETENESS_TARGET}% before you send one.`,
        action: { label: 'Finish your profile', to: paths.CREATOR_PROFILE },
      })
    }

    if (!isAvailable) {
      reasons.push({
        key: 'availability',
        message:
          'You are currently not accepting new requests. Turn availability back on and this brief is yours to answer.',
        action: { label: 'Update availability', to: paths.CREATOR_PROFILE },
      })
    }

    return reasons
  }, [completeness, isAvailable, isCreator, isLoading, request])

  return {
    viewer,
    isCreator,
    creatorUserId,
    profile: profile ?? null,
    creatorProfileId: profile?.id ?? null,
    categoryIds: profile?.categories ?? [],
    completeness,
    isAvailable,
    existingProposal: existingProposal ?? null,
    hasProposed,
    canPropose: isCreator && !isLoading && !hasProposed && blockers.length === 0,
    blockers,
    isLoading,
    refresh,
  }
}
