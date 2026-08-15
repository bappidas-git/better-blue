import { useEffect, useState } from 'react'

import { useConfirm } from '@/components/feedback/ConfirmDialogProvider'
import { useToast } from '@/components/feedback/ToastProvider'
import useApiMutation from '@/hooks/useApiMutation'
import { creatorProfileService } from '@/services/creatorProfileService'
import { formatNumber } from '@/utils/formatters'

// The one switch on the creator dashboard with a marketplace-wide consequence:
// "Accepting new requests" is the `availability` flag discovery filters on
// (contract §6.4), so turning it off takes the storefront out of `/creators`
// until it goes back on.
//
// Two surfaces render it — the prominent card on the overview and the compact
// switch beside the page header — and they must never disagree, so the state
// and the round trip live here rather than in either component. The value is
// applied optimistically and rolled back on failure: a switch that lags a
// network call by half a second reads as broken.

/**
 * @param {object|null} profile the `creatorProfiles` record
 * @param {object} [options]
 * @param {number} [options.activeOrders=0] orders in flight — turning the
 *   switch off while work is outstanding raises an informational confirmation
 * @param {() => void} [options.onChanged] called after a successful save, so
 *   the page can refetch whatever else depended on the flag
 * @returns {{isAvailable: boolean, isSaving: boolean, canToggle: boolean,
 *   setAvailable: (next: boolean) => Promise<void>}}
 */
export function useCreatorAvailability(profile, { activeOrders = 0, onChanged } = {}) {
  const confirm = useConfirm()
  const toast = useToast()
  const { mutate, isLoading: isSaving } = useApiMutation(creatorProfileService.setAvailability)

  const saved = profile?.availability !== false
  const [isAvailable, setAvailable] = useState(saved)

  // The record is the source of truth. When it arrives (or is refetched after a
  // save elsewhere on the page), the switch follows it.
  useEffect(() => {
    setAvailable(saved)
  }, [saved])

  const apply = async (next) => {
    if (!profile?.id || next === isAvailable) return

    // Closing the storefront while orders are outstanding is allowed — the
    // work carries on either way — but it is worth saying so, because "not
    // accepting requests" reads to some people like "walking away".
    if (!next && activeOrders > 0) {
      const confirmed = await confirm({
        title: 'Stop accepting new requests?',
        message:
          `Your storefront disappears from the creator directory until you switch this back on. ` +
          `The ${formatNumber(activeOrders)} order${activeOrders === 1 ? '' : 's'} already in ` +
          `flight ${activeOrders === 1 ? 'is' : 'are'} not affected — you still owe the ` +
          `${activeOrders === 1 ? 'delivery' : 'deliveries'}, and payment still releases on ` +
          `acceptance.`,
        confirmLabel: 'Stop accepting requests',
        cancelLabel: 'Stay available',
      })
      if (!confirmed) return
    }

    setAvailable(next)
    try {
      await mutate(profile.id, next)
      toast.success(next ? 'You are accepting new requests' : 'You are no longer listed', {
        description: next
          ? 'Your storefront is back in the creator directory.'
          : 'Buyers browsing the directory will not see your storefront until you switch this back on.',
      })
      onChanged?.()
    } catch (failure) {
      setAvailable(!next)
      toast.error('We could not update your availability', { description: failure?.message })
    }
  }

  return {
    isAvailable,
    isSaving,
    canToggle: Boolean(profile?.id) && !isSaving,
    setAvailable: apply,
  }
}

export default useCreatorAvailability
