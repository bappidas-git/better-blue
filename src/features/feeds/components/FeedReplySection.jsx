import { useCallback, useEffect, useRef, useState } from 'react'

import { Icon } from '@iconify/react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useLocation } from 'react-router-dom'

import ErrorState from '@/components/feedback/ErrorState'
import RoleGateDialog from '@/components/feedback/RoleGateDialog'
import { useConfirm } from '@/components/feedback/ConfirmDialogProvider'
import { useToast } from '@/components/feedback/ToastProvider'
import { FEED_DEAL_STATUS } from '@/constants/feedStatus'
import { ROLES } from '@/constants/roles'
import useApiMutation from '@/hooks/useApiMutation'
import useApiQuery from '@/hooks/useApiQuery'
import { API_ERROR_CODE } from '@/services/api/apiError'
import { feedService } from '@/services/feedService'

import useFeedViewer from '../hooks/useFeedViewer'
import ReplyComposer from './ReplyComposer'
import ReplyGateCard from './ReplyGateCard'
import ReplyThreadCard from './ReplyThreadCard'

// The reply area under a feed — the viewer-aware half of the details page
// (Storefront V2, `prompts-v2/08` §2).
//
// Four readers, four cards, one rule:
//
// | Reader | What renders |
// |---|---|
// | Guest, buyer, admin | The gate card — a count and a Reply button that opens `RoleGateDialog` |
// | Creator, no reply, feed open | The composer |
// | Creator, no reply, feed closed | Why they cannot start one |
// | Creator with a reply | Their own thread, and only ever their own |
//
// PRIVACY — the point of the whole screen. The only reply this component ever
// asks for is `feedService.getMyReply(feedId, creatorProfileId)`, which filters
// on the creator's own storefront id, and that call is made **only** when a
// creator is signed in. No branch lists the replies on a feed, no branch counts
// them per creator, and the number a guest sees is the `repliesCount` already
// on the public feed record. A creator therefore cannot see another creator's
// thread, and a guest, a buyer, or an admin cannot see any thread at all.
//
// SECURITY: none of the above is a boundary — it is UX (00 §11). `feedService`
// refuses a foreign reply independently, and **the Laravel API must scope every
// reply query to the signed-in creator server-side**; a client that asked for
// `GET /feed-replies?feedId=…` must get its own thread or nothing, whatever
// this component does.

/** The card wrapper the composer and the closed notice share. */
function ReplyCard({ children }) {
  return (
    <Card>
      <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>{children}</CardContent>
    </Card>
  )
}

/** Placeholder while we work out whether this creator already has a thread. */
function ReplyAreaSkeleton() {
  return (
    <Card aria-hidden="true">
      <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
        <Skeleton variant="text" width="46%" height={26} />
        <Skeleton variant="text" width="72%" height={18} />
        <Skeleton variant="rounded" height={112} sx={{ mt: 2 }} />
        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1.5 }}>
          <Skeleton variant="rounded" width={128} height={40} />
        </Stack>
      </CardContent>
    </Card>
  )
}

/**
 * @param {object} props
 * @param {object} props.feed the feed being read, with `dealStatus` attached
 * @param {string} props.buyerName the business, as every card names it
 * @param {() => void} props.onRepliesChanged refetch the feed, so the public
 *   count catches up after a reply is opened or deleted
 * @param {string} props.headingId id for whichever card's heading renders
 */
