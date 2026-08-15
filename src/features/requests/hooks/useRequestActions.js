import { useCallback, useState } from 'react'

import { useNavigate } from 'react-router-dom'

import { useConfirm } from '@/components/feedback/ConfirmDialogProvider'
import { useToast } from '@/components/feedback/ToastProvider'
import { paths } from '@/routes/paths'
import { missingPublishFields, requestService } from '@/services/requestService'

// The five things a buyer can do *to* a brief from outside it — publish it,
// close it, cancel it, discard the draft, or reopen it in the wizard.
//
// One hook rather than five handlers per screen, because the list and the
// detail page offer the same actions and must ask the same questions before
// doing them (00 §12: destructive actions always confirm with explicit
// consequence copy, and every mutation toasts and refetches).

/** Actions this hook understands — the value a kebab menu reports. */
export const REQUEST_ACTION = Object.freeze({
  EDIT: 'edit',
  PUBLISH: 'publish',
  CLOSE: 'close',
  CANCEL: 'cancel',
  DISCARD: 'discard',
})

/**
 * @param {object} params
 * @param {string} params.buyerId the signed-in buyer, `usr_…`
 * @param {(action: string, request: object) => void} [params.onChanged] called
 *   after a successful mutation — refetch the list or the brief here
 * @returns {{run: (action: string, request: object) => Promise<void>,
 *   busyRequestId: string|null}}
 */
export function useRequestActions({ buyerId, onChanged }) {
  const confirm = useConfirm()
  const navigate = useNavigate()
  const toast = useToast()

  // The id, not a boolean: the list disables the one card being acted on rather
  // than freezing every card on the page.
  const [busyRequestId, setBusyRequestId] = useState(null)

  const editDraft = useCallback(
    (request) => {
      navigate(paths.buyerRequestDraft(request.id))
    },
    [navigate]
  )

  /**
   * Publishing is two conversations, not one. An unfinished draft is not a
   * confirmation problem — it is a "here is what is still blank, shall we go
   * and fill it in?" problem, so it opens the wizard instead of failing (§13).
   */
  const publish = useCallback(
    async (request) => {
      const missing = missingPublishFields(request)

      if (missing.length > 0) {
        const goToWizard = await confirm({
          title: 'This draft is not finished yet',
          message: `Creators cannot see it until you add: ${missing.join(', ')}.`,
          confirmLabel: 'Finish the draft',
          cancelLabel: 'Not now',
          icon: 'tabler:pencil',
        })
        if (goToWizard) editDraft(request)
        return false
      }

      const ok = await confirm({
        title: 'Publish this request?',
        message:
          'It goes live on the request board straight away, and creators can start sending you ' +
          'priced proposals. You can close it at any time.',
        confirmLabel: 'Publish request',
        icon: 'tabler:send',
      })
      if (!ok) return false

      await requestService.publishDraft(request.id, { buyerId })
      toast.success('Request published', {
        description: 'Proposals usually start arriving within 48 hours.',
      })
      return true
    },
    [buyerId, confirm, editDraft, toast]
  )

  const close = useCallback(
    async (request) => {
      const result = await confirm({
        title: 'Close this request?',
        message:
          'It comes off the request board and stops accepting proposals. Everyone still waiting ' +
          'on a decision is told, and their proposal is declined. This cannot be undone.',
        confirmLabel: 'Close request',
        tone: 'danger',
        allowReason: true,
        reasonLabel: 'Reason',
        reasonPlaceholder: 'We filled the brief elsewhere',
        reasonHelperText: 'Shared with the creators who proposed. Leave it blank to say nothing.',
      })
      if (!result) return false

      const { declinedProposals } = await requestService.closeRequest(request.id, {
        buyerId,
        reason: result.reason,
      })
      toast.success('Request closed', {
        description:
          declinedProposals > 0
            ? `${declinedProposals} ${declinedProposals === 1 ? 'creator has' : 'creators have'} been told.`
            : 'Nobody was waiting on a decision.',
      })
      return true
    },
    [buyerId, confirm, toast]
  )

  const cancel = useCallback(
    async (request) => {
      const result = await confirm({
        title: 'Cancel this request?',
        message:
          'The brief is withdrawn and any proposal still waiting on a decision is declined. ' +
          'This cannot be undone.',
        confirmLabel: 'Cancel request',
        cancelLabel: 'Keep it',
        tone: 'danger',
        requireReason: true,
        reasonPlaceholder: 'The campaign has been postponed',
        reasonHelperText: 'Shared with the creators who proposed on this request.',
      })
      if (!result) return false

      await requestService.cancelRequest(request.id, { buyerId, reason: result.reason })
      toast.success('Request cancelled')
      return true
    },
    [buyerId, confirm, toast]
  )

  /**
   * "Discard draft" rather than "Delete draft": nothing in BetterBlue is ever
   * removed from the database — closing something out is always a status
   * transition (`docs/api-contract.md` §1.7), so a discarded draft becomes a
   * `cancelled` brief and stops appearing anywhere a draft would. The copy says
   * so rather than promising a deletion that does not happen.
   */
  const discard = useCallback(
    async (request) => {
      const ok = await confirm({
        title: 'Discard this draft?',
        message:
          'It is removed from your drafts and can no longer be edited or published. It stays in ' +
          'your closed requests for your records.',
        confirmLabel: 'Discard draft',
        cancelLabel: 'Keep editing',
        tone: 'danger',
      })
      if (!ok) return false

      await requestService.cancelRequest(request.id, { buyerId })
      toast.success('Draft discarded')
      return true
    },
    [buyerId, confirm, toast]
  )

  const run = useCallback(
    async (action, request) => {
      if (!request) return

      if (action === REQUEST_ACTION.EDIT) {
        editDraft(request)
        return
      }

      const handler = {
        [REQUEST_ACTION.PUBLISH]: publish,
        [REQUEST_ACTION.CLOSE]: close,
        [REQUEST_ACTION.CANCEL]: cancel,
        [REQUEST_ACTION.DISCARD]: discard,
      }[action]

      if (!handler) return

      setBusyRequestId(request.id)
      try {
        if (await handler(request)) onChanged?.(action, request)
      } catch (failure) {
        // A stale tab is the common case here — someone else already published,
        // closed, or awarded this brief — so the service's own message is shown
        // rather than a generic one, and the caller refetches to catch up (§13).
        toast.error('That did not go through', {
          description: failure?.message ?? 'Reload the page and try again.',
        })
        onChanged?.(action, request)
      } finally {
        setBusyRequestId(null)
      }
    },
    [cancel, close, discard, editDraft, onChanged, publish, toast]
  )

  return { run, busyRequestId }
}

export default useRequestActions
