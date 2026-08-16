import { Fragment, useEffect, useMemo, useRef } from 'react'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import dayjs from 'dayjs'

import EmptyState from '@/components/feedback/EmptyState'
import ErrorState from '@/components/feedback/ErrorState'
import ListSkeleton from '@/components/feedback/skeletons/ListSkeleton'
import MessageBubble from '@/features/disputes/components/MessageBubble'
import { formatDate } from '@/utils/formatters'

// The conversation, oldest at the top.
//
// `role="log"` with `aria-live="polite"` (§12): a reply that lands while a
// screen-reader user is on this page is announced where it happens, and the
// list is walkable as a list. Polite rather than assertive on purpose — a
// dispute thread is not urgent enough to interrupt what somebody is reading.
//
// Messages are grouped under date separators, which is what stops a thread that
// ran over three weeks reading as one undifferentiated argument.
//
// The scroll behaviour is the modest one: the thread scrolls its newest message
// into view when the count grows, and never on first paint — landing on a
// dispute should show it from the beginning, since the opening statement is
// the thing being discussed.

/** `[{ day, label, messages }]`, oldest first. */
function groupByDay(messages) {
  const groups = []

  messages.forEach((message) => {
    const day = dayjs(message.createdAt).format('YYYY-MM-DD')
    const last = groups[groups.length - 1]
    if (last?.day === day) {
      last.messages.push(message)
      return
    }
    groups.push({ day, label: formatDate(message.createdAt), messages: [message] })
  })

  return groups
}

/**
 * @param {object} props
 * @param {object[]} [props.messages] the thread, oldest first, internal notes
 *   already filtered by `disputeService.listMessages`
 * @param {Map<string, object>} [props.authors] `usr_…` → account, for names and avatars
 * @param {string} props.viewerId the reader's `usr_…`
 * @param {boolean} [props.isLoading]
 * @param {object} [props.error]
 * @param {() => void} [props.onRetry]
 * @param {string} [props.label='Dispute conversation'] accessible name for the
 *   log — Prompt 33's admin workspace says "case thread" instead, because a
 *   reviewer is reading a case rather than taking part in a conversation
 * @param {string} [props.emptyDescription] what an empty thread says
 */
export default function DisputeThread({
  messages = [],
  authors,
  viewerId,
  isLoading,
  error,
  onRetry,
  label = 'Dispute conversation',
  emptyDescription = 'Messages between you, the other party, and our team appear here.',
}) {
  const endRef = useRef(null)
  const previousCount = useRef(messages.length)

  useEffect(() => {
    if (messages.length > previousCount.current) {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    previousCount.current = messages.length
  }, [messages.length])

  const groups = useMemo(() => groupByDay(messages), [messages])

  if (error) {
    return (
      <ErrorState
        dense
        title="The conversation did not load"
        message="Nothing about the dispute has changed — this just needs another go."
        error={error}
        onRetry={onRetry}
      />
    )
  }

  if (isLoading) {
    return <ListSkeleton rows={3} label="Loading the conversation" />
  }

  if (messages.length === 0) {
    return (
      <EmptyState
        dense
        icon="solar:chat-round-dots-linear"
        title="Nothing said yet"
        description={emptyDescription}
      />
    )
  }

  return (
    <Box
      component="ol"
      role="log"
      aria-live="polite"
      aria-label={label}
      sx={{ listStyle: 'none', m: 0, p: 0 }}
    >
      <Stack spacing={2}>
        {groups.map((group) => (
          <Fragment key={group.day}>
            <Box component="li" sx={{ listStyle: 'none' }}>
              <Divider>
                <Chip size="small" variant="outlined" label={group.label} />
              </Divider>
            </Box>

            {group.messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                author={authors?.get(message.authorId)}
                isOwn={Boolean(viewerId) && message.authorId === viewerId}
              />
            ))}
          </Fragment>
        ))}
      </Stack>
      <Box ref={endRef} aria-hidden="true" />
    </Box>
  )
}