export default function FeedReplySection({ feed, buyerName, onRepliesChanged, headingId }) {
  const location = useLocation()
  const toast = useToast()
  const confirm = useConfirm()

  const { isCreator, creatorUserId, creatorProfileId, isLoading: isViewerLoading } =
    useFeedViewer()

  const [isGateOpen, setGateOpen] = useState(false)
  const composerRef = useRef(null)
  const sectionRef = useRef(null)
  const pendingSeq = useRef(0)

  const isOpen = feed.dealStatus === FEED_DEAL_STATUS.OPEN

  /* -- the one reply this page may read ----------------------------------- */

  // The answer is stamped with the query it belongs to. Two reasons, and both
  // matter: `useApiQuery` initialises `isLoading` from `enabled`, so the render
  // where the creator's storefront id first arrives still reports "not
  // loading" — reading that would flash the composer, replace it with a
  // skeleton, and bring it back. And a `null` reply is a real answer ("you have
  // not written one"), indistinguishable from the `null` the hook starts with
  // unless something else says which query produced it.
  const replyKey = creatorProfileId ? `${feed.id}::${creatorProfileId}` : null

  const {
    data: replyResult,
    error: replyError,
    refetch: refetchReply,
  } = useApiQuery(
    async () => ({ key: replyKey, reply: await feedService.getMyReply(feed.id, creatorProfileId) }),
    [feed.id, creatorProfileId],
    { enabled: Boolean(creatorProfileId) }
  )

  // A local copy, because sending a message renders before the server has
  // agreed to it. Every write below sets this from the service's own return
  // value, so the optimistic state is only ever ahead of the server by the
  // length of one request.
  //
  // Synced **during** the render that receives an answer, not in an effect: an
  // effect would leave one render showing the previous state, which is a
  // composer flashing where a thread belongs and — since the composer then
  // unmounts — an `intent=reply` focus landing on a field that is about to
  // disappear. `replyResult` is a fresh object per fetch, so identity is what
  // "this is new" means, and a repeat fetch of the same key still syncs.
  const [reply, setReply] = useState(null)
  const [syncedResult, setSyncedResult] = useState(null)
  if (replyResult !== syncedResult) {
    setSyncedResult(replyResult)
    setReply(replyResult?.key === replyKey ? replyResult.reply : null)
  }

  const createReply = useApiMutation(feedService.createReply)
  const addMessage = useApiMutation(feedService.addReplyMessage)
  const deleteReply = useApiMutation(feedService.deleteMyReply)

  /* -- writes -------------------------------------------------------------- */

  const handleCreate = useCallback(
    async (body) => {
      try {
        const created = await createReply.mutate(feed.id, { creatorId: creatorProfileId, body })
        setReply(created)
        toast.success('Your reply is with the buyer.', {
          description: 'Only they can read it. They are notified straight away.',
        })
        onRepliesChanged()
      } catch (error) {
        toast.error(error.message)
        // A conflict means a thread already exists — from another tab, or a
        // double submit. Reading it back turns the refusal into their thread.
        if (error?.code === API_ERROR_CODE.CONFLICT) refetchReply()
        throw error
      }
    },
    [createReply, creatorProfileId, feed.id, onRepliesChanged, refetchReply, toast]
  )

  const handleSend = useCallback(
    async (body) => {
      const previous = reply
      const optimistic = {
        // A render key, not an id. Record ids are minted in the services layer
        // (00 §8) and this bubble is replaced by the server's own message as
        // soon as the request lands.
        id: `pending-${(pendingSeq.current += 1)}`,
        authorRole: 'creator',
        authorId: creatorUserId,
        body,
        at: new Date().toISOString(),
        // Marks the bubble as not-yet-acknowledged; the server's own record
        // replaces it a moment later and carries no such flag.
        pending: true,
      }

      setReply((current) =>
        current ? { ...current, messages: [...current.messages, optimistic] } : current
      )

      try {
        const updated = await addMessage.mutate(
          previous.id,
          { authorRole: 'creator', authorId: creatorUserId, body },
          { creatorId: creatorProfileId }
        )
        setReply(updated)
      } catch (error) {
        // Rollback: the thread goes back to exactly what the server last told
        // us, so a failed send never leaves a message that does not exist.
        setReply(previous)
        toast.error(error.message)
        throw error
      }
    },
    [addMessage, creatorProfileId, creatorUserId, reply, toast]
  )

  const handleDelete = useCallback(async () => {
    const confirmed = await confirm({
      title: 'Delete this reply?',
      message: `This permanently removes your reply and conversation with ${buyerName}. It cannot be undone, and ${buyerName} will no longer see any of it.`,
      confirmLabel: 'Delete reply',
      tone: 'danger',
    })
    if (!confirmed) return

    try {
      await deleteReply.mutate(reply.id, { creatorId: creatorProfileId })
      setReply(null)
      toast.success('Your reply has been deleted.')
      onRepliesChanged()
    } catch (error) {
      toast.error(error.message)
    }
  }, [buyerName, confirm, creatorProfileId, deleteReply, onRepliesChanged, reply, toast])

  /* -- `state.intent = 'reply'`, handed over by the feed cards (V2-07) ----- */

  const intent = location.state?.intent

  // Settled = we know which card belongs here. A creator with no storefront and
  // a failed read are both settled answers; only "still finding out" is not.
  const isSettled =
    !isViewerLoading && (!creatorProfileId || Boolean(replyError) || replyResult?.key === replyKey)

  const intentHandled = useRef(false)
  useEffect(() => {
    if (intent !== 'reply' || intentHandled.current || !isSettled) return
    const field = composerRef.current
    if (!field) return

    intentHandled.current = true

    // Scroll the area into view, then focus without a second scroll — the
    // reduced-motion reader gets the same landing, instantly.
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    sectionRef.current?.scrollIntoView({
      behavior: prefersReduced ? 'auto' : 'smooth',
      block: 'start',
    })
    field.focus({ preventScroll: true })
  }, [intent, isSettled])

  /* -- what renders -------------------------------------------------------- */

  let content

  if (!isCreator) {
    content = (
      <ReplyGateCard
        headingId={headingId}
        repliesCount={feed.repliesCount}
        canReply={isOpen}
        onReply={() => setGateOpen(true)}
      />
    )
  } else if (!isSettled) {
    content = <ReplyAreaSkeleton />
  } else if (replyError && !reply) {
    content = (
      <ReplyCard>
        <ErrorState
          title="We could not open your conversation"
          message="Your reply is safe — we just could not read it this time."
          error={replyError}
          onRetry={refetchReply}
        />
      </ReplyCard>
    )
  } else if (reply) {
    content = (
      <ReplyThreadCard
        headingId={headingId}
        reply={reply}
        buyerName={buyerName}
        composerRef={composerRef}
        isSending={addMessage.isLoading}
        isDeleting={deleteReply.isLoading}
        onSendMessage={handleSend}
        onDelete={handleDelete}
      />
    )
  } else if (!isOpen) {
    content = (
      <ReplyCard>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Box aria-hidden="true" sx={{ display: 'flex', pt: '2px', color: 'text.secondary' }}>
            <Icon icon="solar:chat-round-line-linear" width={22} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography id={headingId} variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
              This feed is no longer taking replies
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              The buyer has moved on from this brief. Plenty of businesses are still looking —
              the feeds board is the place to find them.
            </Typography>
          </Box>
        </Stack>
      </ReplyCard>
    )
  } else if (!creatorProfileId) {
    // A creator account with no storefront record. Rare, and not something the
    // composer can work around: a reply belongs to a storefront.
    content = (
      <ReplyCard>
        <Typography id={headingId} variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
          We could not find your storefront
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          Replies are sent from your creator storefront, so we need to load it before you can
          write one. Reload the page, and tell us if it keeps happening.
        </Typography>
      </ReplyCard>
    )
  } else {
    content = (
      <ReplyCard>
        <Typography id={headingId} variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
          Reply to {buyerName}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, mb: 2 }}>
          Your reply opens a private conversation with this business — no other creator can see
          it. Say what you would shoot, what you would need from them, and when you could
          deliver.
        </Typography>
        <ReplyComposer
          label="Your reply"
          placeholder="Introduce yourself, say how you would approach this brief, and give the buyer a sense of your timings."
          submitLabel="Send reply"
          hint={`Private to you and ${buyerName}.`}
          inputRef={composerRef}
          isSubmitting={createReply.isLoading}
          onSubmit={handleCreate}
        />
      </ReplyCard>
    )
  }

  return (
    <Box ref={sectionRef} component="section" aria-labelledby={headingId} sx={{ scrollMarginTop: 88 }}>
      {content}

      {/* Rendered for everyone the gate applies to — a signed-in creator never
          opens it, because their Reply button is the composer's submit. */}
      {!isCreator ? (
        <RoleGateDialog
          open={isGateOpen}
          onClose={() => setGateOpen(false)}
          requiredRole={ROLES.CREATOR}
          action="reply to this feed"
        />
      ) : null}
    </Box>
  )
}
